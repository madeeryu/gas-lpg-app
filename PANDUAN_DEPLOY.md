# 📱 Panduan Deploy — Aplikasi Gas LPG

## Ringkasan Aplikasi
- **Tipe**: Progressive Web App (PWA) — bisa diakses dari browser HP & laptop
- **Tidak perlu install** — cukup buka URL, bisa "Add to Home Screen"
- **Backend**: Firebase (Google) — gratis untuk skala kecil
- **Offline**: Firestore punya cache otomatis, transaksi tetap bisa diinput

---

## LANGKAH 1 — Buat Firebase Project

1. Buka https://console.firebase.google.com
2. Klik **"Add project"** → isi nama: `gas-lpg-pangkalan` → Continue
3. Disable Google Analytics (tidak perlu) → Create project

### 1a. Setup Authentication
1. Di sidebar, klik **Authentication** → Get started
2. Pilih **Email/Password** → Enable → Save
3. Klik tab **Users** → Add user:
   - Email: `majikan@gaslpg.com` · Password: `123456`
   - Email: `karyawan@gaslpg.com` · Password: `123456`
4. **Catat UID** masing-masing user (klik titik 3 → copy UID)

### 1b. Setup Firestore
1. Di sidebar, klik **Firestore Database** → Create database
2. Pilih **"Start in production mode"** → pilih region **asia-southeast1** → Enable
3. Di tab **Rules**, copy-paste isi file `firestore.rules` → Publish

### 1c. Ambil Firebase Config
1. Klik ikon ⚙️ (Project settings)
2. Scroll ke **Your apps** → Klik ikon Web (`</>`)
3. Isi App nickname: `gas-lpg-web` → Register app
4. Copy seluruh `firebaseConfig = { ... }`

---

## LANGKAH 2 — Pasang Config ke index.html

Buka `index.html`, cari bagian ini dan **ganti seluruh isinya**:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",           // ← ganti
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",  // ← ganti
  projectId: "YOUR_PROJECT_ID",     // ← ganti
  storageBucket: "YOUR_PROJECT_ID.appspot.com",   // ← ganti
  messagingSenderId: "YOUR_SENDER_ID",  // ← ganti
  appId: "YOUR_APP_ID"              // ← ganti
};
```

---

## LANGKAH 3 — Setup Data Awal

1. Deploy dulu ke Vercel (Langkah 4)
2. Buka URL aplikasi → login sebagai majikan
3. Buka **Developer Tools** browser (F12) → tab **Console**
4. Buka file `setup-firebase.js`, isi `OWNER_UID` dan `EMPLOYEE_UID` dengan UID yang tadi dicatat
5. Paste seluruh isi file ke console → Enter
6. Ketik: `setupInitialData()` → Enter
7. Tunggu sampai muncul "Setup selesai!"
8. Refresh halaman

---

## LANGKAH 4 — Deploy ke Vercel (GRATIS)

### Cara Paling Mudah (Drag & Drop):
1. Buka https://vercel.com → Sign up pakai GitHub/Google (gratis)
2. Klik **"Add New → Project"**
3. Pilih **"Import from..."** → pilih **"Upload folder"** atau gunakan metode GitHub

### Via GitHub (Rekomendasi):
1. Buat akun GitHub di https://github.com
2. Buat repository baru: `gas-lpg-app`
3. Upload semua file (`index.html`, `manifest.json`, `sw.js`)
4. Di Vercel → **Import Git Repository** → pilih repo tadi
5. **Deploy** → tunggu ~30 detik
6. Dapat URL seperti: `https://gas-lpg-app.vercel.app`

### Via Vercel CLI (Terminal):
```bash
npm i -g vercel
cd gas-lpg-app
vercel --prod
```

---

## LANGKAH 5 — Tambahkan Domain ke Firebase

Setelah dapat URL Vercel:
1. Firebase Console → Authentication → Settings → **Authorized domains**
2. Klik **Add domain** → masukkan domain Vercel kamu
   Contoh: `gas-lpg-app.vercel.app`
3. Save

---

## LANGKAH 6 — Bagikan ke Karyawan

1. Kirim URL ke HP karyawan via WhatsApp
2. Karyawan buka URL di Chrome/Safari
3. Chrome: tap menu (⋮) → **"Add to Home Screen"**
4. Ikon aplikasi muncul di home screen seperti app biasa
5. Login dengan: `karyawan@gaslpg.com` / `123456`

---

## CARA GANTI PASSWORD
1. Firebase Console → Authentication → Users
2. Klik titik 3 di samping email → **Reset password** atau **Edit user**
3. Ganti password sesuai kebutuhan

---

## FITUR LENGKAP APLIKASI

### Tampilan Majikan (Owner):
| Halaman | Fungsi |
|---------|--------|
| Dashboard | Ringkasan harian: tabung, pendapatan, alert pelanggan |
| Peta | Semua titik pelanggan, live tracking karyawan, pin hijau/merah |
| Monitor | Daftar pelanggan belum order, urut dari paling lama |
| Rekap | Rekap harian (dengan pengeluaran) & bulanan (dengan bonus) |
| Pelanggan | CRUD pelanggan: tambah, edit, nonaktifkan |
| Pengaturan | Edit harga beli, komisi, bonus, jam GPS, batas alert |

### Tampilan Karyawan:
| Halaman | Fungsi |
|---------|--------|
| Beranda | Tombol catat pengiriman, ringkasan hari ini, komisi |
| Catat Pengiriman | Autocomplete nama, harga otomatis, total otomatis |
| Riwayat | Lihat riwayat pengiriman per tanggal |

### Fitur Otomatis:
- ✅ GPS aktif otomatis jam 07:00–17:00 saat karyawan login
- ✅ Last order pelanggan update otomatis setiap ada transaksi
- ✅ Pin peta berubah merah/hijau otomatis berdasarkan last order
- ✅ Kalkulasi komisi, modal, bruto, netto otomatis
- ✅ Dashboard majikan update real-time saat karyawan input transaksi
- ✅ Bisa digunakan offline (Firestore cache)

---

## FORMULA YANG DIGUNAKAN

```
Modal per transaksi      = jumlah_tabung × harga_beli
Pendapatan per transaksi = jumlah_tabung × harga_jual
Bruto                    = Total Pendapatan − Total Modal
Netto                    = Bruto − Gaji Karyawan − Pengeluaran Lain

Gaji Harian Karyawan:
  Tabung harga Rp 17.000 → komisi Rp 300/tabung
  Tabung harga > Rp 17.000 → komisi Rp 500/tabung

Bonus Bulanan:
  Tabung harga Rp 17.000 → Rp 100/tabung
  Tabung harga > Rp 17.000 → Rp 200/tabung

Stok:
  Tabung Kosong = KemarinKosong − Pengisian + Penjualan
  Tabung Isi    = Total Tabung − Tabung Kosong
```
*Semua angka bisa diubah di halaman Pengaturan*

---

## TROUBLESHOOTING

| Masalah | Solusi |
|---------|--------|
| Login error "invalid credential" | Pastikan config Firebase sudah diganti dengan benar |
| "Permission denied" di Firestore | Pastikan `firestore.rules` sudah di-copy dan di-publish |
| GPS tidak aktif | Izinkan akses lokasi di browser saat diminta |
| Peta tidak muncul | Periksa koneksi internet (Leaflet butuh internet) |
| Data tidak muncul setelah setup | Refresh halaman, atau clear cache browser |
| Domain tidak authorized | Tambahkan domain di Firebase → Auth → Authorized domains |

---

## BIAYA OPERASIONAL
- Firebase Spark Plan (gratis): 50K reads/hari, 20K writes/hari
- Untuk 2 user dengan ~100 transaksi/hari: **masih jauh di bawah limit gratis**
- Vercel: gratis untuk personal project
- Total biaya bulanan: **Rp 0**

---

*Dibuat: 9 April 2026 | Versi 1.0*
