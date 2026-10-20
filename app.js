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
      return { key, label, min: Math.round(total * share / 5) * 5 || 5, ex, alt: list.length > 1 };
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
      <span class="ex-meta"><span class="num">${e.min}′</span> · ${esc(STAGES[e.ages[0]].key)}–${esc(STAGES[e.ages[1]].key)}-Jugend${ad.length ? ` · <span class="fit">an dein System angepasst</span>` : ""}</span>
      <span class="ex-goal">${esc(e.ziel)}</span>
    </button></li>`; }).join("") || `<li class="empty">Keine Übung passt zu diesem Filter.</li>`;
}

function renderSystems() {
  const card = (k, s, isDef) => `<article class="sys-card">
    ${isDef ? court(k, null, { bare: true }) : court(null, k, { bare: true })}
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
    const ex = ev.target.closest("[data-ex]"); if (ex) return openEx(ex.dataset.ex);
    const sw = ev.target.closest("[data-swap]");
    if (sw) { state.swaps[sw.dataset.swap] = (state.swaps[sw.dataset.swap] || 0) + 1; save(); renderPlan(); return; }
    const tab = ev.target.closest(".tab"); if (tab) { showTab(tab.dataset.tab); return; }
    if (ev.target.id === "ex-close" || ev.target.id === "ex-dialog") $("#ex-dialog").close();
  });
  ["lib-q", "lib-cat", "lib-age"].forEach(id => $("#" + id).addEventListener("input", renderLibrary));
});
