import { useState, useEffect } from "react";
import { adminDb } from "../adminDb.js";
import { writeAudit, fmtTime } from "../adminUtils.js";

const C = {
  green: "#2C4A3E", greenLight: "#E8F0EE", terra: "#E8936A", terraLight: "#FDF0E8",
  terraBorder: "#F0B898", white: "#FFFFFF", cream: "#FDF8F2", text: "#2A2A2A",
  muted: "#7A7A7A", border: "#E8E0D6", red: "#C0392B", redLight: "#FDECEA",
};
const serif = { fontFamily: "'Playfair Display', serif" };
const card  = { backgroundColor: C.white, borderRadius: 16, padding: 24, boxShadow: "0 2px 20px rgba(44,74,62,0.07)", border: `1px solid ${C.border}`, marginBottom: 16 };
const inp   = { padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontFamily: "'Lato', sans-serif", fontSize: 14, color: C.text, backgroundColor: C.white, outline: "none", boxSizing: "border-box" };

export default function CycleManager({ orgId, actorEmail }) {
  const [cycle, setCycle]       = useState(null);
  const [history, setHistory]   = useState([]);
  const [eventCounts, setEventCounts] = useState({});
  const [loading, setLoading]   = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  useEffect(() => { load(); }, [orgId]);

  async function load() {
    setLoading(true);
    const cycles = await adminDb.fetchCycles(orgId);
    const cycleIds = (cycles || []).map(c => c.id);
    const { data: evCounts } = cycleIds.length
      ? await adminDb.supabase.from("events").select("cycle_id").in("cycle_id", cycleIds)
      : { data: [] };
    const counts = {};
    (evCounts || []).forEach(e => { counts[e.cycle_id] = (counts[e.cycle_id] || 0) + 1; });
    setEventCounts(counts);
    if (cycles?.length) { setCycle(cycles[0]); setHistory(cycles.slice(1)); }
    setLoading(false);
  }

  async function createCycle() {
    const label = newLabel.trim();
    if (!label) return;
    const data = await adminDb.createCycle(orgId, label);
    writeAudit(orgId, actorEmail, "cycle.created", "cycle", data?.id, { month_label: label });
    setNewLabel(""); setShowCreate(false);
    load();
  }

  async function updateCycle(fields) {
    if (!cycle) return;
    await adminDb.updateCycle(cycle.id, fields);
    writeAudit(orgId, actorEmail, "cycle.updated", "cycle", cycle.id, fields);
    setCycle(c => ({ ...c, ...fields }));
  }

  async function resetCycle() {
    if (!cycle) return;
    if (!window.confirm("This will permanently delete ALL events in the current cycle and reset it. This cannot be undone. Continue?")) return;
    await adminDb.resetCycle(cycle.id);
    writeAudit(orgId, actorEmail, "cycle.reset", "cycle", cycle.id, {});
    load();
  }

  if (loading) return <div style={{ padding: 40, color: C.muted, textAlign: "center" }}>Loading…</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h2 style={{ ...serif, fontSize: 26, color: C.green, margin: "0 0 4px" }}>Cycle Manager</h2>
          <p style={{ color: C.muted, margin: 0, fontSize: 14 }}>Manage monthly submission cycles — create, lock, and reset.</p>
        </div>
        <button onClick={() => setShowCreate(true)} style={{ padding: "10px 20px", borderRadius: 10, border: "none", backgroundColor: C.green, color: C.white, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>+ New Cycle</button>
      </div>

      {/* Create cycle form */}
      {showCreate && (
        <div style={{ ...card, backgroundColor: C.greenLight, border: `1.5px solid #A8C4BC` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.green, marginBottom: 12 }}>New Cycle</div>
          <div style={{ display: "flex", gap: 10 }}>
            <input style={{ ...inp, flex: 1 }} value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder='e.g. "May 2026"' autoFocus onKeyDown={e => e.key === "Enter" && createCycle()} />
            <button onClick={createCycle} disabled={!newLabel.trim()} style={{ padding: "10px 20px", borderRadius: 8, border: "none", backgroundColor: C.green, color: C.white, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Lato', sans-serif", opacity: newLabel.trim() ? 1 : 0.5 }}>Create</button>
            <button onClick={() => setShowCreate(false)} style={{ padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${C.border}`, backgroundColor: C.white, color: C.muted, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Current cycle */}
      {cycle ? (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "1px", marginBottom: 4 }}>CURRENT CYCLE</div>
              <div style={{ ...serif, fontSize: 24, color: C.green }}>{cycle.month_label}</div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
                {eventCounts[cycle.id] || 0} events · Created {fmtTime(cycle.created_at)}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, backgroundColor: cycle.locked ? C.greenLight : C.terraLight, color: cycle.locked ? C.green : C.terra, border: `1px solid ${cycle.locked ? "#A8C4BC" : C.terraBorder}` }}>
                {cycle.locked ? "🔒 Locked" : "✏️ Open"}
              </span>
              <span style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, backgroundColor: cycle.digest_sent ? C.greenLight : "#F9F5F0", color: cycle.digest_sent ? C.green : C.muted, border: `1px solid ${cycle.digest_sent ? "#A8C4BC" : C.border}` }}>
                {cycle.digest_sent ? "📧 Digest Sent" : "Digest Pending"}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
            {!cycle.locked
              ? <button onClick={() => updateCycle({ locked: true })} style={{ padding: "10px 20px", borderRadius: 10, border: `2px solid ${C.green}`, backgroundColor: "transparent", color: C.green, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>🔒 Lock Calendar</button>
              : <button onClick={() => updateCycle({ locked: false })} style={{ padding: "10px 20px", borderRadius: 10, border: `2px solid ${C.muted}`, backgroundColor: "transparent", color: C.muted, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>🔓 Unlock Calendar</button>
            }
            {!cycle.digest_sent && (
              <button onClick={() => updateCycle({ digest_sent: true })} style={{ padding: "10px 20px", borderRadius: 10, border: `2px solid ${C.terra}`, backgroundColor: "transparent", color: C.terra, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>📧 Mark Digest Sent</button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ ...card, textAlign: "center", padding: "48px 24px", color: C.muted }}>
          No active cycle. Create one to get started.
        </div>
      )}

      {/* Danger zone */}
      {cycle && (
        <div style={{ ...card, backgroundColor: C.redLight, border: `1px solid ${C.red}` }}>
          <div style={{ fontWeight: 700, color: C.red, marginBottom: 6, fontSize: 13 }}>🔄 Reset Current Cycle</div>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: C.text, lineHeight: 1.6 }}>Permanently deletes all {eventCounts[cycle.id] || 0} events in <strong>{cycle.month_label}</strong> and resets the locked/digest flags. This cannot be undone.</p>
          <button onClick={resetCycle} style={{ padding: "9px 18px", borderRadius: 8, border: `1.5px solid ${C.red}`, backgroundColor: "transparent", color: C.red, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>Reset for New Month</button>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <h3 style={{ ...serif, fontSize: 18, color: C.text, margin: "24px 0 14px" }}>Past Cycles</h3>
          <div style={{ backgroundColor: C.white, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px 100px 120px", padding: "10px 16px", backgroundColor: C.cream, borderBottom: `2px solid ${C.border}`, gap: 12 }}>
              {["Cycle", "Events", "Status", "Digest", "Created"].map((h, i) => (
                <span key={i} style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: "0.6px", textTransform: "uppercase" }}>{h}</span>
              ))}
            </div>
            {history.map(c => (
              <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px 100px 120px", padding: "12px 16px", borderBottom: `1px solid ${C.border}`, gap: 12, alignItems: "center" }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{c.month_label}</span>
                <span style={{ fontSize: 13, color: C.muted }}>{eventCounts[c.id] || 0}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: c.locked ? C.green : C.muted }}>{c.locked ? "🔒 Locked" : "Open"}</span>
                <span style={{ fontSize: 11, color: c.digest_sent ? C.green : C.muted, fontWeight: 700 }}>{c.digest_sent ? "✓ Sent" : "—"}</span>
                <span style={{ fontSize: 11, color: C.muted }}>{fmtTime(c.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
