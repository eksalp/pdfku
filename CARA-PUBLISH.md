# Publish PDFku ke Internet (Gratis, Cloudflare Pages)

Folder ini adalah situs PDFku yang sudah lengkap. Tidak perlu server, database, atau biaya apa pun. Semua alat berjalan di browser pengunjung.

## Sebelum upload (opsional, tapi disarankan)

Buka `app.js` dengan Notepad, lalu isi di bagian atas:

```js
const CONTACT_EMAIL = "halo@domainmu.com";                  // email kontak di halaman Privasi
const SOURCE_URL    = "https://github.com/namamu/pdfku";    // link kode sumber (lihat bagian Lisensi)
```

## Langkah publish (±5 menit)

1. Daftar atau login di **dash.cloudflare.com** (gratis, tanpa kartu kredit).
2. Di menu kiri pilih **Workers & Pages** → **Create** → tab **Pages** → **Upload assets**.
   (Kalau tampilannya sudah berubah, cari opsi untuk upload folder statis atau "Drag and drop your files".)
3. Isi nama proyek, misalnya `pdfku`. Nama ini menjadi alamat situsmu: `pdfku.pages.dev`.
4. Seret **isi folder ini** ke kotak upload. Yang diseret adalah `index.html`, `app.js`, `_headers`, dan folder `lib`, bukan folder pembungkusnya.
5. Klik **Deploy site**. Selesai, situsmu online di `https://pdfku.pages.dev` (atau nama yang kamu pilih).

## Pakai domain sendiri (misalnya `pdf.akungue.my.id`)

1. Buka proyek di Cloudflare → tab **Custom domains** → **Set up a custom domain**.
2. Ketik `pdf.akungue.my.id`, lalu ikuti petunjuknya.
   - Kalau DNS domainmu sudah di Cloudflare, semuanya otomatis.
   - Kalau DNS masih di registrar atau hosting lain, tambahkan CNAME `pdf` → `pdfku.pages.dev` di sana.
3. HTTPS aktif otomatis dalam beberapa menit.

## Update situs nanti

Buka proyek → **Create new deployment** → upload ulang isi folder. Versi lama tetap tersimpan, dan bisa dikembalikan dengan satu klik (**Rollback**).

## Cek setelah online

- Buka situsmu dan coba setiap alat.
- Buka `/#privasi` dan pastikan halamannya tampil.
- Cek header keamanan di **securityheaders.com**. Nilainya seharusnya A.

## Lisensi (penting)

Mesin kompres memakai **Ghostscript** yang berlisensi **AGPL-3.0**. Cara paling aman memenuhinya adalah membuka kode PDFku:

1. Buat repo publik di GitHub (gratis), lalu upload isi folder ini.
2. Isi `SOURCE_URL` di `app.js` dengan link repo tersebut.

Kredit untuk semua library open source sudah tercantum di halaman Privasi. Library lain (PDF.js, pdf-lib, JSZip, dan font Plus Jakarta Sans) berlisensi bebas dan aman dipakai untuk situs komersial.

## Menambah Word/Excel/PowerPoint ke PDF nanti

Fitur ini butuh server (lihat paket `pdfku-vps`). Setelah servernya jalan, ubah `API_BASE` di `app.js` ke alamat servernya, dan alat-alat itu otomatis muncul.
