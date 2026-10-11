use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use super::transfer_to_vault;
use crate::constants::*;
use crate::errors::ArisanError;
use crate::events::Contributed;
use crate::state::{Group, GroupStatus, Member};

#[derive(Accounts)]
pub struct Contribute<'info> {
    pub wallet: Signer<'info>,

    #[account(
        mut,
        seeds = [GROUP_SEED, group.creator.as_ref(), &group.group_id.to_le_bytes()],
        bump = group.bump,
        has_one = mint,
        has_one = vault,
    )]
    pub group: Account<'info, Group>,

    #[account(
        mut,
        seeds = [MEMBER_SEED, group.key().as_ref(), wallet.key().as_ref()],
        bump = member.bump,
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
}

pub fn handler(ctx: Context<Contribute>) -> Result<()> {
    let group = &ctx.accounts.group;
    require!(
        group.status == GroupStatus::Active,
        ArisanError::GroupNotActive
    );
    require!(
        Clock::get()?.unix_timestamp <= group.round_deadline,
        ArisanError::RoundDeadlinePassed
    );
    require!(
        ctx.accounts.member.rounds_settled == group.current_round,
        ArisanError::AlreadySettledRound
    );

    let amount = group.contribution_amount;
    transfer_to_vault(
        &ctx.accounts.token_program,
        &ctx.accounts.wallet_token,
        &ctx.accounts.mint,
        &ctx.accounts.vault,
        &ctx.accounts.wallet,
        amount,
    )?;

    let member = &mut ctx.accounts.member;
    member.rounds_settled = member
        .rounds_settled
        .checked_add(1)
        .ok_or(ArisanError::MathOverflow)?;

    let group = &mut ctx.accounts.group;
    group.round_settled_count = group
        .round_settled_count
        .checked_add(1)
        .ok_or(ArisanError::MathOverflow)?;

    emit!(Contributed {
        group: group.key(),
        wallet: member.wallet,
        round: group.current_round,
        amount,
    });
    Ok(())
}
