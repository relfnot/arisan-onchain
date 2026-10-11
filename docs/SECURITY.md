# Security notes

## Trust model

- **No privileged roles.** The group creator has no powers after `create_group`. There is no upgrade-gated admin instruction, fee switch, or pause.
- **Program upgrade authority** is the only trusted key. Before mainnet it will move to a multisig (Squads), and then be revoked once the audit is closed.
- **Permissionless cranks.** `slash_defaulter` and `payout` can be called by anyone. Both are safe to expose because the outcome is fully determined by on-chain state: who is slashed depends on who has not paid after the deadline, and the payout recipient is `members[current_round]`.

## Checks per instruction

| Instruction | Key checks |
|---|---|
| all | `Group` re-derived from `["group", creator, group_id]` with the stored bump. `has_one = mint, vault` wherever tokens move. `Member` re-derived from `["member", group, wallet]`. |
| `create_group` | 2–20 members; period 10 s – 90 days; contribution > 0; collateral ≥ contribution; `(collateral + contribution) × max_members` must fit in `u64`. Mint must be owned by classic SPL Token (Token-2022 rejected, see below). |
| `join_group` | Status `Forming`; seat available; `Member` uses `init`, so a wallet holds one seat at most. User token account mint must match. |
| `leave_group` | Status `Forming` only; refund goes to a token account owned by the signer. |
| `contribute` | Status `Active`; `now ≤ deadline`; member has not settled this round (`rounds_settled == current_round`). |
| `slash_defaulter` | Status `Active`; `now > deadline`; member has not settled this round. Covers `min(collateral, contribution)` and records the uncovered remainder as `round_shortfall`. |
| `payout` | Status `Active`; every member settled; recipient wallet equals `members[current_round]`; recipient has not received; recipient token account owner and mint verified. |
| `withdraw_collateral` | Status `Completed`; refund goes to a token account owned by the signer; `Member` closed to the signer. |

Arithmetic uses checked operations throughout, and `overflow-checks = true` is set in the release profile.

## Design decisions

- **Classic SPL Token only.** Token-2022 extensions such as transfer fees, transfer hooks, or permanent delegates would break the vault invariant or let a third party move vault funds. `Account<Mint>` and `Program<Token>` enforce the classic program. This covers USDC and USDT on Solana.
- **Deadline gating.** Contributions are accepted only up to the deadline, and slashing only after it. A member cannot be slashed while they still have time to pay, and cannot pay late to avoid a slash that is already allowed.
- **No token movement on slash.** Collateral and pot share one vault, so slashing only re-labels funds.

## Known limitations (planned work)

1. **Collateral covers one missed round per member at the minimum setting.** A member who receives the pot early and then stops paying can cost the group more than their collateral. Mitigations on the roadmap: collateral that scales with payout position, and on-chain reputation from completed groups.
2. **Payout order is join order.** It is transparent but first-come. Planned: verifiable randomness (Switchboard VRF) or an auction for earlier slots.
3. **Recipients need an existing token account** for the mint. The frontend uses associated token accounts.
4. **Group and vault rent is not reclaimed** after completion. A `close_group` instruction is planned.
5. **`Group.members` is capped at 20** by the account size.

## Audit scope

`programs/arisan/src/**`, about 790 non-blank, non-comment lines of Rust (Anchor 0.32.1).
