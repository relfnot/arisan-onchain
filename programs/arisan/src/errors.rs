use anchor_lang::prelude::*;

#[error_code]
pub enum ArisanError {
    #[msg("Member count must be between 2 and 20")]
    InvalidMemberCount,
    #[msg("Round period is outside the allowed range")]
    InvalidPeriod,
    #[msg("Contribution amount must be greater than zero")]
    InvalidContribution,
    #[msg("Collateral must be at least one contribution")]
    CollateralTooLow,
    #[msg("Group is not accepting members")]
    GroupNotForming,
    #[msg("Group is not active")]
    GroupNotActive,
    #[msg("Group has not completed yet")]
    GroupNotCompleted,
    #[msg("Group is full")]
    GroupFull,
    #[msg("Member has already settled this round")]
    AlreadySettledRound,
    #[msg("Round deadline has passed")]
    RoundDeadlinePassed,
    #[msg("Round is still open for contributions")]
    RoundStillOpen,
    #[msg("Not every member has settled this round")]
    RoundNotSettled,
    #[msg("Recipient is not the member whose turn it is")]
    WrongRecipient,
    #[msg("Member has already received a payout")]
    AlreadyReceived,
    #[msg("Token account does not belong to the expected owner or mint")]
    InvalidTokenAccount,
    #[msg("Arithmetic overflow")]
    MathOverflow,
}
