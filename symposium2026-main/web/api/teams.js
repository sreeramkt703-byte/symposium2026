import { kv } from "@vercel/kv";
import {
  EXAM_DURATION,
  getLatestExamId,
  getViolations,
  isAdmin,
  listTeams,
  submissionKey,
  teamLockKey,
  teamRecordKey,
} from "../lib/examStore.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!isAdmin(req)) {
    return res.status(401).json([]);
  }

  try {
    const examId = await getLatestExamId();
    if (examId == null) return res.status(200).json([]);

    const [names, violations] = await Promise.all([
      listTeams(examId),
      getViolations(),
    ]);
    const rows = await Promise.all(
      names.map(async (team) => {
        const [record, lock, submission] = await Promise.all([
          kv.get(teamRecordKey(examId, team)),
          kv.get(teamLockKey(team)),
          kv.get(submissionKey(examId, team)),
        ]);
        if (!record) return null;

        const state = record.submittedAt
          ? record.status === "time-up"
            ? "time-up"
            : "submitted"
          : Date.now() > record.startedAt + EXAM_DURATION
            ? "over"
            : "in-progress";

        return {
          ...record,
          state,
          timeTaken: record.submittedAt ? record.submittedAt - record.startedAt : null,
          hasSubmission: Boolean(submission),
          violations: violations.filter(
            (violation) => violation.team === team && violation.examId === record.examId
          ).length,
          locked: lock?.locked === true,
          lockType: lock?.reason || null,
        };
      })
    );

    return res.status(200).json(rows.filter(Boolean));
  } catch (error) {
    console.error("Teams list error:", error);
    return res.status(500).json({ error: "Unable to get teams" });
  }
}
