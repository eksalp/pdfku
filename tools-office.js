/* JagoPDF · Word / Excel / PowerPoint ke PDF.
   Mode Cepat: dirender di browser lalu disimpan lewat dialog cetak.
   Mode Akurat: LibreOffice (WebAssembly) berjalan di browser, diunduh sekali lalu tersimpan di cache. */
(function(){
"use strict";
const J = window.JP;
const { $, $$, esc, fmtSize, baseName, handlers, toast, showProgress, progress, loadDone, tick, hideOv, showResult, showError, sizeOk, segSetup, showWork, pdfBlob } = J;

const KIND = {
  word:  { accept:[".docx",".doc",".odt",".rtf"], light:[".docx"], pick:"Pilih file Word", desc:"Ubah dokumen Word jadi PDF. Teks, tabel, dan gambar ikut.", label:"DOC" },
  excel: { accept:[".xlsx",".xls",".ods",".csv"], light:[".xlsx",".csv"], pick:"Pilih file Excel", desc:"Ubah spreadsheet jadi PDF. Semua sheet ikut, angka sesuai hasil rumusnya.", label:"XLS" },
  ppt:   { accept:[".pptx",".ppt",".odp"], light:[], pick:"Pilih file PowerPoint", desc:"Ubah presentasi jadi PDF, satu slide per halaman.", label:"PPT" },
};
const OP = { kind:"word", tool:null, file:null, bytes:null, ext:"", rendered:false };
const extOf = n => (n.match(/\.[^.]+$/) || [""])[0].toLowerCase();
const LO_OK = () => !!(window.crossOriginIsolated && typeof SharedArrayBuffer !== "undefined" && window.WebAssembly && window.caches);

const getMode = segSetup("o2p-mode", () => syncO2p());
const getOrient = segSetup("o2p-orient");

J.ROUTE_HOOKS.push(tool => {
  if(!tool || !tool.o2p) return;
  if(OP.tool !== tool){ OP.file = null; showWork("o2p", false); }
  OP.tool = tool; OP.kind = tool.o2p;
  const K = KIND[OP.kind];
  $("#o2p-title").textContent = tool.title; $("#o2p-ic").innerHTML = tool.icon; $("#o2p-desc").textContent = K.desc;
  $("#pick-o2p").textContent = K.pick; $("#in-o2p").accept = K.accept.join(",");
  syncO2p();
});

handlers.o2p = async (fs) => {
  const K = KIND[OP.kind];
  const f = fs.find(x => K.accept.includes(extOf(x.name)));
  if(!f){ toast(`Pilih file ${K.accept.join(", ")}`); return; }
  if(!(await sizeOk(f.size))) return;
  try{
    showProgress("Membuka file");
    const bytes = await J.readFileProgress(f, fr => progress(fr*0.5, `Membaca ${f.name}…`));
    Object.assign(OP, {file:f, bytes, ext:extOf(f.name), rendered:false});
    $("#title-o2p").textContent = `${f.name} · ${fmtSize(f.size)}`;
    showWork("o2p", true);
    const light = K.light.includes(OP.ext);
    // pilih mode yang masuk akal untuk file ini
    const want = light ? "cepat" : "akurat";
    $$("#o2p-mode button").forEach(b => b.classList.toggle("on", b.dataset.v === want));
    progress(.6, "Menyiapkan pratinjau…");
    await renderPreview($("#o2p-prev"), false);
    syncO2p(); await loadDone();
  }catch(e){ showError(e.message || "File tidak bisa dibaca."); }
};

function fileCard(){
  return `<div class="ofile"><span class="ic">${OP.tool.icon}</span><div><h5 style="margin:0 0 2px;font-size:15px">${esc(OP.file.name)}</h5><p class="muted" style="margin:0;font-size:13px">Pratinjau untuk format ini tidak tersedia. Pakai mode Akurat untuk mengubahnya.</p></div></div>`;
}
async function renderPreview(root, forPrint){
  root.innerHTML = "";
  const light = KIND[OP.kind].light.includes(OP.ext);
  if(!light){ root.innerHTML = fileCard(); return; }
  if(OP.kind === "word"){
    await J.loadScript("lib/office/docx-preview.min.js");
    await docx.renderAsync(OP.bytes.slice().buffer, root, null, { inWrapper:true, breakPages:true, ignoreLastRenderedPageBreak:true, experimental:true, useBase64URL:true, renderHeaders:true, renderFooters:true });
  } else {
    root.innerHTML = await sheetsHTML(forPrint);
  }
  OP.rendered = true;
}

/* --- Excel jadi tabel HTML --- */
const argb = c => c && c.argb && c.argb.length === 8 ? "#" + c.argb.slice(2) : null;
function cellText(cell){
  try{
    const v = cell.value;
    if(v === null || v === undefined) return "";
    if(v instanceof Date) return v.toLocaleDateString("id-ID");
    if(typeof v === "object"){
      if(v.richText) return v.richText.map(t => t.text).join("");
      if("result" in v){ const r = v.result; if(r instanceof Date) return r.toLocaleDateString("id-ID"); if(r && r.error) return r.error; return r === undefined ? "" : (typeof r === "number" ? fmtNum(r, cell.numFmt) : String(r)); }
      if(v.formula || v.sharedFormula) return "";
      if(v.text) return String(v.text);
      if(v.hyperlink) return v.text || v.hyperlink;
      if(v.error) return v.error;
    }
    if(typeof v === "number") return fmtNum(v, cell.numFmt);
    return String(v);
  }catch(e){ return ""; }
}
function fmtNum(n, fmt){
  fmt = fmt || "";
  if(/%/.test(fmt)) return (n*100).toLocaleString("id-ID", {maximumFractionDigits: (fmt.split(".")[1] || "").replace(/[^0]/g, "").length}) + "%";
  const dec = /\.(0+)/.exec(fmt); const d = dec ? dec[1].length : (Number.isInteger(n) ? 0 : Math.min(4, (String(n).split(".")[1] || "").length));
  const grp = /#,##|,0/.test(fmt) || Math.abs(n) >= 10000;
  return n.toLocaleString("id-ID", {minimumFractionDigits: dec ? d : 0, maximumFractionDigits: d, useGrouping: grp});
}
async function sheetsHTML(forPrint){
  await J.loadScript("lib/office/exceljs.min.js");
  const wb = new ExcelJS.Workbook();
  if(OP.ext === ".csv"){
    const txt = new TextDecoder().decode(OP.bytes);
    const ws = wb.addWorksheet(baseName(OP.file.name));
    const sep = (txt.split("\n")[0].match(/;/g) || []).length > (txt.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
    for(const line of txt.split(/\r?\n/)){ if(!line.trim()) { ws.addRow([]); continue; } ws.addRow(splitCsv(line, sep)); }
  } else {
    try { await wb.xlsx.load(OP.bytes.slice().buffer); }
    catch(e){ throw new Error("File Excel tidak bisa dibaca. Coba mode Akurat."); }
  }
  let html = "";
  wb.eachSheet(ws => {
    if(ws.state && ws.state !== "visible") return;
    const maxR = ws.actualRowCount ? ws.rowCount : 0, maxC = ws.columnCount;
    if(!maxR || !maxC){ return; }
    // sel gabungan
    const merged = {}, skip = new Set();
    for(const rng of (ws.model.merges || [])){
      const m = /([A-Z]+)(\d+):([A-Z]+)(\d+)/.exec(rng); if(!m) continue;
      const c1 = colNum(m[1]), r1 = +m[2], c2 = colNum(m[3]), r2 = +m[4];
      merged[r1+":"+c1] = {rs: r2-r1+1, cs: c2-c1+1};
      for(let r = r1; r <= r2; r++) for(let c = c1; c <= c2; c++) if(r !== r1 || c !== c1) skip.add(r+":"+c);
    }
    const cols = [];
    for(let c = 1; c <= maxC; c++){ const col = ws.getColumn(c); cols.push(col.hidden ? 0 : Math.round((col.width || 9) * 7 + 5)); }
    let t = `<colgroup>${cols.map(w => `<col style="width:${w}px">`).join("")}</colgroup>`;
    for(let r = 1; r <= maxR; r++){
      const row = ws.getRow(r); if(row.hidden) continue;
      const h = row.height ? ` style="height:${Math.round(row.height*1.33)}px"` : "";
      t += `<tr${h}>`;
      for(let c = 1; c <= maxC; c++){
        if(skip.has(r+":"+c)) continue;
        if(!cols[c-1]) continue;
        const cell = row.getCell(c); const mg = merged[r+":"+c];
        const st = [];
        const f = cell.font || {}; if(f.bold) st.push("font-weight:700"); if(f.italic) st.push("font-style:italic"); if(f.underline) st.push("text-decoration:underline");
        if(f.size) st.push(`font-size:${f.size}pt`); const fc = argb(f.color); if(fc) st.push(`color:${fc}`);
        const fill = cell.fill; if(fill && fill.type === "pattern" && fill.pattern === "solid"){ const bg = argb(fill.fgColor); if(bg) st.push(`background:${bg}`); }
        const al = cell.alignment || {}; const val = cell.value;
        const isNum = typeof val === "number" || (val && typeof val === "object" && typeof val.result === "number");
        st.push(`text-align:${al.horizontal === "center" || al.horizontal === "centerContinuous" ? "center" : al.horizontal === "right" ? "right" : al.horizontal === "left" ? "left" : isNum ? "right" : "left"}`);
        if(al.vertical === "middle") st.push("vertical-align:middle"); else if(al.vertical === "top") st.push("vertical-align:top");
        if(al.wrapText){ st.push("white-space:pre-wrap"); }
        const b = cell.border || {};
        for(const side of ["top","right","bottom","left"]) if(b[side] && b[side].style) st.push(`border-${side}:${/medium|thick|double/.test(b[side].style) ? 2 : 1}px solid ${argb(b[side].color) || "#000"}`);
        t += `<td${mg ? ` rowspan="${mg.rs}" colspan="${mg.cs}"` : ""} style="${st.join(";")}">${esc(cellText(cell))}</td>`;
      }
      t += "</tr>";
    }
    html += `<div class="${forPrint ? "xprint" : "xsheet"}"><h5>${esc(ws.name)}</h5><table>${t}</table></div>`;
  });
  return html || `<p class="muted">Spreadsheet ini kosong.</p>`;
}
function colNum(s){ let n = 0; for(const ch of s) n = n*26 + ch.charCodeAt(0) - 64; return n; }
function splitCsv(line, sep){
  const out = []; let cur = "", q = false;
  for(let i = 0; i < line.length; i++){
    const ch = line[i];
    if(q){ if(ch === '"' && line[i+1] === '"'){ cur += '"'; i++; } else if(ch === '"') q = false; else cur += ch; }
    else if(ch === '"') q = true; else if(ch === sep){ out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur);
  return out.map(v => { const n = Number(v.replace(",", ".")); return v.trim() !== "" && isFinite(n) && !/^0\d/.test(v.trim()) ? n : v; });
}

function syncO2p(){
  if(!OP.tool) return;
  const K = KIND[OP.kind], light = !OP.file || K.light.includes(OP.ext), lo = LO_OK();
  const bCepat = $('#o2p-mode [data-v="cepat"]'), bAkurat = $('#o2p-mode [data-v="akurat"]');
  bCepat.disabled = !light || K.light.length === 0; bAkurat.disabled = !lo;
  let mode = getMode();
  if(mode === "cepat" && bCepat.disabled && !bAkurat.disabled){ bAkurat.click(); return; }
  if(mode === "akurat" && bAkurat.disabled && !bCepat.disabled){ bCepat.click(); return; }
  const note = $("#o2p-note"); let msg = "";
  if(!lo) msg = location.protocol === "file:" ? "Mode Akurat butuh situs dibuka lewat internet." : "Mode Akurat butuh browser terbaru (Chrome, Edge, Firefox, Safari) dan situs dibuka langsung di jagopdf.web.id.";
  if(K.light.length === 0) msg = (lo ? "PowerPoint hanya bisa diubah dengan mode Akurat." : "PowerPoint butuh mode Akurat. " + msg);
  else if(OP.file && !light) msg = `File ${OP.ext} hanya bisa diubah dengan mode Akurat.` + (lo ? "" : " " + msg);
  note.textContent = msg; note.style.display = msg ? "" : "none";
  $("#opt-o2p-orient").style.display = OP.kind === "excel" && mode === "cepat" ? "" : "none";
  const h = $("#hint-o2p");
  h.textContent = mode === "cepat" ? "Dialog cetak akan terbuka. Pilih Simpan sebagai PDF di bagian Tujuan." : (LO.conv ? "Mesin LibreOffice sudah siap." : "Pertama kali, browser mengunduh LibreOffice (±77 MB) sekali saja. Setelah itu tersimpan dan cepat.");
  $("#go-o2p").textContent = mode === "cepat" ? "Simpan sebagai PDF" : "Ubah ke PDF";
  $("#go-o2p").disabled = !OP.file || (mode === "cepat" ? bCepat.disabled : bAkurat.disabled);
}

/* --- mode Cepat: cetak ke PDF --- */
let printRoot = null;
async function printLight(){
  showProgress("Menyiapkan dokumen…"); progress(.3, "Menata halaman…");
  if(!printRoot){ printRoot = document.createElement("div"); printRoot.id = "print-root"; document.body.appendChild(printRoot); }
  try { await renderPreview(printRoot, true); } catch(e){ showError(e.message); return; }
  let st = $("#print-page-style"); if(!st){ st = document.createElement("style"); st.id = "print-page-style"; document.head.appendChild(st); }
  st.textContent = OP.kind === "excel" ? `@page{size:A4 ${getOrient() === "l" ? "landscape" : "portrait"};margin:12mm}` : "@page{margin:0}";
  await new Promise(r => setTimeout(r, 300)); // tunggu gambar dimuat
  hideOv();
  const oldTitle = document.title; document.title = baseName(OP.file.name);
  document.body.classList.add("printing");
  const done = () => { document.body.classList.remove("printing"); document.title = oldTitle; printRoot.innerHTML = ""; window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  toast("Pilih “Simpan sebagai PDF” di dialog cetak");
  setTimeout(() => { window.print(); setTimeout(() => { if(document.body.classList.contains("printing") && !matchMedia("print").matches) done(); }, 1500); }, 50);
}

/* --- mode Akurat: LibreOffice di browser --- */
const LO = { conv:null, loading:null };
const LO_BASE = J.abs("lib/lo/");
async function loEnsureCached(onFrac){
  const man = await (await fetch(LO_BASE + "manifest.json", {cache:"no-cache"})).json();
  const cache = await caches.open("jagopdf-lo-" + man.version);
  const files = [["soffice.wasm", man.wasm, "application/wasm"], ["soffice.data", man.data, "application/octet-stream"]];
  const total = man.wasm.size + man.data.size; let done = 0;
  for(const [name, info, type] of files){
    if(await cache.match(LO_BASE + name)){ done += info.size; onFrac(done/total); continue; }
    const blobs = [];
    for(let i = 0; i < info.parts; i++){
      const r = await fetch(`${LO_BASE}${name}.part${String(i).padStart(2, "0")}`);
      if(!r.ok) throw new Error("Gagal mengunduh LibreOffice. Periksa koneksi internet lalu coba lagi.");
      const reader = r.body.getReader(), chunks = [];
      for(;;){ const {done:d, value} = await reader.read(); if(d) break; chunks.push(value); done += value.length; onFrac(done/total); }
      blobs.push(new Blob(chunks));
    }
    const blob = new Blob(blobs, {type});
    await cache.put(LO_BASE + name, new Response(blob, {headers:{"Content-Type":type, "Content-Length":String(blob.size)}}));
  }
  return man;
}
async function loGet(onMsg){
  if(LO.conv) return LO.conv;
  if(LO.loading) return LO.loading;
  LO.loading = (async () => {
    if(!LO_OK()) throw new Error("Browser ini belum mendukung mode Akurat.");
    if(navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    await loEnsureCached(fr => onMsg(fr * 0.8, `Mengunduh LibreOffice… ${Math.round(fr*100)}% (sekali saja)`));
    onMsg(.82, "Menyiapkan LibreOffice…");
    const mod = await import(LO_BASE + "lo-browser.js");
    const conv = new mod.WorkerBrowserConverter({
      sofficeJs: LO_BASE + "soffice.js", sofficeWasm: LO_BASE + "soffice.wasm", sofficeData: LO_BASE + "soffice.data",
      sofficeWorkerJs: LO_BASE + "soffice.worker.js", browserWorkerJs: LO_BASE + "lo-worker.js",
      onProgress: i => { if(LO.onProg) LO.onProg(i); },
    });
    LO.onProg = i => onMsg(.82 + .16 * (i.percent || 0)/100, "Menyiapkan LibreOffice…");
    await conv.initialize();
    LO.conv = conv; return conv;
  })();
  try { return await LO.loading; } finally { LO.loading = null; }
}
async function convertAccurate(){
  showProgress("Mengubah ke PDF…");
  try{
    const conv = await loGet((fr, msg) => progress(fr * 0.75, msg));
    LO.onProg = i => progress(.75 + .23 * (i.percent || 0)/100, "Mengubah dokumen…");
    const inExt = OP.ext.slice(1);
    const run = conv.convert(OP.bytes.slice(), {outputFormat:"pdf", inputFormat:inExt}, "dokumen." + inExt);
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("Proses terlalu lama. Muat ulang halaman lalu coba lagi.")), 180000));
    const r = await Promise.race([run, timeout]);
    LO.onProg = null;
    if(!r || !r.data || !r.data.length) throw new Error("Dokumen ini tidak bisa diubah.");
    syncO2p();
    showResult({title:"Berhasil diubah ke PDF", name:`${baseName(OP.file.name)}.pdf`, blob:pdfBlob(r.data)});
  }catch(e){
    const m = String(e && e.message || e);
    showError(/password/i.test(m) ? "Dokumen ini dilindungi kata sandi. Buka kuncinya di aplikasi aslinya dulu." : /corrupt|load/i.test(m) ? "Dokumen tidak bisa dibuka. File mungkin rusak." : m);
  }
}
$("#go-o2p").onclick = () => getMode() === "cepat" ? printLight() : convertAccurate();

J.loGet = loGet; J.LO_OK = LO_OK;
})();
