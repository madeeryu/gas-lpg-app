# MASTER PROMPT — Aplikasi Manajemen Gas LPG 3 Kg
> Dokumen ini berisi SELURUH konteks, keputusan desain, formula, dan spesifikasi fitur.
> Gunakan dokumen ini sebagai briefing awal di chat baru agar pembahasan tetap nyambung.

---

## INSTRUKSI UNTUK CLAUDE DI CHAT BARU

Kamu adalah developer yang membantu saya membangun aplikasi manajemen distribusi Gas LPG 3 Kg.
Semua keputusan desain, formula, dan fitur sudah disepakati dan ada di dokumen ini.
JANGAN tanya ulang hal yang sudah ada di dokumen ini. Langsung lanjutkan dari mana yang diminta.

---

## 1. KONTEKS BISNIS

- Usaha: Pangkalan Gas LPG 3 Kg
- Pelanggan: ~80-90 pelanggan tetap (rumah tangga & usaha mikro/makro)
- Karyawan: 1 orang kurir yang mengantar gas ke pelanggan
- Pengguna aplikasi: 2 orang (1 majikan/owner, 1 karyawan/kurir)
- Sistem penjualan: berbasis permintaan pelanggan + karyawan aktif menawarkan ke pelanggan langganan
- Pengiriman stok dari agen: dijadwalkan setiap Senin (1 minggu sekali)
- Jam kerja karyawan: 07.00 – 17.00

---

## 2. PLATFORM & TEKNOLOGI (SEMUA GRATIS)

| Komponen | Teknologi | Alasan |
|---|---|---|
| Tipe aplikasi | PWA (Progressive Web App) | Buka di browser, tanpa install, bisa di HP & laptop |
| Database & Backend | Firebase (Firestore + Auth + Hosting) | Gratis untuk 2 user, server Google 24/7 |
| Maps | Leaflet.js + OpenStreetMap | Gratis, tidak perlu API key berbayar |
| Frontend Framework | React (Vite) | Ringan, ekosistem besar |
| Deploy | Vercel | Gratis, auto-deploy dari GitHub |
| Notifikasi | Browser Push Notification (Web Push API) | Gratis, langsung ke HP tanpa WhatsApp |
| Live Tracking | Browser Geolocation API | Gratis, built-in di semua HP modern |

**PENTING:** Laptop majikan BUKAN server. Firebase milik Google yang jadi server.

---

## 3. SISTEM AUTENTIKASI & ROLE

- Satu aplikasi, dua tampilan berbeda berdasarkan login
- Firebase Authentication (email + password)
- **Akun Majikan (role: owner)**
  - Akses penuh: dashboard, peta, monitoring, rekap global, CRUD semua data
  - Bisa dari laptop maupun HP kapan saja
- **Akun Karyawan (role: employee)**
  - Tampilan simpel: input transaksi harian, aktifkan GPS
  - GPS aktif otomatis 07.00–17.00 saat login
  - Tidak bisa akses rekap keuangan

---

## 4. DATABASE SCHEMA (FIRESTORE)

### Collection: `settings`
```
doc: config {
  harga_beli: 16000,          // bisa diubah oleh majikan (CRUD)
  total_tabung: 895,          // total tabung yang dimiliki (CRUD)
  jam_mulai_tracking: "07:00",
  jam_selesai_tracking: "17:00",
  komisi_17000: 300,          // komisi per tabung harga jual 17.000
  komisi_above_17000: 500,    // komisi per tabung harga jual > 17.000
  bonus_bulanan_17000: 100,   // bonus bulanan per tabung harga 17.000
  bonus_bulanan_above: 200,   // bonus bulanan per tabung harga > 17.000
  repeat_order_hari: 3        // batas hari sebelum alert muncul
}
```

### Collection: `pelanggan`
```
doc: {auto-id} {
  nama: "Ahmad Subarjo",
  jenis: "Rumah Tangga",        // Rumah Tangga / Usaha Mikro / Usaha Makro
  harga_jual: 17500,            // harga jual ke pelanggan ini (CRUD)
  lat: -7.7956,                 // koordinat (diinput via klik peta)
  lng: 110.3695,
  aktif: true,
  created_at: timestamp,
  last_order: timestamp         // diupdate otomatis setiap ada transaksi
}
```

### Collection: `transaksi`
```
doc: {auto-id} {
  pelanggan_id: "ref_to_pelanggan",
  pelanggan_nama: "Ahmad Subarjo",
  harga_jual: 17500,
  jumlah_tabung: 3,
  total_pendapatan: 52500,      // jumlah_tabung × harga_jual
  modal: 48000,                 // jumlah_tabung × harga_beli (dari settings)
  komisi_karyawan: 900,         // jumlah_tabung × komisi sesuai harga_jual
  tanggal: "2026-04-09",
  timestamp: timestamp,
  karyawan_id: "uid_karyawan",
  bulan: "2026-04"              // untuk query bulanan
}
```

### Collection: `stok_harian`
```
doc: {tanggal: "2026-04-09"} {
  pengisian: 290,               // tabung masuk dari agen
  penjualan: 237,               // diambil otomatis dari SUM transaksi hari itu
  tabung_kosong: 413,           // dihitung: kosong_kemarin - pengisian + penjualan
  tabung_isi: 482,              // dihitung: total_tabung - tabung_kosong
  diinput_oleh: "uid_majikan",
  timestamp: timestamp
}
```

### Collection: `pengeluaran`
```
doc: {auto-id} {
  tanggal: "2026-04-09",
  kategori: "gaji karyawan",    // bebas diisi majikan
  nominal: 150000,
  keterangan: "gaji harian senin",
  bulan: "2026-04"
}
```

### Collection: `jadwal_pengiriman`
```
doc: {auto-id} {
  tanggal_senin: "2026-04-07",  // tanggal Senin minggu itu
  jumlah_tabung: 290,           // tabung dipesan dari agen
  biaya: 4640000,               // 290 × 16000
  status: "confirmed",
  catatan: "..."
}
```

### Collection: `lokasi_karyawan`
```
doc: {uid_karyawan} {
  lat: -7.7956,
  lng: 110.3695,
  timestamp: timestamp,
  aktif: true                   // false di luar jam 07.00-17.00
}
```

---

## 5. FORMULA LENGKAP

### A. Stok Tabung Harian
```
Tabung Kosong (hari X+1) = Tabung Kosong (X) − Pengisian (X) + Penjualan (X)
Tabung Isi (hari X)      = Total Tabung (895) − Tabung Kosong (X)

Stok awal bulan = carry over Tabung Kosong dari akhir bulan lalu (input manual)
Pengisian       = input manual setiap Senin (sesuai jadwal dari agen)
Penjualan       = otomatis dari SUM transaksi hari itu
```

### B. Keuangan Per Transaksi
```
Modal per transaksi      = jumlah_tabung × harga_beli (default Rp 16.000, bisa diubah)
Pendapatan per transaksi = jumlah_tabung × harga_jual pelanggan
```

### C. Rekapan Harian
```
Total Pendapatan  = Σ pendapatan semua transaksi hari itu
Total Modal       = Σ jumlah_tabung semua transaksi × harga_beli
Total Tabung      = Σ jumlah_tabung semua transaksi
Bruto             = Total Pendapatan − Total Modal
Total Pengeluaran = Σ semua pengeluaran hari itu (input majikan)
Gaji Karyawan     = Σ komisi per transaksi (otomatis dari transaksi)
Netto             = Total Pendapatan − Total Modal − Total Pengeluaran
```

### D. Gaji / Komisi Karyawan Harian
```
Per tabung ke pelanggan harga Rp 17.000        → komisi Rp 300 / tabung
Per tabung ke pelanggan harga > Rp 17.000      → komisi Rp 500 / tabung

Gaji Harian = (Σ tabung harga 17rb × 300) + (Σ tabung harga >17rb × 500)
```
*Semua angka komisi bisa diubah di settings (CRUD)*

### E. Bonus Bulanan Karyawan
```
Bonus = (Σ tabung harga 17rb seluruh bulan × Rp 100)
      + (Σ tabung harga >17rb seluruh bulan × Rp 200)

→ Masuk kolom tersendiri di Rekap Bulanan
→ Mengurangi Netto Bulanan
```
*Semua angka bonus bisa diubah di settings (CRUD)*

### F. Rekap Bulanan
```
Total Modal Bulan       = Σ Total Modal semua hari
Total Omzet Bulan       = Σ Total Pendapatan semua hari
Total Pengeluaran Bulan = Σ semua pengeluaran + Σ gaji harian
Bonus Karyawan          = dihitung dari formula E (kolom tersendiri)
Netto Bulan             = Total Omzet − Total Modal − Total Pengeluaran − Bonus
```

---

## 6. FITUR LENGKAP PER ROLE

### MAJIKAN (Owner)

#### 6.1 Dashboard Utama
- Ringkasan hari ini: total tabung terjual, pendapatan, bruto, netto
- Stok tabung hari ini: isi & kosong
- Jumlah pelanggan sudah order vs belum order hari ini
- Alert: daftar pelanggan yang >3 hari belum order (bisa dikonfigurasi)
- Shortcut ke semua fitur

#### 6.2 Peta Pelanggan (Monitoring Utama)
- Tampilkan semua ~90 titik pelanggan di peta
- **Pin Hijau** = sudah order dalam 3 hari terakhir
- **Pin Merah** = belum order lebih dari 3 hari (perlu didatangi)
- **Pin Biru bergerak** = posisi real-time karyawan (aktif 07.00–17.00)
- Klik pin pelanggan → popup: nama, harga jual, last order, total tabung bulan ini
- Filter: tampilkan semua / hanya yang belum order / hanya yang sudah order

#### 6.3 Monitoring Repeat Order
- List pelanggan diurutkan dari yang paling lama tidak order
- Tampilan harian dan mingguan (toggle)
- Indikator: X hari belum beli, terakhir beli tanggal Y
- Bisa tap nama pelanggan → lihat histori order-nya
- Push notifikasi ke HP majikan saat ada pelanggan melewati batas hari

#### 6.4 Pencatatan Transaksi Global
- Tabel per pelanggan × per tanggal (mirip sheet Catatan Penjualan di Excel)
- Kolom: Nama Pelanggan | Harga | per tanggal: [Tabung] [Total Rp]
- Baris total bawah: total tabung + total pendapatan + modal + bruto per hari
- Filter per bulan
- Bisa export ke Excel/CSV

#### 6.5 Rekapan Harian
- Per hari: daftar pengeluaran (bisa tambah/edit/hapus bebas)
- Otomatis tampil: omzet, modal, gaji karyawan, bruto, netto
- Input pengisian stok tabung (jumlah & otomatis hitung biaya)
- Stok tabung otomatis terhitung

#### 6.6 Rekap Bulanan
- Total omzet, modal, pengeluaran, gaji, bruto, netto
- Kolom bonus karyawan tersendiri
- Netto akhir = setelah dikurangi semua + bonus
- Filter per bulan

#### 6.7 Manajemen Pelanggan (CRUD)
- Tambah pelanggan: nama, jenis, harga jual, klik peta untuk koordinat
- Edit data pelanggan (nama, harga, lokasi)
- Nonaktifkan pelanggan (soft delete, data transaksi tetap tersimpan)
- Lihat histori order per pelanggan

#### 6.8 Jadwal Pengiriman (Stok dari Agen)
- Input jadwal pengiriman setiap Senin: jumlah tabung, estimasi biaya
- Riwayat pengiriman per bulan
- Otomatis masuk ke perhitungan stok

#### 6.9 Pengaturan / Settings (CRUD)
- Harga beli gas per tabung (default Rp 16.000)
- Total tabung yang dimiliki (default 895)
- Komisi karyawan: harga 17rb → Rp 300, harga >17rb → Rp 500
- Bonus bulanan: harga 17rb → Rp 100, harga >17rb → Rp 200
- Batas hari repeat order alert (default 3 hari)
- Jam tracking GPS (default 07.00–17.00)
- Semua bisa diedit kapan saja

---

### KARYAWAN (Kurir)

#### 6.10 Halaman Utama Karyawan
- Tampilan simpel & besar (mobile-first)
- Tombol besar: "Catat Pengiriman"
- Status GPS: aktif/nonaktif
- Ringkasan hari ini: sudah antar X tabung ke X pelanggan

#### 6.11 Input Transaksi
- Ketik nama pelanggan → autocomplete muncul saran
- Pilih pelanggan → harga jual otomatis terisi (tidak bisa diubah karyawan)
- Input jumlah tabung
- Total otomatis terhitung
- Tombol simpan → data langsung masuk ke Firestore
- Rekap global di sisi majikan terupdate real-time

#### 6.12 GPS Live Tracking
- Aktif otomatis pada jam 07.00–17.00 saat karyawan login
- Di luar jam tersebut, lokasi tidak dikirim
- Update posisi setiap 30 detik ke Firestore
- Karyawan bisa lihat posisi sendiri di peta kecil (opsional)

---

## 7. DESAIN UI/UX

### Prinsip
- Mobile-first (karyawan pakai HP, majikan bisa laptop)
- Warna utama: Hijau (#1D9E75) untuk aksen positif
- Font: sistem default (cepat load)
- Navigasi bawah untuk mobile (bottom tab bar)
- Semua angka Rupiah: format Rp 17.500 (bukan 17500)

### Navigasi Majikan (Bottom Tab)
```
[Peta] [Monitoring] [Transaksi] [Rekap] [Pengaturan]
```

### Navigasi Karyawan (Simpel)
```
[Catat Kirim] [Riwayat Hari Ini]
```

### Warna Pin Peta
- Hijau: sudah order ≤ 3 hari
- Merah: belum order > 3 hari
- Biru bergerak: posisi karyawan real-time

---

## 8. URUTAN BUILD (BERTAHAP)

### Tahap 1 — Fondasi (wajib selesai dulu)
- [ ] Setup Firebase project (Auth, Firestore, Hosting)
- [ ] Setup React + Vite + Vercel deploy
- [ ] Sistem login (majikan & karyawan)
- [ ] CRUD Pelanggan + input koordinat via klik peta
- [ ] Peta dasar dengan Leaflet + tampilkan pin pelanggan

### Tahap 2 — Input & Transaksi
- [ ] Halaman input transaksi karyawan (autocomplete, harga otomatis)
- [ ] Data transaksi masuk Firestore real-time
- [ ] Last order pelanggan terupdate otomatis
- [ ] Warna pin peta berubah otomatis (hijau/merah)

### Tahap 3 — Monitoring & Alert
- [ ] Halaman monitoring repeat order (harian & mingguan)
- [ ] Push notification ke HP majikan
- [ ] Live tracking GPS karyawan di peta (07.00–17.00)

### Tahap 4 — Rekap & Keuangan
- [ ] Rekapan harian (pengeluaran + kalkulasi otomatis)
- [ ] Input stok tabung harian
- [ ] Rekap bulanan + bonus karyawan
- [ ] Halaman Catatan Penjualan (tabel per pelanggan per hari)

### Tahap 5 — Polish
- [ ] Settings CRUD (harga beli, komisi, dll)
- [ ] Jadwal pengiriman dari agen
- [ ] Export Excel/CSV
- [ ] PWA manifest (bisa "install" di homescreen)
- [ ] Optimasi performa & offline support

---

## 9. PERTANYAAN YANG SUDAH DIJAWAB (JANGAN TANYA LAGI)

| Pertanyaan | Jawaban |
|---|---|
| Server pakai apa? | Firebase (Google), bukan laptop |
| Install atau browser? | PWA, buka di browser |
| Input nama pelanggan saat transaksi? | Ketik + autocomplete |
| Siapa input pengeluaran? | Majikan saja |
| Notifikasi alert repeat order? | Push notif browser |
| Koordinat pelanggan bagaimana? | Klik peta saat setup, tersimpan otomatis |
| Data pelanggan di Excel asli atau dummy? | Dummy, nama asli harus diinput manual |
| HP karyawan sendiri atau kantor? | HP sendiri |
| Jam tracking GPS? | 07.00 – 17.00 |
| Harga beli gas bisa berubah? | Ya, bisa diedit di settings |
| Jadwal pengiriman agen ke pangkalan? | Setiap Senin, 1 minggu sekali |
| Sistem penjualan ke konsumen? | Permintaan pelanggan + karyawan aktif menawarkan |
| Semua konfigurasi bisa diedit? | Ya, semua CRUD di halaman Settings |
| Bonus karyawan masuk ke mana? | Kolom tersendiri di Rekap Bulanan, mengurangi Netto |
| Stok awal bulan dari mana? | Carry over dari akhir bulan lalu |

---

## 10. CATATAN TEKNIS PENTING

1. **Real-time**: Firestore onSnapshot dipakai untuk transaksi & lokasi karyawan
2. **Offline support**: Firestore punya offline cache bawaan, transaksi tetap bisa diinput meski sinyal lemah
3. **Keamanan**: Firestore Security Rules — karyawan hanya bisa write ke collection transaksi & lokasi_karyawan miliknya
4. **Harga beli**: Disimpan di settings, bukan hardcode. Perubahan harga hanya berlaku untuk transaksi setelah tanggal perubahan
5. **Last order**: Field `last_order` di collection pelanggan diupdate setiap ada transaksi baru
6. **Pin merah/hijau**: Dihitung dari `last_order` dibandingkan `Date.now()`, threshold dari `settings.repeat_order_hari`
7. **Bonus bulanan**: Dihitung on-the-fly dari query transaksi bulan itu, tidak disimpan terpisah kecuali di rekap bulanan
8. **Export**: Gunakan library SheetJS (xlsx) untuk export ke Excel

---

*Dokumen ini dibuat pada 9 April 2026. Versi final sebelum build dimulai.*
