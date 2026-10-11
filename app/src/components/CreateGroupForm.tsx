"use client";

import { FormEvent, useState } from "react";
import { BN } from "@coral-xyz/anchor";
import { getMint } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { useToast } from "@/components/Toasts";
import {
  ArisanProgram,
  DEFAULT_MINT,
  explorerTx,
  formatDuration,
  friendlyError,
  groupPda,
  toUnits,
  vaultPda,
} from "@/lib/arisan";

const PERIODS = [
  { label: "1 min", hint: "demo", secs: 60 },
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
  const toast = useToast();
  const [customMint, setCustomMint] = useState(false);
  const [mint, setMint] = useState(DEFAULT_MINT);
  const [contribution, setContribution] = useState("10");
  const [collateral, setCollateral] = useState("10");
  const [members, setMembers] = useState(3);
  const [period, setPeriod] = useState(PERIODS[0].secs);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unit = customMint ? "tokens" : "USDC";
  const contributionNum = Number(contribution) || 0;
  const collateralNum = Number(collateral) || 0;
  const collateralTooLow = collateralNum < contributionNum;
  const pot = contributionNum * members;
  const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 6 });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const mintKey = new PublicKey(mint.trim());
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
      toast({
        kind: "success",
        title: "Group created",
        body: "Join it to take the first seat, then share the page with your circle.",
        href: explorerTx(sig),
      });
      onCreated();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="create-form" onSubmit={submit}>
      <div className="field">
        <span className="label">Token</span>
        <div className="segmented">
          <button
            type="button"
            className={!customMint ? "on" : ""}
            onClick={() => {
              setCustomMint(false);
              setMint(DEFAULT_MINT);
            }}
          >
            Devnet USDC
          </button>
          <button
            type="button"
            className={customMint ? "on" : ""}
            onClick={() => {
              setCustomMint(true);
              setMint("");
            }}
          >
            Other SPL token
          </button>
        </div>
        {customMint && (
          <input
            className="input mono"
            placeholder="Mint address"
            value={mint}
            onChange={(e) => setMint(e.target.value)}
            required
          />
        )}
      </div>

      <div className="field-row">
        <label className="field">
          <span className="label">Pay per round</span>
          <span className="input-wrap">
            <input
              className="input"
              inputMode="decimal"
              value={contribution}
              onChange={(e) => setContribution(e.target.value)}
              required
            />
            <span className="suffix">{unit}</span>
          </span>
        </label>
        <label className="field">
          <span className="label">Collateral</span>
          <span className={`input-wrap ${collateralTooLow ? "invalid" : ""}`}>
            <input
              className="input"
              inputMode="decimal"
              value={collateral}
              onChange={(e) => setCollateral(e.target.value)}
              required
            />
            <span className="suffix">{unit}</span>
          </span>
          <span className={`hint ${collateralTooLow ? "hint-error" : ""}`}>
            {collateralTooLow ? "Must be at least the amount per round." : "Locked while the group runs; covers a missed payment."}
          </span>
        </label>
      </div>

      <div className="field-row">
        <div className="field">
          <span className="label">Members</span>
          <div className="stepper">
            <button type="button" aria-label="Fewer members" onClick={() => setMembers((m) => Math.max(2, m - 1))}>
              −
            </button>
            <span>{members}</span>
            <button type="button" aria-label="More members" onClick={() => setMembers((m) => Math.min(20, m + 1))}>
              +
            </button>
          </div>
          <span className="hint">2–20 people. One round per member.</span>
        </div>
        <div className="field">
          <span className="label">Round length</span>
          <div className="segmented wrap">
            {PERIODS.map((p) => (
              <button
                key={p.secs}
                type="button"
                className={period === p.secs ? "on" : ""}
                onClick={() => setPeriod(p.secs)}
              >
                {p.label}
                {p.hint && <small>{p.hint}</small>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="summary">
        <p>
          Each member pays <b>{fmt(contributionNum)} {unit}</b> every {formatDuration(period)}, for{" "}
          {members} rounds.
        </p>
        <p>
          Each member receives the full pot of <b>{fmt(pot)} {unit}</b> once, in join order.
        </p>
        <p>
          Joining locks <b>{fmt(collateralNum)} {unit}</b> of collateral, returned at the end.
        </p>
      </div>

      {error && <p className="form-error">{error}</p>}

      <button className="btn btn-primary btn-lg btn-block" disabled={busy || collateralTooLow}>
        {busy ? "Confirm in your wallet…" : "Create group"}
      </button>
    </form>
  );
}
