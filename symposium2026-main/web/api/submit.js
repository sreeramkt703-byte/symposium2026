import { kv } from "@vercel/kv";
import {
  EXAM_DURATION,
  normalizeTeam,
  submissionKey,
  teamRecordKey,
} from "../lib/examStore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const team = normalizeTeam(req.body?.team);
    const examId = Number(req.body?.examId);
    if (!team || !Number.isSafeInteger(examId)) {
      return res.status(400).json({ error: "Invalid submission data" });
    }

    const key = teamRecordKey(examId, team);
    const record = await kv.get(key);
    if (!record) {
      return res.status(200).json({ ok: false, reason: "Team not found" });
    }
    if (record.submittedAt) {
      return res.status(200).json({ ok: true });
    }

    const submittedAt = Date.now();
    const timeUp = submittedAt >= record.startedAt + EXAM_DURATION - 5000;
    const submission = {
      team,
      examId,
      files: Array.isArray(req.body?.files) ? req.body.files : [],
      html: typeof req.body?.html === "string" ? req.body.html : "",
      css: typeof req.body?.css === "string" ? req.body.css : "",
      js: typeof req.body?.js === "string" ? req.body.js : "",
      time: new Date(submittedAt).toISOString(),
    };

    await kv.set(submissionKey(examId, team), submission);
    await kv.set(key, {
      ...record,
      submittedAt,
      status: timeUp ? "time-up" : "submitted",
    });
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Submission error:", error);
    return res.status(500).json({ error: "Unable to save submission" });
  }
}
