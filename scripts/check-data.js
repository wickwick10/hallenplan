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
// Abdeckung: wie viele Übungen haben eine eigene Variante je System und Stufe
console.log("Übungen:", EX.length);
const rows = [];
STAGES.forEach((st, i) => {
  const inStage = EX.filter(e => i >= e.ages[0] && i <= e.ages[1]);
  const cells = st.abwehr.map(d => `${d}:${inStage.filter(e => e.def && e.def[d]).length}`).join(" ");
  rows.push(`${st.key.padEnd(8)} ${String(inStage.length).padStart(3)} Übungen | Abwehr-Varianten ${cells}`);
});
console.log(rows.join("\n"));
if (errors.length) { console.error("\nFehler:\n" + errors.join("\n")); process.exit(1); }
console.log("\nInhalte in Ordnung.");
