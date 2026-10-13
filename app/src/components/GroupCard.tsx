"use client";

import { useCallback, useEffect, useState } from "react";
import { BN } from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { useToast } from "@/components/Toasts";
import { Avatar } from "@/components/ui";
import {
  ArisanProgram,
  explorerAddress,
  explorerTx,
  fetchMembers,
  formatDuration,
  friendlyError,
  fromUnits,
  GroupData,
  MemberData,
  memberPda,
  short,
  tokenLabel,
} from "@/lib/arisan";

interface Props {
  program: ArisanProgram;
  group: GroupData;
  decimals: number;
  wallet?: PublicKey;
  onConnect: () => void;
  onChanged: () => void;
}

const STATUS_LABEL = {
  forming: "Open to join",
  active: "In progress",
  completed: "Completed",
} as const;

export function GroupCard({ program, group, decimals, wallet, onConnect, onChanged }: Props) {
  const toast = useToast();
  const [members, setMembers] = useState<(MemberData | null)[]>([]);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [busy, setBusy] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    setMembers(await fetchMembers(program, group));
  }, [program, group]);

  useEffect(() => {
    loadMembers().catch(() => setMembers([]));
  }, [loadMembers]);

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const pid = program.programId;
  const token = tokenLabel(group.mint);
  const fmt = (n: BN) => fromUnits(n, decimals);
  const memberCount = group.members.length;
  const deadline = group.roundDeadline.toNumber();
  const secondsLeft = deadline - now;
  const pastDeadline = group.status === "active" && secondsLeft < 0;
  const myIndex = wallet ? group.members.findIndex((m) => m.equals(wallet)) : -1;
  // `members` can lag one refresh behind `group.members` right after a join.
  const me = myIndex >= 0 ? (members[myIndex] ?? null) : null;
  const recipient = group.status === "active" ? group.members[group.currentRound] : undefined;
  const ata = (owner: PublicKey) => getAssociatedTokenAddressSync(group.mint, owner);
  const settledThisRound = (m: MemberData | null | undefined) => !!m && m.roundsSettled > group.currentRound;
  const roundSettled = group.status === "active" && group.roundSettledCount === memberCount;
  const iSettled = settledThisRound(me);

  const common = { group: group.publicKey, mint: group.mint, vault: group.vault };
  const userAccounts = (w: PublicKey) => ({
    ...common,
    wallet: w,
    member: memberPda(pid, group.publicKey, w),
    walletToken: ata(w),
  });

  async function run(label: string, success: string, fn: () => Promise<string>) {
    setBusy(label);
    try {
      const sig = await fn();
      toast({ kind: "success", title: success, href: explorerTx(sig) });
      await loadMembers();
      onChanged();
    } catch (err) {
      toast({ kind: "error", title: `${label} failed`, body: friendlyError(err) });
    } finally {
      setBusy(null);
    }
  }

  async function requireTokenAccount(owner: PublicKey) {
    const info = await program.provider.connection.getAccountInfo(ata(owner));
    if (!info) {
      throw new Error(
        `This wallet has no ${token} account yet. Get devnet USDC at faucet.circle.com, then try again.`,
      );
    }
  }

  const join = () =>
    run("Join", "You joined the group", async () => {
      await requireTokenAccount(wallet!);
      return program.methods.joinGroup().accountsPartial(userAccounts(wallet!)).rpc();
    });
  const leave = () =>
    run("Leave", "You left the group; collateral refunded", () =>
      program.methods.leaveGroup().accountsPartial(userAccounts(wallet!)).rpc(),
    );
  const contribute = () =>
    run("Payment", "Payment received for this round", () =>
      program.methods.contribute().accountsPartial(userAccounts(wallet!)).rpc(),
    );
  const withdraw = () =>
    run("Withdraw", "Collateral returned", () =>
      program.methods.withdrawCollateral().accountsPartial(userAccounts(wallet!)).rpc(),
    );
  const slash = (target: PublicKey) =>
    run("Slash", `Covered ${short(target)}'s payment from collateral`, () =>
      program.methods
        .slashDefaulter()
        .accountsPartial({
          cranker: wallet!,
          group: group.publicKey,
          member: memberPda(pid, group.publicKey, target),
        })
        .rpc(),
    );
  const payout = () =>
    run("Payout", `Pot sent to ${short(recipient!)}`, async () => {
      await requireTokenAccount(recipient!);
      return program.methods
        .payout()
        .accountsPartial({
          ...common,
          cranker: wallet!,
          recipientMember: memberPda(pid, group.publicKey, recipient!),
          recipientToken: ata(recipient!),
        })
        .rpc();
    });

  function primaryAction() {
    if (!wallet) {
      return group.status === "forming" ? (
        <button className="btn btn-outline btn-block" onClick={onConnect}>
          Connect wallet to join
        </button>
      ) : null;
    }
    if (group.status === "forming") {
      return myIndex < 0 ? (
        <button className="btn btn-primary btn-block" disabled={!!busy} onClick={join}>
          {busy ? "Confirm in wallet…" : `Join · lock ${fmt(group.collateralAmount)} ${token}`}
        </button>
      ) : (
        <button className="btn btn-outline btn-block" disabled={!!busy} onClick={leave}>
          {busy ? "Confirm in wallet…" : "Leave and get collateral back"}
        </button>
      );
    }
    if (group.status === "active") {
      if (roundSettled) {
        return (
          <button className="btn btn-accent btn-block" disabled={!!busy} onClick={payout}>
            {busy ? "Confirm in wallet…" : `Send pot to ${short(recipient!)}`}
          </button>
        );
      }
      if (me && !iSettled && !pastDeadline) {
        return (
          <button className="btn btn-primary btn-block" disabled={!!busy} onClick={contribute}>
            {busy ? "Confirm in wallet…" : `Pay ${fmt(group.contributionAmount)} ${token}`}
          </button>
        );
      }
      if (me && iSettled) {
        return <p className="waiting">You&apos;ve paid this round · waiting for the others</p>;
      }
      if (pastDeadline) {
        return <p className="waiting">Deadline passed · slash unpaid members to settle the round</p>;
      }
      return null;
    }
    if (group.status === "completed" && me) {
      return (
        <button className="btn btn-primary btn-block" disabled={!!busy} onClick={withdraw}>
          {busy ? "Confirm in wallet…" : `Withdraw ${fmt(me.collateral)} ${token} collateral`}
        </button>
      );
    }
    return null;
  }

  return (
    <article className={`card group-card is-${group.status}`}>
      <header className="gc-head">
        <span className={`pill pill-${group.status}`}>
          <span className="dot" />
          {STATUS_LABEL[group.status]}
        </span>
        <a className="gc-id" href={explorerAddress(group.publicKey)} target="_blank" rel="noreferrer">
          #{group.groupId.toString().slice(-6)} ↗
        </a>
      </header>

      <div className="gc-amount">
        <span className="gc-amount-num">{fmt(group.contributionAmount)}</span>
        <span className="gc-amount-unit">{token} per round</span>
      </div>

      <dl className="gc-facts">
        <div>
          <dt>Pot</dt>
          <dd>
            {fmt(group.contributionAmount.muln(group.maxMembers))} {token}
          </dd>
        </div>
        <div>
          <dt>Collateral</dt>
          <dd>
            {fmt(group.collateralAmount)} {token}
          </dd>
        </div>
        <div>
          <dt>Every</dt>
          <dd>{formatDuration(group.periodSecs.toNumber())}</dd>
        </div>
      </dl>

      {group.status === "forming" && (
        <div className="gc-progress">
          <div className="gc-progress-label">
            <span>
              {memberCount} of {group.maxMembers} seats filled
            </span>
            <span className="muted">starts when full</span>
          </div>
          <div className="bar">
            <span style={{ width: `${(memberCount / group.maxMembers) * 100}%` }} />
          </div>
        </div>
      )}

      {group.status === "active" && (
        <div className="gc-progress">
          <div className="gc-progress-label">
            <span>
              Round {group.currentRound + 1} of {memberCount}
            </span>
            <span className={`countdown ${pastDeadline ? "late" : secondsLeft < 60 ? "soon" : ""}`}>
              {pastDeadline ? "Deadline passed" : `${formatDuration(secondsLeft)} left`}
            </span>
          </div>
          <div className="rounds">
            {group.members.map((_, i) => (
              <span
                key={i}
                className={i < group.currentRound ? "done" : i === group.currentRound ? "now" : ""}
              />
            ))}
          </div>
          <p className="muted small">
            {group.roundSettledCount} of {memberCount} paid this round
          </p>
        </div>
      )}

      {group.status === "completed" && (
        <div className="gc-progress">
          <div className="gc-progress-label">
            <span>All {memberCount} rounds paid out</span>
          </div>
          <div className="rounds">
            {group.members.map((_, i) => (
              <span key={i} className="done" />
            ))}
          </div>
        </div>
      )}

      {memberCount > 0 && (
        <ul className="gc-members">
          {group.members.map((w, i) => {
            const m = members[i] ?? null;
            const isMe = wallet?.equals(w);
            const isTurn = recipient?.equals(w);
            return (
              <li key={w.toBase58()} className={isTurn ? "turn" : undefined}>
                <Avatar wallet={w} size={28} />
                <span className="mono">{short(w)}</span>
                {isMe && <span className="tag tag-me">You</span>}
                <span className="gc-member-spacer" />
                {isTurn && <span className="tag tag-accent">Receives now</span>}
                {m?.hasReceived && <span className="tag tag-ok">Received</span>}
                {m && m.missedRounds > 0 && <span className="tag tag-warn">Missed {m.missedRounds}</span>}
                {group.status === "active" &&
                  (settledThisRound(m) ? (
                    <span className="tag tag-ok">Paid</span>
                  ) : pastDeadline ? (
                    <button
                      className="btn btn-danger btn-xs"
                      disabled={!!busy || !wallet}
                      onClick={() => slash(w)}
                    >
                      Slash
                    </button>
                  ) : (
                    <span className="tag tag-warn">Unpaid</span>
                  ))}
              </li>
            );
          })}
        </ul>
      )}

      <div className="gc-actions">{primaryAction()}</div>
    </article>
  );
}
