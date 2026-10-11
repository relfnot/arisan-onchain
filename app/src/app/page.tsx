"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { getMint } from "@solana/spl-token";
import { CreateGroupForm } from "@/components/CreateGroupForm";
import { GroupCard } from "@/components/GroupCard";
import { fetchGroups, getProgram, GroupData } from "@/lib/arisan";

export default function Home() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const program = useMemo(() => getProgram(connection, wallet), [connection, wallet]);

  const [groups, setGroups] = useState<GroupData[]>([]);
  const [decimals, setDecimals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The wallet button depends on browser-only wallet state; render it after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const refresh = useCallback(async () => {
    try {
      const list = await fetchGroups(program);
      setGroups(list);
      const mints = [...new Set(list.map((g) => g.mint.toBase58()))];
      const entries = await Promise.all(
        mints.map(async (m) => {
          const info = await getMint(connection, list.find((g) => g.mint.toBase58() === m)!.mint);
          return [m, info.decimals] as const;
        }),
      );
      setDecimals(Object.fromEntries(entries));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [program, connection]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <main className="container">
      <header className="header">
        <div>
          <h1>Arisan On-Chain</h1>
          <p className="muted">
            Rotating savings without a bandar. Funds sit in a program vault, collateral covers
            missed payments, and nobody can run off with the pot.
          </p>
        </div>
        {mounted && <WalletMultiButton />}
      </header>

      {wallet ? (
        <CreateGroupForm program={program} wallet={wallet.publicKey} onCreated={refresh} />
      ) : (
        <p className="card muted">Connect a wallet (devnet) to create or join a group.</p>
      )}

      <h2>Groups</h2>
      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="muted">Loading…</p>
      ) : groups.length === 0 ? (
        <p className="muted">No groups yet. Create the first one.</p>
      ) : (
        <div className="grid">
          {groups.map((g) => (
            <GroupCard
              key={g.publicKey.toBase58()}
              program={program}
              group={g}
              decimals={decimals[g.mint.toBase58()] ?? 0}
              wallet={wallet?.publicKey}
              onChanged={refresh}
            />
          ))}
        </div>
      )}
    </main>
  );
}
