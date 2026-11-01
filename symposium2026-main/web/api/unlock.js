import { isAdmin } from "../lib/examStore.js";
import process from "node:process";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.ADMIN_SECRET) {
    return res.status(503).json({ ok: false, error: "Admin authentication is not configured" });
  }

  return res.status(200).json({ ok: isAdmin(req) });
}
