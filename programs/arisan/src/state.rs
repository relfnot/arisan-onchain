use anchor_lang::prelude::*;

use crate::errors::ArisanError;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum GroupStatus {
    /// Accepting members; collateral can still be withdrawn via `leave_group`.
    Forming,
    /// Rounds are running.
    Active,
    /// Every member has received the pot; collateral can be withdrawn.
    Completed,
}

/// PDA: ["group", creator, group_id (u64 LE)]
#[account]
#[derive(InitSpace)]
pub struct Group {
    pub creator: Pubkey,
    pub group_id: u64,
    pub mint: Pubkey,
    /// PDA token account ["vault", group] owned by this group.
    pub vault: Pubkey,
    pub contribution_amount: u64,
    pub collateral_amount: u64,
    pub period_secs: i64,
    pub max_members: u8,
    pub status: GroupStatus,
    /// Zero-based index into `members` of whose turn it is.
    pub current_round: u8,
    /// Unix timestamp after which unpaid members can be slashed.
    pub round_deadline: i64,
    /// Members who have contributed or been slashed this round.
    pub round_settled_count: u8,
    /// Missed contributions this round that collateral could not cover.
    pub round_shortfall: u64,
    /// Wallets in join order, which is also the payout order.
    #[max_len(20)]
    pub members: Vec<Pubkey>,
    pub bump: u8,
    pub vault_bump: u8,
}

impl Group {
    pub fn member_count(&self) -> u8 {
        self.members.len() as u8
    }

    /// Pot paid out this round: every member's contribution minus whatever
    /// defaulters' collateral could not cover.
    pub fn round_pot(&self) -> Result<u64> {
        self.contribution_amount
            .checked_mul(self.member_count() as u64)
            .and_then(|gross| gross.checked_sub(self.round_shortfall))
            .ok_or_else(|| error!(ArisanError::MathOverflow))
    }
}

/// PDA: ["member", group, wallet]
#[account]
#[derive(InitSpace)]
pub struct Member {
    pub group: Pubkey,
    pub wallet: Pubkey,
    /// Collateral still locked in the vault for this member.
    pub collateral: u64,
    /// Rounds this member has settled, by contributing or being slashed.
    /// Equal to `group.current_round` means this round is still unpaid.
    pub rounds_settled: u8,
    pub missed_rounds: u8,
    pub has_received: bool,
    pub bump: u8,
}
