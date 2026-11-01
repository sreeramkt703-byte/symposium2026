import { getExamState, normalizeTeam, teamRecordKey } from "../../lib/examStore.js";
import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const exam = await getExamState();
    const team = normalizeTeam(req.body?.team);
    const examId = Number(req.body?.examId);
    if (!team || !Number.isSafeInteger(examId) || !exam.started || exam.id !== examId) {
      return res.status(200).json({ ok: false, reason: "Exam is no longer running" });
    }

    const record = await kv.get(teamRecordKey(examId, team));
    if (!record) {
      return res.status(200).json({ ok: false, reason: "Team not found" });
    }
    if (record.submittedAt) {
      return res.status(200).json({ ok: true, submitted: true });
    }

    return res.status(200).json({
      ok: true,
      examId,
      startedAt: record.startedAt,
      serverNow: Date.now(),
    });
  } catch (error) {
    console.error("Exam resume error:", error);
    return res.status(500).json({ error: "Unable to resume exam" });
  }
}
