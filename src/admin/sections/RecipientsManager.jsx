import { useState, useEffect } from "react";
import { adminDb } from "../adminDb.js";
import { writeAudit } from "../adminUtils.js";

const C = {
  green: "#2C4A3E", greenLight: "#E8F0EE", terra: "#E8936A",
  white: "#FFFFFF", cream: "#FDF8F2", text: "#2A2A2A", muted: "#7A7A7A",
  border: "#E8E0D6", red: "#C0392B",
};
const serif = { fontFamily: "'Playfair Display', serif" };
const card  = { backgroundColor: C.white, borderRadius: 16, padding: 24, boxShadow: "0 2px 20px rgba(44,74,62,0.07)", border: `1px solid ${C.border}`, marginBottom: 16 };
const inp   = { padding: "9px 12px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontFamily: "'Lato', sans-serif", fontSize: 14, color: C.text, backgroundColor: C.white, outline: "none", boxSizing: "border-box" };
const lbl   = { display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.8px", color: C.muted, textTransform: "uppercase", marginBottom: 6 };

function RecipientRow({ r, onUpdate, onDelete }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 180px 130px 80px 40px", gap: 12, padding: "10px 0", borderBottom: `1px solid ${C.border}`, alignItems: "center" }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{r.name || "—"}</div>
        <div style={{ fontSize: 12, color: C.muted }}>{r.email || "no email"}</div>
      </div>
      <div style={{ fontSize: 12, color: C.muted }}>{r.phone || "—"}</div>
      <div style={{ fontSize: 11, color: C.muted }}>{r.email}</div>
      {/* Can RSVP toggle */}
      <button onClick={() => onUpdate(r.id, { can_rsvp: !r.can_rsvp })} style={{ width: 40, height: 22, borderRadius: 11, backgroundColor: r.can_rsvp ? C.green : C.border, border: "none", position: "relative", cursor: "pointer", transition: "background-color 0.2s" }}>
        <span style={{ position: "absolute", top: 3, left: r.can_rsvp ? 20 : 3, width: 16, height: 16, borderRadius: "50%", backgroundColor: C.white, transition: "left 0.2s", display: "block", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
      </button>
      <button onClick={() => onDelete(r.id)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 14, textAlign: "center" }}>✕</button>
    </div>
  );
}

function AddRecipientForm({ onAdd, onCancel }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", can_rsvp: true });
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  return (
    <div style={{ backgroundColor: C.greenLight, borderRadius: 10, padding: 16, marginTop: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div><span style={lbl}>Name</span><input style={{ ...inp, width: "100%" }} value={f.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Nana" /></div>
        <div><span style={lbl}>Email</span><input style={{ ...inp, width: "100%" }} type="email" value={f.email} onChange={e => set("email", e.target.value)} placeholder="email@example.com" /></div>
        <div><span style={lbl}>Phone</span><input style={{ ...inp, width: "100%" }} value={f.phone} onChange={e => set("phone", e.target.value)} placeholder="18015551234" /></div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={() => onAdd(f)} disabled={!f.email && !f.phone} style={{ padding: "9px 18px", borderRadius: 8, border: "none", backgroundColor: C.green, color: C.white, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Lato', sans-serif", opacity: (f.email || f.phone) ? 1 : 0.5 }}>Add Recipient</button>
        <button onClick={onCancel} style={{ padding: "9px 14px", borderRadius: 8, border: `1.5px solid ${C.border}`, backgroundColor: C.white, color: C.muted, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>Cancel</button>
      </div>
    </div>
  );
}

export default function RecipientsManager({ actorEmail }) {
  const [groups, setGroups]           = useState([]);
  const [recipientsMap, setRMap]      = useState({});
  const [expanded, setExpanded]       = useState({});
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showAddRecip, setShowAddRecip] = useState({});
  const [newGroupLabel, setNewGroupLabel] = useState("");
  const [loading, setLoading]         = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const gs = await adminDb.fetchRecipientGroups();
    setGroups(gs);
    const map = {};
    await Promise.all(gs.map(async g => {
      map[g.id] = await adminDb.fetchRecipients(g.id);
    }));
    setRMap(map);
    // Auto-expand first group
    if (gs.length > 0) setExpanded({ [gs[0].id]: true });
    setLoading(false);
  }

  async function addGroup() {
    const label = newGroupLabel.trim();
    if (!label) return;
    const g = await adminDb.createRecipientGroup(label);
    writeAudit(actorEmail, "recipient_group.created", "recipient_group", g?.id, { label });
    setNewGroupLabel(""); setShowAddGroup(false);
    load();
  }

  async function toggleDigest(g) {
    await adminDb.updateRecipientGroup(g.id, { receives_digest: !g.receives_digest });
    writeAudit(actorEmail, "recipient_group.updated", "recipient_group", g.id, { receives_digest: !g.receives_digest });
    setGroups(gs => gs.map(x => x.id === g.id ? { ...x, receives_digest: !x.receives_digest } : x));
  }

  async function addRecipient(groupId, fields) {
    const r = await adminDb.createRecipient({ ...fields, recipient_group_id: groupId });
    writeAudit(actorEmail, "recipient.created", "recipient", r?.id, { email: fields.email });
    setRMap(m => ({ ...m, [groupId]: [...(m[groupId] || []), r] }));
    setShowAddRecip(x => ({ ...x, [groupId]: false }));
  }

  async function updateRecipient(id, fields, groupId) {
    await adminDb.updateRecipient(id, fields);
    setRMap(m => ({ ...m, [groupId]: m[groupId].map(r => r.id === id ? { ...r, ...fields } : r) }));
  }

  async function deleteRecipient(id, groupId) {
    if (!window.confirm("Remove this recipient?")) return;
    await adminDb.deleteRecipient(id);
    writeAudit(actorEmail, "recipient.deleted", "recipient", id, { groupId });
    setRMap(m => ({ ...m, [groupId]: m[groupId].filter(r => r.id !== id) }));
  }

  if (loading) return <div style={{ padding: 40, color: C.muted, textAlign: "center" }}>Loading…</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h2 style={{ ...serif, fontSize: 26, color: C.green, margin: "0 0 4px" }}>Recipients</h2>
          <p style={{ color: C.muted, margin: 0, fontSize: 14 }}>People who receive the monthly digest (e.g., Nana & Papa). They can also RSVP to events.</p>
        </div>
        <button onClick={() => setShowAddGroup(true)} style={{ padding: "10px 20px", borderRadius: 10, border: "none", backgroundColor: C.green, color: C.white, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Lato', sans-serif", flexShrink: 0 }}>
          + Add Group
        </button>
      </div>

      {/* Add group form */}
      {showAddGroup && (
        <div style={{ ...card, backgroundColor: C.greenLight }}>
          <span style={lbl}>New Recipient Group Label</span>
          <div style={{ display: "flex", gap: 10 }}>
            <input style={{ ...inp, flex: 1 }} value={newGroupLabel} onChange={e => setNewGroupLabel(e.target.value)} placeholder='e.g. "Nana & Papa" or "Extended Family"' onKeyDown={e => e.key === "Enter" && addGroup()} autoFocus />
            <button onClick={addGroup} style={{ padding: "9px 18px", borderRadius: 8, border: "none", backgroundColor: C.green, color: C.white, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>Create</button>
            <button onClick={() => setShowAddGroup(false)} style={{ padding: "9px 14px", borderRadius: 8, border: `1.5px solid ${C.border}`, backgroundColor: C.white, color: C.muted, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>Cancel</button>
          </div>
        </div>
      )}

      {groups.length === 0 && !showAddGroup && (
        <div style={{ ...card, textAlign: "center", padding: "48px 24px", color: C.muted }}>
          No recipient groups yet. Create one to add people like Nana & Papa.
        </div>
      )}

      {groups.map(g => {
        const isOpen = !!expanded[g.id];
        const recs = recipientsMap[g.id] || [];
        return (
          <div key={g.id} style={card}>
            {/* Group header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setExpanded(e => ({ ...e, [g.id]: !e[g.id] }))}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 18 }}>{isOpen ? "▾" : "▸"}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: C.text }}>{g.label}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{recs.length} recipient{recs.length !== 1 ? "s" : ""}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }} onClick={e => e.stopPropagation()}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>Receives Digest</span>
                  <button onClick={() => toggleDigest(g)} style={{ width: 40, height: 22, borderRadius: 11, backgroundColor: g.receives_digest ? C.green : C.border, border: "none", position: "relative", cursor: "pointer", transition: "background-color 0.2s" }}>
                    <span style={{ position: "absolute", top: 3, left: g.receives_digest ? 20 : 3, width: 16, height: 16, borderRadius: "50%", backgroundColor: C.white, transition: "left 0.2s", display: "block", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                  </button>
                </div>
              </div>
            </div>

            {/* Expanded content */}
            {isOpen && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                {recs.length > 0 && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 180px 130px 80px 40px", gap: 12, padding: "4px 0 8px", marginBottom: 4 }}>
                      {["Name / Email", "Phone", "", "Can RSVP", ""].map((h, i) => (
                        <span key={i} style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: "0.6px", textTransform: "uppercase" }}>{h}</span>
                      ))}
                    </div>
                    {recs.map(r => (
                      <RecipientRow key={r.id} r={r}
                        onUpdate={(id, f) => updateRecipient(id, f, g.id)}
                        onDelete={id => deleteRecipient(id, g.id)} />
                    ))}
                  </>
                )}
                {recs.length === 0 && <p style={{ color: C.muted, fontSize: 13, marginBottom: 12 }}>No recipients in this group yet.</p>}

                {showAddRecip[g.id]
                  ? <AddRecipientForm onAdd={f => addRecipient(g.id, f)} onCancel={() => setShowAddRecip(x => ({ ...x, [g.id]: false }))} />
                  : <button onClick={() => setShowAddRecip(x => ({ ...x, [g.id]: true }))} style={{ marginTop: 12, padding: "8px 16px", borderRadius: 8, border: `1.5px solid ${C.green}`, backgroundColor: "transparent", color: C.green, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>+ Add Recipient</button>
                }
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
