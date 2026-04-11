import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ── SUPABASE CONFIG ───────────────────────────────────────────────────────────
// Get these from: supabase.com → your project → Settings → API
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// ─────────────────────────────────────────────────────────────────────────────

// ── GOOGLE MAPS CONFIG ────────────────────────────────────────────────────────
// Get from: console.cloud.google.com → APIs & Services → Credentials
// Enable: "Places API (New)" and "Maps JavaScript API" for this key
// Restrict key to your domain (claytonlink.com) for security
const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  cream: "#FDF8F2", green: "#2C4A3E", greenLight: "#E8F0EE",
  terra: "#E8936A", terraLight: "#FDF0E8", terraBorder: "#F0B898",
  brown: "#8B6F47", brownLight: "#F5EDE3", brownBorder: "#C4A882",
  greenBorder: "#A8C4BC", white: "#FFFFFF", text: "#2A2A2A",
  muted: "#7A7A7A", border: "#E8E0D6", red: "#C0392B", redLight: "#FDECEA",
};

const FAMILIES = [
  { id: 1, name: "Paul & Danielle Clayton", color: "#2C4A3E", emails: ["pbclayton@gmail.com", "daniellezclayton@yahoo.com"],  children: ["Paul Z.", "Benjamin", "Ruby", "Calvin", "Toby", "Samuel"] },
  { id: 2, name: "Spencer & Kim Affleck",   color: "#E8936A", emails: ["spenceraffleck@hotmail.com", "kimaffleck@gmail.com"], children: ["Spencer Jr.", "Russell", "James", "Andrew", "Rachel", "Abigail"] },
  { id: 3, name: "Chris & JaCee Clayton",   color: "#8B6F47", emails: ["chrisbclayton@gmail.com", "jaceec@gmail.com"],        children: ["Bryson", "Lily", "Landon", "Wesley", "Adalyn"] },
  { id: 4, name: "Katie Clayton",           color: "#5B8A7A", emails: ["kkqtpie@gmail.com"],                                  children: [] },
  { id: 5, name: "Kyle & Elise Clayton",    color: "#C46B3A", emails: ["kandeclayton@gmail.com", "kmanclayton@gmail.com"],    children: ["Millie", "Amy", "Daphne", "Kyle R.", "Joshua"] },
  { id: 6, name: "Mitch & Kelsey Gill",     color: "#6B5B8A", emails: ["mitchgill22@gmail.com", "kelcgill@gmail.com"],        children: ["Bradley", "Henry", "Anthony", "Melanie"] },
];

// Coordinator access — full admin tabs, send digest, reset month
const COORDINATOR_EMAILS = ["chrisbclayton@gmail.com", "jaceec@gmail.com", "pbclayton@gmail.com"];

// Both grandparent emails — digest goes to both
const GRANDPARENTS = { emails: ["pnsleep@gmail.com", "hbeec@gmail.com"] };
const BLANK_ROW = () => ({ childName: "", eventName: "", date: "", time: "", location: "", lat: null, lng: null, importance: "", notes: "" });

// Resolve a signed-in Google email to a role + family
function resolveAuth(email) {
  if (!email) return null;
  const lower = email.toLowerCase();
  if (COORDINATOR_EMAILS.map(e => e.toLowerCase()).includes(lower)) return { role: "coordinator" };
  const family = FAMILIES.find(f => f.emails.map(e => e.toLowerCase()).includes(lower));
  if (family) return { role: "family", family };
  return null; // email not recognized
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function impInfo(level) {
  if (level === 3) return { label: "1:1 Time",    stars: "⭐⭐⭐", color: C.terra, bg: C.terraLight, border: C.terraBorder, msg: "This is a chance for just you two — it would mean everything to them." };
  if (level === 2) return { label: "Milestone",   stars: "⭐⭐",   color: C.green, bg: C.greenLight, border: C.greenBorder, msg: "This is a once-in-a-lifetime moment — we'd love you there." };
  return              { label: "Group Event", stars: "⭐",     color: C.brown, bg: C.brownLight, border: C.brownBorder, msg: "Come cheer with the whole family!" };
}

const formatDate  = d => d ? new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "long",  month: "long",  day: "numeric" }) : "";
const formatShort = d => d ? new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
const serif = { fontFamily: "'Playfair Display', serif" };
const card  = { backgroundColor: C.white, borderRadius: 16, padding: 24, boxShadow: "0 2px 20px rgba(44,74,62,0.07)", border: `1px solid ${C.border}`, marginBottom: 16 };
const inp   = { width: "100%", padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontFamily: "'Lato', sans-serif", fontSize: 14, color: C.text, backgroundColor: C.white, outline: "none", boxSizing: "border-box" };
const lbl   = { display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.8px", color: C.muted, textTransform: "uppercase", marginBottom: 6 };

// Normalize DB row (snake_case) → consistent camelCase shape used in UI
function norm(ev) {
  return {
    ...ev,
    childName: ev.child_name  || ev.childName  || "",
    eventName: ev.event_name  || ev.eventName  || "",
    familyId:  ev.family_id   || ev.familyId,
    family:    ev.family_name || ev.family     || "",
  };
}

// ── SUPABASE DATA LAYER ───────────────────────────────────────────────────────
const db = {
  fetchCycle: async () => {
    const { data } = await supabase.from("cycles").select("*").order("created_at", { ascending: false }).limit(1).single();
    return data;
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
      child_name: row.childName, event_name: row.eventName, date: row.date,
      time: row.time || null, location: row.location || null,
      lat: row.lat || null, lng: row.lng || null,
      importance: parseInt(row.importance), notes: row.notes || null,
    }).select().single();
    return data;
  },
  updateEvent: async (id, fields) => {
    await supabase.from("events").update({
      child_name: fields.childName, event_name: fields.eventName, date: fields.date,
      time: fields.time || null, location: fields.location || null,
      lat: fields.lat || null,   lng: fields.lng || null,
      importance: parseInt(fields.importance), notes: fields.notes || null,
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

function Badge({ level, size = "md" }) {
  const i = impInfo(level);
  return <span style={{ backgroundColor: i.bg, color: i.color, border: `1px solid ${i.border}`, borderRadius: 20, padding: size === "sm" ? "3px 10px" : "5px 14px", fontSize: size === "sm" ? 11 : 12, fontWeight: 700, whiteSpace: "nowrap", display: "inline-block" }}>{i.stars} {i.label}</span>;
}

function Spinner() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: C.green, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 36 }}>🌿</div>
      <div style={{ color: C.white, fontSize: 15, fontFamily: "'Lato', sans-serif", opacity: 0.8 }}>Loading Clayton Link…</div>
    </div>
  );
}

function EditModal({ event, onSave, onClose, familyChildren }) {
  const e = norm(event);
  const [draft, setDraft] = useState({
    childName: e.childName,
    eventName: e.eventName,
    date: e.date,
    time: e.time || "",
    location: e.location || "",
    lat: e.lat ?? null,
    lng: e.lng ?? null,
    importance: e.importance || "",
    notes: e.notes || "",
  });

  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const valid = draft.childName && draft.eventName && draft.date && draft.importance;

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ backgroundColor: C.white, borderRadius: 20, padding: 28, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 style={{ ...serif, fontSize: 22, margin: 0, color: C.green }}>Edit Event</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.muted }}>✕</button>
        </div>

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

        <div style={{ marginBottom: 16 }}>
          <span style={lbl}>Event / Activity</span>
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

        <div style={{ marginBottom: 16 }}>
          <span style={lbl}>Priority</span>
          <select style={inp} value={draft.importance} onChange={e => set("importance", e.target.value)}>
            <option value="">Select priority...</option>
            <option value="3">⭐⭐⭐ Intentional 1:1 Time</option>
            <option value="2">⭐⭐ Milestone</option>
            <option value="1">⭐ Group Event</option>
          </select>
        </div>

        <div style={{ marginBottom: 24 }}>
          <span style={lbl}>A Note for Nana & Papa (Optional)</span>
          <textarea style={{ ...inp, resize: "vertical", minHeight: 72 }} value={draft.notes} onChange={e => set("notes", e.target.value)} />
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="accent" disabled={!valid} onClick={() => { onSave({ ...event, ...draft }); onClose(); }}>Save Changes</Btn>
        </div>
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
          fields: ["formatted_address", "name", "geometry", "place_id"],
        });

        autocompleteRef.current = ac;
        listener = ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          const name = place?.name || "";
          const addr = place?.formatted_address || "";
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
      setMagicError("That email isn't registered with Clayton Link. Contact Chris or JaCee.");
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
        <h1 style={{ ...serif, fontSize: 28, color: C.green, margin: "0 0 6px" }}>Clayton Link</h1>
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
        <p style={{ color: C.muted, fontSize: 11, marginTop: 20, lineHeight: 1.6 }}>Questions? Contact Chris or JaCee.</p>
      </div>
    </div>
  );
}

function EventCard({ ev, canEdit, onEdit, onRemove, locked, isConflict = false }) {
  const e = norm(ev);
  const info = impInfo(e.importance);
  return (
    <div style={{ display: "flex", gap: 14, padding: "16px 12px", borderBottom: `1px solid ${C.border}`, alignItems: "flex-start", backgroundColor: isConflict ? "#FFFAF4" : "transparent", borderLeft: isConflict ? `4px solid ${C.terra}` : "4px solid transparent", margin: "0 -12px" }}>
      <div style={{ minWidth: 76, flexShrink: 0, backgroundColor: info.bg, color: info.color, borderRadius: 8, padding: "6px 8px", fontSize: 9, fontWeight: 700, textAlign: "center", lineHeight: 1.6 }}>{info.stars}<br />{info.label}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{e.childName} — {e.eventName}</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>{formatDate(e.date)}{e.time ? ` · ${e.time}` : ""}</div>
        {e.location && <div style={{ fontSize: 12, marginBottom: 4 }}><a href={e.lat && e.lng ? `https://maps.apple.com/?ll=${e.lat},${e.lng}&q=${encodeURIComponent(e.location)}` : `https://maps.apple.com/?q=${encodeURIComponent(e.location)}`} target="_blank" rel="noreferrer" style={{ color: C.terra, textDecoration: "none", fontWeight: 600 }}>📍 {e.location}</a></div>}
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

function CalendarView({ events, rsvpMap = {} }) {
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const famColors = Object.fromEntries(FAMILIES.map(f => [f.id, f.color]));
  const byDay = {};
  events.forEach(ev => {
    const e = norm(ev);
    const d = parseInt(e.date.split("-")[2]);
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push(e);
  });
  const overlapDays = Object.entries(byDay).filter(([, evs]) => new Set(evs.map(e => e.familyId)).size > 1).map(([d]) => parseInt(d));
  const cells = [...Array(3).fill(null), ...Array.from({ length: 30 }, (_, i) => i + 1)];

  return (
    <div>
      <h2 style={{ ...serif, fontSize: 28, color: C.green, margin: "0 0 6px" }}>Family Calendar</h2>
      <p style={{ color: C.muted, margin: "0 0 20px", lineHeight: 1.6 }}>April 2026 — coordinate before the digest goes to Nana and Papa.</p>
      {events.length === 0 && <div style={{ ...card, textAlign: "center", padding: 40, color: C.muted }}>No events submitted yet.</div>}
      {overlapDays.length > 0 && (
        <div style={{ ...card, backgroundColor: C.terraLight, border: `1.5px solid ${C.terraBorder}` }}>
          <div style={{ fontWeight: 700, color: C.terra, marginBottom: 6, fontSize: 13 }}>⚠️ Overlapping Events</div>
          <p style={{ margin: 0, fontSize: 13, color: C.text, lineHeight: 1.6 }}>Multiple families have events on {overlapDays.map(d => `April ${d}`).join(" and ")}.</p>
        </div>
      )}
      <div style={{ ...card, padding: 16, marginBottom: 16 }}>
        <div style={lbl}>Families</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {FAMILIES.map(f => <span key={f.id} style={{ fontSize: 12, fontWeight: 700, padding: "5px 14px", borderRadius: 20, backgroundColor: f.color + "18", color: f.color, border: `1px solid ${f.color}40`, whiteSpace: "nowrap" }}>{f.name}</span>)}
        </div>
      </div>
      <div style={{ ...card, padding: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
          {DAY_NAMES.map(d => <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: C.muted, padding: "6px 2px" }}>{d}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
          {cells.map((day, i) => {
            const dayEvs = day ? (byDay[day] || []) : [];
            const isOverlap = day && overlapDays.includes(day);
            return (
              <div key={i} style={{ minHeight: 68, borderRadius: 8, padding: "4px 3px", backgroundColor: day ? (isOverlap ? C.terraLight : C.cream) : "transparent", border: day ? `1.5px solid ${isOverlap ? C.terraBorder : C.border}` : "none", opacity: day ? 1 : 0 }}>
                {day && <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: isOverlap ? C.terra : C.muted, textAlign: "right", marginBottom: 3 }}>{day}</div>
                  {dayEvs.slice(0, 2).map(ev => (
                    <div key={ev.id} title={`${ev.childName} — ${ev.eventName}`} style={{ backgroundColor: (famColors[ev.familyId] || C.green) + "22", color: famColors[ev.familyId] || C.green, borderLeft: `3px solid ${famColors[ev.familyId] || C.green}`, borderRadius: 4, padding: "2px 4px", fontSize: 9, fontWeight: 700, marginBottom: 2, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                      {impInfo(ev.importance).stars} {ev.childName}
                    </div>
                  ))}
                  {dayEvs.length > 2 && <div style={{ fontSize: 9, color: C.muted, fontWeight: 700 }}>+{dayEvs.length - 2}</div>}
                </>}
              </div>
            );
          })}
        </div>
      </div>
      {events.length > 0 && (
        <div style={card}>
          <h3 style={{ ...serif, fontSize: 18, margin: "0 0 16px" }}>All Events This Month</h3>
          {[...events].map(norm).sort((a, b) => new Date(a.date) - new Date(b.date)).map(ev => (
            <div key={ev.id} style={{ display: "flex", gap: 14, padding: "14px 0", borderBottom: `1px solid ${C.border}`, alignItems: "flex-start" }}>
              <div style={{ minWidth: 52, flexShrink: 0, textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: famColors[ev.familyId] || C.green }}>{formatShort(ev.date)}</div>
                {ev.time && <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{ev.time}</div>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{ev.childName} — {ev.eventName}</span>
                  <Badge level={ev.importance} size="sm" />
                </div>
                {ev.location && <div style={{ fontSize: 12 }}><a href={ev.lat && ev.lng ? `https://maps.apple.com/?ll=${ev.lat},${ev.lng}&q=${encodeURIComponent(ev.location)}` : `https://maps.apple.com/?q=${encodeURIComponent(ev.location)}`} target="_blank" rel="noreferrer" style={{ color: C.terra, textDecoration: "none" }}>📍 {ev.location}</a></div>}
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
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function ClaytonLink() {
  const [auth, setAuth]                   = useState(null);   // { role, family? }
  const [googleUser, setGoogleUser]       = useState(null);   // Supabase user object
  const [unrecognized, setUnrecognized]   = useState(false);  // email not in FAMILIES
  const [step, setStep]                   = useState(1);
  const [loading, setLoading]             = useState(true);
  const [cycle, setCycle]                 = useState(null);
  const [events, setEvents]               = useState([]);
  const [rsvpMap, setRsvpMap]             = useState({});
  const [editingEvent, setEditingEvent]   = useState(null);
  const [formRows, setFormRows]           = useState([BLANK_ROW()]);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [promptSent, setPromptSent]       = useState(false);
  const [reminderSent, setReminderSent]   = useState(false);

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
        const resolved = resolveAuth(session.user.email);
        if (resolved) { setAuth(resolved); setStep(resolved.role === "coordinator" ? 1 : 2); }
        else { setUnrecognized(true); }
      }
      const c = await db.fetchCycle();
      if (c) {
        setCycle(c);
        const [evs, rvps] = await Promise.all([db.fetchEvents(c.id), db.fetchRsvps()]);
        setEvents(evs);
        setRsvpMap(rvps);
      }
      setLoading(false);
    })();

    // Listen for auth state changes (e.g. after Google redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setGoogleUser(session.user);
        const resolved = resolveAuth(session.user.email);
        if (resolved) { setAuth(resolved); setStep(resolved.role === "coordinator" ? 1 : 2); }
        else { setUnrecognized(true); }
      } else {
        setGoogleUser(null); setAuth(null); setUnrecognized(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Real-time subscription — all devices stay in sync automatically
  useEffect(() => {
    if (!cycle?.id) return;
    const channel = supabase.channel("cl-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "events",  filter: `cycle_id=eq.${cycle.id}` }, () => { db.fetchEvents(cycle.id).then(setEvents); })
      .on("postgres_changes", { event: "*", schema: "public", table: "rsvps"                                       }, () => { db.fetchRsvps().then(setRsvpMap); })
      .on("postgres_changes", { event: "*", schema: "public", table: "cycles",  filter: `id=eq.${cycle.id}`       }, p  => { if (p.new) setCycle(p.new); })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [cycle?.id]);

  if (loading) return <Spinner />;

  // Email not in FAMILIES or COORDINATOR_EMAILS
  if (unrecognized) return (
    <div style={{ minHeight: "100vh", backgroundColor: C.green, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ backgroundColor: C.white, borderRadius: 24, padding: "48px 40px", maxWidth: 380, width: "100%", textAlign: "center", boxShadow: "0 24px 80px rgba(0,0,0,0.25)" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🌿</div>
        <h2 style={{ ...serif, fontSize: 22, color: C.green, margin: "0 0 12px" }}>Not Recognized</h2>
        <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7, margin: "0 0 24px" }}>The account <strong>{googleUser?.email}</strong> isn't registered with Clayton Link. Contact Chris or JaCee to get access.</p>
        <Btn variant="outline" full onClick={async () => { await supabase.auth.signOut(); setUnrecognized(false); }}>Sign Out</Btn>
      </div>
    </div>
  );

  if (!auth) return <AuthScreen />;

  const isCoord    = auth.role === "coordinator";
  const locked     = cycle?.locked     || false;
  const digestSent = cycle?.digest_sent || false;

  const submittedFamilyIds = new Set(events.map(e => e.family_id || e.familyId));
  const familiesWithStatus = FAMILIES.map(f => ({ ...f, submitted: submittedFamilyIds.has(f.id) }));
  const sortedEvents       = [...events].map(norm).sort((a, b) => b.importance - a.importance || new Date(a.date) - new Date(b.date));
  const myEvents           = isCoord ? [] : events.filter(e => (e.family_id || e.familyId) === auth.family?.id).map(norm);

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
  const setRsvp  = async (eventId, status) => { setRsvpMap(p => ({ ...p, [eventId]: status })); await db.upsertRsvp(eventId, status); };
  const handleLock   = async () => { setCycle(p => ({ ...p, locked: true }));       await db.updateCycle(cycle.id, { locked: true }); };
  const handleDigest = async () => { setCycle(p => ({ ...p, digest_sent: true }));  await db.updateCycle(cycle.id, { digest_sent: true }); };
  const handleReset  = async () => {
    if (!window.confirm("Clear all events and reset for the new month?")) return;
    setEvents([]); setRsvpMap({}); setCycle(p => ({ ...p, locked: false, digest_sent: false }));
    setFormRows([BLANK_ROW()]); setFormSubmitted(false);
    await db.resetCycle(cycle.id);
  };
  const handleSubmit = async () => {
    const valid = formRows.filter(r => r.childName && r.eventName && r.date && r.importance);
    if (!valid.length) return;
    const fam = auth.family;
    const familyName = fam.name.split(" ").slice(0, 2).join(" ");
    for (const row of valid) {
      const data = await db.insertEvent(cycle.id, fam.id, familyName, row);
      if (data) setEvents(p => [...p, data]);
    }
    setFormSubmitted(true);
  };
  const updateRow = (i, f, v) => setFormRows(rows => rows.map((r, idx) => idx === i ? { ...r, [f]: v } : r));

  const TABS = isCoord
    ? [{ n: 1, label: "1. Send Prompt" }, { n: 2, label: "2. Submit Events" }, { n: 3, label: "3. Compile & Send" }, { n: 5, label: "📅 Calendar" }, { n: 4, label: "4. Nana & Papa View" }]
    : [{ n: 2, label: "Submit Events" }, { n: 5, label: "📅 Family Calendar" }];

  // ── STEP 1 ────────────────────────────────────────────────────────────────
  const Step1 = () => (
    <div>
      <h2 style={{ ...serif, fontSize: 28, color: C.green, margin: "0 0 6px" }}>Monthly Prompt</h2>
      <p style={{ color: C.muted, margin: "0 0 24px", lineHeight: 1.6 }}>Send the monthly request to all families.</p>
      <div style={{ ...card, backgroundColor: C.green, color: C.white, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1px", opacity: 0.65, marginBottom: 4 }}>CURRENT CYCLE</div>
          <div style={{ ...serif, fontSize: 26, fontWeight: 600 }}>{cycle?.month_label || "—"}</div>
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>{cycle?.start_date} – {cycle?.end_date}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 4, fontWeight: 700, letterSpacing: "1px" }}>DEADLINE</div>
          <div style={{ ...serif, fontSize: 22, fontWeight: 600 }}>{cycle?.deadline || "—"}</div>
        </div>
      </div>
      <div style={card}>
        <h3 style={{ ...serif, fontSize: 18, margin: "0 0 16px" }}>Family Submissions</h3>
        {familiesWithStatus.map(f => (
          <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{f.name}</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20, backgroundColor: f.submitted ? C.greenLight : C.terraLight, color: f.submitted ? C.green : C.terra }}>{f.submitted ? "✓ Submitted" : "Pending"}</span>
          </div>
        ))}
        <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: C.muted }}>{familiesWithStatus.filter(f => f.submitted).length} of {FAMILIES.length} submitted</span>
          {familiesWithStatus.some(f => !f.submitted) && (
            <Btn variant="outline" style={{ padding: "6px 14px", fontSize: 12 }} onClick={() => {
              const pending = familiesWithStatus.filter(f => !f.submitted).map(f => f.emails[0]).join(",");
              const subject = encodeURIComponent("Reminder — Clayton Link Events Due Soon");
              const body    = encodeURIComponent(`Hey! Quick reminder to submit your family events on claytonlink.com. Deadline: ${cycle?.deadline}. Thanks!`);
              window.open(`mailto:${pending}?subject=${subject}&body=${body}`);
              setReminderSent(true);
            }}>{reminderSent ? "✓ Reminder Sent" : "Nudge Pending Families"}</Btn>
          )}
        </div>
      </div>
      <div style={card}>
        <h3 style={{ ...serif, fontSize: 18, margin: "0 0 16px" }}>Message Preview</h3>
        <div style={{ backgroundColor: C.cream, borderRadius: 10, padding: 20, borderLeft: `4px solid ${C.terra}`, fontStyle: "italic", color: C.text, lineHeight: 1.8, fontSize: 14 }}>
          "Hey family — it's that time! Log into <strong style={{ fontStyle: "normal" }}>claytonlink.com</strong> and submit up to 2 events per child for {cycle?.month_label}. Deadline: {cycle?.deadline}!"
        </div>
        <div style={{ marginTop: 16 }}>
          <Btn variant={promptSent ? "outline" : "accent"} onClick={() => {
            const emails  = FAMILIES.map(f => f.emails[0]).join(",");
            const subject = encodeURIComponent(`Clayton Link — ${cycle?.month_label} Events Due ${cycle?.deadline}`);
            const body    = encodeURIComponent(`Hey family!\n\nTime to submit your ${cycle?.month_label} events on Clayton Link.\n\nUp to 2 per child — deadline ${cycle?.deadline}.\nhttps://claytonlink.com\n\nLove, Chris & JaCee`);
            window.open(`mailto:${emails}?subject=${subject}&body=${body}`);
            setPromptSent(true);
          }}>{promptSent ? "✓ Prompt Sent" : "Send Monthly Prompt — Opens Email"}</Btn>
        </div>
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
        <p style={{ color: C.muted, margin: "0 0 24px", lineHeight: 1.6 }}>{fam ? `Hi ${firstName}! ` : ""}Submit up to 2 events per child for {cycle?.month_label}.</p>

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
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{[3,2,1].map(l => <Badge key={l} level={l} />)}</div>
            </div>
            {formRows.map((row, i) => (
              <div key={i} style={card}>
                <h3 style={{ ...serif, fontSize: 18, margin: "0 0 20px" }}>New Event {formRows.length > 1 ? i + 1 : ""}</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
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
                      const count = formRows.filter((r, idx) => idx !== i && r.childName === row.childName).length;
                      if (count >= 2) return <div style={{ fontSize: 11, color: C.red,   marginTop: 5, fontWeight: 700 }}>⚠️ Max 2 events reached for {row.childName}</div>;
                      if (count === 1) return <div style={{ fontSize: 11, color: C.terra, marginTop: 5, fontWeight: 700 }}>This is event 2 of 2 for {row.childName}</div>;
                      return null;
                    })()}
                  </div>
                  <div><span style={lbl}>Event / Activity</span><input style={inp} placeholder="e.g. Spring Play" value={row.eventName} onChange={e => updateRow(i, "eventName", e.target.value)} /></div>
                </div>
                <div style={{ marginBottom: 16 }}><span style={lbl}>Date</span><input style={{ ...inp, display: "block", width: "100%" }} type="date" value={row.date} onChange={e => updateRow(i, "date", e.target.value)} /></div>
                <div style={{ marginBottom: 16 }}><span style={lbl}>Time (Optional)</span><input style={{ ...inp, display: "block", width: "100%" }} type="text" placeholder="e.g. 6:30 PM" value={row.time} onChange={e => updateRow(i, "time", e.target.value)} /></div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <div>
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
                  <div>
                    <span style={lbl}>Priority</span>
                    <select style={inp} value={row.importance} onChange={e => updateRow(i, "importance", e.target.value)}>
                      <option value="">Select priority...</option>
                      <option value="3">⭐⭐⭐ Intentional 1:1 Time</option>
                      <option value="2">⭐⭐ Milestone</option>
                      <option value="1">⭐ Group Event</option>
                    </select>
                  </div>
                </div>
                <div><span style={lbl}>A Note for Nana & Papa (Optional)</span>
                  <textarea style={{ ...inp, resize: "vertical", minHeight: 72 }} placeholder="Share what makes this moment special..." value={row.notes} onChange={e => updateRow(i, "notes", e.target.value)} />
                </div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Btn variant="outline" onClick={() => setFormRows(r => [...r, BLANK_ROW()])}>+ Add Another Event</Btn>
              <Btn variant="accent" onClick={handleSubmit}>Submit Our Events →</Btn>
            </div>
          </>
        )}
      </div>
    );
  };

  // ── STEP 3 ────────────────────────────────────────────────────────────────
  const Step3 = () => (
    <div>
      <h2 style={{ ...serif, fontSize: 28, color: C.green, margin: "0 0 6px" }}>Compile & Send</h2>
      <p style={{ color: C.muted, margin: "0 0 24px", lineHeight: 1.6 }}>Review, edit, or remove events. Then lock and send to Nana and Papa.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        {[{ label: "Events",      v: events.length },
          { label: "Families In", v: familiesWithStatus.filter(f => f.submitted).length },
          { label: "Pending",     v: familiesWithStatus.filter(f => !f.submitted).length }
        ].map((s, i) => (
          <div key={i} style={{ ...card, textAlign: "center", padding: 20, marginBottom: 0 }}>
            <div style={{ ...serif, fontSize: 34, color: C.green, fontWeight: 700 }}>{s.v}</div>
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
                  <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: FAMILIES.find(f => f.id === ev.familyId)?.color || C.green, flexShrink: 0, display: "inline-block" }} />
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

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {!locked
          ? <Btn variant="primary" disabled={events.length === 0} onClick={handleLock}>Lock Calendar</Btn>
          : !digestSent
            ? <>
                <Btn variant="outline" onClick={() => setStep(4)}>Preview Nana & Papa View</Btn>
                <Btn variant="accent" onClick={() => {
                  const subject = encodeURIComponent(`The Family's ${cycle?.month_label} Highlights — Clayton Link`);
                  const lines   = sortedEvents.map(ev => {
                    const imp = ev.importance === 3 ? "⭐⭐⭐ 1:1 Time" : ev.importance === 2 ? "⭐⭐ Milestone" : "⭐ Group Event";
                    return `${imp}\n${ev.childName} — ${ev.eventName}\n${formatDate(ev.date)}${ev.time ? " · " + ev.time : ""}${ev.location ? "\n📍 " + ev.location : ""}${ev.notes ? `\n"${ev.notes}"` : ""}\n`;
                  }).join("\n");
                  const body    = encodeURIComponent(`Hi Nana and Papa!\n\nHere's what's coming up in ${cycle?.month_label}. We love you!\n\n${lines}\nFull page: https://claytonlink.com\n\nLove, The Clayton Family`);
                  window.open(`mailto:${GRANDPARENTS.emails.join(",")}?subject=${subject}&body=${body}`);
                  handleDigest();
                }}>Send Digest to Nana & Papa →</Btn>
              </>
            : <div style={{ backgroundColor: C.greenLight, border: `1px solid ${C.green}`, borderRadius: 10, padding: "14px 20px", fontSize: 14, color: C.green, fontWeight: 700 }}>✓ Digest sent to Nana and Papa — {cycle?.month_label} · claytonlink.com</div>
        }
      </div>
    </div>
  );

  // ── STEP 4 (Nana & Papa view) ─────────────────────────────────────────────
  const Step4 = () => (
    <div>
      <div style={{ backgroundColor: C.green, borderRadius: 20, padding: "36px 24px", textAlign: "center", color: C.white, marginBottom: 24 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🌿</div>
        <h2 style={{ ...serif, fontSize: 30, margin: "0 0 10px", fontWeight: 700 }}>Hi Nana and Papa!</h2>
        <p style={{ margin: "0 0 16px", opacity: 0.88, fontSize: 15, lineHeight: 1.7 }}>Here's what's coming up with the family this month.<br />We love you and we'd love to share these moments with you.</p>
        <div style={{ fontSize: 11, opacity: 0.65, letterSpacing: "1.2px", fontWeight: 700 }}>{cycle?.month_label?.toUpperCase()} · CLAYTONLINK.COM</div>
      </div>

      {sortedEvents.map(ev => {
        const info = impInfo(ev.importance);
        return (
          <div key={ev.id} style={{ ...card, borderLeft: `5px solid ${info.color}`, padding: "22px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              <Badge level={ev.importance} size="sm" />
              <span style={{ fontSize: 13, color: C.muted }}>{formatDate(ev.date)}</span>
            </div>
            <h3 style={{ ...serif, fontSize: 21, margin: "0 0 8px", color: C.text }}>{ev.childName}'s {ev.eventName}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: ev.notes ? 12 : 14 }}>
              {ev.time     && <div style={{ fontSize: 13, color: C.muted }}>🕐 {ev.time}</div>}
              {ev.location && <div style={{ fontSize: 13 }}><a href={ev.lat && ev.lng ? `https://maps.apple.com/?ll=${ev.lat},${ev.lng}&q=${encodeURIComponent(ev.location)}` : `https://maps.apple.com/?q=${encodeURIComponent(ev.location)}`} target="_blank" rel="noreferrer" style={{ color: C.terra, textDecoration: "none", fontWeight: 700 }}>📍 {ev.location} →</a></div>}
            </div>
            {ev.notes && <div style={{ padding: "12px 16px", backgroundColor: C.cream, borderRadius: 10, fontSize: 14, color: C.text, lineHeight: 1.7, fontStyle: "italic", marginBottom: 14 }}>"{ev.notes}"</div>}
            <div style={{ padding: "10px 16px", backgroundColor: info.bg, borderRadius: 10, fontSize: 13, color: info.color, fontWeight: 700, borderLeft: `3px solid ${info.color}`, marginBottom: 12 }}>💚 {info.msg}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {!rsvpMap[ev.id] && (
                <>
                  <button onClick={() => setRsvp(ev.id, "yes")}   style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `2px solid ${C.green}`, backgroundColor: C.white, color: C.green, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>✓ We'll be there!</button>
                  <button onClick={() => setRsvp(ev.id, "maybe")} style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `2px solid ${C.terra}`, backgroundColor: C.white, color: C.terra, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Lato', sans-serif" }}>◎ Maybe</button>
                </>
              )}
              {rsvpMap[ev.id] === "yes" && (
                <div style={{ flex: 1, padding: "10px 14px", borderRadius: 10, backgroundColor: C.greenLight, border: `2px solid ${C.green}`, color: C.green, fontWeight: 700, fontSize: 13, textAlign: "center" }}>
                  ✓ You're coming! <button onClick={() => setRsvp(ev.id, null)} style={{ background: "none", border: "none", color: C.muted, fontSize: 11, cursor: "pointer", marginLeft: 8 }}>change</button>
                </div>
              )}
              {rsvpMap[ev.id] === "maybe" && (
                <div style={{ flex: 1, padding: "10px 14px", borderRadius: 10, backgroundColor: C.terraLight, border: `2px solid ${C.terra}`, color: C.terra, fontWeight: 700, fontSize: 13, textAlign: "center" }}>
                  ◎ Maybe — we'll try! <button onClick={() => setRsvp(ev.id, null)} style={{ background: "none", border: "none", color: C.muted, fontSize: 11, cursor: "pointer", marginLeft: 8 }}>change</button>
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div style={{ ...card, textAlign: "center", backgroundColor: C.greenLight, border: `1.5px solid ${C.green}` }}>
        <p style={{ color: C.green, margin: 0, lineHeight: 1.8, fontSize: 15 }}>This page lives at <strong>claytonlink.com</strong> — bookmark it!<br /><strong>Questions? Just call or text the family. 💚</strong></p>
      </div>
    </div>
  );

  // ── SHELL ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Lato', sans-serif", backgroundColor: C.cream, minHeight: "100vh", color: C.text }}>
      {editingEvent && (
        <EditModal
          event={editingEvent}
          onSave={saveEdit}
          onClose={() => setEditingEvent(null)}
          familyChildren={isCoord ? [] : auth.family?.children}
        />
      )}
      <div style={{ backgroundColor: C.white, borderBottom: `1px solid ${C.border}`, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 12px rgba(44,74,62,0.07)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ ...serif, fontSize: 20, color: C.green, fontWeight: 700 }}>Clayton Link</span>
          <span style={{ fontSize: 11, color: C.muted, letterSpacing: "0.5px", fontWeight: 700 }}>CLAYTONLINK.COM</span>
        </div>
        <span style={{ fontSize: 12, color: C.muted, marginRight: 4 }}>{googleUser?.email}</span>
        <Btn variant="ghost" style={{ padding: "6px 12px", fontSize: 12 }} onClick={async () => { await supabase.auth.signOut(); setAuth(null); setGoogleUser(null); }}>Sign Out</Btn>
      </div>
      <div style={{ backgroundColor: C.white, borderBottom: `1px solid ${C.border}`, display: "flex", overflowX: "auto" }}>
        {TABS.map(s => (
          <button key={s.n} onClick={() => setStep(s.n)} style={{ border: "none", background: "none", cursor: "pointer", padding: "14px 18px", fontSize: 13, fontWeight: 700, color: step === s.n ? C.green : C.muted, borderBottom: step === s.n ? `3px solid ${C.terra}` : "3px solid transparent", whiteSpace: "nowrap", transition: "all 0.2s", fontFamily: "'Lato', sans-serif" }}>
            {s.label}
          </button>
        ))}
      </div>
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "28px 20px 72px" }}>
        {step === 1 && Step1()}
        {step === 2 && Step2()}
        {step === 3 && Step3()}
        {step === 4 && Step4()}
        {step === 5 && <CalendarView events={events} rsvpMap={rsvpMap} />}
      </div>
    </div>
  );
}
