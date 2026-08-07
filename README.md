# Struktur Organisasi — Lark

Web struktur organisasi yang menarik data **langsung dari Lark** (departemen, sub-departemen, kepala departemen, dan karyawan) lewat Lark Open API `contact/v3`.

## Fitur

- **Bagan** — org chart visual dengan garis penghubung, warna per departemen, bisa collapse/expand per cabang, zoom, dan cetak. Departemen yang banyak otomatis disusun dalam beberapa kolom seimbang supaya bagan tidak melebar
- **Bagan per departemen** — dropdown cakupan di toolbar: pilih satu departemen untuk melihat bagan internalnya (kepala di atas, sub-departemen & kartu tiap anggota di bawahnya), mirip lembar struktur organisasi resmi per departemen. Catatan: relasi atasan-bawahan antar-orang (Mgr → Spv → Staf) belum bisa digambar karena field *Direct Manager* dan *Job Title* di Lark masih kosong — kalau nanti diisi di Lark Admin, bagan orang bisa dibuat bertingkat
- **Daftar** — tree sidebar + panel detail departemen (anggota, sub-departemen, headcount)
- **Pencarian** — cari nama, jabatan, email, NIK, atau departemen
- **Interaksi modern** — latar Three.js di header, smooth scroll berinersia pada kanvas & panel, Ctrl+scroll untuk zoom bagan, drag untuk menggeser kanvas, animasi entrance & transisi antar-tampilan (otomatis nonaktif pada *prefers-reduced-motion* dan saat mencetak)
- **Sinkron on-demand** — tombol "Sinkron ulang" untuk ambil data terbaru dari Lark
- **Cache server** — hasil di-cache 10 menit supaya tidak menghajar rate limit Lark
- **Diagnostik** — endpoint `/api/health` untuk cek credential sebelum menyalahkan hal lain

## Mulai Cepat

```bash
npm install
cp .env.local.example .env.local   # Windows: copy .env.local.example .env.local
# isi LARK_APP_ID dan LARK_APP_SECRET
npm run dev
```

Buka http://localhost:3000

> **Belum punya App ID?** Ikuti [SETUP-LARK.md](./SETUP-LARK.md) — panduan lengkap bikin custom app, aktifkan permission, dan publish.

## Struktur Project

```
app/
  page.tsx              Halaman utama (server component)
  layout.tsx            Root layout
  globals.css           Tailwind + CSS garis bagan organisasi
  api/
    org/route.ts        Endpoint utama — bangun pohon organisasi + cache
    health/route.ts     Diagnostik credential Lark

lib/
  lark.ts               Klien Lark Open API (token, paginasi, rate limiting)
  org.ts                Susun departemen + user jadi pohon organisasi
  tree-utils.ts         Helper murni untuk client (search, flatten, path)
  cache.ts              Cache in-memory ber-TTL
  types.ts              Tipe Lark + tipe UI

components/
  OrgExplorer.tsx       State utama, toolbar, routing antar view
  ChartView.tsx         Bagan organisasi
  DeptTree.tsx          Tree sidebar
  DetailPanel.tsx       Panel detail departemen
  SearchResults.tsx     Hasil pencarian
  PersonCard.tsx        Kartu karyawan
  Avatar.tsx            Avatar dengan fallback inisial
```

## Environment Variables

| Variable | Wajib | Default | Keterangan |
|---|---|---|---|
| `LARK_APP_ID` | ✅ | — | App ID dari Developer Console |
| `LARK_APP_SECRET` | ✅ | — | App Secret — **rahasia**, hanya dibaca di server |
| `LARK_DOMAIN` | | `https://open.larksuite.com` | Ganti ke `https://open.feishu.cn` kalau pakai Feishu China |
| `LARK_ROOT_DEPARTMENT_ID` | | `0` | `0` = seluruh perusahaan. Isi `open_department_id` untuk tampilkan sub-tree saja |
| `NEXT_PUBLIC_ORG_NAME` | | `Perusahaan` | Nama di node paling atas |
| `ORG_CACHE_TTL_SECONDS` | | `600` | Umur cache data organisasi |
| `ORG_REFRESH_KEY` | | kosong | Kalau diisi, `/api/org?refresh=1` butuh `&key=<nilai>` |

## Cara Kerjanya

1. Server tukar `app_id` + `app_secret` jadi `tenant_access_token` (di-cache sampai mendekati expiry)
2. `GET /contact/v3/departments/{root}/children?fetch_child=true` → semua departemen sekaligus, rekursif
3. Untuk tiap departemen, `GET /contact/v3/users/find_by_department` → anggota langsung (maks 5 request paralel)
4. Departemen + user disusun jadi pohon; headcount dihitung rekursif ke atas
5. **Restruktur governance** — di Lark semua departemen sejajar di bawah root. Server menyusun ulang jadi
   root → *Commissioner* → *Direksi* → departemen inti (deteksi berdasarkan nama departemen; departemen yang
   namanya mengandung "Commissioner/Komisaris" tetap menggantung di bawah Commissioner). Kalau tidak ada
   departemen bernama "Direksi", struktur dibiarkan apa adanya
6. Tiap keluarga departemen diberi indeks warna (`colorIndex`) yang diwariskan ke seluruh sub-nya —
   dipakai bagan & sidebar untuk membedakan departemen. Palet ada di `lib/colors.ts`
7. Hasilnya di-cache di memori, lalu dikirim ke browser sebagai satu JSON

App Secret **tidak pernah** sampai ke browser — semua panggilan Lark terjadi di API route.

## Deploy

### Vercel

```bash
npm i -g vercel
vercel
```

Set environment variables di **Project Settings → Environment Variables**. Cache in-memory tetap jalan per-instance; untuk data yang jarang berubah ini sudah cukup.

### Server sendiri / Docker

```bash
npm run build
npm start          # jalan di port 3000
```

## Catatan

- Karyawan yang statusnya resign/exited otomatis disaring
- Karyawan yang terdaftar di lebih dari satu departemen akan muncul di masing-masing departemen, tapi hanya dihitung sekali di statistik total
- Departemen yang parent-nya tidak terjangkau (di luar contact scope) akan digantung ke node root supaya tidak hilang

## Lisensi

Internal use.
