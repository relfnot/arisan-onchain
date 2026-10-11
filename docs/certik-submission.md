# CertiK audit credits — submission draft

> Everything in `[brackets]` must be filled in by the team. Do not submit claims you cannot back up: judges will read the repo.

## Links
- Colosseum submission: [link]
- GitHub: [https://github.com/<you>/arisan-onchain]
- Devnet program ID: `9quD9grWkec8MmFB7S2jM2oUVYWVvEK2pbhnbipQodT2` ([explorer](https://explorer.solana.com/address/9quD9grWkec8MmFB7S2jM2oUVYWVvEK2pbhnbipQodT2?cluster=devnet)). A full group lifecycle (create, join, contribute, payout, withdraw) has been run on devnet with `scripts/devnet-smoke.mjs`.
- Demo: [Vercel URL / video]

## Project
**Arisan On-Chain**: trustless rotating savings groups on Solana.

Arisan (a rotating savings and credit association, ROSCA) is one of the most common ways Indonesians save. Groups pay a fixed amount every period and one member takes the pot each round. It depends on an organizer who holds the cash, and organizers disappearing with the money is a recurring problem. We replace the organizer with a Solana program: contributions sit in a program-owned vault, members lock collateral that covers missed payments, and the pot can only go to the member whose turn it is. There are no admin keys.

**Target users:** Indonesian arisan groups (families, offices, communities) first, then ROSCA users across Southeast Asia, Africa and Latin America (*tanda*, *susu*, *chit funds*), and diaspora communities already holding USDC.

## Programs to audit
- `programs/arisan`: Anchor 0.32.1, 7 instructions, about 790 lines of Rust (excluding comments and blank lines).
- Holds user funds directly: member collateral plus each round's pooled contributions, in USDC/USDT.
- Security notes and known limitations: `docs/SECURITY.md`.
- Target mainnet launch: [e.g. Q1 2027, after the audit fixes].

## 6–12 month roadmap
[Edit to what you will actually do.]
- **Month 1–2:** devnet beta with [N] real arisan groups; position-based collateral; `close_group`.
- **Month 3:** CertiK audit and fixes; upgrade authority moved to a Squads multisig.
- **Month 4:** mainnet launch with USDC; IDR on/off-ramp partner integration [name if any].
- **Month 5–8:** verifiable-random payout order (Switchboard); on-chain reputation from completed groups; mobile-first PWA and Solana Mobile.
- **Month 9–12:** yield on idle collateral (audited lending integration); B2B groups for cooperatives (*koperasi*) and employers.

## Team
| Name | Role | X | GitHub | Full-time? |
|---|---|---|---|---|
| [ ] | [ ] | [ ] | [ ] | [ ] |

## Fundraising
[Bootstrapped / grant-funded / raising. Be specific: target round, amount, timing, and any interest from regulated or institutional partners such as koperasi or remittance companies.]

## Contact for scoping call
[Telegram handle or email]
