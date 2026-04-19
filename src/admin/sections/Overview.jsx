import { useState, useEffect } from "react";
import { adminDb } from "../adminDb.js";
import { fmtTime } from "../adminUtils.js";

const C = {
  green: "#2C4A3E", greenLight: "#E8F0EE", terra: "#E8936A", terraLight: "#FDF0E8",
  white: "#FFFFFF", cream: "#FDF8F2", text: "#2A2A2A", muted: "#7A7A7A",
  border: "#E8E0D6",
};
const serif = { fontFamily: "'Playfair Display', serif" };
const card  = { backgroundColor: C.white, borderRadius: 16, padding: 24, boxShadow: "0 2px 20px rgba(44,74,62,0.07)", border: `1px solid ${C.border}`, marginBottom: 16 };

const QUICK_LINKS = [
  { label: "Organization Settings", icon: "🏢", page: "org",           desc: "Branding, colors, templates" },
  { label: "Groups",                icon: "👨‍👩‍👧‍👦", page: "groups",        desc: "Manage families / teams" },
  { label: "Recipients",            icon: "📬", page: "recipients",    desc: "Digest audience & recipients" },
  { label: "Members",               icon: "🔑", page: "members",       desc: "Admin & coordinator access" },
  { label: "Notifications",         icon: "🔔", page: "notifications", desc: "Schedule, templates, rules" },
  { label: "Audit Log",             icon: "📋", page: "audit",         desc: "All recent admin activity" },
];

export default function Overview({ orgId, onNavigate }) {
  const [stats, setStats]   = useState(null);
  const [log, setLog]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [groups, members, log, cycle] = await Promise.all([
        adminDb.fetchGroups(orgId),
        adminDb.fetchOrgMembers(orgId),
        adminDb.fetchAuditLog(orgId, 8, 0),
        adminDb.fetchLatestCycle(orgId),
      ]);
      setStats({ groups: groups.length, members: members.length, cycle });
      setLog(log);
      setLoading(false);
    })();
  }, [orgId]);

  if (loading) return <div style={{ padding: 40, color: C.muted, textAlign: "center" }}>Loading…</div>;

  return (
    <div>
      <h2 style={{ ...serif, fontSize: 26, color: C.green, margin: "0 0 4px" }}>Dashboard Overview</h2>
      <p style={{ color: C.muted, margin: "0 0 28px", fontSize: 14 }}>Welcome to the Grandivite admin dashboard.</p>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Groups",         value: stats.groups,   icon: "👨‍👩‍👧‍👦" },
          { label: "Admin Members",  value: stats.members,  icon: "🔑" },
          { label: "Active Cycle",   value: stats.cycle ? (stats.cycle.locked ? "Locked" : "Open") : "None", icon: "📅" },
        ].map((s, i) => (
          <div key={i} style={{ ...card, marginBottom: 0, textAlign: "center", padding: "20px 16px" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ ...serif, fontSize: 30, color: C.green, fontWeight: 700 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Current cycle status */}
      {stats.cycle && (
        <div style={{ ...card, backgroundColor: stats.cycle.locked ? C.greenLight : C.terraLight, border: `1.5px solid ${stats.cycle.locked ? "#A8C4BC" : "#F0B898"}`, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>Current Cycle: {stats.cycle.month_label}</div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>
                {stats.cycle.locked ? "🔒 Calendar locked" : "✏️ Open for submissions"} · {stats.cycle.digest_sent ? "📧 Digest sent" : "Digest not sent yet"}
              </div>
            </div>
            <button onClick={() => onNavigate("cycles")} style={{ padding: "8px 16px", borderRadius: 8, border: `1.5px solid ${C.green}`, backgroundColor: C.white, color: C.green, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>
              Manage Cycles →
            </button>
          </div>
        </div>
      )}

      {/* Quick links */}
      <h3 style={{ ...serif, fontSize: 18, color: C.text, margin: "0 0 14px" }}>Quick Access</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28 }}>
        {QUICK_LINKS.map(l => (
          <button key={l.page} onClick={() => onNavigate(l.page)} style={{ ...card, marginBottom: 0, textAlign: "left", border: "none", cursor: "pointer", padding: "18px 20px", transition: "box-shadow 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 24px rgba(44,74,62,0.15)"}
            onMouseLeave={e => e.currentTarget.style.boxShadow = "0 2px 20px rgba(44,74,62,0.07)"}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{l.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 3 }}>{l.label}</div>
            <div style={{ fontSize: 12, color: C.muted }}>{l.desc}</div>
          </button>
        ))}
      </div>

      {/* Recent audit log */}
      {log.length > 0 && (
        <div>
          <h3 style={{ ...serif, fontSize: 18, color: C.text, margin: "0 0 14px" }}>Recent Activity</h3>
          <div style={{ ...card, padding: 0, overflow: "hidden" }}>
            {log.map((entry, i) => (
              <div key={entry.id} style={{ display: "flex", gap: 16, padding: "12px 20px", borderBottom: i < log.length - 1 ? `1px solid ${C.border}` : "none", alignItems: "flex-start" }}>
                <div style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap", minWidth: 120, paddingTop: 1 }}>{fmtTime(entry.created_at)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{entry.actor_email}</span>
                  <span style={{ fontSize: 13, color: C.muted }}> · {entry.action}</span>
                  {entry.target_type && <span style={{ fontSize: 11, color: C.muted }}> ({entry.target_type})</span>}
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => onNavigate("audit")} style={{ background: "none", border: "none", color: C.green, fontWeight: 700, fontSize: 12, cursor: "pointer", padding: "8px 0" }}>
            View full audit log →
          </button>
        </div>
      )}
    </div>
  );
}
