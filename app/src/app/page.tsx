"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { getMint } from "@solana/spl-token";
import { CreateGroupForm } from "@/components/CreateGroupForm";
import { GroupCard } from "@/components/GroupCard";
import { HeroArt, Logo, Modal } from "@/components/ui";
import { explorerAddress, fetchGroups, friendlyError, getProgram, GroupData } from "@/lib/arisan";

type Filter = "all" | "forming" | "active" | "mine" | "completed";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "forming", label: "Open to join" },
  { key: "active", label: "In progress" },
  { key: "mine", label: "My groups" },
  { key: "completed", label: "Completed" },
];

const STEPS = [
  { title: "Create", body: "Pick the token, amount per round, collateral, group size and round length." },
  { title: "Join", body: "Members lock collateral. The group starts the moment the last seat fills." },
  { title: "Pay & receive", body: "Everyone pays each round; the whole pot goes to whoever's turn it is." },
  { title: "Get collateral back", body: "After the last round, collateral returns. Missed payments are covered from it." },
];

export default function Home() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { setVisible: openWalletModal } = useWalletModal();
  const program = useMemo(() => getProgram(connection, wallet), [connection, wallet]);

  const [groups, setGroups] = useState<GroupData[]>([]);
  const [decimals, setDecimals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [creating, setCreating] = useState(false);
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
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [program, connection]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  const me = wallet?.publicKey;
  const isMine = useCallback(
    (g: GroupData) => !!me && (g.creator.equals(me) || g.members.some((m) => m.equals(me))),
    [me],
  );
  const counts = useMemo(
    () => ({
      all: groups.length,
      forming: groups.filter((g) => g.status === "forming").length,
      active: groups.filter((g) => g.status === "active").length,
      completed: groups.filter((g) => g.status === "completed").length,
      mine: groups.filter(isMine).length,
    }),
    [groups, isMine],
  );
  const visible = groups.filter((g) =>
    filter === "all" ? true : filter === "mine" ? isMine(g) : g.status === filter,
  );
  const memberCount = groups.reduce((n, g) => n + g.members.length, 0);

  const startGroup = () => (wallet ? setCreating(true) : openWalletModal(true));

  return (
    <>
      <header className="topbar">
        <div className="container topbar-inner">
          <a className="brand" href="#top">
            <Logo />
            <span className="brand-name">Arisan</span>
            <span className="brand-tag">On-Chain</span>
          </a>
          <div className="topbar-right">
            <span className="network-pill">
              <span className="dot" />
              Devnet
            </span>
            {mounted && <WalletMultiButton />}
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="container hero-inner">
            <div className="hero-copy">
              <p className="eyebrow">Rotating savings on Solana</p>
              <h1>
                Arisan, without
                <br />a bandar.
              </h1>
              <p className="lead">
                Save together like you always have. The pot sits in a program vault, collateral covers
                missed payments, and nobody can run off with the money.
              </p>
              <div className="hero-actions">
                <button className="btn btn-accent btn-lg" onClick={startGroup}>
                  Start a group
                </button>
                <a className="btn btn-outline-light btn-lg" href="#groups">
                  Browse groups
                </a>
              </div>
              <dl className="hero-stats">
                <div>
                  <dt>Groups</dt>
                  <dd>{loading ? "–" : counts.all}</dd>
                </div>
                <div>
                  <dt>In progress</dt>
                  <dd>{loading ? "–" : counts.active}</dd>
                </div>
                <div>
                  <dt>Members</dt>
                  <dd>{loading ? "–" : memberCount}</dd>
                </div>
              </dl>
            </div>
            <HeroArt />
          </div>
        </section>

        <section className="container steps" aria-label="How it works">
          {STEPS.map((s, i) => (
            <div key={s.title} className="step">
              <span className="step-num">{String(i + 1).padStart(2, "0")}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </section>

        <section id="groups" className="container groups">
          <div className="section-head">
            <div>
              <h2>Groups</h2>
              <p className="muted">Live from the program on devnet. Updates every 15 seconds.</p>
            </div>
            <button className="btn btn-primary" onClick={startGroup}>
              + New group
            </button>
          </div>

          <div className="tabs" role="tablist">
            {FILTERS.filter((f) => f.key !== "mine" || wallet).map((f) => (
              <button
                key={f.key}
                role="tab"
                aria-selected={filter === f.key}
                className={`tab ${filter === f.key ? "active" : ""}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
                <span className="tab-count">{counts[f.key]}</span>
              </button>
            ))}
          </div>

          {error && (
            <div className="banner banner-error">
              Couldn&apos;t load groups: {error}{" "}
              <button className="link-btn" onClick={refresh}>
                Retry
              </button>
            </div>
          )}

          {loading ? (
            <div className="grid">
              {[0, 1, 2].map((i) => (
                <div key={i} className="card skeleton" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="empty">
              <Logo size={48} />
              <h3>{filter === "all" ? "No groups yet" : "Nothing here"}</h3>
              <p className="muted">
                {filter === "all"
                  ? "Be the first: create a group and invite your circle."
                  : "Try another filter, or start a new group."}
              </p>
              <button className="btn btn-primary" onClick={startGroup}>
                Start a group
              </button>
            </div>
          ) : (
            <div className="grid">
              {visible.map((g) => (
                <GroupCard
                  key={g.publicKey.toBase58()}
                  program={program}
                  group={g}
                  decimals={decimals[g.mint.toBase58()] ?? 0}
                  wallet={wallet?.publicKey}
                  onConnect={() => openWalletModal(true)}
                  onChanged={refresh}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="footer">
        <div className="container footer-inner">
          <span className="brand">
            <Logo size={22} />
            <span className="brand-name">Arisan On-Chain</span>
          </span>
          <nav>
            <a href="https://github.com/relfnot/arisan-onchain" target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a href={explorerAddress(program.programId)} target="_blank" rel="noreferrer">
              Program
            </a>
            <a
              href="https://github.com/relfnot/arisan-onchain/blob/main/docs/SECURITY.md"
              target="_blank"
              rel="noreferrer"
            >
              Security
            </a>
          </nav>
        </div>
      </footer>

      {creating && wallet && (
        <Modal title="Start a new group" onClose={() => setCreating(false)}>
          <CreateGroupForm
            program={program}
            wallet={wallet.publicKey}
            onCreated={() => {
              setCreating(false);
              setFilter("mine");
              refresh();
            }}
          />
        </Modal>
      )}
    </>
  );
}
