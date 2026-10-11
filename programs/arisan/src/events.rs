use anchor_lang::prelude::*;

#[event]
pub struct GroupCreated {
    pub group: Pubkey,
    pub creator: Pubkey,
    pub mint: Pubkey,
    pub contribution_amount: u64,
    pub collateral_amount: u64,
    pub max_members: u8,
    pub period_secs: i64,
}

#[event]
pub struct MemberJoined {
    pub group: Pubkey,
    pub wallet: Pubkey,
    pub position: u8,
}

#[event]
pub struct MemberLeft {
    pub group: Pubkey,
    pub wallet: Pubkey,
}

#[event]
pub struct GroupStarted {
    pub group: Pubkey,
    pub first_deadline: i64,
}

#[event]
pub struct Contributed {
    pub group: Pubkey,
    pub wallet: Pubkey,
    pub round: u8,
    pub amount: u64,
}

#[event]
pub struct DefaulterSlashed {
    pub group: Pubkey,
    pub wallet: Pubkey,
    pub round: u8,
    pub covered: u64,
    pub shortfall: u64,
}

#[event]
pub struct PaidOut {
    pub group: Pubkey,
    pub recipient: Pubkey,
    pub round: u8,
    pub amount: u64,
}

#[event]
pub struct GroupCompleted {
    pub group: Pubkey,
}

#[event]
pub struct CollateralWithdrawn {
    pub group: Pubkey,
    pub wallet: Pubkey,
    pub amount: u64,
}
