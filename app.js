const KEY = "habitat-v1";
const STATUS = ["Researching", "Decided", "Ordered", "Bought"];
const PRIO = ["Low", "Medium", "High"];
const ROOMS = ["Nappali", "Konyha", "Hálószoba", "Fürdőszoba", "Előszoba", "Dolgozószoba", "Erkély", "Gyerekszoba"];
const HU = { Researching: "Kutatás", Decided: "Eldöntve", Ordered: "Megrendelve", Bought: "Megvéve", Low: "Alacsony", Medium: "Közepes", High: "Magas", All: "Összes", Priority: "Fontosság", Price: "Ár", Name: "Név" };
const hu = k => HU[k] || k;
const FIXED = ["115", "111"];
const API = "api.php", EDITKEY = KEY + "-editkey";
let db = normalize({}), loaded = false;

function normalize(d) {
  d = d && typeof d === "object" ? d : {};
  d.apartments = (d.apartments || []).filter(a => FIXED.includes(a.name));
  for (const name of FIXED) if (!d.apartments.some(a => a.name === name)) d.apartments.push({ id: "apt" + name, name, budget: "", rooms: [] });
  d.apartments.sort((a, b) => FIXED.indexOf(a.name) - FIXED.indexOf(b.name));
  for (const a of d.apartments) {
    a.rooms = a.rooms || [];
    a.budget = a.budget || "";
    for (const r of a.rooms) { r.items = r.items || []; for (const i of r.items) { i.qty = i.qty || 1; i.status = i.status || "Researching"; i.priority = i.priority || "Medium"; i.options = i.options || []; } }
  }
  return d;
}

// ---------- MySQL storage via api.php ----------
let pushTimer, pushing = false, again = false;
function status(msg) { const s = $("#sync"); if (s) s.textContent = msg; }
function save() {
  if (!loaded) return;
  clearTimeout(pushTimer);
  if (!localStorage.getItem(EDITKEY)) { status("⚠ Nincs mentve – add meg a jelszót (Belépés)"); return; }
  status("Mentés…");
  pushTimer = setTimeout(push, 800);
}
async function push() {
  if (pushing) { again = true; return; }
  pushing = true;
  try {
    const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json", "X-Edit-Key": localStorage.getItem(EDITKEY) || "" }, body: JSON.stringify(db) });
    if (r.status === 403) { localStorage.removeItem(EDITKEY); status("⚠ Rossz jelszó"); }
    else if (!r.ok) throw new Error(r.status);
    else status("✓ Mentve az adatbázisba");
  } catch (e) {
    status("⚠ Mentési hiba (" + e.message + ")");
  }
  pushing = false;
  if (again) { again = false; push(); }
}
async function init() {
  status("Betöltés…");
  try {
    const r = await fetch(`${API}?t=${Date.now()}`, { cache: "no-store", headers: { "X-Edit-Key": localStorage.getItem(EDITKEY) || "" } });
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    db = normalize(d); loaded = true;
    status(d.canEdit ? "✓ Betöltve (szerkesztés engedélyezve)" : "Csak olvasható – Belépés a szerkesztéshez");
  } catch (e) {
    status("⚠ Az adatbázis nem érhető el (" + e.message + ")");
  }
  render();
}
function uid() { return Math.random().toString(36).slice(2, 10); }
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = u => (/^https?:\/\//i.test(u) ? u : "");
const safeImg = u => (/^(https?:\/\/|data:image\/)/i.test(u) ? u : "");
const $ = s => document.querySelector(s);
const app = $("#app");
const money = n => (Number(n) ? Number(n).toLocaleString("hu-HU", { maximumFractionDigits: 2 }) + " Ft" : "");

// ---------- stats ----------
const favOf = i => i.options.find(o => o.fav);
const itemCost = i => (favOf(i) ? Number(favOf(i).price || 0) * (i.qty || 1) : 0);
const roomItems = a => a.rooms.flatMap(r => r.items.map(i => ({ r, i })));
function stats(items) {
  const planned = items.reduce((s, i) => s + itemCost(i), 0);
  const bought = items.filter(i => i.status === "Bought").reduce((s, i) => s + itemCost(i), 0);
  const done = items.filter(i => i.status === "Bought").length;
  return { planned, bought, done, n: items.length, picked: items.filter(favOf).length };
}
function budgetBar(planned, bought, budget) {
  budget = Number(budget);
  const max = Math.max(budget || 0, planned) || 1, over = budget && planned > budget;
  return `<div class="bar ${over ? "over" : ""}"><i class="b" style="width:${bought / max * 100}%"></i><i class="p" style="width:${planned / max * 100}%"></i></div>
  <small class="dim">${money(bought) || "0 Ft"} megvéve · ${money(planned) || "0 Ft"} tervezve${budget ? ` · keret ${money(budget)} · ${over ? `<b>${money(planned - budget)} TÚLLÉPÉS</b>` : `${money(budget - planned)} maradt`}` : ""}</small>`;
}

// ---------- dialog ----------
function ask(title, fields, initial = {}) {
  return new Promise(res => {
    const f = $("#form"), d = $("#dlg");
    f.innerHTML = `<h2>${esc(title)}</h2>` + fields.map(x => {
      const v = initial[x.n] ?? x.d ?? "";
      const lab = `<label>${esc(x.p)}</label>`;
      if (x.type === "textarea") return `${lab}<textarea name="${x.n}" rows="3">${esc(v)}</textarea>`;
      if (x.type === "file") return `${lab}<input type="file" name="${x.n}" accept="image/*">`;
      if (x.type === "select") return `${lab}<select name="${x.n}">${x.o.map(o => `<option value="${esc(o)}" ${o === v ? "selected" : ""}>${esc(hu(o))}</option>`).join("")}</select>`;
      return `${lab}<input name="${x.n}" ${x.list ? `list="dl-${x.n}"` : ""} type="${x.type || "text"}" ${x.type === "number" ? 'step="any" min="0"' : ""} value="${esc(v)}" ${x.req ? "required" : ""}>`
        + (x.list ? `<datalist id="dl-${x.n}">${x.list.map(o => `<option value="${esc(o)}">`).join("")}</datalist>` : "");
    }).join("") + `<div class="row"><button value="cancel" class="ghost" formnovalidate>Mégse</button><button value="ok">Mentés</button></div>`;
    d.onclose = async () => {
      if (d.returnValue !== "ok") return res(null);
      const out = {};
      for (const x of fields) {
        const el = f.elements[x.n];
        out[x.n] = x.type === "file" ? (el.files[0] ? await shrink(el.files[0]) : "") : el.value.trim();
      }
      res(out);
    };
    d.returnValue = "";
    d.showModal();
  });
}
function shrink(file) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 640 / img.width), c = document.createElement("canvas");
      c.width = img.width * k; c.height = img.height * k;
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL("image/jpeg", .7));
    };
    img.src = URL.createObjectURL(file);
  });
}
const wireDel = (fn, msg) => app.querySelectorAll("[data-del]").forEach(b => b.onclick = e => {
  e.preventDefault(); e.stopPropagation();
  if (confirm(msg)) { fn(b.dataset.del); save(); render(); }
});

// ---------- router ----------
function render() {
  window.scrollTo(0, 0);
  const [, a, r, i] = location.hash.split("/");
  $("#switch").innerHTML = db.apartments.map(x => `<a href="#/${x.id}" class="${x.id === a ? "on" : ""}">${esc(x.name)}</a>`).join("");
  const apt = db.apartments.find(x => x.id === a);
  if (!apt) return homeView();
  if (r === "~list") return listView(apt);
  const room = apt.rooms.find(x => x.id === r);
  if (!room) return aptView(apt);
  const item = room.items.find(x => x.id === i);
  if (!item) return roomView(apt, room);
  optionsView(apt, room, item);
}

// ---------- home ----------
function homeView() {
  const all = db.apartments.flatMap(a => roomItems(a).map(x => x.i));
  const s = stats(all);
  app.innerHTML = `<div class="hero"><small class="dim">ÚJ OTTHONOK</small><div class="total">${money(s.planned) || "0 Ft"}</div>
    <small class="dim">összesen tervezve · ${s.n} tétel · ${s.done} megvéve</small></div>
  <div class="split">${db.apartments.map((a, n) => {
    const st = stats(roomItems(a).map(x => x.i));
    return `<a class="big" style="--i:${n}" href="#/${a.id}"><span class="num">${esc(a.name)}</span>
      <div class="meta"><small class="dim">${a.rooms.length} szoba · ${st.n} tétel · ${st.done} megvéve</small>
      <div class="price">${money(st.planned)}</div>${budgetBar(st.planned, st.bought, a.budget)}<span class="go">MEGNYITÁS →</span></div></a>`;
  }).join("")}</div>`;
}

// ---------- apartment ----------
function aptView(apt) {
  const s = stats(roomItems(apt).map(x => x.i));
  app.innerHTML = `<a class="crumb" href="#/">← összes lakás</a><h1>${esc(apt.name)}</h1>
  <div class="panel">${budgetBar(s.planned, s.bought, apt.budget)}
    <div class="stats"><div><b>${s.n}</b>tétel</div><div><b>${s.picked}</b>kiválasztva</div><div><b>${s.done}</b>megvéve</div><div><b>${s.n ? Math.round(s.done / s.n * 100) : 0}%</b>done</div></div></div>
  <div class="toolbar"><a class="btn" href="#/${apt.id}/~list">Bevásárlólista</a><button class="ghost" id="edit">Lakás szerkesztése</button>
    <input id="q" placeholder="Keresés az összes tételben…"></div>
  <div id="res"></div>
  <div class="grid" id="rooms">${apt.rooms.map((r, n) => {
    const st = stats(r.items);
    return `<a class="card" style="--i:${n}" href="#/${apt.id}/${r.id}"><button class="del danger" data-del="${r.id}">✕</button>
      <h3>${esc(r.name)}</h3><small class="dim">${st.n} tétel · ${st.done} megvéve</small><div class="price">${money(st.planned)}</div>
      ${budgetBar(st.planned, st.bought, r.budget)}</a>`;
  }).join("")}<div class="card add" style="--i:${apt.rooms.length}" id="add">+ szoba</div></div>`;
  $("#add").onclick = async () => {
    const r = await ask("Új szoba", [{ n: "name", p: "Szoba", req: 1, list: ROOMS }, { n: "budget", p: "Szoba keret Ft (opcionális)", type: "number" }]);
    if (r) { apt.rooms.push({ id: uid(), name: r.name, budget: r.budget, items: [] }); save(); render(); }
  };
  $("#edit").onclick = async () => {
    const r = await ask("Lakás szerkesztése", [{ n: "budget", p: "Teljes keret Ft", type: "number" }], apt);
    if (r) { Object.assign(apt, r); save(); render(); }
  };
  $("#q").oninput = e => {
    const q = e.target.value.toLowerCase().trim();
    $("#rooms").style.display = q ? "none" : "";
    $("#res").innerHTML = q ? `<div class="grid">${roomItems(apt).filter(({ i }) => (i.name + i.options.map(o => o.name + o.notes).join()).toLowerCase().includes(q))
      .map(({ r, i }, n) => `<a class="card" style="--i:${n}" href="#/${apt.id}/${r.id}/${i.id}"><h3>${esc(i.name)}</h3><small class="dim">${esc(r.name)} · ${esc(hu(i.status))}</small></a>`).join("") || '<p class="empty">Nincs találat.</p>'}</div>` : "";
  };
  wireDel(id => apt.rooms = apt.rooms.filter(x => x.id !== id), "Törlöd a szobát és a tételeit?");
}

// ---------- shopping list ----------
function listView(apt) {
  const s = stats(roomItems(apt).map(x => x.i));
  app.innerHTML = `<a class="crumb" href="#/${apt.id}">← ${esc(apt.name)}</a><h1>Bevásárló-<br>lista</h1>
  <div class="toolbar"><button class="ghost" onclick="print()">Nyomtatás</button><button class="ghost" id="copy">Szöveg másolása</button></div>
  <div class="panel">${budgetBar(s.planned, s.bought, apt.budget)}</div>
  ${apt.rooms.filter(r => r.items.length).map(r => `<h2 class="rh">${esc(r.name)}</h2>` + [...r.items].sort((a, b) => PRIO.indexOf(b.priority) - PRIO.indexOf(a.priority)).map(i => {
    const f = favOf(i);
    return `<label class="li ${i.status === "Bought" ? "done" : ""}"><input type="checkbox" data-i="${r.id}/${i.id}" ${i.status === "Bought" ? "checked" : ""}>
      <span class="t"><a href="#/${apt.id}/${r.id}/${i.id}">${i.qty > 1 ? i.qty + "× " : ""}${esc(i.name)}</a>
      <small class="dim"> ${f ? "★ " + esc(f.name) : "még nincs kiválasztva"} · ${esc(hu(i.priority))}</small></span><b>${money(itemCost(i))}</b></label>`;
  }).join("")).join("") || '<p class="empty">Még nincs tétel.</p>'}`;
  app.querySelectorAll("[data-i]").forEach(c => c.onchange = () => {
    const [r, i] = c.dataset.i.split("/"), it = apt.rooms.find(x => x.id === r).items.find(x => x.id === i);
    it.status = c.checked ? "Bought" : "Decided"; save();
    if (c.checked) { const b = c.getBoundingClientRect(); confetti(b.x, b.y); }
    setTimeout(render, c.checked ? 450 : 0);
  });
  $("#copy").onclick = () => {
    const t = apt.rooms.map(r => r.name + "\n" + r.items.map(i => `- [${i.status === "Bought" ? "x" : " "}] ${i.qty}× ${i.name}${favOf(i) ? " — " + favOf(i).name + " " + money(itemCost(i)) : ""}`).join("\n")).join("\n\n");
    navigator.clipboard.writeText(t); $("#copy").textContent = "Másolva ✓";
  };
}

// ---------- room ----------
function roomView(apt, room) {
  let filter = "All", sort = "Priority";
  const draw = () => {
    const s = stats(room.items);
    let items = room.items.filter(i => filter === "All" || i.status === filter);
    items.sort((a, b) => sort === "Priority" ? PRIO.indexOf(b.priority) - PRIO.indexOf(a.priority)
      : sort === "Price" ? itemCost(b) - itemCost(a) : a.name.localeCompare(b.name));
    app.innerHTML = `<a class="crumb" href="#/${apt.id}">← ${esc(apt.name)}</a><h1>${esc(room.name)}</h1>
    <div class="panel">${budgetBar(s.planned, s.bought, room.budget)}</div>
    <div class="toolbar"><button class="ghost" id="edit">Szoba szerkesztése</button>
      <select id="f">${["All", ...STATUS].map(x => `<option value="${x}" ${x === filter ? "selected" : ""}>${hu(x)}</option>`)}</select>
      <select id="s">${["Priority", "Price", "Name"].map(x => `<option value="${x}" ${x === sort ? "selected" : ""}>${hu(x)}</option>`)}</select></div>
    <div class="grid">${items.map((it, n) => {
      const f = favOf(it);
      return `<a class="card ${f ? "fav" : ""}" style="--i:${n}" href="#/${apt.id}/${room.id}/${it.id}"><button class="del danger" data-del="${it.id}">✕</button>
        ${f && safeImg(f.img) ? `<img src="${esc(f.img)}" alt="">` : ""}
        <h3>${it.qty > 1 ? it.qty + "× " : ""}${esc(it.name)}</h3>
        <span class="pill s${STATUS.indexOf(it.status)}">${esc(hu(it.status))}</span><span class="pill">${esc(hu(it.priority))}</span>
        <div><small class="dim">${it.options.length} opció</small></div>
        ${f ? `<div class="price">${money(itemCost(it))}</div><span class="badge">★ ${esc(f.name)}</span>` : ""}</a>`;
    }).join("")}<div class="card add" style="--i:${items.length}" id="add">+ tétel</div></div>`;
    $("#f").onchange = e => { filter = e.target.value; draw(); };
    $("#s").onchange = e => { sort = e.target.value; draw(); };
    $("#add").onclick = async () => {
      const r = await ask("Új tétel", itemFields);
      if (r) { room.items.push({ id: uid(), ...r, qty: Number(r.qty) || 1, options: [] }); save(); render(); }
    };
    $("#edit").onclick = async () => {
      const r = await ask("Szoba szerkesztése", [{ n: "name", p: "Név", req: 1 }, { n: "budget", p: "Szoba keret Ft", type: "number" }], room);
      if (r) { Object.assign(room, r); save(); render(); }
    };
    wireDel(id => room.items = room.items.filter(x => x.id !== id), "Törlöd ezt a tételt?");
  };
  draw();
}
const itemFields = [
  { n: "name", p: "Tétel (pl. Hűtő)", req: 1 },
  { n: "qty", p: "Mennyiség", type: "number", d: 1 },
  { n: "priority", p: "Fontosság", type: "select", o: PRIO, d: "Medium" },
  { n: "status", p: "Állapot", type: "select", o: STATUS, d: "Researching" },
];

// ---------- item options ----------
const optFields = [
  { n: "name", p: "Modell / név", req: 1 },
  { n: "price", p: "Ár Ft", type: "number" },
  { n: "store", p: "Bolt" },
  { n: "dims", p: "Méret (pl. 60×65×185 cm)" },
  { n: "url", p: "Link (https://…)" },
  { n: "imgUrl", p: "Kép URL (opcionális)" },
  { n: "img", p: "…vagy tölts fel képet", type: "file" },
  { n: "notes", p: "Megjegyzés (előnyök / hátrányok)", type: "textarea" },
];

function optionsView(apt, room, item) {
  const opts = [...item.options].sort((a, b) => b.fav - a.fav || (a.price || 1e12) - (b.price || 1e12));
  const prices = item.options.map(o => Number(o.price)).filter(Boolean), min = Math.min(...prices);
  app.innerHTML = `<a class="crumb" href="#/${apt.id}/${room.id}">← ${esc(room.name)}</a><h1>${item.qty > 1 ? item.qty + "× " : ""}${esc(item.name)}</h1>
  <div class="toolbar"><span class="pill s${STATUS.indexOf(item.status)}">${esc(hu(item.status))}</span><span class="pill">${esc(hu(item.priority))} fontosság</span>
    <button class="ghost" id="edit">Tétel szerkesztése</button><button class="ghost" id="next">Következő állapot →</button></div>
  <p class="sub">${prices.length > 1 ? `Sáv: ${money(min)} – ${money(Math.max(...prices))}. ` : ""}Jelöld ★-gal azt, amelyiket szeretnéd.</p>
  <div class="grid">${opts.map((o, n) => {
    const p = Number(o.price), diff = p && favOf(item) && !o.fav && favOf(item).price ? p - Number(favOf(item).price) : 0;
    return `<div class="card ${o.fav ? "fav" : ""}" style="--i:${n}">
    <button class="star ${o.fav ? "on" : ""}" data-fav="${o.id}">★</button>
    <button class="del danger" data-del="${o.id}">✕</button>
    ${safeImg(o.img) ? `<img src="${esc(o.img)}" alt="">` : ""}
    <h3>${esc(o.name)}</h3><div class="price">${money(o.price)}</div>
    ${p && p === min && prices.length > 1 ? '<span class="badge">LEGOLCSÓBB</span> ' : ""}${diff ? `<small class="dim">${diff > 0 ? "+" : "−"}${money(Math.abs(diff))} a kedvenchez képest</small>` : ""}
    ${o.store ? `<p>🏬 ${esc(o.store)}</p>` : ""}${o.dims ? `<p>📐 ${esc(o.dims)}</p>` : ""}
    ${o.notes ? `<p>${esc(o.notes)}</p>` : ""}
    ${safeUrl(o.url) ? `<a class="link" href="${esc(o.url)}" target="_blank" rel="noopener noreferrer">link megnyitása ↗</a>` : ""}
    <br><button class="ghost" data-edit="${o.id}" style="margin-top:12px">Szerkesztés</button></div>`;
  }).join("")}<div class="card add" style="--i:${opts.length}" id="add">+ opció</div></div>`;
  const find = id => item.options.find(o => o.id === id);
  $("#add").onclick = async () => {
    const r = await ask("Új opció", optFields);
    if (r) { const { imgUrl, ...rest } = r; item.options.push({ id: uid(), ...rest, img: r.img || imgUrl, fav: false }); save(); render(); }
  };
  $("#edit").onclick = async () => {
    const r = await ask("Tétel szerkesztése", itemFields, item);
    if (r) { Object.assign(item, r, { qty: Number(r.qty) || 1 }); save(); render(); }
  };
  $("#next").onclick = () => { item.status = STATUS[(STATUS.indexOf(item.status) + 1) % STATUS.length]; save(); if (item.status === "Bought") confetti(innerWidth / 2, innerHeight / 3); setTimeout(render, 300); };
  app.querySelectorAll("[data-fav]").forEach(b => b.onclick = e => {
    const o = find(b.dataset.fav), on = !o.fav;
    item.options.forEach(x => x.fav = false); o.fav = on;
    if (on && item.status === "Researching") item.status = "Decided";
    save();
    if (on) confetti(e.clientX, e.clientY);
    setTimeout(render, on ? 350 : 0);
  });
  wireDel(id => item.options = item.options.filter(x => x.id !== id), "Törlöd az opciót?");
  app.querySelectorAll("[data-edit]").forEach(b => b.onclick = async () => {
    const o = find(b.dataset.edit), own = o.img?.startsWith("data:");
    const r = await ask("Opció szerkesztése", optFields, { ...o, imgUrl: own ? "" : o.img });
    if (!r) return;
    const { imgUrl, ...rest } = r;
    Object.assign(o, rest, { img: r.img || imgUrl || (own ? o.img : "") });
    save(); render();
  });
}

// ---------- export / import ----------
$("#export").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(db)], { type: "application/json" }));
  a.download = "habitat.json"; a.click();
};
$("#import").onchange = async e => {
  try {
    const d = JSON.parse(await e.target.files[0].text());
    if (!Array.isArray(d.apartments)) throw 0;
    if (confirm("Lecseréled a jelenlegi adatokat az importált fájllal?")) { db = normalize(d); save(); render(); }
  } catch { alert("Ez nem érvényes Habitat fájl."); }
  e.target.value = "";
};

// ---------- effects ----------
function confetti(x, y) {
  for (let i = 0; i < 40; i++) {
    const p = document.createElement("div"); p.className = "confetti";
    p.style.left = x + "px"; p.style.top = y + "px";
    p.style.opacity = Math.random() < .5 ? 1 : .4;
    document.body.append(p);
    const a = Math.random() * 6.28, d = 80 + Math.random() * 180;
    p.animate([{ transform: "none", opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d + 120}px) rotate(${Math.random() * 720}deg)`, opacity: 0 }],
      { duration: 900 + Math.random() * 500, easing: "cubic-bezier(.2,.8,.4,1)" }).onfinish = () => p.remove();
  }
}
const mouse = { x: -999, y: -999 }, spot = $(".spot");
addEventListener("mousemove", e => { spot.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; mouse.x = e.clientX; mouse.y = e.clientY; });
app.addEventListener("mousemove", e => {
  const c = e.target.closest(".card:not(.add)"); if (!c) return;
  const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
  c.style.transform = `rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`;
});
app.addEventListener("mouseout", e => { const c = e.target.closest(".card"); if (c) c.style.transform = ""; });

const cv = $("#bg"), cx = cv.getContext("2d");
let W, H, pts = [];
function size() { W = cv.width = innerWidth; H = cv.height = innerHeight; pts = Array.from({ length: Math.min(90, W / 15) }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .5, vy: (Math.random() - .5) * .5 })); }
addEventListener("resize", size); size();
(function loop() {
  cx.clearRect(0, 0, W, H);
  for (const p of pts) {
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > W) p.vx *= -1;
    if (p.y < 0 || p.y > H) p.vy *= -1;
    const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
    if (d < 140) { p.x += dx / d * 2; p.y += dy / d * 2; }
    cx.fillStyle = "#555"; cx.fillRect(p.x, p.y, 2, 2);
  }
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
    if (d < 130) { cx.strokeStyle = `rgba(255,255,255,${.18 * (1 - d / 130)})`; cx.beginPath(); cx.moveTo(pts[i].x, pts[i].y); cx.lineTo(pts[j].x, pts[j].y); cx.stroke(); }
  }
  requestAnimationFrame(loop);
})();

addEventListener("hashchange", render);
$("#token").onclick = () => {
  const t = prompt("Szerkesztési jelszó (ugyanaz, mint a config.php-ben az edit_key). Csak ebben a böngészőben tárolódik. Üresen hagyva kilépsz:", localStorage.getItem(EDITKEY) || "");
  if (t === null) return;
  if (t.trim()) { localStorage.setItem(EDITKEY, t.trim()); init(); }
  else { localStorage.removeItem(EDITKEY); init(); }
};
init();
