import { getExamState, isAdmin } from "../../lib/examStore.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const exam = await getExamState();
    return res.status(200).json({
      started: exam.started,
      code: isAdmin(req) ? exam.code : undefined,
    });
  } catch (error) {
    console.error("Exam status error:", error);
    return res.status(500).json({ error: "Unable to get exam status" });
  }
}
