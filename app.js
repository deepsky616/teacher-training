const state = { all: [], view: "card", calMonth: null };
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const parse = (s) => { if (!s) return null; const d = new Date(String(s).slice(0, 10) + "T00:00:00"); return isNaN(d) ? null : d; };
const fmt = (s) => { const d = parse(s); return d ? `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.` : "-"; };
const dday = (s) => { const d = parse(s); if (!d) return null; return Math.round((d - today()) / 86400000); };
const ddayLabel = (n) => (n === 0 ? "D-day" : `D-${n}`);
const period = (t) => (t.end_date && t.end_date !== t.start_date ? `${fmt(t.start_date)} ~ ${fmt(t.end_date)}` : fmt(t.start_date));
const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "");

// 신청 상태: open(신청 가능) / closed(마감) / soon(신청 준비 중)
function applyState(t) {
  const n = dday(t.apply_deadline);
  if (n !== null && n < 0) return "closed";
  if (!safeUrl(t.apply_url)) return "soon";
  return "open";
}
function stateBadge(t) {
  const s = applyState(t), n = dday(t.apply_deadline);
  if (s === "closed") return `<span class="badge closed">마감</span>`;
  if (s === "soon") return `<span class="badge soon">신청 준비 중</span>`;
  return `<span class="badge open">신청 가능${n !== null ? " · " + ddayLabel(n) : ""}</span>`;
}
function applyButton(t) {
  const s = applyState(t);
  if (s === "closed") return `<span class="apply off">신청 마감</span>`;
  if (s === "soon") return `<span class="apply off">신청 준비 중</span>`;
  return `<a class="apply" href="${esc(safeUrl(t.apply_url))}" target="_blank" rel="noopener">신청하기</a>`;
}

async function load() {
  try {
    const r = await fetch("data/trainings.json?v=" + Date.now());
    const data = await r.json();
    const arr = Array.isArray(data) ? data : data.trainings || [];
    state.all = arr.filter((t) => t && t.published !== false);
  } catch (e) { state.all = []; console.error(e); }
  const ups = state.all.map((t) => t.updated_at).filter(Boolean).sort();
  $("lastUpdated").textContent = ups.length ? fmt(ups[ups.length - 1]) : "아직 없음";
  [...new Set(state.all.map((t) => t.category).filter(Boolean))].sort()
    .forEach((o) => $("fCategory").insertAdjacentHTML("beforeend", `<option>${esc(o)}</option>`));
  render();
}

function filtered() {
  const q = $("search").value.trim().toLowerCase(), fc = $("fCategory").value, showClosed = $("showClosed").checked;
  const rank = { open: 0, soon: 1, closed: 2 };
  return state.all
    .filter((t) => (showClosed || applyState(t) !== "closed") && (!fc || t.category === fc) &&
      (!q || [t.title, t.organizer, t.category, t.target, t.location, t.description].join(" ").toLowerCase().includes(q)))
    .sort((a, b) => rank[applyState(a)] - rank[applyState(b)] ||
      (a.apply_deadline || "9999").localeCompare(b.apply_deadline || "9999") ||
      (a.start_date || "9999").localeCompare(b.start_date || "9999"));
}

function renderDeadlines() {
  const up = state.all.filter((t) => applyState(t) === "open" && dday(t.apply_deadline) !== null && dday(t.apply_deadline) <= 14)
    .sort((a, b) => a.apply_deadline.localeCompare(b.apply_deadline)).slice(0, 5);
  $("deadlinePanel").hidden = up.length === 0;
  $("deadlines").innerHTML = up.map((t) => { const n = dday(t.apply_deadline);
    return `<li data-id="${esc(t.id)}"><span class="dday ${n <= 3 ? "urgent" : ""}">${ddayLabel(n)}</span><span><b>${esc(t.title)}</b><br><span class="meta">마감 ${fmt(t.apply_deadline)} · ${esc(t.organizer || "")}</span></span></li>`; }).join("");
}

function emptyMsg() {
  if (state.all.length === 0) return `<div class="empty"><div class="big">🌱</div><p><b>아직 등록된 연수가 없어요. 곧 올라와요!</b></p></div>`;
  if (state.all.every((t) => applyState(t) === "closed") && !$("showClosed").checked)
    return `<div class="empty"><div class="big">📭</div><p>지금 신청할 수 있는 연수가 없어요. 새 연수가 곧 올라와요.</p></div>`;
  return `<div class="empty"><div class="big">🔍</div><p>조건에 맞는 연수가 없어요.</p></div>`;
}

function renderList() {
  const list = filtered();
  if (state.view === "calendar") return renderCalendar(list);
  if (!list.length) { $("list").innerHTML = emptyMsg(); return; }
  $("list").innerHTML = `<div class="cards">` + list.map((t) => `
    <div class="card ${applyState(t) === "closed" ? "closed" : ""}" data-id="${esc(t.id)}">
      <div>${stateBadge(t)}${t.mode ? `<span class="tag">${esc(t.mode)}</span>` : ""}${t.category ? `<span class="tag">${esc(t.category)}</span>` : ""}</div>
      <h3>${esc(t.title)}</h3>
      ${t.description ? `<p class="desc">${esc(t.description)}</p>` : ""}
      <div class="meta">📅 ${period(t)}${t.time ? " · " + esc(t.time) : ""}</div>
      ${t.location ? `<div class="meta">📍 ${esc(t.location)}</div>` : ""}
      <div class="meta">🏫 ${esc(t.organizer || "-")}${t.hours ? ` · ${esc(t.hours)}시간` : ""}</div>
      ${t.target ? `<div class="meta">👥 ${esc(t.target)}</div>` : ""}
      ${t.apply_deadline ? `<div class="meta">⏰ 신청 마감 ${fmt(t.apply_deadline)}</div>` : ""}
      <div class="spacer"></div>${applyButton(t)}
    </div>`).join("") + `</div>`;
}

function renderCalendar(list) {
  if (!state.calMonth) { const d = today(); state.calMonth = new Date(d.getFullYear(), d.getMonth(), 1); }
  const m = state.calMonth, y = m.getFullYear(), mo = m.getMonth();
  const start = new Date(y, mo, 1 - new Date(y, mo, 1).getDay());
  const t0 = today().getTime();
  let cells = ["일", "월", "화", "수", "목", "금", "토"].map((d) => `<div class="dow">${d}</div>`).join("");
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const evs = list.filter((t) => t.start_date && ds >= t.start_date && ds <= (t.end_date || t.start_date))
      .map((t) => `<span class="ev" data-id="${esc(t.id)}" title="${esc(t.title)}">${esc(t.title)}</span>`).join("");
    const dls = list.filter((t) => t.apply_deadline === ds)
      .map((t) => `<span class="ev dl" data-id="${esc(t.id)}" title="신청 마감: ${esc(t.title)}">마감 ${esc(t.title)}</span>`).join("");
    cells += `<div class="day ${d.getMonth() !== mo ? "other" : ""} ${d.getTime() === t0 ? "today" : ""}">${d.getDate()}${evs}${dls}</div>`;
  }
  $("list").innerHTML = `<div class="calhead"><button id="prevM">◀ 이전 달</button><b>${y}년 ${mo + 1}월</b><button id="nextM">다음 달 ▶</button></div><div class="cal">${cells}</div>` +
    (state.all.length ? "" : emptyMsg());
  $("prevM").onclick = () => { state.calMonth = new Date(y, mo - 1, 1); renderList(); };
  $("nextM").onclick = () => { state.calMonth = new Date(y, mo + 1, 1); renderList(); };
}

function showDetail(id) {
  const t = state.all.find((x) => String(x.id) === String(id));
  if (!t) return;
  const row = (k, v) => (v ? `<dt>${k}</dt><dd>${v}</dd>` : "");
  $("detailBody").innerHTML = `${stateBadge(t)}<h2 style="margin:8px 0 0">${esc(t.title)}</h2>
    ${t.description ? `<p class="desc">${esc(t.description).replace(/\n/g, "<br>")}</p>` : ""}<dl>
    ${row("주관", esc(t.organizer))}${row("분야", esc(t.category))}${row("기간", period(t))}${row("시간", esc(t.time))}
    ${row("방식", esc(t.mode))}${row("장소", esc(t.location))}${row("대상", esc(t.target))}${row("이수시간", t.hours ? esc(t.hours) + "시간" : "")}
    ${row("신청 마감", t.apply_deadline ? fmt(t.apply_deadline) : "")}</dl>`;
  $("detailApply").innerHTML = applyButton(t);
  $("detail").showModal();
}

function render() { renderDeadlines(); renderList(); }

["search", "fCategory", "showClosed"].forEach((id) => $(id).addEventListener("input", renderList));
document.querySelectorAll(".viewtoggle button").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll(".viewtoggle button").forEach((x) => x.classList.remove("active"));
  b.classList.add("active"); state.view = b.dataset.view; renderList();
}));
document.addEventListener("click", (e) => {
  if (e.target.closest("a.apply") || e.target.closest("dialog")) return;
  const el = e.target.closest("[data-id]");
  if (el) showDetail(el.dataset.id);
});
load();
