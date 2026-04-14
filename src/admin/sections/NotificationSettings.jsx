import { useState } from "react";
import { adminDb } from "../adminDb.js";
import { writeAudit } from "../adminUtils.js";

const C = {
  green: "#2C4A3E", greenLight: "#E8F0EE", terra: "#E8936A", terraLight: "#FDF0E8",
  terraBorder: "#F0B898", white: "#FFFFFF", cream: "#FDF8F2", text: "#2A2A2A",
  muted: "#7A7A7A", border: "#E8E0D6",
};
const serif = { fontFamily: "'Playfair Display', serif" };
const card  = { backgroundColor: C.white, borderRadius: 16, padding: 24, boxShadow: "0 2px 20px rgba(44,74,62,0.07)", border: `1px solid ${C.border}`, marginBottom: 20 };
const inp   = { width: "100%", padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontFamily: "'Lato', sans-serif", fontSize: 14, color: C.text, backgroundColor: C.white, outline: "none", boxSizing: "border-box" };
const lbl   = { display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.8px", color: C.muted, textTransform: "uppercase", marginBottom: 6 };

const IMPORTANCE_COLORS = { 3: C.green, 2: C.terra, 1: "#8B6F47" };
const IMPORTANCE_NAMES  = { 3: "Milestone (⭐⭐⭐)", 2: "1:1 Time (⭐⭐)", 1: "Group Event (⭐)" };

export default function NotificationSettings({ orgSettings, actorEmail }) {
  const [draft, setDraft] = useState({
    auto_nudge_enabled:   orgSettings?.auto_nudge_enabled   ?? true,
    nudge_day_of_month:   orgSettings?.nudge_day_of_month   ?? 1,
    nudge_hour_utc:       orgSettings?.nudge_hour_utc        ?? 15,
    max_events_per_child: orgSettings?.max_events_per_child ?? 2,
    min_notice_days:      orgSettings?.min_notice_days       ?? 14,
    ideal_notice_days:    orgSettings?.ideal_notice_days     ?? 30,
    importance_3_label:   orgSettings?.importance_3_label    || "Milestone",
    importance_2_label:   orgSettings?.importance_2_label    || "1:1 Time",
    importance_1_label:   orgSettings?.importance_1_label    || "Group Event",
    importance_3_msg:     orgSettings?.importance_3_msg      || "This is a once-in-a-lifetime moment — we'd love you there.",
    importance_2_msg:     orgSettings?.importance_2_msg      || "This is a chance for just you two — it would mean everything to them.",
    importance_1_msg:     orgSettings?.importance_1_msg      || "Come cheer with the whole family!",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  const set = (k, v) => { setDraft(d => ({ ...d, [k]: v })); setSaved(false); };

  async function handleSave() {
    setSaving(true);
    await adminDb.updateOrgSettings(draft);
    writeAudit(actorEmail, "org_settings.updated", "org_settings", null, { after: draft });
    setSaving(false);
    setSaved(true);
  }

  const utcHourLabel = h => {
    const d = new Date(); d.setUTCHours(h, 0, 0, 0);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <h2 style={{ ...serif, fontSize: 26, color: C.green, margin: "0 0 4px" }}>Notification Settings</h2>
      <p style={{ color: C.muted, margin: "0 0 28px", fontSize: 14 }}>Configure the monthly nudge schedule, event rules, and importance level labels.</p>

      {/* Cron notice */}
      <div style={{ ...card, backgroundColor: C.terraLight, border: `1.5px solid ${C.terraBorder}`, padding: "14px 18px" }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: C.terra, marginBottom: 4 }}>📅 Cron Schedule Note</div>
        <p style={{ margin: 0, fontSize: 13, color: C.text, lineHeight: 1.6 }}>
          The actual Vercel cron fires on the <strong>1st of every month at 15:00 UTC</strong> — that's hardcoded in <code>vercel.json</code>. The day and hour settings below control the app messaging and future scheduling features, but changing them here won't move the actual cron trigger. Contact your developer to update the cron schedule.
        </p>
      </div>

      {/* Nudge settings */}
      <div style={card}>
        <h3 style={{ ...serif, fontSize: 17, margin: "0 0 20px" }}>Monthly Nudge</h3>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>Auto Monthly Prompt</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
              {draft.auto_nudge_enabled ? "Cron job emails all families on schedule." : "Auto email is paused — send manually."}
            </div>
          </div>
          <button onClick={() => set("auto_nudge_enabled", !draft.auto_nudge_enabled)} style={{ width: 52, height: 28, borderRadius: 14, border: "none", cursor: "pointer", backgroundColor: draft.auto_nudge_enabled ? C.green : C.border, position: "relative", flexShrink: 0, transition: "background-color 0.2s" }}>
            <span style={{ position: "absolute", top: 3, left: draft.auto_nudge_enabled ? 26 : 4, width: 22, height: 22, borderRadius: "50%", backgroundColor: C.white, transition: "left 0.2s", display: "block", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <span style={lbl}>Nudge Day of Month</span>
            <input style={inp} type="number" min={1} max={28} value={draft.nudge_day_of_month} onChange={e => set("nudge_day_of_month", parseInt(e.target.value) || 1)} />
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>1–28 (avoid 29–31 for all months)</div>
          </div>
          <div>
            <span style={lbl}>Hour (UTC)</span>
            <select style={{ ...inp }} value={draft.nudge_hour_utc} onChange={e => set("nudge_hour_utc", parseInt(e.target.value))}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{String(h).padStart(2, "0")}:00 UTC — {utcHourLabel(h)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Event rules */}
      <div style={card}>
        <h3 style={{ ...serif, fontSize: 17, margin: "0 0 20px" }}>Event Rules</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <div>
            <span style={lbl}>Max Events Per Child</span>
            <input style={inp} type="number" min={1} max={10} value={draft.max_events_per_child} onChange={e => set("max_events_per_child", parseInt(e.target.value) || 1)} />
          </div>
          <div>
            <span style={lbl}>Min Notice (days)</span>
            <input style={inp} type="number" min={1} max={90} value={draft.min_notice_days} onChange={e => set("min_notice_days", parseInt(e.target.value) || 1)} />
          </div>
          <div>
            <span style={lbl}>Ideal Notice (days)</span>
            <input style={inp} type="number" min={1} max={180} value={draft.ideal_notice_days} onChange={e => set("ideal_notice_days", parseInt(e.target.value) || 1)} />
          </div>
        </div>
      </div>

      {/* Importance level labels */}
      <div style={card}>
        <h3 style={{ ...serif, fontSize: 17, margin: "0 0 8px" }}>Priority Level Labels & Messages</h3>
        <p style={{ fontSize: 13, color: C.muted, margin: "0 0 20px", lineHeight: 1.6 }}>Customize how priority levels appear and what message is shown to recipients when they RSVP.</p>
        {[3, 2, 1].map(level => (
          <div key={level} style={{ borderLeft: `4px solid ${IMPORTANCE_COLORS[level]}`, paddingLeft: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: IMPORTANCE_COLORS[level], marginBottom: 10 }}>{IMPORTANCE_NAMES[level]}</div>
            <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12, alignItems: "start" }}>
              <div>
                <span style={lbl}>Label</span>
                <input style={inp} value={draft[`importance_${level}_label`]} onChange={e => set(`importance_${level}_label`, e.target.value)} />
              </div>
              <div>
                <span style={lbl}>RSVP Message</span>
                <textarea style={{ ...inp, resize: "vertical", minHeight: 58 }} value={draft[`importance_${level}_msg`]} onChange={e => set(`importance_${level}_msg`, e.target.value)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Save */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button onClick={handleSave} disabled={saving} style={{ padding: "11px 28px", borderRadius: 10, border: "none", backgroundColor: C.green, color: C.white, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Lato', sans-serif", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Saving…" : "Save Settings"}
        </button>
        {saved && <span style={{ fontSize: 13, color: C.green, fontWeight: 700 }}>✓ Saved</span>}
      </div>
    </div>
  );
}
