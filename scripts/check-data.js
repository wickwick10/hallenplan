// Prüft die Inhalte in data.js auf Vollständigkeit und gültige Verweise.
const fs = require("fs"), vm = require("vm"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "data.js"), "utf8");
const ctx = {};
vm.runInNewContext(src + "\n;this.D = { STAGES, LEVELS, DEFENSES, ATTACKS, CATS, EX, UNIT_TEMPLATES };", ctx);
const { STAGES, DEFENSES, ATTACKS, CATS, EX } = ctx.D;
const errors = [];
const need = ["id", "name", "cat", "ages", "min", "spieler", "material", "ziel", "ablauf", "coaching", "leichter", "schwerer"];
const ids = new Set();
for (const e of EX) {
  const tag = e.id || e.name || "(ohne id)";
  for (const k of need) if (e[k] === undefined || e[k] === "") errors.push(`${tag}: Feld ${k} fehlt`);
  if (ids.has(e.id)) errors.push(`${tag}: id doppelt`);
  ids.add(e.id);
  if (!CATS[e.cat]) errors.push(`${tag}: unbekannte Kategorie ${e.cat}`);
  if (!Array.isArray(e.ages) || e.ages[0] < 0 || e.ages[1] >= STAGES.length || e.ages[0] > e.ages[1]) errors.push(`${tag}: ages ungültig`);
  for (const k of Object.keys(e.def || {})) if (!DEFENSES[k]) errors.push(`${tag}: unbekannte Abwehr ${k}`);
  for (const k of Object.keys(e.att || {})) if (!ATTACKS[k]) errors.push(`${tag}: unbekannter Angriff ${k}`);
  if (!Array.isArray(e.ablauf) || !e.ablauf.length) errors.push(`${tag}: ablauf leer`);
  if (!Array.isArray(e.coaching) || !e.coaching.length) errors.push(`${tag}: coaching leer`);
}
// Skizzen: Feld, Spieler, mindestens 3 Schritte, gültige Pfeile und Koordinaten im Feld
const FIELDS = { halb: [20, 20], ganz: [40, 20], klein: [12, 20], frei: [14, 12] };
const ROLES = ["att", "def", "tw", "tr"], ARROWS = ["pass", "lauf", "prellen", "sperre", "wurf"];
const MAT = ["huetchen", "stange", "matte", "kasten", "reifen"];
function checkSketch(tag, sk) {
  const err = m => errors.push(`${tag}: Skizze ${m}`);
  const F = FIELDS[sk.feld];
  if (!F) return err(`unbekanntes Feld ${sk.feld}`);
  const inField = p => Array.isArray(p) && p.length === 2 && p[0] >= 0 && p[1] >= 0 && p[0] <= F[0] && p[1] <= F[1];
  const ids = new Set();
  for (const p of sk.spieler || []) {
    if (!p.id || ids.has(p.id)) err(`Spieler-id fehlt oder doppelt (${p.id})`);
    ids.add(p.id);
    if (!ROLES.includes(p.rolle)) err(`unbekannte Rolle ${p.rolle}`);
  }
  if (!ids.size) err("ohne Spieler");
  for (const m of sk.material || []) if (!MAT.includes(m.typ) || !inField([m.x, m.y])) err(`Material ungültig (${m.typ})`);
  const steps = sk.schritte || [];
  if (steps.length < 3) err(`hat ${steps.length} Schritte, nötig sind mindestens 3`);
  const known = new Set();
  steps.forEach((st, i) => {
    const s = `Schritt ${i + 1}`;
    for (const [id, p] of Object.entries(st.pos || {})) {
      if (!ids.has(id)) err(`${s}: unbekannter Spieler ${id}`);
      if (!inField(p)) err(`${s}: ${id} liegt außerhalb des Felds`);
      known.add(id);
    }
    if (i === 0) for (const id of ids) if (!known.has(id)) err(`Schritt 1: Position für ${id} fehlt`);
    if (!st.text) err(`${s}: Erklärung fehlt`);
    const ref = p => typeof p === "string" ? ids.has(p) : inField(p);
    if (st.ball !== undefined && !ref(st.ball)) err(`${s}: Ball ungültig`);
    for (const a of st.pfeile || []) {
      if (!ARROWS.includes(a.typ)) err(`${s}: unbekannter Pfeil ${a.typ}`);
      if (!ref(a.von) || !ref(a.nach)) err(`${s}: Pfeil ${a.typ} mit ungültigem Start oder Ziel`);
    }
  });
}
for (const e of EX) if (e.skizze) checkSketch(e.id, e.skizze);
for (const [k, d] of Object.entries(DEFENSES)) {
  if (d.skizze) checkSketch(`Abwehr ${k}`, d.skizze);
  (d.szenarien || []).forEach((sk, i) => { if (!sk.titel) errors.push(`Abwehr ${k}: Szenario ${i + 1} ohne Titel`); checkSketch(`Abwehr ${k} „${sk.titel}“`, sk); });
}

// Abdeckung: wie viele Übungen haben eine eigene Variante je System und Stufe
console.log("Übungen:", EX.length, "· mit Skizze:", EX.filter(e => e.skizze).length, "· Abwehrsysteme mit Skizze:", Object.values(DEFENSES).filter(d => d.skizze || d.szenarien).length);
const rows = [];
STAGES.forEach((st, i) => {
  const inStage = EX.filter(e => i >= e.ages[0] && i <= e.ages[1]);
  const cells = st.abwehr.map(d => `${d}:${inStage.filter(e => e.def && e.def[d]).length}`).join(" ");
  rows.push(`${st.key.padEnd(8)} ${String(inStage.length).padStart(3)} Übungen | Abwehr-Varianten ${cells}`);
});
console.log(rows.join("\n"));
if (errors.length) { console.error("\nFehler:\n" + errors.join("\n")); process.exit(1); }
console.log("\nInhalte in Ordnung.");
