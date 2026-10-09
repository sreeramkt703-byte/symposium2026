
import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.ADMIN_SECRET;
  const auth = req.headers.authorization || "";

  if (!secret || auth !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { team } = req.body || {};

  if (
    typeof team !== "string" ||
    !/^[a-zA-Z0-9_-]{1,80}$/.test(team)
  ) {
    return res.status(400).json({ error: "Invalid team" });
  }

  try {
    await kv.set(`exam:lock:${team}`, {
      locked: false,
      team,
      reason: "",
      unlockedAt: new Date().toISOString(),
    });

    return res.status(200).json({ ok: true, locked: false });
  } catch (error) {
    console.error("Unlock endpoint error:", error);
    return res.status(500).json({ error: "Unable to unlock exam" });
  }
}