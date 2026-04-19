import { useState } from "react";
import { adminDb } from "../adminDb.js";
import { writeAudit, COLOR_PRESETS } from "../adminUtils.js";

const C = {
  green: "#2C4A3E", greenLight: "#E8F0EE", terra: "#E8936A", white: "#FFFFFF",
  cream: "#FDF8F2", text: "#2A2A2A", muted: "#7A7A7A", border: "#E8E0D6",
};
const serif = { fontFamily: "'Playfair Display', serif" };
const card  = { backgroundColor: C.white, borderRadius: 16, padding: 24, boxShadow: "0 2px 20px rgba(44,74,62,0.07)", border: `1px solid ${C.border}`, marginBottom: 20 };
const inp   = { width: "100%", padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontFamily: "'Lato', sans-serif", fontSize: 14, color: C.text, backgroundColor: C.white, outline: "none", boxSizing: "border-box" };
const lbl   = { display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.8px", color: C.muted, textTransform: "uppercase", marginBottom: 6 };

function ColorPicker({ value, onChange }) {
  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        {COLOR_PRESETS.map(hex => (
          <button key={hex} onClick={() => onChange(hex)} style={{
            width: 28, height: 28, borderRadius: "50%", backgroundColor: hex, border: "none",
            cursor: "pointer", outline: value === hex ? `3px solid ${C.text}` : `2px solid transparent`,
            outlineOffset: 2, flexShrink: 0,
          }} />
        ))}
      </div>
      <input type="text" style={{ ...inp, width: 110 }} value={value} onChange={e => onChange(e.target.value)} placeholder="#2C4A3E" />
    </div>
  );
}

export default function OrgSettings({ orgId, org, orgSettings, actorEmail, onSaved }) {
  const [draft, setDraft] = useState({
    name:             org?.name             || "",
    app_title:        org?.app_title        || "",
    app_emoji:        org?.app_emoji        || "🌿",
    primary_color:    org?.primary_color    || "#2C4A3E",
    accent_color:     org?.accent_color     || "#E8936A",
    digest_greeting:  org?.digest_greeting  || "",
    digest_footer:    org?.digest_footer    || "",
    digest_signoff:   org?.digest_signoff   || "",
    prompt_body:      org?.prompt_body      || "",
    note_label:       org?.note_label       || "",
    lookahead_days:   orgSettings?.lookahead_days ?? 30,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  const set = (k, v) => { setDraft(d => ({ ...d, [k]: v })); setSaved(false); };

  const handleSave = async () => {
    setSaving(true);
    const { lookahead_days, ...orgFields } = draft;
    await Promise.all([
      adminDb.updateOrg(orgId, orgFields),
      adminDb.updateOrgSettings(orgId, { lookahead_days: parseInt(lookahead_days) || 30 }),
    ]);
    writeAudit(orgId, actorEmail, "org.settings.updated", "organization", org?.id, { after: draft });
    setSaving(false);
    setSaved(true);
    onSaved?.(draft);
  };

  return (
    <div style={{ maxWidth: 860 }}>
      <h2 style={{ ...serif, fontSize: 26, color: C.green, margin: "0 0 4px" }}>Organization Settings</h2>
      <p style={{ color: C.muted, margin: "0 0 28px", fontSize: 14 }}>Configure your organization's identity, branding, and default copy.</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}>
        {/* Left — form */}
        <div>
          {/* Identity */}
          <div style={card}>
            <h3 style={{ ...serif, fontSize: 17, margin: "0 0 20px", color: C.text }}>Identity</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <span style={lbl}>Organization Name</span>
                <input style={inp} value={draft.name} onChange={e => set("name", e.target.value)} placeholder="The Henderson Family" />
              </div>
              <div>
                <span style={lbl}>App Title</span>
                <input style={inp} value={draft.app_title} onChange={e => set("app_title", e.target.value)} placeholder="Your Family App" />
              </div>
            </div>
            <div>
              <span style={lbl}>App Emoji / Icon</span>
              <input style={{ ...inp, width: 80 }} value={draft.app_emoji} onChange={e => set("app_emoji", e.target.value)} />
            </div>
          </div>

          {/* Branding */}
          <div style={card}>
            <h3 style={{ ...serif, fontSize: 17, margin: "0 0 20px", color: C.text }}>Brand Colors</h3>
            <div style={{ marginBottom: 20 }}>
              <span style={lbl}>Primary Color (headers, buttons)</span>
              <ColorPicker value={draft.primary_color} onChange={v => set("primary_color", v)} />
            </div>
            <div>
              <span style={lbl}>Accent Color (highlights, badges)</span>
              <ColorPicker value={draft.accent_color} onChange={v => set("accent_color", v)} />
            </div>
          </div>

          {/* Submission Window */}
          <div style={card}>
            <h3 style={{ ...serif, fontSize: 17, margin: "0 0 8px", color: C.text }}>Submission Window</h3>
            <p style={{ fontSize: 13, color: C.muted, margin: "0 0 20px", lineHeight: 1.5 }}>How many days ahead families are asked to submit events. Defaults to 30.</p>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <span style={lbl}>Lookahead Days</span>
                <input
                  style={{ ...inp, width: 100 }}
                  type="number"
                  min="14"
                  max="180"
                  value={draft.lookahead_days}
                  onChange={e => set("lookahead_days", e.target.value)}
                />
              </div>
              <div style={{ fontSize: 13, color: C.muted, paddingTop: 18, lineHeight: 1.6 }}>
                Window: today → <strong>{(() => { const d = new Date(); d.setDate(d.getDate() + (parseInt(draft.lookahead_days) || 30)); return d.toLocaleDateString("en-US", { month: "long", day: "numeric" }); })()}</strong>
              </div>
            </div>
          </div>

          {/* Content */}
          <div style={card}>
            <h3 style={{ ...serif, fontSize: 17, margin: "0 0 20px", color: C.text }}>Default Copy</h3>
            <div style={{ marginBottom: 16 }}>
              <span style={lbl}>Digest Greeting</span>
              <input style={inp} value={draft.digest_greeting} onChange={e => set("digest_greeting", e.target.value)} placeholder="Hi Nana and Papa!" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <span style={lbl}>Digest Footer</span>
              <input style={inp} value={draft.digest_footer} onChange={e => set("digest_footer", e.target.value)} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <span style={lbl}>Digest Sign-off</span>
              <input style={inp} value={draft.digest_signoff} onChange={e => set("digest_signoff", e.target.value)} placeholder="Love, The Clayton Family" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <span style={lbl}>Monthly Prompt Body <span style={{ fontWeight: 400, textTransform: "none" }}>(use <code>{"{max30Label}"}</code> for the deadline date)</span></span>
              <textarea style={{ ...inp, resize: "vertical", minHeight: 90 }} value={draft.prompt_body} onChange={e => set("prompt_body", e.target.value)} />
            </div>
            <div>
              <span style={lbl}>Event Note Field Label</span>
              <input style={inp} value={draft.note_label} onChange={e => set("note_label", e.target.value)} placeholder="A Note for Nana & Papa (Optional)" />
            </div>
          </div>

          {/* Save */}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button onClick={handleSave} disabled={saving} style={{ padding: "11px 28px", borderRadius: 10, border: "none", backgroundColor: C.green, color: C.white, fontWeight: 700, fontSize: 13, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1, fontFamily: "'Lato', sans-serif" }}>
              {saving ? "Saving…" : "Save Changes"}
            </button>
            {saved && <span style={{ fontSize: 13, color: C.green, fontWeight: 700 }}>✓ Saved</span>}
          </div>
        </div>

        {/* Right — live preview */}
        <div style={{ position: "sticky", top: 24, alignSelf: "start" }}>
          <div style={{ ...card, marginBottom: 0, backgroundColor: draft.primary_color, color: C.white, textAlign: "center", padding: "28px 20px" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{draft.app_emoji || "🌿"}</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, marginBottom: 6 }}>{draft.digest_greeting || "Hi Nana and Papa!"}</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12, lineHeight: 1.5 }}>Here's what's coming up this month.</div>
            <div style={{ fontSize: 10, opacity: 0.55, letterSpacing: "1px", fontWeight: 700 }}>{draft.app_title?.toUpperCase() || "CLAYTON LINK"} · PREVIEW</div>
          </div>
          <div style={{ ...card, marginTop: 12, backgroundColor: C.cream, fontSize: 12, color: C.muted, lineHeight: 1.7, fontStyle: "italic" }}>
            "{draft.prompt_body?.replace("{max30Label}", "May 13") || "Preview of prompt body…"}"
          </div>
          <div style={{ ...card, marginTop: 0, textAlign: "center", fontSize: 12, color: draft.primary_color || C.green, fontWeight: 700 }}>
            {draft.digest_footer || "Footer text will appear here."}
          </div>
          <p style={{ fontSize: 11, color: C.muted, textAlign: "center" }}>Live preview of key copy</p>
        </div>
      </div>
    </div>
  );
}
