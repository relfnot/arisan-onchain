use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::ArisanError;
use crate::events::DefaulterSlashed;
use crate::state::{Group, GroupStatus, Member};

/// No tokens move here: the covered amount is re-labelled from the member's
/// collateral to this round's pot, both of which already sit in the vault.
#[derive(Accounts)]
pub struct SlashDefaulter<'info> {
    /// Anyone can crank a slash once the deadline has passed.
    pub cranker: Signer<'info>,

    #[account(
        mut,
        seeds = [GROUP_SEED, group.creator.as_ref(), &group.group_id.to_le_bytes()],
        bump = group.bump,
    )]
    pub group: Account<'info, Group>,

    #[account(
        mut,
        seeds = [MEMBER_SEED, group.key().as_ref(), member.wallet.as_ref()],
        bump = member.bump,
    )]
    pub member: Account<'info, Member>,
}

pub fn handler(ctx: Context<SlashDefaulter>) -> Result<()> {
    let group = &mut ctx.accounts.group;
    let member = &mut ctx.accounts.member;

    require!(
        group.status == GroupStatus::Active,
        ArisanError::GroupNotActive
    );
    require!(
        Clock::get()?.unix_timestamp > group.round_deadline,
        ArisanError::RoundStillOpen
    );
    require!(
        member.rounds_settled == group.current_round,
        ArisanError::AlreadySettledRound
    );

    let covered = member.collateral.min(group.contribution_amount);
    // Cannot underflow: covered <= contribution_amount by construction.
    let shortfall = group.contribution_amount - covered;

    member.collateral -= covered;
    member.rounds_settled = member
        .rounds_settled
        .checked_add(1)
        .ok_or(ArisanError::MathOverflow)?;
    member.missed_rounds = member
        .missed_rounds
        .checked_add(1)
        .ok_or(ArisanError::MathOverflow)?;

    group.round_shortfall = group
        .round_shortfall
        .checked_add(shortfall)
        .ok_or(ArisanError::MathOverflow)?;
    group.round_settled_count = group
        .round_settled_count
        .checked_add(1)
        .ok_or(ArisanError::MathOverflow)?;

    emit!(DefaulterSlashed {
        group: group.key(),
        wallet: member.wallet,
        round: group.current_round,
        covered,
        shortfall,
    });
    Ok(())
}
