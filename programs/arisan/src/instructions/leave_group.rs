use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use super::transfer_from_vault;
use crate::constants::*;
use crate::errors::ArisanError;
use crate::events::MemberLeft;
use crate::state::{Group, GroupStatus, Member};

#[derive(Accounts)]
pub struct LeaveGroup<'info> {
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

    #[account(
        mut,
        close = wallet,
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
        constraint = wallet_token.owner == wallet.key() @ ArisanError::InvalidTokenAccount,
    )]
    pub wallet_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<LeaveGroup>) -> Result<()> {
    require!(
        ctx.accounts.group.status == GroupStatus::Forming,
        ArisanError::GroupNotForming
    );

    let amount = ctx.accounts.member.collateral;
    transfer_from_vault(
        &ctx.accounts.token_program,
        &ctx.accounts.group,
        &ctx.accounts.vault,
        &ctx.accounts.mint,
        &ctx.accounts.wallet_token,
        amount,
    )?;
    ctx.accounts.member.collateral = 0;

    let wallet = ctx.accounts.wallet.key();
    let group_key = ctx.accounts.group.key();
    // Keeps the remaining members in join order.
    ctx.accounts.group.members.retain(|m| *m != wallet);

    emit!(MemberLeft {
        group: group_key,
        wallet,
    });
    Ok(())
}
