// ============================================================
// SETUP SCRIPT — Jalankan sekali untuk inisialisasi data awal
// Buka browser console di halaman index.html, paste & enter
// ============================================================
//
// LANGKAH SEBELUM PAKAI SCRIPT INI:
// 1. Buat Firebase project di https://console.firebase.google.com
// 2. Enable Authentication > Email/Password
// 3. Buat Firestore database (production mode)
// 4. Copy firebaseConfig ke index.html (ganti placeholder)
// 5. Buat 2 user di Firebase Auth Console:
//    - majikan@gaslpg.com (atau email bebas) / password 123456
//    - karyawan@gaslpg.com (atau email bebas) / password 123456
//    Catat UID masing-masing user
// 6. Jalankan script ini dari browser console

// ===================
// GANTI NILAI INI:
// ===================
const OWNER_UID = 'DNbDUti1EZMV71ag6SK3k9pfLEJ3';
const EMPLOYEE_UID = '67nnjHh5mYR9qYWqrRZJt6XBYwA3';

// Script setup Firestore (jalankan di console browser setelah login sebagai owner)
async function setupInitialData() {
  const { getFirestore, doc, setDoc, addDoc, collection, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  // db sudah tersedia dari app
  const db = window.__firebaseDb; // akan tersedia setelah app load

  console.log('🔧 Memulai setup data awal...');

  // 1. Set role user
  await setDoc(doc(db, 'users', OWNER_UID), { role: 'owner', email: 'majikan@gaslpg.com', nama: 'Pak Majikan' });
  await setDoc(doc(db, 'users', EMPLOYEE_UID), { role: 'employee', email: 'karyawan@gaslpg.com', nama: 'Pak Kurir' });
  console.log('✅ User roles set');

  // 2. Settings default
  await setDoc(doc(db, 'settings', 'config'), {
    harga_beli: 16000,
    total_tabung: 895,
    jam_mulai_tracking: "07:00",
    jam_selesai_tracking: "17:00",
    komisi_17000: 300,
    komisi_above_17000: 500,
    bonus_bulanan_17000: 100,
    bonus_bulanan_above: 200,
    repeat_order_hari: 3
  });
  console.log('✅ Settings created');

  // 3. Sample pelanggan (10 dummy)
  const samplePelanggan = [
    { nama: 'Ahmad Subarjo', jenis: 'Rumah Tangga', harga_jual: 17500, lat: -7.7956, lng: 110.3695, aktif: true },
    { nama: 'Siti Rahayu', jenis: 'Rumah Tangga', harga_jual: 17000, lat: -7.7980, lng: 110.3720, aktif: true },
    { nama: 'Budi Santoso', jenis: 'Usaha Mikro', harga_jual: 19000, lat: -7.7940, lng: 110.3660, aktif: true },
    { nama: 'Linda Wijaya', jenis: 'Usaha Mikro', harga_jual: 18500, lat: -7.8010, lng: 110.3680, aktif: true },
    { nama: 'Siti Aminah', jenis: 'Rumah Tangga', harga_jual: 18000, lat: -7.7920, lng: 110.3710, aktif: true },
    { nama: 'Dewa Putu', jenis: 'Usaha Makro', harga_jual: 17000, lat: -7.7960, lng: 110.3750, aktif: true },
    { nama: 'Maya Kartika', jenis: 'Rumah Tangga', harga_jual: 17000, lat: -7.7990, lng: 110.3700, aktif: true },
    { nama: 'Bambang Heru', jenis: 'Usaha Mikro', harga_jual: 17500, lat: -7.7935, lng: 110.3680, aktif: true },
    { nama: 'Dewi Susanti', jenis: 'Rumah Tangga', harga_jual: 17000, lat: -7.7970, lng: 110.3730, aktif: true },
    { nama: 'Rini Wulandari', jenis: 'Usaha Mikro', harga_jual: 18000, lat: -7.7950, lng: 110.3670, aktif: true },
  ];

  // Assign last_order dates (beberapa hari lalu untuk demo)
  const now = new Date();
  const daysAgo = [1, 2, 7, 4, 5, 4, 3, 3, 1, 2]; // hari terakhir order

  for(let i = 0; i < samplePelanggan.length; i++) {
    const p = samplePelanggan[i];
    const lastOrderDate = new Date(now);
    lastOrderDate.setDate(lastOrderDate.getDate() - daysAgo[i]);
    p.last_order = lastOrderDate;
    p.created_at = serverTimestamp();
    await addDoc(collection(db, 'pelanggan'), p);
  }
  console.log('✅ 10 sample pelanggan created');

  // 4. Stok hari ini (demo)
  const todayStr = new Date().toISOString().split('T')[0];
  await setDoc(doc(db, 'stok_harian', todayStr), {
    pengisian: 0,
    penjualan: 47,
    tabung_kosong: 413,
    tabung_isi: 482,
    diinput_oleh: OWNER_UID,
  });
  console.log('✅ Stok harian created');

  console.log('🎉 Setup selesai! Refresh halaman dan login.');
}

// Panggil:
// setupInitialData();
