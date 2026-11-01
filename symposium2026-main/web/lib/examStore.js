import { timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import process from "node:process";
import { kv } from "@vercel/kv";

export const EXAM_DURATION = 60 * 60 * 1000;

const EXAM_STATE_KEY = "exam:state";
const LATEST_EXAM_KEY = "exam:latest-id";
const ALL_TEAMS_KEY = "exam:teams:all";
const VIOLATIONS_KEY = "exam:violations";

export const teamLockKey = (team) => `exam:lock:${encodeURIComponent(team)}`;
export const teamIndexKey = (examId) => `exam:teams:${examId}`;
export const teamRecordKey = (examId, team) =>
  `exam:team:${examId}:${encodeURIComponent(team)}`;
export const submissionKey = (examId, team) =>
  `exam:submission:${examId}:${encodeURIComponent(team)}`;

export async function getExamState() {
  return (await kv.get(EXAM_STATE_KEY)) || {
    started: false,
    code: null,
    id: null,
  };
}

export function normalizeTeam(value) {
  if (typeof value !== "string") return null;
  const team = value.trim();
  const hasControlCharacter = Array.from(team).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
  if (!team || team.length > 60 || hasControlCharacter) {
    return null;
  }
  return team;
}

export function isAdmin(req) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;

  const authorization = req.headers.authorization || "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  const candidate =
    (typeof bearer === "string" && bearer) ||
    (typeof req.body?.password === "string" && req.body.password) ||
    (typeof req.query?.password === "string" && req.query.password) ||
    "";

  const expectedBytes = Buffer.from(secret);
  const candidateBytes = Buffer.from(candidate);
  return (
    candidateBytes.length === expectedBytes.length &&
    timingSafeEqual(candidateBytes, expectedBytes)
  );
}

export async function getLatestExamId() {
  return kv.get(LATEST_EXAM_KEY);
}

export async function getViolations() {
  return kv.lrange(VIOLATIONS_KEY, 0, -1);
}

export async function recordViolation(violation) {
  await kv.lpush(VIOLATIONS_KEY, JSON.stringify(violation));
}

export async function addTeamToIndexes(examId, team) {
  await Promise.all([
    kv.sadd(teamIndexKey(examId), JSON.stringify(team)),
    kv.sadd(ALL_TEAMS_KEY, JSON.stringify(team)),
  ]);
}

export async function listTeams(examId) {
  const teams = await kv.smembers(teamIndexKey(examId));
  return teams.map((team) => String(team));
}

export async function clearAllTeamLocks() {
  const teams = await kv.smembers(ALL_TEAMS_KEY);
  if (teams.length) {
    await Promise.all(
      teams.map((team) => kv.del(teamLockKey(String(team))))
    );
  }
}

export async function setExamState(exam) {
  await kv.set(EXAM_STATE_KEY, exam);
}

export async function setLatestExamId(examId) {
  await kv.set(LATEST_EXAM_KEY, examId);
}
