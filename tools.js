/* JagoPDF · alat tambahan: kunci, buka kunci, watermark, PDF ke teks, PDF ke Word/Excel.
   Semua diproses di perangkat pengguna. */
(function(){
"use strict";
const J = window.JP;
const { $, $$, esc, fmtSize, baseName, isPdf, handlers, toast, showProgress, progress, openPdf, loadDone, tick, hideOv,
  showResult, showError, sizeOk, renderPage, buildPageGrid, segSetup, showWork, pdfBlob, norm, parseRanges, pagesFromRanges } = J;
const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib;

/* ---------- helper bersama ---------- */
const abs = p => new URL(String(p).replace(/^\//,""), location.origin + "/").href;  // selalu dari root, agar jalan di / maupun /office/
const scriptCache = {};
function loadScript(src){
  return scriptCache[src] || (scriptCache[src] = new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = abs(src); s.onload = res;
    s.onerror = () => { delete scriptCache[src]; rej(new Error("Komponen gagal dimuat. Periksa koneksi internet lalu coba lagi.")); };
    document.head.appendChild(s);
  }));
}
const cssCache = {};
function loadCss(href){
  return cssCache[href] || (cssCache[href] = new Promise((res) => {
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = abs(href); l.onload = res; l.onerror = res; document.head.appendChild(l);
  }));
}
function hexRgb(hex){ const n = parseInt(hex.slice(1), 16); return rgb(((n>>16)&255)/255, ((n>>8)&255)/255, (n&255)/255); }
function swatches(root, onChange){
  $$("button", root).forEach(b => { b.style.setProperty("--sw", b.dataset.c); });
  root.addEventListener("click", e => {
    const b = e.target.closest("button[data-c]"); if(!b) return;
    $$("button", root).forEach(x => x.classList.toggle("on", x === b));
    onChange && onChange(b.dataset.c);
  });
  return () => ($("button.on", root) || $("button", root)).dataset.c;
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-eye]"); if(!b) return;
  const inp = $("#" + b.dataset.eye); const show = inp.type === "password";
  inp.type = show ? "text" : "password"; b.classList.toggle("on", show);
  b.setAttribute("aria-label", show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi");
});
// teks untuk font standar PDF (WinAnsi): ganti karakter yang tidak didukung
const SUBS = {"“":'"',"”":'"',"„":'"',"‘":"'","’":"'","–":"-","—":"-","…":"..."," ":" ","•":"•"};
function safeText(str, font){
  let out = "";
  for(const ch of String(str)){
    let c = SUBS[ch] !== undefined ? SUBS[ch] : ch;
    try { font.widthOfTextAtSize(c, 10); } catch(e){ c = "?"; }
    out += c;
  }
  return out;
}
const readBytes = async f => new Uint8Array(await f.arrayBuffer());
function pagesFromField(val, n){
  const v = (val || "").trim();
  if(!v) return { pages: Array.from({length:n}, (_, i) => i+1) };
  const { ranges, error } = parseRanges(v, n);
  if(error) return { error };
  return { pages: pagesFromRanges(ranges) };
}

/* ---------- qpdf (kunci & buka kunci) ---------- */
let qpdfFactory = null, qpdfWasm = null;
async function qpdfRun(input, args){
  if(!qpdfFactory){
    await loadScript("lib/qpdf/qpdf.js");
    qpdfFactory = window.Module; try { delete window.Module; } catch(e){ window.Module = undefined; }
    const res = await fetch(abs("lib/qpdf/qpdf.wasm"));
    if(!res.ok) throw new Error("Komponen kunci PDF gagal dimuat. Periksa koneksi internet lalu coba lagi.");
    qpdfWasm = await WebAssembly.compile(await res.arrayBuffer());
  }
  const errs = [];
  const q = await qpdfFactory({
    noInitialRun:true, print:() => {}, printErr: t => errs.push(String(t)),
    instantiateWasm(imports, done){ WebAssembly.instantiate(qpdfWasm, imports).then(inst => done(inst)); return {}; },
  });
  if(input) q.FS.writeFile("/in.pdf", input);
  let rc;
  try { rc = q.callMain(args); } catch(e){ rc = (e && typeof e.status === "number") ? e.status : 99; }
  let out = null;
  try { out = q.FS.readFile("/out.pdf"); } catch(e){}
  return { rc, out, err: errs.join("\n") };
}
J.qpdfRun = qpdfRun;

/* ================= KUNCI PDF ================= */
const LK = { file:null, pdf:null, io:null };
handlers.lock = async (fs) => {
  const f = fs.find(isPdf); if(!f){ toast("Pilih file PDF"); return; }
  if(!(await sizeOk(f.size))) return;
  try{
    showProgress("Membuka PDF");
    const pdf = await openPdf(f);
    if(LK.pdf) LK.pdf.destroy(); if(LK.io) LK.io.disconnect();
    Object.assign(LK, {file:f, pdf});
    $("#title-lock").textContent = `${f.name} · ${pdf.numPages} hal · ${fmtSize(f.size)}`;
    showWork("lock", true);
    LK.io = buildPageGrid($("#pages-lock"), pdf, {selectable:false});
    syncLock(); await loadDone();
    $("#lock-pw").focus();
  }catch(e){
    showError(/kata sandi/i.test(e.message) ? "PDF ini sudah dikunci dengan kata sandi. Buka kuncinya dulu kalau mau mengganti sandi." : e.message);
  }
};
function syncLock(){
  const a = $("#lock-pw").value, b = $("#lock-pw2").value, h = $("#hint-lock");
  let err = "";
  if(a && a.length < 4) err = "Kata sandi minimal 4 karakter.";
  else if(b && a !== b) err = "Kedua kata sandi belum sama.";
  h.classList.toggle("err", !!err);
  h.textContent = err || "Simpan kata sandinya baik-baik. Kalau lupa, file tidak bisa dibuka lagi.";
  $("#go-lock").disabled = !LK.file || !a || a.length < 4 || a !== b;
}
["lock-pw","lock-pw2"].forEach(id => $("#"+id).addEventListener("input", syncLock));
$("#lock-pw2").addEventListener("keydown", e => { if(e.key === "Enter" && !$("#go-lock").disabled) $("#go-lock").click(); });
function randomPw(){ const a = new Uint8Array(18); crypto.getRandomValues(a); return Array.from(a, x => x.toString(16).padStart(2,"0")).join(""); }
$("#go-lock").onclick = async () => {
  const pw = $("#lock-pw").value;
  const restrict = [];
  if($("#lock-noprint").checked) restrict.push("--print=none");
  if($("#lock-nocopy").checked) restrict.push("--extract=n");
  if($("#lock-noedit").checked) restrict.push("--modify=none");
  // dengan batasan, sandi pemilik dibuat acak supaya batasannya benar-benar berlaku
  const owner = restrict.length ? randomPw() : pw;
  showProgress("Mengunci PDF…");
  try{
    progress(.15, "Membaca file…");
    const input = await readBytes(LK.file);
    progress(.4, "Mengenkripsi dengan AES-256…"); await tick();
    const r = await qpdfRun(input, ["--encrypt", pw, owner, "256", ...restrict, "--", "/in.pdf", "/out.pdf"]);
    if(!r.out || (r.rc !== 0 && r.rc !== 3)) throw new Error("PDF ini tidak bisa dikunci. File mungkin rusak.");
    progress(1, "Selesai");
    showResult({title:"PDF berhasil dikunci", name:`${baseName(LK.file.name)}-terkunci.pdf`, blob:pdfBlob(r.out),
      extra:`<p class="muted" style="margin:6px 0 0;font-size:13px">File ini sekarang butuh kata sandi untuk dibuka.</p>`});
  }catch(e){ showError(e.message); }
};

/* ================= BUKA KUNCI PDF ================= */
const UL = { file:null, bytes:null, state:null };
const LOCK_IC = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>';
const OPEN_IC = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 7.6-1.7"/></svg>';
handlers.unlock = async (fs) => {
  const f = fs.find(isPdf); if(!f){ toast("Pilih file PDF"); return; }
  if(!(await sizeOk(f.size))) return;
  try{
    showProgress("Memeriksa PDF");
    progress(.2, "Membaca file…");
    const bytes = await readBytes(f);
    progress(.6, "Memeriksa kunci…");
    let state;
    try { const d = await pdfjsLib.getDocument({data: bytes.slice(), isEvalSupported:false}).promise; d.destroy(); state = null; }
    catch(e){ if(e && e.name === "PasswordException") state = "pw"; else throw new Error("File PDF tidak bisa dibaca. Mungkin rusak."); }
    if(!state){
      try { const d = await PDFDocument.load(bytes.slice(), {ignoreEncryption:true, updateMetadata:false}); state = d.isEncrypted ? "restrict" : "none"; }
      catch(e){ state = "restrict"; }
    }
    Object.assign(UL, {file:f, bytes, state});
    $("#title-unlock").textContent = `${f.name} · ${fmtSize(f.size)}`;
    const box = $("#unlock-state");
    box.innerHTML = state === "pw"
      ? `<span class="ic">${LOCK_IC}</span><div><h5>Dilindungi kata sandi</h5><p>Masukkan kata sandinya untuk membuat salinan tanpa kunci.</p></div>`
      : state === "restrict"
      ? `<span class="ic">${LOCK_IC}</span><div><h5>Dibatasi izin</h5><p>File bisa dibuka, tapi dilarang dicetak, disalin, atau diubah. Batasan ini bisa langsung dihapus.</p></div>`
      : `<span class="ic">${OPEN_IC}</span><div><h5>Tidak terkunci</h5><p>PDF ini tidak memakai kata sandi atau batasan apa pun.</p></div>`;
    $("#opt-unlock-pw").style.display = state === "pw" ? "" : "none";
    $("#unlock-pw").value = ""; $("#hint-unlock").classList.remove("err");
    $("#hint-unlock").textContent = "Masukkan kata sandi yang biasa dipakai untuk membuka file ini.";
    showWork("unlock", true); syncUnlock(); await loadDone();
    if(state === "pw") $("#unlock-pw").focus();
  }catch(e){ showError(e.message); }
};
function syncUnlock(){ $("#go-unlock").disabled = !UL.file || UL.state === "none" || (UL.state === "pw" && !$("#unlock-pw").value); }
$("#unlock-pw").addEventListener("input", syncUnlock);
$("#unlock-pw").addEventListener("keydown", e => { if(e.key === "Enter" && !$("#go-unlock").disabled) $("#go-unlock").click(); });
$("#go-unlock").onclick = async () => {
  showProgress("Membuka kunci PDF…");
  try{
    progress(.4, "Mendekripsi…"); await tick();
    const args = ["--decrypt", "/in.pdf", "/out.pdf"];
    if(UL.state === "pw") args.unshift("--password=" + $("#unlock-pw").value);
    const r = await qpdfRun(UL.bytes, args);
    if(UL.state === "pw" && (!r.out || /invalid password/i.test(r.err))){
      hideOv(); const h = $("#hint-unlock"); h.classList.add("err"); h.textContent = "Kata sandi salah. Coba lagi.";
      $("#unlock-pw").select(); return;
    }
    if(!r.out || (r.rc !== 0 && r.rc !== 3)) throw new Error("PDF ini tidak bisa dibuka kuncinya. File mungkin rusak.");
    progress(1, "Selesai");
    showResult({title:"Kunci PDF dihapus", name:`${baseName(UL.file.name)}-terbuka.pdf`, blob:pdfBlob(r.out),
      extra:`<p class="muted" style="margin:6px 0 0;font-size:13px">Salinan ini bisa dibuka tanpa kata sandi. File aslimu tidak berubah.</p>`});
  }catch(e){ showError(e.message); }
};

/* ================= WATERMARK ================= */
const WM = { file:null, pdf:null, n:0, page:1, img:null, base:null, over:null, meas:null };
const getWmKind = segSetup("wm-kind", v => { $("#opt-wm-text").style.display = v === "text" ? "" : "none"; $("#opt-wm-img").style.display = v === "img" ? "" : "none"; drawWm(); });
const getWmAngle = segSetup("wm-angle", () => drawWm());
const getWmColor = swatches($("#wm-color"), () => drawWm());
$("#wm-pos").addEventListener("click", e => { const b = e.target.closest("button"); if(!b) return; $$("#wm-pos button").forEach(x => x.classList.toggle("on", x === b)); drawWm(); });
$("#wm-tile").addEventListener("change", () => { $("#wm-pos").classList.toggle("off", $("#wm-tile").checked); drawWm(); });
["wm-text","wm-size","wm-op"].forEach(id => $("#"+id).addEventListener("input", () => drawWm()));
$("#wm-pages").addEventListener("input", syncWm);
$("#wm-imgpick").onclick = () => $("#wm-imgfile").click();
$("#wm-imgfile").addEventListener("change", async () => {
  const f = $("#wm-imgfile").files[0]; $("#wm-imgfile").value = ""; if(!f) return;
  const bytes = await readBytes(f);
  const png = f.type === "image/png" || /\.png$/i.test(f.name);
  const url = URL.createObjectURL(new Blob([bytes], {type: png ? "image/png" : "image/jpeg"}));
  const el = new Image(); el.src = url;
  try { await el.decode(); } catch(e){ toast("Gambar tidak bisa dibaca"); return; }
  WM.img = { bytes, png, el, w: el.naturalWidth, h: el.naturalHeight };
  $("#wm-imgname").textContent = f.name; drawWm(); syncWm();
});
function wmVals(){ return { kind:getWmKind(), text:$("#wm-text").value.trim(), size:+$("#wm-size").value, op:+$("#wm-op").value/100,
  angle:+getWmAngle(), color:getWmColor(), pos:($("#wm-pos button.on")||{dataset:{p:"mc"}}).dataset.p, tile:$("#wm-tile").checked }; }
function syncWm(){
  const v = wmVals(); const r = WM.n ? pagesFromField($("#wm-pages").value, WM.n) : {pages:[]};
  const h = $("#hint-wm"); h.classList.toggle("err", !!r.error);
  h.textContent = r.error || (WM.n ? `${r.pages.length} dari ${WM.n} halaman diberi watermark` : "");
  $("#go-wm").disabled = !WM.file || !!r.error || (v.kind === "text" ? !v.text : !WM.img);
  $("#wm-size-v").textContent = v.size + "%"; $("#wm-op-v").textContent = Math.round(v.op*100) + "%";
}
async function measFont(){ if(!WM.meas){ const d = await PDFDocument.create(); WM.meas = await d.embedFont(StandardFonts.HelveticaBold); } return WM.meas; }
// tanda-tanda di koordinat tampilan (poin, y ke bawah): {cx, cy, w, h, size}
function wmMarks(W, H, v, font){
  const base = Math.min(W, H);
  const th = v.angle * Math.PI / 180;
  let w, h, size = 0;
  const scale = v.tile ? 0.42 : 1;
  if(v.kind === "text"){
    const t = v.text || " ";
    const w1 = font.widthOfTextAtSize(t, 1);
    w = v.size/100 * base * (v.tile ? 0.9 : 1.15) * scale; size = w / w1;
    const maxSize = base * 0.4; if(size > maxSize){ size = maxSize; w = w1*size; }
    h = size * 0.72;
  } else {
    if(!WM.img) return [];
    w = v.size/100 * base * scale; h = w * WM.img.h / WM.img.w;
  }
  const ex = (Math.abs(w*Math.cos(th)) + Math.abs(h*Math.sin(th))) / 2;
  const ey = (Math.abs(w*Math.sin(th)) + Math.abs(h*Math.cos(th))) / 2;
  if(v.tile){
    const out = [], sx = ex*2 + base*0.12, sy = ey*2 + base*0.14;
    let row = 0;
    for(let cy = sy/2; cy < H + sy/2; cy += sy, row++)
      for(let cx = (row % 2 ? sx : sx/2); cx < W + sx/2; cx += sx) out.push({cx, cy, w, h, size});
    return out;
  }
  const m = base * 0.06;
  const col = v.pos[1], rowp = v.pos[0];
  const cx = col === "l" ? m + ex : col === "r" ? W - m - ex : W/2;
  const cy = rowp === "t" ? m + ey : rowp === "b" ? H - m - ey : H/2;
  return [{cx, cy, w, h, size}];
}
let wmRaf = 0;
function drawWm(){ syncWm(); cancelAnimationFrame(wmRaf); wmRaf = requestAnimationFrame(drawWmNow); }
async function drawWmNow(){
  if(!WM.base || !WM.over) return;
  const v = wmVals(), font = await measFont();
  const c = WM.over, ctx = c.getContext("2d"), s = c.width / WM.vw;
  ctx.clearRect(0, 0, c.width, c.height);
  const marks = wmMarks(WM.vw, WM.vh, v, font);
  ctx.globalAlpha = v.op;
  for(const mk of marks){
    ctx.save(); ctx.translate(mk.cx*s, mk.cy*s); ctx.rotate(-v.angle*Math.PI/180);
    if(v.kind === "text"){
      ctx.fillStyle = v.color; ctx.font = `bold ${mk.size*s}px Helvetica, Arial, sans-serif`;
      const real = ctx.measureText(v.text).width || 1;
      ctx.scale(mk.w*s/real, 1); ctx.fillText(v.text, -real/2, mk.h*s/2);
    } else ctx.drawImage(WM.img.el, -mk.w*s/2, -mk.h*s/2, mk.w*s, mk.h*s);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
async function showWmPage(n){
  WM.page = Math.max(1, Math.min(WM.n, n));
  $("#wm-pgl").textContent = `Halaman ${WM.page} dari ${WM.n}`;
  $("#wm-prevpg").disabled = WM.page <= 1; $("#wm-nextpg").disabled = WM.page >= WM.n;
  const stage = $("#wm-prev"), width = Math.min(760, Math.max(280, stage.parentElement.clientWidth - 32));
  const page = await WM.pdf.getPage(WM.page); const vp = page.getViewport({scale:1});
  WM.vw = vp.width; WM.vh = vp.height;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const { canvas } = await renderPage(WM.pdf, WM.page, {width: width*dpr});
  const over = document.createElement("canvas"); over.width = canvas.width; over.height = canvas.height;
  stage.innerHTML = ""; stage.append(canvas, over);
  WM.base = canvas; WM.over = over; drawWmNow();
}
$("#wm-prevpg").onclick = () => showWmPage(WM.page - 1);
$("#wm-nextpg").onclick = () => showWmPage(WM.page + 1);
handlers.wm = async (fs) => {
  const f = fs.find(isPdf); if(!f){ toast("Pilih file PDF"); return; }
  if(!(await sizeOk(f.size))) return;
  try{
    showProgress("Membuka PDF");
    const pdf = await openPdf(f);
    if(WM.pdf) WM.pdf.destroy();
    Object.assign(WM, {file:f, pdf, n:pdf.numPages});
    $("#title-wm").textContent = `${f.name} · ${pdf.numPages} hal`;
    showWork("wm", true);
    await showWmPage(1); syncWm(); await loadDone();
  }catch(e){ showError(e.message); }
};
$("#go-wm").onclick = async () => {
  const v = wmVals(); const { pages } = pagesFromField($("#wm-pages").value, WM.n);
  showProgress("Menambahkan watermark…");
  try{
    progress(.05, "Membaca file…");
    const doc = await PDFDocument.load(await readBytes(WM.file));
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const text = v.kind === "text" ? safeText(v.text, font) : "";
    const img = v.kind === "img" ? (WM.img.png ? await doc.embedPng(WM.img.bytes) : await doc.embedJpg(WM.img.bytes)) : null;
    const color = hexRgb(v.color);
    for(let k = 0; k < pages.length; k++){
      const n = pages[k];
      progress(.1 + .8*k/pages.length, `Halaman ${n} dari ${WM.n}`); if(k % 10 === 0) await tick();
      const pj = await WM.pdf.getPage(n); const vp = pj.getViewport({scale:1}); const r = norm(pj.rotate || 0);
      const page = doc.getPage(n-1);
      const phi = (r + v.angle) * Math.PI / 180;
      for(const mk of wmMarks(vp.width, vp.height, {...v, text: text || v.text}, font)){
        const [cx, cy] = vp.convertToPdfPoint(mk.cx, mk.cy);
        const lx = -mk.w/2, ly = -mk.h/2;
        const x = cx + lx*Math.cos(phi) - ly*Math.sin(phi), y = cy + lx*Math.sin(phi) + ly*Math.cos(phi);
        if(v.kind === "text") page.drawText(text, {x, y, size:mk.size, font, color, opacity:v.op, rotate:degrees(r + v.angle)});
        else page.drawImage(img, {x, y, width:mk.w, height:mk.h, opacity:v.op, rotate:degrees(r + v.angle)});
      }
    }
    progress(.95, "Menyimpan…"); await tick();
    const out = await doc.save({useObjectStreams:true});
    showResult({title:"Watermark ditambahkan", name:`${baseName(WM.file.name)}-watermark.pdf`, blob:pdfBlob(out)});
  }catch(e){ showError(/encrypt/i.test(e.message) ? "PDF ini terkunci. Buka kuncinya dulu, lalu coba lagi." : (e.message || "Gagal menambahkan watermark.")); }
};
window.addEventListener("resize", () => { if(WM.file && $("#v-watermark").classList.contains("on")) { clearTimeout(WM.rt); WM.rt = setTimeout(() => showWmPage(WM.page), 200); } });

/* ================= EKSTRAK TEKS (+OCR) ================= */
let ocrWorker = null, ocrLog = null;
async function getOcr(onMsg){
  if(ocrWorker) return ocrWorker;
  onMsg && onMsg("Menyiapkan OCR… (pertama kali ±6 MB, setelah itu tersimpan)");
  await loadScript("lib/ocr/tesseract.min.js");
  ocrWorker = await Tesseract.createWorker(["ind","eng"], 1, {
    workerPath: abs("lib/ocr/worker.min.js"), corePath: abs("lib/ocr/"), langPath: abs("lib/ocr/lang"),
    workerBlobURL:false, gzip:true, logger: m => { if(ocrLog) ocrLog(m); },
  });
  return ocrWorker;
}
async function fontFlags(page, names){
  const out = {};
  try{
    await page.getOperatorList();
    for(const n of names){ try{ const f = page.commonObjs.get(n); const nm = (f && (f.name || f.loadedName)) || ""; out[n] = /bold|black|heavy|semibold|demi/i.test(nm); }catch(e){ out[n] = false; } }
  }catch(e){}
  return out;
}
// hasil: {W, H, items:[{str,x,y,w,size,bold}], ocr}
async function pageItems(pdf, n, mode, onFrac){
  const page = await pdf.getPage(n);
  const vp = page.getViewport({scale:1});
  const W = vp.width, H = vp.height;
  let items = [];
  if(mode !== "all"){
    const tc = await page.getTextContent();
    const fl = await fontFlags(page, [...new Set(tc.items.map(i => i.fontName))]);
    for(const it of tc.items){
      if(!it.str || !it.str.trim()) continue;
      const t = pdfjsLib.Util.transform(vp.transform, it.transform);
      const size = Math.hypot(t[2], t[3]) || Math.hypot(t[0], t[1]) || 10;
      items.push({ str: it.str, x: t[4], y: t[5], w: it.width || size*it.str.length*0.5, size, bold: !!fl[it.fontName] });
    }
  }
  const chars = items.reduce((a, b) => a + b.str.replace(/\s/g, "").length, 0);
  let ocr = false;
  if(mode === "all" || (mode === "auto" && chars < 12)){
    const worker = await getOcr(m => onFrac && onFrac(0, m));
    const sc = 2.4;
    const { canvas } = await renderPage(pdf, n, {scale: sc});
    ocrLog = m => { if(m.status === "recognizing text" && onFrac) onFrac(m.progress, null); };
    const { data } = await worker.recognize(canvas, {}, {blocks:true, text:false});
    ocrLog = null; canvas.width = canvas.height = 0;
    const ocrItems = [];
    for(const b of (data.blocks || [])) for(const p of (b.paragraphs || [])) for(const l of (p.lines || [])){
      const lh = (l.bbox.y1 - l.bbox.y0) / sc;
      for(const w of (l.words || [])){
        if(!w.text || !w.text.trim() || w.confidence < 30) continue;
        ocrItems.push({ str: w.text, x: w.bbox.x0/sc, y: w.bbox.y1/sc - lh*0.18, w: (w.bbox.x1 - w.bbox.x0)/sc, size: Math.max(6, lh*0.78), bold:false });
      }
    }
    if(ocrItems.length || mode === "all"){ items = ocrItems; ocr = true; }
  }
  page.cleanup();
  return { W, H, items, ocr };
}
// kelompokkan potongan teks jadi baris
function toLines(items){
  const sorted = items.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  const lines = [];
  for(const it of sorted){
    const ln = lines.find(l => Math.abs(l.y - it.y) < Math.max(2, Math.min(l.size, it.size) * 0.45));
    if(ln){ ln.items.push(it); ln.size = Math.max(ln.size, it.size); }
    else lines.push({ y: it.y, size: it.size, items: [it] });
  }
  for(const l of lines){
    l.items.sort((a, b) => a.x - b.x);
    let text = "", prevEnd = null;
    const cells = []; let cell = null;
    for(const it of l.items){
      const gap = prevEnd === null ? 0 : it.x - prevEnd;
      if(prevEnd !== null && gap > l.size * 0.18 && !/\s$/.test(text) && !/^\s/.test(it.str)) text += " ";
      text += it.str;
      if(!cell || gap > Math.max(l.size * 1.1, 8)){ cell = { x: it.x, x2: it.x + it.w, text: it.str, bold: it.bold }; cells.push(cell); }
      else { cell.text += (gap > l.size * 0.18 && !/\s$/.test(cell.text) && !/^\s/.test(it.str) ? " " : "") + it.str; cell.x2 = it.x + it.w; }
      prevEnd = it.x + it.w;
    }
    l.text = text.replace(/\s+/g, " ").trim();
    l.x = l.items[0].x; l.x2 = Math.max(...l.items.map(i => i.x + i.w));
    l.bold = l.items.every(i => i.bold);
    l.cells = cells.map(c => ({...c, text: c.text.replace(/\s+/g, " ").trim()})).filter(c => c.text);
  }
  return lines.filter(l => l.text).sort((a, b) => a.y - b.y);
}
J.pageItems = pageItems; J.toLines = toLines;

/* ================= PDF KE TEKS ================= */
const TX = { file:null, pdf:null, text:"" };
const getTxOcr = segSetup("txt-ocr");
handlers.txt = async (fs) => {
  const f = fs.find(isPdf); if(!f){ toast("Pilih file PDF"); return; }
  if(!(await sizeOk(f.size))) return;
  try{
    showProgress("Membuka PDF");
    const pdf = await openPdf(f);
    if(TX.pdf) TX.pdf.destroy();
    Object.assign(TX, {file:f, pdf, text:""});
    $("#title-txt").textContent = `${f.name} · ${pdf.numPages} hal`;
    $("#txt-out").value = ""; $("#hint-txt").textContent = "";
    showWork("txt", true); $("#go-txt").disabled = false; $("#txt-dl").disabled = $("#txt-copy").disabled = true;
    await loadDone();
    runTxt();
  }catch(e){ showError(e.message); }
};
async function runTxt(){
  const mode = getTxOcr(), marks = $("#txt-marks").checked, n = TX.pdf.numPages;
  showProgress("Mengambil teks…");
  try{
    const parts = []; let ocrPages = 0;
    for(let i = 1; i <= n; i++){
      const base = (i-1)/n, span = 1/n;
      progress(base, `Halaman ${i} dari ${n}`); await tick();
      const pg = await pageItems(TX.pdf, i, mode, (fr, msg) => progress(base + span*fr, msg || `Membaca halaman ${i} dari ${n} (OCR) · ${Math.round(fr*100)}%`));
      if(pg.ocr) ocrPages++;
      const lines = toLines(pg.items); let out = "", prev = null;
      for(const l of lines){
        if(prev && l.y - prev.y > Math.max(prev.size, l.size) * 1.9) out += "\n";
        out += l.text + "\n"; prev = l;
      }
      parts.push((marks ? `--- Halaman ${i} ---\n` : "") + out.trim());
    }
    TX.text = parts.join(marks ? "\n\n" : "\n\n").trim() + "\n";
    $("#txt-out").value = TX.text;
    const words = (TX.text.match(/\S+/g) || []).length;
    $("#hint-txt").textContent = `${words.toLocaleString("id-ID")} kata dari ${n} halaman` + (ocrPages ? ` · ${ocrPages} halaman dibaca dengan OCR` : "") + (words ? "" : ". Tidak ada teks yang terbaca.");
    $("#txt-dl").disabled = $("#txt-copy").disabled = !words;
    hideOv();
  }catch(e){ showError(e.message || "Gagal mengambil teks."); }
}
$("#go-txt").onclick = runTxt;
$("#txt-dl").onclick = () => J.saveFile(`${baseName(TX.file.name)}.txt`, new Blob(["﻿" + $("#txt-out").value], {type:"text/plain;charset=utf-8"}));
$("#txt-copy").onclick = async () => {
  try { await navigator.clipboard.writeText($("#txt-out").value); toast("Teks disalin"); }
  catch(e){ $("#txt-out").select(); document.execCommand && document.execCommand("copy"); toast("Teks disalin"); }
};

/* ================= PDF KE WORD / EXCEL ================= */
const PO = { file:null, pdf:null, io:null, kind:"word" };
const getPoSheet = segSetup("p2o-sheet");
const getPoOcr = segSetup("p2o-ocr");
J.ROUTE_HOOKS.push(tool => {
  if(!tool || !tool.p2o) return;
  PO.kind = tool.p2o;
  const word = PO.kind === "word";
  $("#p2o-title").textContent = tool.title; $("#p2o-ic").innerHTML = tool.icon;
  $("#p2o-desc").textContent = word ? "Ubah PDF jadi dokumen Word (.docx) yang teksnya bisa diedit." : "Ubah tabel di PDF jadi spreadsheet Excel (.xlsx). Angka otomatis jadi angka.";
  $("#opt-p2o-sheet").style.display = word ? "none" : "";
  $("#go-p2o").textContent = word ? "Ubah ke Word" : "Ubah ke Excel";
  $("#p2o-note").textContent = word
    ? "Teks, ukuran huruf, tebal, dan paragraf ikut. Gambar dan tata letak kolom yang rumit belum ikut."
    : "Kolom dibaca dari jarak antar teks. Paling cocok untuk tabel rapi; tabel tanpa garis yang berantakan mungkin perlu dirapikan.";
});
handlers.p2o = async (fs) => {
  const f = fs.find(isPdf); if(!f){ toast("Pilih file PDF"); return; }
  if(!(await sizeOk(f.size))) return;
  try{
    showProgress("Membuka PDF");
    const pdf = await openPdf(f);
    if(PO.pdf) PO.pdf.destroy(); if(PO.io) PO.io.disconnect();
    Object.assign(PO, {file:f, pdf});
    $("#title-p2o").textContent = `${f.name} · ${pdf.numPages} hal`;
    showWork("p2o", true);
    PO.io = buildPageGrid($("#pages-p2o"), pdf, {selectable:false});
    syncPo(); await loadDone();
  }catch(e){ showError(e.message); }
};
function syncPo(){
  const r = PO.pdf ? pagesFromField($("#p2o-pages").value, PO.pdf.numPages) : {pages:[]};
  const h = $("#hint-p2o"); h.classList.toggle("err", !!r.error);
  h.textContent = r.error || (PO.pdf ? `${r.pages.length} halaman akan diubah` : "");
  $("#go-p2o").disabled = !PO.file || !!r.error;
}
$("#p2o-pages").addEventListener("input", syncPo);
const xmlEsc = s => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
async function collectPages(pages, mode){
  const out = [];
  for(let k = 0; k < pages.length; k++){
    const n = pages[k], base = .05 + .8*k/pages.length, span = .8/pages.length;
    progress(base, `Membaca halaman ${n}…`); await tick();
    const pg = await pageItems(PO.pdf, n, mode, (fr, msg) => progress(base + span*fr, msg || `Halaman ${n} (OCR) · ${Math.round(fr*100)}%`));
    out.push({ n, ...pg, lines: toLines(pg.items) });
  }
  return out;
}
/* --- Word (.docx) --- */
function paragraphs(pg){
  const ls = pg.lines; if(!ls.length) return [];
  const left = Math.min(...ls.map(l => l.x));
  const paras = []; let p = null, prev = null;
  for(const l of ls){
    const centered = Math.abs((l.x + l.x2)/2 - pg.W/2) < pg.W*0.04 && (l.x2 - l.x) < pg.W*0.7 && l.x - left > pg.W*0.08;
    const cont = p && prev && !centered && !p.centered && Math.abs(l.size - p.size) < p.size*0.18 && l.bold === p.bold
      && (l.y - prev.y) < Math.max(l.size, prev.size) * 1.65 && Math.abs(l.x - p.x) < Math.max(p.size*2, 14) && (prev.x2 - p.x) > pg.W*0.45;
    if(cont){
      p.text = /-$/.test(p.text) && /^[a-z]/.test(l.text) ? p.text.slice(0, -1) + l.text : p.text + " " + l.text;
      p.lastY = l.y;
    } else {
      if(p) p.after = Math.max(0, l.y - prev.y - Math.max(l.size, prev.size)*1.25);
      p = { text:l.text, size:l.size, bold:l.bold, x:l.x, indent:Math.max(0, l.x - left), centered, lastY:l.y, after:0 };
      paras.push(p);
    }
    prev = l;
  }
  return paras;
}
function docxBlob(pagesData){
  const first = pagesData[0] || {W:595, H:842, lines:[]};
  const allLines = pagesData.flatMap(p => p.lines);
  const sizes = allLines.map(l => l.size).sort((a, b) => a - b);
  const body = sizes.length ? sizes[Math.floor(sizes.length/2)] : 11;
  const lefts = pagesData.filter(p => p.lines.length).map(p => Math.min(...p.lines.map(l => l.x)));
  const marginL = Math.round(Math.min(Math.max(lefts.length ? Math.min(...lefts) : 72, 28), 90) * 20);
  let xml = "";
  pagesData.forEach((pg, i) => {
    if(i > 0) xml += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    for(const p of paragraphs(pg)){
      const sz = Math.max(12, Math.min(96, Math.round(p.size * 2 * (11 / Math.max(8, body)) * (body < 8 ? 1 : 1))));
      const ppr = `<w:pPr>${p.centered ? '<w:jc w:val="center"/>' : ""}<w:spacing w:before="0" w:after="${Math.round(Math.min(p.after, 40) * 20) || 60}"/>${!p.centered && p.indent > 8 ? `<w:ind w:left="${Math.round(p.indent*20)}"/>` : ""}</w:pPr>`;
      xml += `<w:p>${ppr}<w:r><w:rPr>${p.bold ? "<w:b/>" : ""}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${xmlEsc(p.text)}</w:t></w:r></w:p>`;
    }
  });
  const pgW = Math.round(first.W * 20), pgH = Math.round(first.H * 20);
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${xml || "<w:p/>"}<w:sectPr><w:pgSz w:w="${pgW}" w:h="${pgH}"${first.W > first.H ? ' w:orient="landscape"' : ""}/><w:pgMar w:top="${marginL}" w:right="${marginL}" w:bottom="${marginL}" w:left="${marginL}" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="id-ID"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;
  const z = new JSZip();
  z.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>');
  z.file("_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  z.file("word/_rels/document.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  z.file("word/document.xml", doc); z.file("word/styles.xml", styles);
  return z.generateAsync({type:"blob", mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document", compression:"DEFLATE"});
}
/* --- Excel (.xlsx) --- */
function parseNum(s){
  const t = s.replace(/\s/g, "").replace(/^Rp\.?/i, "");
  if(!/^[-+(]?\d[\d.,]*%?\)?$/.test(t)) return null;
  let neg = /^\(.*\)$/.test(t) || t[0] === "-", pct = /%\)?$/.test(t);
  let u = t.replace(/[()%+-]/g, "");
  const dots = (u.match(/\./g) || []).length, commas = (u.match(/,/g) || []).length;
  if(dots && commas){ const dec = u.lastIndexOf(",") > u.lastIndexOf(".") ? "," : "."; u = dec === "," ? u.replace(/\./g, "").replace(",", ".") : u.replace(/,/g, ""); }
  else if(dots > 1) u = u.replace(/\./g, "");
  else if(commas > 1) u = u.replace(/,/g, "");
  else if(dots === 1){ if(/^\d{1,3}\.\d{3}$/.test(u)) u = u.replace(".", ""); }
  else if(commas === 1){ u = /^\d{1,3},\d{3}$/.test(u) ? u.replace(",", "") : u.replace(",", "."); }
  if(/^0\d/.test(u) && !/^0\./.test(u)) return null; // nomor telepon / kode
  const v = Number(u); if(!isFinite(v)) return null;
  return (neg ? -v : v) / (pct ? 100 : 1);
}
function pageTable(pg){
  const lines = pg.lines;
  // kolom dari baris yang punya ≥2 sel: gabungkan rentang yang saling tumpang tindih
  let spans = [];
  for(const l of lines) if(l.cells.length >= 2) for(const c of l.cells) spans.push([c.x, c.x2]);
  spans.sort((a, b) => a[0] - b[0]);
  const cols = [];
  for(const s of spans){ const last = cols[cols.length-1]; if(last && s[0] <= last[1] + 2) last[1] = Math.max(last[1], s[1]); else cols.push([s[0], s[1]]); }
  const colOf = c => {
    if(!cols.length) return 0;
    let best = 0, bestOv = -Infinity;
    cols.forEach((k, i) => { const ov = Math.min(k[1], c.x2) - Math.max(k[0], c.x); const score = ov > 0 ? ov : -Math.abs(c.x - k[0]); if(score > bestOv){ bestOv = score; best = i; } });
    return best;
  };
  const rows = []; let prev = null;
  for(const l of lines){
    if(prev && l.y - prev.y > Math.max(prev.size, l.size) * 2.2) rows.push(null);
    const row = [];
    if(l.cells.length < 2 && cols.length) row[0] = l.text;
    else for(const c of l.cells){ const i = colOf(c); row[i] = row[i] ? row[i] + " " + c.text : c.text; }
    rows.push({ cells: row, bold: l.bold });
    prev = l;
  }
  return rows;
}
async function xlsxBlob(pagesData, perPage){
  await loadScript("lib/office/exceljs.min.js");
  const wb = new ExcelJS.Workbook(); wb.creator = "JagoPDF";
  let ws = null;
  const widths = {};
  const finish = sheet => { Object.entries(widths[sheet.name] || {}).forEach(([i, w]) => { sheet.getColumn(+i + 1).width = Math.min(60, Math.max(8, w + 2)); }); };
  pagesData.forEach((pg, k) => {
    if(perPage || !ws){ if(ws) finish(ws); ws = wb.addWorksheet(perPage ? `Halaman ${pg.n}` : "Data"); widths[ws.name] = {}; }
    else ws.addRow([]);
    for(const r of pageTable(pg)){
      if(!r){ ws.addRow([]); continue; }
      const vals = [];
      for(let i = 0; i < r.cells.length; i++){
        const t = r.cells[i]; if(t === undefined){ vals[i] = null; continue; }
        const num = parseNum(t); vals[i] = num !== null ? num : t;
        widths[ws.name][i] = Math.max(widths[ws.name][i] || 0, String(t).length);
      }
      const row = ws.addRow(vals);
      if(r.bold) row.font = { bold:true };
    }
  });
  if(ws) finish(ws);
  if(!wb.worksheets.length) wb.addWorksheet("Data");
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
}
$("#go-p2o").onclick = async () => {
  const { pages } = pagesFromField($("#p2o-pages").value, PO.pdf.numPages);
  const word = PO.kind === "word";
  showProgress(word ? "Mengubah ke Word…" : "Mengubah ke Excel…");
  try{
    const data = await collectPages(pages, getPoOcr());
    const words = data.reduce((a, p) => a + p.lines.length, 0);
    if(!words) throw new Error("Tidak ada teks yang terbaca di PDF ini. Kalau ini hasil scan, coba pilih OCR: Semua.");
    progress(.9, "Menyusun file…"); await tick();
    const blob = word ? await docxBlob(data) : await xlsxBlob(data, getPoSheet() === "per");
    const ocrN = data.filter(p => p.ocr).length;
    showResult({title: word ? "PDF berhasil diubah ke Word" : "PDF berhasil diubah ke Excel", name:`${baseName(PO.file.name)}.${word ? "docx" : "xlsx"}`, blob,
      extra: ocrN ? `<p class="muted" style="margin:6px 0 0;font-size:13px">${ocrN} halaman dibaca dengan OCR. Periksa lagi hasilnya.</p>` : ""});
  }catch(e){ showError(e.message || "Gagal mengubah file."); }
};

J.loadScript = loadScript; J.loadCss = loadCss; J.swatches = swatches; J.hexRgb = hexRgb; J.safeText = safeText; J.readBytes = readBytes; J.abs = abs;
})();
