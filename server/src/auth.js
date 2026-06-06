import crypto from "node:crypto";

const COOKIE_NAME = "humanloop_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function secret() {
  return process.env.SESSION_SECRET?.trim();
}

function configuredPassword() {
  return process.env.APP_PASSWORD?.trim();
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

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((part) => {
    const [name, ...value] = part.trim().split("=");
    return [name, decodeURIComponent(value.join("="))];
  }).filter(([name]) => name));
}

export function validateAuthConfig() {
  if (!configuredPassword() || configuredPassword().length < 12) {
    throw new Error("APP_PASSWORD must be at least 12 characters.");
  }
  if (!secret() || secret().length < 32) throw new Error("SESSION_SECRET must be at least 32 characters.");
}

export function verifyPassword(password) {
  return safeEqual(password, configuredPassword());
}

export function createSessionCookie() {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `${expires}.${crypto.randomBytes(16).toString("hex")}`;
  const token = `${payload}.${sign(payload)}`;
  const secure = secureCookie() ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${MAX_AGE_SECONDS}${secure}`;
}

export function clearSessionCookie() {
  const secure = secureCookie() ? "; Secure" : "";
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`;
}

export function isAuthenticated(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  return Number(parts[0]) > Date.now() && safeEqual(parts[2], sign(payload));
}

export function requireAuth(req, res, next) {
  if (isAuthenticated(req)) return next();
  res.status(401).json({ message: "Authentication required" });
}
