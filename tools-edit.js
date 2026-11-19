/* JagoPDF · Edit PDF & Tanda tangan.
   Objek disimpan dalam pecahan ukuran halaman (0–1), jadi tampilan tetap pas di layar mana pun.
   Saat disimpan, setiap objek digambar ke PDF dengan pdf-lib (memperhitungkan putaran halaman). */
(function(){
"use strict";
const J = window.JP;
const { $, $$, esc, baseName, isPdf, handlers, toast, showProgress, progress, openPdf, loadDone, tick, showResult, showError, sizeOk, renderPage, showWork, pdfBlob, norm } = J;
const { PDFDocument, StandardFonts, rgb, degrees, BlendMode, LineCapStyle } = PDFLib;

const FONTS = {
  sans:  { css:"Helvetica, Arial, sans-serif", base:0.93, std:[StandardFonts.Helvetica, StandardFonts.HelveticaBold], label:"Sans" },
  serif: { css:"'Times New Roman', Times, serif", base:0.92, std:[StandardFonts.TimesRoman, StandardFonts.TimesRomanBold], label:"Serif" },
  mono:  { css:"'Courier New', Courier, monospace", base:0.86, std:[StandardFonts.Courier, StandardFonts.CourierBold], label:"Mono" },
};
const COLORS = ["#111111","#e1000d","#1d4ed8","#15803d","#6b7280","#ffffff"];
const E = { file:null, pdf:null, pages:[], objs:[], sel:null, tool:"select", hist:[], mode:"edit",
  text:{font:"sans", size:14, color:"#111111", bold:false}, pen:{color:"#e1000d", w:2}, uid:0, io:null, lastPage:1 };
const root = $("#w-edit");
const HINTS = {
  select:"Klik objek untuk memilih, lalu geser. Tarik titik di pojok untuk mengubah ukuran. Klik dua kali teks untuk mengubahnya.",
  text:"Klik di halaman untuk menambah teks.",
  sign:"Buat tanda tangan, lalu geser ke tempat yang tepat.",
  image:"Pilih gambar, lalu geser dan atur ukurannya.",
  white:"Seret di halaman untuk menutup bagian dengan kotak putih.",
  hl:"Seret di halaman untuk memberi stabilo.",
  pen:"Gambar bebas di halaman.",
};

/* ---------- judul per alat ---------- */
J.ROUTE_HOOKS.push(tool => {
  if(!tool || tool.h !== "edit") return;
  E.mode = tool.id === "tanda-tangan" ? "sign" : "edit";
  $("#edit-title").textContent = tool.title; $("#edit-ic").innerHTML = tool.icon;
  $("#edit-desc").textContent = E.mode === "sign"
    ? "Tanda tangani PDF tanpa mencetak. Gambar, ketik, atau unggah foto tanda tanganmu."
    : "Tambah teks, gambar, tanda tangan, stabilo, coretan, atau tutup bagian yang tidak perlu.";
});

/* ---------- buka file ---------- */
handlers.edit = async (fs) => {
  const f = fs.find(isPdf); if(!f){ toast("Pilih file PDF"); return; }
  if(!(await sizeOk(f.size))) return;
  try{
    showProgress("Membuka PDF");
    const pdf = await openPdf(f);
    if(E.pdf) E.pdf.destroy(); if(E.io) E.io.disconnect();
    Object.assign(E, {file:f, pdf, objs:[], sel:null, hist:[], pages:[]});
    showWork("edit", true);
    await buildPages();
    setTool(E.mode === "sign" ? "select" : "select");
    syncUndo(); await loadDone();
    if(E.mode === "sign") openSig();
  }catch(e){ showError(e.message); }
};
async function buildPages(){
  const box = $("#ed-pages"); box.innerHTML = "";
  E.io = new IntersectionObserver(ens => ens.forEach(en => { if(en.isIntersecting){ E.io.unobserve(en.target); paintPage(+en.target.dataset.n); } }), {rootMargin:"600px"});
  for(let n = 1; n <= E.pdf.numPages; n++){
    const pg = await E.pdf.getPage(n); const vp = pg.getViewport({scale:1});
    const el = document.createElement("div"); el.className = "epage"; el.dataset.n = n;
    el.style.setProperty("--pw", Math.round(vp.width * 1.36) + "px");
    el.style.aspectRatio = `${vp.width} / ${vp.height}`;
    el.innerHTML = `<span class="pn">${n} / ${E.pdf.numPages}</span><canvas class="pc"></canvas><div class="elayer"></div>`;
    box.appendChild(el);
    E.pages[n] = { n, W:vp.width, H:vp.height, el, layer:$(".elayer", el) };
    E.io.observe(el);
  }
  scaleAll();
}
async function paintPage(n){
  const p = E.pages[n]; if(!p) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const { canvas } = await renderPage(E.pdf, n, {width: Math.max(400, p.el.clientWidth) * dpr * 1.1});
  const old = $("canvas.pc", p.el); canvas.className = "pc"; old.replaceWith(canvas);
  p.el.style.aspectRatio = "";
}
function scaleAll(){ E.pages.forEach(p => { if(p) p.el.style.setProperty("--s", p.el.clientWidth / p.W); }); }
window.addEventListener("resize", () => { if(E.file) scaleAll(); });

/* ---------- alat & properti ---------- */
function setTool(t){
  if(t === "sign"){ openSig(); return; }
  if(t === "image"){ $("#ed-imgfile").click(); return; }
  E.tool = t; root.dataset.tool = t;
  $$(".ed-tools button").forEach(b => b.classList.toggle("on", b.dataset.tool === t));
  if(t !== "select") select(null);
  $("#ed-hint").textContent = HINTS[t] || "";
  renderProps();
}
$(".ed-tools").addEventListener("click", e => { const b = e.target.closest("button[data-tool]"); if(b) setTool(b.dataset.tool); });
function swHTML(cur, attr){ return `<div class="swatches" ${attr}>${COLORS.map(c => `<button data-c="${c}" style="--sw:${c}" class="${c === cur ? "on" : ""}" aria-label="Warna ${c}"></button>`).join("")}</div>`; }
function renderProps(){
  const box = $("#ed-props"); const o = E.sel ? E.objs.find(x => x.id === E.sel) : null;
  const kind = o ? o.type : ({text:"t", pen:"p"})[E.tool];
  let h = "";
  if(kind === "t"){
    const s = o || E.text;
    h += `<select id="ep-font" aria-label="Jenis huruf">${Object.entries(FONTS).map(([k, f]) => `<option value="${k}"${s.font === k ? " selected" : ""}>${f.label}</option>`).join("")}</select>`;
    h += `<input class="num" id="ep-size" type="number" min="6" max="120" value="${s.size}" aria-label="Ukuran huruf">`;
    h += `<button class="tb${s.bold ? " on" : ""}" id="ep-bold" aria-label="Tebal">B</button>`;
    h += swHTML(s.color, 'id="ep-color"');
  } else if(kind === "p"){
    const s = o || E.pen;
    h += swHTML(s.color, 'id="ep-color"');
    h += `<select id="ep-w" aria-label="Ketebalan">${[1,2,3,5,8].map(w => `<option value="${w}"${s.w === w ? " selected" : ""}>${w} pt</option>`).join("")}</select>`;
  }
  if(o) h += `<button class="tb del" id="ep-del" aria-label="Hapus objek"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>`;
  box.innerHTML = h;
}
$("#ed-props").addEventListener("change", e => {
  const o = E.sel ? E.objs.find(x => x.id === E.sel) : null;
  const tgt = o && (o.type === "t" || o.type === "p") ? o : null;
  if(o) snapshot();
  if(e.target.id === "ep-font"){ (tgt || E.text).font = e.target.value; if(!tgt) E.text.font = e.target.value; }
  if(e.target.id === "ep-size"){ const v = Math.max(6, Math.min(120, +e.target.value || 14)); (tgt || E.text).size = v; E.text.size = v; }
  if(e.target.id === "ep-w"){ (tgt || E.pen).w = +e.target.value; E.pen.w = +e.target.value; }
  if(tgt) drawObj(tgt);
});
$("#ed-props").addEventListener("click", e => {
  const o = E.sel ? E.objs.find(x => x.id === E.sel) : null;
  const sw = e.target.closest("button[data-c]");
  if(sw){
    $$("button", sw.parentElement).forEach(b => b.classList.toggle("on", b === sw));
    const kind = o ? o.type : ({text:"t", pen:"p"})[E.tool];
    if(o) snapshot();
    if(kind === "t"){ if(o) o.color = sw.dataset.c; E.text.color = sw.dataset.c; }
    if(kind === "p"){ if(o) o.color = sw.dataset.c; E.pen.color = sw.dataset.c; }
    if(o) drawObj(o); return;
  }
  if(e.target.closest("#ep-bold")){ if(o) snapshot(); const t = o || E.text; t.bold = !t.bold; E.text.bold = t.bold; if(o) drawObj(o); renderProps(); return; }
  if(e.target.closest("#ep-del") && o) removeObj(o.id);
});

/* ---------- riwayat ---------- */
function snapshot(){ E.hist.push(JSON.stringify(E.objs)); if(E.hist.length > 60) E.hist.shift(); syncUndo(); }
function syncUndo(){ $("#ed-undo").disabled = !E.hist.length; }
function undo(){
  if(!E.hist.length) return;
  E.objs = JSON.parse(E.hist.pop()); E.sel = null;
  E.pages.forEach(p => { if(p) p.layer.innerHTML = ""; });
  E.objs.forEach(drawObj); renderProps(); syncUndo();
}
$("#ed-undo").onclick = undo;

/* ---------- objek ---------- */
const pct = v => (v * 100).toFixed(4) + "%";
function drawObj(o){
  const p = E.pages[o.page]; if(!p) return;
  let el = p.layer.querySelector(`[data-id="${o.id}"]`);
  if(!el){
    el = document.createElement("div"); el.dataset.id = o.id; el.className = "eo " + o.type;
    if(o.type === "i") el.innerHTML = `<img alt="" draggable="false">`;
    if(o.type !== "p") el.insertAdjacentHTML("beforeend", `<span class="hd" data-h></span>`);
    el.insertAdjacentHTML("beforeend", `<button class="xb" data-x aria-label="Hapus"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>`);
    p.layer.appendChild(el);
  }
  el.classList.toggle("sel", E.sel === o.id);
  el.style.left = pct(o.x); el.style.top = pct(o.y);
  if(o.type === "t"){
    let span = el.querySelector(".tx"); if(!span){ span = document.createElement("span"); span.className = "tx"; el.prepend(span); }
    if(!span.isContentEditable) span.textContent = o.text;
    const F = FONTS[o.font] || FONTS.sans;
    el.style.fontFamily = F.css; el.style.fontWeight = o.bold ? "700" : "400"; el.style.color = o.color;
    el.style.fontSize = `calc(var(--s) * ${o.size}px)`; el.style.width = ""; el.style.height = "";
  } else if(o.type === "p"){
    el.style.width = pct(o.w); el.style.height = pct(o.h);
    const P = E.pages[o.page];
    const d = o.pts.map((q, i) => `${i ? "L" : "M"}${((q[0]-o.x)/o.w*100).toFixed(3)} ${((q[1]-o.y)/o.h*100).toFixed(3)}`).join(" ");
    el.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%"><path d="${d}" fill="none" stroke="transparent" vector-effect="non-scaling-stroke" stroke-linecap="round" style="stroke-width:14px"/><path d="${d}" fill="none" stroke="${o.color}" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" style="stroke-width:calc(var(--s) * ${o.lw}px)"/></svg><button class="xb" data-x aria-label="Hapus"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>`;
    el.style.minWidth = "4px"; el.style.minHeight = "4px"; void P;
  } else {
    el.style.width = pct(o.w); el.style.height = pct(o.h);
    if(o.type === "i"){ const img = el.querySelector("img"); if(img.getAttribute("src") !== o.src) img.src = o.src; }
  }
}
function addObj(o){ snapshot(); o.id = "o" + (++E.uid); E.objs.push(o); drawObj(o); return o; }
function removeObj(id){
  snapshot(); E.objs = E.objs.filter(o => o.id !== id);
  $$(`.eo[data-id="${id}"]`).forEach(el => el.remove());
  if(E.sel === id) E.sel = null; renderProps();
}
function select(id){
  E.sel = id;
  $$(".eo", root).forEach(el => el.classList.toggle("sel", el.dataset.id === id));
  renderProps();
}

/* ---------- interaksi pointer ---------- */
function frac(p, e){ const r = p.layer.getBoundingClientRect(); return [ (e.clientX - r.left)/r.width, (e.clientY - r.top)/r.height ]; }
const clamp01 = v => Math.max(0, Math.min(1, v));
let drag = null;
$("#ed-pages").addEventListener("pointerdown", e => {
  const layer = e.target.closest(".elayer"); if(!layer) return;
  const n = +layer.parentElement.dataset.n, p = E.pages[n]; E.lastPage = n;
  const objEl = e.target.closest(".eo");
  if(e.target.closest("[data-x]")){ e.preventDefault(); removeObj(objEl.dataset.id); return; }
  if(e.target.closest('[contenteditable="true"]')) return; // sedang mengetik
  const [fx, fy] = frac(p, e);
  if(E.tool === "select" || (objEl && E.tool === "text")){
    if(!objEl){ select(null); return; }
    const o = E.objs.find(x => x.id === objEl.dataset.id); if(!o) return;
    if(E.tool === "text" && o.type === "t"){ startEdit(o); return; }
    select(o.id); e.preventDefault();
    const resize = !!e.target.closest("[data-h]");
    drag = { kind: resize ? "resize" : "move", o, p, sx:fx, sy:fy, ox:o.x, oy:o.y, ow:o.w, oh:o.h, osize:o.size, pts:o.pts ? o.pts.map(q => q.slice()) : null, moved:false };
    objEl.setPointerCapture(e.pointerId);
    return;
  }
  if(E.tool === "text"){
    e.preventDefault();
    const o = addObj({type:"t", page:n, x:clamp01(fx), y:clamp01(fy - (E.text.size*0.6)/p.H), text:"", ...E.text});
    startEdit(o, true); return;
  }
  if(E.tool === "white" || E.tool === "hl" || E.tool === "pen"){
    e.preventDefault(); layer.setPointerCapture(e.pointerId);
    const g = document.createElement("div"); g.className = "ghostbox"; layer.appendChild(g);
    if(E.tool === "pen"){ g.className = "ghostpen"; g.style.cssText = "position:absolute;inset:0;pointer-events:none"; g.innerHTML = `<svg width="100%" height="100%" viewBox="0 0 1000 1000" preserveAspectRatio="none"><path fill="none" stroke="${E.pen.color}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" style="stroke-width:calc(var(--s) * ${E.pen.w}px)"/></svg>`; }
    drag = { kind:E.tool, p, layer, g, sx:fx, sy:fy, pts:[[fx, fy]] };
  }
});
window.addEventListener("pointermove", e => {
  if(!drag) return;
  const [fx, fy] = frac(drag.p, e);
  if(drag.kind === "move"){
    const o = drag.o, dx = fx - drag.sx, dy = fy - drag.sy;
    if(!drag.moved && Math.hypot(dx*drag.p.W, dy*drag.p.H) < 2) return;
    if(!drag.moved){ snapshot(); drag.moved = true; }
    o.x = drag.ox + dx; o.y = drag.oy + dy;
    if(o.pts) o.pts = drag.pts.map(q => [q[0] + dx, q[1] + dy]);
    drawObj(o);
  } else if(drag.kind === "resize"){
    const o = drag.o;
    if(!drag.moved){ snapshot(); drag.moved = true; }
    if(o.type === "t"){
      const el = $(`.eo[data-id="${o.id}"]`, drag.p.layer); const r = el.getBoundingClientRect(), lr = drag.p.layer.getBoundingClientRect();
      const curH = r.height / lr.height; const want = Math.max(0.01, fy - o.y);
      o.size = Math.max(6, Math.min(160, Math.round(o.size * want / Math.max(0.001, curH) * 10) / 10)); E.text.size = Math.round(o.size);
    } else if(o.type === "i"){
      const w = Math.max(0.02, fx - o.x); const ratio = drag.oh / drag.ow;
      o.w = w; o.h = w * ratio;
    } else { o.w = Math.max(0.005, fx - o.x); o.h = Math.max(0.005, fy - o.y); }
    drawObj(o);
  } else if(drag.kind === "pen"){
    drag.pts.push([fx, fy]);
    $("path", drag.g).setAttribute("d", drag.pts.map((q, i) => `${i ? "L" : "M"}${(q[0]*1000).toFixed(1)} ${(q[1]*1000).toFixed(1)}`).join(" "));
  } else {
    const x = Math.min(drag.sx, fx), y = Math.min(drag.sy, fy), w = Math.abs(fx - drag.sx), h = Math.abs(fy - drag.sy);
    Object.assign(drag.g.style, {left:pct(x), top:pct(y), width:pct(w), height:pct(h)});
    drag.rect = {x:clamp01(x), y:clamp01(y), w, h};
  }
});
window.addEventListener("pointerup", () => {
  if(!drag) return;
  const d = drag; drag = null;
  if(d.g) d.g.remove();
  if((d.kind === "white" || d.kind === "hl") && d.rect && d.rect.w*d.p.W > 3 && d.rect.h*d.p.H > 3){
    const o = addObj({type: d.kind === "white" ? "w" : "h", page:d.p.n, ...d.rect});
    void o;
  }
  if(d.kind === "pen" && d.pts.length){
    const xs = d.pts.map(q => q[0]), ys = d.pts.map(q => q[1]);
    const pad = 0.002;
    const x = Math.min(...xs) - pad, y = Math.min(...ys) - pad;
    addObj({type:"p", page:d.p.n, x, y, w:Math.max(...xs) - x + pad, h:Math.max(...ys) - y + pad, pts:d.pts, color:E.pen.color, lw:E.pen.w, w0:E.pen.w});
  }
  if(d.kind === "resize" && d.o.type === "t") renderProps();
});
$("#ed-pages").addEventListener("dblclick", e => {
  const el = e.target.closest(".eo.t"); if(!el) return;
  const o = E.objs.find(x => x.id === el.dataset.id); if(o) startEdit(o);
});

/* ---------- edit teks ---------- */
function startEdit(o, fresh){
  select(o.id);
  const el = $(`.eo[data-id="${o.id}"]`, root); if(!el) return;
  const span = el.querySelector(".tx");
  if(!fresh) snapshot();
  el.classList.add("editing");
  span.contentEditable = "true"; span.textContent = o.text;
  span.focus();
  const range = document.createRange(); range.selectNodeContents(span); range.collapse(false);
  const s = getSelection(); s.removeAllRanges(); s.addRange(range);
  const finish = () => {
    span.removeEventListener("blur", finish);
    span.contentEditable = "false"; el.classList.remove("editing");
    const t = (span.innerText || "").replace(/\u00a0/g, " ").replace(/\n+$/, "");
    o.text = t; drawObj(o);
    if(!t.trim()){ E.objs = E.objs.filter(x => x.id !== o.id); el.remove(); if(E.sel === o.id) E.sel = null; renderProps(); }
  };
  span.addEventListener("blur", finish);
}
document.addEventListener("keydown", e => {
  if(!$("#v-edit").classList.contains("on") || !E.file) return;
  if($("#sigmodal").classList.contains("on")) return;
  const editing = document.activeElement && (document.activeElement.isContentEditable || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName));
  if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !editing){ e.preventDefault(); undo(); return; }
  if(editing){ if(e.key === "Escape") document.activeElement.blur(); return; }
  if((e.key === "Delete" || e.key === "Backspace") && E.sel){ e.preventDefault(); removeObj(E.sel); }
  if(e.key === "Escape") select(null);
});

/* ---------- gambar & tanda tangan ---------- */
function visiblePage(){
  let best = E.lastPage, bestA = -1;
  E.pages.forEach(p => { if(!p) return; const r = p.el.getBoundingClientRect(); const a = Math.max(0, Math.min(innerHeight, r.bottom) - Math.max(0, r.top)); if(a > bestA){ bestA = a; best = p.n; } });
  return best;
}
function placeImage(src, iw, ih, isSig){
  const n = visiblePage(), p = E.pages[n];
  const w = isSig ? 0.3 : 0.4; const h = w * (ih/iw) * (p.W/p.H);
  const r = p.el.getBoundingClientRect();
  const visTop = Math.max(0, -r.top) / r.height, visBot = Math.min(r.height, innerHeight - r.top) / r.height;
  let y = (visTop + visBot)/2 - h/2; y = Math.max(0.02, Math.min(1 - h - 0.02, y));
  const o = addObj({type:"i", page:n, x:(1 - w)/2, y, w, h, src, sig:!!isSig});
  setTool("select"); select(o.id);
  $("#ed-hint").textContent = isSig ? "Geser tanda tangan ke tempatnya. Tarik titik di pojok untuk mengubah ukuran." : HINTS.select;
}
$("#ed-imgfile").addEventListener("change", async () => {
  const f = $("#ed-imgfile").files[0]; $("#ed-imgfile").value = ""; if(!f) return;
  const url = URL.createObjectURL(f); const im = new Image(); im.src = url;
  try { await im.decode(); } catch(e){ toast("Gambar tidak bisa dibaca"); return; }
  // simpan sebagai PNG/JPEG data URL (webp diubah ke PNG)
  let src;
  if(/jpe?g/.test(f.type)) src = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
  else { const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext("2d").drawImage(im, 0, 0); src = c.toDataURL("image/png"); }
  URL.revokeObjectURL(url);
  placeImage(src, im.naturalWidth, im.naturalHeight, false);
});

/* ---------- modal tanda tangan ---------- */
const SIG = { tab:"draw", color:"#111111", font:1, dirty:false, up:null };
const sigCv = $("#sig-canvas"), sctx = sigCv.getContext("2d");
function openSig(){
  J.loadCss("lib/sign-fonts.css").then(() => { renderFonts(); });
  $("#sigmodal").classList.add("on"); clearSig(); renderFonts();
  setTimeout(() => (SIG.tab === "type" ? $("#sig-name") : sigCv).focus(), 50);
}
function closeSig(){ $("#sigmodal").classList.remove("on"); }
$("#sig-x").onclick = closeSig;
$("#sigmodal").addEventListener("pointerdown", e => { if(e.target.id === "sigmodal") closeSig(); });
document.addEventListener("keydown", e => { if(e.key === "Escape" && $("#sigmodal").classList.contains("on")) closeSig(); });
J.segSetup("sig-tab", v => { SIG.tab = v; ["draw","type","upload"].forEach(k => $("#sig-"+k).hidden = k !== v); $("#sig-clear").style.display = v === "upload" ? "none" : ""; if(v === "type") $("#sig-name").focus(); });
J.swatches($("#sig-color"), c => { SIG.color = c; recolorSig(); renderFonts(); });
function clearSig(){ sctx.clearRect(0, 0, sigCv.width, sigCv.height); SIG.dirty = false; SIG.strokes = []; }
$("#sig-clear").onclick = () => { if(SIG.tab === "draw") clearSig(); else { $("#sig-name").value = ""; renderFonts(); } };
let sp = null;
function sigPt(e){ const r = sigCv.getBoundingClientRect(); return [ (e.clientX - r.left) * sigCv.width / r.width, (e.clientY - r.top) * sigCv.height / r.height ]; }
function strokeSeg(a, b, c){ sctx.lineWidth = 5.5; sctx.lineCap = "round"; sctx.lineJoin = "round"; sctx.strokeStyle = SIG.color; sctx.beginPath(); sctx.moveTo(a[0], a[1]); sctx.quadraticCurveTo(b[0], b[1], c[0], c[1]); sctx.stroke(); }
sigCv.addEventListener("pointerdown", e => { e.preventDefault(); sigCv.setPointerCapture(e.pointerId); const q = sigPt(e); sp = [q]; SIG.strokes.push(sp); strokeSeg(q, q, q); SIG.dirty = true; });
sigCv.addEventListener("pointermove", e => {
  if(!sp) return; const q = sigPt(e); sp.push(q);
  const n = sp.length; if(n < 3) return;
  const a = sp[n-3], b = sp[n-2], c = q;
  strokeSeg([(a[0]+b[0])/2, (a[1]+b[1])/2], b, [(b[0]+c[0])/2, (b[1]+c[1])/2]);
});
window.addEventListener("pointerup", () => { sp = null; });
function recolorSig(){
  if(!SIG.strokes || !SIG.strokes.length) return;
  sctx.clearRect(0, 0, sigCv.width, sigCv.height);
  for(const s of SIG.strokes){ for(let i = 2; i < s.length; i++){ const a = s[i-2], b = s[i-1], c = s[i]; strokeSeg([(a[0]+b[0])/2, (a[1]+b[1])/2], b, [(b[0]+c[0])/2, (b[1]+c[1])/2]); } if(s.length < 3) strokeSeg(s[0], s[0], s[s.length-1]); }
}
function renderFonts(){
  const name = $("#sig-name").value.trim() || "Tanda tangan";
  $("#sig-fonts").innerHTML = [1,2,3].map(i => `<button data-f="${i}" class="${SIG.font === i ? "on" : ""}" style="font-family:'JP Sign ${i}';--sigc:${SIG.color}">${esc(name)}</button>`).join("");
}
$("#sig-name").addEventListener("input", renderFonts);
$("#sig-fonts").addEventListener("click", e => { const b = e.target.closest("button[data-f]"); if(!b) return; SIG.font = +b.dataset.f; renderFonts(); });
$("#sig-uppick").onclick = () => $("#sig-upfile").click();
$("#sig-upfile").addEventListener("change", async () => {
  const f = $("#sig-upfile").files[0]; $("#sig-upfile").value = ""; if(!f) return;
  const im = new Image(); im.src = URL.createObjectURL(f);
  try { await im.decode(); } catch(e){ toast("Gambar tidak bisa dibaca"); return; }
  SIG.up = im; showUp();
});
$("#sig-upclean").addEventListener("change", showUp);
function showUp(){
  if(!SIG.up) return;
  const c = upCanvas(); $("#sig-upprev").innerHTML = ""; const img = new Image(); img.src = c.toDataURL("image/png"); $("#sig-upprev").appendChild(img);
}
function upCanvas(){
  const im = SIG.up, max = 1400, k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
  const c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth*k); c.height = Math.round(im.naturalHeight*k);
  const x = c.getContext("2d"); x.drawImage(im, 0, 0, c.width, c.height);
  if($("#sig-upclean").checked){
    const d = x.getImageData(0, 0, c.width, c.height), a = d.data;
    for(let i = 0; i < a.length; i += 4){
      const l = 0.299*a[i] + 0.587*a[i+1] + 0.114*a[i+2];
      if(l > 200) a[i+3] = 0; else if(l > 150) a[i+3] = Math.round(a[i+3] * (200 - l) / 50);
    }
    x.putImageData(d, 0, 0);
  }
  return c;
}
function trim(c){
  const x = c.getContext("2d"), { width:w, height:h } = c, d = x.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for(let y = 0; y < h; y++) for(let xx = 0; xx < w; xx++) if(d[(y*w + xx)*4 + 3] > 12){ if(xx < x0) x0 = xx; if(xx > x1) x1 = xx; if(y < y0) y0 = y; if(y > y1) y1 = y; }
  if(x1 < 0) return null;
  const pad = 8; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const o = document.createElement("canvas"); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
  o.getContext("2d").drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
  return o;
}
$("#sig-ok").onclick = async () => {
  let c = null;
  if(SIG.tab === "draw"){ if(!SIG.dirty){ toast("Gambar tanda tanganmu dulu"); return; } c = trim(sigCv); }
  else if(SIG.tab === "type"){
    const name = $("#sig-name").value.trim(); if(!name){ toast("Ketik namamu dulu"); $("#sig-name").focus(); return; }
    const fam = `'JP Sign ${SIG.font}'`;
    try { await document.fonts.load(`120px ${fam}`, name); } catch(e){}
    const t = document.createElement("canvas"); const x = t.getContext("2d"); x.font = `120px ${fam}`;
    t.width = Math.ceil(x.measureText(name).width + 80); t.height = 220;
    x.font = `120px ${fam}`; x.fillStyle = SIG.color; x.textBaseline = "middle"; x.fillText(name, 40, 115);
    c = trim(t);
  } else { if(!SIG.up){ toast("Pilih foto tanda tangan dulu"); return; } c = trim(upCanvas()); }
  if(!c){ toast("Tanda tangan kosong"); return; }
  closeSig();
  placeImage(c.toDataURL("image/png"), c.width, c.height, true);
};

/* ---------- simpan ---------- */
const dataBytes = url => { const b = atob(url.split(",")[1]); const a = new Uint8Array(b.length); for(let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; };
$("#go-edit").onclick = async () => {
  if(document.activeElement && document.activeElement.isContentEditable) document.activeElement.blur();
  if(!E.objs.length){ toast("Belum ada perubahan. Tambahkan teks, tanda tangan, atau gambar dulu."); return; }
  showProgress("Menyimpan PDF…");
  try{
    progress(.05, "Membaca file…");
    const doc = await PDFDocument.load(await J.readBytes(E.file));
    const fontCache = {}, imgCache = {};
    const getFont = async (k, bold) => { const key = k + (bold ? "b" : ""); return fontCache[key] || (fontCache[key] = await doc.embedFont(FONTS[k].std[bold ? 1 : 0])); };
    const getImg = async src => imgCache[src] || (imgCache[src] = /^data:image\/jpe?g/.test(src) ? await doc.embedJpg(dataBytes(src)) : await doc.embedPng(dataBytes(src)));
    const byPage = {};
    E.objs.forEach(o => (byPage[o.page] = byPage[o.page] || []).push(o));
    const pageNums = Object.keys(byPage).map(Number);
    for(let k = 0; k < pageNums.length; k++){
      const n = pageNums[k]; progress(.1 + .8*k/pageNums.length, `Halaman ${n}…`); await tick();
      const pj = await E.pdf.getPage(n); const vp = pj.getViewport({scale:1}); const r = norm(pj.rotate || 0);
      const W = vp.width, H = vp.height, page = doc.getPage(n-1);
      const P = (fx, fy) => vp.convertToPdfPoint(fx*W, fy*H);
      const rectOf = o => { const a = P(o.x, o.y), b = P(o.x + o.w, o.y + o.h); return { x:Math.min(a[0], b[0]), y:Math.min(a[1], b[1]), width:Math.abs(a[0]-b[0]), height:Math.abs(a[1]-b[1]) }; };
      // urutan: tutup & stabilo dulu, lalu coretan, gambar, teks
      const order = {w:0, h:1, p:2, i:3, t:4};
      for(const o of byPage[n].slice().sort((a, b) => order[a.type] - order[b.type])){
        if(o.type === "w") page.drawRectangle({...rectOf(o), color:rgb(1,1,1), borderWidth:0});
        else if(o.type === "h") page.drawRectangle({...rectOf(o), color:rgb(1, 0.886, 0), opacity:0.42, blendMode:BlendMode.Multiply, borderWidth:0});
        else if(o.type === "i"){
          const img = await getImg(o.src); const [x, y] = P(o.x, o.y + o.h);
          page.drawImage(img, {x, y, width:o.w*W, height:o.h*H, rotate:degrees(r)});
        } else if(o.type === "p"){
          const col = J.hexRgb(o.color);
          const pts = o.pts.map(q => P(q[0], q[1]));
          if(pts.length === 1) page.drawCircle({x:pts[0][0], y:pts[0][1], size:o.lw/2, color:col});
          for(let i = 1; i < pts.length; i++) page.drawLine({start:{x:pts[i-1][0], y:pts[i-1][1]}, end:{x:pts[i][0], y:pts[i][1]}, thickness:o.lw, color:col, lineCap:LineCapStyle.Round});
        } else if(o.type === "t"){
          const font = await getFont(o.font, o.bold), F = FONTS[o.font] || FONTS.sans, col = J.hexRgb(o.color);
          o.text.split("\n").forEach((line, i) => {
            if(!line) return;
            const [x, y] = P(o.x, o.y + (i*1.2*o.size + F.base*o.size)/H);
            page.drawText(J.safeText(line, font), {x, y, size:o.size, font, color:col, rotate:degrees(r)});
          });
        }
      }
    }
    progress(.95, "Menyimpan…"); await tick();
    const out = await doc.save({useObjectStreams:true});
    const sign = E.objs.some(o => o.sig);
    showResult({title: sign ? "PDF sudah ditandatangani" : "Perubahan disimpan", name:`${baseName(E.file.name)}-${sign ? "ttd" : "edit"}.pdf`, blob:pdfBlob(out)});
  }catch(e){ showError(/encrypt/i.test(e.message || "") ? "PDF ini terkunci. Buka kuncinya dulu, lalu coba lagi." : (e.message || "Gagal menyimpan PDF.")); }
};

window.JP_BOOT && window.JP_BOOT();
})();
