use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use super::transfer_from_vault;
use crate::constants::*;
use crate::errors::ArisanError;
use crate::events::{GroupCompleted, PaidOut};
use crate::state::{Group, GroupStatus, Member};

#[derive(Accounts)]
pub struct Payout<'info> {
    /// Anyone can crank the payout; funds only ever go to the scheduled member.
    pub cranker: Signer<'info>,

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
        seeds = [MEMBER_SEED, group.key().as_ref(), recipient_member.wallet.as_ref()],
        bump = recipient_member.bump,
    )]
    pub recipient_member: Account<'info, Member>,

    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = recipient_token.mint == mint.key() @ ArisanError::InvalidTokenAccount,
        constraint = recipient_token.owner == recipient_member.wallet @ ArisanError::InvalidTokenAccount,
    )]
    pub recipient_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<Payout>) -> Result<()> {
    let group = &ctx.accounts.group;
    let recipient = &ctx.accounts.recipient_member;

    require!(
        group.status == GroupStatus::Active,
        ArisanError::GroupNotActive
    );
    require!(
        group.round_settled_count == group.member_count(),
        ArisanError::RoundNotSettled
    );
    require!(
        group.members.get(group.current_round as usize) == Some(&recipient.wallet),
        ArisanError::WrongRecipient
    );
    require!(!recipient.has_received, ArisanError::AlreadyReceived);

    let amount = group.round_pot()?;
    transfer_from_vault(
        &ctx.accounts.token_program,
        group,
        &ctx.accounts.vault,
        &ctx.accounts.mint,
        &ctx.accounts.recipient_token,
        amount,
    )?;

    let recipient = &mut ctx.accounts.recipient_member;
    recipient.has_received = true;

    let group = &mut ctx.accounts.group;
    let group_key = group.key();
    emit!(PaidOut {
        group: group_key,
        recipient: recipient.wallet,
        round: group.current_round,
        amount,
    });

    group.current_round = group
        .current_round
        .checked_add(1)
        .ok_or(ArisanError::MathOverflow)?;
    group.round_settled_count = 0;
    group.round_shortfall = 0;

    if group.current_round == group.member_count() {
        group.status = GroupStatus::Completed;
        group.round_deadline = 0;
        emit!(GroupCompleted { group: group_key });
    } else {
        group.round_deadline = Clock::get()?
            .unix_timestamp
            .checked_add(group.period_secs)
            .ok_or(ArisanError::MathOverflow)?;
    }
    Ok(())
}
