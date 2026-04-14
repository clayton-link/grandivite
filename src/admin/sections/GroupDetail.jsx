import { useState, useEffect } from "react";
import { adminDb } from "../adminDb.js";
import { writeAudit, COLOR_PRESETS } from "../adminUtils.js";

const C = {
  green: "#2C4A3E", greenLight: "#E8F0EE", terra: "#E8936A",
  white: "#FFFFFF", cream: "#FDF8F2", text: "#2A2A2A", muted: "#7A7A7A",
  border: "#E8E0D6", red: "#C0392B",
};
const serif = { fontFamily: "'Playfair Display', serif" };
const card  = { backgroundColor: C.white, borderRadius: 16, padding: 24, boxShadow: "0 2px 20px rgba(44,74,62,0.07)", border: `1px solid ${C.border}`, marginBottom: 16 };
const inp   = { width: "100%", padding: "9px 12px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontFamily: "'Lato', sans-serif", fontSize: 14, color: C.text, backgroundColor: C.white, outline: "none", boxSizing: "border-box" };
const lbl   = { display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.8px", color: C.muted, textTransform: "uppercase", marginBottom: 6 };

function ColorPicker({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      {COLOR_PRESETS.map(hex => (
        <button key={hex} onClick={() => onChange(hex)} style={{ width: 26, height: 26, borderRadius: "50%", backgroundColor: hex, border: "none", cursor: "pointer", outline: value === hex ? `3px solid ${C.text}` : `2px solid transparent`, outlineOffset: 2, flexShrink: 0 }} />
      ))}
      <input type="text" style={{ ...inp, width: 100 }} value={value} onChange={e => onChange(e.target.value)} placeholder="#2C4A3E" />
    </div>
  );
}

export default function GroupDetail({ groupId, actorEmail, onBack }) {
  const [group, setGroup]       = useState(null);
  const [members, setMembers]   = useState([]);
  const [children, setChildren] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [newChild, setNewChild] = useState("");

  useEffect(() => { load(); }, [groupId]);

  async function load() {
    setLoading(true);
    const [gs, ms, cs] = await Promise.all([
      adminDb.fetchGroups(),
      adminDb.fetchGroupMembers(groupId),
      adminDb.fetchGroupChildren(groupId),
    ]);
    const g = gs.find(x => x.id === groupId);
    setGroup(g ? { ...g } : null);
    setMembers(ms);
    setChildren(cs);
    setLoading(false);
  }

  const setField = (k, v) => { setGroup(g => ({ ...g, [k]: v })); setSaved(false); };

  async function handleSave() {
    setSaving(true);
    await adminDb.updateGroup(groupId, { name: group.name, color: group.color, phone: group.phone, active: group.active });
    writeAudit(actorEmail, "group.updated", "group", groupId, { after: { name: group.name, color: group.color, phone: group.phone } });
    setSaving(false); setSaved(true);
  }

  async function addMember() {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    const m = await adminDb.addGroupMember(groupId, email, members.length === 0);
    writeAudit(actorEmail, "group.member.added", "group_member", m?.id, { email, groupId });
    setNewEmail("");
    setMembers(ms => [...ms, m]);
  }

  async function removeMember(id) {
    await adminDb.removeGroupMember(id);
    writeAudit(actorEmail, "group.member.removed", "group_member", id, { groupId });
    setMembers(ms => ms.filter(m => m.id !== id));
  }

  async function togglePrimary(m) {
    await adminDb.updateGroupMember(m.id, { is_primary: !m.is_primary });
    setMembers(ms => ms.map(x => x.id === m.id ? { ...x, is_primary: !x.is_primary } : x));
  }

  async function addChild() {
    const name = newChild.trim();
    if (!name) return;
    const c = await adminDb.addChild(groupId, name, children.length);
    writeAudit(actorEmail, "group.child.added", "group_child", c?.id, { name, groupId });
    setNewChild("");
    setChildren(cs => [...cs, c]);
  }

  async function removeChild(id) {
    await adminDb.removeChild(id);
    writeAudit(actorEmail, "group.child.removed", "group_child", id, { groupId });
    setChildren(cs => cs.filter(c => c.id !== id));
  }

  async function moveChild(id, dir) {
    const idx = children.findIndex(c => c.id === id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= children.length) return;
    const reordered = [...children];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    // Update sort_order in DB for both
    await Promise.all([
      adminDb.updateChild(reordered[idx].id, { sort_order: idx }),
      adminDb.updateChild(reordered[newIdx].id, { sort_order: newIdx }),
    ]);
    setChildren(reordered.map((c, i) => ({ ...c, sort_order: i })));
  }

  if (loading || !group) return <div style={{ padding: 40, color: C.muted, textAlign: "center" }}>Loading…</div>;

  return (
    <div>
      {/* Back button + title */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={onBack} style={{ background: "none", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, color: C.muted, cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>← Back to Groups</button>
        <h2 style={{ ...serif, fontSize: 24, color: C.green, margin: 0 }}>{group.name}</h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 24, alignItems: "start" }}>
        {/* Left — group meta */}
        <div>
          <div style={card}>
            <h3 style={{ ...serif, fontSize: 16, margin: "0 0 20px" }}>Group Details</h3>
            <div style={{ marginBottom: 16 }}>
              <span style={lbl}>Group Name</span>
              <input style={inp} value={group.name} onChange={e => setField("name", e.target.value)} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <span style={lbl}>Color</span>
              <ColorPicker value={group.color} onChange={v => setField("color", v)} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <span style={lbl}>Phone</span>
              <input style={inp} value={group.phone || ""} onChange={e => setField("phone", e.target.value)} placeholder="e.g. 18012307075" />
            </div>
            {/* Active toggle */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 16, borderTop: `1px solid ${C.border}`, marginBottom: 20 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>Active</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Inactive groups won't appear in the main app</div>
              </div>
              <button onClick={() => setField("active", !group.active)} style={{ width: 46, height: 26, borderRadius: 13, border: "none", cursor: "pointer", backgroundColor: group.active ? C.green : C.border, position: "relative", transition: "background-color 0.2s", flexShrink: 0 }}>
                <span style={{ position: "absolute", top: 3, left: group.active ? 22 : 3, width: 20, height: 20, borderRadius: "50%", backgroundColor: C.white, transition: "left 0.2s", display: "block", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
              </button>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button onClick={handleSave} disabled={saving} style={{ padding: "10px 22px", borderRadius: 10, border: "none", backgroundColor: C.green, color: C.white, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>
                {saving ? "Saving…" : "Save"}
              </button>
              {saved && <span style={{ fontSize: 13, color: C.green, fontWeight: 700 }}>✓ Saved</span>}
            </div>
          </div>
        </div>

        {/* Right — members + children */}
        <div>
          {/* Members */}
          <div style={card}>
            <h3 style={{ ...serif, fontSize: 16, margin: "0 0 16px" }}>Email Addresses</h3>
            {members.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {members.map(m => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ flex: 1, fontSize: 14, color: C.text }}>{m.email}</span>
                    <button onClick={() => togglePrimary(m)} title={m.is_primary ? "Primary contact" : "Set as primary"} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, border: `1px solid ${m.is_primary ? C.green : C.border}`, backgroundColor: m.is_primary ? C.greenLight : "transparent", color: m.is_primary ? C.green : C.muted, fontWeight: 700, cursor: "pointer", fontFamily: "'Lato', sans-serif", whiteSpace: "nowrap" }}>
                      {m.is_primary ? "★ Primary" : "Set Primary"}
                    </button>
                    <button onClick={() => removeMember(m.id)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 14, padding: "0 4px" }} title="Remove">✕</button>
                  </div>
                ))}
              </div>
            )}
            {members.length === 0 && <p style={{ color: C.muted, fontSize: 13, marginBottom: 12 }}>No emails yet. Add one below.</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <input style={{ ...inp, flex: 1 }} type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@example.com" onKeyDown={e => e.key === "Enter" && addMember()} />
              <button onClick={addMember} disabled={!newEmail.trim()} style={{ padding: "9px 16px", borderRadius: 8, border: "none", backgroundColor: C.green, color: C.white, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Lato', sans-serif", opacity: newEmail.trim() ? 1 : 0.5 }}>Add</button>
            </div>
          </div>

          {/* Children */}
          <div style={card}>
            <h3 style={{ ...serif, fontSize: 16, margin: "0 0 16px" }}>Children / Members</h3>
            <p style={{ fontSize: 12, color: C.muted, margin: "0 0 12px" }}>These names appear in the event submission form dropdown.</p>
            {children.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {children.map((c, i) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <button onClick={() => moveChild(c.id, -1)} disabled={i === 0} style={{ background: "none", border: "none", cursor: i === 0 ? "default" : "pointer", color: i === 0 ? C.border : C.muted, fontSize: 10, lineHeight: 1, padding: "1px 4px" }}>▲</button>
                      <button onClick={() => moveChild(c.id, 1)} disabled={i === children.length - 1} style={{ background: "none", border: "none", cursor: i === children.length - 1 ? "default" : "pointer", color: i === children.length - 1 ? C.border : C.muted, fontSize: 10, lineHeight: 1, padding: "1px 4px" }}>▼</button>
                    </div>
                    <span style={{ flex: 1, fontSize: 14, color: C.text }}>{c.name}</span>
                    <button onClick={() => removeChild(c.id)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 14, padding: "0 4px" }}>✕</button>
                  </div>
                ))}
              </div>
            )}
            {children.length === 0 && <p style={{ color: C.muted, fontSize: 13, marginBottom: 12 }}>No children listed. Add names below.</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <input style={{ ...inp, flex: 1 }} value={newChild} onChange={e => setNewChild(e.target.value)} placeholder="Child's name" onKeyDown={e => e.key === "Enter" && addChild()} />
              <button onClick={addChild} disabled={!newChild.trim()} style={{ padding: "9px 16px", borderRadius: 8, border: "none", backgroundColor: C.green, color: C.white, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Lato', sans-serif", opacity: newChild.trim() ? 1 : 0.5 }}>Add</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
