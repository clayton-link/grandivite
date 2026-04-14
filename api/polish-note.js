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

  const { childName, eventName, importance, note } = req.body;
  if (!note?.trim()) return res.status(400).json({ error: "No note provided" });

  const priority = importance === 3 ? "milestone" : importance === 2 ? "intentional 1:1 time" : "group event";

  const prompt = `Rewrite this short family note for grandparents (Nana and Papa) to be warm, personal, and specific. Keep it to 1–2 sentences. Plain text only, no quotes around it.

Context: ${childName}'s ${eventName} (${priority})
Original note: ${note}

Write only the improved note, nothing else.`;

  const client = new Anthropic();
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });

  return res.status(200).json({ polished: message.content[0].text.trim() });
}
