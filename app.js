const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const state = { stage: 3, level: "fort", def: "3:2:1", att: "3:3", units: 3, swaps: {} };
try { Object.assign(state, JSON.parse(localStorage.getItem("hb-plan") || "{}")); } catch (e) {}
const save = () => { try { localStorage.setItem("hb-plan", JSON.stringify(state)); } catch (e) {} };

// Spielfeld-Skizze: Tor oben, 6-m-Linie durchgezogen, 9-m-Linie gestrichelt
function court(defKey, attKey, opts = {}) {
  const d = defKey ? DEFENSES[defKey] : null, a = attKey ? ATTACKS[attKey] : null;
  let s = `<svg class="court" viewBox="0 0 200 150" role="img" aria-label="Aufstellung ${esc(d ? d.name : "")} ${esc(a ? a.name : "")}">
    <rect x="0" y="0" width="200" height="150" class="c-floor"/>
    <path d="M25 0 A60 60 0 0 0 85 60 L115 60 A60 60 0 0 0 175 0 Z" class="c-zone"/>
    <path d="M25 0 A60 60 0 0 0 85 60 L115 60 A60 60 0 0 0 175 0" class="c-line"/>
    <path d="M0 29.6 A90 90 0 0 0 85 90 L115 90 A90 90 0 0 0 200 29.6" class="c-line c-dash"/>
    <rect x="85" y="0" width="30" height="3" class="c-goal"/>
    <circle cx="100" cy="9" r="4.2" class="c-tw"/>`;
  if (a) a.pos.forEach(([x, y], i) => { s += `<circle cx="${x}" cy="${y}" r="5" class="c-att"/>`; });
  if (d) d.pos.forEach(([x, y]) => { s += `<circle cx="${x}" cy="${y}" r="5" class="c-def"/>`; });
  return s + `</svg>`;
}

// Skizzen: Felder in Metern (1 m = 10 Einheiten). Halbfeld und Kleinfeld mit Tor oben, ganzes Feld quer.
// Pfeile: Pass gestrichelt, Lauf durchgezogen, Prellen Wellenlinie, Sperre Querbalken, Wurf Doppelpfeil.
const SK_FIELDS = {
  halb: { w: 20, h: 20, name: "Halbfeld" },
  ganz: { w: 40, h: 20, name: "Ganzes Feld" },
  klein: { w: 12, h: 20, name: "Kleinfeld 20 × 12 m" },
  frei: { w: 14, h: 12, name: "Freie Fläche" }
};
const SK_ROLES = { att: "Angriff", def: "Abwehr", tw: "Torhüter", tr: "Trainer" };
const SK_ARROWS = { pass: "Pass", lauf: "Lauf", prellen: "Prellen", sperre: "Sperre", wurf: "Wurf" };
const SK_MAT = { huetchen: "Hütchen", stange: "Stange", matte: "Matte", kasten: "Kasten", reifen: "Reifen" };
const SK = 10, skReg = [];
const f1 = n => Math.round(n * 10) / 10;

// Torraum als Bogen: Viertelkreise mit Radius r um die Pfosten, Tor oben in der Mitte der Breite w
const skZone = (w, r, post) => {
  const a = w / 2 - post, b = w / 2 + post;
  return `M${f1((a - r) * SK)} 0 A${r * SK} ${r * SK} 0 0 0 ${f1(a * SK)} ${f1(r * SK)} L${f1(b * SK)} ${f1(r * SK)} A${r * SK} ${r * SK} 0 0 0 ${f1((b + r) * SK)} 0`;
};
function skField(sk) {
  const F = SK_FIELDS[sk.feld], W = F.w * SK, H = F.h * SK;
  let s = `<rect x="0" y="0" width="${W}" height="${H}" class="c-floor"/>`;
  if (sk.feld === "frei") return s;
  if (sk.feld === "ganz") {
    // zwei Torräume, links und rechts; gezeichnet als gedrehte Halbfeld-Zonen
    const zone = skZone(20, 6, 1.5), nine = skZone(20, 9, 1.5);
    for (const t of [`translate(0 ${H}) rotate(-90)`, `translate(${W} 0) rotate(90)`])
      s += `<g transform="${t}"><path d="${zone} Z" class="c-zone"/><path d="${zone}" class="c-line"/><path d="${nine}" class="c-line c-dash"/><rect x="85" y="-1" width="30" height="4" class="c-goal"/></g>`;
    return s + `<line x1="${W / 2}" y1="0" x2="${W / 2}" y2="${H}" class="c-line"/><circle cx="${W / 2}" cy="${H / 2}" r="3" class="c-goal"/>`;
  }
  if (sk.feld === "klein") {
    // Torraum als 5-m-Linie (Bogen) oder Rechteck, kleines Tor (Breite unsicher, Hinweis im PR)
    const z = sk.torraum === "rechteck" ? `M${2 * SK} 0 L${2 * SK} ${5 * SK} L${10 * SK} ${5 * SK} L${10 * SK} 0` : skZone(12, 5, 1);
    s += `<path d="${z} Z" class="c-zone"/><path d="${z}" class="c-line"/><rect x="${5 * SK}" y="-1" width="${2 * SK}" height="4" class="c-goal"/>`;
    return s + `<line x1="0" y1="${H}" x2="${W}" y2="${H}" class="c-line"/>`;
  }
  const zone = skZone(20, 6, 1.5);
  return s + `<path d="${zone} Z" class="c-zone"/><path d="${zone}" class="c-line"/><path d="${skZone(20, 9, 1.5)}" class="c-line c-dash"/>
    <line x1="95" y1="70" x2="105" y2="70" class="c-line"/><rect x="85" y="-1" width="30" height="4" class="c-goal"/>
    <line x1="0" y1="${H - 1}" x2="${W}" y2="${H - 1}" class="c-line"/>`;
}
// Positionen gelten weiter, bis ein späterer Schritt sie ändert
function skPositions(sk, i) {
  const pos = {};
  for (let k = 0; k <= i; k++) Object.assign(pos, sk.schritte[k].pos || {});
  return pos;
}
const skPt = (p, pos) => typeof p === "string" ? pos[p] : p;
function skArrow(a, pos) {
  let [x1, y1] = skPt(a.von, pos), [x2, y2] = skPt(a.nach, pos);
  x1 *= SK; y1 *= SK; x2 *= SK; y2 *= SK;
  const L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L, nx = -uy, ny = ux;
  // Pfeil beginnt und endet neben dem Spielerkreis
  const g0 = typeof a.von === "string" ? 7 : 0, g1 = typeof a.nach === "string" ? 8 : 0;
  x1 += ux * g0; y1 += uy * g0; x2 -= ux * g1; y2 -= uy * g1;
  const len = Math.max(L - g0 - g1, 1);
  const head = (x, y) => `<path d="M${f1(x)} ${f1(y)} L${f1(x - ux * 6 + nx * 3.5)} ${f1(y - uy * 6 + ny * 3.5)} L${f1(x - ux * 6 - nx * 3.5)} ${f1(y - uy * 6 - ny * 3.5)} Z" class="sk-head"/>`;
  const ex = x2 - ux * 5, ey = y2 - uy * 5;
  if (a.typ === "pass") return `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(ex)}" y2="${f1(ey)}" class="sk-a sk-pass"/>${head(x2, y2)}`;
  if (a.typ === "lauf") return `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(ex)}" y2="${f1(ey)}" class="sk-a"/>${head(x2, y2)}`;
  if (a.typ === "sperre") return `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" class="sk-a"/><line x1="${f1(x2 + nx * 6)}" y1="${f1(y2 + ny * 6)}" x2="${f1(x2 - nx * 6)}" y2="${f1(y2 - ny * 6)}" class="sk-a sk-bar"/>`;
  if (a.typ === "wurf") return [1.6, -1.6].map(o => `<line x1="${f1(x1 + nx * o)}" y1="${f1(y1 + ny * o)}" x2="${f1(ex + nx * o)}" y2="${f1(ey + ny * o)}" class="sk-a"/>`).join("") + head(x2, y2);
  // Prellen: Wellenlinie, Wellenlänge 8 Einheiten
  const n = Math.max(2, Math.round((len - 5) / 8));
  let d = `M${f1(x1)} ${f1(y1)}`;
  for (let k = 1; k <= n; k++) {
    const t = (len - 5) * k / n, tm = (len - 5) * (k - .5) / n, o = k % 2 ? 3 : -3;
    d += ` Q${f1(x1 + ux * tm + nx * o)} ${f1(y1 + uy * tm + ny * o)} ${f1(x1 + ux * t)} ${f1(y1 + uy * t)}`;
  }
  return `<path d="${d}" class="sk-a"/>${head(x2, y2)}`;
}
function skPlayer(p) {
  const shape = p.rolle === "def" ? `<path d="M0 -7.5 L6.8 4.5 L-6.8 4.5 Z" class="sk-def"/>` :
    p.rolle === "tr" ? `<rect x="-6" y="-6" width="12" height="12" rx="2" class="sk-tr"/>` : `<circle r="6.5" class="sk-${p.rolle}"/>`;
  return `${shape}<text y="${p.rolle === "def" ? 2.6 : 2}" class="sk-kz">${esc(p.kz || "")}</text>`;
}
function skMaterial(m) {
  const x = m.x * SK, y = m.y * SK;
  if (m.typ === "huetchen") return `<path d="M${x} ${y - 4} L${x + 3.5} ${y + 3} L${x - 3.5} ${y + 3} Z" class="sk-mat"/>`;
  if (m.typ === "stange") return `<circle cx="${x}" cy="${y}" r="2" class="sk-mat"/>`;
  if (m.typ === "reifen") return `<circle cx="${x}" cy="${y}" r="5" class="sk-ring"/>`;
  if (m.typ === "kasten") return `<rect x="${x - 8}" y="${y - 4}" width="16" height="8" class="sk-mat"/>`;
  return `<rect x="${x - 10}" y="${y - 5}" width="20" height="10" rx="1" class="sk-mat sk-soft"/>`;
}
// Inhalt eines Schritts, der sich ändert: Pfeile und Ball
function skLayer(sk, i) {
  const pos = skPositions(sk, i), st = sk.schritte[i];
  const b = st.ball ? skPt(st.ball, pos) : null;
  const ball = b ? `<circle cx="${f1(b[0] * SK + (typeof st.ball === "string" ? 5.5 : 0))}" cy="${f1(b[1] * SK - (typeof st.ball === "string" ? 5.5 : 0))}" r="2.8" class="sk-ball"/>` : "";
  return (st.pfeile || []).map(a => skArrow(a, pos)).join("") + ball;
}
function skSvg(sk, i, cls) {
  const F = SK_FIELDS[sk.feld], pos = skPositions(sk, i);
  return `<svg class="${cls}" viewBox="-2 -2 ${F.w * SK + 4} ${F.h * SK + 4}" role="img" aria-label="${esc(sk.titel || F.name)}, Schritt ${i + 1}">
    ${skField(sk)}${(sk.material || []).map(skMaterial).join("")}
    <g class="sk-layer">${skLayer(sk, i)}</g>
    ${sk.spieler.map(p => `<g class="sk-p" data-p="${esc(p.id)}" style="transform:translate(${f1(pos[p.id][0] * SK)}px,${f1(pos[p.id][1] * SK)}px)">${skPlayer(p)}</g>`).join("")}
  </svg>`;
}
function sketch(sk) {
  const n = skReg.push(sk) - 1, last = sk.schritte.length - 1;
  const used = new Set(sk.schritte.flatMap(s => (s.pfeile || []).map(a => a.typ)));
  const roles = new Set(sk.spieler.map(p => p.rolle));
  return `<figure class="sk" data-sk="${n}" data-step="0">
    ${skSvg(sk, 0, "court sk-live")}
    <figcaption>
      <p class="sk-text"><b class="num">1/${last + 1}</b> ${esc(sk.schritte[0].text)}</p>
      <div class="sk-ctl">
        <button type="button" data-sk-act="prev" aria-label="Schritt zurück" disabled>‹ Zurück</button>
        <button type="button" data-sk-act="play" aria-label="Abspielen">▶ Abspielen</button>
        <button type="button" data-sk-act="next" aria-label="Nächster Schritt">Weiter ›</button>
      </div>
      <p class="sk-dots" aria-hidden="true">${sk.schritte.map((_, k) => `<i class="${k ? "" : "on"}"></i>`).join("")}</p>
      <p class="legend">${[...roles].map(r => `<span><span class="lg lg-${r}"></span> ${SK_ROLES[r]}</span>`).join("")}${[...used].map(t => `<span><span class="lg-a lg-${t}"></span> ${SK_ARROWS[t]}</span>`).join("")}</p>
    </figcaption>
    <div class="sk-print">${sk.schritte.map((s, k) => `<div>${skSvg(sk, k, "court")}<p><b class="num">${k + 1}</b> ${esc(s.text)}</p></div>`).join("")}</div>
  </figure>`;
}
// Mehrere Szenarien je System: Auswahl über Knöpfe, darunter die Skizze
const scnReg = [];
function scenarios(list) {
  const n = scnReg.push(list) - 1;
  return `<div class="scn" data-scn="${n}">
    <div class="scn-tabs">${list.map((sk, i) => `<button type="button" data-scn-i="${i}" aria-pressed="${!i}">${esc(sk.titel)}</button>`).join("")}</div>
    <div class="scn-body">${sketch(list[0])}</div>
  </div>`;
}
function scnPick(btn) {
  const box = btn.closest(".scn"), i = +btn.dataset.scnI;
  box.querySelectorAll(".sk").forEach(skStop);
  box.querySelectorAll("[data-scn-i]").forEach(b => b.setAttribute("aria-pressed", b === btn));
  box.querySelector(".scn-body").innerHTML = sketch(scnReg[+box.dataset.scn][i]);
}

function skGo(fig, i) {
  const sk = skReg[+fig.dataset.sk], last = sk.schritte.length - 1;
  i = Math.max(0, Math.min(last, i));
  fig.dataset.step = i;
  const pos = skPositions(sk, i), svg = fig.querySelector(".sk-live");
  svg.querySelectorAll(".sk-p").forEach(g => { const p = pos[g.dataset.p]; g.style.transform = `translate(${f1(p[0] * SK)}px,${f1(p[1] * SK)}px)`; });
  svg.querySelector(".sk-layer").innerHTML = skLayer(sk, i);
  svg.setAttribute("aria-label", `${sk.titel || SK_FIELDS[sk.feld].name}, Schritt ${i + 1}`);
  fig.querySelector(".sk-text").innerHTML = `<b class="num">${i + 1}/${last + 1}</b> ${esc(sk.schritte[i].text)}`;
  fig.querySelectorAll(".sk-dots i").forEach((d, k) => d.classList.toggle("on", k === i));
  fig.querySelector('[data-sk-act="prev"]').disabled = i === 0;
  fig.querySelector('[data-sk-act="next"]').disabled = i === last;
}
function skStop(fig) {
  clearInterval(fig._timer); fig._timer = null;
  const b = fig.querySelector('[data-sk-act="play"]');
  if (b) { b.textContent = "▶ Abspielen"; b.setAttribute("aria-label", "Abspielen"); }
}
function skAction(fig, act) {
  const i = +fig.dataset.step, last = skReg[+fig.dataset.sk].schritte.length - 1;
  if (act !== "play") { skStop(fig); return skGo(fig, i + (act === "next" ? 1 : -1)); }
  if (fig._timer) return skStop(fig);
  if (i === last) skGo(fig, 0);
  const b = fig.querySelector('[data-sk-act="play"]');
  b.textContent = "❚❚ Pause"; b.setAttribute("aria-label", "Pause");
  fig._timer = setInterval(() => {
    const k = +fig.dataset.step + 1;
    skGo(fig, k);
    if (k >= last || !fig.isConnected) skStop(fig);
  }, 2200);
}

function minutesFor() {
  const st = STAGES[state.stage];
  return st.minutes + (state.level === "leistung" && state.stage >= 3 ? 15 : 0);
}

function candidates(cats, used) {
  const st = state.stage;
  let list = EX.filter(e => cats.includes(e.cat) && st >= e.ages[0] && st <= e.ages[1] && !used.has(e.id));
  if (!list.length) list = EX.filter(e => ["spiel", "a11", "d11", "warm"].includes(e.cat) && st >= e.ages[0] && st <= e.ages[1] && !used.has(e.id));
  const fit = e => (e.def && e.def[state.def] ? 1 : 0) + (e.att && e.att[state.att] ? 1 : 0);
  return list.sort((x, y) => fit(y) - fit(x));
}

function buildPlan() {
  const total = minutesFor();
  const order = state.stage <= 1 ? [0, 2, 1, 4, 3] : [0, 1, 2, 3, 4];
  const units = [];
  for (let u = 0; u < state.units; u++) {
    const tpl = UNIT_TEMPLATES[order[u % order.length]];
    const used = new Set();
    const blocks = tpl.blocks.map(([label, cats, share], b) => {
      const key = `${u}-${b}`;
      const list = candidates(cats, used);
      const offset = (u + (state.swaps[key] || 0)) % Math.max(list.length, 1);
      const ex = list[offset] || list[0];
      if (ex) used.add(ex.id);
      return { key, label, cats, min: Math.round(total * share / 5) * 5 || 5, ex, alt: list.length > 1 };
    });
    units.push({ titel: tpl.titel, blocks, total: blocks.reduce((t, b) => t + b.min, 0) });
  }
  return units;
}

function adaptFor(e) {
  const out = [];
  if (e.def && e.def[state.def]) out.push(["Abwehr " + DEFENSES[state.def].name, e.def[state.def]]);
  if (e.att && e.att[state.att]) out.push(["Angriff " + ATTACKS[state.att].name, e.att[state.att]]);
  return out;
}
const levelNote = e => state.level === "basis" ? ["Leichter", e.leichter] : state.level === "leistung" ? ["Schwerer", e.schwerer] : null;

function renderControls() {
  const st = STAGES[state.stage];
  $("#f-stage").innerHTML = STAGES.map((s, i) => `<option value="${i}" ${i == state.stage ? "selected" : ""}>${esc(s.name)} (${esc(s.age)})</option>`).join("");
  $("#f-level").innerHTML = LEVELS.map(l => `<option value="${l.key}" ${l.key === state.level ? "selected" : ""}>${esc(l.name)}</option>`).join("");
  $("#f-def").innerHTML = Object.entries(DEFENSES).map(([k, d]) => `<option value="${esc(k)}" ${k === state.def ? "selected" : ""}>${esc(d.name)}${st.abwehr.includes(k) ? "" : " (für diese Altersstufe unüblich)"}</option>`).join("");
  $("#f-att").innerHTML = Object.entries(ATTACKS).map(([k, a]) => `<option value="${esc(k)}" ${k === state.att ? "selected" : ""}>${esc(a.name)}${st.angriff.includes(k) ? "" : " (für diese Altersstufe unüblich)"}</option>`).join("");
  $("#f-units").value = state.units;
  $("#f-units-out").textContent = state.units;
}

function renderPlan() {
  const st = STAGES[state.stage], d = DEFENSES[state.def], a = ATTACKS[state.att];
  const warn = [];
  if (!st.abwehr.includes(state.def)) warn.push(`Abwehr ${d.name} ist für die ${st.name} unüblich. Empfohlen: ${st.abwehr.map(k => DEFENSES[k].name).join(", ")}.`);
  if (!st.angriff.includes(state.att)) warn.push(`Angriff ${a.name} ist für die ${st.name} unüblich. Empfohlen: ${st.angriff.map(k => ATTACKS[k].name).join(", ")}.`);
  const units = buildPlan();
  $("#plan-summary").innerHTML = `
    <div class="sum-head">
      <p class="eyebrow">${esc(st.stufe)}</p>
      <h2>${esc(st.name)} <span class="muted">${esc(st.age)}</span></h2>
      <p class="sys-line"><span class="chip chip-def">Abwehr ${esc(d.name)}</span><span class="chip chip-att">Angriff ${esc(a.name)}</span><span class="chip">${esc(LEVELS.find(l => l.key === state.level).name)}</span></p>
    </div>
    ${court(state.def, state.att)}
    <p class="legend"><span class="dot dot-def"></span>Abwehr <span class="dot dot-att"></span>Angriff <span class="dot dot-tw"></span>Torhüter</p>
    ${warn.map(w => `<p class="warn">${esc(w)}</p>`).join("")}
    <h3>Ausbildungsschwerpunkte</h3>
    <ul class="ticks">${st.fokus.map(f => `<li>${esc(f)}</li>`).join("")}</ul>
    <h3>Inhaltsverteilung</h3>
    <div class="mix">${st.mix.map(([n, p]) => `<div class="mix-row"><span>${esc(n)}</span><div class="bar"><i style="width:${p}%"></i></div><span class="num">${p} %</span></div>`).join("")}</div>
    <h3>Im System ${esc(d.name)} trainieren</h3>
    <ul class="ticks">${d.trainieren.map(f => `<li>${esc(f)}</li>`).join("")}</ul>
    <h3>Krafttraining in dieser Stufe</h3>
    <p>${esc(st.kraft)}</p>
    <p class="note">${esc(st.hinweis)}</p>`;
  $("#plan-units").innerHTML = units.map((u, i) => `
    <article class="unit">
      <header><p class="eyebrow">Einheit ${i + 1}</p><h3>${esc(u.titel)}</h3><span class="num total">${u.total} min</span></header>
      <ol class="blocks">${u.blocks.map(b => {
        const ad = b.ex ? adaptFor(b.ex) : [];
        return `<li class="block">
          <span class="num t">${b.min}′</span>
          <div class="b-main">
            <p class="b-label">${esc(b.label)} · ${esc(CATS[b.ex.cat])}</p>
            <button class="ex-link" data-ex="${b.ex.id}">${esc(b.ex.name)}</button>
            ${ad.length ? `<p class="adapt"><b>Angepasst:</b> ${esc(ad[0][1])}</p>` : ""}
          </div>
          ${b.alt ? `<button class="swap" data-swap="${b.key}" title="Andere Übung wählen" aria-label="Andere Übung für ${esc(b.label)}">↻</button>` : ""}
        </li>`; }).join("")}</ol>
    </article>`).join("");
}

// Kurzname für Listen: „D-Jugend“, bei den Aktiven ohne „-Jugend“
const stageShort = i => STAGES[i].key === "S" ? "Aktive" : STAGES[i].key + "-Jugend";

function renderLibrary() {
  const q = ($("#lib-q").value || "").toLowerCase(), cat = $("#lib-cat").value, ageOnly = $("#lib-age").checked;
  const list = EX.filter(e => (!cat || e.cat === cat) && (!ageOnly || (state.stage >= e.ages[0] && state.stage <= e.ages[1])) &&
    (!q || (e.name + " " + e.ziel).toLowerCase().includes(q)));
  $("#lib-count").textContent = `${list.length} Übungen`;
  $("#lib-list").innerHTML = list.map(e => {
    const ad = adaptFor(e);
    return `<li class="lib-item"><button class="ex-card" data-ex="${e.id}">
      <span class="b-label">${esc(CATS[e.cat])}</span>
      <span class="ex-name">${esc(e.name)}</span>
      <span class="ex-meta"><span class="num">${e.min}′</span> · ${esc(stageShort(e.ages[0]))} bis ${esc(stageShort(e.ages[1]))}${ad.length ? ` · <span class="fit">an dein System angepasst</span>` : ""}</span>
      <span class="ex-goal">${esc(e.ziel)}</span>
    </button></li>`; }).join("") || `<li class="empty">Keine Übung passt zu diesem Filter.</li>`;
}

function renderSystems() {
  const card = (k, s, isDef) => `<article class="sys-card">
    ${s.szenarien ? scenarios(s.szenarien) : s.skizze ? sketch(s.skizze) : isDef ? court(k, null, { bare: true }) : court(null, k, { bare: true })}
    <div class="sys-body">
      <p class="eyebrow">${isDef ? "Abwehr · " + esc(s.typ) : "Angriff"}</p>
      <h3>${esc(s.name)}</h3>
      <p>${esc(s.kurz)}</p>
      ${s.staerken ? `<p class="kv"><b>Stärken:</b> ${esc(s.staerken.join("; "))}</p><p class="kv"><b>Schwächen:</b> ${esc(s.schwaechen.join("; "))}</p>` : ""}
      <p class="kv"><b>Trainingsschwerpunkte:</b> ${esc(s.trainieren.join("; "))}</p>
      <p class="kv"><b>Empfohlen für:</b> ${esc(STAGES.filter(st => (isDef ? st.abwehr : st.angriff).includes(k)).map(st => st.name).join(", "))}</p>
      <p class="kv"><b>Übungen mit Anpassung:</b> ${EX.filter(e => (isDef ? e.def : e.att) && (isDef ? e.def : e.att)[k]).length}</p>
    </div></article>`;
  $("#sys-def").innerHTML = Object.entries(DEFENSES).map(([k, s]) => card(k, s, true)).join("");
  $("#sys-att").innerHTML = Object.entries(ATTACKS).map(([k, s]) => card(k, s, false)).join("");
}

function renderStages() {
  $("#stage-table").innerHTML = `<table><thead><tr><th>Altersstufe</th><th>Ausbildungsstufe</th><th>Abwehr</th><th>Angriff</th><th>Einheit</th><th>Krafttraining</th></tr></thead><tbody>
    ${STAGES.map(s => `<tr><th scope="row">${esc(s.name)}<br><span class="muted">${esc(s.age)}</span></th><td>${esc(s.stufe)}</td>
      <td>${esc(s.abwehr.map(k => DEFENSES[k].name).join(", "))}</td><td>${esc(s.angriff.map(k => ATTACKS[k].name).join(", "))}</td>
      <td class="num">${s.minutes} min</td><td>${esc(s.kraft)}</td></tr>`).join("")}</tbody></table>`;
}

function openEx(id) {
  const e = EX.find(x => x.id === id); if (!e) return;
  const ad = adaptFor(e), ln = levelNote(e);
  const others = [];
  if (e.def) Object.entries(e.def).forEach(([k, v]) => { if (k !== state.def) others.push(["Abwehr " + DEFENSES[k].name, v]); });
  if (e.att) Object.entries(e.att).forEach(([k, v]) => { if (k !== state.att) others.push(["Angriff " + ATTACKS[k].name, v]); });
  $("#ex-body").innerHTML = `
    <p class="eyebrow">${esc(CATS[e.cat])}</p>
    <h2>${esc(e.name)}</h2>
    <dl class="facts"><div><dt>Dauer</dt><dd class="num">${e.min} min</dd></div><div><dt>Spieler</dt><dd>${esc(e.spieler)}</dd></div>
      <div><dt>Material</dt><dd>${esc(e.material)}</dd></div><div><dt>Altersstufen</dt><dd>${esc(STAGES[e.ages[0]].name)} bis ${esc(STAGES[e.ages[1]].name)}</dd></div></dl>
    <p class="goal"><b>Ziel:</b> ${esc(e.ziel)}</p>
    ${e.skizze ? sketch(e.skizze) : ""}
    <h3>Ablauf</h3><ol class="steps">${e.ablauf.map(x => `<li>${esc(x)}</li>`).join("")}</ol>
    <h3>Coaching-Punkte</h3><ul class="ticks">${e.coaching.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
    ${ad.length ? `<h3>Anpassung an dein System</h3>${ad.map(([k, v]) => `<p class="adapt-box"><b>${esc(k)}:</b> ${esc(v)}</p>`).join("")}` : ""}
    ${ln ? `<h3>Für dein Niveau</h3><p class="adapt-box"><b>${ln[0]}:</b> ${esc(ln[1])}</p>` : `<p class="kv"><b>Leichter:</b> ${esc(e.leichter)}</p><p class="kv"><b>Schwerer:</b> ${esc(e.schwerer)}</p>`}
    ${others.length ? `<details><summary>Varianten für andere Systeme (${others.length})</summary>${others.map(([k, v]) => `<p class="kv"><b>${esc(k)}:</b> ${esc(v)}</p>`).join("")}</details>` : ""}`;
  $("#ex-dialog").showModal();
}

function renderAll() { renderControls(); renderPlan(); renderLibrary(); renderSystems(); }

function showTab(t) {
  if (!["plan", "uebungen", "systeme", "stufen"].includes(t)) t = "plan";
  document.querySelectorAll(".tab").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === t));
  document.querySelectorAll(".view").forEach(v => v.hidden = v.id !== "v-" + t);
}

document.addEventListener("DOMContentLoaded", () => {
  $("#lib-cat").innerHTML = `<option value="">Alle Kategorien</option>` + Object.entries(CATS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");
  renderAll(); renderStages();
  showTab((location.hash || "").slice(1));
  $("#controls").addEventListener("input", ev => {
    const t = ev.target;
    if (t.id === "f-stage") {
      state.stage = +t.value;
      const st = STAGES[state.stage];
      if (!st.abwehr.includes(state.def)) state.def = st.abwehr[Math.min(1, st.abwehr.length - 1)];
      if (!st.angriff.includes(state.att)) state.att = st.angriff[0];
    }
    if (t.id === "f-level") state.level = t.value;
    if (t.id === "f-def") state.def = t.value;
    if (t.id === "f-att") state.att = t.value;
    if (t.id === "f-units") state.units = +t.value;
    state.swaps = {};
    save(); renderAll();
  });
  document.body.addEventListener("click", ev => {
    const scn = ev.target.closest("[data-scn-i]"); if (scn) return scnPick(scn);
    const ska = ev.target.closest("[data-sk-act]"); if (ska) return skAction(ska.closest(".sk"), ska.dataset.skAct);
    const ex = ev.target.closest("[data-ex]"); if (ex) return openEx(ex.dataset.ex);
    const sw = ev.target.closest("[data-swap]");
    if (sw) { state.swaps[sw.dataset.swap] = (state.swaps[sw.dataset.swap] || 0) + 1; save(); renderPlan(); return; }
    const tab = ev.target.closest(".tab"); if (tab) { showTab(tab.dataset.tab); return; }
    if (ev.target.id === "ex-close" || ev.target.id === "ex-dialog") $("#ex-dialog").close();
  });
  $("#ex-dialog").addEventListener("close", () => document.querySelectorAll(".sk").forEach(skStop));
  ["lib-q", "lib-cat", "lib-age"].forEach(id => $("#" + id).addEventListener("input", renderLibrary));
});
