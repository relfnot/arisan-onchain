pub mod contribute;
pub mod create_group;
pub mod join_group;
pub mod leave_group;
pub mod payout;
pub mod slash_defaulter;
pub mod withdraw_collateral;


pub use contribute::*;
pub use create_group::*;
pub use join_group::*;
pub use leave_group::*;
pub use payout::*;
pub use slash_defaulter::*;
pub use withdraw_collateral::*;

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::constants::GROUP_SEED;
use crate::state::Group;

/// Move tokens from a user's token account into the group vault.
pub(crate) fn transfer_to_vault<'info>(
    token_program: &Program<'info, Token>,
    from: &Account<'info, TokenAccount>,
    mint: &Account<'info, Mint>,
    vault: &Account<'info, TokenAccount>,
    authority: &Signer<'info>,
    amount: u64,
) -> Result<()> {
    token::transfer_checked(
        CpiContext::new(
            token_program.to_account_info(),
            TransferChecked {
                from: from.to_account_info(),
                mint: mint.to_account_info(),
                to: vault.to_account_info(),
                authority: authority.to_account_info(),
            },
        ),
        amount,
        mint.decimals,
    )
}

/// Move tokens out of the group vault, signed by the group PDA.
pub(crate) fn transfer_from_vault<'info>(
    token_program: &Program<'info, Token>,
    group: &Account<'info, Group>,
    vault: &Account<'info, TokenAccount>,
    mint: &Account<'info, Mint>,
    to: &Account<'info, TokenAccount>,
    amount: u64,
) -> Result<()> {
    let group_id = group.group_id.to_le_bytes();
    let bump = [group.bump];
    let seeds: &[&[u8]] = &[GROUP_SEED, group.creator.as_ref(), &group_id, &bump];

    token::transfer_checked(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            TransferChecked {
                from: vault.to_account_info(),
                mint: mint.to_account_info(),
                to: to.to_account_info(),
                authority: group.to_account_info(),
            },
            &[seeds],
        ),
        amount,
        mint.decimals,
    )
}
