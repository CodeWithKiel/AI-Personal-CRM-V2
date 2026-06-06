import crypto from "node:crypto";
import { promisify } from "node:util";

const COOKIE_NAME = "humanloop_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const scrypt = promisify(crypto.scrypt);

function secret() {
  return process.env.SESSION_SECRET?.trim();
}

function secureCookie() {
  if (process.env.COOKIE_SECURE) return process.env.COOKIE_SECURE === "true";
  return process.env.NODE_ENV === "production";
}

function sign(value) {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

function safeEqual(left, right) {
  const a = Buffer.from(left || "");
  const b = Buffer.from(right || "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function encryptionKey() {
  return crypto.createHash("sha256").update(secret()).digest();
}

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((part) => {
    const [name, ...value] = part.trim().split("=");
    return [name, decodeURIComponent(value.join("="))];
  }).filter(([name]) => name));
}

export function validateAuthConfig() {
  if (!secret() || secret().length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters.");
  }
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64);
  return `${salt}:${Buffer.from(derived).toString("hex")}`;
}

export async function verifyPassword(password, storedHash) {
  const [salt, expected] = (storedHash || "").split(":");
  if (!salt || !expected) return false;
  const derived = await scrypt(password, salt, 64);
  return safeEqual(Buffer.from(derived).toString("hex"), expected);
}

export function createPasswordResetToken() {
  const token = crypto.randomBytes(32).toString("base64url");
  return {
    token,
    hash: crypto.createHash("sha256").update(token).digest("hex")
  };
}

export function hashPasswordResetToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

export function encryptSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(value) {
  const [iv, tag, encrypted] = String(value || "").split(".");
  if (!iv || !tag || !encrypted) return null;
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

export function createSessionCookie(userId) {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `${expires}.${userId}.${crypto.randomBytes(16).toString("hex")}`;
  const token = `${payload}.${sign(payload)}`;
  const secure = secureCookie() ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${MAX_AGE_SECONDS}${secure}`;
}

export function clearSessionCookie() {
  const secure = secureCookie() ? "; Secure" : "";
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`;
}

export function getSessionUserId(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const payload = `${parts[0]}.${parts[1]}.${parts[2]}`;
  if (Number(parts[0]) <= Date.now() || !safeEqual(parts[3], sign(payload))) return null;
  const userId = Number(parts[1]);
  return Number.isInteger(userId) ? userId : null;
}

export function requireAuth(req, res, next) {
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ message: "Authentication required" });
  req.userId = userId;
  next();
}
