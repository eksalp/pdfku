(function(){
"use strict";
const { PDFDocument } = PDFLib;
if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = "lib/pdf.worker.min.js";

const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const ICON = {
  merge:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7.5" height="9.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="9.5" rx="1.5"/><path d="M6.75 12.5v1.5a3 3 0 0 0 3 3h4.5a3 3 0 0 0 3-3v-1.5"/><path d="M12 17v4"/><path d="M9.5 18.5 12 21l2.5-2.5"/></svg>',
  split:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 4.5H6A1.5 1.5 0 0 0 4.5 6v12A1.5 1.5 0 0 0 6 19.5h3.5"/><path d="M14.5 4.5H18A1.5 1.5 0 0 1 19.5 6v12a1.5 1.5 0 0 1-1.5 1.5h-3.5"/><path d="M12 2.5v19" stroke-dasharray="2 2.6"/></svg>',
  img:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="m21 15.5-4.5-4.5L7 20.5"/></svg>',
  jpg:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><circle cx="10" cy="12.5" r="1.4"/><path d="m19 18-4-4-6.5 6.5"/></svg>',
  zip:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9.5 9.5 12 12l2.5-2.5"/><path d="M9.5 18.5 12 16l2.5 2.5"/></svg>',
  up:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m15 18-6-6 6-6"/></svg>',
  down:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m9 18 6-6-6-6"/></svg>',
  x:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  ok:'<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
};
ICON.doc = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>';
ICON.sheet = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>';
ICON.rotate = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="10" height="12.5" rx="1.5"/><path d="M4 12a8 8 0 0 1 12.5-6.6"/><path d="M17 2.5v3.6h-3.6"/></svg>';
ICON.rotL = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v6h6"/><path d="M3.5 9A9 9 0 1 1 6 18"/></svg>';
ICON.rotR = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3v6h-6"/><path d="M20.5 9A9 9 0 1 0 18 18"/></svg>';
ICON.slide = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M12 17v4M8 21h8"/></svg>';
// where: "local" = di perangkat, "server" = di server, "both" = pengguna memilih
const TOOLS = [
  {id:"gabung", tone:"merge", sig:"PDF ×n → PDF", title:"Gabung PDF", desc:"Satukan beberapa PDF jadi satu, urutan bebas.", icon:ICON.merge, color:"var(--c-merge)", where:"local"},
  {id:"pisah", tone:"split", sig:"PDF → PDF ×n", title:"Pisah PDF", desc:"Ambil halaman tertentu atau pecah jadi beberapa file.", icon:ICON.split, color:"var(--c-split)", where:"local"},
  {id:"kompres", tone:"compress", sig:"PDF → PDF lebih kecil", title:"Kompres PDF", desc:"Perkecil ukuran file, teks tetap bisa dicopy.", icon:ICON.zip, color:"var(--c-zip)", where:"local"},
  {id:"word-ke-pdf", tone:"word", sig:"DOC · DOCX → PDF", title:"Word ke PDF", desc:"Ubah DOC/DOCX jadi PDF, tata letak tetap rapi.", icon:ICON.doc, color:"#2b579a", where:"server",
    office:{accept:[".doc",".docx",".odt",".rtf"], pick:"Pilih file Word", label:"DOC", lead:"Ubah dokumen Word jadi PDF. Tata letak, tabel, dan gambar tetap rapi."}},
  {id:"excel-ke-pdf", tone:"excel", sig:"XLS · XLSX → PDF", title:"Excel ke PDF", desc:"Ubah XLS/XLSX jadi PDF yang siap dikirim.", icon:ICON.sheet, color:"#217346", where:"server",
    office:{accept:[".xls",".xlsx",".ods",".csv"], pick:"Pilih file Excel", label:"XLS", lead:"Ubah spreadsheet Excel jadi PDF. Rumus ikut dihitung, semua sheet ikut diubah."}},
  {id:"ppt-ke-pdf", tone:"ppt", sig:"PPT · PPTX → PDF", title:"PowerPoint ke PDF", desc:"Ubah PPT/PPTX jadi PDF untuk dibagikan.", icon:ICON.slide, color:"#c43e1c", where:"server",
    office:{accept:[".ppt",".pptx",".odp"], pick:"Pilih file PowerPoint", label:"PPT", lead:"Ubah presentasi PowerPoint jadi PDF, satu slide per halaman."}},
  {id:"gambar-ke-pdf", tone:"img", sig:"JPG · PNG · WEBP → PDF", title:"Gambar ke PDF", desc:"Ubah JPG, PNG, WEBP jadi satu PDF.", icon:ICON.img, color:"var(--c-img)", where:"local"},
  {id:"pdf-ke-jpg", tone:"jpg", sig:"PDF → JPG", title:"PDF ke JPG", desc:"Ubah setiap halaman PDF jadi gambar.", icon:ICON.jpg, color:"var(--c-jpg)", where:"local"},
];
const ARROW = '<svg class="go-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

/* ---------- settings ---------- */
const CONTACT_EMAIL = ""; // isi email kontak privasi, mis. "halo@domainmu.com"
const SOURCE_URL = "";    // link repo GitHub PDFku (disarankan, karena Ghostscript berlisensi AGPL)
// Alamat API server PDFku (untuk Word/Excel/PowerPoint ke PDF).
//   ""      = tanpa server: alat ☁️ disembunyikan, semua alat berjalan di perangkat (Cloudflare Pages)
//   "/api"  = server di domain yang sama (paket VPS)
//   "https://api.domainmu.com/api" = server di domain lain
const API_BASE = "";

// tanpa server, alat ☁️ tidak ditampilkan sama sekali
const ACTIVE = TOOLS.filter(t => API_BASE || t.where !== "server");

/* ---------- shell ---------- */
$("#toolgrid").innerHTML = ACTIVE.map(t => `<a class="tool-card" href="#${t.id}" data-tone="${t.tone}"><div class="ic">${t.icon}</div><h3>${t.title}${t.where==="server" ? ' <span class="mk mk-srv">server</span>' : ""}</h3><p>${t.desc}</p><span class="sig">${t.sig}</span>${ARROW}</a>`).join("");
$("#topnav").innerHTML = ACTIVE.map(t => `<a href="#${t.id}" data-id="${t.id}">${t.title}</a>`).join("");

function route(){
  const id = (location.hash || "").slice(1);
  const tool = ACTIVE.find(t => t.id === id);
  const known = !!tool || id === "privasi";
  const viewId = !known ? "v-home" : (tool && tool.office ? "v-office" : "v-"+id);
  if(tool && tool.office && typeof setOfficeTool === "function") setOfficeTool(tool);
  $$(".view").forEach(v => v.classList.toggle("on", v.id === viewId));
  $$("#topnav a").forEach(a => a.classList.toggle("on", a.dataset.id === id));
  window.scrollTo(0,0);
  if (typeof hideOv === 'function') hideOv();
}
// logo alat di judul halaman alatnya
TOOLS.forEach(t => {
  const head = t.office ? null : $(`#v-${t.id} .view-head > div`);
  if(!head) return;
  const wrap = document.createElement("div"); wrap.className = "vh";
  wrap.innerHTML = `<span class="ic" data-tone="${t.tone}">${t.icon}</span>`;
  head.parentNode.insertBefore(wrap, head); wrap.appendChild(head);
});
window.addEventListener("hashchange", route);
document.body.classList.toggle("no-server", !API_BASE);
if(SOURCE_URL){ const l=$("#source-link"); l.textContent=SOURCE_URL; l.href=SOURCE_URL; $("#source-line").style.display=""; }
if(CONTACT_EMAIL){ const m=$("#contact-mail"); m.textContent=CONTACT_EMAIL; m.href="mailto:"+CONTACT_EMAIL; $("#contact-line").style.display=""; }

let toastT;
function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),3200); }

const ov = $("#ov"), ovBox = $("#ov-box");
function showProgress(title){ ovBox.innerHTML = `<h3>${title}</h3><p class="muted" id="ov-msg">Menyiapkan…</p><div class="bar"><i id="ov-bar"></i></div>`; ov.classList.add("on"); }
function progress(frac, msg){ const b=$("#ov-bar"); if(b) b.style.width = Math.round(Math.max(0,Math.min(1,frac))*100)+"%"; if(msg){ const m=$("#ov-msg"); if(m) m.textContent=msg; } }
const tick = () => new Promise(r => setTimeout(r, 0));
function hideOv(){ document.getElementById("ov").classList.remove("on"); }
function showResult({title, name, blob, extra=""}){
  ovBox.innerHTML = `<div class="result-ic">${ICON.ok}</div><h3>${title}</h3><p class="fname">${esc(name)}</p><p class="muted" style="margin:2px 0 0">${fmtSize(blob.size)}</p>${extra}
  <div class="ov-actions"><button class="go" id="ov-dl">Unduh file</button><button class="ghost" id="ov-close">Kembali ke pengaturan</button><a class="ghost" href="#" id="ov-home" style="text-decoration:none">Alat lain</a></div>`;
  ov.classList.add("on");
  $("#ov-dl").onclick = () => saveFile(name, blob);
  $("#ov-close").onclick = hideOv;
  $("#ov-home").onclick = hideOv;
}
function showError(msg){
  ovBox.innerHTML = `<h3>Ada masalah</h3><p class="muted">${esc(msg)}</p><div class="ov-actions"><button class="go" id="ov-close">Oke</button></div>`;
  ov.classList.add("on"); $("#ov-close").onclick = hideOv;
}

/* big-file guard: everything runs in the visitor's RAM, so warn before it can crash a phone tab */
const MB = 1048576;
function deviceLimit(){
  const mobile = (window.matchMedia && matchMedia("(pointer:coarse)").matches) || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const ram = navigator.deviceMemory || 0; // GB, Chromium only (capped at 8)
  if(mobile) return { mb: ram && ram <= 3 ? 60 : 150, mobile:true };
  return { mb: ram && ram <= 4 ? 250 : 500, mobile:false };
}
function sizeOk(bytes){
  const lim = deviceLimit();
  if(bytes <= lim.mb*MB) return Promise.resolve(true);
  return new Promise(resolve => {
    ovBox.innerHTML = `<h3>File cukup besar (${fmtSize(bytes)})</h3>
      <p class="muted">Semua proses terjadi di ${lim.mobile ? "HP" : "komputer"} kamu, jadi file sebesar ini butuh banyak memori. ${lim.mobile ? "Di HP, tab browser bisa tertutup sendiri di tengah proses. Untuk hasil paling lancar, pakai laptop atau komputer." : "Tutup tab lain dulu supaya proses lebih lancar."}</p>
      <div class="ov-actions"><button class="go" id="sz-go">Tetap lanjutkan</button><button class="ghost" id="sz-no">Batal</button></div>`;
    ov.classList.add("on");
    $("#sz-go").onclick = () => { hideOv(); resolve(true); };
    $("#sz-no").onclick = () => { hideOv(); resolve(false); };
  });
}

/* ---------- utils ---------- */
function esc(s){ return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function fmtSize(b){ if(b<1024) return b+" B"; if(b<1048576) return (b/1024).toFixed(1).replace(".",",")+" KB"; return (b/1048576).toFixed(2).replace(".",",")+" MB"; }
function baseName(n){ return n.replace(/\.[^.]+$/, "") || "file"; }
function isPdf(f){ return f.type==="application/pdf" || /\.pdf$/i.test(f.name); }
function isImg(f){ return /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name); }
let uid = 0;

function parseRanges(str, max){
  const out = []; const s = (str||"").trim();
  if(!s) return {ranges:[], error:null};
  for(const partRaw of s.split(/[,;]+/)){
    const part = partRaw.trim(); if(!part) continue;
    const m = part.match(/^(\d+)\s*(?:[-–]\s*(\d*))?$/);
    if(!m) return {ranges:[], error:`"${part}" tidak bisa dibaca. Pakai format seperti 1-3, 5`};
    const a = +m[1]; const b = m[2]===undefined ? a : (m[2]==="" ? max : +m[2]);
    if(a<1 || b<1 || a>max || b>max) return {ranges:[], error:`Halaman ${part} di luar jangkauan (1–${max})`};
    if(a>b) return {ranges:[], error:`Rentang ${part} terbalik`};
    out.push([a,b]);
  }
  return {ranges:out, error:null};
}
function pagesFromRanges(ranges){ const set=new Set(); ranges.forEach(([a,b])=>{for(let i=a;i<=b;i++) set.add(i);}); return [...set].sort((x,y)=>x-y); }
function rangesString(pages){
  const p=[...pages].sort((a,b)=>a-b); const parts=[]; let i=0;
  while(i<p.length){ let j=i; while(j+1<p.length && p[j+1]===p[j]+1) j++; parts.push(p[i]===p[j] ? `${p[i]}` : `${p[i]}-${p[j]}`); i=j+1; }
  return parts.join(", ");
}

async function loadPdfLib(bytes){
  try { return await PDFDocument.load(bytes, {ignoreEncryption:true}); }
  catch(e){ throw new Error("File PDF tidak bisa dibaca. Mungkin rusak atau terkunci kata sandi."); }
}
// NOTE: pdf.js takes ownership of `bytes` (the buffer is transferred). Never reuse them afterwards.
async function loadPdfJs(bytes){
  try { return await pdfjsLib.getDocument({data: bytes, isEvalSupported:false}).promise; }
  catch(e){ if(e && e.name==="PasswordException") throw new Error("PDF ini dilindungi kata sandi. Buka kuncinya dulu, lalu coba lagi."); throw new Error("File PDF tidak bisa dibaca. Mungkin rusak."); }
}
async function renderPage(pdf, n, {width, scale, rotate}){
  const page = await pdf.getPage(n);
  const rot = norm((page.rotate||0) + (rotate||0));
  const vp1 = page.getViewport({scale:1, rotation:rot});
  const s = scale || (width / vp1.width);
  const vp = page.getViewport({scale:s, rotation:rot});
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.floor(vp.width)); c.height = Math.max(1, Math.floor(vp.height));
  const ctx = c.getContext("2d"); ctx.fillStyle="#fff"; ctx.fillRect(0,0,c.width,c.height);
  await page.render({canvasContext:ctx, viewport:vp}).promise;
  page.cleanup();
  return {canvas:c, w:vp1.width, h:vp1.height};
}
const canvasBlob = (c, type, q) => new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error("Gagal membuat gambar")), type, q));

/* ---------- putar (dipakai semua alat) ---------- */
// Setiap kartu menyimpan putaran tambahan (kelipatan 90°). Thumbnail diputar dengan CSS;
// putaran sebenarnya baru diterapkan ke file saat diproses.
const norm = d => ((d % 360) + 360) % 360;
const ROTBTN = `<button type="button" class="rotbtn" data-rotate title="Putar 90° ke kanan" aria-label="Putar 90° ke kanan">${ICON.rotR}</button><span class="rdeg"></span>`;
function fitMedia(m){
  const w = m.naturalWidth || m.width, h = m.naturalHeight || m.height;
  m.classList.add("rmedia");
  if(h >= w){ m.style.height = "100%"; m.style.width = "auto"; } else { m.style.width = "100%"; m.style.height = "auto"; }
}
function paintRotEl(el, deg){
  if(!el) return;
  const m = el.querySelector(".rmedia"); if(m) m.style.transform = `translate(-50%,-50%) rotate(${deg||0}deg)`;
  const b = el.querySelector(".rdeg"); if(b) b.textContent = norm(deg||0) ? `${norm(deg)}°` : "";
}
const rotatePage = (p, extra) => { const r = norm(extra||0); if(r) p.setRotation(PDFLib.degrees(norm(p.getRotation().angle + r))); };
const ROTALL = {};
document.addEventListener("click", e => { const b = e.target.closest("[data-rotall]"); if(b && ROTALL[b.dataset.rotall]) ROTALL[b.dataset.rotall](+b.dataset.d); });

/* lazy page thumbnails */
function buildPageGrid(container, pdf, {selectable, onToggle, rot}){
  container.innerHTML = "";
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if(!en.isIntersecting) return;
      const el = en.target; io.unobserve(el);
      const n = +el.dataset.n;
      renderPage(pdf, n, {width: 150*Math.min(2, window.devicePixelRatio||1)}).then(({canvas}) => { const t=$(".thumb", el); t.innerHTML=""; fitMedia(canvas); t.appendChild(canvas); if(rot) paintRotEl(el, rot.get(n)); }).catch(()=>{});
    });
  }, {root: container, rootMargin:"200px"});
  for(let n=1; n<=pdf.numPages; n++){
    const el = document.createElement("div");
    el.className = "pg"; el.dataset.n = n;
    el.innerHTML = `<div class="tw"><div class="thumb"></div>${rot ? ROTBTN : ""}</div><span>${n}</span>`;
    el.onclick = (e) => {
      if(rot && e.target.closest("[data-rotate]")){ rot.set(n, rot.get(n) + 90); paintRotEl(el, rot.get(n)); return; }
      if(selectable) onToggle(n, el);
    };
    container.appendChild(el); io.observe(el);
  }
  return io;
}
const repaintCards = (listEl, arr) => $$(".fitem", listEl).forEach(el => { const it = arr.find(x => x.id == el.dataset.id); if(it) paintRotEl(el, it.rot); });
const repaintGrid = (container, get) => $$(".pg", container).forEach(el => paintRotEl(el, get(+el.dataset.n)));

/* downloads: Claude artifact capability, else normal browser download */
async function saveFile(name, blob){
  try{
    if(window.claude && typeof window.claude.use === "function"){
      const ns = await window.claude.use("downloads");
      if(ns){
        try { await ns.save({filename:name, data:blob}); toast("File tersimpan"); }
        catch(e){ const c=e&&e.code; toast(c==="declined" ? "Unduhan dibatalkan" : c==="rate_limited" ? "Tunggu sebentar lalu coba lagi" : "Unduhan tidak tersedia di tampilan ini"); }
        return;
      }
    }
  }catch(e){}
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 60000);
}
const pdfBlob = bytes => new Blob([bytes], {type:"application/pdf"});

/* drop zones + pickers */
const handlers = {};
$$("[data-pick]").forEach(b => b.addEventListener("click", e => { e.preventDefault(); $("#in-"+b.dataset.pick).click(); }));
["gabung","pisah","img","jpg","zip","office","home"].forEach(k => {
  const input = $("#in-"+k);
  input.addEventListener("change", () => { const fs=[...input.files]; input.value=""; if(fs.length) handlers[k](fs); });
});
$$("[data-drop]").forEach(z => {
  const k = z.dataset.drop;
  z.addEventListener("dragover", e => { e.preventDefault(); z.classList.add("over"); });
  z.addEventListener("dragleave", () => z.classList.remove("over"));
  z.addEventListener("drop", e => { e.preventDefault(); z.classList.remove("over"); const fs=[...e.dataTransfer.files]; if(fs.length) handlers[k](fs); });
});
// allow dropping files onto the work area too
[["w-gabung","gabung"],["w-img","img"],["w-pisah","pisah"],["w-jpg","jpg"],["w-zip","zip"],["w-office","office"]].forEach(([id,k]) => {
  const el = $("#"+id);
  el.addEventListener("dragover", e => { if(e.dataTransfer.types.includes("Files")) e.preventDefault(); });
  el.addEventListener("drop", e => { if(e.dataTransfer.files.length){ e.preventDefault(); handlers[k]([...e.dataTransfer.files]); } });
});
function segSetup(id, onChange){
  const root = $("#"+id);
  root.addEventListener("click", e => { const b=e.target.closest("button"); if(!b) return; $$("button",root).forEach(x=>x.classList.toggle("on", x===b)); onChange && onChange(b.dataset.v); });
  return () => $("button.on", root).dataset.v;
}
function showWork(k, on){ $(`[data-drop="${k}"]`).style.display = on ? "none" : ""; $("#w-"+k).classList.toggle("on", on); }

/* sortable file list */
function makeSortable(listEl, getArr, rerender){
  let dragId = null;
  listEl.addEventListener("dragstart", e => { const it=e.target.closest(".fitem"); if(!it) return; dragId=it.dataset.id; it.classList.add("dragging"); e.dataTransfer.effectAllowed="move"; e.dataTransfer.setData("text/plain", dragId); });
  listEl.addEventListener("dragend", e => { $$(".fitem",listEl).forEach(x=>x.classList.remove("dragging","drop-target")); dragId=null; });
  listEl.addEventListener("dragover", e => { if(!dragId) return; e.preventDefault(); const it=e.target.closest(".fitem"); $$(".fitem",listEl).forEach(x=>x.classList.toggle("drop-target", x===it && x.dataset.id!==dragId)); });
  listEl.addEventListener("drop", e => {
    if(!dragId) return; e.preventDefault(); e.stopPropagation();
    const it=e.target.closest(".fitem"); if(!it || it.dataset.id===dragId) return;
    const arr=getArr(); const from=arr.findIndex(x=>x.id==dragId); const to=arr.findIndex(x=>x.id==it.dataset.id);
    const [m]=arr.splice(from,1); arr.splice(to,0,m); rerender();
  });
  listEl.addEventListener("click", e => {
    const rb = e.target.closest("[data-rotate]");
    if(rb){ const el = rb.closest(".fitem"); const it = getArr().find(x => x.id == el.dataset.id); it.rot = (it.rot||0) + 90; paintRotEl(el, it.rot); return; }
    const b=e.target.closest("button[data-act]"); if(!b) return;
    const arr=getArr(); const id=b.closest(".fitem").dataset.id; const i=arr.findIndex(x=>x.id==id);
    if(b.dataset.act==="del") arr.splice(i,1);
    if(b.dataset.act==="up" && i>0) [arr[i-1],arr[i]]=[arr[i],arr[i-1]];
    if(b.dataset.act==="down" && i<arr.length-1) [arr[i+1],arr[i]]=[arr[i],arr[i+1]];
    rerender();
  });
}
function fitemHTML(item, i, meta){
  return `<div class="fitem" draggable="true" data-id="${item.id}"><span class="idx">${i+1}</span>
    <div class="acts"><button data-act="up" title="Geser kiri">${ICON.up}</button><button data-act="down" title="Geser kanan">${ICON.down}</button><button data-act="del" title="Hapus">${ICON.x}</button></div>
    <div class="tw"><div class="thumb" data-thumb="${item.id}"></div>${ROTBTN}</div><div class="nm" title="${esc(item.name)}">${esc(item.name)}</div><div class="meta">${meta}</div></div>`;
}

/* ---------- server (fitur ☁️) ---------- */
const SERVER = { ok:false, maxMb:100, checked:false };
async function checkServer(){
  if(API_BASE){
    try{
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 7000);
      const r = await fetch(API_BASE + "/health", {signal:ctl.signal, cache:"no-store"}); clearTimeout(t);
      if(r.ok){ const j = await r.json(); SERVER.ok = !!j.ok; SERVER.maxMb = j.max_mb || 100; }
    }catch(e){ SERVER.ok = false; }
  }
  SERVER.checked = true; applyServerState();
}
function applyServerState(){
  document.body.classList.toggle("server-down", !SERVER.ok);
  renderO();
}
/* upload → process → download, with real progress for both transfers */
function serverPost(path, form, onStage){
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("POST", API_BASE + path); x.responseType = "blob"; x.timeout = 15*60*1000;
    x.upload.onprogress = e => { if(e.lengthComputable) onStage("up", e.loaded/e.total); };
    x.upload.onload = () => onStage("proc", 0);
    x.onprogress = e => { if(e.lengthComputable && e.total) onStage("down", e.loaded/e.total); };
    x.onload = async () => {
      if(x.status >= 200 && x.status < 300){
        resolve({ blob: new Blob([x.response], {type:"application/pdf"}), notSmaller: x.getResponseHeader("X-Not-Smaller")==="1" });
      } else {
        let msg = x.status===413 ? `File terlalu besar. Maksimal ${SERVER.maxMb} MB.` : x.status===429 ? "Terlalu banyak permintaan. Tunggu beberapa menit lalu coba lagi." : "Server sedang bermasalah. Coba lagi sebentar lagi.";
        try{ const j = JSON.parse(await x.response.text()); if(j.error) msg = j.error; }catch(e){}
        reject(new Error(msg));
      }
    };
    x.onerror = () => reject(new Error("Tidak bisa terhubung ke server. Periksa koneksi internetmu lalu coba lagi."));
    x.ontimeout = () => reject(new Error("Server terlalu lama merespons. Coba lagi nanti."));
    x.send(form);
  });
}
function stageText(stage, frac, label){
  if(stage==="up") return `Mengunggah${label?" "+label:""}… ${Math.round(frac*100)}%`;
  if(stage==="proc") return `Memproses di server${label?" ("+label+")":""}…`;
  return `Mengunduh hasil… ${Math.round(frac*100)}%`;
}
function stageFrac(stage, frac){ return stage==="up" ? frac*0.5 : stage==="proc" ? 0.6 : 0.6 + frac*0.4; }
function serverTooBig(bytes){
  if(bytes <= SERVER.maxMb*MB) return false;
  showError(`File ${fmtSize(bytes)} melebihi batas server (${SERVER.maxMb} MB). `);
  return true;
}

/* ================= OFFICE KE PDF ================= */
const O = { tool:null, files:[] };
function setOfficeTool(tool){
  if(O.tool !== tool){ O.files = []; }
  O.tool = tool;
  $("#office-title").textContent = tool.title;
  const oic = $("#office-ic"); oic.dataset.tone = tool.tone; oic.innerHTML = tool.icon;
  $("#office-desc").textContent = tool.office.lead;
  $("#office-pick").textContent = tool.office.pick;
  $("#in-office").accept = tool.office.accept.join(",");
  renderO();
}
const extOf = n => (n.match(/\.[^.]+$/)||[""])[0].toLowerCase();
handlers.office = async (fs) => {
  const ok = fs.filter(f => O.tool.office.accept.includes(extOf(f.name)));
  if(ok.length < fs.length) toast(`Sebagian file dilewati. ${O.tool.title} menerima ${O.tool.office.accept.join(", ")}`);
  for(const f of ok){
    if(f.size > SERVER.maxMb*MB){ toast(`${f.name} melebihi batas ${SERVER.maxMb} MB`); continue; }
    O.files.push({ id:++uid, name:f.name, size:f.size, file:f, status:"", blob:null });
  }
  renderO();
};
function renderO(){
  if(!O.tool) return;
  showWork("office", O.files.length > 0);
  const col = O.tool.color, lab = O.tool.office.label;
  $("#list-office").innerHTML = O.files.map(f => `<div class="orow" data-id="${f.id}"><div class="ext" style="background:${col}">${esc(extOf(f.name).slice(1).toUpperCase()||lab)}</div>
    <div class="nm"><b title="${esc(f.name)}">${esc(f.name)}</b><span>${fmtSize(f.size)}</span></div>
    <span class="st ${f.status==="ok"?"ok":f.status&&f.status!=="ok"?"err":""}">${f.status==="ok"?"Selesai":f.status?esc(f.status):""}</span>
    <button data-del="${f.id}" title="Hapus">${ICON.x}</button></div>`).join("");
  $("#sum-office").textContent = `${O.files.length} file → ${O.files.length===1 ? "1 PDF" : O.files.length+" PDF (dalam ZIP)"}`;
  $("#go-office").disabled = O.files.length===0 || !SERVER.ok;
}
$("#list-office").addEventListener("click", e => { const b=e.target.closest("[data-del]"); if(!b) return; O.files = O.files.filter(f => f.id != b.dataset.del); renderO(); });
$("#go-office").onclick = async () => {
  showProgress(`Mengubah ke PDF…`);
  const outs = []; const n = O.files.length;
  for(let i=0;i<n;i++){
    const f = O.files[i]; const label = n>1 ? `${i+1}/${n}` : "";
    const fd = new FormData(); fd.append("file", f.file, f.name);
    try{
      const r = await serverPost("/office-to-pdf", fd, (st, fr) => progress((i + stageFrac(st, fr))/n, stageText(st, fr, label)));
      f.status = "ok"; outs.push({ name: baseName(f.name)+".pdf", blob:r.blob });
    }catch(e){
      f.status = "Gagal";
      if(n===1){ renderO(); showError(e.message); return; }
      toast(`${f.name}: ${e.message}`);
    }
  }
  renderO();
  if(!outs.length){ showError("Tidak ada file yang berhasil diubah."); return; }
  if(outs.length===1){ showResult({title:"PDF siap", name:outs[0].name, blob:outs[0].blob}); return; }
  progress(.98, "Membuat ZIP…"); await tick();
  const zip = new JSZip(); const used = new Set();
  outs.forEach(o => { let nm=o.name, k=2; while(used.has(nm)) nm = o.name.replace(/\.pdf$/, `-${k++}.pdf`); used.add(nm); zip.file(nm, o.blob); });
  const blob = await zip.generateAsync({type:"blob", compression:"STORE"});
  showResult({title:"PDF siap", name:"hasil-pdf.zip", blob, extra:`<p class="muted" style="margin:6px 0 0">${outs.length} file PDF di dalam ZIP${outs.length<n?` · ${n-outs.length} gagal`:""}</p>`});
};


/* ================= BERANDA: kotak upload ================= */
// Jatuhkan file apa pun di beranda → PDFku menawarkan alat yang cocok.
const HOME = { files: [] };
const TOOL_HANDLER = { "gabung":"gabung", "pisah":"pisah", "kompres":"zip", "pdf-ke-jpg":"jpg", "gambar-ke-pdf":"img" };
handlers.home = (fs) => {
  HOME.files = fs;
  const pdfs = fs.filter(isPdf), imgs = fs.filter(f => !isPdf(f) && isImg(f));
  const acts = [];
  if(pdfs.length >= 2) acts.push({id:"gabung", label:`Gabung ${pdfs.length} PDF jadi satu`, files:pdfs});
  if(pdfs.length === 1){
    acts.push({id:"kompres", label:"Kompres", files:pdfs});
    acts.push({id:"pisah", label:"Pisah / ambil halaman", files:pdfs});
    acts.push({id:"pdf-ke-jpg", label:"Ubah ke JPG", files:pdfs});
  }
  if(pdfs.length >= 2) acts.push({id:"kompres", label:`Kompres ${esc(pdfs[0].name)}`, files:[pdfs[0]]});
  if(imgs.length) acts.push({id:"gambar-ke-pdf", label: imgs.length===1 ? "Jadikan PDF" : `Jadikan ${imgs.length} gambar satu PDF`, files:imgs});
  const ok = new Set([...pdfs, ...imgs]);
  const rows = fs.map(f => { const ext = (f.name.match(/\.([^.]+)$/)||["",""])[1] || "?";
    return `<li class="${ok.has(f)?"":"skip"}"><span class="ext">${esc(ext.slice(0,5))}</span><span class="nm" title="${esc(f.name)}">${esc(f.name)}</span><span class="sz">${ok.has(f) ? fmtSize(f.size) : "tidak didukung"}</span></li>`; }).join("");
  $("#intake-result").innerHTML = `<div class="ir-head"><h2>${fs.length} file siap</h2><button class="ghost" id="ir-reset">Ganti file</button></div>
    <ul class="ir-files">${rows}</ul>
    ${acts.length ? `<p class="ir-q">Mau diapakan?</p><div class="ir-actions">${acts.map((a,i) => `<button class="btn ${i===0?"btn-primary":""}" data-act="${i}">${a.label}</button>`).join("")}</div>`
      : `<p class="ir-q">Belum ada file yang bisa diproses. Pilih PDF atau gambar (JPG, PNG, WEBP).</p>`}`;
  $("#intake").classList.add("has-files");
  $("#ir-reset").onclick = () => { $("#intake").classList.remove("has-files"); $("#in-home").click(); };
  $$("[data-act]", $("#intake-result")).forEach(b => b.onclick = () => {
    const a = acts[+b.dataset.act];
    location.hash = a.id;
    $("#intake").classList.remove("has-files");
    setTimeout(() => handlers[TOOL_HANDLER[a.id]](a.files), 0);
  });
};


/* ================= GABUNG ================= */
const G = { files: [], queue: Promise.resolve() };
handlers.gabung = async (fs) => {
  const pdfs = fs.filter(isPdf);
  if(pdfs.length < fs.length) toast("Sebagian file dilewati karena bukan PDF");
  if(!pdfs.length) return;
  const total = G.files.reduce((s,f)=>s+f.size,0) + pdfs.reduce((s,f)=>s+f.size,0);
  if(!(await sizeOk(total))) return;
  for(const f of pdfs){
    const item = { id: ++uid, name: f.name, size: f.size, file: f, pages: null, thumb: null, rot: 0 };
    G.files.push(item);
    // one file at a time so a batch of big PDFs never sits in memory together
    G.queue = G.queue.then(async () => {
      if(!G.files.includes(item)) return;
      let pdf;
      try{
        pdf = await loadPdfJs(new Uint8Array(await f.arrayBuffer()));
        item.pages = pdf.numPages;
        item.thumb = (await renderPage(pdf, 1, {width: 260})).canvas;
      }catch(e){ item.pages = -1; }
      finally{ if(pdf) pdf.destroy(); renderG(); }
    });
  }
  renderG();
};
function renderG(){
  showWork("gabung", G.files.length > 0);
  const list = $("#list-gabung");
  list.innerHTML = G.files.map((f,i) => fitemHTML(f, i, f.pages===-1 ? '<span style="color:#b42318">Tidak terbaca</span>' : `${f.pages ?? "…"} hal · ${fmtSize(f.size)}`)).join("");
  G.files.forEach(f => { if(f.thumb){ const t=$(`[data-thumb="${f.id}"]`, list); const c=document.createElement("canvas"); c.width=f.thumb.width; c.height=f.thumb.height; c.getContext("2d").drawImage(f.thumb,0,0); fitMedia(c); t.appendChild(c); } });
  repaintCards(list, G.files);
  const total = G.files.reduce((s,f)=>s+(f.pages>0?f.pages:0),0);
  $("#sum-gabung").textContent = `${G.files.length} file · ${total} halaman total`;
  $("#go-gabung").disabled = G.files.length < 2;
  $("#hint-gabung").textContent = G.files.length < 2 ? "Tambahkan minimal 2 file PDF." : "";
}
makeSortable($("#list-gabung"), () => G.files, renderG);
ROTALL.gabung = d => { G.files.forEach(f => f.rot = (f.rot||0) + d); repaintCards($("#list-gabung"), G.files); };
$$("[data-sort]").forEach(b => b.onclick = () => { const coll=new Intl.Collator("id",{numeric:true}); G.files.sort((a,c)=>coll.compare(a.name,c.name)); if(b.dataset.sort==="za") G.files.reverse(); renderG(); });
$("#go-gabung").onclick = async () => {
  showProgress("Menggabungkan PDF…");
  try{
    const out = await PDFDocument.create();
    for(let i=0;i<G.files.length;i++){
      const f = G.files[i]; progress(i/G.files.length, `Memproses ${f.name}`); await tick();
      const src = await loadPdfLib(new Uint8Array(await f.file.arrayBuffer())).catch(e => { throw new Error(`${f.name}: ${e.message}`); });
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach(p => { rotatePage(p, f.rot); out.addPage(p); });
    }
    progress(.95, "Menyimpan…"); await tick();
    const bytes = await out.save();
    showResult({title:"PDF berhasil digabung", name:"gabungan.pdf", blob:pdfBlob(bytes), extra:`<p class="muted" style="margin:6px 0 0">${out.getPageCount()} halaman dari ${G.files.length} file</p>`});
  }catch(e){ showError(e.message || String(e)); }
};

/* ================= PISAH ================= */
const P = { file:null, bytes:null, pdf:null, n:0, sel:new Set(), io:null };
const getMode = segSetup("mode-pisah", m => updatePisahMode(m));
handlers.pisah = async (fs) => {
  const f = fs.find(isPdf); if(!f){ toast("Pilih file PDF"); return; }
  if(!(await sizeOk(f.size))) return;
  $("#go-pisah").disabled = true; $("#title-pisah").textContent = `Membaca ${f.name}…`;
  try{
    const bytes = new Uint8Array(await f.arrayBuffer());
    const pdf = await loadPdfJs(bytes);
    if(P.pdf) P.pdf.destroy(); if(P.io) P.io.disconnect();
    Object.assign(P, {file:f, pdf, n:pdf.numPages, sel:new Set(), rot:new Array(pdf.numPages).fill(0)});
    $("#title-pisah").textContent = `${f.name} · ${pdf.numPages} halaman`;
    showWork("pisah", true);
    P.io = buildPageGrid($("#pages-pisah"), pdf, {selectable:true, rot:{get:n => P.rot[n-1], set:(n,d) => P.rot[n-1] = d}, onToggle:(n)=>{ if(getMode()!=="pilih") return; P.sel.has(n)?P.sel.delete(n):P.sel.add(n); $("#range-pisah").value = rangesString(P.sel); syncPisah(); }});
    $("#range-pisah").value = ""; updatePisahMode(getMode());
  }catch(e){ showError(e.message); if(P.file){ $("#title-pisah").textContent = `${P.file.name} · ${P.n} halaman`; syncPisah(); } }
};
function updatePisahMode(m){
  const grid = $("#pages-pisah"); grid.classList.toggle("nosel", m!=="pilih");
  $("#opt-range").style.display = m==="semua" ? "none" : "";
  $("#selbtns").style.display = m==="pilih" ? "flex" : "none";
  $("#lbl-range").textContent = m==="rentang" ? "Rentang (tiap rentang = 1 file)" : "Halaman yang diambil";
  $("#range-pisah").placeholder = m==="rentang" ? `contoh: 1-3, 4-${Math.max(4,P.n)}` : "contoh: 1-3, 5, 8-10";
  syncPisah();
}
function syncPisah(){
  const m = getMode(); const {ranges, error} = parseRanges($("#range-pisah").value, P.n);
  const hint = $("#hint-range"); hint.classList.toggle("err", !!error);
  if(m==="pilih"){ if(!error) P.sel = new Set(pagesFromRanges(ranges)); }
  $$(".pg", $("#pages-pisah")).forEach(el => el.classList.toggle("sel", m==="pilih" && P.sel.has(+el.dataset.n)));
  let ok = true;
  if(m==="pilih"){ hint.textContent = error || (P.sel.size ? `${P.sel.size} halaman dipilih → 1 file PDF` : "Klik halaman di kiri, atau ketik nomornya."); ok = !error && P.sel.size>0; }
  else if(m==="rentang"){ hint.textContent = error || (ranges.length ? `${ranges.length} file akan dibuat` : "Ketik rentang, pisahkan dengan koma."); ok = !error && ranges.length>0; }
  else { ok = P.n>0; }
  $("#go-pisah").disabled = !ok;
}
$("#range-pisah").addEventListener("input", syncPisah);
ROTALL.pisah = d => { if(!P.rot) return; P.rot = P.rot.map(x => x + d); repaintGrid($("#pages-pisah"), n => P.rot[n-1]); };
$("#sel-all").onclick = () => { P.sel = new Set(Array.from({length:P.n},(_,i)=>i+1)); $("#range-pisah").value = rangesString(P.sel); syncPisah(); };
$("#sel-none").onclick = () => { P.sel = new Set(); $("#range-pisah").value = ""; syncPisah(); };
$("#go-pisah").onclick = async () => {
  const m = getMode(); const base = baseName(P.file.name);
  showProgress("Memisah PDF…");
  try{
    const src = await loadPdfLib(new Uint8Array(await P.file.arrayBuffer()));
    const makeDoc = async (idxs) => { const d = await PDFDocument.create(); (await d.copyPages(src, idxs)).forEach((p,k) => { rotatePage(p, P.rot[idxs[k]]); d.addPage(p); }); return d.save(); };
    if(m==="pilih"){
      const pages = [...P.sel].sort((a,b)=>a-b);
      progress(.5, `Mengambil ${pages.length} halaman…`); await tick();
      const bytes = await makeDoc(pages.map(p=>p-1));
      showResult({title:"Halaman berhasil diambil", name:`${base}-hal-${rangesString(pages).replace(/, /g,"_")}.pdf`.slice(0,120), blob:pdfBlob(bytes), extra:`<p class="muted" style="margin:6px 0 0">${pages.length} halaman</p>`});
    } else {
      let groups;
      if(m==="semua") groups = Array.from({length:P.n},(_,i)=>[i+1,i+1]);
      else groups = parseRanges($("#range-pisah").value, P.n).ranges;
      const zip = new JSZip();
      for(let g=0; g<groups.length; g++){
        const [a,b] = groups[g]; progress(g/groups.length, `Membuat file ${g+1} dari ${groups.length}`); await tick();
        const idxs = []; for(let i=a;i<=b;i++) idxs.push(i-1);
        zip.file(a===b ? `${base}-hal-${a}.pdf` : `${base}-hal-${a}-${b}.pdf`, await makeDoc(idxs));
      }
      if(groups.length===1){ const only = Object.values(zip.files)[0]; const bytes = await only.async("uint8array"); showResult({title:"PDF berhasil dipisah", name:only.name, blob:pdfBlob(bytes)}); return; }
      progress(.96, "Membuat ZIP…"); await tick();
      const blob = await zip.generateAsync({type:"blob", compression:"STORE"});
      showResult({title:"PDF berhasil dipisah", name:`${base}-terpisah.zip`, blob, extra:`<p class="muted" style="margin:6px 0 0">${groups.length} file PDF di dalam ZIP</p>`});
    }
  }catch(e){ showError(e.message || String(e)); }
};

/* ================= GAMBAR KE PDF ================= */
const I = { files: [] };
const getSize = segSetup("img-size", v => { $("#opt-orient").style.display = v==="fit" ? "none" : ""; });
const getOrient = segSetup("img-orient");
const getMargin = segSetup("img-margin");
handlers.img = async (fs) => {
  const imgs = fs.filter(isImg);
  if(imgs.length < fs.length) toast("Sebagian file dilewati karena bukan gambar");
  if(!imgs.length) return;
  if(!(await sizeOk(I.files.reduce((t,f)=>t+f.size,0) + imgs.reduce((t,f)=>t+f.size,0)))) return;
  for(const f of imgs){ I.files.push({ id:++uid, name:f.name, size:f.size, file:f, url:URL.createObjectURL(f), rot:0 }); }
  renderI();
};
function renderI(){
  showWork("img", I.files.length>0);
  $("#list-img").innerHTML = I.files.map((f,i)=>fitemHTML(f,i,fmtSize(f.size))).join("");
  I.files.forEach(f => { const t=$(`[data-thumb="${f.id}"]`); const im=new Image(); im.alt=""; im.draggable=false;
    im.onload = () => { fitMedia(im); paintRotEl(t.closest(".fitem"), f.rot); }; im.src=f.url; t.appendChild(im); });
  $("#go-img").disabled = I.files.length===0;
}
makeSortable($("#list-img"), () => I.files, renderI);
ROTALL.img = d => { I.files.forEach(f => f.rot = (f.rot||0) + d); repaintCards($("#list-img"), I.files); };
function loadImage(url){ return new Promise((res,rej)=>{ const im=new Image(); im.onload=()=>res(im); im.onerror=()=>rej(new Error("Gambar tidak bisa dibaca")); im.src=url; }); }
$("#go-img").onclick = async () => {
  showProgress("Membuat PDF…");
  try{
    const doc = await PDFDocument.create();
    const sizeMode = getSize(), orient = getOrient(), margin = +getMargin();
    const SIZES = { a4:[595.28,841.89], letter:[612,792] };
    for(let i=0;i<I.files.length;i++){
      const f = I.files[i]; progress(i/I.files.length, `Memproses ${f.name}`); await tick();
      let im; try{ im = await loadImage(f.url); }catch(e){ throw new Error(`${f.name}: gambar tidak bisa dibaca`); }
      // normalise through canvas (handles EXIF rotation, webp/gif/bmp, transparency)
      const r = norm(f.rot||0), sw = im.naturalWidth, sh = im.naturalHeight;
      const c = document.createElement("canvas");
      if(r % 180 === 90){ c.width = sh; c.height = sw; } else { c.width = sw; c.height = sh; }
      const ctx = c.getContext("2d");
      const png = /png$/i.test(f.file.type) || /\.png$/i.test(f.name);
      if(!png){ ctx.fillStyle="#fff"; ctx.fillRect(0,0,c.width,c.height); }
      ctx.translate(c.width/2, c.height/2); ctx.rotate(r * Math.PI/180); ctx.drawImage(im, -sw/2, -sh/2);
      const blob = await canvasBlob(c, png ? "image/png" : "image/jpeg", .92);
      const buf = new Uint8Array(await blob.arrayBuffer());
      const emb = png ? await doc.embedPng(buf) : await doc.embedJpg(buf);
      const iw = c.width, ih = c.height;
      let W, H;
      if(sizeMode==="fit"){ W = iw*0.75 + margin*2; H = ih*0.75 + margin*2; }
      else { [W,H] = SIZES[sizeMode]; const land = orient==="l" || (orient==="auto" && iw>ih); if(land) [W,H]=[H,W]; }
      const page = doc.addPage([W,H]);
      const s = Math.min((W-margin*2)/iw, (H-margin*2)/ih);
      const dw = iw*s, dh = ih*s;
      page.drawImage(emb, {x:(W-dw)/2, y:(H-dh)/2, width:dw, height:dh});
    }
    progress(.96, "Menyimpan…"); await tick();
    const bytes = await doc.save();
    const name = I.files.length===1 ? baseName(I.files[0].name)+".pdf" : "gambar.pdf";
    showResult({title:"PDF berhasil dibuat", name, blob:pdfBlob(bytes), extra:`<p class="muted" style="margin:6px 0 0">${I.files.length} halaman</p>`});
  }catch(e){ showError(e.message || String(e)); }
};

/* ================= PDF KE JPG ================= */
const J = { file:null, bytes:null, pdf:null, io:null };
const getQ = segSetup("jpg-q");
handlers.jpg = async (fs) => {
  const f = fs.find(isPdf); if(!f){ toast("Pilih file PDF"); return; }
  if(!(await sizeOk(f.size))) return;
  $("#go-jpg").disabled = true; $("#title-jpg").textContent = `Membaca ${f.name}…`;
  try{
    const bytes = new Uint8Array(await f.arrayBuffer()); const pdf = await loadPdfJs(bytes);
    if(J.pdf) J.pdf.destroy(); if(J.io) J.io.disconnect();
    Object.assign(J, {file:f, pdf, rot:new Array(pdf.numPages).fill(0)});
    $("#title-jpg").textContent = `${f.name} · ${pdf.numPages} halaman`;
    showWork("jpg", true);
    J.io = buildPageGrid($("#pages-jpg"), pdf, {selectable:false, rot:{get:n => J.rot[n-1], set:(n,d) => J.rot[n-1] = d}});
    $("#range-jpg").value=""; syncJ();
  }catch(e){ showError(e.message); if(J.file){ $("#title-jpg").textContent = `${J.file.name} · ${J.pdf.numPages} halaman`; syncJ(); } }
};
function syncJ(){ const {ranges,error}=parseRanges($("#range-jpg").value, J.pdf?J.pdf.numPages:0); const h=$("#hint-jpg"); h.classList.toggle("err",!!error); const n = ranges.length ? pagesFromRanges(ranges).length : (J.pdf?J.pdf.numPages:0); h.textContent = error || `${n} gambar akan dibuat`; $("#go-jpg").disabled = !!error; }
$("#range-jpg").addEventListener("input", syncJ);
ROTALL.jpg = d => { if(!J.rot) return; J.rot = J.rot.map(x => x + d); repaintGrid($("#pages-jpg"), n => J.rot[n-1]); };
$("#go-jpg").onclick = async () => {
  const {ranges} = parseRanges($("#range-jpg").value, J.pdf.numPages);
  const pages = ranges.length ? pagesFromRanges(ranges) : Array.from({length:J.pdf.numPages},(_,i)=>i+1);
  const scale = (+getQ())/72; const base = baseName(J.file.name);
  showProgress("Mengubah ke JPG…");
  try{
    const outs = [];
    for(let i=0;i<pages.length;i++){
      progress(i/pages.length, `Halaman ${pages[i]} (${i+1}/${pages.length})`); await tick();
      const {canvas} = await renderPage(J.pdf, pages[i], {scale, rotate: J.rot[pages[i]-1]});
      outs.push({name:`${base}-hal-${pages[i]}.jpg`, blob: await canvasBlob(canvas, "image/jpeg", .9)});
      canvas.width = canvas.height = 0;
    }
    if(outs.length===1){ showResult({title:"Gambar siap", name:outs[0].name, blob:outs[0].blob}); return; }
    progress(.97, "Membuat ZIP…"); await tick();
    const zip = new JSZip(); outs.forEach(o=>zip.file(o.name, o.blob));
    const blob = await zip.generateAsync({type:"blob", compression:"STORE"});
    showResult({title:"Gambar siap", name:`${base}-jpg.zip`, blob, extra:`<p class="muted" style="margin:6px 0 0">${outs.length} gambar JPG di dalam ZIP</p>`});
  }catch(e){ showError(e.message || String(e)); }
};

/* ================= KOMPRES ================= */
// Ringan/Sedang/Kuat: Ghostscript (WebAssembly) di perangkat — teks & font tetap utuh.
// Ekstrem: setiap halaman digambar ulang jadi JPG (pdf.js) — paling kecil, teks tidak bisa dicopy.
const K = { file:null, pdf:null, io:null };
const GS_LEVEL = {
  ringan: { preset:"/printer", dpi:200, q:0.25 },
  sedang: { preset:"/ebook",   dpi:144, q:0.6  },
  kuat:   { preset:"/screen",  dpi:96,  q:1.1  },
};
ROTALL.zip = d => { if(!K.rot) return; K.rot = K.rot.map(x => x + d); repaintGrid($("#pages-zip"), n => K.rot[n-1]); };
const getLevel = segSetup("zip-level", v => { $("#zip-note").style.display = v==="ekstrem" ? "" : "none"; });
let gsWarm = false; // mesin sudah pernah dimuat di sesi ini (tersimpan di cache browser)
handlers.zip = async (fs) => {
  const f = fs.find(isPdf); if(!f){ toast("Pilih file PDF"); return; }
  if(!(await sizeOk(f.size))) return;
  $("#go-zip").disabled = true; $("#title-zip").textContent = `Membaca ${f.name}…`;
  try{
    const bytes = new Uint8Array(await f.arrayBuffer()); const pdf = await loadPdfJs(bytes);
    if(K.pdf) K.pdf.destroy(); if(K.io) K.io.disconnect();
    Object.assign(K, {file:f, pdf, rot:new Array(pdf.numPages).fill(0)});
    $("#title-zip").textContent = `${f.name} · ${pdf.numPages} hal · ${fmtSize(f.size)}`;
    showWork("zip", true);
    K.io = buildPageGrid($("#pages-zip"), pdf, {selectable:false, rot:{get:n => K.rot[n-1], set:(n,d) => K.rot[n-1] = d}});
  }catch(e){ showError(e.message); if(K.file) $("#title-zip").textContent = `${K.file.name} · ${K.pdf.numPages} hal · ${fmtSize(K.file.size)}`; }
  finally{ $("#go-zip").disabled = !K.file; }
};
function gsArgs(L){
  const dict = `<< /QFactor ${L.q} /Blend 1 /HSamples [2 1 1 2] /VSamples [2 1 1 2] >>`;
  return ["-dNOPAUSE","-dBATCH","-dSAFER","-sDEVICE=pdfwrite","-dCompatibilityLevel=1.5", `-dPDFSETTINGS=${L.preset}`,
    "-dDetectDuplicateImages=true","-dCompressFonts=true","-dSubsetFonts=true",
    "-dDownsampleColorImages=true","-dDownsampleGrayImages=true","-dDownsampleMonoImages=true",
    `-dColorImageResolution=${L.dpi}`,`-dGrayImageResolution=${L.dpi}`,`-dMonoImageResolution=${L.dpi*2}`,
    "-dColorImageDownsampleThreshold=1.2","-dGrayImageDownsampleThreshold=1.2",
    "-dAutoFilterColorImages=false","-dAutoFilterGrayImages=false","-dColorImageFilter=/DCTEncode","-dGrayImageFilter=/DCTEncode",
    "-sOutputFile=/out.pdf","-c",`<< /ColorImageDict ${dict} /GrayImageDict ${dict} >> setdistillerparams`,"-f","/in.pdf"];
}
function gsCompress(file, L, pages, onMsg){
  return new Promise(async (resolve, reject) => {
    let w;
    try{ w = new Worker("lib/gs-worker.js", {type:"module"}); }
    catch(e){ reject(new Error("Browser ini belum mendukung mesin kompres. Coba Chrome, Edge, Safari, atau Firefox versi terbaru.")); return; }
    const done = (fn, v) => { w.terminate(); fn(v); };
    w.onerror = () => done(reject, new Error("Mesin kompres gagal dimuat. Periksa koneksi internet lalu coba lagi."));
    w.onmessage = (e) => {
      const m = e.data;
      if(m.type==="ready"){ gsWarm = true; onMsg(0.05, "Mengompres…"); }
      else if(m.type==="page") onMsg(0.05 + 0.9*Math.min(1, m.n/pages), `Mengompres halaman ${m.n} dari ${pages}…`);
      else if(m.type==="done") done(resolve, new Uint8Array(m.out));
      else if(m.type==="error"){
        const enc = /password|encrypt/i.test(m.log||"");
        done(reject, new Error(enc ? "PDF ini dilindungi kata sandi. Buka kuncinya dulu, lalu coba lagi." : "PDF ini tidak bisa dikompres. File mungkin rusak, atau memori perangkat tidak cukup."));
      }
    };
    onMsg(0.02, gsWarm ? "Menyiapkan…" : "Menyiapkan mesin kompres… (pertama kali ±11 MB, setelah itu tersimpan)");
    const buf = await file.arrayBuffer();
    w.postMessage({ input: buf, args: gsArgs(L) }, [buf]);
  });
}
async function rasterCompress(onMsg){
  const out = await PDFDocument.create(); const n = K.pdf.numPages;
  for(let i=1;i<=n;i++){
    onMsg((i-1)/n, `Halaman ${i} dari ${n}`); await tick();
    const {canvas, w, h} = await renderPage(K.pdf, i, {scale: 90/72});
    const blob = await canvasBlob(canvas, "image/jpeg", .5);
    canvas.width = canvas.height = 0;
    const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
    out.addPage([w,h]).drawImage(img, {x:0, y:0, width:w, height:h});
  }
  onMsg(.97, "Menyimpan…"); await tick();
  return out.save({useObjectStreams:true});
}
$("#go-zip").onclick = async () => {
  const level = getLevel(); const base = baseName(K.file.name);
  showProgress("Mengompres PDF…");
  try{
    let bytes = level==="ekstrem" ? await rasterCompress(progress) : await gsCompress(K.file, GS_LEVEL[level], K.pdf.numPages, progress);
    if(K.rot.some(d => norm(d))){   // terapkan putaran ke hasil kompres
      progress(.98, "Memutar halaman…"); await tick();
      const d = await PDFDocument.load(bytes);
      d.getPages().forEach((p, i) => rotatePage(p, K.rot[i]));
      bytes = await d.save({useObjectStreams:true});
    }
    const before = K.file.size, after = bytes.length;
    if(after >= before){
      showError(level==="ekstrem" ? "Hasilnya tidak lebih kecil dari aslinya. File ini sudah optimal." : `File ini sudah cukup optimal untuk tingkat ${level[0].toUpperCase()+level.slice(1)}. Coba tingkat yang lebih kuat kalau ukuran lebih penting.`);
      return;
    }
    const pct = Math.round((1-after/before)*100);
    showResult({title:"PDF berhasil dikompres", name:`${base}-kompres.pdf`, blob:pdfBlob(bytes),
      extra:`<div class="cmp"><span class="muted" style="text-decoration:line-through">${fmtSize(before)}</span>→<span>${fmtSize(after)}</span><span class="save">−${pct < 1 ? "<1" : pct}%</span></div>${level!=="ekstrem" ? '<p class="muted" style="margin:4px 0 0;font-size:13px">Teks tetap bisa diblok dan dicopy</p>' : ""}`});
  }catch(e){ showError(e.message || String(e)); }
};

route();
checkServer();

})();
