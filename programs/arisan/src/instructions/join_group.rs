use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use super::transfer_to_vault;
use crate::constants::*;
use crate::errors::ArisanError;
use crate::events::{GroupStarted, MemberJoined};
use crate::state::{Group, GroupStatus, Member};

#[derive(Accounts)]
pub struct JoinGroup<'info> {
    #[account(mut)]
    pub wallet: Signer<'info>,

    #[account(
        mut,
        seeds = [GROUP_SEED, group.creator.as_ref(), &group.group_id.to_le_bytes()],
        bump = group.bump,
        has_one = mint,
        has_one = vault,
    )]
    pub group: Account<'info, Group>,

    /// `init` fails if this wallet already joined, so a wallet holds one seat.
    #[account(
        init,
        payer = wallet,
        space = 8 + Member::INIT_SPACE,
        seeds = [MEMBER_SEED, group.key().as_ref(), wallet.key().as_ref()],
        bump,
    )]
    pub member: Account<'info, Member>,

    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = wallet_token.mint == mint.key() @ ArisanError::InvalidTokenAccount,
    )]
    pub wallet_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<JoinGroup>) -> Result<()> {
    let group = &ctx.accounts.group;
    require!(
        group.status == GroupStatus::Forming,
        ArisanError::GroupNotForming
    );
    require!(
        group.member_count() < group.max_members,
        ArisanError::GroupFull
    );

    transfer_to_vault(
        &ctx.accounts.token_program,
        &ctx.accounts.wallet_token,
        &ctx.accounts.mint,
        &ctx.accounts.vault,
        &ctx.accounts.wallet,
        group.collateral_amount,
    )?;

    let wallet = ctx.accounts.wallet.key();
    let group_key = ctx.accounts.group.key();
    let group = &mut ctx.accounts.group;

    ctx.accounts.member.set_inner(Member {
        group: group_key,
        wallet,
        collateral: group.collateral_amount,
        rounds_settled: 0,
        missed_rounds: 0,
        has_received: false,
        bump: ctx.bumps.member,
    });

    group.members.push(wallet);
    emit!(MemberJoined {
        group: group_key,
        wallet,
        position: group.member_count() - 1,
    });

    if group.member_count() == group.max_members {
        let now = Clock::get()?.unix_timestamp;
        group.status = GroupStatus::Active;
        group.current_round = 0;
        group.round_deadline = now
            .checked_add(group.period_secs)
            .ok_or(ArisanError::MathOverflow)?;
        emit!(GroupStarted {
            group: group_key,
            first_deadline: group.round_deadline,
        });
    }
    Ok(())
}
