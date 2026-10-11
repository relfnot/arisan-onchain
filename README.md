# Arisan On-Chain

Trustless rotating savings groups (ROSCA, known in Indonesia as *arisan*) on Solana.

**Live app (devnet):** https://relfnot.github.io/arisan-onchain/ · **Program:** [`9quD9grWkec8MmFB7S2jM2oUVYWVvEK2pbhnbipQodT2`](https://explorer.solana.com/address/9quD9grWkec8MmFB7S2jM2oUVYWVvEK2pbhnbipQodT2?cluster=devnet)

Arisan is how millions of Indonesians save: a group pays in every month and one member takes the whole pot each round. It runs on trust in a *bandar* (organizer) who holds the money, and "bandar arisan kabur" (organizer ran off with the money) is a recurring headline. This program replaces the bandar with a vault:

- **No custodian.** Contributions sit in a program-owned token vault. There is no admin key, and group parameters cannot change after creation.
- **Collateral instead of trust.** Every member locks collateral on joining. If someone misses a round, anyone can slash their collateral to cover it, so the round still pays out.
- **Deterministic payouts.** The pot can only go to the member whose turn it is. Anyone can crank the payout, but nobody can redirect it.

## How it works

```
create_group ──► join_group × N ──► [ round r ]  ──► … ──► Completed ──► withdraw_collateral
  (vault PDA)     (lock collateral;   contribute ×N           (last round paid)   (refund + close)
                   starts when full)  or slash_defaulter
                                      after deadline
                                      ──► payout to members[r]
```

| Instruction | Who | What |
|---|---|---|
| `create_group` | anyone | Creates the group PDA and its vault. Sets mint, contribution, collateral, size (2–20), and round period. |
| `join_group` | member | Locks collateral. The group becomes `Active` when the last seat is filled. |
| `leave_group` | member | Only while `Forming`: refunds collateral and frees the seat. |
| `contribute` | member | Pays this round's contribution before the deadline. |
| `slash_defaulter` | anyone | After the deadline, covers a member's missed contribution from their collateral. |
| `payout` | anyone | Once every member is settled, sends the pot to `members[current_round]` and opens the next round. |
| `withdraw_collateral` | member | After the final round, returns the remaining collateral and closes the member account. |

### Accounts

| Account | Seeds | Purpose |
|---|---|---|
| `Group` | `["group", creator, group_id_le]` | Parameters, round state, payout order |
| Vault (SPL token account) | `["vault", group]` | Holds collateral and the current round's contributions. Authority is the `Group` PDA. |
| `Member` | `["member", group, wallet]` | Per-member collateral, rounds settled, missed rounds, payout received |

**Vault invariant:** `vault.amount == Σ member.collateral + (contributions paid this round)`. After the final payout the vault holds exactly the remaining collateral, which the test suite asserts.

## Repository layout

```
programs/arisan/src/
  lib.rs                 entrypoints
  state.rs               Group, Member, GroupStatus
  constants.rs           seeds and limits
  errors.rs, events.rs
  instructions/          one file per instruction + vault transfer helpers
tests/arisan.ts          end-to-end tests on a local validator
app/                     Next.js frontend (wallet adapter + Anchor client)
docs/                    security notes, CertiK submission draft
```

## Running locally

Requires Rust, Solana CLI (Agave 3.x), Anchor 0.32.1 and Node 20+. On Windows, run these inside WSL2.

```bash
npm install
anchor keys sync          # writes your own program ID into lib.rs and Anchor.toml
anchor build
anchor test               # spins up a local validator and runs tests/arisan.ts
```

From Windows, `scripts/wsl-build.sh` and `scripts/wsl-test.sh` do the same through WSL:

```bash
wsl -d Ubuntu --cd /mnt/c/laragon/www/Arisan/arisan-onchain -- bash scripts/wsl-test.sh
```

The test suite takes about 15 seconds longer than usual because it waits for a real round deadline to pass.

### Deploy to devnet

```bash
solana config set --url devnet
solana airdrop 2
anchor deploy --provider.cluster devnet

# optional: run one small group end to end on devnet with a throwaway mint
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com ANCHOR_WALLET=~/.config/solana/id.json node scripts/devnet-smoke.mjs
```

### Frontend

```bash
npm run sync-idl          # copies target/idl/arisan.json into app/src/idl
cd app
npm install
npm run dev               # http://localhost:3000
```

The app defaults to devnet and Circle's devnet USDC (`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`, faucet at faucet.circle.com). Set `NEXT_PUBLIC_RPC_URL` to use another RPC.

> Run `npm run sync-idl` after every `anchor build` that changes the program interface, so the frontend matches the deployed program.

## Security

See [docs/SECURITY.md](docs/SECURITY.md) for the threat model, the checks each instruction performs, and known limitations.

## License

MIT
