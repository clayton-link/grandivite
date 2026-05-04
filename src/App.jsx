import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { adminDb } from "./admin/adminDb.js";

// ── SUPABASE CONFIG ───────────────────────────────────────────────────────────
// Get these from: supabase.com → your project → Settings → API
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// ─────────────────────────────────────────────────────────────────────────────

// ── GOOGLE MAPS CONFIG ────────────────────────────────────────────────────────
// Get from: console.cloud.google.com → APIs & Services → Credentials
// Enable: "Places API (New)" and "Maps JavaScript API" for this key
// Restrict key to your domain for security
const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  cream: "#FDFCFA", green: "#2C5F5A", greenLight: "#E5F0EF",
  terra: "#E07A5F", terraLight: "#FDEEE9", terraBorder: "#F0B898",
  brown: "#8B6F47", brownLight: "#F5EDE3", brownBorder: "#C4A882",
  greenBorder: "#A8C9C6", white: "#FFFFFF", text: "#1A2A28",
  muted: "#6B7B79", border: "#E2DAD4", red: "#C0392B", redLight: "#FDECEA",
  family: "#6B5B8A", familyLight: "#F0EDF8", familyBorder: "#C4B8E0",
};

// No hardcoded families or coordinator emails — all loaded from DB at runtime
const BLANK_ROW        = () => ({ childName: "", eventName: "", date: "", time: "", location: "", lat: null, lng: null, importance: "", notes: "", isFamilyEvent: false });
const BLANK_FAMILY_ROW = () => ({ childName: "", eventName: "", date: "", time: "", location: "", lat: null, lng: null, importance: 1,  notes: "", isFamilyEvent: true  });

// Resolve a signed-in Google email to a role + family using DB-loaded data
function resolveAuth(email, fams = [], coordEmails = []) {
  if (!email) return null;
  const lower = email.toLowerCase();
  const family = fams.find(f => f.emails.map(e => e.toLowerCase()).includes(lower));
  if (coordEmails.map(e => e.toLowerCase()).includes(lower)) return { role: "coordinator", family: family || null };
  if (family) return { role: "family", family };
  return null;
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function impInfo(level) {
  if (level === 3) return { label: "Milestone",   stars: "⭐⭐⭐", color: C.green, bg: C.greenLight, border: C.greenBorder, msg: "This is a once-in-a-lifetime moment — we'd love you there." };
  if (level === 2) return { label: "1:1 Time",    stars: "⭐⭐",   color: C.terra, bg: C.terraLight, border: C.terraBorder, msg: "This is a chance for just you two — it would mean everything to them." };
  return              { label: "Group Event", stars: "⭐",     color: C.brown, bg: C.brownLight, border: C.brownBorder, msg: "Come cheer with the whole family!" };
}
function familyInfo() {
  return { label: "Family Event", stars: "🎉", color: C.family, bg: C.familyLight, border: C.familyBorder, msg: "You're invited — we'd love for you to join us!" };
}

const formatDate  = d => d ? new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "long",  month: "long",  day: "numeric" }) : "";
const formatShort = d => d ? new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

// Dynamic window from today — lookaheadDays is org-configurable (default 30)
function getWindowDates(lookaheadDays = 30) {
  const today = new Date();
  const min14 = new Date(today); min14.setDate(today.getDate() + 14);
  const maxN  = new Date(today); maxN.setDate(today.getDate() + lookaheadDays);
  const fmtShort = d => d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  return {
    today,
    min14Label:  fmtShort(min14),
    max30Label:  fmtShort(maxN),
    windowLabel: `${fmtShort(today)} – ${fmtShort(maxN)}`,
    monthLabel:  today.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  };
}

// Generate and download an .ics calendar file for a single event
function addToCalendar(ev) {
  const e = norm(ev);
  const dateStr = e.date.replace(/-/g, "");
  // Parse time or default to all-day
  let dtStart, dtEnd;
  if (e.time) {
    const [timePart, meridiem] = e.time.split(" ");
    let [hours, minutes] = timePart.split(":").map(Number);
    if (meridiem?.toLowerCase() === "pm" && hours !== 12) hours += 12;
    if (meridiem?.toLowerCase() === "am" && hours === 12) hours = 0;
    const hh = String(hours).padStart(2, "0");
    const mm = String(minutes || 0).padStart(2, "0");
    dtStart = `${dateStr}T${hh}${mm}00`;
    // Default 1 hour duration
    const endHours = String(hours + 1).padStart(2, "0");
    dtEnd = `${dateStr}T${endHours}${mm}00`;
  } else {
    dtStart = dateStr;
    dtEnd = dateStr;
  }
  const isAllDay = !e.time;
  const dtProp = isAllDay ? `DTSTART;VALUE=DATE:${dtStart}\nDTEND;VALUE=DATE:${dtEnd}` : `DTSTART:${dtStart}\nDTEND:${dtEnd}`;
  const location = e.location ? `LOCATION:${e.location}` : "";
  const description = e.notes ? `DESCRIPTION:${e.notes}` : "";
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-////EN",
    "BEGIN:VEVENT",
    `UID:${e.id}@grandivite.com`,
    dtProp,
    `SUMMARY:${e.isFamilyEvent ? e.eventName : `${e.childName}'s ${e.eventName}`}`,
    location,
    description,
    "END:VEVENT",
    "END:VCALENDAR"
  ].filter(Boolean).join("\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `${e.childName}-${e.eventName}.ics`.replace(/[^a-z0-9.-]/gi, "-");
  a.click();
  URL.revokeObjectURL(url);
}

// Open Google Calendar event creation page with event pre-filled
function addToGoogleCalendar(ev) {
  const e = norm(ev);
  const dateStr = e.date.replace(/-/g, "");
  let dates;
  if (e.time) {
    const [timePart, meridiem] = e.time.split(" ");
    let [hours, minutes] = timePart.split(":").map(Number);
    if (meridiem?.toLowerCase() === "pm" && hours !== 12) hours += 12;
    if (meridiem?.toLowerCase() === "am" && hours === 12) hours = 0;
    const hh  = String(hours).padStart(2, "0");
    const mm  = String(minutes || 0).padStart(2, "0");
    const ehh = String(hours + 1).padStart(2, "0");
    dates = `${dateStr}T${hh}${mm}00/${dateStr}T${ehh}${mm}00`;
  } else {
    // All day — end date is next day
    const next = new Date(e.date + "T12:00:00");
    next.setDate(next.getDate() + 1);
    const nextStr = next.toISOString().slice(0,10).replace(/-/g,"");
    dates = `${dateStr}/${nextStr}`;
  }
  const params = new URLSearchParams({
    action:   "TEMPLATE",
    text:     e.isFamilyEvent ? e.eventName : `${e.childName}'s ${e.eventName}`,
    dates,
    details:  e.notes || `From ${e.family || "the family"} — grandivite.com`,
    location: e.location || "",
  });
  window.open(`https://calendar.google.com/calendar/r/eventedit?${params.toString()}`, "_blank");
}
function openMapsLink(url) {
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    window.location.href = url;
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

const serif = { fontFamily: "'Playfair Display', serif" };
const card  = { backgroundColor: C.white, borderRadius: 16, padding: 24, boxShadow: "0 2px 20px rgba(44,74,62,0.07)", border: `1px solid ${C.border}`, marginBottom: 16 };

function useIsMobile(breakpoint = 540) {
  const [mob, setMob] = useState(() => typeof window !== "undefined" && window.innerWidth < breakpoint);
  useEffect(() => {
    const fn = () => setMob(window.innerWidth < breakpoint);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, [breakpoint]);
  return mob;
}
const inp   = { width: "100%", padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontFamily: "'Lato', sans-serif", fontSize: 14, color: C.text, backgroundColor: C.white, outline: "none", boxSizing: "border-box" };
const lbl   = { display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.8px", color: C.muted, textTransform: "uppercase", marginBottom: 6 };

// Normalize DB row (snake_case) → consistent camelCase shape used in UI
// familiesRef is optional — if provided, resolves family name from id
function norm(ev, familiesRef = []) {
  return {
    ...ev,
    childName:     ev.child_name      || ev.childName      || "",
    eventName:     ev.event_name      || ev.eventName      || "",
    familyId:      ev.family_id       || ev.familyId,
    isFamilyEvent: ev.is_family_event || ev.isFamilyEvent  || false,
    family:    (() => {
      const fid = ev.family_id || ev.familyId;
      const f = familiesRef.find(f => f.id === fid);
      return f ? f.name.split(" ").slice(0, 3).join(" ") : (ev.family_name || ev.family || "");
    })(),
  };
}

// ── SUPABASE DATA LAYER ───────────────────────────────────────────────────────
const db = {
  fetchCycle: async (orgId) => {
    const { data } = await supabase.from("cycles").select("*").eq("org_id", orgId).is("closed_at", null).order("created_at", { ascending: false }).limit(1).single();
    return data;
  },
  fetchAllCycles: async (orgId) => {
    const { data } = await supabase.from("cycles").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
    return data || [];
  },
  fetchEvents: async (cycleId) => {
    const { data } = await supabase.from("events").select("*").eq("cycle_id", cycleId);
    return data || [];
  },
  fetchRsvps: async () => {
    const { data } = await supabase.from("rsvps").select("*");
    return (data || []).reduce((acc, r) => { acc[r.event_id] = r.status; return acc; }, {});
  },
  insertEvent: async (cycleId, familyId, familyName, row) => {
    const { data } = await supabase.from("events").insert({
      cycle_id: cycleId, family_id: familyId, family_name: familyName,
      child_name: row.childName || null, event_name: row.eventName, date: row.date,
      time: row.time || null, location: row.location || null,
      lat: row.lat || null, lng: row.lng || null,
      importance: parseInt(row.importance) || 1, notes: row.notes || null,
      is_family_event: row.isFamilyEvent || false,
    }).select().single();
    return data;
  },
  updateEvent: async (id, fields) => {
    await supabase.from("events").update({
      child_name: fields.childName || null, event_name: fields.eventName, date: fields.date,
      time: fields.time || null, location: fields.location || null,
      lat: fields.lat || null,   lng: fields.lng || null,
      importance: parseInt(fields.importance) || 1, notes: fields.notes || null,
      is_family_event: fields.isFamilyEvent || false,
    }).eq("id", id);
  },
  deleteEvent: async (id) => { await supabase.from("events").delete().eq("id", id); },
  upsertRsvp: async (eventId, status) => {
    if (!status) { await supabase.from("rsvps").delete().eq("event_id", eventId); }
    else { await supabase.from("rsvps").upsert({ event_id: eventId, status, updated_at: new Date().toISOString() }, { onConflict: "event_id" }); }
  },
  updateCycle: async (id, fields) => { await supabase.from("cycles").update(fields).eq("id", id); },
  resetCycle:  async (cycleId) => {
    await supabase.from("events").delete().eq("cycle_id", cycleId);
    await supabase.from("cycles").update({ locked: false, digest_sent: false }).eq("id", cycleId);
  },
  fetchFutureEvents: async (cycleId) => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
    const { data } = await supabase.from("events").select("*").eq("cycle_id", cycleId).gte("date", todayStr);
    return data || [];
  },
  fetchSettings: async () => {
    const { data } = await supabase.from("settings").select("auto_nudge_enabled").eq("id", 1).single();
    return data;
  },
  updateSettings: async (fields) => {
    await supabase.from("settings").update(fields).eq("id", 1);
  },
  fetchFamilyRsvps: async () => {
    const { data } = await supabase.from("family_rsvps").select("*");
    return (data || []).reduce((acc, r) => {
      if (!acc[r.event_id]) acc[r.event_id] = {};
      acc[r.event_id][r.family_id] = r.status;
      return acc;
    }, {});
  },
  upsertFamilyRsvp: async (eventId, familyId, status) => {
    if (!status) { await supabase.from("family_rsvps").delete().eq("event_id", eventId).eq("family_id", familyId); }
    else { await supabase.from("family_rsvps").upsert({ event_id: eventId, family_id: familyId, status, updated_at: new Date().toISOString() }, { onConflict: "event_id,family_id" }); }
  },
};

// ── UI PRIMITIVES ─────────────────────────────────────────────────────────────
function Btn({ children, variant = "primary", onClick, disabled, full, style = {} }) {
  const base = { padding: "11px 22px", borderRadius: 10, border: "none", cursor: disabled ? "not-allowed" : "pointer", fontFamily: "'Lato', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: "0.4px", transition: "opacity 0.2s", opacity: disabled ? 0.5 : 1, width: full ? "100%" : "auto" };
  const vs = {
    primary: { backgroundColor: C.green,  color: C.white },
    accent:  { backgroundColor: C.terra,  color: C.white },
    outline: { backgroundColor: "transparent", color: C.green, border: `2px solid ${C.green}` },
    ghost:   { backgroundColor: "transparent", color: C.muted, border: `1.5px solid ${C.border}` },
    danger:  { backgroundColor: "transparent", color: C.red,   border: `1.5px solid ${C.red}` },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...vs[variant], ...style }}>{children}</button>;
}

function Badge({ level, isFamilyEvent, size = "md" }) {
  const i = isFamilyEvent ? familyInfo() : impInfo(level);
  return <span style={{ backgroundColor: i.bg, color: i.color, border: `1px solid ${i.border}`, borderRadius: 20, padding: size === "sm" ? "3px 10px" : "5px 14px", fontSize: size === "sm" ? 11 : 12, fontWeight: 700, whiteSpace: "nowrap", display: "inline-block" }}>{i.stars} {i.label}</span>;
}

function Spinner() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: C.green, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 36 }}>🌿</div>
      <div style={{ color: C.white, fontSize: 15, fontFamily: "'Lato', sans-serif", opacity: 0.8 }}>Loading Grandivite…</div>
    </div>
  );
}

function EditModal({ event, onSave, onClose, familyChildren, noteLabel = "A Note for Nana & Papa (Optional)" }) {
  const isMobile = useIsMobile();
  const e = norm(event);
  const [draft, setDraft] = useState({
    childName:     e.childName,
    eventName:     e.eventName,
    date:          e.date,
    time:          e.time || "",
    location:      e.location || "",
    lat:           e.lat ?? null,
    lng:           e.lng ?? null,
    importance:    e.importance || "",
    notes:         e.notes || "",
    isFamilyEvent: e.isFamilyEvent || false,
  });

  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const valid = draft.isFamilyEvent ? (draft.eventName && draft.date) : (draft.childName && draft.eventName && draft.date && draft.importance);

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ backgroundColor: C.white, borderRadius: 20, padding: isMobile ? 18 : 28, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 style={{ ...serif, fontSize: 22, margin: 0, color: C.green }}>Edit Event</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.muted }}>✕</button>
        </div>

        {draft.isFamilyEvent ? (
          <div style={{ marginBottom: 16, padding: "10px 14px", backgroundColor: C.familyLight, borderRadius: 8, fontSize: 13, color: C.family, fontWeight: 600 }}>🎉 Family / Holiday Event</div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <span style={lbl}>Child's Name</span>
            {familyChildren?.length > 0 ? (
              <select style={inp} value={draft.childName} onChange={e => set("childName", e.target.value)}>
                <option value="">Select child...</option>
                {familyChildren.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="All kids">All kids</option>
              </select>
            ) : (
              <input style={inp} value={draft.childName} onChange={e => set("childName", e.target.value)} />
            )}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <span style={lbl}>{draft.isFamilyEvent ? "Event / Occasion" : "Event / Activity"}</span>
          <input style={inp} value={draft.eventName} onChange={e => set("eventName", e.target.value)} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <span style={lbl}>Date</span>
          <input style={{ ...inp, display: "block", width: "100%" }} type="date" value={draft.date} onChange={e => set("date", e.target.value)} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <span style={lbl}>Time (Optional)</span>
          <input style={inp} value={draft.time} onChange={e => set("time", e.target.value)} placeholder="e.g. 6:30 PM" />
        </div>

        <div style={{ marginBottom: 16 }}>
          <span style={lbl}>Location (Optional)</span>
          <PlacesInput
            value={draft.location}
            lat={draft.lat}
            lng={draft.lng}
            onChange={(label, lat, lng) => {
              set("location", label);
              set("lat", lat);
              set("lng", lng);
            }}
          />
        </div>

        {!draft.isFamilyEvent && (
          <div style={{ marginBottom: 16 }}>
            <span style={lbl}>Priority</span>
            <select style={inp} value={draft.importance} onChange={e => set("importance", e.target.value)}>
              <option value="">Select priority...</option>
              <option value="3">⭐⭐⭐ Milestone</option>
              <option value="2">⭐⭐ Intentional 1:1 Time</option>
              <option value="1">⭐ Group Event</option>
            </select>
          </div>
        )}

        <div style={{ marginBottom: 24 }}>
          <NotesField
            label={draft.isFamilyEvent ? "Details for grandparents (Optional)" : noteLabel}
            value={draft.notes}
            onChange={v => set("notes", v)}
            childName={draft.childName}
            eventName={draft.eventName}
            importance={draft.importance}
          />
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="accent" disabled={!valid} onClick={() => { onSave({ ...event, ...draft }); onClose(); }}>Save Changes</Btn>
        </div>
      </div>
    </div>
  );
}


// ── AI DIGEST DRAFT MODAL ─────────────────────────────────────────────────────
function DigestDraftModal({ draft, onDraftChange, onSend, onClose, isMobile }) {
  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ backgroundColor: C.white, borderRadius: 20, padding: isMobile ? 18 : 28, width: "100%", maxWidth: 540, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h3 style={{ ...serif, fontSize: 22, margin: 0, color: C.green }}>✨ AI Digest Draft</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.muted }}>✕</button>
        </div>
        <p style={{ fontSize: 13, color: C.muted, margin: "0 0 14px", lineHeight: 1.5 }}>Edit below, then open in your email client to send.</p>
        <textarea
          value={draft}
          onChange={e => onDraftChange(e.target.value)}
          style={{ flex: 1, minHeight: 280, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", fontFamily: "'Lato', sans-serif", fontSize: 14, color: C.text, lineHeight: 1.7, resize: "vertical", outline: "none" }}
        />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="accent" onClick={onSend}>📧 Open in Email</Btn>
        </div>
      </div>
    </div>
  );
}

// ── AI NUDGE DRAFTS MODAL ─────────────────────────────────────────────────────
function NudgeDraftsModal({ drafts, onDraftChange, pendingFamilies, onClose, isMobile }) {
  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ backgroundColor: C.white, borderRadius: 20, padding: isMobile ? 18 : 28, width: "100%", maxWidth: 560, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h3 style={{ ...serif, fontSize: 22, margin: 0, color: C.green }}>✨ AI Nudge Drafts</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.muted }}>✕</button>
        </div>
        <p style={{ fontSize: 13, color: C.muted, margin: "0 0 16px", lineHeight: 1.5 }}>Personalized for each family. Edit and open to send.</p>
        <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
          {pendingFamilies.map(f => (
            <div key={f.id} style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 8 }}>{f.name}</div>
              <textarea
                value={drafts[f.name] || ""}
                onChange={e => onDraftChange(f.name, e.target.value)}
                style={{ width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", fontFamily: "'Lato', sans-serif", fontSize: 13, color: C.text, lineHeight: 1.7, resize: "vertical", minHeight: 100, boxSizing: "border-box", outline: "none" }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <Btn variant="accent" style={{ padding: "6px 14px", fontSize: 12 }} onClick={() => {
                  const to      = encodeURIComponent(f.emails.join(","));
                  const subject = encodeURIComponent("Quick heads up — events due soon");
                  const body    = encodeURIComponent(drafts[f.name] || "");
                  window.open(`mailto:${to}?subject=${subject}&body=${body}`);
                }}>📧 Open</Btn>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <Btn variant="ghost" onClick={onClose}>Done</Btn>
        </div>
      </div>
    </div>
  );
}

// ── SMART NOTES FIELD ─────────────────────────────────────────────────────────
function NotesField({ value, onChange, label, placeholder, childName, eventName, importance }) {
  const [loading, setLoading] = useState(false);
  const [original, setOriginal] = useState(null);

  const handlePolish = async () => {
    if (!value?.trim() || !childName || !eventName || !importance) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/polish-note", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
        body: JSON.stringify({ childName, eventName, importance: parseInt(importance), note: value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setOriginal(value);
      onChange(json.polished);
    } catch (err) {
      console.error("Polish error:", err);
      alert(`Couldn't polish the note — ${err.message || "try again."}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => { setOriginal(null); onChange(e.target.value); };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={lbl}>{label}</span>
        {original !== null && (
          <button onClick={() => { onChange(original); setOriginal(null); }} style={{ background: "none", border: "none", fontSize: 12, color: C.muted, cursor: "pointer", padding: 0, textDecoration: "underline", fontFamily: "'Lato', sans-serif" }}>↩ Undo</button>
        )}
      </div>
      <div style={{ position: "relative" }}>
        <textarea style={{ ...inp, resize: "vertical", minHeight: 72 }} placeholder={placeholder} value={value} onChange={handleChange} />
        {value?.trim() && (
          <button
            disabled={loading || !childName || !eventName || !importance}
            onClick={handlePolish}
            style={{ position: "absolute", bottom: 8, right: 8, backgroundColor: loading ? C.border : C.green, border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: loading ? C.muted : C.white, cursor: (loading || !childName || !eventName || !importance) ? "default" : "pointer", fontFamily: "'Lato', sans-serif" }}
          >
            {loading ? "Polishing…" : "✨ Polish"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── GOOGLE PLACES AUTOCOMPLETE ────────────────────────────────────────────────
let googleMapsScriptPromise = null;

function loadGoogleMapsPlacesScript() {
  if (window.google?.maps?.places) return Promise.resolve(window.google);
  if (googleMapsScriptPromise) return googleMapsScriptPromise;

  googleMapsScriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById("google-maps-script");

    if (existing) {
      existing.addEventListener("load", () => resolve(window.google));
      existing.addEventListener("error", () => reject(new Error("Google Maps script failed to load.")));
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.maps?.places) resolve(window.google);
      else reject(new Error("Google Maps loaded, but Places library was not available."));
    };
    script.onerror = () => reject(new Error("Google Maps script failed to load."));
    document.head.appendChild(script);
  });

  return googleMapsScriptPromise;
}

function usePlacesAutocomplete(inputRef, onSelect) {
  const autocompleteRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    let listener = null;

    async function init() {
      try {
        await loadGoogleMapsPlacesScript();

        if (!isMounted || !inputRef.current || !window.google?.maps?.places) return;
        if (autocompleteRef.current) return;

        const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
          types: ["establishment", "geocode"],
          componentRestrictions: { country: "us" },
          fields: ["formatted_address", "name", "geometry", "place_id", "vicinity"],
        });

        autocompleteRef.current = ac;
        listener = ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          const name = place?.name || "";
          const addr = place?.formatted_address || place?.vicinity || "";
          const label = name && addr && !addr.startsWith(name) ? `${name}, ${addr}` : (addr || name);
          const lat = place?.geometry?.location?.lat?.() ?? null;
          const lng = place?.geometry?.location?.lng?.() ?? null;
          onSelect(label, lat, lng, place);
        });
      } catch (err) {
        console.error("Google Places init failed:", err);
      }
    }

    init();

    return () => {
      isMounted = false;
      if (listener?.remove) listener.remove();
    };
  }, [inputRef, onSelect]);
}

function PlacesInput({ value, lat, lng, onChange, placeholder = "e.g. Heartland Elementary" }) {
  const ref = useRef(null);

  usePlacesAutocomplete(ref, (label, plat, plng) => {
    onChange(label, plat, plng);
  });

  const hasConfirmedLocation = lat !== null && lng !== null;

  return (
    <div style={{ position: "relative" }}>
      <input
        ref={ref}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value, null, null)}
        style={{ ...inp, paddingRight: 34 }}
        autoComplete="off"
      />
      {hasConfirmedLocation && (
        <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14 }} title="Location confirmed">📍</span>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

function AuthScreen() {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [email, setEmail]                 = useState("");
  const [magicSent, setMagicSent]         = useState(false);
  const [magicLoading, setMagicLoading]   = useState(false);
  const [magicError, setMagicError]       = useState("");

  const signInGoogle = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      console.error("Google sign-in failed:", error);
      setGoogleLoading(false);
    }
  };

  const sendMagicLink = async () => {
    if (!email.trim()) return;
    const recognized = resolveAuth(email.trim().toLowerCase());
    if (!recognized) {
      setMagicError("That email isn't linked to a Grandivite organization. Contact your organization admin.");
      return;
    }
    setMagicLoading(true);
    setMagicError("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setMagicLoading(false);
    if (error) { setMagicError("Something went wrong. Try again or contact Chris."); }
    else { setMagicSent(true); }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: C.green, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ backgroundColor: C.white, borderRadius: 24, padding: "44px 36px", maxWidth: 400, width: "100%", textAlign: "center", boxShadow: "0 24px 80px rgba(0,0,0,0.25)" }}>
        <div style={{ fontSize: 40, marginBottom: 14 }}>🌿</div>
        <h1 style={{ ...serif, fontSize: 28, color: C.green, margin: "0 0 6px" }}>Grandivite</h1>
        <p style={{ color: C.muted, fontSize: 13, margin: "0 0 28px", lineHeight: 1.6 }}>Sign in to access your family page</p>

        <button onClick={signInGoogle} disabled={googleLoading} style={{ width: "100%", padding: "13px 20px", borderRadius: 10, border: `1.5px solid ${C.border}`, backgroundColor: C.white, cursor: googleLoading ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, fontFamily: "'Lato', sans-serif", fontWeight: 700, fontSize: 14, color: C.text, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", marginBottom: 20 }}>
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.4-5l-6.2-5.2C29.4 35.6 26.8 36 24 36c-5.2 0-9.5-2.9-11.3-7L6 34.3C9.4 40 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.5-2.6 4.6-4.8 6l6.2 5.2C40.8 35.6 44 30.2 44 24c0-1.3-.1-2.7-.4-4z"/></svg>
          {googleLoading ? "Signing in..." : "Continue with Google"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, backgroundColor: C.border }} />
          <span style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>OR</span>
          <div style={{ flex: 1, height: 1, backgroundColor: C.border }} />
        </div>

        {!magicSent ? (
          <>
            <p style={{ fontSize: 13, color: C.muted, margin: "0 0 12px", lineHeight: 1.5 }}>No Google account? Enter your email and we'll send a sign-in link.</p>
            <input type="email" placeholder="your@email.com" value={email}
              onChange={e => { setEmail(e.target.value); setMagicError(""); }}
              onKeyDown={e => e.key === "Enter" && sendMagicLink()}
              style={{ ...inp, marginBottom: 10, textAlign: "center" }} />
            {magicError && <p style={{ color: C.red, fontSize: 12, margin: "0 0 10px" }}>{magicError}</p>}
            <Btn variant="primary" full onClick={sendMagicLink} disabled={magicLoading || !email.trim()} style={{ padding: 13 }}>
              {magicLoading ? "Sending..." : "Send Sign-In Link"}
            </Btn>
          </>
        ) : (
          <div style={{ backgroundColor: C.greenLight, border: `1.5px solid ${C.green}`, borderRadius: 12, padding: "20px 16px" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>📬</div>
            <p style={{ color: C.green, fontWeight: 700, fontSize: 15, margin: "0 0 6px" }}>Check your email!</p>
            <p style={{ color: C.green, fontSize: 13, margin: 0, lineHeight: 1.6 }}>We sent a sign-in link to <strong>{email}</strong>. Tap the link to continue.</p>
            <button onClick={() => { setMagicSent(false); setEmail(""); }} style={{ background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer", marginTop: 12 }}>Use a different email</button>
          </div>
        )}
        <p style={{ color: C.muted, fontSize: 11, marginTop: 20, lineHeight: 1.6 }}>Questions? Contact your organization admin.</p>
      </div>
    </div>
  );
}

function EventCard({ ev, canEdit, onEdit, onRemove, locked, isConflict = false }) {
  const e = norm(ev);
  const info = e.isFamilyEvent ? familyInfo() : impInfo(e.importance);
  return (
    <div style={{ display: "flex", gap: 14, padding: "16px 12px", borderBottom: `1px solid ${C.border}`, alignItems: "flex-start", backgroundColor: isConflict ? "#FFFAF4" : "transparent", borderLeft: isConflict ? `4px solid ${C.terra}` : "4px solid transparent", margin: "0 -12px" }}>
      <div style={{ minWidth: 76, flexShrink: 0, backgroundColor: info.bg, color: info.color, borderRadius: 8, padding: "6px 8px", fontSize: 9, fontWeight: 700, textAlign: "center", lineHeight: 1.6 }}>{info.stars}<br />{info.label}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{e.isFamilyEvent ? e.eventName : `${e.childName} — ${e.eventName}`}</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>{formatDate(e.date)}{e.time ? ` · ${e.time}` : ""}</div>
        {e.location && <div style={{ fontSize: 12, marginBottom: 4 }}><a href="#" onClick={e2 => { e2.preventDefault(); openMapsLink(e.lat && e.lng ? `https://www.google.com/maps?q=${e.lat},${e.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.location)}`); }} style={{ color: C.terra, textDecoration: "none", fontWeight: 600, cursor: "pointer" }}>📍 {e.location}</a></div>}
        {e.notes && <div style={{ fontSize: 13, color: C.text, fontStyle: "italic", lineHeight: 1.5 }}>"{e.notes}"</div>}
        {e.family && <div style={{ fontSize: 11, color: C.muted, marginTop: 4, fontWeight: 700, letterSpacing: "0.4px" }}>FROM {e.family.toUpperCase()}</div>}
        {isConflict && <div style={{ fontSize: 11, color: C.terra, fontWeight: 700, marginTop: 3 }}>⚠️ Another family has an event this day</div>}
      </div>
      {canEdit && !locked && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
          <button onClick={() => onEdit(ev)} title="Edit"
            style={{ background: "none", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "5px 9px", cursor: "pointer", fontSize: 13, color: C.muted, lineHeight: 1 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.green; e.currentTarget.style.color = C.green; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; }}>✏️</button>
          <button onClick={() => onRemove(ev.id)} title="Remove"
            style={{ background: "none", border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "5px 9px", cursor: "pointer", fontSize: 13, color: C.muted, lineHeight: 1 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.red; e.currentTarget.style.color = C.red; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; }}>✕</button>
        </div>
      )}
    </div>
  );
}

function CalendarView({ events, rsvpMap = {}, families = [] }) {
  const isMobile = useIsMobile();
  const famColors = Object.fromEntries(families.map(f => [f.id, f.color]));

  const normEvs = events.map(ev => norm(ev));
  const byDate = {};
  normEvs.forEach(ev => {
    if (!ev.date) return;
    if (!byDate[ev.date]) byDate[ev.date] = [];
    byDate[ev.date].push(ev);
  });

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const todayYM  = todayStr.slice(0, 7);

  const allDates = normEvs.map(e => e.date).filter(Boolean).sort();
  const minYM = allDates.length > 0 ? allDates[0].slice(0, 7) : todayYM;
  const maxYM = allDates.length > 0 ? allDates[allDates.length - 1].slice(0, 7) : todayYM;

  const [viewYM, setViewYM]           = useState(minYM);
  const [selectedDay, setSelectedDay] = useState(null);
  const [hasNavigated, setHasNavigated] = useState(false);

  useEffect(() => {
    if (!hasNavigated) setViewYM(minYM);
  }, [minYM]);

  const [vy, vm] = viewYM.split("-").map(Number);
  const daysInMonth = new Date(vy, vm, 0).getDate();
  const startDow    = new Date(vy, vm - 1, 1).getDay();
  const cells = [...Array(startDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const monthLabel = new Date(vy, vm - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  function changeMonth(delta) {
    setHasNavigated(true);
    const d = new Date(vy, vm - 1 + delta, 1);
    setViewYM(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setSelectedDay(null);
  }

  const selectedEvs = selectedDay ? (byDate[selectedDay] || []) : [];
  const sortedAll   = [...normEvs].sort((a, b) => a.date.localeCompare(b.date));
  const DAY_NAMES   = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const navBtnStyle = (disabled) => ({
    background: "none", border: `1.5px solid ${disabled ? C.border : C.green}`,
    borderRadius: 8, padding: isMobile ? "5px 11px" : "6px 14px",
    cursor: disabled ? "default" : "pointer", fontSize: 18,
    color: disabled ? C.border : C.green, fontWeight: 700, lineHeight: 1,
    opacity: disabled ? 0.35 : 1,
  });

  return (
    <div>
      <h2 style={{ ...serif, fontSize: 28, color: C.green, margin: "0 0 16px" }}>Family Calendar</h2>

      {families.length > 0 && (
        <div style={{ ...card, padding: "12px 16px", marginBottom: 16 }}>
          <div style={lbl}>Families</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {families.map(f => (
              <span key={f.id} style={{ fontSize: 12, fontWeight: 700, padding: "5px 14px", borderRadius: 20, backgroundColor: f.color + "18", color: f.color, border: `1px solid ${f.color}40`, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: f.color, flexShrink: 0, display: "inline-block" }} />
                {f.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ ...card, padding: isMobile ? 12 : 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <button onClick={() => viewYM > minYM && changeMonth(-1)} disabled={viewYM <= minYM} style={navBtnStyle(viewYM <= minYM)}>‹</button>
          <span style={{ ...serif, fontSize: isMobile ? 16 : 18, fontWeight: 700, color: C.text }}>{monthLabel}</span>
          <button onClick={() => viewYM < maxYM && changeMonth(1)} disabled={viewYM >= maxYM} style={navBtnStyle(viewYM >= maxYM)}>›</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: isMobile ? 2 : 4, marginBottom: 4 }}>
          {DAY_NAMES.map(d => (
            <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: C.muted, padding: "4px 0" }}>
              {isMobile ? d[0] : d}
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: isMobile ? 2 : 4 }}>
          {cells.map((day, i) => {
            const dateStr = day ? `${viewYM}-${String(day).padStart(2, "0")}` : null;
            const dayEvs  = dateStr ? (byDate[dateStr] || []) : [];
            const dotColors = [...new Map(dayEvs.map(ev => [ev.familyId, famColors[ev.familyId] || C.green])).values()];
            const isSelected = dateStr === selectedDay;
            const isToday    = dateStr === todayStr;
            const hasEvs     = dayEvs.length > 0;
            return (
              <div
                key={i}
                onClick={() => { if (hasEvs && dateStr) setSelectedDay(isSelected ? null : dateStr); }}
                style={{
                  minHeight: isMobile ? 42 : 52,
                  borderRadius: 8,
                  padding: isMobile ? "4px 2px" : "6px 4px",
                  backgroundColor: day ? (isSelected ? C.greenLight : C.cream) : "transparent",
                  border: day ? `1.5px solid ${isSelected ? C.green : isToday ? C.terra : C.border}` : "none",
                  cursor: hasEvs ? "pointer" : "default",
                  display: "flex",
                  visibility: day ? "visible" : "hidden",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  transition: "background 0.15s",
                  userSelect: "none",
                }}
              >
                <div style={{ fontSize: isMobile ? 11 : 13, fontWeight: isToday ? 800 : 600, color: isToday ? C.terra : (isSelected ? C.green : C.text) }}>
                  {day}
                </div>
                <div style={{ display: "flex", gap: 2, justifyContent: "center", flexWrap: "wrap", minHeight: isMobile ? 5 : 7 }}>
                  {dotColors.slice(0, 4).map((color, ci) => (
                    <div key={ci} style={{ width: isMobile ? 5 : 7, height: isMobile ? 5 : 7, borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />
                  ))}
                  {dotColors.length > 4 && <div style={{ fontSize: 7, color: C.muted, fontWeight: 700, lineHeight: "7px" }}>+{dotColors.length - 4}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedDay && selectedEvs.length > 0 && (
        <div style={{ ...card, padding: 16, border: `1.5px solid ${C.green}`, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ ...serif, fontSize: 16, margin: 0, color: C.green }}>{formatDate(selectedDay)}</h3>
            <button onClick={() => setSelectedDay(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: C.muted, lineHeight: 1, padding: "0 4px" }}>×</button>
          </div>
          {selectedEvs.map(ev => <EventCard key={ev.id} ev={ev} canEdit={false} locked={true} />)}
        </div>
      )}

      {sortedAll.length > 0 && (
        <div style={card}>
          <h3 style={{ ...serif, fontSize: 18, margin: "0 0 16px" }}>All Events This Cycle</h3>
          {sortedAll.map(ev => (
            <div key={ev.id} style={{ display: "flex", gap: 14, padding: "14px 0", borderBottom: `1px solid ${C.border}`, alignItems: "flex-start" }}>
              <div style={{ minWidth: 52, flexShrink: 0, textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: famColors[ev.familyId] || C.green }}>{formatShort(ev.date)}</div>
                {ev.time && <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{ev.time}</div>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{ev.isFamilyEvent ? `🎉 ${ev.eventName}` : `${ev.childName} — ${ev.eventName}`}</span>
                  <Badge level={ev.importance} isFamilyEvent={ev.isFamilyEvent} size="sm" />
                </div>
                {ev.location && <div style={{ fontSize: 12 }}><a href="#" onClick={e2 => { e2.preventDefault(); openMapsLink(ev.lat && ev.lng ? `https://www.google.com/maps?q=${ev.lat},${ev.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.location)}`); }} style={{ color: C.terra, textDecoration: "none", cursor: "pointer" }}>📍 {ev.location}</a></div>}
                {rsvpMap[ev.id] === "yes"   && <div style={{ fontSize: 11, color: C.green, fontWeight: 700, marginTop: 3 }}>✓ Nana & Papa coming</div>}
                {rsvpMap[ev.id] === "maybe" && <div style={{ fontSize: 11, color: C.terra, fontWeight: 700, marginTop: 3 }}>◎ Nana & Papa maybe</div>}
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, backgroundColor: (famColors[ev.familyId] || C.green) + "18", color: famColors[ev.familyId] || C.green, whiteSpace: "nowrap", flexShrink: 0 }}>
                {ev.family.split(" ")[0]}
              </span>
            </div>
          ))}
        </div>
      )}

      {events.length === 0 && (
        <div style={{ ...card, textAlign: "center", padding: 40, color: C.muted }}>No events submitted yet.</div>
      )}
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function GrandiviteApp() {
  const [auth, setAuth]                   = useState(null);   // { role, family? }
  const [googleUser, setGoogleUser]       = useState(null);   // Supabase user object
  const [orgId, setOrgId]                 = useState(null);   // resolved from org_members
  const [unrecognized, setUnrecognized]   = useState(false);  // email not in any group
  const [step, setStep]                   = useState(1);
  useEffect(() => { if (auth) localStorage.setItem("gv_step", step); }, [step, auth]);
  const [loading, setLoading]             = useState(true);
  const [cycle, setCycle]                 = useState(null);
  const [allCycles, setAllCycles]         = useState([]);
  const [promptCycleId, setPromptCycleId] = useState(null);
  const [events, setEvents]               = useState([]);
  const [rsvpMap, setRsvpMap]             = useState({});
  const [editingEvent, setEditingEvent]   = useState(null);
  const [formRows, setFormRows]           = useState([BLANK_ROW()]);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [promptSent, setPromptSent]       = useState(false);
  const [reminderSent, setReminderSent]   = useState(false);
  const [autoNudge, setAutoNudge]         = useState(true);
  const [familyRsvpMap, setFamilyRsvpMap] = useState({});
  // All org config from DB — no hardcoded fallbacks
  const [families, setFamilies]                   = useState([]);
  const [coordinatorEmails, setCoordinatorEmails] = useState([]);
  const [grandparents, setGrandparents]           = useState({ emails: [], phones: [] });
  const [orgData, setOrgData]                     = useState(null);
  const [orgSettings, setOrgSettings]             = useState(null);
  // AI draft state
  const [aiDraft, setAiDraft]               = useState("");
  const [aiDraftLoading, setAiDraftLoading] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  // AI nudge state
  const [nudgeDrafts, setNudgeDrafts]           = useState({});
  const [nudgeDraftLoading, setNudgeDraftLoading] = useState(false);
  const [showNudgeModal, setShowNudgeModal]       = useState(false);
  const [nudgePending, setNudgePending]           = useState([]);
  const isMobile = useIsMobile();

  // Font load
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Lato:wght@300;400;700&display=swap";
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch {} };
  }, []);

  // Handle Google auth session on load and after redirect
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setGoogleUser(session.user);
        await loadOrgAndResolveAuth(session.user.email);
      } else {
        setLoading(false);
      }
    })();

    // Listen for auth state changes (e.g. after Google redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setGoogleUser(session.user);
        await loadOrgAndResolveAuth(session.user.email);
      } else {
        setGoogleUser(null); setAuth(null); setOrgId(null); setUnrecognized(false); localStorage.removeItem("gv_step");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadOrgAndResolveAuth(email) {
    // 1. Resolve user's org from org_members
    const member = await adminDb.resolveUserOrg(email);
    if (!member?.org_id) {
      // User exists in auth but not in any org — redirect to onboarding
      window.location.href = "/onboarding";
      return;
    }
    const resolvedOrgId = member.org_id;
    setOrgId(resolvedOrgId);

    // 2. Load all org data in parallel
    const [dbGroups, dbCoords, dbGrand, dbOrg, dbOrgSettings, cycle, cycles] = await Promise.all([
      adminDb.fetchGroupsForApp(resolvedOrgId),
      adminDb.fetchCoordinatorEmails(resolvedOrgId),
      adminDb.fetchDigestRecipients(resolvedOrgId),
      adminDb.fetchOrg(resolvedOrgId),
      adminDb.fetchOrgSettings(resolvedOrgId),
      db.fetchCycle(resolvedOrgId),
      db.fetchAllCycles(resolvedOrgId),
    ]);
    if (cycles?.length) setAllCycles(cycles);

    if (dbGroups?.length)        setFamilies(dbGroups);
    if (dbCoords?.length)        setCoordinatorEmails(dbCoords);
    if (dbGrand?.emails?.length) setGrandparents(dbGrand);
    if (dbOrg)                   setOrgData(dbOrg);
    if (dbOrgSettings)           setOrgSettings(dbOrgSettings);

    // 3. Resolve role from DB data (no hardcoded lists)
    const resolved = resolveAuth(email, dbGroups || [], dbCoords || []);
    if (resolved) {
      setAuth(resolved);
      const sv = parseInt(localStorage.getItem("gv_step"));
      setStep(sv >= (resolved.role === "coordinator" ? 1 : 2) && sv <= 5 ? sv : resolved.role === "coordinator" ? 1 : 2);
    } else {
      setAuth(null);
      setUnrecognized(true);
    }

    // 4. Load cycle + events
    if (cycle) {
      setCycle(cycle);
      setPromptCycleId(cycle.id);
      const [evs, rvps, frvps] = await Promise.all([
        db.fetchEvents(cycle.id), db.fetchRsvps(), db.fetchFamilyRsvps(),
      ]);
      setEvents(evs);
      setRsvpMap(rvps);
      setFamilyRsvpMap(frvps);
    }

    // 5. Load nudge setting from org_settings
    if (dbOrgSettings?.auto_nudge_enabled != null) setAutoNudge(dbOrgSettings.auto_nudge_enabled);

    setLoading(false);
  }

  // Real-time subscription — all devices stay in sync automatically
  useEffect(() => {
    if (!cycle?.id) return;
    const channel = supabase.channel("cl-realtime")
      .on("postgres_changes", { event: "*",    schema: "public", table: "events",  filter: `cycle_id=eq.${cycle.id}` }, () => { db.fetchEvents(cycle.id).then(setEvents); })
      .on("postgres_changes", { event: "*",    schema: "public", table: "rsvps"                                       }, () => { db.fetchRsvps().then(setRsvpMap); })
      .on("postgres_changes", { event: "*",    schema: "public", table: "family_rsvps"                               }, () => { db.fetchFamilyRsvps().then(setFamilyRsvpMap); })
      .on("postgres_changes", { event: "*",    schema: "public", table: "cycles",  filter: `id=eq.${cycle.id}`       }, p  => { if (p.new) setCycle(p.new); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "cycles" }, async () => {
        const [newCycle, cycles] = await Promise.all([db.fetchCycle(orgId), db.fetchAllCycles(orgId)]);
        if (cycles?.length) setAllCycles(cycles);
        if (newCycle && newCycle.id !== cycle.id) {
          setCycle(newCycle);
          setPromptCycleId(newCycle.id);
          const [evs, rvps, frvps] = await Promise.all([db.fetchEvents(newCycle.id), db.fetchRsvps(), db.fetchFamilyRsvps()]);
          setEvents(evs); setRsvpMap(rvps); setFamilyRsvpMap(frvps);
          setFormRows([BLANK_ROW()]); setFormSubmitted(false);
        }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [cycle?.id]);

  if (loading) return <Spinner />;

  // Email not in any group for this org
  if (unrecognized) return (
    <div style={{ minHeight: "100vh", backgroundColor: C.green, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ backgroundColor: C.white, borderRadius: 24, padding: "48px 40px", maxWidth: 380, width: "100%", textAlign: "center", boxShadow: "0 24px 80px rgba(0,0,0,0.25)" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🌿</div>
        <h2 style={{ ...serif, fontSize: 22, color: C.green, margin: "0 0 12px" }}>Not Recognized</h2>
        <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7, margin: "0 0 24px" }}>The account <strong>{googleUser?.email}</strong> isn't registered with . Contact your organization admin to get access.</p>
        <Btn variant="outline" full onClick={async () => { await supabase.auth.signOut(); setUnrecognized(false); }}>Sign Out</Btn>
      </div>
    </div>
  );

  if (!auth) return <AuthScreen />;

  const isCoord    = auth.role === "coordinator";
  const locked     = cycle?.locked     || false;
  const digestSent = cycle?.digest_sent || false;

  // Dynamic date window — recomputes on every render (i.e. always today)
  const win = getWindowDates(orgSettings?.lookahead_days || 30);
  const todayISO = (() => { const t = win.today; return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`; })();

  // Org-configurable copy — falls back to hardcoded strings
  const noteLabel      = orgSettings?.note_label      || "A Note for Nana & Papa (Optional)";
  const digestGreeting = orgData?.digest_greeting      || "Hi Nana and Papa!";
  const digestSignoff  = orgData?.digest_signoff       || "Love, The Family";

  const submittedFamilyIds  = new Set(events.map(e => e.family_id || e.familyId));
  const cadenceMultiplier   = (c) => c === "quarterly" ? 3 : c === "biannual" ? 6 : 1;
  const isDueThisCycle      = (f) => (f.submission_cadence || "monthly") === "monthly";

  const hasUpcomingEventsInWindow = (familyId, months) => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() + months);
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth()+1).padStart(2,"0")}-${String(cutoff.getDate()).padStart(2,"0")}`;
    return events.some(ev => (ev.family_id || ev.familyId) === familyId && ev.date >= todayISO && ev.date <= cutoffStr);
  };

  const familiesWithStatus = families.map(f => {
    const cadence   = f.submission_cadence || "monthly";
    const submitted = submittedFamilyIds.has(f.id);
    const needsNudge = cadence === "monthly"
      ? !submitted
      : !hasUpcomingEventsInWindow(f.id, cadenceMultiplier(cadence));
    return { ...f, submitted, needsNudge };
  });
  const pendingMonthly = familiesWithStatus.filter(f => f.needsNudge);
  const sortedEvents       = [...events].map(norm).sort((a, b) => b.importance - a.importance || new Date(a.date) - new Date(b.date));
  const myEvents           = events.filter(e => (e.family_id || e.familyId) === auth.family?.id).map(norm);

  // Conflict detection for coordinator view
  const dateFamilyMap = {};
  events.forEach(ev => {
    const e = norm(ev);
    if (!dateFamilyMap[e.date]) dateFamilyMap[e.date] = { families: new Set(), events: [] };
    dateFamilyMap[e.date].families.add(e.familyId);
    dateFamilyMap[e.date].events.push(e);
  });
  const conflicts    = Object.entries(dateFamilyMap).filter(([, v]) => v.families.size > 1).map(([date, v]) => ({ date, events: v.events })).sort((a, b) => new Date(a.date) - new Date(b.date));
  const conflictDates = new Set(conflicts.map(c => c.date));

  // Handlers
  const removeEvent = async (id) => { setEvents(p => p.filter(e => e.id !== id)); await db.deleteEvent(id); };
  const saveEdit    = async (updated) => {
    const e = norm(updated);
    setEvents(p => p.map(ev => ev.id === updated.id ? { ...ev, child_name: e.childName, event_name: e.eventName, date: e.date, time: e.time, location: e.location, importance: parseInt(e.importance), notes: e.notes } : ev));
    await db.updateEvent(updated.id, e);
  };
  const setRsvp       = async (eventId, status) => { setRsvpMap(p => ({ ...p, [eventId]: status })); await db.upsertRsvp(eventId, status); };
  const setFamilyRsvp = async (eventId, status) => {
    const famId = auth.family?.id;
    if (!famId) return;
    setFamilyRsvpMap(p => {
      const next = { ...p, [eventId]: { ...(p[eventId] || {}) } };
      if (status) next[eventId][famId] = status;
      else delete next[eventId][famId];
      return next;
    });
    await db.upsertFamilyRsvp(eventId, famId, status);
  };
  const handleLock   = async () => { setCycle(p => ({ ...p, locked: true }));       await db.updateCycle(cycle.id, { locked: true }); };
  const handleDigest = async () => { setCycle(p => ({ ...p, digest_sent: true }));  await db.updateCycle(cycle.id, { digest_sent: true }); };
  const handleAiNudge = async () => {
    const pending = pendingMonthly;
    if (!pending.length) return;
    setNudgeDraftLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/draft-nudge", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
        body: JSON.stringify({ pendingFamilies: pending, max30Label: win.max30Label }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setNudgeDrafts(json.drafts);
      setNudgePending(pending);
      setShowNudgeModal(true);
    } catch (err) {
      console.error("Nudge draft error:", err);
      alert(`Couldn't generate nudge drafts — ${err.message || "try again."}`);
    } finally {
      setNudgeDraftLoading(false);
    }
  };
  const handleAiDraft = async () => {
    setAiDraftLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/draft-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
        body: JSON.stringify({ events: sortedEvents, monthLabel: cycle?.month_label, greeting: digestGreeting, signoff: digestSignoff }),
      });
      if (!res.ok) throw new Error("Draft failed");
      const { draft } = await res.json();
      setAiDraft(draft);
      setShowDraftModal(true);
    } catch {
      alert("Couldn't generate a draft — check that ANTHROPIC_API_KEY is set in Vercel.");
    } finally {
      setAiDraftLoading(false);
    }
  };
  const handleReset  = async () => {
    const futureEvs = await db.fetchFutureEvents(cycle.id);
    const futureNote = futureEvs.length > 0
      ? `\n\n⚠️ ${futureEvs.length} event${futureEvs.length !== 1 ? "s are" : " is"} still in the future and will be permanently deleted. Create a new cycle instead to carry them forward.`
      : "";
    if (!window.confirm(`Clear all events and reset for the new month?${futureNote}`)) return;
    setEvents([]); setRsvpMap({}); setCycle(p => ({ ...p, locked: false, digest_sent: false }));
    setFormRows([BLANK_ROW()]); setFormSubmitted(false);
    await db.resetCycle(cycle.id);
  };
  const handleSubmit = async () => {
    const valid = formRows.filter(r => r.isFamilyEvent ? (r.eventName && r.date) : (r.childName && r.eventName && r.date && r.importance));
    if (!valid.length) return;
    if (!cycle?.id) {
      alert("No active cycle found. Please ask the coordinator to set up the current cycle in Supabase.");
      return;
    }
    try {
      const fam = auth.family;
      if (!fam) { alert("No family linked to your account. Contact your organization admin."); return; }
      const familyName = fam.name.split(" ").slice(0, 3).join(" ");

      // Enforce per-child event limit — scales with submission cadence
      const baseMax = orgSettings?.max_events_per_child ?? 2;
      const MAX = baseMax * cadenceMultiplier(fam.submission_cadence || "monthly");
      const existingPerChild = {};
      myEvents.forEach(e => {
        const key = e.childName?.trim().toLowerCase();
        if (key) existingPerChild[key] = (existingPerChild[key] || 0) + 1;
      });
      const toSubmit = [];
      const newPerChild = { ...existingPerChild };
      const skipped = [];
      for (const row of valid) {
        if (row.isFamilyEvent) {
          toSubmit.push({ ...row, childName: familyName });
          continue;
        }
        const key = row.childName.trim().toLowerCase();
        if ((newPerChild[key] || 0) >= MAX) {
          skipped.push(row.childName);
        } else {
          toSubmit.push(row);
          newPerChild[key] = (newPerChild[key] || 0) + 1;
        }
      }
      if (skipped.length) {
        const names = [...new Set(skipped)].join(", ");
        alert(`${names} already ${skipped.length === 1 ? "has" : "have"} ${MAX} event${MAX !== 1 ? "s" : ""} this cycle. Those extra events were not saved.`);
      }
      if (!toSubmit.length) return;

      const results = await Promise.allSettled(
        toSubmit.map(row => db.insertEvent(cycle.id, fam.id, familyName, row))
      );
      const saved = results.filter(r => r.status === "fulfilled" && r.value).map(r => r.value);
      const failCount = toSubmit.length - saved.length;
      saved.forEach(data => setEvents(p => [...p, data]));
      if (failCount > 0) {
        alert(`${saved.length} event${saved.length !== 1 ? "s" : ""} saved, but ${failCount} couldn't be saved — please try submitting again.`);
      }
      if (saved.length > 0) setFormSubmitted(true);
    } catch (err) {
      console.error("Submit failed:", err);
      alert("Something went wrong saving your events. Please try again.");
    }
  };
  const updateRow = (i, f, v) => setFormRows(rows => rows.map((r, idx) => idx === i ? { ...r, [f]: v } : r));

  const TABS = isCoord
    ? [{ n: 1, label: "1. Send Prompt" }, { n: 2, label: "2. Submit Events" }, { n: 3, label: "3. Compile & Send" }, { n: 5, label: "📅 Calendar" }, { n: 4, label: "4. Nana & Papa View" }]
    : [{ n: 2, label: "Submit Events" }, { n: 5, label: "📅 Family Calendar" }];

  // ── STEP 1 ────────────────────────────────────────────────────────────────
  const promptCycle = allCycles.find(c => String(c.id) === String(promptCycleId)) || cycle;
  const Step1 = () => (
    <div>
      <h2 style={{ ...serif, fontSize: 28, color: C.green, margin: "0 0 6px" }}>Monthly Prompt</h2>
      <p style={{ color: C.muted, margin: "0 0 16px", lineHeight: 1.6 }}>Send the monthly request to all families.</p>
      {allCycles.length > 1 && (
        <div style={{ ...card, padding: "12px 16px", marginBottom: 16 }}>
          <div style={lbl}>Sending prompt for cycle</div>
          <select style={{ ...inp, width: "100%" }} value={String(promptCycleId ?? "")} onChange={e => setPromptCycleId(e.target.value)}>
            {allCycles.map(c => <option key={c.id} value={String(c.id)}>{c.month_label}{c.id === cycle?.id ? " (current)" : ""}</option>)}
          </select>
        </div>
      )}
      <div style={{ ...card, backgroundColor: C.green, color: C.white }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1px", opacity: 0.65, marginBottom: 4 }}>SENDING TODAY</div>
            <div style={{ ...serif, fontSize: 22, fontWeight: 600 }}>{promptCycle?.month_label || win.monthLabel}</div>
            <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>Events window: {win.windowLabel}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 4, fontWeight: 700, letterSpacing: "1px" }}>IDEAL NOTICE</div>
            <div style={{ ...serif, fontSize: 18, fontWeight: 600 }}>30 days</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Min: 14 days ({win.min14Label})</div>
          </div>
        </div>
        <div style={{ backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 14px", fontSize: 13, lineHeight: 1.6 }}>
          💡 Ask families to submit events happening between <strong>today</strong> and <strong>{win.max30Label}</strong>. Nana and Papa need at least 14 days notice — ideally 30.
        </div>
      </div>
      <div style={card}>
        <h3 style={{ ...serif, fontSize: 18, margin: "0 0 16px" }}>Family Submissions</h3>
        {familiesWithStatus.map(f => {
          const cadence = f.submission_cadence || "monthly";
          const cadenceLabel = cadence === "quarterly" ? "Quarterly" : cadence === "biannual" ? "2× / Year" : null;
          let badge;
          if (cadence === "monthly") {
            badge = f.submitted
              ? <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20, backgroundColor: C.greenLight, color: C.green }}>✓ Submitted</span>
              : <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20, backgroundColor: C.terraLight, color: C.terra }}>Pending</span>;
          } else {
            badge = f.needsNudge
              ? <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20, backgroundColor: C.terraLight, color: C.terra }}>{cadenceLabel} · Needs Events</span>
              : <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20, backgroundColor: C.greenLight, color: C.green }}>{cadenceLabel} · Scheduled</span>;
          }
          return (
            <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{f.name}</span>
              {badge}
            </div>
          );
        })}
        <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: C.muted }}>{familiesWithStatus.filter(f => !f.needsNudge).length} of {familiesWithStatus.length} families covered</span>
          {pendingMonthly.length > 0 && (
            <>
              <Btn variant="outline" style={{ padding: "6px 14px", fontSize: 12 }} onClick={() => {
                const emails  = pendingMonthly.flatMap(f => f.emails).join(",");
                const subject = encodeURIComponent("Reminder —  Events Due Soon");
                const body    = encodeURIComponent(`Hey! Quick reminder to submit your upcoming family events on grandivite.com. We need events through ${win.max30Label} — at least 14 days notice for Nana and Papa. Thanks!`);
                window.open(`mailto:${emails}?subject=${subject}&body=${body}`);
                setReminderSent(true);
              }}>{reminderSent ? "✓ Email Sent" : "📧 Nudge via Email"}</Btn>
              <Btn variant="primary" style={{ padding: "6px 14px", fontSize: 12 }} disabled={nudgeDraftLoading} onClick={handleAiNudge}>
                {nudgeDraftLoading ? "Drafting…" : "✨ AI Nudge"}
              </Btn>
            </>
          )}
        </div>
      </div>
      <div style={card}>
        <h3 style={{ ...serif, fontSize: 18, margin: "0 0 16px" }}>Message Preview</h3>
        <div style={{ backgroundColor: C.cream, borderRadius: 10, padding: 20, borderLeft: `4px solid ${C.terra}`, fontStyle: "italic", color: C.text, lineHeight: 1.8, fontSize: 14 }}>
          {"Hey family — it's that time! Log into grandivite.com and submit events happening between now and " + win.max30Label + ". Nana and Papa need at least 14 days notice — ideally 30. Up to 2 per child!"}
        </div>
        <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Btn variant={promptSent ? "outline" : "accent"} onClick={() => {
            const orgName    = orgData?.name || "Grandivite";
            const cycleLabel = promptCycle?.month_label || win.monthLabel;
            const emails  = families.flatMap(f => f.emails).join(",");
            const subject = encodeURIComponent(`${orgName} — Please Submit Your ${cycleLabel} Events`);
            const body    = encodeURIComponent(`Hey family!\n\nTime to submit your upcoming events on ${orgName} for ${cycleLabel}.\n\nPlease include events happening between now and ${win.max30Label}. Nana and Papa need at least 14 days notice — 30 is ideal.\n\nUp to 2 events per child.\nhttps://grandivite.com\n\n${digestSignoff}`);
            window.open(`mailto:${emails}?subject=${subject}&body=${body}`);
            setPromptSent(true);
          }}>{promptSent ? "✓ Prompt Sent" : "📧 Send via Email"}</Btn>

        </div>
      </div>
      <div style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>Auto Monthly Prompt</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
            {autoNudge ? "Cron job emails all families on the 1st of each month." : "Auto email is paused — send manually above."}
          </div>
        </div>
        <button
          onClick={async () => { const next = !autoNudge; setAutoNudge(next); await db.updateSettings({ auto_nudge_enabled: next }); }}
          style={{ width: 52, height: 28, borderRadius: 14, border: "none", cursor: "pointer", backgroundColor: autoNudge ? C.green : C.border, position: "relative", flexShrink: 0, transition: "background-color 0.2s" }}
        >
          <span style={{ position: "absolute", top: 3, left: autoNudge ? 26 : 4, width: 22, height: 22, borderRadius: "50%", backgroundColor: C.white, transition: "left 0.2s", display: "block", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
        </button>
      </div>
    </div>
  );

  // ── STEP 2 ────────────────────────────────────────────────────────────────
  const Step2 = () => {
    const fam       = auth.family;
    const firstName = fam?.name.split(" ")[0] || "";
    return (
      <div>
        <h2 style={{ ...serif, fontSize: 28, color: C.green, margin: "0 0 6px" }}>Submit Your Events</h2>
        <p style={{ color: C.muted, margin: "0 0 24px", lineHeight: 1.6 }}>{fam ? `Hi ${firstName}! ` : ""}Submit up to 2 events per child happening in the next 30 days (through {win.max30Label}). Nana and Papa need at least 14 days notice.</p>

        {myEvents.length > 0 && (
          <div style={card}>
            <h3 style={{ ...serif, fontSize: 18, margin: "0 0 4px" }}>Your Submitted Events</h3>
            <p style={{ fontSize: 13, color: C.muted, margin: "0 0 12px" }}>Edit or remove these until the coordinator locks the calendar.</p>
            {myEvents.map(ev => <EventCard key={ev.id} ev={ev} canEdit={!locked} onEdit={setEditingEvent} onRemove={removeEvent} locked={locked} />)}
          </div>
        )}

        {formSubmitted ? (
          <div style={{ ...card, textAlign: "center", padding: 48, backgroundColor: C.greenLight, border: `2px solid ${C.green}` }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🌿</div>
            <h3 style={{ ...serif, fontSize: 24, color: C.green, margin: "0 0 12px" }}>Submitted!</h3>
            <p style={{ color: C.green, margin: "0 0 20px", lineHeight: 1.7, fontSize: 15 }}>Your events are in. We'll let you know when the digest goes to Nana and Papa.</p>
            {!locked && <Btn variant="outline" onClick={() => { setFormRows([BLANK_ROW()]); setFormSubmitted(false); }}>+ Add Another Event</Btn>}
          </div>
        ) : (
          <>
            <div style={{ ...card, padding: 16 }}>
              <div style={lbl}>Priority Guide — Max 2 Events Per Child</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{[3,2,1].map(l => <Badge key={l} level={l} />)}<Badge isFamilyEvent /></div>
            </div>
            {formRows.map((row, i) => (
              <div key={i} style={{ ...card, borderLeft: row.isFamilyEvent ? `4px solid ${C.family}` : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <h3 style={{ ...serif, fontSize: 18, margin: 0, color: row.isFamilyEvent ? C.family : C.text }}>
                    {row.isFamilyEvent ? "🎉 Family / Holiday Event" : `New Event ${formRows.length > 1 ? i + 1 : ""}`}
                  </h3>
                  {formRows.length > 1 && <button onClick={() => setFormRows(r => r.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", fontSize: 16, color: C.muted, cursor: "pointer" }}>✕</button>}
                </div>
                {row.isFamilyEvent ? (
                  <>
                    <div style={{ marginBottom: 16, padding: "10px 14px", backgroundColor: C.familyLight, borderRadius: 8, fontSize: 13, color: C.family, fontWeight: 600 }}>
                      Hosted by {fam?.name || "your family"} — this will appear as an invitation for grandparents.
                    </div>
                    <div style={{ marginBottom: 16 }}><span style={lbl}>Event / Occasion</span><input style={inp} placeholder="e.g. Mother's Day Brunch, Christmas Dinner" value={row.eventName} onChange={e => updateRow(i, "eventName", e.target.value)} /></div>
                  </>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 16 }}>
                    <div>
                      <span style={lbl}>Child's Name</span>
                      {fam && fam.children?.length > 0 ? (
                        <select style={inp} value={row.childName} onChange={e => updateRow(i, "childName", e.target.value)}>
                          <option value="">Select child...</option>
                          {fam.children.map(c => <option key={c} value={c}>{c}</option>)}
                          <option value="All kids">All kids</option>
                        </select>
                      ) : (
                        <input style={inp} placeholder="e.g. Name" value={row.childName} onChange={e => updateRow(i, "childName", e.target.value)} />
                      )}
                      {(() => {
                        if (!row.childName) return null;
                        const baseMax = orgSettings?.max_events_per_child ?? 2;
                        const MAX     = baseMax * cadenceMultiplier(auth.family?.submission_cadence || "monthly");
                        const already = myEvents.filter(e => e.childName === row.childName).length;
                        const inForm  = formRows.filter((r, idx) => idx !== i && r.childName === row.childName).length;
                        const total   = already + inForm;
                        if (total >= MAX) return <div style={{ fontSize: 11, color: C.red,   marginTop: 5, fontWeight: 700 }}>⚠️ Max {MAX} event{MAX !== 1 ? "s" : ""} reached for {row.childName}</div>;
                        if (total === MAX - 1) return <div style={{ fontSize: 11, color: C.terra, marginTop: 5, fontWeight: 700 }}>This is event {MAX} of {MAX} for {row.childName}</div>;
                        return null;
                      })()}
                    </div>
                    <div><span style={lbl}>Event / Activity</span><input style={inp} placeholder="e.g. Spring Play" value={row.eventName} onChange={e => updateRow(i, "eventName", e.target.value)} /></div>
                  </div>
                )}
                <div style={{ marginBottom: 16 }}><span style={lbl}>Date</span><input style={{ ...inp, display: "block", width: "100%" }} type="date" min={todayISO} value={row.date} onChange={e => updateRow(i, "date", e.target.value)} /></div>
                {!row.isFamilyEvent && (
                  <>
                    <div style={{ marginBottom: 16 }}><span style={lbl}>Time (Optional)</span><input style={{ ...inp, display: "block", width: "100%" }} type="text" placeholder="e.g. 6:30 PM" value={row.time} onChange={e => updateRow(i, "time", e.target.value)} /></div>
                    <div style={{ marginBottom: 16 }}>
                      <span style={lbl}>Location (Optional)</span>
                      <PlacesInput
                        value={row.location}
                        onChange={(label, lat, lng) => {
                          updateRow(i, "location", label);
                          updateRow(i, "lat", lat);
                          updateRow(i, "lng", lng);
                        }}
                      />
                    </div>
                  </>
                )}
                {!row.isFamilyEvent && (
                  <div style={{ marginBottom: 16 }}>
                    <span style={lbl}>Priority</span>
                    <select style={inp} value={row.importance} onChange={e => updateRow(i, "importance", e.target.value)}>
                      <option value="">Select priority...</option>
                      <option value="3">⭐⭐⭐ Milestone</option>
                      <option value="2">⭐⭐ Intentional 1:1 Time</option>
                      <option value="1">⭐ Group Event</option>
                    </select>
                  </div>
                )}
                <div>
                  <NotesField
                    label={row.isFamilyEvent ? "Details for grandparents (Optional)" : noteLabel}
                    placeholder={row.isFamilyEvent ? "What should they know? Dress code, what to bring, etc." : "Share what makes this moment special..."}
                    value={row.notes}
                    onChange={v => updateRow(i, "notes", v)}
                    childName={row.isFamilyEvent ? (fam?.name || "") : row.childName}
                    eventName={row.eventName}
                    importance={row.isFamilyEvent ? 1 : row.importance}
                  />
                </div>
              </div>
            ))}
            {(() => {
              const hasValid = formRows.some(r => r.isFamilyEvent ? (r.eventName && r.date) : (r.childName && r.eventName && r.date && r.importance));
              const missingPriority = formRows.some(r => !r.isFamilyEvent && r.childName && r.eventName && r.date && !r.importance);
              return (
                <>
                  {missingPriority && <p style={{ fontSize: 12, color: C.terra, margin: "0 0 8px", fontWeight: 700 }}>⚠️ Select a Priority for each event before submitting.</p>}
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", flexDirection: isMobile ? "column" : "row" }}>
                    <Btn variant="outline" onClick={() => setFormRows(r => [...r, BLANK_ROW()])}>+ Add Child's Event</Btn>
                    <Btn variant="outline" onClick={() => setFormRows(r => [...r, BLANK_FAMILY_ROW()])} style={{ borderColor: C.family, color: C.family }}>🎉 Add Family Event</Btn>
                    <Btn variant="accent" disabled={!hasValid} onClick={handleSubmit}>Submit Our Events →</Btn>
                  </div>
                </>
              );
            })()}
          </>
        )}
        {(() => {
          const otherEvents = sortedEvents.filter(ev => ev.familyId !== auth.family?.id);
          if (!otherEvents.length) return null;
          return (
            <div style={{ ...card, marginTop: 16 }}>
              <h3 style={{ ...serif, fontSize: 18, margin: "0 0 4px" }}>Other Family Events</h3>
              <p style={{ fontSize: 13, color: C.muted, margin: "0 0 12px" }}>Let them know you're coming!</p>
              {otherEvents.map(ev => {
                const myRsvp   = familyRsvpMap[ev.id]?.[auth.family?.id];
                const famColor = families.find(f => f.id === ev.familyId)?.color || C.green;
                return (
                  <div key={ev.id} style={{ padding: "14px 0", borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
                      <Badge level={ev.importance} size="sm" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{ev.childName} — {ev.eventName}</div>
                        <div style={{ fontSize: 12, color: C.muted }}>{formatDate(ev.date)}{ev.time ? ` · ${ev.time}` : ""}</div>
                        <div style={{ fontSize: 11, color: famColor, fontWeight: 700, marginTop: 2 }}>{ev.family.toUpperCase()}</div>
                      </div>
                    </div>
                    {(() => {
                      const [cy, cm, cd] = ev.date.split("-").map(Number);
                      const gcalDay = `https://calendar.google.com/calendar/r/day/${cy}/${cm}/${cd}`;
                      const calBtns = (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button onClick={() => addToGoogleCalendar(ev)} style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${C.green}`, backgroundColor: C.white, color: C.green, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>📅 Google Calendar</button>
                          <button onClick={() => addToCalendar(ev)}       style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${C.muted}`, backgroundColor: C.white, color: C.muted, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>📅 Apple Calendar</button>
                        </div>
                      );
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {!myRsvp && (
                            <>
                              <a href={gcalDay} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.muted, textDecoration: "none", fontWeight: 600 }}>📅 Check your calendar →</a>
                              <div style={{ display: "flex", gap: 8 }}>
                                <button onClick={() => setFamilyRsvp(ev.id, "yes")}   style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${C.green}`, backgroundColor: C.white, color: C.green, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>✓ We'll be there!</button>
                                <button onClick={() => setFamilyRsvp(ev.id, "maybe")} style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${C.terra}`, backgroundColor: C.white, color: C.terra, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>◎ Maybe</button>
                              </div>
                            </>
                          )}
                          {myRsvp === "yes" && (
                            <>
                              <div style={{ padding: "8px 12px", borderRadius: 8, backgroundColor: C.greenLight, border: `1.5px solid ${C.green}`, color: C.green, fontWeight: 700, fontSize: 12, textAlign: "center" }}>
                                ✓ You're going! <button onClick={() => setFamilyRsvp(ev.id, null)} style={{ background: "none", border: "none", color: C.muted, fontSize: 11, cursor: "pointer", marginLeft: 8 }}>change</button>
                              </div>
                              {calBtns}
                            </>
                          )}
                          {myRsvp === "maybe" && (
                            <>
                              <div style={{ padding: "8px 12px", borderRadius: 8, backgroundColor: C.terraLight, border: `1.5px solid ${C.terra}`, color: C.terra, fontWeight: 700, fontSize: 12, textAlign: "center" }}>
                                ◎ Maybe! <button onClick={() => setFamilyRsvp(ev.id, null)} style={{ background: "none", border: "none", color: C.muted, fontSize: 11, cursor: "pointer", marginLeft: 8 }}>change</button>
                              </div>
                              {calBtns}
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    );
  };

  // ── STEP 3 ────────────────────────────────────────────────────────────────
  const Step3 = () => (
    <div>
      <h2 style={{ ...serif, fontSize: 28, color: C.green, margin: "0 0 6px" }}>Compile & Send</h2>
      <p style={{ color: C.muted, margin: "0 0 24px", lineHeight: 1.6 }}>Review, edit, or remove events. Then lock and send to Nana and Papa.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: isMobile ? 8 : 12, marginBottom: 16 }}>
        {[{ label: "Events",      v: events.length },
          { label: "Families In", v: familiesWithStatus.filter(f => f.submitted).length },
          { label: "Pending",     v: pendingMonthly.length }
        ].map((s, i) => (
          <div key={i} style={{ ...card, textAlign: "center", padding: isMobile ? 12 : 20, marginBottom: 0 }}>
            <div style={{ ...serif, fontSize: isMobile ? 26 : 34, color: C.green, fontWeight: 700 }}>{s.v}</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 4, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Conflict summary banner */}
      {conflicts.length > 0 && (
        <div style={{ ...card, backgroundColor: C.terraLight, border: `2px solid ${C.terraBorder}` }}>
          <div style={{ fontWeight: 700, color: C.terra, fontSize: 14, marginBottom: 10 }}>
            ⚠️ {conflicts.length} Scheduling Conflict{conflicts.length > 1 ? "s" : ""} — Review Before Sending
          </div>
          {conflicts.map(({ date, events: cEvs }) => (
            <div key={date} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${C.terraBorder}` }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 6 }}>📅 {formatDate(date)}</div>
              {cEvs.map(ev => (
                <div key={ev.id} style={{ fontSize: 12, color: C.text, paddingLeft: 12, marginTop: 3, display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: families.find(f => f.id === ev.familyId)?.color || C.green, flexShrink: 0, display: "inline-block" }} />
                  <span><strong>{ev.family}</strong> — {ev.childName}: {ev.eventName}{ev.time ? ` at ${ev.time}` : ""}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div style={card}>
        <h3 style={{ ...serif, fontSize: 18, margin: "0 0 4px" }}>All Events — Sorted by Priority</h3>
        {!locked && <p style={{ fontSize: 13, color: C.muted, margin: "0 0 12px" }}>Events with an orange border share a date with another family.</p>}
        {events.length === 0
          ? <p style={{ color: C.muted, fontSize: 14, margin: "24px 0", textAlign: "center" }}>No events submitted yet.</p>
          : sortedEvents.map(ev => <EventCard key={ev.id} ev={ev} canEdit={true} onEdit={setEditingEvent} onRemove={removeEvent} locked={locked} isConflict={conflictDates.has(ev.date)} />)
        }
        {/* RSVP status summary */}
        {sortedEvents.some(ev => rsvpMap[ev.id]) && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 8, letterSpacing: "0.5px" }}>NANA & PAPA RSVP STATUS</div>
            {sortedEvents.filter(ev => rsvpMap[ev.id]).map(ev => (
              <div key={ev.id} style={{ fontSize: 13, marginBottom: 4, display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 14 }}>{rsvpMap[ev.id] === "yes" ? "✓" : "◎"}</span>
                <span style={{ color: rsvpMap[ev.id] === "yes" ? C.green : C.terra, fontWeight: 700 }}>{rsvpMap[ev.id] === "yes" ? "Confirmed" : "Maybe"}</span>
                <span style={{ color: C.muted }}>—</span>
                <span>{ev.childName}: {ev.eventName} · {formatShort(ev.date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {isCoord && (
        <div style={{ ...card, backgroundColor: C.redLight, border: `1px solid ${C.red}` }}>
          <div style={{ fontWeight: 700, color: C.red, marginBottom: 6, fontSize: 13 }}>🔄 Month Rollover</div>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: C.text, lineHeight: 1.6 }}>Clears all events and resets for the next cycle. Cannot be undone.</p>
          <Btn variant="danger" style={{ fontSize: 12, padding: "8px 16px" }} onClick={handleReset}>Reset for New Month</Btn>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", flexDirection: isMobile ? "column" : "row" }}>
        {!locked
          ? <Btn variant="primary" disabled={events.length === 0} onClick={handleLock}>Lock Calendar</Btn>
          : !digestSent
            ? <>
                <Btn variant="outline" onClick={() => setStep(4)}>Preview Nana & Papa View</Btn>
                <Btn variant="primary" disabled={aiDraftLoading} onClick={handleAiDraft}>
                  {aiDraftLoading ? "Drafting…" : "✨ AI Draft"}
                </Btn>
                <Btn variant="accent" onClick={() => {
                  const subject = encodeURIComponent(`The Family's ${cycle?.month_label} Highlights — `);
                  const lines   = sortedEvents.map(ev => {
                    const imp = ev.importance === 3 ? "⭐⭐⭐ Milestone" : ev.importance === 2 ? "⭐⭐ 1:1 Time" : "⭐ Group Event";
                    return `${imp}\n${ev.childName} — ${ev.eventName}\n${formatDate(ev.date)}${ev.time ? " · " + ev.time : ""}${ev.location ? "\n📍 " + ev.location : ""}${ev.notes ? `\n"${ev.notes}"` : ""}\n`;
                  }).join("\n");
                  const body    = encodeURIComponent(`${digestGreeting}\n\nHere's what's coming up in ${cycle?.month_label}. We love you!\n\n${lines}\nFull page: https://grandivite.com\n\n${digestSignoff}`);
                  window.open(`mailto:${grandparents.emails.join(",")}?subject=${subject}&body=${body}`);
                  handleDigest();
                }}>📧 Email Digest</Btn>
                <Btn variant="outline" title="Opens Messages to Nana and Papa only" onClick={() => {
                  const body = encodeURIComponent(`${digestGreeting} 🌿 The family's ${cycle?.month_label} highlights are ready -- tap to see what's coming up and RSVP! grandivite.com`);
                  window.open(`sms:${grandparents.phones.join(",")}?body=${body}`);
                  handleDigest();
                }}>💬 Text Nana & Papa Directly</Btn>
              </>
            : <div style={{ backgroundColor: C.greenLight, border: `1px solid ${C.green}`, borderRadius: 10, padding: "14px 20px", fontSize: 14, color: C.green, fontWeight: 700 }}>✓ Digest sent to Nana and Papa — {cycle?.month_label} · grandivite.com</div>
        }
      </div>
    </div>
  );

  // ── STEP 4 (Nana & Papa view) ─────────────────────────────────────────────
  const Step4 = () => {
    const chronoEvents    = [...events].map(norm).sort((a, b) => new Date(a.date) - new Date(b.date));
    const confirmedEvents = chronoEvents.filter(ev => rsvpMap[ev.id] === "yes");
    return (
      <div>
      {confirmedEvents.length > 0 && (
        <div style={{ ...card, backgroundColor: C.greenLight, border: `1.5px solid ${C.green}`, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
            <h3 style={{ ...serif, fontSize: 18, color: C.green, margin: 0 }}>📅 Your Confirmed Events</h3>
            <a href="https://calendar.google.com" target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 700, color: C.green, textDecoration: "none", padding: "6px 14px", border: `1.5px solid ${C.green}`, borderRadius: 8, whiteSpace: "nowrap" }}>
              View My Calendar →
            </a>
          </div>
          {confirmedEvents.map(ev => (
            <div key={ev.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.greenBorder}`, flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{ev.isFamilyEvent ? ev.eventName : `${ev.childName}'s ${ev.eventName}`}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{formatDate(ev.date)}{ev.time ? ` · ${ev.time}` : ""}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button onClick={() => addToGoogleCalendar(ev)} style={{ padding: "6px 12px", borderRadius: 8, border: `1.5px solid ${C.green}`, backgroundColor: C.white, color: C.green, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "'Lato', sans-serif", whiteSpace: "nowrap" }}>
                  + Google Calendar
                </button>
                <button onClick={() => addToCalendar(ev)} style={{ padding: "6px 12px", borderRadius: 8, border: `1.5px solid ${C.muted}`, backgroundColor: C.white, color: C.muted, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "'Lato', sans-serif", whiteSpace: "nowrap" }}>
                  + Apple Calendar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ backgroundColor: C.green, borderRadius: 20, padding: isMobile ? "24px 16px" : "36px 24px", textAlign: "center", color: C.white, marginBottom: 24 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🌿</div>
        <h2 style={{ ...serif, fontSize: 30, margin: "0 0 10px", fontWeight: 700 }}>{digestGreeting}</h2>
        <p style={{ margin: "0 0 16px", opacity: 0.88, fontSize: 15, lineHeight: 1.7 }}>Here's what's coming up with the family this month.<br />We love you and we'd love to share these moments with you.</p>
        <div style={{ fontSize: 11, opacity: 0.65, letterSpacing: "1.2px", fontWeight: 700 }}>{cycle?.month_label?.toUpperCase()} · GRANDIVITE.COM</div>
      </div>

      {chronoEvents.map(ev => {
        const info = ev.isFamilyEvent ? familyInfo() : impInfo(ev.importance);
        return (
          <div key={ev.id} style={{ ...card, borderLeft: `5px solid ${info.color}`, padding: isMobile ? "16px 14px" : "22px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              <Badge level={ev.importance} size="sm" />
              <span style={{ fontSize: 13, color: C.muted }}>{formatDate(ev.date)}</span>
            </div>
            <h3 style={{ ...serif, fontSize: 21, margin: "0 0 8px", color: C.text }}>{ev.isFamilyEvent ? ev.eventName : `${ev.childName}'s ${ev.eventName}`}</h3>
            {ev.isFamilyEvent && ev.family && <div style={{ fontSize: 13, color: C.family, fontWeight: 700, marginBottom: 8 }}>Hosted by {ev.family}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: ev.notes ? 12 : 14 }}>
              {ev.time     && <div style={{ fontSize: 13, color: C.muted }}>🕐 {ev.time}</div>}
              {ev.location && <div style={{ fontSize: 13 }}><a href="#" onClick={e2 => { e2.preventDefault(); openMapsLink(ev.lat && ev.lng ? `https://www.google.com/maps?q=${ev.lat},${ev.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.location)}`); }} style={{ color: C.terra, textDecoration: "none", fontWeight: 700, cursor: "pointer" }}>📍 {ev.location} →</a></div>}
            </div>
            {ev.notes && <div style={{ padding: "12px 16px", backgroundColor: C.cream, borderRadius: 10, fontSize: 14, color: C.text, lineHeight: 1.7, fontStyle: "italic", marginBottom: 14 }}>"{ev.notes}"</div>}
            <div style={{ padding: "10px 16px", backgroundColor: info.bg, borderRadius: 10, fontSize: 13, color: info.color, fontWeight: 700, borderLeft: `3px solid ${info.color}`, marginBottom: 12 }}>💚 {info.msg}</div>
            {(() => {
              const [cy, cm, cd] = ev.date.split("-").map(Number);
              const gcalDay = `https://calendar.google.com/calendar/r/day/${cy}/${cm}/${cd}`;
              const calBtns = (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => addToGoogleCalendar(ev)} style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.green}`, backgroundColor: C.white, color: C.green, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>📅 Re-add to Google</button>
                  <button onClick={() => addToCalendar(ev)}       style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.muted}`, backgroundColor: C.white, color: C.muted, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>📅 Apple Calendar</button>
                </div>
              );
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {!rsvpMap[ev.id] && (
                    <>
                      <a href={gcalDay} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: C.muted, textDecoration: "none", fontWeight: 600 }}>📅 Check your calendar →</a>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button onClick={() => { setRsvp(ev.id, "yes"); addToGoogleCalendar(ev); }} style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `2px solid ${C.green}`, backgroundColor: C.white, color: C.green, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>✓ We'll be there!</button>
                        <button onClick={() => setRsvp(ev.id, "maybe")} style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `2px solid ${C.terra}`, backgroundColor: C.white, color: C.terra, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>◎ Maybe</button>
                      </div>
                    </>
                  )}
                  {rsvpMap[ev.id] === "yes" && (
                    <>
                      <div style={{ padding: "10px 14px", borderRadius: 10, backgroundColor: C.greenLight, border: `2px solid ${C.green}`, color: C.green, fontWeight: 700, fontSize: 13, textAlign: "center" }}>
                        ✓ You're coming! <button onClick={() => setRsvp(ev.id, null)} style={{ background: "none", border: "none", color: C.muted, fontSize: 11, cursor: "pointer", marginLeft: 8 }}>change</button>
                      </div>
                      {calBtns}
                    </>
                  )}
                  {rsvpMap[ev.id] === "maybe" && (
                    <>
                      <div style={{ padding: "10px 14px", borderRadius: 10, backgroundColor: C.terraLight, border: `2px solid ${C.terra}`, color: C.terra, fontWeight: 700, fontSize: 13, textAlign: "center" }}>
                        ◎ Maybe — we'll try! <button onClick={() => setRsvp(ev.id, null)} style={{ background: "none", border: "none", color: C.muted, fontSize: 11, cursor: "pointer", marginLeft: 8 }}>change</button>
                      </div>
                      {calBtns}
                    </>
                  )}
                </div>
              );
            })()}
            {(() => {
              const attending = Object.entries(familyRsvpMap[ev.id] || {})
                .filter(([, s]) => s === "yes")
                .map(([fid]) => families.find(f => f.id === parseInt(fid))?.name.split(" & ")[0])
                .filter(Boolean);
              if (!attending.length) return null;
              return <div style={{ marginTop: 10, fontSize: 13, color: C.muted }}>Also coming: <strong style={{ color: C.green }}>{attending.join(", ")}</strong></div>;
            })()}
          </div>
        );
      })}

      <div style={{ ...card, textAlign: "center", backgroundColor: C.greenLight, border: `1.5px solid ${C.green}` }}>
        <p style={{ color: C.green, margin: 0, lineHeight: 1.8, fontSize: 15 }}>This page lives at <strong>grandivite.com</strong> — bookmark it!<br /><strong>Questions? Just call or text the family. 💚</strong></p>
      </div>
    </div>
    );
  };

  // ── SHELL ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Lato', sans-serif", backgroundColor: C.cream, minHeight: "100vh", color: C.text }}>
      {editingEvent && (
        <EditModal
          event={editingEvent}
          onSave={saveEdit}
          onClose={() => setEditingEvent(null)}
          familyChildren={families.find(f => f.id === (editingEvent?.family_id || editingEvent?.familyId))?.children || []}
          noteLabel={noteLabel}
        />
      )}
      {showNudgeModal && (
        <NudgeDraftsModal
          drafts={nudgeDrafts}
          onDraftChange={(name, val) => setNudgeDrafts(p => ({ ...p, [name]: val }))}
          pendingFamilies={nudgePending}
          isMobile={isMobile}
          onClose={() => setShowNudgeModal(false)}
        />
      )}
      {showDraftModal && (
        <DigestDraftModal
          draft={aiDraft}
          onDraftChange={setAiDraft}
          isMobile={isMobile}
          onClose={() => setShowDraftModal(false)}
          onSend={() => {
            const subject = encodeURIComponent(`The Family's ${cycle?.month_label} Highlights — `);
            window.open(`mailto:${grandparents.emails.join(",")}?subject=${subject}&body=${encodeURIComponent(aiDraft)}`);
            setShowDraftModal(false);
            handleDigest();
          }}
        />
      )}
      <div style={{ backgroundColor: C.white, borderBottom: `1px solid ${C.border}`, padding: `12px ${isMobile ? 14 : 24}px`, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 12px rgba(44,74,62,0.07)", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ ...serif, fontSize: isMobile ? 17 : 20, color: C.green, fontWeight: 700, whiteSpace: "nowrap" }}>{orgData?.app_title || orgData?.name || "Grandivite"}</span>
          {!isMobile && <span style={{ fontSize: 11, color: C.muted, letterSpacing: "0.5px", fontWeight: 700, whiteSpace: "nowrap" }}>GRANDIVITE.COM</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {!isMobile && <span style={{ fontSize: 12, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{googleUser?.email}</span>}
          <Btn variant="ghost" style={{ padding: "6px 12px", fontSize: 12, flexShrink: 0 }} onClick={async () => { await supabase.auth.signOut(); setAuth(null); setGoogleUser(null); }}>Sign Out</Btn>
        </div>
      </div>
      <div style={{ backgroundColor: C.white, borderBottom: `1px solid ${C.border}`, display: "flex", overflowX: "auto" }}>
        {TABS.map(s => (
          <button key={s.n} onClick={() => setStep(s.n)} style={{ border: "none", background: "none", cursor: "pointer", padding: "14px 18px", fontSize: 13, fontWeight: 700, color: step === s.n ? C.green : C.muted, borderBottom: step === s.n ? `3px solid ${C.terra}` : "3px solid transparent", whiteSpace: "nowrap", transition: "all 0.2s", fontFamily: "'Lato', sans-serif" }}>
            {s.label}
          </button>
        ))}
      </div>
      <div style={{ maxWidth: 700, margin: "0 auto", padding: isMobile ? "16px 12px 80px" : "28px 20px 72px" }}>
        {step === 1 && Step1()}
        {step === 2 && Step2()}
        {step === 3 && Step3()}
        {step === 4 && Step4()}
        {step === 5 && <CalendarView events={events} rsvpMap={rsvpMap} families={families} />}
      </div>
    </div>
  );
}
