import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

function getWindowLabel(days = 60) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

export default async function handler(req, res) {
  // 1. Verify Vercel cron secret
  const auth = req.headers["authorization"] ?? "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 2. Fetch all orgs with auto_nudge_enabled
  const { data: orgs, error: orgErr } = await supabase
    .from("org_settings")
    .select("org_id, auto_nudge_enabled, lookahead_days, nudge_day_of_month")
    .eq("auto_nudge_enabled", true);

  if (orgErr) return res.status(500).json({ error: "Failed to fetch orgs" });
  if (!orgs?.length) return res.status(200).json({ skipped: true, reason: "No orgs with nudge enabled" });

  const resend = new Resend(process.env.RESEND_API_KEY);
  const summary = [];

  for (const orgSettings of orgs) {
    const { org_id, lookahead_days } = orgSettings;
    const windowLabel = getWindowLabel(lookahead_days || 60);

    // Fetch org name for email copy
    const { data: org } = await supabase.from("organizations").select("name, app_title").eq("id", org_id).single();
    const orgName = org?.app_title || org?.name || "Your Family";

    // Fetch active group emails for this org
    const { data: groups } = await supabase
      .from("groups")
      .select("id, name")
      .eq("org_id", org_id)
      .eq("active", true);

    if (!groups?.length) continue;

    const groupIds = groups.map(g => g.id);
    const { data: gmRows } = await supabase
      .from("group_members")
      .select("email, group_id")
      .in("group_id", groupIds);

    const familyEmails = [...new Set((gmRows || []).map(r => r.email).filter(Boolean))];
    if (!familyEmails.length) continue;

    const subject = `${orgName} — Please Submit Your Upcoming Events`;
    const text = `Hey family!\n\nTime to submit your upcoming events on Grandivite.\n\nPlease include events happening through ${windowLabel}.\n\nhttps://grandivite.com\n\nLove, ${orgName}`;

    if (process.env.SEND_EMAILS !== "true") {
      summary.push({ org_id, dryRun: true, wouldSend: familyEmails, subject });
      continue;
    }

    const results = [];
    for (const email of familyEmails) {
      const { data, error: sendErr } = await resend.emails.send({
        from: `${orgName} via Grandivite <noreply@grandivite.com>`,
        to: [email],
        subject,
        text,
      });
      results.push({ email, success: !sendErr, id: data?.id });
    }
    summary.push({ org_id, sent: results.filter(r => r.success).length });
  }

  return res.status(200).json({ orgsProcessed: orgs.length, summary });
}
