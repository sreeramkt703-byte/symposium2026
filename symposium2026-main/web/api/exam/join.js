import {
  addTeamToIndexes,
  getExamState,
  normalizeTeam,
  teamRecordKey,
} from "../../lib/examStore.js";
import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const exam = await getExamState();
    if (!exam.started) {
      return res.status(200).json({ ok: false, reason: "Exam has not started yet" });
    }

    if (String(req.body?.code) !== exam.code) {
      return res.status(200).json({ ok: false, reason: "Wrong exam code" });
    }

    const team = normalizeTeam(req.body?.team);
    if (!team) {
      return res.status(200).json({ ok: false, reason: "Team name required" });
    }

    const key = teamRecordKey(exam.id, team);
    let record = await kv.get(key);
    if (record?.submittedAt) {
      return res.status(200).json({ ok: false, reason: "This team has already submitted" });
    }
    if (!record) {
      record = {
        team,
        examId: exam.id,
        startedAt: Date.now(),
        submittedAt: null,
        status: "in-progress",
      };
      await Promise.all([
        kv.set(key, record),
        addTeamToIndexes(exam.id, team),
      ]);
    }

    return res.status(200).json({
      ok: true,
      examId: exam.id,
      startedAt: record.startedAt,
      serverNow: Date.now(),
    });
  } catch (error) {
    console.error("Exam join error:", error);
    return res.status(500).json({ error: "Unable to join exam" });
  }
}
