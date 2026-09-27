#!/usr/bin/env node
// Validates demo data: node scripts/validate.mjs
// - every profile has data/roasts/<id>.json
// - each file has all persona ids, exactly 3 { roast, fix } entries each
// - fix starts with "Fix:", no emojis or hashtags anywhere
// - every number in a roast exists in that profile's data (strict)
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

console.log(`\n${totalRoasts} roasts checked across ${profileIds.length} profiles.`);
if (failures) { console.error(`${failures} failure(s).`); process.exit(1); }
console.log("All checks passed.");
