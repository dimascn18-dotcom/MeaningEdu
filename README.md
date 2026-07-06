# MeaningEdu — Panduan Lengkap Frontend

## 📁 Struktur File yang Sudah Ada

```
meaningedu/
├── index.html      → Halaman utama (Landing Page)
├── login.html      → Halaman Masuk
├── register.html   → Halaman Daftar
├── style.css       → Semua tampilan/warna
├── app.js          → Fungsi interaktif
├── sw.js           → Offline/PWA (Service Worker)
├── manifest.json   → Konfigurasi PWA
├── vercel.json     → Konfigurasi deploy
└── .gitignore      → File yang diabaikan Git
```

---

## 🚀 LANGKAH 1 — Pasang Alat di Komputer Anda

### A. Install Node.js
1. Buka: https://nodejs.org
2. Klik tombol hijau besar "LTS" (bukan "Current")
3. Download dan install seperti biasa (Next → Next → Finish)

### B. Cek apakah berhasil
1. Buka **Terminal** (Mac/Linux) atau **Command Prompt** (Windows)
   - Windows: tekan `Win + R`, ketik `cmd`, tekan Enter
2. Ketik: `node --version`
3. Jika muncul angka versi (misal: `v20.11.0`), berarti berhasil ✅

---

## 🚀 LANGKAH 2 — Siapkan Folder di Komputer

1. Buat folder baru di komputer Anda, misal di Desktop, namanya: `meaningedu`
2. **Salin semua file** yang sudah dibuat ke dalam folder tersebut
3. Buka folder tersebut dengan **VSCode**:
   - Buka VSCode → File → Open Folder → pilih folder `meaningedu`

---

## 🚀 LANGKAH 3 — Lihat Hasilnya di Browser (Preview Lokal)

Cara termudah tanpa install apapun:

1. Di VSCode, klik kanan file `index.html`
2. Pilih **"Open with Live Server"**
   - Jika belum ada, install dulu: klik ikon Extensions (kotak di sidebar kiri) → cari "Live Server" → Install
3. Browser akan otomatis terbuka dan menampilkan website Anda!
4. Setiap kali Anda edit dan simpan file, tampilan browser langsung berubah otomatis 🎉

---

## 🚀 LANGKAH 4 — Upload ke GitHub

GitHub adalah tempat menyimpan kode secara online (seperti Google Drive, tapi untuk kode).

### A. Setup Git pertama kali (hanya sekali)
1. Buka Terminal/Command Prompt
2. Ketik dan tekan Enter satu per satu:
   ```
   git config --global user.name "Nama Anda"
   git config --global user.email "email@anda.com"
   ```

### B. Buat Repository di GitHub
1. Login ke https://github.com
2. Klik tombol **"+"** di pojok kanan atas → **"New repository"**
3. Nama repository: `meaningedu`
4. Biarkan **Public** (agar bisa diakses Vercel)
5. Jangan centang apapun
6. Klik **"Create repository"**
7. **Salin link repository** (bentuknya: `https://github.com/username-anda/meaningedu.git`)

### C. Upload kode ke GitHub
1. Di VSCode, buka **Terminal** → Terminal → New Terminal
2. Ketik satu per satu (tekan Enter setelah setiap baris):
   ```
   git init
   git add .
   git commit -m "Upload pertama MeaningEdu"
   git branch -M main
   git remote add origin https://github.com/USERNAME-ANDA/meaningedu.git
   git push -u origin main
   ```
   ⚠️ Ganti `USERNAME-ANDA` dengan username GitHub Anda yang sebenarnya!

3. Akan muncul popup minta login GitHub → masukkan username dan password
4. Refresh halaman GitHub Anda — semua file sudah muncul! ✅

---

## 🚀 LANGKAH 5 — Deploy ke Vercel (Buat Website Online)

Vercel akan mengambil kode dari GitHub dan menjadikannya website yang bisa diakses siapa saja.

1. Buka: https://vercel.com
2. Klik **"Sign Up"** → pilih **"Continue with GitHub"**
3. Izinkan Vercel mengakses GitHub Anda
4. Klik tombol **"Add New..."** → **"Project"**
5. Cari repository `meaningedu` → klik **"Import"**
6. Di halaman konfigurasi:
   - Framework Preset: pilih **"Other"** (bukan Next.js atau yang lain)
   - Biarkan semua pengaturan lain seperti default
7. Klik **"Deploy"**
8. Tunggu 1-2 menit...
9. Muncul tulisan **"Congratulations!"** dan link website Anda! 🎉

Website Anda sudah online dengan alamat seperti: `meaningedu.vercel.app`

---

## 🔄 Cara Update Website Setelah Edit

Setiap kali Anda mengubah file dan ingin update website online:

1. Buka Terminal di VSCode
2. Ketik satu per satu:
   ```
   git add .
   git commit -m "Update tampilan halaman utama"
   git push
   ```
3. Vercel otomatis mendeteksi perubahan dan update website dalam 1-2 menit!

---

## 🎨 Cara Mengubah Tampilan (Tanpa Coding)

### Ganti Warna Utama
Buka `style.css`, cari bagian `:root {` di baris paling atas.
- `--forest: #1A3A2A` → warna hijau tua (ubah angka hex untuk ganti warna)
- `--gold: #C8A84B`   → warna emas
- `--cream: #F5F0E8`  → warna krem/background

### Ganti Teks
Buka `index.html`, cari teks yang ingin diubah dan langsung edit.

### Tambah Gambar
1. Simpan gambar di folder `meaningedu/`
2. Di HTML, tambahkan: `<img src="nama-gambar.jpg" alt="Deskripsi" />`

---

## 📱 Fitur Offline (PWA)

Website ini sudah disiapkan sebagai Progressive Web App (PWA):
- Pengunjung bisa "install" website seperti aplikasi di HP
- Halaman tetap terbuka walau internet mati (dari cache)
- File `sw.js` dan `manifest.json` sudah mengurus ini secara otomatis

---

## ❓ Masalah Umum & Solusinya

| Masalah | Solusi |
|---------|--------|
| "git is not recognized" | Install Git dari https://git-scm.com |
| "Permission denied" di GitHub | Gunakan Personal Access Token, bukan password biasa |
| Website tidak update di Vercel | Pastikan sudah `git push`, cek tab "Deployments" di Vercel |
| Live Server tidak muncul di VSCode | Install ekstensi "Live Server" oleh Ritwick Dey |

---

## 📌 Catatan Penting

- Frontend ini adalah **tampilan saja** — belum ada data sungguhan
- Tombol Login/Daftar belum berfungsi penuh (akan disambung ke Backend di tahap berikutnya)
- Backend (Railway) akan menangani: database, login nyata, penyimpanan jurnal, kalkulasi MLI
