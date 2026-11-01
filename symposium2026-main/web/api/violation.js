
import { kv } from "@vercel/kv";
import {
  getExamState,
  normalizeTeam,
  recordViolation,
  teamLockKey,
} from "../lib/examStore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { type, timestamp } = req.body || {};
    const team = normalizeTeam(req.body?.team);

    if (
      typeof type !== "string" ||
      !/^[A-Z_]{1,40}$/.test(type) ||
      !team
    ) {
      return res.status(400).json({ error: "Invalid violation data" });
    }

    const key = teamLockKey(team);
    const existing = await kv.get(key);
    const exam = await getExamState();
    const violation = {
      team,
      type,
      examId: Number.isSafeInteger(Number(req.body?.examId))
        ? Number(req.body.examId)
        : exam.id,
      time: typeof timestamp === "string" ? timestamp : new Date().toISOString(),
    };

    // Keep the first lock reason until an administrator unlocks the exam.
    if (!existing || existing.locked !== true) {
      const state = {
        locked: true,
        team,
        reason: type,
        lockedAt: violation.time,
      };

      await kv.set(key, state);
    }
    await recordViolation(violation);

    return res.status(200).json({
      ok: true,
      locked: true,
    });
  } catch (error) {
    console.error("Violation endpoint error:", error);
    return res.status(500).json({ error: "Unable to record violation" });
  }
}