// Lokaler Test ohne Cloudflare und ohne Google: Antworten werden nachgebaut.
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import worker, { signJwt } from "../src/index.js";

const { privateKey, publicKey } = await webcrypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const pkcs8 = Buffer.from(await webcrypto.subtle.exportKey("pkcs8", privateKey)).toString("base64");
const pem = "-----BEGIN PRIVATE KEY-----\n" + pkcs8.match(/.{1,64}/g).join("\n") + "\n-----END PRIVATE KEY-----\n";

// 1) JWT-Signatur prüfen
const jwt = await signJwt({ alg: "RS256", typ: "JWT" }, { iss: "x@y", iat: 1 }, pem);
const [h, p, s] = jwt.split(".");
const ok = await webcrypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, Buffer.from(s, "base64url"), new TextEncoder().encode(h + "." + p));
assert.equal(ok, true, "JWT-Signatur ungültig");

// 2) Google nachbauen
let tokenCalls = 0, sheetCalls = 0, verifyCalls = 0;
globalThis.fetch = async (url, init) => {
  if (String(url) === "https://challenges.cloudflare.com/turnstile/v0/siteverify") {
    verifyCalls++;
    assert.equal(init.body.get("secret"), "geheim");
    return new Response(JSON.stringify({ success: init.body.get("response") === "gutes-token" }), { status: 200 });
  }
  if (String(url).startsWith("https://oauth2.googleapis.com/token")) {
    tokenCalls++; assert.match(init.body, /assertion=/);
    return new Response(JSON.stringify({ access_token: "tok" }), { status: 200 });
  }
  if (String(url).includes("values:batchGet")) {
    sheetCalls++; assert.equal(init.headers.Authorization, "Bearer tok");
    assert.ok(String(url).includes(encodeURIComponent("Farben!A2:J")));
    return new Response(JSON.stringify({ valueRanges: [
      { values: [["Loop", "LP-100", "LP-100-INT", "White Matt", "#FFFFFF", "", "", "", "4,35 €", ""]] },
      { values: [["Loop", "Lösemittel", "Ja", "Medium"]] },
      { values: [["Loop", "1", "4,35 €"], ["Loop", "12", "4,30 €"]] },
    ] }), { status: 200 });
  }
  throw new Error("unerwartet: " + url);
};
const store = new Map();
globalThis.caches = { default: { match: async k => store.get(k.url)?.clone(), put: async (k, r) => { store.set(k.url, r); } } };
const kv = { get: async (k, t) => ({ canImages: { Loop: { img: "a", mask: "b" } }, piece: { img: "p", reg: "r", w: 900, h: 376 } })[k] ?? null };
let limitLeft = Infinity;
const limiter = { limit: async ({ key }) => { assert.ok(key); return { success: limitLeft-- > 0 }; } };
const env = { GOOGLE_SERVICE_ACCOUNT: JSON.stringify({ client_email: "sa@x.iam.gserviceaccount.com", private_key: pem }), SHEET_ID: "abc", ASSETS: kv,
  ALLOWED_ORIGINS: "https://dosenzettel.pages.dev,https://*.dosenzettel.pages.dev", CACHE_SECONDS: "600", TURNSTILE_SECRET: "geheim", RATE_LIMITER: limiter };
const ctx = { waitUntil: p => p };
const req = (path, origin, method = "GET", token = "gutes-token") => new Request("https://api.test" + path, { method,
  headers: { ...(origin ? { Origin: origin } : {}), ...(token ? { "X-Turnstile-Token": token } : {}), "CF-Connecting-IP": "203.0.113.7" } });

let r = await worker.fetch(req("/data", "https://dosenzettel.pages.dev"), env, ctx);
assert.equal(r.status, 200);
assert.equal(r.headers.get("Access-Control-Allow-Origin"), "https://dosenzettel.pages.dev");
assert.equal(r.headers.get("Cache-Control"), "private, no-store");
const d = await r.json();
assert.equal(d.colors.length, 1); assert.equal(d.brands[0][3], "Medium"); assert.equal(d.tiers.length, 2);
assert.equal(d.canImages.Loop.img, "a"); assert.equal(d.piece.w, 900);

await new Promise(res => setTimeout(res, 10));
r = await worker.fetch(req("/data", "https://dosenzettel.pages.dev"), env, ctx);
assert.equal(r.status, 200); assert.equal(sheetCalls, 1, "zweiter Abruf sollte aus dem Cache kommen");

r = await worker.fetch(req("/data", "https://fremde-seite.de"), env, ctx);
assert.equal(r.status, 403);

// Direkt im Browser oder per Skript (ohne Origin): gesperrt
r = await worker.fetch(req("/data", null), env, ctx);
assert.equal(r.status, 403, "ohne Origin muss gesperrt sein");

// Vorschau-Adressen von Cloudflare Pages sind erlaubt, ähnlich klingende fremde Domains nicht
r = await worker.fetch(req("/data", "https://dev.dosenzettel.pages.dev"), env, ctx);
assert.equal(r.status, 200);
assert.equal(r.headers.get("Access-Control-Allow-Origin"), "https://dev.dosenzettel.pages.dev");
r = await worker.fetch(req("/data", "https://dosenzettel.pages.dev.evil.com"), env, ctx);
assert.equal(r.status, 403);

// Turnstile: ohne Token, mit falschem Token, ohne Secret
r = await worker.fetch(req("/data", "https://dosenzettel.pages.dev", "GET", null), env, ctx);
assert.equal(r.status, 403); assert.equal((await r.json()).error, "missing token");
r = await worker.fetch(req("/data", "https://dosenzettel.pages.dev", "GET", "falsch"), env, ctx);
assert.equal(r.status, 403); assert.equal((await r.json()).error, "turnstile failed");
r = await worker.fetch(req("/data", "https://dosenzettel.pages.dev"), { ...env, TURNSTILE_SECRET: "" }, ctx);
assert.equal(r.status, 503);

// Rate-Limit
limitLeft = 0;
r = await worker.fetch(req("/data", "https://dosenzettel.pages.dev"), env, ctx);
assert.equal(r.status, 429);
limitLeft = Infinity;

// Preflight erlaubt den Token-Header
r = await worker.fetch(req("/data", "https://dosenzettel.pages.dev", "OPTIONS", null), env, ctx);
assert.match(r.headers.get("Access-Control-Allow-Headers"), /X-Turnstile-Token/);
r = await worker.fetch(req("/data", "https://dosenzettel.pages.dev", "OPTIONS"), env, ctx);
assert.equal(r.status, 204);
r = await worker.fetch(req("/nix", "https://dosenzettel.pages.dev"), env, ctx);
assert.equal(r.status, 404);

store.clear();
const bad = { ...env, SHEET_ID: "" };
r = await worker.fetch(req("/data", "https://dosenzettel.pages.dev"), bad, ctx);
assert.equal(r.status, 502);

console.log("alle Tests ok (Token-Abrufe:", tokenCalls, ", Sheet-Abrufe:", sheetCalls + ", Turnstile-Prüfungen:", verifyCalls + ")");
