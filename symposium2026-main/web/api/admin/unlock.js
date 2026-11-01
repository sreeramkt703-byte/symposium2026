
import { kv } from "@vercel/kv";
import { isAdmin, normalizeTeam, teamLockKey } from "../../lib/examStore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAdmin(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const team = normalizeTeam(req.body?.team);
  if (!team) {
    return res.status(400).json({ error: "Invalid team" });
  }

  try {
    await kv.set(teamLockKey(team), {
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