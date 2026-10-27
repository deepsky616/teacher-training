const STATUSES = ["신청 전", "신청 완료", "수강 중", "이수 완료", "마감"];
const MODES = ["온라인", "오프라인", "혼합"];
const state = { all: [], view: "card", calMonth: null };
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const parse = (s) => { if (!s) return null; const d = new Date(s + "T00:00:00"); return isNaN(d) ? null : d; };
const fmt = (s) => { const d = parse(s); return d ? `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.` : "-"; };
const dday = (s) => { const d = parse(s); if (!d) return null; return Math.round((d - today()) / 86400000); };
const ddayLabel = (n) => (n === 0 ? "D-day" : n > 0 ? `D-${n}` : `D+${-n}`);
const badge = (st) => `<span class="badge b${Math.max(0, STATUSES.indexOf(st))}">${esc(st || "미정")}</span>`;
const period = (t) => (t.end_date && t.end_date !== t.start_date ? `${fmt(t.start_date)} ~ ${fmt(t.end_date)}` : fmt(t.start_date));

async function load() {
  try {
    const r = await fetch("data/trainings.json?v=" + Date.now());
    const data = await r.json();
    state.all = Array.isArray(data) ? data : data.trainings || [];
  } catch (e) {
    state.all = [];
    console.error(e);
  }
  const ups = state.all.map((t) => t.updated_at).filter(Boolean).sort();
  $("lastUpdated").textContent = ups.length ? fmt(ups[ups.length - 1].slice(0, 10)) : "아직 없음";
  fillSelect("fStatus", STATUSES);
  fillSelect("fMode", MODES);
  fillSelect("fCategory", [...new Set(state.all.map((t) => t.category).filter(Boolean))].sort());
  render();
}
function fillSelect(id, opts) {
  const s = $(id);
  opts.forEach((o) => s.insertAdjacentHTML("beforeend", `<option>${esc(o)}</option>`));
}

function filtered() {
  const q = $("search").value.trim().toLowerCase();
  const fs = $("fStatus").value, fm = $("fMode").value, fc = $("fCategory").value;
  let list = state.all.filter((t) =>
    (!fs || t.status === fs) && (!fm || t.mode === fm) && (!fc || t.category === fc) &&
    (!q || [t.title, t.organizer, t.category, t.memo, t.location, t.target].join(" ").toLowerCase().includes(q)));
  const key = $("sort").value;
  const val = (t, f) => (t[f] || "9999-12-31");
  if (key === "start_asc") list.sort((a, b) => val(a, "start_date").localeCompare(val(b, "start_date")));
  if (key === "start_desc") list.sort((a, b) => val(b, "start_date").localeCompare(val(a, "start_date")));
  if (key === "deadline_asc") list.sort((a, b) => val(a, "apply_deadline").localeCompare(val(b, "apply_deadline")));
  return list;
}

function renderSummary() {
  const c = (st) => state.all.filter((t) => t.status === st).length;
  const hours = state.all.filter((t) => t.status === "이수 완료").reduce((s, t) => s + (Number(t.hours) || 0), 0);
  const fs = $("fStatus").value;
  $("summary").innerHTML =
    `<div class="stat ${fs ? "" : "on"}" data-st=""><b>${state.all.length}</b><span>전체 연수</span></div>` +
    STATUSES.map((s) => `<div class="stat ${fs === s ? "on" : ""}" data-st="${s}"><b>${c(s)}</b><span>${s}</span></div>`).join("") +
    `<div class="stat"><b>${hours}</b><span>이수 시간 합계</span></div>`;
  document.querySelectorAll(".stat[data-st]").forEach((el) =>
    el.addEventListener("click", () => { $("fStatus").value = el.dataset.st; render(); }));
}

function renderDeadlines() {
  const up = state.all
    .filter((t) => t.apply_deadline && dday(t.apply_deadline) >= 0 && (t.status === "신청 전" || !t.status))
    .sort((a, b) => a.apply_deadline.localeCompare(b.apply_deadline)).slice(0, 6);
  $("deadlines").innerHTML = up.length
    ? up.map((t) => { const n = dday(t.apply_deadline);
        return `<li data-id="${esc(t.id)}"><span class="dday ${n <= 3 ? "urgent" : ""}">${ddayLabel(n)}</span><span><b>${esc(t.title)}</b><br><span class="meta">마감 ${fmt(t.apply_deadline)} · ${esc(t.organizer || "")}</span></span></li>`; }).join("")
    : `<li class="meta" style="cursor:default">다가오는 신청 마감이 없어요.</li>`;
}

function emptyMsg() {
  return state.all.length === 0
    ? `<div class="empty"><div class="big">🌱</div><p><b>아직 등록된 연수가 없어요. 곧 올라와요!</b></p></div>`
    : `<div class="empty"><div class="big">🔍</div><p>조건에 맞는 연수가 없어요.</p></div>`;
}

function renderList() {
  const list = filtered(), box = $("list");
  if (state.view === "calendar") return renderCalendar(list);
  if (!list.length) { box.innerHTML = emptyMsg(); return; }
  if (state.view === "card") {
    box.innerHTML = `<div class="cards">` + list.map((t) => {
      const n = dday(t.apply_deadline);
      return `<div class="card" data-id="${esc(t.id)}">${badge(t.status)}${t.mode ? `<span class="tag">${esc(t.mode)}</span>` : ""}${t.category ? `<span class="tag">${esc(t.category)}</span>` : ""}
      <h3>${esc(t.title)}</h3>
      <div class="meta">📅 ${period(t)}${t.time ? " · " + esc(t.time) : ""}</div>
      <div class="meta">🏫 ${esc(t.organizer || "-")}${t.hours ? ` · ${esc(t.hours)}시간` : ""}</div>
      ${t.apply_deadline ? `<div class="meta">⏰ 신청 마감 ${fmt(t.apply_deadline)}${n !== null && n >= 0 ? ` (${ddayLabel(n)})` : ""}</div>` : ""}
      </div>`; }).join("") + `</div>`;
  } else {
    box.innerHTML = `<div class="tablewrap"><table><thead><tr><th>상태</th><th>연수명</th><th>주관</th><th>기간</th><th>방식</th><th>시간</th><th>신청 마감</th></tr></thead><tbody>` +
      list.map((t) => `<tr data-id="${esc(t.id)}"><td>${badge(t.status)}</td><td>${esc(t.title)}</td><td>${esc(t.organizer || "")}</td><td>${period(t)}</td><td>${esc(t.mode || "")}</td><td>${esc(t.hours || "")}</td><td>${fmt(t.apply_deadline)}</td></tr>`).join("") +
      `</tbody></table></div>`;
  }
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
  const n = dday(t.apply_deadline);
  const row = (k, v) => (v ? `<dt>${k}</dt><dd>${v}</dd>` : "");
  $("detailBody").innerHTML = `${badge(t.status)}<h2 style="margin:8px 0 0">${esc(t.title)}</h2><dl>
    ${row("주관", esc(t.organizer))}${row("분야", esc(t.category))}${row("기간", period(t))}${row("시간", esc(t.time))}
    ${row("방식", esc(t.mode))}${row("장소", esc(t.location))}${row("대상", esc(t.target))}${row("이수시간", t.hours ? esc(t.hours) + "시간" : "")}
    ${row("신청 마감", t.apply_deadline ? fmt(t.apply_deadline) + (n !== null && n >= 0 ? ` (${ddayLabel(n)})` : "") : "")}
    ${row("신청 링크", t.apply_url ? `<a href="${esc(t.apply_url)}" target="_blank" rel="noopener">신청 페이지 열기</a>` : "")}
    ${row("메모", esc(t.memo).replace(/\n/g, "<br>"))}${row("업데이트", fmt((t.updated_at || "").slice(0, 10)))}</dl>`;
  $("detail").showModal();
}

function render() { renderSummary(); renderDeadlines(); renderList(); }

["search", "fStatus", "fMode", "fCategory", "sort"].forEach((id) => $(id).addEventListener("input", render));
document.querySelectorAll(".viewtoggle button").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll(".viewtoggle button").forEach((x) => x.classList.remove("active"));
  b.classList.add("active"); state.view = b.dataset.view; renderList();
}));
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-id]");
  if (el && !e.target.closest("dialog")) showDetail(el.dataset.id);
});
load();
