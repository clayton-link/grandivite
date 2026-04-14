import { useState, useEffect } from "react";
import { adminDb } from "../adminDb.js";
import { writeAudit, fmtTime, roleBadgeStyle } from "../adminUtils.js";

const C = {
  green: "#2C4A3E", greenLight: "#E8F0EE", terra: "#E8936A", terraLight: "#FDF0E8",
  white: "#FFFFFF", cream: "#FDF8F2", text: "#2A2A2A", muted: "#7A7A7A",
  border: "#E8E0D6", red: "#C0392B",
};
const serif = { fontFamily: "'Playfair Display', serif" };
const card  = { backgroundColor: C.white, borderRadius: 16, padding: 0, boxShadow: "0 2px 20px rgba(44,74,62,0.07)", border: `1px solid ${C.border}`, overflow: "hidden" };
const inp   = { padding: "9px 12px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontFamily: "'Lato', sans-serif", fontSize: 13, color: C.text, backgroundColor: C.white, outline: "none", boxSizing: "border-box" };

const ROLE_DESCRIPTIONS = {
  owner:  "Full access + can manage billing",
  admin:  "Full admin access",
  editor: "Can submit and edit events",
  viewer: "Read-only access",
};

const COLS = "1fr 160px 120px 120px 80px";

export default function MembersManager({ actorEmail }) {
  const [members, setMembers]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
  const [newMember, setNewMember] = useState({ email: "", role: "admin", display_name: "" });
  const [hoverRow, setHoverRow] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setMembers(await adminDb.fetchOrgMembers());
    setLoading(false);
  }

  async function handleAdd() {
    const { email, role, display_name } = newMember;
    if (!email.trim()) return;
    const m = await adminDb.upsertOrgMember(email.trim().toLowerCase(), role, display_name.trim() || null);
    writeAudit(actorEmail, "org_member.invited", "org_member", m?.id, { email, role });
    setNewMember({ email: "", role: "admin", display_name: "" });
    setShowAdd(false);
    load();
  }

  async function changeRole(m, role) {
    await adminDb.updateOrgMember(m.id, { role });
    writeAudit(actorEmail, "org_member.role_changed", "org_member", m.id, { from: m.role, to: role });
    setMembers(ms => ms.map(x => x.id === m.id ? { ...x, role } : x));
  }

  async function toggleActive(m) {
    if (m.email === actorEmail) return; // can't deactivate yourself
    await adminDb.updateOrgMember(m.id, { is_active: !m.is_active });
    writeAudit(actorEmail, m.is_active ? "org_member.deactivated" : "org_member.activated", "org_member", m.id, {});
    setMembers(ms => ms.map(x => x.id === m.id ? { ...x, is_active: !x.is_active } : x));
  }

  async function removeMember(m) {
    if (m.email === actorEmail) { alert("You cannot remove yourself."); return; }
    if (!window.confirm(`Remove ${m.email} from admin access?`)) return;
    await adminDb.removeOrgMember(m.id);
    writeAudit(actorEmail, "org_member.removed", "org_member", m.id, { email: m.email });
    setMembers(ms => ms.filter(x => x.id !== m.id));
  }

  if (loading) return <div style={{ padding: 40, color: C.muted, textAlign: "center" }}>Loading…</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h2 style={{ ...serif, fontSize: 26, color: C.green, margin: "0 0 4px" }}>Admin Members</h2>
          <p style={{ color: C.muted, margin: 0, fontSize: 14 }}>Manage who has access to this admin dashboard.</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ padding: "10px 20px", borderRadius: 10, border: "none", backgroundColor: C.green, color: C.white, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>+ Add Member</button>
      </div>

      {/* Role guide */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
        {Object.entries(ROLE_DESCRIPTIONS).map(([role, desc]) => (
          <div key={role} style={{ backgroundColor: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px" }}>
            <span style={roleBadgeStyle(role)}>{role}</span>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>{desc}</div>
          </div>
        ))}
      </div>

      <div style={card}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: COLS, padding: "10px 16px", backgroundColor: C.cream, borderBottom: `2px solid ${C.border}`, gap: 12 }}>
          {["Name / Email", "Role", "Joined", "Active", ""].map((h, i) => (
            <span key={i} style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: "0.6px", textTransform: "uppercase" }}>{h}</span>
          ))}
        </div>

        {/* Inline add row */}
        {showAdd && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto auto", gap: 10, padding: "12px 16px", backgroundColor: C.greenLight, borderBottom: `1px solid ${C.border}`, alignItems: "center" }}>
            <input style={{ ...inp, width: "100%" }} type="email" placeholder="email@example.com" value={newMember.email} onChange={e => setNewMember(x => ({ ...x, email: e.target.value }))} autoFocus />
            <input style={{ ...inp, width: "100%" }} placeholder="Display Name (optional)" value={newMember.display_name} onChange={e => setNewMember(x => ({ ...x, display_name: e.target.value }))} />
            <select style={{ ...inp, width: "100%" }} value={newMember.role} onChange={e => setNewMember(x => ({ ...x, role: e.target.value }))}>
              <option value="admin">admin</option>
              <option value="owner">owner</option>
            </select>
            <button onClick={handleAdd} disabled={!newMember.email.trim()} style={{ padding: "9px 16px", borderRadius: 8, border: "none", backgroundColor: C.green, color: C.white, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "'Lato', sans-serif", opacity: newMember.email.trim() ? 1 : 0.5 }}>Add</button>
            <button onClick={() => setShowAdd(false)} style={{ padding: "9px 12px", borderRadius: 8, border: `1.5px solid ${C.border}`, backgroundColor: C.white, color: C.muted, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>✕</button>
          </div>
        )}

        {/* Member rows */}
        {members.length === 0 && !showAdd && (
          <div style={{ padding: "40px 24px", textAlign: "center", color: C.muted }}>No admin members yet.</div>
        )}
        {members.map(m => {
          const isYou = m.email === actorEmail;
          return (
            <div key={m.id} style={{ display: "grid", gridTemplateColumns: COLS, padding: "13px 16px", borderBottom: `1px solid ${C.border}`, gap: 12, alignItems: "center", backgroundColor: hoverRow === m.id ? "#F9F5F0" : C.white, opacity: m.is_active ? 1 : 0.5 }}
              onMouseEnter={() => setHoverRow(m.id)} onMouseLeave={() => setHoverRow(null)}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{m.display_name || m.email}</div>
                {m.display_name && <div style={{ fontSize: 11, color: C.muted }}>{m.email}</div>}
                {isYou && <span style={{ fontSize: 10, color: C.green, fontWeight: 700 }}>YOU</span>}
              </div>
              {/* Role selector */}
              <select value={m.role} onChange={e => changeRole(m, e.target.value)} disabled={isYou}
                style={{ ...inp, fontSize: 12, width: "auto", padding: "5px 10px", cursor: isYou ? "not-allowed" : "pointer" }}>
                <option value="owner">owner</option>
                <option value="admin">admin</option>
                <option value="editor">editor</option>
                <option value="viewer">viewer</option>
              </select>
              <span style={{ fontSize: 12, color: C.muted }}>{fmtTime(m.created_at)}</span>
              {/* Active toggle */}
              <button onClick={() => toggleActive(m)} disabled={isYou} style={{ width: 40, height: 22, borderRadius: 11, backgroundColor: m.is_active ? C.green : C.border, border: "none", position: "relative", cursor: isYou ? "not-allowed" : "pointer", transition: "background-color 0.2s" }}>
                <span style={{ position: "absolute", top: 3, left: m.is_active ? 20 : 3, width: 16, height: 16, borderRadius: "50%", backgroundColor: C.white, transition: "left 0.2s", display: "block", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
              </button>
              <button onClick={() => removeMember(m)} disabled={isYou} style={{ background: "none", border: "none", color: isYou ? C.border : C.muted, cursor: isYou ? "not-allowed" : "pointer", fontSize: 14 }}>✕</button>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16, padding: "12px 16px", backgroundColor: C.terraLight, borderRadius: 10, border: `1px solid #F0B898`, fontSize: 12, color: "#8B4513" }}>
        ⚠️ Admin access is granted the next time a person signs in. Removing access takes effect immediately on their next page load.
      </div>
    </div>
  );
}
