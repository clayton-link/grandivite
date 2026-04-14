import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

// Fallback list used only if the DB query returns nothing
const FALLBACK_FAMILY_EMAILS = [
  "pbclayton@gmail.com",
  "daniellezclayton@yahoo.com",
  "spenceraffleck@hotmail.com",
  "kimaffleck@gmail.com",
  "chrisbclayton@gmail.com",
  "jaceec@gmail.com",
  "kkqtpie@gmail.com",
  "kandeclayton@gmail.com",
  "kmanclayton@gmail.com",
  "mitchgill22@gmail.com",
  "kelcgill@gmail.com",
];

function getMax30Label() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

export default async function handler(req, res) {
  // 1. Verify Vercel cron secret
  const auth = req.headers["authorization"] ?? "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // 2. Check toggle in Supabase settings table
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { data: settings, error } = await supabase
    .from("settings").select("auto_nudge_enabled").eq("id", 1).single();
  if (error) return res.status(500).json({ error: "Failed to fetch settings" });
  if (!settings?.auto_nudge_enabled) {
    return res.status(200).json({ skipped: true, reason: "auto_nudge_enabled is false" });
  }

  // 3. Fetch email list from DB — falls back to hardcoded list if query returns nothing
  let familyEmails = FALLBACK_FAMILY_EMAILS;
  try {
    const { data: gmRows } = await supabase
      .from("group_members")
      .select("email, groups!inner(active, org_id)")
      .eq("groups.active", true);
    if (gmRows?.length) {
      familyEmails = [...new Set(gmRows.map(r => r.email).filter(Boolean))];
    }
  } catch (_) {
    // Silently use fallback list
  }

  const max30Label = getMax30Label();
  const subject = "Clayton Link — Please Submit Your Upcoming Events";
  const text = `Hey family!\n\nTime to submit your upcoming events on Clayton Link.\n\nPlease include events happening between now and ${max30Label}. Nana and Papa need at least 14 days notice — 30 is ideal.\n\nUp to 2 events per child.\nhttps://claytonlink.com\n\nLove, Chris & JaCee`;

  // 4. Dry-run guard — set SEND_EMAILS=true in Vercel env vars when ready to go live
  if (process.env.SEND_EMAILS !== "true") {
    return res.status(200).json({
      dryRun: true,
      reason: "SEND_EMAILS is not set to 'true'",
      wouldSend: familyEmails,
      subject,
    });
  }

  // 5. Send emails individually so recipients don't see each other's addresses
  const resend = new Resend(process.env.RESEND_API_KEY);
  const results = [];
  for (const email of familyEmails) {
    const { data, error: sendErr } = await resend.emails.send({
      from: "Clayton Link <noreply@claytonlink.com>",
      to: [email],
      subject,
      text,
    });
    results.push({ email, success: !sendErr, id: data?.id, error: sendErr?.message });
  }

  return res.status(200).json({
    sent: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results,
  });
}
