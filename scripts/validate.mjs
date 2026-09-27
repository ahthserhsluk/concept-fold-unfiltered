#!/usr/bin/env node
// Validates demo data: node scripts/validate.mjs
// - every profile has data/roasts/<id>.json
// - each file has all persona ids, exactly 3 { roast, fix } entries each
// - fix starts with "Fix:", no emojis or hashtags anywhere
// - every number in a roast exists in that profile's data (strict)
// - moments.json: 15 moments (3 per profile, in order), valid profile/persona ids,
//   all 9 persona keys with index 0-2, numbers in title exist in the profile
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "data");
const roastDir = join(dataDir, "roasts");
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}️‍]/u;

let failures = 0;
const fail = (where, msg) => { failures++; console.error(`  FAIL ${where}: ${msg}`); };

function readJSON(path) {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (e) { return { __error: e.message }; }
}

// Numbers inside text, e.g. "₹1,48,000", "35%", "11". Digits glued to a preceding
// letter (Zee5) are part of a name and ignored.
const NUM_RE = /(₹\s?)?(?<![\p{L}\d.,])(\d{1,3}(?:,\d{2})*,\d{3}|\d+)(\.\d+)?(%)?/gu;
function numbersIn(text) {
  const out = [];
  for (const m of String(text).matchAll(NUM_RE)) {
    out.push({ raw: m[0], value: Number((m[2] + (m[3] || "")).replace(/,/g, "")), rupee: !!m[1], pct: !!m[4] });
  }
  return out;
}

function allowedSet(p) {
  const s = new Set([p.salary, p.totalSpent, p.txnCount, p.percentOfSalary]);
  for (const c of p.categories) {
    s.add(c.total); s.add(c.count);
    for (const [, amt] of c.merchants) s.add(amt);
  }
  for (const pt of p.patterns) {
    if (pt.amount != null) s.add(pt.amount);
    for (const n of numbersIn(pt.text)) s.add(n.value);
  }
  for (const n of numbersIn(p.tagline || "")) s.add(n.value);
  return s;
}

const profilesPath = join(dataDir, "profiles.json");
const data = readJSON(profilesPath);
if (data.__error) { console.error(`FAIL profiles.json: ${data.__error}`); process.exit(1); }
const personaIds = data.personas.map((p) => p.id);
const profileIds = data.profiles.map((p) => p.id);
console.log(`profiles.json: ${personaIds.length} personas, ${profileIds.length} profiles`);

if (existsSync(roastDir)) {
  for (const f of readdirSync(roastDir).filter((f) => f.endsWith(".json"))) {
    const id = f.replace(/\.json$/, "");
    if (!profileIds.includes(id)) { console.log(`roasts/${f}`); fail(f, `no profile with id "${id}" in profiles.json`); }
  }
}

let totalRoasts = 0;
for (const p of data.profiles) {
  const file = `roasts/${p.id}.json`;
  const before = failures;
  console.log(file);
  const path = join(dataDir, file);
  if (!existsSync(path)) { fail(file, "missing file"); continue; }
  const roasts = readJSON(path);
  if (roasts.__error) { fail(file, `invalid JSON: ${roasts.__error}`); continue; }
  const allowed = allowedSet(p);
  let count = 0;

  for (const key of Object.keys(roasts)) if (!personaIds.includes(key)) fail(file, `unknown persona id "${key}"`);

  for (const pid of personaIds) {
    const list = roasts[pid];
    if (!Array.isArray(list)) { fail(file, `missing persona "${pid}"`); continue; }
    if (list.length !== 3) fail(file, `${pid} has ${list.length} entries, expected 3`);
    const seen = new Set();
    list.forEach((entry, i) => {
      const where = `${file} ${pid}[${i}]`;
      if (!entry || typeof entry !== "object") { fail(where, "entry is not an object"); return; }
      const extra = Object.keys(entry).filter((k) => k !== "roast" && k !== "fix");
      if (extra.length) fail(where, `unexpected keys: ${extra.join(", ")}`);
      const { roast, fix } = entry;
      if (typeof roast !== "string" || !roast.trim()) { fail(where, "roast missing or empty"); return; }
      if (typeof fix !== "string" || !fix.trim()) { fail(where, "fix missing or empty"); return; }
      count++;
      if (!fix.startsWith("Fix:")) fail(where, `fix must start with "Fix:" -> ${JSON.stringify(fix.slice(0, 40))}`);
      if (/^\s*Fix:/im.test(roast)) fail(where, "roast contains a Fix: line (belongs in fix)");
      for (const [name, text] of [["roast", roast], ["fix", fix]]) {
        if (EMOJI.test(text)) fail(where, `${name} contains an emoji`);
        if (/(^|\s)#\w/u.test(text)) fail(where, `${name} contains a hashtag`);
      }
      if (seen.has(roast)) fail(where, "duplicate roast within persona");
      seen.add(roast);
      const reported = new Set();
      for (const n of numbersIn(roast)) {
        if (reported.has(n.raw)) continue;
        reported.add(n.raw);
        if (!allowed.has(n.value)) fail(where, `number ${n.raw} (${n.value}) not in profile data -> "${roast}"`);
      }
      for (const m of roast.matchAll(/₹\s?(?:\d[\d,]*\d|\d)/g)) {
        const digits = m[0].replace(/₹\s?/, "");
        const v = Number(digits.replace(/,/g, ""));
        const expect = new Intl.NumberFormat("en-IN").format(v);
        if (digits !== expect) fail(where, `rupee format "${m[0]}" should be "₹${expect}"`);
      }
    });
  }
  totalRoasts += count;
  const n = failures - before;
  console.log(`  ${count} roasts, ${n === 0 ? "ok" : n + " problem(s)"}`);
}

// ---------- moments.json ----------
// 15 moments (3 per profile, in profiles.json order), valid profile + persona ids,
// all 9 persona keys with an index 0-2, and every number in `title` exists in the profile.
console.log("moments.json");
const momentsBefore = failures;
const momentsFile = readJSON(join(dataDir, "moments.json"));
let momentCount = 0;
if (momentsFile.__error) fail("moments.json", `missing or invalid JSON: ${momentsFile.__error}`);
else if (!Array.isArray(momentsFile.moments)) fail("moments.json", `expected { "moments": [...] }`);
else {
  const moments = momentsFile.moments;
  momentCount = moments.length;
  if (moments.length !== 15) fail("moments.json", `${moments.length} moments, expected 15`);
  const ids = new Set();
  const order = [];
  moments.forEach((m, i) => {
    const where = `moments.json [${i}]${m && m.id ? " " + m.id : ""}`;
    if (!m || typeof m !== "object") { fail(where, "moment is not an object"); return; }
    for (const k of ["id", "profile", "time", "trigger", "title", "persona"]) {
      if (typeof m[k] !== "string" || !m[k].trim()) fail(where, `${k} missing or empty`);
    }
    if (ids.has(m.id)) fail(where, `duplicate id "${m.id}"`);
    ids.add(m.id);
    const p = data.profiles.find((x) => x.id === m.profile);
    if (!p) fail(where, `unknown profile "${m.profile}"`);
    else order.push(m.profile);
    if (!personaIds.includes(m.persona)) fail(where, `unknown persona "${m.persona}"`);
    if (!m.roasts || typeof m.roasts !== "object" || Array.isArray(m.roasts)) fail(where, "roasts must be an object");
    else {
      for (const key of Object.keys(m.roasts)) if (!personaIds.includes(key)) fail(where, `roasts has unknown persona "${key}"`);
      for (const pid of personaIds) {
        const v = m.roasts[pid];
        if (!Number.isInteger(v) || v < 0 || v > 2) fail(where, `roasts["${pid}"] must be an integer 0-2, got ${JSON.stringify(v)}`);
      }
    }
    for (const [name, text] of [["title", m.title], ["trigger", m.trigger], ["time", m.time]]) {
      if (typeof text !== "string") continue;
      if (EMOJI.test(text)) fail(where, `${name} contains an emoji`);
      if (/(^|\s)#\w/u.test(text)) fail(where, `${name} contains a hashtag`);
    }
    if (typeof m.title === "string") {
      if (m.title.length > 44) fail(where, `title is ${m.title.length} chars, keep it under ~40`);
      if (p) {
        const allowed = allowedSet(p);
        for (const n of numbersIn(m.title)) {
          if (!allowed.has(n.value)) fail(where, `title number ${n.raw} (${n.value}) not in profile data -> "${m.title}"`);
        }
      }
      for (const mm of m.title.matchAll(/₹\s?(?:\d[\d,]*\d|\d)/g)) {
        const digits = mm[0].replace(/₹\s?/, "");
        const expect = new Intl.NumberFormat("en-IN").format(Number(digits.replace(/,/g, "")));
        if (digits !== expect) fail(where, `rupee format "${mm[0]}" should be "₹${expect}"`);
      }
    }
  });
  for (const pid of profileIds) {
    const n = moments.filter((m) => m && m.profile === pid).length;
    if (n !== 3) fail("moments.json", `profile "${pid}" has ${n} moments, expected 3`);
  }
  const expectedOrder = [...order].sort((a, b) => profileIds.indexOf(a) - profileIds.indexOf(b));
  if (order.join() !== expectedOrder.join()) fail("moments.json", "moments are not grouped in profiles.json order");
}
{
  const n = failures - momentsBefore;
  console.log(`  ${momentCount} moments, ${n === 0 ? "ok" : n + " problem(s)"}`);
}

console.log(`\n${totalRoasts} roasts and ${momentCount} moments checked across ${profileIds.length} profiles.`);
if (failures) { console.error(`${failures} failure(s).`); process.exit(1); }
console.log("All checks passed.");
