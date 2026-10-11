import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import {
  createMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import { Arisan } from "../target/types/arisan";

const DECIMALS = 6;
const UNIT = 10 ** DECIMALS;
const CONTRIBUTION = 100 * UNIT;
const COLLATERAL = 100 * UNIT;
const PERIOD_SECS = 10;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function expectError(promise: Promise<unknown>, code: string) {
  try {
    await promise;
  } catch (e) {
    expect(String(e)).to.include(code);
    return;
  }
  expect.fail(`expected error ${code}`);
}

describe("arisan", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.arisan as Program<Arisan>;
  const connection = provider.connection;
  const payer = (provider.wallet as anchor.Wallet).payer;

  let mint: PublicKey;
  const users = [Keypair.generate(), Keypair.generate(), Keypair.generate()];
  const tokenAccounts: PublicKey[] = [];

  const groupPda = (creator: PublicKey, id: number) =>
    PublicKey.findProgramAddressSync(
      [
        Buffer.from("group"),
        creator.toBuffer(),
        new BN(id).toArrayLike(Buffer, "le", 8),
      ],
      program.programId,
    )[0];
  const vaultPda = (group: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), group.toBuffer()],
      program.programId,
    )[0];
  const memberPda = (group: PublicKey, wallet: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("member"), group.toBuffer(), wallet.toBuffer()],
      program.programId,
    )[0];
  const balance = async (ata: PublicKey) =>
    Number((await getAccount(connection, ata)).amount);

  async function createGroup(id: number, maxMembers: number) {
    const group = groupPda(payer.publicKey, id);
    await program.methods
      .createGroup(
        new BN(id),
        new BN(CONTRIBUTION),
        new BN(COLLATERAL),
        maxMembers,
        new BN(PERIOD_SECS),
      )
      .accountsPartial({
        creator: payer.publicKey,
        group,
        mint,
        vault: vaultPda(group),
      })
      .rpc();
    return group;
  }

  const join = (group: PublicKey, i: number) =>
    program.methods
      .joinGroup()
      .accountsPartial({
        wallet: users[i].publicKey,
        group,
        member: memberPda(group, users[i].publicKey),
        mint,
        vault: vaultPda(group),
        walletToken: tokenAccounts[i],
      })
      .signers([users[i]])
      .rpc();

  const contribute = (group: PublicKey, i: number) =>
    program.methods
      .contribute()
      .accountsPartial({
        wallet: users[i].publicKey,
        group,
        member: memberPda(group, users[i].publicKey),
        mint,
        vault: vaultPda(group),
        walletToken: tokenAccounts[i],
      })
      .signers([users[i]])
      .rpc();

  const payout = (group: PublicKey, i: number) =>
    program.methods
      .payout()
      .accountsPartial({
        cranker: payer.publicKey,
        group,
        recipientMember: memberPda(group, users[i].publicKey),
        mint,
        vault: vaultPda(group),
        recipientToken: tokenAccounts[i],
      })
      .rpc();

  const slash = (group: PublicKey, i: number) =>
    program.methods
      .slashDefaulter()
      .accountsPartial({
        cranker: payer.publicKey,
        group,
        member: memberPda(group, users[i].publicKey),
      })
      .rpc();

  const withdraw = (group: PublicKey, i: number) =>
    program.methods
      .withdrawCollateral()
      .accountsPartial({
        wallet: users[i].publicKey,
        group,
        member: memberPda(group, users[i].publicKey),
        mint,
        vault: vaultPda(group),
        walletToken: tokenAccounts[i],
      })
      .signers([users[i]])
      .rpc();

  before(async () => {
    mint = await createMint(connection, payer, payer.publicKey, null, DECIMALS);
    for (const user of users) {
      const sig = await connection.requestAirdrop(
        user.publicKey,
        2 * LAMPORTS_PER_SOL,
      );
      await connection.confirmTransaction(sig, "confirmed");
      const ata = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mint,
        user.publicKey,
      );
      await mintTo(connection, payer, mint, ata.address, payer, 1_000 * UNIT);
      tokenAccounts.push(ata.address);
    }
  });

  it("rejects invalid group parameters", async () => {
    const group = groupPda(payer.publicKey, 99);
    await expectError(
      program.methods
        .createGroup(new BN(99), new BN(CONTRIBUTION), new BN(1), 3, new BN(PERIOD_SECS))
        .accountsPartial({ creator: payer.publicKey, group, mint, vault: vaultPda(group) })
        .rpc(),
      "CollateralTooLow",
    );
    await expectError(
      program.methods
        .createGroup(new BN(99), new BN(CONTRIBUTION), new BN(COLLATERAL), 1, new BN(PERIOD_SECS))
        .accountsPartial({ creator: payer.publicKey, group, mint, vault: vaultPda(group) })
        .rpc(),
      "InvalidMemberCount",
    );
  });

  it("lets members leave before the group starts", async () => {
    const group = await createGroup(2, 3);
    const before = await balance(tokenAccounts[0]);
    await join(group, 0);
    expect(await balance(tokenAccounts[0])).to.equal(before - COLLATERAL);

    await program.methods
      .leaveGroup()
      .accountsPartial({
        wallet: users[0].publicKey,
        group,
        member: memberPda(group, users[0].publicKey),
        mint,
        vault: vaultPda(group),
        walletToken: tokenAccounts[0],
      })
      .signers([users[0]])
      .rpc();

    expect(await balance(tokenAccounts[0])).to.equal(before);
    const g = await program.account.group.fetch(group);
    expect(g.members).to.have.length(0);
  });

  it("runs a full arisan with one defaulter", async () => {
    const group = await createGroup(1, 3);
    const vault = vaultPda(group);

    for (let i = 0; i < 3; i++) await join(group, i);
    let g = await program.account.group.fetch(group);
    expect(g.status).to.deep.equal({ active: {} });
    expect(await balance(vault)).to.equal(3 * COLLATERAL);

    // Round 0: everyone pays, user 0 receives the pot.
    const start0 = await balance(tokenAccounts[0]);
    for (let i = 0; i < 3; i++) await contribute(group, i);
    await expectError(contribute(group, 1), "AlreadySettledRound");
    await expectError(payout(group, 1), "WrongRecipient");
    await payout(group, 0);
    expect(await balance(tokenAccounts[0])).to.equal(
      start0 - CONTRIBUTION + 3 * CONTRIBUTION,
    );

    // Round 1: user 2 does not pay and gets slashed after the deadline.
    await contribute(group, 0);
    await contribute(group, 1);
    await expectError(payout(group, 1), "RoundNotSettled");
    await expectError(slash(group, 2), "RoundStillOpen");
    await sleep((PERIOD_SECS + 3) * 1000);
    await expectError(contribute(group, 2), "RoundDeadlinePassed");
    await expectError(slash(group, 0), "AlreadySettledRound");
    await slash(group, 2);

    const start1 = await balance(tokenAccounts[1]);
    await payout(group, 1);
    expect(await balance(tokenAccounts[1])).to.equal(start1 + 3 * CONTRIBUTION);
    const m2 = await program.account.member.fetch(memberPda(group, users[2].publicKey));
    expect(m2.collateral.toNumber()).to.equal(0);
    expect(m2.missedRounds).to.equal(1);

    // Round 2: user 2's collateral is gone, everyone pays, user 2 receives.
    for (let i = 0; i < 3; i++) await contribute(group, i);
    await payout(group, 2);
    g = await program.account.group.fetch(group);
    expect(g.status).to.deep.equal({ completed: {} });

    // Vault now holds exactly the remaining collateral.
    expect(await balance(vault)).to.equal(2 * COLLATERAL);
    for (let i = 0; i < 3; i++) await withdraw(group, i);
    expect(await balance(vault)).to.equal(0);
    expect(await connection.getAccountInfo(memberPda(group, users[0].publicKey))).to.be.null;
  });
});
