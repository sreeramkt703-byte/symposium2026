import { randomInt } from "node:crypto";
import {
  clearAllTeamLocks,
  isAdmin,
  setExamState,
  setLatestExamId,
} from "../../lib/examStore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAdmin(req)) {
    return res.status(401).json({ ok: false });
  }

  try {
    await clearAllTeamLocks();
    const exam = {
      started: true,
      code: String(randomInt(100000, 1000000)),
      id: Date.now(),
    };
    await setLatestExamId(exam.id);
    await setExamState(exam);
    return res.status(200).json({ ok: true, code: exam.code });
  } catch (error) {
    console.error("Exam start error:", error);
    return res.status(500).json({ error: "Unable to start exam" });
  }
}
