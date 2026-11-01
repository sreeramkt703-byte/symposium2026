import { getViolations, isAdmin } from "../lib/examStore.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!isAdmin(req)) {
    return res.status(401).json([]);
  }

  try {
    const violations = await getViolations();
    return res.status(200).json(
      violations.map((violation) =>
        typeof violation === "string" ? JSON.parse(violation) : violation
      )
    );
  } catch (error) {
    console.error("Violations list error:", error);
    return res.status(500).json({ error: "Unable to get violations" });
  }
}
