//! Arisan: trustless rotating savings groups (ROSCA) on Solana.
//!
//! Every round each member contributes a fixed amount of an SPL token into a
//! program-owned vault, and the whole pot is paid to one member following a
//! fixed payout order. Members lock collateral on join; a member who misses a
//! round is slashed from that collateral so the round can still settle.
//! There is no admin key: once a group is created its parameters are final.

use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
// Each instruction module exports a `handler`; they are always called by full path.
#[allow(ambiguous_glob_reexports)]
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("9quD9grWkec8MmFB7S2jM2oUVYWVvEK2pbhnbipQodT2");

#[program]
pub mod arisan {
    use super::*;

    /// Create a new group and its token vault. The creator does not join
    /// automatically; they call `join_group` like everyone else.
    pub fn create_group(
        ctx: Context<CreateGroup>,
        group_id: u64,
        contribution_amount: u64,
        collateral_amount: u64,
        max_members: u8,
        period_secs: i64,
    ) -> Result<()> {
        instructions::create_group::handler(
            ctx,
            group_id,
            contribution_amount,
            collateral_amount,
            max_members,
            period_secs,
        )
    }

    /// Join a forming group by locking collateral. The group starts as soon
    /// as the last seat is filled.
    pub fn join_group(ctx: Context<JoinGroup>) -> Result<()> {
        instructions::join_group::handler(ctx)
    }

    /// Leave a group that has not started yet and get the collateral back.
    pub fn leave_group(ctx: Context<LeaveGroup>) -> Result<()> {
        instructions::leave_group::handler(ctx)
    }

    /// Pay this round's contribution before the round deadline.
    pub fn contribute(ctx: Context<Contribute>) -> Result<()> {
        instructions::contribute::handler(ctx)
    }

    /// Permissionless: after the deadline, cover a member's missed
    /// contribution from their collateral.
    pub fn slash_defaulter(ctx: Context<SlashDefaulter>) -> Result<()> {
        instructions::slash_defaulter::handler(ctx)
    }

    /// Permissionless: once every member is settled for the round, send the
    /// pot to the member whose turn it is and open the next round.
    pub fn payout(ctx: Context<Payout>) -> Result<()> {
        instructions::payout::handler(ctx)
    }

    /// After the final round, return a member's remaining collateral and
    /// close their member account.
    pub fn withdraw_collateral(ctx: Context<WithdrawCollateral>) -> Result<()> {
        instructions::withdraw_collateral::handler(ctx)
    }
}
