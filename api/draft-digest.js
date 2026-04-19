import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Verify the caller has a valid Supabase session
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

  const { events, monthLabel, greeting, signoff } = req.body;
  if (!Array.isArray(events) || events.length === 0) {
    return res.status(400).json({ error: "No events provided" });
  }

  // Sort for prompt: milestones first, then 1:1, then group
  const sorted = [...events].sort((a, b) => b.importance - a.importance || new Date(a.date) - new Date(b.date));

  const eventLines = sorted.map(ev => {
    const priority = ev.importance === 3 ? "Milestone" : ev.importance === 2 ? "Intentional 1:1 Time" : "Group Event";
    const parts = [`${ev.childName} — ${ev.eventName} (${priority})`, `Date: ${ev.date}`];
    if (ev.time)     parts.push(`Time: ${ev.time}`);
    if (ev.location) parts.push(`Location: ${ev.location}`);
    if (ev.notes)    parts.push(`Family note: "${ev.notes}"`);
    return parts.join(", ");
  }).join("\n");

  const prompt = `You are helping write a warm, personal monthly digest email from a large extended family to their grandparents, Nana and Papa. The email should feel loving, celebratory, and personal — like a letter from a parent, not a newsletter.

Month: ${monthLabel}
Greeting to use: ${greeting}
Signoff to use: ${signoff}

Upcoming family events:
${eventLines}

Write the full email body following these rules:
- Start with the greeting line on its own
- Write a short warm intro (2–3 sentences) making Nana and Papa feel excited and loved
- Describe each event in one or two warm, personal sentences. Lead with milestones, then 1:1 events, then group events. Add extra warmth and celebration for milestones.
- Close with a sentence inviting them to visit grandivite.com to RSVP and see the full calendar
- End with the signoff on its own line
- Plain text only — no markdown, no bullet points, no asterisks
- Under 350 words total
- Do not include a subject line`;

  const client = new Anthropic();
  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  return res.status(200).json({ draft: message.content[0].text });
}
