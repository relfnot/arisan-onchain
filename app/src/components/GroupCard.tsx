"use client";

import { useCallback, useEffect, useState } from "react";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  ArisanProgram,
  fetchMembers,
  formatDuration,
  fromUnits,
  GroupData,
  MemberData,
  memberPda,
  short,
} from "@/lib/arisan";

interface Props {
  program: ArisanProgram;
  group: GroupData;
  decimals: number;
  wallet?: PublicKey;
  onChanged: () => void;
}

export function GroupCard({ program, group, decimals, wallet, onChanged }: Props) {
  const [members, setMembers] = useState<(MemberData | null)[]>([]);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

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
  const fmt = (n: BN) => fromUnits(n, decimals);
  const memberCount = group.members.length;
  const deadline = group.roundDeadline.toNumber();
  const pastDeadline = group.status === "active" && now > deadline;
  const myIndex = wallet ? group.members.findIndex((m) => m.equals(wallet)) : -1;
  const me = myIndex >= 0 ? members[myIndex] : null;
  const ata = (owner: PublicKey) => getAssociatedTokenAddressSync(group.mint, owner);

  const common = {
    group: group.publicKey,
    mint: group.mint,
    vault: group.vault,
  };

  async function run(label: string, fn: () => Promise<string>) {
    setBusy(true);
    setMessage(null);
    try {
      const sig = await fn();
      setMessage({ ok: true, text: `${label} confirmed (${sig.slice(0, 8)}…)` });
      await loadMembers();
      onChanged();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  const userAccounts = (w: PublicKey) => ({
    ...common,
    wallet: w,
    member: memberPda(pid, group.publicKey, w),
    walletToken: ata(w),
  });

  const join = () =>
    run("Join", () => program.methods.joinGroup().accountsPartial(userAccounts(wallet!)).rpc());
  const leave = () =>
    run("Leave", () => program.methods.leaveGroup().accountsPartial(userAccounts(wallet!)).rpc());
  const contribute = () =>
    run("Contribution", () =>
      program.methods.contribute().accountsPartial(userAccounts(wallet!)).rpc(),
    );
  const withdraw = () =>
    run("Withdraw", () =>
      program.methods.withdrawCollateral().accountsPartial(userAccounts(wallet!)).rpc(),
    );
  const slash = (target: PublicKey) =>
    run("Slash", () =>
      program.methods
        .slashDefaulter()
        .accountsPartial({
          cranker: wallet!,
          group: group.publicKey,
          member: memberPda(pid, group.publicKey, target),
        })
        .rpc(),
    );
  const payout = () => {
    const recipient = group.members[group.currentRound];
    return run("Payout", () =>
      program.methods
        .payout()
        .accountsPartial({
          ...common,
          cranker: wallet!,
          recipientMember: memberPda(pid, group.publicKey, recipient),
          recipientToken: ata(recipient),
        })
        .rpc(),
    );
  };

  const settledThisRound = (m: MemberData | null) =>
    m !== null && m.roundsSettled > group.currentRound;
  const roundSettled = group.status === "active" && group.roundSettledCount === memberCount;

  return (
    <article className="card">
      <div className="card-head">
        <h3>Arisan #{group.groupId.toString().slice(-6)}</h3>
        <span className={`badge ${group.status}`}>{group.status}</span>
      </div>

      <dl className="stats">
        <div>
          <dt>Contribution</dt>
          <dd>{fmt(group.contributionAmount)}</dd>
        </div>
        <div>
          <dt>Collateral</dt>
          <dd>{fmt(group.collateralAmount)}</dd>
        </div>
        <div>
          <dt>Pot</dt>
          <dd>{fmt(group.contributionAmount.muln(group.maxMembers))}</dd>
        </div>
        <div>
          <dt>Members</dt>
          <dd>
            {memberCount}/{group.maxMembers}
          </dd>
        </div>
        <div>
          <dt>Period</dt>
          <dd>{formatDuration(group.periodSecs.toNumber())}</dd>
        </div>
        {group.status === "active" && (
          <div>
            <dt>Round {group.currentRound + 1}</dt>
            <dd>{pastDeadline ? "deadline passed" : `${formatDuration(deadline - now)} left`}</dd>
          </div>
        )}
      </dl>

      {memberCount > 0 && (
        <ol className="members">
          {group.members.map((w, i) => {
            const m = members[i];
            const turn = group.status === "active" && i === group.currentRound;
            return (
              <li key={w.toBase58()} className={turn ? "turn" : undefined}>
                <span className="mono">{short(w)}</span>
                {wallet?.equals(w) && <span className="tag">you</span>}
                {turn && <span className="tag">receives this round</span>}
                {m?.hasReceived && <span className="tag done">received</span>}
                {group.status === "active" &&
                  (settledThisRound(m) ? (
                    <span className="tag done">settled</span>
                  ) : pastDeadline ? (
                    <button className="small danger" disabled={busy || !wallet} onClick={() => slash(w)}>
                      Slash
                    </button>
                  ) : (
                    <span className="tag pending">unpaid</span>
                  ))}
                {m && m.missedRounds > 0 && (
                  <span className="tag pending">missed {m.missedRounds}</span>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {wallet && (
        <div className="actions">
          {group.status === "forming" && myIndex < 0 && (
            <button disabled={busy} onClick={join}>
              Join (lock {fmt(group.collateralAmount)})
            </button>
          )}
          {group.status === "forming" && myIndex >= 0 && (
            <button className="secondary" disabled={busy} onClick={leave}>
              Leave &amp; refund
            </button>
          )}
          {group.status === "active" && me && !settledThisRound(me) && !pastDeadline && (
            <button disabled={busy} onClick={contribute}>
              Pay {fmt(group.contributionAmount)}
            </button>
          )}
          {roundSettled && (
            <button disabled={busy} onClick={payout}>
              Pay out to {short(group.members[group.currentRound])}
            </button>
          )}
          {group.status === "completed" && me && (
            <button disabled={busy} onClick={withdraw}>
              Withdraw collateral ({fmt(me.collateral)})
            </button>
          )}
        </div>
      )}
      {message && <p className={message.ok ? "ok" : "error"}>{message.text}</p>}
    </article>
  );
}
