// Baut für jede Stufe × Niveau × empfohlene Abwehr × empfohlenen Angriff × 1–5 Einheiten
// einen Plan mit der echten Planlogik aus app.js und meldet Lücken.
// Zunächst nur Warnung (Exit 0), mit --strict schlägt die Prüfung fehl.
const fs = require("fs"), vm = require("vm"), path = require("path");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const ctx = vm.createContext({
  localStorage: { getItem: () => null, setItem: () => {} },
  document: { addEventListener: () => {} }
});
vm.runInContext(read("data.js") + "\n" + read("app.js"), ctx);
const { STAGES, LEVELS, CATS, state, buildPlan } = vm.runInContext("({ STAGES, LEVELS, CATS, state, buildPlan })", ctx);

const MAX_UNITS = 5; // Regler „Einheiten pro Woche“ geht bis 5
const rows = [], details = new Map();
const note = (st, kind, text) => {
  const k = `${st.key}|${kind}|${text}`;
  details.set(k, (details.get(k) || 0) + 1);
};
STAGES.forEach((st, si) => {
  const r = { key: st.key, plaene: 0, leer: 0, fremd: 0, doppelt: 0 };
  for (const lv of LEVELS) for (const def of st.abwehr) for (const att of st.angriff) for (let n = 1; n <= MAX_UNITS; n++) {
    Object.assign(state, { stage: si, level: lv.key, def, att, units: n, swaps: {} });
    r.plaene++;
    for (const u of buildPlan()) {
      const seen = new Set();
      for (const b of u.blocks) {
        if (!b.ex) { r.leer++; note(st, "leer", `${u.titel} › ${b.label}`); continue; }
        if (!b.cats.includes(b.ex.cat)) { r.fremd++; note(st, "fremd", `${u.titel} › ${b.label} (${b.cats.map(c => CATS[c]).join("/")}) bekommt ${CATS[b.ex.cat]}`); }
        if (seen.has(b.ex.id)) { r.doppelt++; note(st, "doppelt", `${u.titel} › ${b.ex.name}`); }
        seen.add(b.ex.id);
      }
    }
  }
  rows.push(r);
});

console.log("\nPlanprüfung (Blöcke über alle Kombinationen)");
console.log("Stufe  Pläne  ohne Übung  kategoriefremd  doppelt");
for (const r of rows) console.log(`${r.key.padEnd(6)} ${String(r.plaene).padStart(5)}  ${String(r.leer).padStart(10)}  ${String(r.fremd).padStart(14)}  ${String(r.doppelt).padStart(7)}`);
const problems = rows.reduce((t, r) => t + r.leer + r.fremd + r.doppelt, 0);
if (problems) {
  console.log("\nLücken je Stufe und Block:");
  for (const k of details.keys()) { const [stage, kind, text] = k.split("|"); console.log(`  ${stage}  ${kind.padEnd(7)} ${text}`); }
  const msg = `\nWarnung: ${problems} unvollständige Blöcke. Inhalte ergänzen (data.js).`;
  if (process.argv.includes("--strict")) { console.error(msg); process.exit(1); }
  console.log(msg);
} else console.log("\nAlle Pläne vollständig.");
