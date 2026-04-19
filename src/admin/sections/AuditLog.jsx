import { useState, useEffect } from "react";
import { adminDb } from "../adminDb.js";
import { fmtTime } from "../adminUtils.js";

const C = {
  green: "#2C4A3E", white: "#FFFFFF", cream: "#FDF8F2",
  text: "#2A2A2A", muted: "#7A7A7A", border: "#E8E0D6",
};
const serif = { fontFamily: "'Playfair Display', serif" };
const inp   = { padding: "9px 12px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontFamily: "'Lato', sans-serif", fontSize: 13, color: C.text, backgroundColor: C.white, outline: "none", boxSizing: "border-box" };

const ACTION_COLOR = {
  created:  { bg: "#F0FDF4", color: "#166534" },
  updated:  { bg: "#EFF6FF", color: "#1E40AF" },
  deleted:  { bg: "#FEF2F2", color: "#991B1B" },
  removed:  { bg: "#FEF2F2", color: "#991B1B" },
  invited:  { bg: "#F5F3FF", color: "#5B21B6" },
  reset:    { bg: "#FFFBEB", color: "#92400E" },
  activated: { bg: "#F0FDF4", color: "#166534" },
  deactivated: { bg: "#FEF2F2", color: "#991B1B" },
};

function actionBadge(action) {
  const verb = action.split(".").pop();
  const style = ACTION_COLOR[verb] || { bg: "#F9FAFB", color: "#6B7280" };
  return (
    <span style={{ ...style, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, display: "inline-block", whiteSpace: "nowrap", fontFamily: "'Lato', sans-serif" }}>
      {verb}
    </span>
  );
}

export default function AuditLog({ orgId }) {
  const [entries, setEntries]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [offset, setOffset]     = useState(0);
  const [hasMore, setHasMore]   = useState(false);
  const [filter, setFilter]     = useState("");
  const PAGE = 50;

  useEffect(() => { load(0); }, [orgId]);

  async function load(o) {
    setLoading(true);
    const data = await adminDb.fetchAuditLog(orgId, PAGE + 1, o);
    setHasMore(data.length > PAGE);
    const page = data.slice(0, PAGE);
    setEntries(o === 0 ? page : prev => [...prev, ...page]);
    setOffset(o + PAGE);
    setLoading(false);
  }

  const visible = filter.trim()
    ? entries.filter(e => e.actor_email?.toLowerCase().includes(filter.toLowerCase()) || e.action?.includes(filter.toLowerCase()))
    : entries;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h2 style={{ ...serif, fontSize: 26, color: C.green, margin: "0 0 4px" }}>Audit Log</h2>
          <p style={{ color: C.muted, margin: 0, fontSize: 14 }}>All admin actions recorded in chronological order.</p>
        </div>
        <input style={{ ...inp, width: 220 }} placeholder="Filter by email or action…" value={filter} onChange={e => setFilter(e.target.value)} />
      </div>

      {loading && entries.length === 0 && <div style={{ padding: 40, color: C.muted, textAlign: "center" }}>Loading…</div>}

      {visible.length === 0 && !loading && (
        <div style={{ backgroundColor: C.white, borderRadius: 16, padding: "48px 24px", textAlign: "center", color: C.muted, border: `1px solid ${C.border}` }}>
          {filter ? "No entries match your filter." : "No activity recorded yet."}
        </div>
      )}

      {visible.length > 0 && (
        <div style={{ backgroundColor: C.white, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: "0 2px 20px rgba(44,74,62,0.07)" }}>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 120px 100px 80px", padding: "10px 16px", backgroundColor: C.cream, borderBottom: `2px solid ${C.border}`, gap: 12 }}>
            {["Time", "Actor", "Action", "Target", ""].map((h, i) => (
              <span key={i} style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: "0.6px", textTransform: "uppercase" }}>{h}</span>
            ))}
          </div>
          {visible.map((e, i) => (
            <div key={e.id} style={{ display: "grid", gridTemplateColumns: "150px 1fr 120px 100px 80px", padding: "11px 16px", borderBottom: i < visible.length - 1 ? `1px solid ${C.border}` : "none", gap: 12, alignItems: "center", backgroundColor: i % 2 === 0 ? C.white : "#FDFAF7" }}>
              <span style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>{fmtTime(e.created_at)}</span>
              <span style={{ fontSize: 13, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.actor_email}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {actionBadge(e.action)}
                <span style={{ fontSize: 11, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.action.split(".").slice(0, -1).join(".")}</span>
              </div>
              <span style={{ fontSize: 11, color: C.muted }}>{e.target_type || "—"}</span>
              <span style={{ fontSize: 11, color: C.muted, overflow: "hidden", textOverflow: "ellipsis" }}>{e.target_id || "—"}</span>
            </div>
          ))}
        </div>
      )}

      {hasMore && !filter && (
        <button onClick={() => load(offset)} disabled={loading} style={{ marginTop: 16, padding: "10px 24px", borderRadius: 10, border: `2px solid ${C.green}`, backgroundColor: "transparent", color: C.green, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Lato', sans-serif", display: "block" }}>
          {loading ? "Loading…" : "Load More"}
        </button>
      )}
    </div>
  );
}
