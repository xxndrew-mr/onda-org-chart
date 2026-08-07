# Setup Lark — Langkah demi Langkah

Ikuti urutan ini sekali saja. Selesai ini, web-nya langsung jalan.

---

## 1. Buat Custom App di Lark Developer Console

1. Buka **https://open.larksuite.com/app** (kalau perusahaan pakai Feishu China: https://open.feishu.cn/app)
2. Klik **Create Custom App**
3. Isi nama app, misal `Struktur Organisasi Web`, lalu **Create**

## 2. Ambil Credential

1. Di app yang baru dibuat, masuk menu **Credentials & Basic Info**
2. Salin **App ID** (formatnya `cli_xxxxxxxxxxxxxxxx`)
3. Salin **App Secret**

> App Secret ini setara password. Jangan pernah ditaruh di kode frontend atau di-commit ke git.

## 3. Aktifkan Permission (Scopes)

Masuk menu **Permissions & Scopes**, lalu tambahkan scope berikut.

### Scope utama (wajib — pilih salah satu, yang paling gampang yang pertama)

| Nama di UI | Kode scope |
|---|---|
| **Read Contacts as an app** | `contact:contact:readonly_as_app` |
| _atau_ Obtain department's organizational structure | `contact:department.organize:readonly` |

### Field scope (wajib, supaya data-nya tidak kosong)

| Nama di UI | Kode scope | Dipakai untuk |
|---|---|---|
| Obtain department's basic information | `contact:department.base:readonly` | Nama departemen, parent, leader |
| Obtain user's basic information | `contact:user.base:readonly` | Nama & foto karyawan |
| Obtain user's employment information | `contact:user.employee:readonly` | Jabatan (job title) |

### Field scope opsional

| Nama di UI | Kode scope | Dipakai untuk |
|---|---|---|
| Obtain user's email information | `contact:user.email:readonly` | Email di kartu karyawan |
| View member's Employee Number | `contact:user.employee_id:readonly` | NIK / employee number |

> Beberapa field scope hanya tersedia untuk **Custom App**, bukan Store App. Pastikan app kamu tipe Custom.

## 4. Set Data Scope (Rentang Buku Alamat)

Ini yang **paling sering kelewat** dan bikin error `40004 no dept authority`.

1. Masih di **Permissions & Scopes**, cari tab **Data Scope** (atau "Contacts scope" / "通讯录权限范围")
2. Set jangkauannya ke **seluruh perusahaan (All employees)**
3. Kalau hanya mau sebagian, pilih departemen yang relevan — tapi node root-nya harus ikut terpilih

## 5. Publish App

1. Masuk menu **Version Management & Release**
2. Klik **Create a version**, isi version number & release notes
3. **Submit for release** → tunggu approval admin

Karena kamu admin, kamu bisa approve sendiri lewat **Lark Admin Console → Workplace → App Management → pending approval**.

> Permission baru **tidak aktif** sampai versi barunya di-approve. Setiap kali menambah scope, harus release versi baru lagi.

## 6. Isi `.env.local`

Di folder project, copy `.env.local.example` jadi `.env.local`:

```env
LARK_APP_ID=cli_xxxxxxxxxxxxxxxx
LARK_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
LARK_DOMAIN=https://open.larksuite.com
LARK_ROOT_DEPARTMENT_ID=0
NEXT_PUBLIC_ORG_NAME=PT Onda
ORG_CACHE_TTL_SECONDS=600
```

## 7. Tes Koneksi

```bash
npm install
npm run dev
```

Buka **http://localhost:3000/api/health** — kalau berhasil muncul:

```json
{ "ok": true, "message": "Berhasil terhubung ke Lark. Credential valid." }
```

Lalu buka **http://localhost:3000**.

---

## Troubleshooting

| Gejala | Penyebab & solusi |
|---|---|
| `code 10003` / `10014` di /api/health | App ID atau Secret salah, **atau** salah domain. Lark internasional pakai `open.larksuite.com`, Feishu China pakai `open.feishu.cn`. |
| `code 40004 — no dept authority` | Data Scope belum mencakup departemen. Balik ke langkah 4, lalu **release versi baru**. |
| `code 41050 — no user authority` | Sama seperti di atas, tapi untuk karyawan. Perluas Data Scope ke seluruh perusahaan. |
| `code 99991672` | Scope belum di-approve. Cek langkah 3 & 5. |
| Departemen muncul tapi anggotanya kosong | Field scope `contact:user.base:readonly` belum aktif, atau karyawan tidak terdaftar langsung di departemen itu (dia ada di sub-departemen). |
| Nama karyawan muncul tapi jabatan kosong | Tambahkan `contact:user.employee:readonly`, lalu release versi baru. |
| `code 43010 — big dept forbid recursion` | Organisasi terlalu besar untuk satu query rekursif. Set `LARK_ROOT_DEPARTMENT_ID` ke sub-departemen tertentu. |
| Data lama terus muncul | Cache 10 menit. Klik **Sinkron ulang** di web, atau ubah `ORG_CACHE_TTL_SECONDS`. |

---

## Catatan Rate Limit

`find_by_department` dibatasi **50 request/detik, 1000/menit**. Kode ini sudah membatasi paralelisme ke 5 request bersamaan (`CONCURRENCY` di `lib/lark.ts`), jadi aman bahkan untuk ratusan departemen. Kalau organisasi kamu sangat besar dan sinkron pertama terasa lama, naikkan `maxDuration` di `app/api/org/route.ts`.

## Sumber

- [Obtain the list of sub-departments — Lark Server API](https://open.larksuite.com/document/server-docs/contact-v3/department/children)
- [Obtain the list of users directly under a department — Lark Server API](https://open.larksuite.com/document/server-docs/contact-v3/user/find_by_department)
