import { useState, useEffect } from "react";
import { adminDb } from "../adminDb.js";
import { writeAudit, COLOR_PRESETS } from "../adminUtils.js";

const C = {
  green: "#2C4A3E", greenLight: "#E8F0EE", terra: "#E8936A", terraLight: "#FDF0E8",
  white: "#FFFFFF", cream: "#FDF8F2", text: "#2A2A2A", muted: "#7A7A7A",
  border: "#E8E0D6", red: "#C0392B", redLight: "#FDECEA",
};
const serif = { fontFamily: "'Playfair Display', serif" };
const card  = { backgroundColor: C.white, borderRadius: 16, padding: 0, boxShadow: "0 2px 20px rgba(44,74,62,0.07)", border: `1px solid ${C.border}`, marginBottom: 16, overflow: "hidden" };
const inp   = { padding: "9px 12px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontFamily: "'Lato', sans-serif", fontSize: 13, color: C.text, backgroundColor: C.white, outline: "none", boxSizing: "border-box" };

const COLS = "44px 1fr 80px 80px 140px 80px 80px";

function ColorSwatch({ color, size = 20 }) {
  return <span style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", backgroundColor: color, border: `2px solid rgba(0,0,0,0.08)`, flexShrink: 0 }} />;
}

function AddGroupRow({ onAdd, onCancel }) {
  const [name, setName]   = useState("");
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [phone, setPhone] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div style={{ backgroundColor: C.greenLight, borderBottom: `1px solid ${C.border}`, padding: "12px 16px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 150px 100px auto auto", gap: 10, alignItems: "center" }}>
        <div style={{ position: "relative" }}>
          <button onClick={() => setShowPicker(p => !p)} style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: color, border: "none", cursor: "pointer" }} />
          {showPicker && (
            <div style={{ position: "absolute", top: 36, left: 0, zIndex: 50, backgroundColor: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", display: "flex", flexWrap: "wrap", gap: 6, width: 180 }}>
              {COLOR_PRESETS.map(hex => (
                <button key={hex} onClick={() => { setColor(hex); setShowPicker(false); }} style={{ width: 26, height: 26, borderRadius: "50%", backgroundColor: hex, border: "none", cursor: "pointer", outline: color === hex ? `3px solid ${C.text}` : "none", outlineOffset: 2 }} />
              ))}
            </div>
          )}
        </div>
        <input style={{ ...inp, width: "100%" }} placeholder="Group name (e.g. Smith Family)" value={name} onChange={e => setName(e.target.value)} autoFocus />
        <input style={{ ...inp, width: "100%" }} placeholder="Phone (optional)" value={phone} onChange={e => setPhone(e.target.value)} />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { if (name.trim()) onAdd({ name: name.trim(), color, phone: phone.trim() || null }); }} disabled={!name.trim()} style={{ padding: "8px 14px", borderRadius: 8, border: "none", backgroundColor: C.green, color: C.white, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "'Lato', sans-serif", opacity: name.trim() ? 1 : 0.5 }}>Add</button>
          <button onClick={onCancel} style={{ padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${C.border}`, backgroundColor: C.white, color: C.muted, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function GroupsManager({ orgId, actorEmail, onEditGroup }) {
  const [groups, setGroups]       = useState([]);
  const [counts, setCounts]       = useState({});
  const [loading, setLoading]     = useState(true);
  const [showAdd, setShowAdd]     = useState(false);
  const [hoverRow, setHoverRow]   = useState(null);

  useEffect(() => { load(); }, [orgId]);

  async function load() {
    setLoading(true);
    const gs = await adminDb.fetchGroups(orgId);
    setGroups(gs);
    // Fetch member + child counts
    const [{ data: members }, { data: children }] = await Promise.all([
      adminDb.supabase.from("group_members").select("group_id"),
      adminDb.supabase.from("group_children").select("group_id"),
    ]);
    const mc = {}, cc = {};
    (members || []).forEach(m => { mc[m.group_id] = (mc[m.group_id] || 0) + 1; });
    (children || []).forEach(c => { cc[c.group_id] = (cc[c.group_id] || 0) + 1; });
    setCounts({ members: mc, children: cc });
    setLoading(false);
  }

  async function handleAdd(fields) {
    const maxOrder = groups.reduce((m, g) => Math.max(m, g.sort_order || 0), 0);
    const g = await adminDb.createGroup(orgId, { ...fields, sort_order: maxOrder + 1 });
    writeAudit(orgId, actorEmail, "group.created", "group", g?.id, { after: fields });
    setShowAdd(false);
    load();
  }

  async function toggleActive(g) {
    await adminDb.updateGroup(g.id, { active: !g.active });
    writeAudit(orgId, actorEmail, g.active ? "group.deactivated" : "group.activated", "group", g.id, {});
    setGroups(gs => gs.map(x => x.id === g.id ? { ...x, active: !x.active } : x));
  }

  if (loading) return <div style={{ padding: 40, color: C.muted, textAlign: "center" }}>Loading…</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h2 style={{ ...serif, fontSize: 26, color: C.green, margin: "0 0 4px" }}>Groups</h2>
          <p style={{ color: C.muted, margin: 0, fontSize: 14 }}>Manage families, teams, or any groups that submit events.</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ padding: "10px 20px", borderRadius: 10, border: "none", backgroundColor: C.green, color: C.white, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Lato', sans-serif", flexShrink: 0 }}>
          + Add Group
        </button>
      </div>

      <div style={card}>
        {/* Table header */}
        <div style={{ display: "grid", gridTemplateColumns: COLS, padding: "10px 16px", backgroundColor: C.cream, borderBottom: `2px solid ${C.border}`, gap: 12, alignItems: "center" }}>
          {["", "Name", "Members", "Children", "Phone", "Active", ""].map((h, i) => (
            <span key={i} style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: "0.6px", textTransform: "uppercase" }}>{h}</span>
          ))}
        </div>

        {/* Inline add row */}
        {showAdd && <AddGroupRow onAdd={handleAdd} onCancel={() => setShowAdd(false)} />}

        {/* Group rows */}
        {groups.length === 0 && !showAdd && (
          <div style={{ padding: "40px 24px", textAlign: "center", color: C.muted }}>
            No groups yet. Click "Add Group" to create the first one.
          </div>
        )}
        {groups.map(g => (
          <div key={g.id}
            style={{ display: "grid", gridTemplateColumns: COLS, padding: "14px 16px", borderBottom: `1px solid ${C.border}`, gap: 12, alignItems: "center", backgroundColor: hoverRow === g.id ? "#F9F5F0" : C.white, cursor: "pointer", opacity: g.active ? 1 : 0.55 }}
            onMouseEnter={() => setHoverRow(g.id)} onMouseLeave={() => setHoverRow(null)}
            onClick={() => onEditGroup(g.id)}>
            <ColorSwatch color={g.color} />
            <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{g.name}</span>
            <span style={{ fontSize: 13, color: C.muted, textAlign: "center" }}>{counts.members?.[g.id] || 0}</span>
            <span style={{ fontSize: 13, color: C.muted, textAlign: "center" }}>{counts.children?.[g.id] || 0}</span>
            <span style={{ fontSize: 12, color: C.muted }}>{g.phone || "—"}</span>
            {/* Active toggle — stop propagation so click doesn't open detail */}
            <div onClick={e => { e.stopPropagation(); toggleActive(g); }} style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ width: 40, height: 22, borderRadius: 11, backgroundColor: g.active ? C.green : C.border, position: "relative", cursor: "pointer", transition: "background-color 0.2s" }}>
                <span style={{ position: "absolute", top: 3, left: g.active ? 20 : 3, width: 16, height: 16, borderRadius: "50%", backgroundColor: C.white, transition: "left 0.2s", display: "block", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
              </div>
            </div>
            <span style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>Edit →</span>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 12, color: C.muted }}>Click any row to edit group details, members, and children.</p>
    </div>
  );
}
