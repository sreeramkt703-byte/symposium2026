import { isAdmin, normalizeTeam, teamLockKey } from "../../lib/examStore.js";
import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!isAdmin(req)) {
    return res.status(401).json({ ok: false });
  }

  const team = normalizeTeam(req.body?.team);
  if (!team) {
    return res.status(400).json({ error: "Invalid team" });
  }

  try {
    const key = teamLockKey(team);
    const lock = await kv.get(key);
    if (!lock) return res.status(200).json({ ok: true, alreadyUnlocked: true });

    await kv.set(key, {
      locked: false,
      team,
      reason: "",
      unlockedAt: new Date().toISOString(),
    });
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Lock unlock error:", error);
    return res.status(500).json({ error: "Unable to unlock team" });
  }
}
