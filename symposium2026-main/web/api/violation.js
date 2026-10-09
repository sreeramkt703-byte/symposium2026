
import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { type, team, timestamp } = req.body || {};

    if (
      typeof type !== "string" ||
      !/^[A-Z_]{1,40}$/.test(type) ||
      typeof team !== "string" ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(team)
    ) {
      return res.status(400).json({ error: "Invalid violation data" });
    }

    const key = `exam:lock:${team}`;
    const existing = await kv.get(key);

    // Keep the first lock reason until an administrator unlocks the exam.
    if (!existing || existing.locked !== true) {
      const state = {
        locked: true,
        team,
        reason: type,
        lockedAt:
          typeof timestamp === "string"
            ? timestamp
            : new Date().toISOString(),
      };

      await kv.set(key, state);
    }

    return res.status(200).json({
      ok: true,
      locked: true,
    });
  } catch (error) {
    console.error("Violation endpoint error:", error);
    return res.status(500).json({ error: "Unable to record violation" });
  }
}