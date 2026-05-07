const C = {
  primary: "#2C5F5A", cream: "#FDFCFA", white: "#FFFFFF",
  text: "#1A2A28", muted: "#6B7B79", border: "#E2DAD4",
};
const serif = { fontFamily: "'Playfair Display', serif" };

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 36 }}>
    <h2 style={{ ...serif, fontSize: 20, color: C.primary, margin: "0 0 12px", fontWeight: 600 }}>{title}</h2>
    <div style={{ fontSize: 15, color: C.text, lineHeight: 1.8 }}>{children}</div>
  </div>
);

const Li = ({ children }) => (
  <li style={{ marginBottom: 6 }}>{children}</li>
);

export default function PrivacyPolicy() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: C.cream, fontFamily: "'Lato', sans-serif" }}>
      {/* Header */}
      <div style={{ backgroundColor: C.primary, padding: "28px 24px 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ ...serif, fontSize: 26, color: C.white, fontWeight: 700 }}>🌿 Grandivite</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>Privacy Policy</div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px 80px" }}>
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 40 }}>
          Last updated: May 7, 2026
        </p>

        <Section title="Overview">
          <p>Grandivite is a family calendar and event-sharing platform that helps families keep grandparents connected to the moments that matter. Organizations (families) use Grandivite to collect upcoming events from family members and share them with grandparents and other recipients via monthly digest emails.</p>
          <p style={{ marginTop: 12 }}>This policy explains what data we collect, how we use it, and your rights. We do not sell your data, serve ads, or share your information with third parties for marketing purposes.</p>
        </Section>

        <Section title="Who We Are">
          <p>Grandivite is operated by Chris and JaCee Clayton.</p>
          <p style={{ marginTop: 12 }}>Contact: <a href="mailto:chrisbclayton@gmail.com" style={{ color: C.primary }}>chrisbclayton@gmail.com</a></p>
        </Section>

        <Section title="Information We Collect">
          <p><strong>When you sign in with Google:</strong></p>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <Li>Your Google account email address</Li>
            <Li>Your display name</Li>
            <Li>Your Google profile picture</Li>
          </ul>
          <p style={{ marginTop: 16 }}><strong>When you create or manage an organization:</strong></p>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <Li>Organization name, branding, and configuration settings</Li>
            <Li>Email addresses and phone numbers of family group members</Li>
            <Li>Email addresses and phone numbers of digest recipients (e.g., grandparents)</Li>
          </ul>
          <p style={{ marginTop: 16 }}><strong>When you submit events:</strong></p>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <Li>Child or family member names</Li>
            <Li>Event names, dates, times, and locations</Li>
            <Li>Optional notes</Li>
            <Li>Event importance or priority level</Li>
          </ul>
          <p style={{ marginTop: 16 }}><strong>When recipients interact with digest emails:</strong></p>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <Li>RSVP responses (attending / not attending)</Li>
          </ul>
        </Section>

        <Section title="How We Use Your Information">
          <ul style={{ paddingLeft: 20 }}>
            <Li>To authenticate you and identify your role within an organization</Li>
            <Li>To display and manage upcoming family events</Li>
            <Li>To send monthly digest emails to designated recipients</Li>
            <Li>To enable RSVP responses on events</Li>
            <Li>To allow organization admins to manage their calendar, groups, and members</Li>
          </ul>
          <p style={{ marginTop: 16 }}>We do not use your data for advertising, behavioral tracking, or any purpose beyond providing the Grandivite service.</p>
        </Section>

        <Section title="Who Can See Your Data">
          <p>Access to your data is restricted to:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <Li><strong>Your organization's admin(s)</strong> — can view and manage all events, members, and recipients within their organization</Li>
            <Li><strong>Family members in your group</strong> — can view events submitted within their own family group</Li>
            <Li><strong>Digest recipients</strong> — receive monthly emails with upcoming events from all family groups in the organization</Li>
            <Li><strong>Grandivite operators</strong> — Chris and JaCee Clayton, for purposes of operating, supporting, and maintaining the service</Li>
          </ul>
          <p style={{ marginTop: 16 }}>Organizations are fully isolated from each other. No family can see data from another organization.</p>
        </Section>

        <Section title="Data Storage">
          <p>Your data is stored securely using <a href="https://supabase.com" style={{ color: C.primary }}>Supabase</a>, a cloud database platform hosted in the United States. Supabase encrypts data at rest and in transit using industry-standard TLS.</p>
          <p style={{ marginTop: 12 }}>We do not store your Google account password. All authentication is handled by Google.</p>
        </Section>

        <Section title="Google Sign-In">
          <p>We use Google OAuth to verify your identity. We request access only to your basic profile (name, email address, and profile picture). We do not access your Gmail, Google Calendar, Google Drive, or any other Google service.</p>
          <p style={{ marginTop: 12 }}>You can revoke Grandivite's access to your Google account at any time at <a href="https://myaccount.google.com/permissions" style={{ color: C.primary }}>myaccount.google.com/permissions</a>.</p>
        </Section>

        <Section title="Email Communications">
          <p>We send emails in two situations:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <Li><strong>Monthly digest emails</strong> — sent to recipients designated by the organization admin, containing upcoming family events</Li>
            <Li><strong>Event submission nudges</strong> — sent to family group members to remind them to submit events for the upcoming month</Li>
          </ul>
          <p style={{ marginTop: 12 }}>Recipients are added to Grandivite by an organization admin. If you believe you've received an email in error or would like to be removed, contact us at <a href="mailto:chrisbclayton@gmail.com" style={{ color: C.primary }}>chrisbclayton@gmail.com</a>.</p>
        </Section>

        <Section title="Children's Privacy">
          <p>Children's names may appear in the app as part of event submissions (e.g., "Ella's dance recital"). We do not collect any other personal information about children. Only authorized adult family members can submit events or access the app.</p>
          <p style={{ marginTop: 12 }}>Grandivite is not directed at children under 13 and we do not knowingly collect personal information directly from children.</p>
        </Section>

        <Section title="Data Retention">
          <p>We retain your data for as long as your organization is active on Grandivite. Organization owners can delete events, members, and recipients at any time from the admin dashboard.</p>
          <p style={{ marginTop: 12 }}>To request deletion of your account or all data associated with your organization, contact <a href="mailto:chrisbclayton@gmail.com" style={{ color: C.primary }}>chrisbclayton@gmail.com</a>. We'll complete deletion within 30 days.</p>
        </Section>

        <Section title="Your Rights">
          <ul style={{ paddingLeft: 20 }}>
            <Li><strong>Access</strong> — request a copy of the data we hold about you</Li>
            <Li><strong>Correction</strong> — ask us to correct inaccurate information</Li>
            <Li><strong>Deletion</strong> — ask us to delete your account and associated data</Li>
            <Li><strong>Portability</strong> — request your data in a readable format</Li>
            <Li><strong>Objection</strong> — object to certain uses of your data</Li>
          </ul>
          <p style={{ marginTop: 16 }}>To exercise any of these rights, email <a href="mailto:chrisbclayton@gmail.com" style={{ color: C.primary }}>chrisbclayton@gmail.com</a>.</p>
        </Section>

        <Section title="Changes to This Policy">
          <p>We may update this policy as Grandivite evolves. When we make material changes, we'll update the date at the top of this page and notify organization admins by email.</p>
        </Section>

        <Section title="Contact">
          <p>Questions or concerns? Email us at <a href="mailto:chrisbclayton@gmail.com" style={{ color: C.primary }}>chrisbclayton@gmail.com</a>.</p>
        </Section>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <a href="/" style={{ fontSize: 13, color: C.primary, fontWeight: 700, textDecoration: "none" }}>← Back to Grandivite</a>
          <span style={{ fontSize: 12, color: C.muted }}>© {new Date().getFullYear()} Grandivite</span>
        </div>
      </div>
    </div>
  );
}
