import { isAdmin, setExamState } from "../../lib/examStore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAdmin(req)) {
    return res.status(401).json({ ok: false });
  }

  try {
    await setExamState({ started: false, code: null, id: null });
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Exam stop error:", error);
    return res.status(500).json({ error: "Unable to stop exam" });
  }
}
