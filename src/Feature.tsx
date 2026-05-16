import { useEffect, useState } from "react";
import {
  QRExchange,
  makeScanPayload,
  type MeshConfig,
  type YRoom,
} from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };

type Tx = { from: string; to: string; ts: number; note: string };

const NAME_KEY = (p: string) => `${p}:displayName`;

export function Feature({ room, config }: Props) {
  if (!room) {
    return (
      <div className="viral-screen">
        <h1>favor bank</h1>
        <p className="viral-status">Connecting…</p>
      </div>
    );
  }
  return <Body room={room} config={config} />;
}

function Body({ room, config }: { room: YRoom; config: MeshConfig }) {
  const [name, setName] = useState(
    () => localStorage.getItem(NAME_KEY(config.storagePrefix)) ?? "",
  );
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<"gave" | "received">("gave");
  const [, rerender] = useState(0);

  useEffect(() => {
    if (name) localStorage.setItem(NAME_KEY(config.storagePrefix), name);
  }, [name, config.storagePrefix]);

  useEffect(() => {
    const txs = room.doc.getArray<Tx>("txs");
    const names = room.doc.getMap<string>("names");
    const cb = () => rerender((n) => n + 1);
    txs.observe(cb);
    names.observe(cb);
    return () => {
      txs.unobserve(cb);
      names.unobserve(cb);
    };
  }, [room]);

  const txs = room.doc.getArray<Tx>("txs");
  const names = room.doc.getMap<string>("names");

  useEffect(() => {
    if (name.trim()) names.set(room.peerId, name.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, room.peerId]);

  const record = (otherId: string, otherName?: string) => {
    if (!name.trim() || otherId === room.peerId) return;
    const from = mode === "gave" ? room.peerId : otherId;
    const to = mode === "gave" ? otherId : room.peerId;
    if (otherName) names.set(otherId, otherName);
    txs.push([{ from, to, ts: Date.now(), note: note.trim() }]);
    setNote("");
  };

  const txList = txs.toArray();
  // balance per pair: from my POV, +1 means they owe me one
  const balances = new Map<string, number>();
  for (const t of txList) {
    if (t.from === room.peerId) balances.set(t.to, (balances.get(t.to) ?? 0) + 1);
    else if (t.to === room.peerId) balances.set(t.from, (balances.get(t.from) ?? 0) - 1);
  }

  const myPayload = makeScanPayload(room.roomId, room.peerId, name.trim() || "anon");

  return (
    <div className="viral-screen">
      <header>
        <h1>favor bank</h1>
        <p className="viral-status">
          {txList.length} favors logged · {balances.size} relationships · you · {room.peerCount + 1}{" "}
          present
        </p>
      </header>

      <input
        className="viral-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="your name"
        maxLength={48}
      />

      <div className="fb-mode">
        <button
          type="button"
          className={mode === "gave" ? "viral-primary" : "viral-ghost"}
          onClick={() => setMode("gave")}
        >
          i did them a favor →
        </button>
        <button
          type="button"
          className={mode === "received" ? "viral-primary" : "viral-ghost"}
          onClick={() => setMode("received")}
        >
          ← they did me a favor
        </button>
      </div>

      <input
        className="viral-name"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="optional note (e.g. coffee run)"
        maxLength={120}
      />

      <QRExchange
        myPayload={myPayload}
        showLabel="your QR"
        scanLabel="scan to log this favor"
        onScan={(parsed) => record(parsed.peerId, parsed.extra ?? undefined)}
      />

      <section>
        <h2 className="viral-section-title">your ledger</h2>
        {balances.size === 0 ? (
          <p className="viral-empty">no favors logged yet</p>
        ) : (
          <ul className="fb-list">
            {Array.from(balances.entries())
              .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
              .map(([peerId, bal]) => (
                <li key={peerId} className="viral-card">
                  <strong>{names.get(peerId) ?? peerId.slice(0, 6)}</strong>
                  <span className={`fb-bal ${bal > 0 ? "is-pos" : bal < 0 ? "is-neg" : ""}`}>
                    {bal > 0 && `owes you ${bal}`}
                    {bal < 0 && `you owe them ${Math.abs(bal)}`}
                    {bal === 0 && "even"}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="viral-section-title">recent transactions</h2>
        {txList.length === 0 ? (
          <p className="viral-empty">none yet</p>
        ) : (
          <ul className="fb-tx">
            {txList
              .slice()
              .reverse()
              .slice(0, 20)
              .map((t, i) => (
                <li key={i}>
                  <strong>{names.get(t.from) ?? t.from.slice(0, 6)}</strong> →{" "}
                  <strong>{names.get(t.to) ?? t.to.slice(0, 6)}</strong>
                  {t.note && <em> · {t.note}</em>}
                  <span className="fb-time">{new Date(t.ts).toLocaleTimeString()}</span>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
