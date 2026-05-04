import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const C = {
  primary:      "#2C5F5A",
  primaryLight: "#E5F0EF",
  primaryBorder:"#A8C9C6",
  accent:       "#E07A5F",
  accentLight:  "#FDEEE9",
  cream:        "#FDFCFA",
  white:        "#FFFFFF",
  text:         "#1A2A28",
  muted:        "#5C6B6A", // darkened from #6B7B79 for AA compliance
  border:       "#E2DAD4",
  red:          "#C0392B",
};
const serif = { fontFamily: "'Playfair Display', serif" };
const sans  = { fontFamily: "'Lato', sans-serif" };
const inp   = { width: "100%", padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontFamily: "'Lato', sans-serif", fontSize: 14, color: C.text, backgroundColor: C.white, outline: "none", boxSizing: "border-box" };
const lbl   = { display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.8px", color: C.muted, textTransform: "uppercase", marginBottom: 6 };

const EMOJI_PRESETS = ["🌿", "🏡", "🌳", "💚", "🌻", "🌸", "⭐", "🎉", "❤️", "🌎", "🦋", "🏔️"];
const COLOR_PRESETS = [
  "#2C5F5A", "#2C4A3E", "#3D5A80", "#5B4FCF",
  "#E07A5F", "#E8936A", "#D4846A", "#C46B3A",
  "#6B9FA8", "#5B8A7A", "#9B8FBD", "#8B6F47",
];

function generateOrgId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function generateSlug(name) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

export default function OnboardingPage() {
  const [session, setSession] = useState(undefined);
  const [step, setStep]       = useState(1); // 1=name, 2=branding, 3=first-group, 4=done
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  // Org fields
  const [orgName,  setOrgName]  = useState("");
  const [appTitle, setAppTitle] = useState("");
  const [emoji,    setEmoji]    = useState("🌿");
  const [color,    setColor]    = useState("#2C5F5A");

  // First group fields
  const [groupName,    setGroupName]    = useState("");
  const [groupEmail,   setGroupEmail]   = useState("");
  const [groupPhone,   setGroupPhone]   = useState("");
  const [childrenRaw,  setChildrenRaw]  = useState(""); // comma-separated

  useEffect(() => {
    const link = document.createElement("link");
    link.rel  = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Lato:wght@300;400;700&display=swap";
    document.head.appendChild(link);

    (async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (!s) {
        window.location.href = "/";
        return;
      }
      // Check if already in an org — if so, send to app
      const { data: existing } = await supabase
        .from("org_members")
        .select("org_id")
        .eq("email", s.user.email.toLowerCase())
        .eq("is_active", true)
        .limit(1)
        .single();
      if (existing?.org_id) {
        window.location.href = "/app";
        return;
      }
      setSession(s);
    })();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  async function createOrg() {
    setSaving(true);
    setError("");
    const orgId = generateOrgId();
    const email = session.user.email.toLowerCase();
    const name  = session.user.user_metadata?.full_name || email.split("@")[0];

    try {
      // 1. Insert organization
      const { error: orgErr } = await supabase.from("organizations").insert({
        id:            orgId,
        slug:          generateSlug(orgName.trim()),
        name:          orgName.trim(),
        app_title:     appTitle.trim() || orgName.trim(),
        app_emoji:     emoji,
        primary_color: color,
        accent_color:  C.accent,
        digest_greeting: `Hello from the ${orgName.trim()} family!`,
        digest_footer:   "We love you and can't wait to share these moments with you.",
        digest_signoff:  `With love, The ${orgName.trim()} Family`,
        prompt_body:     `You are writing on behalf of the ${orgName.trim()} family. Keep the tone warm, personal, and celebratory.`,
        note_label:      "A Note for Our Recipients (Optional)",
      });
      if (orgErr) throw orgErr;

      // 2. Insert org_settings with sensible defaults
      const { error: settingsErr } = await supabase.from("org_settings").insert({
        org_id:              orgId,
        lookahead_days:      60,
        auto_nudge_enabled:  true,
        nudge_day_of_month:  1,
        nudge_hour_utc:      15,
        max_events_per_child: 2,
        min_notice_days:     7,
        ideal_notice_days:   14,
        importance_3_label:  "Milestone",
        importance_3_msg:    "This is a once-in-a-lifetime moment — we'd love you there.",
        importance_2_label:  "1:1 Time",
        importance_2_msg:    "This is a chance for just you two — it would mean everything to them.",
        importance_1_label:  "Group Event",
        importance_1_msg:    "Come cheer with the whole family!",
      });
      if (settingsErr) throw settingsErr;

      // 3. Add owner to org_members
      const { error: memberErr } = await supabase.from("org_members").insert({
        org_id:       orgId,
        email:        email,
        display_name: name,
        role:         "owner",
        is_active:    true,
      });
      if (memberErr) throw memberErr;

      // 4. Create first cycle
      const now    = new Date();
      const label  = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      const { error: cycleErr } = await supabase.from("cycles").insert({
        org_id:      orgId,
        month_label: label,
        locked:      false,
        digest_sent: false,
      });
      if (cycleErr) throw cycleErr;

      // 5. Create first group (if provided)
      if (groupName.trim()) {
        const { data: group, error: groupErr } = await supabase.from("groups").insert({
          org_id:     orgId,
          name:       groupName.trim(),
          color:      COLOR_PRESETS[1],
          phone:      groupPhone.trim() || null,
          active:     true,
          sort_order: 0,
          submission_cadence: "monthly",
        }).select().single();
        if (groupErr) throw groupErr;

        // Add group email member
        if (groupEmail.trim() && group?.id) {
          await supabase.from("group_members").insert({
            group_id:   group.id,
            email:      groupEmail.trim().toLowerCase(),
            is_primary: true,
          });
        }

        // Add children
        if (childrenRaw.trim() && group?.id) {
          const children = childrenRaw.split(",").map(c => c.trim()).filter(Boolean);
          for (let i = 0; i < children.length; i++) {
            await supabase.from("group_children").insert({
              group_id:   group.id,
              name:       children[i],
              sort_order: i,
            });
          }
        }
      }

      // 6. Done!
      setStep(4);
    } catch (e) {
      console.error(e);
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (session === undefined) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: C.primary, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, ...sans }}>
        <div style={{ fontSize: 40 }}>🌿</div>
        <div style={{ color: C.white, fontSize: 15, opacity: 0.8 }}>Loading…</div>
      </div>
    );
  }

  const canNext1 = orgName.trim().length >= 2;
  const canCreate = canNext1; // group is optional

  const Pill = ({ n, label }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 26, height: 26, borderRadius: "50%", backgroundColor: step >= n ? C.primary : C.border, color: step >= n ? C.white : C.muted, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{n}</div>
      <span style={{ fontSize: 12, fontWeight: 700, color: step >= n ? C.primary : C.muted }}>{label}</span>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", backgroundColor: C.primary, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, ...sans }}>
      <div style={{ backgroundColor: C.white, borderRadius: 24, padding: "44px 40px", maxWidth: 520, width: "100%", boxShadow: "0 24px 80px rgba(0,0,0,0.25)" }}>

        {/* Progress */}
        {step < 4 && (
          <div style={{ display: "flex", gap: 20, marginBottom: 32, flexWrap: "wrap" }}>
            <Pill n={1} label="Your Organization" />
            <Pill n={2} label="Branding" />
            <Pill n={3} label="First Group" />
          </div>
        )}

        {/* ── STEP 1: Org Name ── */}
        {step === 1 && (
          <>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🌿</div>
            <h2 style={{ ...serif, fontSize: 26, color: C.primary, margin: "0 0 8px" }}>Name your organization</h2>
            <p style={{ color: C.muted, fontSize: 14, margin: "0 0 28px", lineHeight: 1.6 }}>This is how your family space will be identified. You can change it later.</p>

            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Organization name</label>
              <input style={inp} placeholder="e.g. The Henderson Family" value={orgName}
                onChange={e => setOrgName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && canNext1 && setStep(2)} />
              <p style={{ fontSize: 12, color: C.muted, margin: "6px 0 0" }}>Could be your family name, a group name — whatever feels right.</p>
            </div>

            <div style={{ marginBottom: 28 }}>
              <label style={lbl}>App title (optional)</label>
              <input style={inp} placeholder={`e.g. ${orgName.trim() || "Henderson"} Link`} value={appTitle}
                onChange={e => setAppTitle(e.target.value)} />
              <p style={{ fontSize: 12, color: C.muted, margin: "6px 0 0" }}>What shows in the browser tab and app header. Defaults to org name.</p>
            </div>

            <button onClick={() => setStep(2)} disabled={!canNext1} style={{ width: "100%", padding: 14, borderRadius: 10, border: "none", backgroundColor: canNext1 ? C.primary : C.border, color: C.white, fontWeight: 700, fontSize: 15, cursor: canNext1 ? "pointer" : "not-allowed", ...sans }}>
              Next: Branding →
            </button>
            <p style={{ fontSize: 12, color: C.muted, textAlign: "center", marginTop: 16 }}>Signed in as {session?.user?.email} · <button onClick={signOut} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", textDecoration: "underline", fontSize: 12 }}>Sign out</button></p>
          </>
        )}

        {/* ── STEP 2: Branding ── */}
        {step === 2 && (
          <>
            <h2 style={{ ...serif, fontSize: 26, color: C.primary, margin: "0 0 8px" }}>Make it yours</h2>
            <p style={{ color: C.muted, fontSize: 14, margin: "0 0 28px", lineHeight: 1.6 }}>Pick an emoji and a color that feel like your family. You can customize everything later in the admin dashboard.</p>

            <div style={{ marginBottom: 24 }}>
              <label style={lbl}>Emoji</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {EMOJI_PRESETS.map(e => (
                  <button key={e} onClick={() => setEmoji(e)} style={{ width: 44, height: 44, borderRadius: 10, border: `2px solid ${emoji === e ? C.primary : C.border}`, backgroundColor: emoji === e ? C.primaryLight : C.white, fontSize: 22, cursor: "pointer" }}>
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 32 }}>
              <label style={lbl}>Primary Color</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {COLOR_PRESETS.map(c => (
                  <button key={c} onClick={() => setColor(c)} style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: c, border: `3px solid ${color === c ? C.text : "transparent"}`, cursor: "pointer", outline: color === c ? `2px solid ${c}` : "none", outlineOffset: 2 }} />
                ))}
              </div>
            </div>

            {/* Preview */}
            <div style={{ backgroundColor: color, borderRadius: 12, padding: "14px 18px", marginBottom: 28, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>{emoji}</span>
              <span style={{ ...serif, color: C.white, fontWeight: 700, fontSize: 16 }}>{appTitle || orgName || "Your Family"}</span>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, padding: 14, borderRadius: 10, border: `1.5px solid ${C.border}`, backgroundColor: C.white, color: C.muted, fontWeight: 700, fontSize: 14, cursor: "pointer", ...sans }}>← Back</button>
              <button onClick={() => setStep(3)} style={{ flex: 2, padding: 14, borderRadius: 10, border: "none", backgroundColor: C.primary, color: C.white, fontWeight: 700, fontSize: 15, cursor: "pointer", ...sans }}>Next: First Group →</button>
            </div>
          </>
        )}

        {/* ── STEP 3: First Group ── */}
        {step === 3 && (
          <>
            <h2 style={{ ...serif, fontSize: 26, color: C.primary, margin: "0 0 8px" }}>Add your first family group</h2>
            <p style={{ color: C.muted, fontSize: 14, margin: "0 0 28px", lineHeight: 1.6 }}>Groups are the family branches that submit events — e.g., "Chris & JaCee" or "The Smiths". You can add more from the admin dashboard.</p>

            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Group name</label>
              <input style={inp} placeholder="e.g. Chris & JaCee" value={groupName} onChange={e => setGroupName(e.target.value)} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Email address</label>
              <input style={inp} placeholder="family@email.com" type="email" value={groupEmail} onChange={e => setGroupEmail(e.target.value)} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Phone (optional)</label>
              <input style={inp} placeholder="15551234567" type="tel" value={groupPhone} onChange={e => setGroupPhone(e.target.value)} />
            </div>
            <div style={{ marginBottom: 28 }}>
              <label style={lbl}>Children's names (comma-separated, optional)</label>
              <input style={inp} placeholder="Emma, Liam, Sophia" value={childrenRaw} onChange={e => setChildrenRaw(e.target.value)} />
            </div>

            {error && <p style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{error}</p>}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(2)} style={{ flex: 1, padding: 14, borderRadius: 10, border: `1.5px solid ${C.border}`, backgroundColor: C.white, color: C.muted, fontWeight: 700, fontSize: 14, cursor: "pointer", ...sans }}>← Back</button>
              <button onClick={createOrg} disabled={saving || !canCreate} style={{ flex: 2, padding: 14, borderRadius: 10, border: "none", backgroundColor: canCreate ? C.primary : C.border, color: C.white, fontWeight: 700, fontSize: 15, cursor: saving || !canCreate ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, ...sans }}>
                {saving ? "Creating…" : "Create my family space →"}
              </button>
            </div>
            <p style={{ fontSize: 12, color: C.muted, textAlign: "center", marginTop: 12 }}>You can skip the group — add groups from the admin dashboard later.</p>
          </>
        )}

        {/* ── STEP 4: Done ── */}
        {step === 4 && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 60, marginBottom: 20 }}>🎉</div>
            <h2 style={{ ...serif, fontSize: 30, color: C.primary, margin: "0 0 12px" }}>You're all set!</h2>
            <p style={{ color: C.muted, fontSize: 15, lineHeight: 1.7, margin: "0 0 32px" }}>
              <strong style={{ color: C.text }}>{orgName}</strong> is ready. Head to your family app to start submitting events, or set everything up in the admin dashboard.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={() => window.location.href = "/app"} style={{ width: "100%", padding: 15, borderRadius: 10, border: "none", backgroundColor: C.primary, color: C.white, fontWeight: 700, fontSize: 15, cursor: "pointer", ...sans }}>
                Go to my family app →
              </button>
              <button onClick={() => window.location.href = "/admin"} style={{ width: "100%", padding: 15, borderRadius: 10, border: `1.5px solid ${C.primary}`, backgroundColor: "transparent", color: C.primary, fontWeight: 700, fontSize: 15, cursor: "pointer", ...sans }}>
                Open admin dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
