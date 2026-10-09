
import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const team = req.query.team;

  if (
    typeof team !== "string" ||
    !/^[a-zA-Z0-9_-]{1,80}$/.test(team)
  ) {
    return res.status(400).json({ error: "Invalid team" });
  }

  try {
    const state = await kv.get(`exam:lock:${team}`);

    return res.status(200).json({
      locked: state?.locked === true,
      reason: state?.reason || "",
      lockedAt: state?.lockedAt || null,
    });
  } catch (error) {
    console.error("Lock status error:", error);
    return res.status(500).json({ error: "Unable to get lock status" });
  }
}