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
  accentText:   "#C75A3F", // AA-compliant coral for text (was #E07A5F — ratio 2.88, fails)
  accentLight:  "#FDEEE9",
  accentBorder: "#F0B898",
  cream:        "#FDFCFA",
  white:        "#FFFFFF",
  text:         "#1A2A28",
  muted:        "#5C6B6A", // darkened from #6B7B79 for AA compliance
  border:       "#E2DAD4",
  red:          "#C0392B",
};

const serif = { fontFamily: "'Playfair Display', serif" };
const sans  = { fontFamily: "'Lato', sans-serif" };

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.4-5l-6.2-5.2C29.4 35.6 26.8 36 24 36c-5.2 0-9.5-2.9-11.3-7L6 34.3C9.4 40 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.5-2.6 4.6-4.8 6l6.2 5.2C40.8 35.6 44 30.2 44 24c0-1.3-.1-2.7-.4-4z"/>
  </svg>
);

const FEATURES = [
  { icon: "📅", title: "Shared Family Calendar", body: "Every branch of the family submits their upcoming events — birthdays, recitals, games — into one shared monthly calendar." },
  { icon: "📬", title: "Grandparent Digest", body: "AI writes a warm, personalized monthly digest email and sends it to grandparents, Nana & Papa, or whoever your recipients are." },
  { icon: "✅", title: "RSVP & Confirm", body: "Recipients can RSVP to events, add them to Google Calendar or Apple Calendar, and let families know who's coming." },
  { icon: "✨", title: "AI-Polished Notes", body: "One click makes family notes warmer and more personal — Claude rewrites them in your family's voice." },
  { icon: "🔔", title: "Auto Nudges", body: "Families who haven't submitted get a friendly monthly nudge automatically — no one falls through the cracks." },
  { icon: "🏢", title: "Full Admin Dashboard", body: "Manage groups, cycles, recipients, members, and branding — all from a clean coordinator dashboard." },
];

const HOW_IT_WORKS = [
  { step: "1", title: "Create your organization", body: "Sign up with Google and set up your family organization — takes under 2 minutes." },
  { step: "2", title: "Add your groups & recipients", body: "Add each family branch as a Group. Then add recipients (like grandparents) who get the monthly digest." },
  { step: "3", title: "Families submit events", body: "Each month, families submit their upcoming milestones, 1:1 moments, and group events." },
  { step: "4", title: "Digest goes to grandparents", body: "You review, polish with AI, and send. Recipients RSVP and add events to their calendars." },
];

export default function LandingPage() {
  const [loading, setLoading]     = useState(true);
  const [authLoading, setAuth]    = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);

  // Load fonts
  useEffect(() => {
    const link = document.createElement("link");
    link.rel  = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Lato:wght@300;400;700&display=swap";
    document.head.appendChild(link);

    // Check if already signed in
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await routeSignedInUser(session.user.email);
      } else {
        setLoading(false);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, session) => {
      if (session?.user) {
        await routeSignedInUser(session.user.email);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function routeSignedInUser(email) {
    // Check if user belongs to an org
    const { data: member } = await supabase
      .from("org_members")
      .select("org_id, role, is_active")
      .eq("email", email.toLowerCase())
      .eq("is_active", true)
      .limit(1)
      .single();

    if (member?.org_id) {
      // Existing member — go to app
      window.location.href = "/app";
    } else {
      // New user — go to onboarding
      window.location.href = "/onboarding";
    }
  }

  const signInWithGoogle = async () => {
    setAuth(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/signup" },
    });
  };

  if (loading && !showSignIn) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: C.primary, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, ...sans }}>
        <div style={{ fontSize: 40 }}>🌿</div>
        <div style={{ color: C.white, fontSize: 15, opacity: 0.8 }}>Loading Grandivite…</div>
      </div>
    );
  }

  if (showSignIn) {
    return <SignInCard onBack={() => setShowSignIn(false)} />;
  }

  return (
    <div style={{ ...sans, backgroundColor: C.cream, color: C.text }}>
      {/* ── NAV ── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, backgroundColor: "rgba(253,252,250,0.96)", backdropFilter: "blur(8px)", borderBottom: `1px solid ${C.border}`, padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 1080, margin: "0 auto", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="44" height="36" viewBox="0 0 64 56" aria-hidden="true">
            <circle cx="20" cy="14" r="4.5" fill="#8B6F47"/>
            <path d="M14 50 Q14 22 20 22 Q26 22 26 50 Z" fill="#8B6F47"/>
            <line x1="26" y1="32" x2="30" y2="50" stroke="#8B6F47" strokeWidth="1.8" strokeLinecap="round"/>
            <circle cx="42" cy="22" r="3.6" fill="#E07A5F"/>
            <path d="M37 50 Q37 30 42 30 Q47 30 47 50 Z" fill="#E07A5F"/>
            <path d="M27 36 Q34 32 38 36" stroke="#2C5F5A" strokeWidth="2.4" fill="none" strokeLinecap="round"/>
          </svg>
          <span style={{ ...serif, fontSize: 20, color: C.primary, fontWeight: 700 }}>Grandivite</span>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button onClick={() => setShowSignIn(true)} style={{ background: "none", border: `1.5px solid ${C.primary}`, color: C.primary, padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13, ...sans }}>
            Sign In
          </button>
          <button onClick={signInWithGoogle} disabled={authLoading} style={{ backgroundColor: C.primary, color: C.white, border: "none", padding: "8px 20px", borderRadius: 8, cursor: authLoading ? "wait" : "pointer", fontWeight: 700, fontSize: 13, ...sans }}>
            {authLoading ? "…" : "Get Started Free"}
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ backgroundColor: C.primary, padding: "80px 24px 100px", textAlign: "center" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ fontSize: 52, marginBottom: 20 }}>🌿</div>
          <h1 style={{ ...serif, fontSize: "clamp(32px, 6vw, 56px)", color: C.white, margin: "0 0 20px", lineHeight: 1.2 }}>
            Keep your extended family<br />connected — effortlessly.
          </h1>
          <p style={{ fontSize: 18, color: "rgba(255,255,255,0.82)", lineHeight: 1.7, margin: "0 0 36px" }}>
            Grandivite is a shared family calendar and monthly digest platform. Families submit their upcoming milestones, and grandparents get a beautiful, AI-crafted email every month with everything they'd love to attend.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={signInWithGoogle} disabled={authLoading} style={{ backgroundColor: C.white, color: C.primary, border: "none", padding: "15px 32px", borderRadius: 12, cursor: authLoading ? "wait" : "pointer", fontWeight: 700, fontSize: 16, ...sans, boxShadow: "0 4px 24px rgba(0,0,0,0.15)" }}>
              {authLoading ? "Signing in…" : "Create your family space →"}
            </button>
            <button onClick={() => setShowSignIn(true)} style={{ backgroundColor: "transparent", color: C.white, border: `2px solid rgba(255,255,255,0.5)`, padding: "15px 28px", borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 15, ...sans }}>
              Sign In
            </button>
          </div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 16 }}>Free to start · No credit card required</p>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ padding: "80px 24px", maxWidth: 1080, margin: "0 auto" }}>
        <h2 style={{ ...serif, fontSize: 36, textAlign: "center", color: C.primary, margin: "0 0 8px" }}>Everything your family needs</h2>
        <p style={{ textAlign: "center", color: C.muted, fontSize: 16, margin: "0 0 52px" }}>One platform. Every branch. Every milestone.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{ backgroundColor: C.white, borderRadius: 16, padding: "28px 24px", border: `1px solid ${C.border}`, boxShadow: "0 2px 12px rgba(44,95,90,0.06)" }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
              <h3 style={{ ...serif, fontSize: 18, color: C.text, margin: "0 0 10px" }}>{f.title}</h3>
              <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7, margin: 0 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ backgroundColor: C.primaryLight, padding: "80px 24px", borderTop: `1px solid ${C.primaryBorder}`, borderBottom: `1px solid ${C.primaryBorder}` }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h2 style={{ ...serif, fontSize: 36, textAlign: "center", color: C.primary, margin: "0 0 8px" }}>How it works</h2>
          <p style={{ textAlign: "center", color: C.muted, fontSize: 16, margin: "0 0 52px" }}>Set up once. Run automatically every month.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {HOW_IT_WORKS.map(h => (
              <div key={h.step} style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", backgroundColor: C.primary, color: C.white, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18, flexShrink: 0 }}>{h.step}</div>
                <div>
                  <h3 style={{ ...serif, fontSize: 18, color: C.text, margin: "0 0 6px" }}>{h.title}</h3>
                  <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7, margin: 0 }}>{h.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: "80px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <h2 style={{ ...serif, fontSize: 36, color: C.primary, margin: "0 0 16px" }}>Ready to bring your family together?</h2>
          <p style={{ color: C.muted, fontSize: 16, lineHeight: 1.7, margin: "0 0 32px" }}>Create your family organization in minutes. Invite your branches. Start coordinating.</p>
          <button onClick={signInWithGoogle} disabled={authLoading} style={{ backgroundColor: C.primary, color: C.white, border: "none", padding: "16px 40px", borderRadius: 12, cursor: authLoading ? "wait" : "pointer", fontWeight: 700, fontSize: 16, ...sans, boxShadow: "0 4px 24px rgba(44,95,90,0.3)" }}>
            {authLoading ? "Signing in…" : "Get Started — It's Free →"}
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: "24px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: C.muted, fontSize: 12, flexWrap: "wrap" }}>
        <svg width="28" height="22" viewBox="0 0 64 56" aria-hidden="true">
          <circle cx="20" cy="14" r="4.5" fill="#8B6F47"/>
          <path d="M14 50 Q14 22 20 22 Q26 22 26 50 Z" fill="#8B6F47"/>
          <line x1="26" y1="32" x2="30" y2="50" stroke="#8B6F47" strokeWidth="1.8" strokeLinecap="round"/>
          <circle cx="42" cy="22" r="3.6" fill="#E07A5F"/>
          <path d="M37 50 Q37 30 42 30 Q47 30 47 50 Z" fill="#E07A5F"/>
          <path d="M27 36 Q34 32 38 36" stroke="#2C5F5A" strokeWidth="2.4" fill="none" strokeLinecap="round"/>
        </svg>
        <span style={{ ...serif, color: C.primary, fontWeight: 700, fontSize: 14 }}>Grandivite</span>
        <span>·</span>
        <span>Keep your family connected around the moments that matter.</span>
      </footer>
    </div>
  );
}

function SignInCard({ onBack }) {
  const [authLoading, setAuth]   = useState(false);
  const [email, setEmail]        = useState("");
  const [magicLoading, setMagic] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [magicError, setMagicError] = useState("");

  const signInGoogle = async () => {
    setAuth(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/signup" },
    });
  };

  const sendMagicLink = async () => {
    if (!email.trim()) return;
    setMagic(true);
    setMagicError("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + "/signup" },
    });
    setMagic(false);
    if (error) setMagicError("Something went wrong. Please try again.");
    else setMagicSent(true);
  };

  const inp = { width: "100%", padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontFamily: "'Lato', sans-serif", fontSize: 14, color: C.text, backgroundColor: C.white, outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: C.primary, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, ...sans }}>
      <div style={{ backgroundColor: C.white, borderRadius: 24, padding: "44px 36px", maxWidth: 400, width: "100%", textAlign: "center", boxShadow: "0 24px 80px rgba(0,0,0,0.25)" }}>
        <div style={{ fontSize: 40, marginBottom: 14 }}>🌿</div>
        <h1 style={{ ...serif, fontSize: 28, color: C.primary, margin: "0 0 6px" }}>Welcome back</h1>
        <p style={{ color: C.muted, fontSize: 13, margin: "0 0 28px", lineHeight: 1.6 }}>Sign in to Grandivite</p>

        <button onClick={signInGoogle} disabled={authLoading} style={{ width: "100%", padding: "13px 20px", borderRadius: 10, border: `1.5px solid ${C.border}`, backgroundColor: C.white, cursor: authLoading ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, fontFamily: "'Lato', sans-serif", fontWeight: 700, fontSize: 14, color: C.text, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", marginBottom: 20 }}>
          <GoogleIcon />
          {authLoading ? "Signing in…" : "Continue with Google"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, backgroundColor: C.border }} />
          <span style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>OR</span>
          <div style={{ flex: 1, height: 1, backgroundColor: C.border }} />
        </div>

        {!magicSent ? (
          <>
            <p style={{ fontSize: 13, color: C.muted, margin: "0 0 12px", lineHeight: 1.5 }}>Enter your email and we'll send a sign-in link.</p>
            <input type="email" placeholder="your@email.com" value={email}
              onChange={e => { setEmail(e.target.value); setMagicError(""); }}
              onKeyDown={e => e.key === "Enter" && sendMagicLink()}
              style={{ ...inp, marginBottom: 10, textAlign: "center" }} />
            {magicError && <p style={{ color: C.red, fontSize: 12, margin: "0 0 10px" }}>{magicError}</p>}
            <button onClick={sendMagicLink} disabled={magicLoading || !email.trim()} style={{ width: "100%", padding: 13, borderRadius: 10, border: "none", backgroundColor: C.primary, color: C.white, fontWeight: 700, fontSize: 14, cursor: magicLoading || !email.trim() ? "not-allowed" : "pointer", opacity: magicLoading || !email.trim() ? 0.5 : 1, fontFamily: "'Lato', sans-serif" }}>
              {magicLoading ? "Sending…" : "Send Sign-In Link"}
            </button>
          </>
        ) : (
          <div style={{ backgroundColor: C.primaryLight, border: `1.5px solid ${C.primary}`, borderRadius: 12, padding: "20px 16px" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>📬</div>
            <p style={{ color: C.primary, fontWeight: 700, fontSize: 15, margin: "0 0 6px" }}>Check your email!</p>
            <p style={{ color: C.primary, fontSize: 13, margin: 0, lineHeight: 1.6 }}>We sent a sign-in link to <strong>{email}</strong>.</p>
            <button onClick={() => { setMagicSent(false); setEmail(""); }} style={{ background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer", marginTop: 12 }}>Use a different email</button>
          </div>
        )}

        <button onClick={onBack} style={{ background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", marginTop: 20, textDecoration: "underline" }}>
          ← Back to home
        </button>
      </div>
    </div>
  );
}
