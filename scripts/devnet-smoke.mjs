// Runs one small arisan end to end against the deployed program, using a
// throwaway test mint. Usage: ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
//   ANCHOR_WALLET=~/.config/solana/id.json node scripts/devnet-smoke.mjs
import anchor from "@coral-xyz/anchor";
import {
  createMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { readFileSync } from "node:fs";

const { AnchorProvider, BN, Program } = anchor;
const idl = JSON.parse(readFileSync(new URL("../target/idl/arisan.json", import.meta.url)));
const provider = AnchorProvider.env();
const program = new Program(idl, provider);
const { connection } = provider;
const payer = provider.wallet.payer;

const UNIT = 1_000_000;
const CONTRIBUTION = 10 * UNIT;
const COLLATERAL = 10 * UNIT;
const PERIOD_SECS = 60;

const pda = (...seeds) => PublicKey.findProgramAddressSync(seeds, program.programId)[0];
const log = (step, sig) => console.log(`${step.padEnd(28)} https://explorer.solana.com/tx/${sig}?cluster=devnet`);

const members = [Keypair.generate(), Keypair.generate()];
const fund = new Transaction().add(
  ...members.map((m) =>
    SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: m.publicKey, lamports: 0.02 * LAMPORTS_PER_SOL }),
  ),
);
await provider.sendAndConfirm(fund);

const mint = await createMint(connection, payer, payer.publicKey, null, 6);
const atas = [];
for (const m of members) {
  const ata = await getOrCreateAssociatedTokenAccount(connection, payer, mint, m.publicKey);
  await mintTo(connection, payer, mint, ata.address, payer, 100 * UNIT);
  atas.push(ata.address);
}
console.log(`Test mint ${mint.toBase58()}`);

const groupId = new BN(Date.now());
const group = pda(Buffer.from("group"), payer.publicKey.toBuffer(), groupId.toArrayLike(Buffer, "le", 8));
const vault = pda(Buffer.from("vault"), group.toBuffer());
const member = (w) => pda(Buffer.from("member"), group.toBuffer(), w.toBuffer());
const userAccounts = (i) => ({
  wallet: members[i].publicKey,
  group,
  member: member(members[i].publicKey),
  mint,
  vault,
  walletToken: atas[i],
});

log(
  "create_group",
  await program.methods
    .createGroup(groupId, new BN(CONTRIBUTION), new BN(COLLATERAL), 2, new BN(PERIOD_SECS))
    .accountsPartial({ creator: payer.publicKey, group, mint, vault })
    .rpc(),
);
for (let i = 0; i < 2; i++) {
  log(`join_group (member ${i})`, await program.methods.joinGroup().accountsPartial(userAccounts(i)).signers([members[i]]).rpc());
}

for (let round = 0; round < 2; round++) {
  for (let i = 0; i < 2; i++) {
    log(`contribute r${round} (member ${i})`, await program.methods.contribute().accountsPartial(userAccounts(i)).signers([members[i]]).rpc());
  }
  log(
    `payout r${round}`,
    await program.methods
      .payout()
      .accountsPartial({
        cranker: payer.publicKey,
        group,
        recipientMember: member(members[round].publicKey),
        mint,
        vault,
        recipientToken: atas[round],
      })
      .rpc(),
  );
}

for (let i = 0; i < 2; i++) {
  log(`withdraw_collateral (m${i})`, await program.methods.withdrawCollateral().accountsPartial(userAccounts(i)).signers([members[i]]).rpc());
}

const g = await program.account.group.fetch(group);
const balances = await Promise.all(atas.map(async (a) => Number((await getAccount(connection, a)).amount) / UNIT));
const vaultLeft = Number((await getAccount(connection, vault)).amount);
console.log(`\nGroup ${group.toBase58()}`);
console.log(`status=${Object.keys(g.status)[0]} member balances=${balances.join(", ")} vault=${vaultLeft}`);
if (Object.keys(g.status)[0] !== "completed" || vaultLeft !== 0 || balances.some((b) => b !== 100)) {
  throw new Error("Smoke test failed: unexpected final state");
}
console.log("Smoke test passed.");
