// PDFku — menjalankan Ghostscript (WebAssembly) di perangkat pengguna.
// Satu worker = satu pekerjaan; worker dihentikan setelah selesai supaya memorinya langsung bebas.
import loadGS from "./gs.js";

// Simpan mesin (gs.wasm, ±15 MB) di Cache Storage browser: diunduh sekali, lalu bisa dipakai offline.
// Ganti nama cache kalau versi gs.wasm diperbarui.
const CACHE = "pdfku-gs-10.06.0";
async function getWasm() {
  const url = new URL("./gs.wasm", import.meta.url).href;
  let cache = null;
  try { cache = await caches.open(CACHE); } catch (e) { /* mis. bukan https */ }
  if (cache) {
    const hit = await cache.match(url);
    if (hit) return hit.arrayBuffer();
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error("wasm " + res.status);
  if (cache) { try { await cache.put(url, res.clone()); } catch (e) {} }
  return res.arrayBuffer();
}

self.onmessage = async (e) => {
  const { input, args } = e.data;
  const log = [];
  try {
    const wasmBinary = await getWasm();
    const M = await loadGS({
      wasmBinary,
      print: (line) => {
        const m = /^Page (\d+)/.exec(line);
        if (m) self.postMessage({ type: "page", n: +m[1] });
        else log.push(line);
      },
      printErr: (line) => log.push(line),
    });
    self.postMessage({ type: "ready" });
    M.FS.writeFile("/in.pdf", new Uint8Array(input));
    let code;
    try { code = M.callMain(args); } catch (ex) { code = ex && typeof ex.status === "number" ? ex.status : -1; }
    if (code !== 0) throw new Error("exit " + code);
    const out = M.FS.readFile("/out.pdf");
    self.postMessage({ type: "done", out: out.buffer }, [out.buffer]);
  } catch (err) {
    self.postMessage({ type: "error", message: String((err && err.message) || err), log: log.slice(-8).join("\n") });
  }
};
