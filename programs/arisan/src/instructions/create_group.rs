use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::constants::*;
use crate::errors::ArisanError;
use crate::events::GroupCreated;
use crate::state::{Group, GroupStatus};

#[derive(Accounts)]
#[instruction(group_id: u64)]
pub struct CreateGroup<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = 8 + Group::INIT_SPACE,
        seeds = [GROUP_SEED, creator.key().as_ref(), &group_id.to_le_bytes()],
        bump,
    )]
    pub group: Account<'info, Group>,

    /// Classic SPL Token mints only (e.g. USDC). Token-2022 extensions such as
    /// transfer fees would break the vault accounting, so they are rejected.
    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = creator,
        seeds = [VAULT_SEED, group.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = group,
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateGroup>,
    group_id: u64,
    contribution_amount: u64,
    collateral_amount: u64,
    max_members: u8,
    period_secs: i64,
) -> Result<()> {
    require!(
        (MIN_MEMBERS..=MAX_MEMBERS).contains(&max_members),
        ArisanError::InvalidMemberCount
    );
    require!(
        (MIN_PERIOD_SECS..=MAX_PERIOD_SECS).contains(&period_secs),
        ArisanError::InvalidPeriod
    );
    require!(contribution_amount > 0, ArisanError::InvalidContribution);
    require!(
        collateral_amount >= contribution_amount,
        ArisanError::CollateralTooLow
    );
    // The vault never holds more than all collateral plus one full pot, so
    // rejecting overflow here keeps every later sum within u64.
    collateral_amount
        .checked_add(contribution_amount)
        .and_then(|per_member| per_member.checked_mul(max_members as u64))
        .ok_or(ArisanError::MathOverflow)?;

    let group = &mut ctx.accounts.group;
    group.set_inner(Group {
        creator: ctx.accounts.creator.key(),
        group_id,
        mint: ctx.accounts.mint.key(),
        vault: ctx.accounts.vault.key(),
        contribution_amount,
        collateral_amount,
        period_secs,
        max_members,
        status: GroupStatus::Forming,
        current_round: 0,
        round_deadline: 0,
        round_settled_count: 0,
        round_shortfall: 0,
        members: Vec::with_capacity(max_members as usize),
        bump: ctx.bumps.group,
        vault_bump: ctx.bumps.vault,
    });

    emit!(GroupCreated {
        group: group.key(),
        creator: group.creator,
        mint: group.mint,
        contribution_amount,
        collateral_amount,
        max_members,
        period_secs,
    });
    Ok(())
}
