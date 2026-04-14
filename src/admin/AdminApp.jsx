import { useState, useEffect } from "react";
import { adminDb } from "./adminDb.js";
import { AdminC } from "./adminUtils.js";

import Overview              from "./sections/Overview.jsx";
import OrgSettings           from "./sections/OrgSettings.jsx";
import GroupsManager         from "./sections/GroupsManager.jsx";
import GroupDetail           from "./sections/GroupDetail.jsx";
import RecipientsManager     from "./sections/RecipientsManager.jsx";
import MembersManager        from "./sections/MembersManager.jsx";
import CycleManager          from "./sections/CycleManager.jsx";
import NotificationSettings  from "./sections/NotificationSettings.jsx";
import AuditLog              from "./sections/AuditLog.jsx";

const C = {
  green: "#2C4A3E", white: "#FFFFFF", cream: "#FDF8F2",
  text: "#2A2A2A", muted: "#7A7A7A", border: "#E8E0D6",
};
const serif = { fontFamily: "'Playfair Display', serif" };

const NAV = [
  { id: "overview",       icon: "🏠", label: "Overview" },
  { id: "org",            icon: "🏢", label: "Organization" },
  { id: "groups",         icon: "👨‍👩‍👧‍👦", label: "Groups" },
  { id: "recipients",     icon: "📬", label: "Recipients" },
  { id: "members",        icon: "🔑", label: "Admin Members" },
  { id: "cycles",         icon: "📅", label: "Cycles" },
  { id: "notifications",  icon: "🔔", label: "Notifications" },
  { id: "audit",          icon: "📋", label: "Audit Log" },
];

const PAGE_LABELS = Object.fromEntries(NAV.map(n => [n.id, n.label]));

function AccessDenied({ email, onSignOut }) {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: C.green, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ backgroundColor: C.white, borderRadius: 24, padding: "48px 40px", maxWidth: 380, width: "100%", textAlign: "center", boxShadow: "0 24px 80px rgba(0,0,0,0.25)" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
        <h2 style={{ ...serif, fontSize: 22, color: C.green, margin: "0 0 12px" }}>Admin Access Required</h2>
        <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.7, margin: "0 0 24px" }}>
          <strong>{email}</strong> doesn't have admin access to this dashboard.<br />Contact Chris or JaCee to be added.
        </p>
        <button onClick={onSignOut} style={{ width: "100%", padding: "12px 20px", borderRadius: 10, border: `2px solid ${C.green}`, backgroundColor: "transparent", color: C.green, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "'Lato', sans-serif", marginBottom: 12 }}>Sign Out</button>
        <a href="/" style={{ display: "block", color: C.muted, fontSize: 13, textDecoration: "none" }}>← Back to App</a>
      </div>
    </div>
  );
}

function AuthScreen({ onSignIn }) {
  const [loading, setLoading] = useState(false);
  const signIn = async () => {
    setLoading(true);
    await adminDb.supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin + "/admin" } });
  };
  return (
    <div style={{ minHeight: "100vh", backgroundColor: C.green, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ backgroundColor: C.white, borderRadius: 24, padding: "48px 40px", maxWidth: 380, width: "100%", textAlign: "center", boxShadow: "0 24px 80px rgba(0,0,0,0.25)" }}>
        <div style={{ fontSize: 40, marginBottom: 14 }}>🌿</div>
        <h1 style={{ ...serif, fontSize: 26, color: C.green, margin: "0 0 6px" }}>Clayton Link Admin</h1>
        <p style={{ color: C.muted, fontSize: 13, margin: "0 0 28px" }}>Sign in to access the admin dashboard</p>
        <button onClick={signIn} disabled={loading} style={{ width: "100%", padding: "13px 20px", borderRadius: 10, border: `1.5px solid ${C.border}`, backgroundColor: C.white, cursor: loading ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, fontFamily: "'Lato', sans-serif", fontWeight: 700, fontSize: 14, color: C.text, boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.4-5l-6.2-5.2C29.4 35.6 26.8 36 24 36c-5.2 0-9.5-2.9-11.3-7L6 34.3C9.4 40 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.5-2.6 4.6-4.8 6l6.2 5.2C40.8 35.6 44 30.2 44 24c0-1.3-.1-2.7-.4-4z"/></svg>
          {loading ? "Signing in…" : "Continue with Google"}
        </button>
      </div>
    </div>
  );
}

export default function AdminApp() {
  const [session, setSession]         = useState(undefined); // undefined = loading, null = signed out
  const [adminMember, setAdminMember] = useState(null);
  const [org, setOrg]                 = useState(null);
  const [orgSettings, setOrgSettings] = useState(null);
  const [adminPage, setAdminPage]     = useState("overview");
  const [loading, setLoading]         = useState(true);

  // Fix full-width layout (undo index.css 1126px constraint)
  useEffect(() => {
    const root = document.getElementById("root");
    if (root) {
      root.style.cssText = "width:100%;max-width:100%;border:none;text-align:left;display:block;";
    }
    // Load Google Fonts
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Lato:wght@300;400;700&display=swap";
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch {} };
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session: s } } = await adminDb.supabase.auth.getSession();
      setSession(s);
      if (s?.user) {
        const { data: member } = await adminDb.supabase.from("org_members")
          .select("*").eq("email", s.user.email).in("role", ["owner", "admin"]).eq("is_active", true).single();
        setAdminMember(member || null);
        if (member) {
          const [o, os] = await Promise.all([adminDb.fetchOrg(), adminDb.fetchOrgSettings()]);
          setOrg(o);
          setOrgSettings(os);
        }
      }
      setLoading(false);
    })();

    const { data: { subscription } } = adminDb.supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await adminDb.supabase.auth.signOut();
    setSession(null); setAdminMember(null);
  };

  if (loading || session === undefined) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: C.green, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, fontFamily: "'Lato', sans-serif" }}>
        <div style={{ fontSize: 36 }}>🌿</div>
        <div style={{ color: C.white, fontSize: 15, opacity: 0.8 }}>Loading admin…</div>
      </div>
    );
  }

  if (!session) return <AuthScreen />;
  if (!adminMember) return <AccessDenied email={session.user.email} onSignOut={signOut} />;

  const actorEmail = session.user.email;

  // Parse group detail page: "group:7" → id 7
  const isGroupDetail = adminPage.startsWith("group:");
  const groupDetailId = isGroupDetail ? parseInt(adminPage.split(":")[1]) : null;

  const topSection = isGroupDetail ? "groups" : adminPage;
  const pageLabel = isGroupDetail ? "Group Detail" : (PAGE_LABELS[adminPage] || adminPage);

  const SIDEBAR_W = 220;

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Lato', sans-serif", backgroundColor: C.cream }}>
      {/* Sidebar */}
      <div style={{ width: SIDEBAR_W, flexShrink: 0, backgroundColor: AdminC.sidebar, display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, height: "100vh", zIndex: 100, overflowY: "auto" }}>
        {/* Logo */}
        <div style={{ padding: "20px 16px 16px", borderBottom: `1px solid ${AdminC.sidebarBorder}` }}>
          <div style={{ ...serif, fontSize: 18, color: C.white, fontWeight: 700, lineHeight: 1.2 }}>{org?.app_emoji || "🌿"} {org?.app_title || "Clayton Link"}</div>
          <div style={{ fontSize: 10, color: AdminC.sidebarText, marginTop: 4, fontWeight: 700, letterSpacing: "0.8px" }}>ADMIN DASHBOARD</div>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: "10px 8px" }}>
          {NAV.map(item => {
            const active = topSection === item.id;
            return (
              <button key={item.id} onClick={() => setAdminPage(item.id)}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer", backgroundColor: active ? AdminC.sidebarActive : "transparent", color: active ? AdminC.sidebarTextActive : AdminC.sidebarText, fontFamily: "'Lato', sans-serif", fontSize: 13, fontWeight: active ? 700 : 400, textAlign: "left", transition: "background-color 0.15s", marginBottom: 2 }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = AdminC.sidebarHover; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; }}>
                <span style={{ fontSize: 15 }}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User info at bottom */}
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${AdminC.sidebarBorder}` }}>
          <div style={{ fontSize: 11, color: AdminC.sidebarText, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{actorEmail}</div>
          <button onClick={signOut} style={{ background: "none", border: `1px solid ${AdminC.sidebarBorder}`, color: AdminC.sidebarText, fontSize: 11, padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "'Lato', sans-serif", fontWeight: 700, width: "100%" }}>Sign Out</button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ marginLeft: SIDEBAR_W, flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top header */}
        <div style={{ backgroundColor: C.white, borderBottom: `1px solid ${C.border}`, padding: "0 28px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 90, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: 13, color: C.muted }}>
            <span style={{ fontWeight: 700, color: C.text }}>Admin</span>
            <span> / </span>
            <span>{pageLabel}</span>
          </div>
          <a href="/" style={{ fontSize: 12, color: C.green, fontWeight: 700, textDecoration: "none", padding: "6px 14px", border: `1.5px solid ${C.green}`, borderRadius: 8 }}>← Back to App</a>
        </div>

        {/* Page content */}
        <div style={{ flex: 1, padding: "28px 32px 60px" }}>
          {adminPage === "overview"      && <Overview       onNavigate={setAdminPage} />}
          {adminPage === "org"           && <OrgSettings    org={org} orgSettings={orgSettings} actorEmail={actorEmail} onSaved={updated => setOrg(o => ({ ...o, ...updated }))} />}
          {adminPage === "groups"        && <GroupsManager  actorEmail={actorEmail} onEditGroup={id => setAdminPage(`group:${id}`)} />}
          {isGroupDetail                 && <GroupDetail    groupId={groupDetailId} actorEmail={actorEmail} onBack={() => setAdminPage("groups")} />}
          {adminPage === "recipients"    && <RecipientsManager actorEmail={actorEmail} />}
          {adminPage === "members"       && <MembersManager actorEmail={actorEmail} />}
          {adminPage === "cycles"        && <CycleManager   actorEmail={actorEmail} />}
          {adminPage === "notifications" && <NotificationSettings orgSettings={orgSettings} actorEmail={actorEmail} />}
          {adminPage === "audit"         && <AuditLog />}
        </div>
      </div>
    </div>
  );
}
