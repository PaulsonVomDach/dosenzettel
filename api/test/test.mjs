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
let tokenCalls = 0, sheetCalls = 0;
globalThis.fetch = async (url, init) => {
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
const env = { GOOGLE_SERVICE_ACCOUNT: JSON.stringify({ client_email: "sa@x.iam.gserviceaccount.com", private_key: pem }), SHEET_ID: "abc", ASSETS: kv, ALLOWED_ORIGINS: "https://dosenzettel.pages.dev", CACHE_SECONDS: "600" };
const ctx = { waitUntil: p => p };
const req = (path, origin, method = "GET") => new Request("https://api.test" + path, { method, headers: origin ? { Origin: origin } : {} });

let r = await worker.fetch(req("/data", "https://dosenzettel.pages.dev"), env, ctx);
assert.equal(r.status, 200);
assert.equal(r.headers.get("Access-Control-Allow-Origin"), "https://dosenzettel.pages.dev");
const d = await r.json();
assert.equal(d.colors.length, 1); assert.equal(d.brands[0][3], "Medium"); assert.equal(d.tiers.length, 2);
assert.equal(d.canImages.Loop.img, "a"); assert.equal(d.piece.w, 900);

await new Promise(res => setTimeout(res, 10));
r = await worker.fetch(req("/data", "https://dosenzettel.pages.dev"), env, ctx);
assert.equal(r.status, 200); assert.equal(sheetCalls, 1, "zweiter Abruf sollte aus dem Cache kommen");

r = await worker.fetch(req("/data", "https://fremde-seite.de"), env, ctx);
assert.equal(r.status, 403);
r = await worker.fetch(req("/data", "https://dosenzettel.pages.dev", "OPTIONS"), env, ctx);
assert.equal(r.status, 204);
r = await worker.fetch(req("/nix", "https://dosenzettel.pages.dev"), env, ctx);
assert.equal(r.status, 404);

store.clear();
const bad = { ...env, SHEET_ID: "" };
r = await worker.fetch(req("/data", "https://dosenzettel.pages.dev"), bad, ctx);
assert.equal(r.status, 502);

console.log("alle Tests ok (Token-Abrufe:", tokenCalls, ", Sheet-Abrufe:", sheetCalls + ")");
