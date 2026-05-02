import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

  const { pendingFamilies, max30Label } = req.body;
  if (!Array.isArray(pendingFamilies) || pendingFamilies.length === 0) {
    return res.status(400).json({ error: "No pending families" });
  }

  const familyLines = pendingFamilies.map(f => {
    const kids = f.children?.length ? `kids: ${f.children.join(", ")}` : "no children listed";
    return `- ${f.name} (${kids})`;
  }).join("\n");

  const prompt = `Write a short, warm, personalized nudge email for each of these families who haven't yet submitted their upcoming events to Grandivite, a family coordination app that helps grandparents (Nana and Papa) stay connected to the grandkids.

Events are due by ${max30Label}.

Families who haven't submitted yet:
${familyLines}

Instructions for each nudge:
- Address them by first names only (e.g. "Paul & Danielle", not "Paul & Danielle Clayton")
- Mention one or two of their children by name to make it feel personal
- Warm and friendly tone — not guilt-trippy, not corporate
- 3–4 sentences max
- End with a link to grandivite.com
- Plain text, no subject line, no sign-off needed

Return a valid JSON object where each key is the full family name exactly as given above and the value is the nudge message string. Return ONLY the JSON object, no other text.`;

  const client = new Anthropic();
  let message;
  try {
    message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });
  } catch (err) {
    console.error("Anthropic error:", err);
    return res.status(500).json({ error: err.message || "AI request failed" });
  }

  let drafts;
  try {
    drafts = JSON.parse(message.content[0].text.trim());
  } catch {
    return res.status(500).json({ error: "Failed to parse AI response" });
  }

  return res.status(200).json({ drafts });
}
