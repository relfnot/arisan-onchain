import { AccountClient, AnchorProvider, BN, Idl, Program } from "@coral-xyz/anchor";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { Buffer } from "buffer";
import idl from "@/idl/arisan.json";

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";

/** Circle's devnet USDC; any classic SPL Token mint works. */
export const DEFAULT_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

export type GroupStatus = "forming" | "active" | "completed";

export interface GroupData {
  publicKey: PublicKey;
  creator: PublicKey;
  groupId: BN;
  mint: PublicKey;
  vault: PublicKey;
  contributionAmount: BN;
  collateralAmount: BN;
  periodSecs: BN;
  maxMembers: number;
  status: GroupStatus;
  currentRound: number;
  roundDeadline: BN;
  roundSettledCount: number;
  roundShortfall: BN;
  members: PublicKey[];
}

export interface MemberData {
  group: PublicKey;
  wallet: PublicKey;
  collateral: BN;
  roundsSettled: number;
  missedRounds: number;
  hasReceived: boolean;
}

// Lets the UI read accounts before a wallet is connected.
const readOnlyWallet: AnchorWallet = {
  publicKey: PublicKey.default,
  signTransaction: async <T extends Transaction | VersionedTransaction>(): Promise<T> => {
    throw new Error("Connect a wallet first");
  },
  signAllTransactions: async <T extends Transaction | VersionedTransaction>(): Promise<T[]> => {
    throw new Error("Connect a wallet first");
  },
};

export function getProgram(connection: Connection, wallet?: AnchorWallet) {
  const provider = new AnchorProvider(connection, wallet ?? readOnlyWallet, {
    commitment: "confirmed",
  });
  return new Program(idl as Idl, provider);
}

export type ArisanProgram = ReturnType<typeof getProgram>;

// The IDL is loaded as plain JSON, so account clients are looked up by name.
const accountClient = (program: ArisanProgram, name: "group" | "member") =>
  (program.account as unknown as Record<string, AccountClient>)[name];

export const groupPda = (programId: PublicKey, creator: PublicKey, groupId: BN) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("group"), creator.toBuffer(), groupId.toArrayLike(Buffer, "le", 8)],
    programId,
  )[0];

export const vaultPda = (programId: PublicKey, group: PublicKey) =>
  PublicKey.findProgramAddressSync([Buffer.from("vault"), group.toBuffer()], programId)[0];

export const memberPda = (programId: PublicKey, group: PublicKey, wallet: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("member"), group.toBuffer(), wallet.toBuffer()],
    programId,
  )[0];

/** Anchor decodes enums as `{ forming: {} }`; flatten to a string. */
function parseStatus(raw: Record<string, unknown>): GroupStatus {
  return Object.keys(raw)[0] as GroupStatus;
}

export async function fetchGroups(program: ArisanProgram): Promise<GroupData[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accounts: { publicKey: PublicKey; account: any }[] = await accountClient(program, "group").all();
  return accounts
    .map(({ publicKey, account }) => ({
      ...account,
      publicKey,
      status: parseStatus(account.status),
    }))
    .sort((a, b) => b.groupId.cmp(a.groupId));
}

export async function fetchMembers(
  program: ArisanProgram,
  group: GroupData,
): Promise<(MemberData | null)[]> {
  const pdas = group.members.map((w) => memberPda(program.programId, group.publicKey, w));
  return (await accountClient(program, "member").fetchMultiple(pdas)) as (MemberData | null)[];
}

export function toUnits(amount: string, decimals: number): BN {
  const [whole, frac = ""] = amount.trim().split(".");
  if (!/^\d+$/.test(whole || "0") || !/^\d*$/.test(frac) || frac.length > decimals) {
    throw new Error(`Invalid amount: ${amount}`);
  }
  return new BN((whole || "0") + frac.padEnd(decimals, "0"));
}

export function fromUnits(amount: BN, decimals: number): string {
  const s = amount.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, s.length - decimals);
  const frac = s.slice(s.length - decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

export const short = (key: PublicKey) => {
  const s = key.toBase58();
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
};

export function formatDuration(secs: number): string {
  if (secs <= 0) return "0s";
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}
