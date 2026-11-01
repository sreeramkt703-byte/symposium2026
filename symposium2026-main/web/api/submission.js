import { kv } from "@vercel/kv";
import { isAdmin, normalizeTeam, submissionKey } from "../lib/examStore.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!isAdmin(req)) {
    return res.status(401).json({ ok: false });
  }

  const team = normalizeTeam(req.query.team);
  const examId = Number(req.query.examId);
  if (!team || !Number.isSafeInteger(examId)) {
    return res.status(400).json({ error: "Invalid submission request" });
  }

  try {
    const submission = await kv.get(submissionKey(examId, team));
    if (!submission) return res.status(200).json({ ok: false });
    return res.status(200).json({ ok: true, ...submission });
  } catch (error) {
    console.error("Submission lookup error:", error);
    return res.status(500).json({ error: "Unable to get submission" });
  }
}
