import { createClient } from "@supabase/supabase-js";

function pad(n) { return String(n).padStart(2, "0"); }

// "6:30 PM", "18:30", "6pm" → { h, min } or null
function parseTime(str) {
  if (!str) return null;
  const m = str.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) return null;
  let h = parseInt(m[1]);
  const min = m[2] ? parseInt(m[2]) : 0;
  const ap  = (m[3] || "").toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return { h, min };
}

// Returns { start, end, allDay } as iCal-formatted date strings
function icsDateTime(dateStr, timeStr) {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const t = parseTime(timeStr);
  if (!t) {
    // All-day: DTEND is the exclusive next day
    const next = new Date(y, mo - 1, d + 1);
    const end  = `${next.getFullYear()}${pad(next.getMonth()+1)}${pad(next.getDate())}`;
    return { start: `${y}${pad(mo)}${pad(d)}`, end, allDay: true };
  }
  const endH = (t.h + 2) % 24;
  const base  = `${y}${pad(mo)}${pad(d)}T`;
  return {
    start: `${base}${pad(t.h)}${pad(t.min)}00`,
    end:   `${base}${pad(endH)}${pad(t.min)}00`,
    allDay: false,
  };
}

// iCal text escaping (RFC 5545)
function esc(str) {
  return (str || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export default async function handler(req, res) {
  // Simple token auth — set CALENDAR_TOKEN in Vercel env vars
  const token    = req.query?.token;
  const expected = process.env.CALENDAR_TOKEN;
  if (!expected || token !== expected) {
    return res.status(401).send("Unauthorized");
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Find all active (non-closed) cycles
  const { data: cycles } = await supabase
    .from("cycles")
    .select("id")
    .is("closed_at", null);

  // Fetch all events from those cycles
  const events = [];
  if (cycles?.length) {
    const { data } = await supabase
      .from("events")
      .select("*")
      .in("cycle_id", cycles.map(c => c.id))
      .order("date");
    if (data) events.push(...data);
  }

  // Build DTSTAMP (UTC timestamp for when feed was generated)
  const now   = new Date();
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth()+1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Grandivite//Family Events//EN",
    "X-WR-CALNAME:Family Events",
    "X-WR-CALDESC:Upcoming family events from Grandivite",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const ev of events) {
    const { start, end, allDay } = icsDateTime(ev.date, ev.time);

    const summary = ev.is_family_event
      ? ev.event_name
      : ev.child_name ? `${ev.child_name}'s ${ev.event_name}` : ev.event_name;

    // Description: host (if family event), notes, submitting family
    const descParts = [];
    if (ev.is_family_event && ev.child_name) descParts.push(`Hosted by ${ev.child_name}`);
    if (ev.notes)       descParts.push(ev.notes);
    if (ev.family_name) descParts.push(`— ${ev.family_name}`);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${ev.id}@grandivite.com`);
    lines.push(`DTSTAMP:${stamp}`);
    if (allDay) {
      lines.push(`DTSTART;VALUE=DATE:${start}`);
      lines.push(`DTEND;VALUE=DATE:${end}`);
    } else {
      lines.push(`DTSTART:${start}`);
      lines.push(`DTEND:${end}`);
    }
    lines.push(`SUMMARY:${esc(summary)}`);
    if (ev.location)       lines.push(`LOCATION:${esc(ev.location)}`);
    if (descParts.length)  lines.push(`DESCRIPTION:${esc(descParts.join("\n\n"))}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  // Cache for 1 hour — calendar apps re-poll on their own schedule
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).send(lines.join("\r\n"));
}
