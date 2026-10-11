"use client";

import { FormEvent, useState } from "react";
import { BN } from "@coral-xyz/anchor";
import { getMint } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { ArisanProgram, DEFAULT_MINT, groupPda, toUnits, vaultPda } from "@/lib/arisan";

const PERIODS = [
  { label: "1 minute (demo)", secs: 60 },
  { label: "1 day", secs: 86_400 },
  { label: "1 week", secs: 604_800 },
  { label: "30 days", secs: 2_592_000 },
];

interface Props {
  program: ArisanProgram;
  wallet: PublicKey;
  onCreated: () => void;
}

export function CreateGroupForm({ program, wallet, onCreated }: Props) {
  const [mint, setMint] = useState(DEFAULT_MINT);
  const [contribution, setContribution] = useState("10");
  const [collateral, setCollateral] = useState("10");
  const [members, setMembers] = useState(3);
  const [period, setPeriod] = useState(PERIODS[0].secs);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const mintKey = new PublicKey(mint);
      const { decimals } = await getMint(program.provider.connection, mintKey);
      const groupId = new BN(Date.now());
      const group = groupPda(program.programId, wallet, groupId);
      const sig = await program.methods
        .createGroup(
          groupId,
          toUnits(contribution, decimals),
          toUnits(collateral, decimals),
          members,
          new BN(period),
        )
        .accountsPartial({
          creator: wallet,
          group,
          mint: mintKey,
          vault: vaultPda(program.programId, group),
        })
        .rpc();
      setStatus({ ok: true, text: `Group created (${sig.slice(0, 8)}…). Now join it below.` });
      onCreated();
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form" onSubmit={submit}>
      <h2>Create a group</h2>
      <label>
        Token mint
        <input value={mint} onChange={(e) => setMint(e.target.value)} required />
      </label>
      <div className="row">
        <label>
          Contribution per round
          <input value={contribution} onChange={(e) => setContribution(e.target.value)} required />
        </label>
        <label>
          Collateral (≥ contribution)
          <input value={collateral} onChange={(e) => setCollateral(e.target.value)} required />
        </label>
      </div>
      <div className="row">
        <label>
          Members
          <input
            type="number"
            min={2}
            max={20}
            value={members}
            onChange={(e) => setMembers(Number(e.target.value))}
          />
        </label>
        <label>
          Round period
          <select value={period} onChange={(e) => setPeriod(Number(e.target.value))}>
            {PERIODS.map((p) => (
              <option key={p.secs} value={p.secs}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button disabled={busy}>{busy ? "Creating…" : "Create group"}</button>
      {status && <p className={status.ok ? "ok" : "error"}>{status.text}</p>}
    </form>
  );
}
