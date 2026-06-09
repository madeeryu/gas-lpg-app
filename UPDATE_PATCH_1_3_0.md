# UPDATE PATCH 1.3.0 — Gas LPG PWA
> Cara pakai: Buka `index.html`, cari teks **CARI:** lalu ganti/tambahkan sesuai petunjuk.
> Kerjakan dari atas ke bawah sesuai urutan.

---

## 📋 RINGKASAN PERUBAHAN

| No | Fitur | Lokasi Utama |
|----|-------|-------------|
| 1 | Rekap harian: detail piutang + cicilan realtime | `loadRekapHarian()` |
| 2 | Karyawan: kelola piutang + riwayat realtime | `refreshKaryawanHome()`, `loadRiwayatKaryawan()`, HTML modal |
| 3 | Stok otomatis update setiap transaksi | `saveTransaksi()`, `initOwnerApp()` |

---

## ═══════════════════════════════════════════
## FITUR 1 — Rekap Harian: Detail Cicilan Piutang
## ═══════════════════════════════════════════

### 1A — Tambah subscriber piutang realtime di `initOwnerApp()`

**Lokasi:** Cari fungsi `function initOwnerApp() {`

**CARI baris ini (subscriber pelunasan yang sudah ada dari patch 1.2.0):**
```javascript
  // Load pelunasan hari ini real-time
  const todayStrPel = today();
  const unsubPelunasan = onSnapshot(
    query(collection(db, 'pelunasan'), where('tanggal', '==', todayStrPel)),
    (snap) => {
      STATE.pelunasanHariIni = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      refreshDashboard();
    }
  );
  STATE.unsubscribers.push(unsubPelunasan);
```

**GANTI DENGAN (tambah subscriber cicilan di bawahnya):**
```javascript
  // Load pelunasan hari ini real-time
  const todayStrPel = today();
  const unsubPelunasan = onSnapshot(
    query(collection(db, 'pelunasan'), where('tanggal', '==', todayStrPel)),
    (snap) => {
      STATE.pelunasanHariIni = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      refreshDashboard();
      // Jika rekap harian sedang terbuka & tanggalnya hari ini, refresh otomatis
      if (STATE.currentPage === 'rekap') {
        const tgl = document.getElementById('rekap-date')?.value;
        if (tgl === today()) loadRekapHarian();
      }
    }
  );
  STATE.unsubscribers.push(unsubPelunasan);

  // Subscribe piutang realtime (untuk update status di rekap)
  const unsubPiutang = onSnapshot(
    collection(db, 'piutang'),
    (snap) => {
      STATE._piutangCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Refresh rekap jika sedang aktif
      if (STATE.currentPage === 'rekap') {
        const tgl = document.getElementById('rekap-date')?.value;
        if (tgl === today()) loadRekapHarian();
      }
    }
  );
  STATE.unsubscribers.push(unsubPiutang);
```

---

### 1B — Tambah field `_piutangCache` ke STATE

**Lokasi:** Cari `window.STATE = {`

**CARI baris terakhir dalam object STATE (sekitar):**
```javascript
  pelunasanHariIni: [],
```

**TAMBAHKAN setelah baris itu:**
```javascript
  pelunasanHariIni: [],
  _piutangCache: [],        // ← TAMBAHKAN INI
```

---

### 1C — Ganti fungsi `loadRekapHarian()` — bagian HTML render card pertama

Ini adalah perubahan terbesar. Cari bagian `contentEl.innerHTML = \`` di `loadRekapHarian`, tepatnya **card pertama** yang berisi ringkasan keuangan.

**CARI blok ini (tepat di dalam contentEl.innerHTML, card pertama):**
```javascript
      <div class="card">
        <div class="keu-row"><span class="kl">Total tabung keluar</span><span class="kv">${totalTabung} tabung</span></div>
        <div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">
          <div style="display:flex;justify-content:space-between;color:var(--text3);padding:2px 0">
            <span>→ Cash</span><span>${tabungCash} tabung (${fmt(trxCash.reduce((a,t)=>a+(t.total_pendapatan||0),0))})</span>
          </div>
          ${tabungDP > 0 ? `<div style="display:flex;justify-content:space-between;color:var(--amber-dark);padding:2px 0"><span>→ DP</span><span>${tabungDP} tabung (kas: ${fmt(trxDP.reduce((a,t)=>a+(t.nominal_dibayar||0),0))}, hutang: ${fmt(trxDP.reduce((a,t)=>a+(t.sisa_hutang||0),0))})</span></div>` : ''}
          ${tabungHutang > 0 ? `<div style="display:flex;justify-content:space-between;color:var(--red-dark);padding:2px 0"><span>→ Hutang</span><span>${tabungHutang} tabung (${fmt(trxHutang.reduce((a,t)=>a+(t.total_pendapatan||0),0))})</span></div>` : ''}
        </div>
        <div class="keu-row"><span class="kl">Kas masuk hari ini</span><span class="kv green">${fmt(kasTransaksiHariIni)}</span></div>
        ${kasPelunasanHariIni > 0 ? `<div class="keu-row"><span class="kl">+ Pelunasan hutang</span><span class="kv green">${fmt(kasPelunasanHariIni)}</span></div>` : ''}
        ${totalPiutangBaru > 0 ? `<div class="keu-row"><span class="kl">Piutang baru (bon)</span><span class="kv" style="color:var(--amber-dark)">${fmt(totalPiutangBaru)}</span></div>` : ''}
        <div class="keu-row"><span class="kl">Total modal (tabung keluar)</span><span class="kv">${fmt(totalModal)}</span></div>
        <div class="keu-row"><span class="kl">Bruto (kas - modal)</span><span class="kv green">${fmt(bruto)}</span></div>
      </div>
```

**GANTI DENGAN:**
```javascript
      ${(() => {
        // Ambil semua piutang aktif dari cache untuk tanggal rekap ini
        const piutangHariIni = (STATE._piutangCache || []).filter(p => p.tanggal_transaksi === dateStr);
        const piutangBelumLunas = piutangHariIni.filter(p => p.status === 'belum_lunas');
        const piutangLunas = piutangHariIni.filter(p => p.status === 'lunas');

        // Cicilan/pelunasan hari ini untuk transaksi dari hari lain
        const cicilanHariIni = pelunasan.filter(p => {
          const piutangAsal = (STATE._piutangCache || []).find(x => x.id === p.piutang_id);
          return piutangAsal && piutangAsal.tanggal_transaksi !== dateStr;
        });
        const totalCicilanLain = cicilanHariIni.reduce((a, p) => a + (p.nominal || 0), 0);

        // Cicilan/pelunasan hari ini untuk transaksi hari ini
        const cicilanHariIniSendiri = pelunasan.filter(p => {
          const piutangAsal = (STATE._piutangCache || []).find(x => x.id === p.piutang_id);
          return piutangAsal && piutangAsal.tanggal_transaksi === dateStr;
        });

        // Hitung sisa piutang (setelah cicilan) untuk semua hutang/DP hari ini
        const sisaPiutangHariIni = piutangBelumLunas.reduce((a, p) => a + (p.sisa_hutang || 0), 0)
          + piutangLunas.reduce((a, p) => a + 0, 0); // lunas = sisa 0
        const nominalPiutangBaru = totalPiutangBaru; // total hutang baru hari ini

        // Render baris cicilan per orang
        const renderCicilan = (cicilanList, label) => cicilanList.map(c => {
          const piutangAsal = (STATE._piutangCache || []).find(x => x.id === c.piutang_id);
          const isLunas = piutangAsal?.status === 'lunas';
          const tgl = c.tanggal || dateStr;
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0 3px 16px;font-size:12px;color:var(--green-dark)">
            <span>${isLunas ? '✓ Lunas' : '↩ Cicil'} <b>${c.pelanggan_nama || piutangAsal?.pelanggan_nama || '-'}</b> <span style="font-size:10px;color:var(--text3)">(${tgl.split('-').reverse().join('/')})</span></span>
            <span style="font-weight:700;color:var(--green-dark)">+${fmt(c.nominal)}</span>
          </div>`;
        }).join('');

        // Render hutang/DP yang belum atau sudah cicil hari ini (dari transaksi hari ini)
        const renderPiutangBaris = piutangHariIni.map(p => {
          const isLunas = p.status === 'lunas';
          const cicilHariIni = cicilanHariIniSendiri.filter(c => c.piutang_id === p.id);
          const totalCicil = cicilHariIni.reduce((a, c) => a + (c.nominal || 0), 0);
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0 3px 16px;font-size:12px">
            <span style="color:${isLunas ? 'var(--green-dark)' : 'var(--amber-dark)'}">
              ${isLunas ? '✓ Lunas' : (totalCicil > 0 ? '↩ Dicicil' : '●')} <b>${p.pelanggan_nama}</b>
            </span>
            <span style="font-weight:700;color:${isLunas ? 'var(--green-dark)' : 'var(--amber-dark)'}">
              ${isLunas ? '✓' : `-${fmt(p.sisa_hutang || 0)}`}
              ${totalCicil > 0 && !isLunas ? `<span style="color:var(--green-dark);margin-left:4px">(+${fmt(totalCicil)} diterima)</span>` : ''}
            </span>
          </div>`;
        }).join('');

        return `<div class="card">
          <div class="keu-row"><span class="kl">Total tabung keluar</span><span class="kv">${totalTabung} tabung</span></div>
          <div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">
            <div style="display:flex;justify-content:space-between;color:var(--text3);padding:2px 0">
              <span>→ Cash</span><span>${tabungCash} tabung (${fmt(trxCash.reduce((a,t)=>a+(t.total_pendapatan||0),0))})</span>
            </div>
            ${tabungDP > 0 ? `<div style="display:flex;justify-content:space-between;color:var(--amber-dark);padding:2px 0"><span>→ DP</span><span>${tabungDP} tabung (kas: ${fmt(trxDP.reduce((a,t)=>a+(t.nominal_dibayar||0),0))}, hutang: ${fmt(trxDP.reduce((a,t)=>a+(t.sisa_hutang||0),0))})</span></div>` : ''}
            ${tabungHutang > 0 ? `<div style="display:flex;justify-content:space-between;color:var(--red-dark);padding:2px 0"><span>→ Hutang</span><span>${tabungHutang} tabung (${fmt(trxHutang.reduce((a,t)=>a+(t.total_pendapatan||0),0))})</span></div>` : ''}
          </div>
          <div class="keu-row"><span class="kl">Kas masuk hari ini</span><span class="kv green">${fmt(kasTransaksiHariIni)}</span></div>
          ${kasPelunasanHariIni > 0 || cicilanHariIni.length > 0 ? `
            <div style="padding:4px 0;border-bottom:1px solid var(--border)">
              <div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0">
                <span style="color:var(--text2)">+ Pembayaran hutang masuk</span>
                <span style="font-weight:700;color:var(--green-dark)">${fmt(kasPelunasanHariIni)}</span>
              </div>
              ${renderCicilan(cicilanHariIni, 'lain')}
              ${renderCicilan(cicilanHariIniSendiri.filter(c => {
                const p = (STATE._piutangCache||[]).find(x=>x.id===c.piutang_id);
                return p?.tanggal_transaksi === dateStr;
              }), 'ini')}
            </div>
          ` : ''}
          ${nominalPiutangBaru > 0 ? `
            <div style="padding:4px 0;border-bottom:1px solid var(--border)">
              <div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0">
                <span style="color:var(--text2)">Piutang baru hari ini (bon)</span>
                <span style="font-weight:700;color:var(--amber-dark)">${fmt(nominalPiutangBaru)}</span>
              </div>
              ${renderPiutangBaris}
              ${sisaPiutangHariIni > 0 ? `
                <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:var(--amber-dark);padding:4px 0;margin-top:2px;border-top:1px dashed var(--border)">
                  <span>Total piutang tersisa</span>
                  <span>${fmt(sisaPiutangHariIni)}</span>
                </div>
              ` : `
                <div style="font-size:11px;color:var(--green-dark);padding:3px 0 3px 16px">✅ Semua hutang hari ini sudah lunas</div>
              `}
            </div>
          ` : ''}
          <div class="keu-row"><span class="kl" style="font-weight:700">Total kas masuk</span><span class="kv green" style="font-size:15px">${fmt(totalKasMasuk)}</span></div>
          <div class="keu-row"><span class="kl">Total modal (tabung keluar)</span><span class="kv">${fmt(totalModal)}</span></div>
          <div class="keu-row"><span class="kl">Bruto (kas - modal)</span><span class="kv green">${fmt(bruto)}</span></div>
        </div>`;
      })()}
```

---

### 1D — Update render daftar transaksi: nominal sesuai kas diterima + realtime piutang

**Lokasi:** Masih di `loadRekapHarian()`, di dalam `contentEl.innerHTML`, di bagian **card Daftar Transaksi** (card paling bawah).

**CARI baris render transaksi ini (bagian `hist-right`):**
```javascript
            <div class="hist-right" style="display:flex;align-items:center;gap:6px">
              <div>
                <div class="hist-amt">${fmt(t.total_pendapatan)}</div>
                <div class="hist-tab">${t.jumlah_tabung} tabung</div>
              </div>
              <button onclick="openEditTransaksi('${t.id}')" style="background:none;border:none;cursor:pointer;font-size:15px;padding:2px" title="Edit">✏️</button>
              <button onclick="deleteTransaksi('${t.id}','${t.pelanggan_id}')" style="background:none;border:none;cursor:pointer;font-size:15px;padding:2px" title="Hapus">🗑️</button>
            </div>
```

**GANTI DENGAN:**
```javascript
            <div class="hist-right" style="display:flex;align-items:center;gap:6px">
              <div>
                ${(() => {
                  const status = t.status_bayar || 'cash';
                  const piutangTrx = (STATE._piutangCache || []).find(p => p.transaksi_id === t.id);
                  const kasNominal = t.nominal_dibayar !== undefined ? t.nominal_dibayar : t.total_pendapatan;
                  const totalCicilanDiterima = piutangTrx
                    ? (piutangTrx.nominal_dibayar || 0) - (t.nominal_dibayar || 0)
                    : 0;
                  const sisaTerkini = piutangTrx ? (piutangTrx.sisa_hutang || 0) : (t.sisa_hutang || 0);
                  const isLunas = piutangTrx?.status === 'lunas';

                  if (status === 'cash') {
                    return `<div class="hist-amt">${fmt(t.total_pendapatan)}</div>
                            <div class="hist-tab">${t.jumlah_tabung} tabung</div>`;
                  } else {
                    const kasTotal = kasNominal + (isLunas ? (t.sisa_hutang || 0) : totalCicilanDiterima);
                    return `<div class="hist-amt">${fmt(kasTotal)}</div>
                            <div class="hist-tab" style="color:var(--amber-dark)">Sisa: ${isLunas ? '✓ Lunas' : fmt(sisaTerkini)}</div>`;
                  }
                })()}
              </div>
              <button onclick="openEditTransaksi('${t.id}')" style="background:none;border:none;cursor:pointer;font-size:15px;padding:2px" title="Edit">✏️</button>
              <button onclick="deleteTransaksi('${t.id}','${t.pelanggan_id}')" style="background:none;border:none;cursor:pointer;font-size:15px;padding:2px" title="Hapus">🗑️</button>
            </div>
```

---

## ═══════════════════════════════════════════
## FITUR 2 — Karyawan Bisa Kelola Piutang
## ═══════════════════════════════════════════

### 2A — Tambah page piutang karyawan di HTML

**Lokasi:** Di HTML (bukan di script). Cari tag penutup `</main>` (ada setelah page karyawan-riwayat).

**CARI:**
```html
  </main>
</div>
```

**TAMBAHKAN page baru SEBELUM `</main>`:**
```html
    <!-- KARYAWAN PIUTANG -->
    <div class="page" id="page-karyawan-piutang">
      <div class="topbar">
        <div class="topbar-inner">
          <div><h2>Piutang Saya</h2><p id="k-piutang-subtitle">Memuat...</p></div>
          <button class="topbar-action" onclick="loadKaryawanPiutang()">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="page-body">
        <!-- Summary -->
        <div class="summary-piutang" style="margin-bottom:12px">
          <div class="metric red">
            <div class="lbl">Total Piutang</div>
            <div class="val" id="k-piu-total" style="font-size:16px">Rp 0</div>
            <div class="sub" id="k-piu-count">0 transaksi</div>
          </div>
          <div class="metric amber">
            <div class="lbl">Pelanggan Berhutang</div>
            <div class="val" id="k-piu-pelanggan">0</div>
            <div class="sub">orang</div>
          </div>
        </div>
        <!-- Filter -->
        <div class="tab-bar">
          <button class="tab-btn active" onclick="filterKaryawanPiutang('belum_lunas', this)">Belum Lunas</button>
          <button class="tab-btn" onclick="filterKaryawanPiutang('lunas', this)">Sudah Lunas</button>
          <button class="tab-btn" onclick="filterKaryawanPiutang('semua', this)">Semua</button>
        </div>
        <div class="card">
          <div id="k-piutang-list">
            <div class="empty-state"><p>Memuat...</p></div>
          </div>
        </div>
      </div>
    </div>
```

---

### 2B — Tambah menu navigasi karyawan: "Piutang"

**Lokasi:** Di dalam fungsi `buildNav()`, cari array `empNav`.

**CARI:**
```javascript
  const empNav = [
    { id: 'karyawan-home', icon: homeIcon(), label: 'Beranda', page: 'page-karyawan-home' },
    { id: 'karyawan-riwayat', icon: rekapIcon(), label: 'Riwayat', page: 'page-karyawan-riwayat' },
  ];
```

**GANTI DENGAN:**
```javascript
  const empNav = [
    { id: 'karyawan-home', icon: homeIcon(), label: 'Beranda', page: 'page-karyawan-home' },
    { id: 'karyawan-riwayat', icon: rekapIcon(), label: 'Riwayat', page: 'page-karyawan-riwayat' },
    { id: 'karyawan-piutang', icon: piutangIcon(), label: 'Piutang', page: 'page-karyawan-piutang' },
  ];
```

---

### 2C — Tambah handler navigasi karyawan-piutang di `navigateTo()`

**Lokasi:** Cari fungsi `window.navigateTo = (id) => {`

**CARI baris:**
```javascript
  if(id === 'karyawan-riwayat') {
    document.getElementById('riw-date-input').value = today();
    loadRiwayatKaryawan();
  }
```

**TAMBAHKAN SETELAH baris itu:**
```javascript
  if(id === 'karyawan-piutang') { loadKaryawanPiutang(); }
```

---

### 2D — Tambah fungsi-fungsi piutang karyawan

**Lokasi:** Cari baris paling akhir sebelum penutup script:
```javascript
// =====================================
// GPS TRACKING
// =====================================
```

**TAMBAHKAN blok fungsi baru SEBELUM komentar GPS TRACKING:**

```javascript
// =====================================
// PIUTANG KARYAWAN
// =====================================
window._karyawanPiutangList = [];
window._karyawanPiutangFilter = 'belum_lunas';

window.loadKaryawanPiutang = async () => {
  const listEl = document.getElementById('k-piutang-list');
  if (listEl) listEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3)">Memuat...</div>';

  try {
    const [belumSnap, lunasSnap] = await Promise.all([
      getDocs(query(
        collection(db, 'piutang'),
        where('status', '==', 'belum_lunas'),
        where('karyawan_id', '==', STATE.user.uid)
      )),
      getDocs(query(
        collection(db, 'piutang'),
        where('status', '==', 'lunas'),
        where('karyawan_id', '==', STATE.user.uid),
        where('bulan', '==', new Date().toISOString().substring(0, 7))
      )),
    ]);

    const belumLunas = belumSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const lunas = lunasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    window._karyawanPiutangList = [...belumLunas, ...lunas];

    const totalPiutang = belumLunas.reduce((a, p) => a + (p.sisa_hutang || 0), 0);
    const uniquePel = new Set(belumLunas.map(p => p.pelanggan_id)).size;

    const subEl = document.getElementById('k-piutang-subtitle');
    if (subEl) subEl.textContent = `${belumLunas.length} belum lunas · ${fmt(totalPiutang)}`;
    const totalEl = document.getElementById('k-piu-total');
    const cntEl = document.getElementById('k-piu-count');
    const pelEl = document.getElementById('k-piu-pelanggan');
    if (totalEl) totalEl.textContent = fmt(totalPiutang);
    if (cntEl) cntEl.textContent = belumLunas.length + ' transaksi';
    if (pelEl) pelEl.textContent = uniquePel;

    renderKaryawanPiutangList();
  } catch (e) {
    if (listEl) listEl.innerHTML = `<div class="alert-box error">Gagal memuat: ${e.message}</div>`;
  }
};

window.filterKaryawanPiutang = (filter, btn) => {
  window._karyawanPiutangFilter = filter;
  document.querySelectorAll('#page-karyawan-piutang .tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderKaryawanPiutangList();
};

window.renderKaryawanPiutangList = () => {
  const listEl = document.getElementById('k-piutang-list');
  if (!listEl) return;
  let list = window._karyawanPiutangList;
  const filter = window._karyawanPiutangFilter;
  if (filter === 'belum_lunas') list = list.filter(p => p.status === 'belum_lunas');
  else if (filter === 'lunas') list = list.filter(p => p.status === 'lunas');

  if (list.length === 0) {
    listEl.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
      <p>${filter === 'belum_lunas' ? 'Tidak ada piutang 🎉' : 'Belum ada data'}</p>
    </div>`;
    return;
  }

  const now = new Date();
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
  listEl.innerHTML = list.map(p => {
    const isDP = p.nominal_dibayar > 0 && p.sisa_hutang > 0;
    const tglTrx = p.tanggal_transaksi ? new Date(p.tanggal_transaksi) : null;
    const hariLalu = tglTrx ? Math.floor((now - tglTrx) / (24*60*60*1000)) : null;
    const tglLabel = tglTrx ? `${tglTrx.getDate()} ${months[tglTrx.getMonth()]}` : '-';
    const avatarChar = p.pelanggan_nama?.[0]?.toUpperCase() || '?';
    const avatarClass = isDP ? 'piutang-avatar dp' : 'piutang-avatar';

    return `<div class="piutang-item">
      <div class="${avatarClass}">${avatarChar}</div>
      <div class="piutang-info">
        <div class="piutang-name">${p.pelanggan_nama}</div>
        <div class="piutang-sub">
          ${tglLabel} · ${isDP ? 'DP' : 'Hutang'} · Total ${fmt(p.total_tagihan || 0)}
          ${hariLalu !== null ? `· ${hariLalu} hari lalu` : ''}
        </div>
        <div style="margin-top:4px">
          ${p.status === 'lunas'
            ? '<span class="badge badge-green">✓ Lunas</span>'
            : (isDP ? `<span class="badge badge-amber">DP · Sisa ${fmt(p.sisa_hutang)}</span>`
                    : `<span class="badge badge-red">Hutang ${fmt(p.sisa_hutang)}</span>`)
          }
        </div>
        ${p.status === 'belum_lunas' ? `
          <div class="piutang-actions">
            <button class="btn btn-sm btn-primary" onclick="openBayarPiutangKar('${p.id}')">Catat Bayar</button>
            <button class="btn btn-sm btn-secondary" onclick="lihatRiwayatBayarKar('${p.id}')">Riwayat</button>
          </div>` : ''}
      </div>
      <div class="piutang-right">
        <div class="piutang-amount">${fmt(p.sisa_hutang || 0)}</div>
        <div class="piutang-days" style="color:var(--text3)">
          ${p.status === 'lunas'
            ? '<span class="badge badge-green" style="font-size:9px">Lunas</span>'
            : 'Belum lunas'}
        </div>
      </div>
    </div>`;
  }).join('');
};

// Buka modal bayar piutang versi karyawan (pakai modal yang sama)
window.openBayarPiutangKar = (id) => {
  const p = window._karyawanPiutangList.find(x => x.id === id);
  if (!p) { showToast('Data tidak ditemukan'); return; }
  document.getElementById('bp-piutang-id').value = id;
  document.getElementById('bp-pelanggan').textContent = p.pelanggan_nama;
  document.getElementById('bp-total').textContent = fmt(p.total_tagihan || 0);
  document.getElementById('bp-sisa').textContent = fmt(p.sisa_hutang || 0);
  document.getElementById('bp-nominal').value = '';
  document.getElementById('bp-tanggal').value = today();
  document.getElementById('bp-preview').style.display = 'none';
  // Override save agar reload piutang karyawan (bukan owner)
  window._bayarPiutangSource = 'karyawan';
  showModal('modal-bayar-piutang');
};

// Riwayat bayar versi karyawan (pakai modal yang sama)
window.lihatRiwayatBayarKar = (id) => {
  const p = window._karyawanPiutangList.find(x => x.id === id);
  if (!p) return;
  // Inject data ke STATE.piutangList agar fungsi lihatRiwayatBayar owner bisa jalan
  if (!STATE.piutangList) STATE.piutangList = [];
  const existing = STATE.piutangList.find(x => x.id === id);
  if (!existing) STATE.piutangList.push(p);
  lihatRiwayatBayar(id);
};
```

---

### 2E — Patch `savePembayaranPiutang()` agar setelah simpan reload piutang karyawan juga

**Lokasi:** Cari fungsi `window.savePembayaranPiutang = async () => {`

**CARI baris paling akhir di fungsi itu (sebelum `} catch`):**
```javascript
    closeModal('modal-bayar-piutang');
    showToast(isLunas ? '✅ Hutang lunas!' : `✅ Pembayaran ${fmt(nominal)} dicatat`);
    loadPiutang();
```

**GANTI DENGAN:**
```javascript
    closeModal('modal-bayar-piutang');
    showToast(isLunas ? '✅ Hutang lunas!' : `✅ Pembayaran ${fmt(nominal)} dicatat`);
    // Reload sesuai siapa yang buka modal
    if (window._bayarPiutangSource === 'karyawan') {
      loadKaryawanPiutang();
    } else {
      loadPiutang();
    }
    window._bayarPiutangSource = null;
```

---

### 2F — Tampilkan ringkasan piutang di beranda karyawan

**Lokasi:** Cari fungsi `window.refreshKaryawanHome = () => {`

**CARI bagian HTML card komisi (paling akhir):**
```javascript
        <div class="keu-row">
            <span class="kl" style="font-size:11px;color:var(--text3)">Tabung harga &gt;17.000</span>
            <span style="font-size:11px;color:var(--text3)" id="k-komisi-above">0 × Rp 500 = Rp 0</span>
          </div>
```

Perhatikan ini ada di HTML statis (bukan di `refreshKaryawanHome`). Yang perlu diubah adalah fungsi `refreshKaryawanHome` — tambahkan hitung piutang di dalamnya.

**CARI baris penutup fungsi refreshKaryawanHome:**
```javascript
};
```
*(tepat setelah blok if/else history)*

Karena susah diidentifikasi, CARI baris ini yang spesifik ada di refreshKaryawanHome:
```javascript
  document.getElementById('k-komisi-above').textContent = `${tabAbove} × ${fmt(s.komisi_above_17000)} = ${fmt(tabAbove*s.komisi_above_17000)}`;
```

**TAMBAHKAN kode berikut SETELAH baris di atas:**
```javascript
  // Update ringkasan piutang hari ini (transaksi hutang/DP karyawan ini)
  const piutangHariIni = (STATE._piutangCache || window._karyawanPiutangList || [])
    .filter(p => p.karyawan_id === STATE.user.uid && p.tanggal_transaksi === today() && p.status === 'belum_lunas');
  const totalPiutangHariIni = piutangHariIni.reduce((a, p) => a + (p.sisa_hutang || 0), 0);
  const piutangInfoEl = document.getElementById('k-piutang-info');
  if (piutangInfoEl) {
    if (totalPiutangHariIni > 0) {
      piutangInfoEl.style.display = 'block';
      piutangInfoEl.innerHTML = `<span>Piutang belum tertagih hari ini</span><span style="font-weight:700;color:var(--amber-dark)">${fmt(totalPiutangHariIni)}</span>`;
    } else {
      piutangInfoEl.style.display = 'none';
    }
  }
```

Kemudian **CARI HTML card komisi di halaman beranda karyawan** (bukan di script):

```html
          <div class="keu-row">
            <span class="kl" style="font-size:11px;color:var(--text3)">Tabung harga &gt;17.000</span>
            <span style="font-size:11px;color:var(--text3)" id="k-komisi-above">0 × Rp 500 = Rp 0</span>
          </div>
        </div>
      </div>
```

**GANTI DENGAN (tambahkan baris piutang info):**
```html
          <div class="keu-row">
            <span class="kl" style="font-size:11px;color:var(--text3)">Tabung harga &gt;17.000</span>
            <span style="font-size:11px;color:var(--text3)" id="k-komisi-above">0 × Rp 500 = Rp 0</span>
          </div>
          <div id="k-piutang-info" class="keu-row" style="display:none;background:var(--amber-light);border-radius:8px;padding:8px 10px;margin-top:6px;border:none">
          </div>
        </div>
      </div>
```

---

### 2G — Update riwayat karyawan: tampilkan badge status bayar + sisa cicilan terkini

**Lokasi:** Cari fungsi `window.loadRiwayatKaryawan = async () => {`

**CARI bagian render transaksi (dalam `trx.map(t => {`):**
```javascript
        <div class="hist-info">
          <div class="hist-name">${t.pelanggan_nama}</div>
          <div style="margin-top:2px">${badgeStatusBayar(t)}</div>
          <div class="hist-time">${time} · ${fmt(t.harga_jual)}/tabung</div>
        </div>
        <div class="hist-right">
          <div class="hist-amt">${fmt(t.total_pendapatan)}</div>
          <div class="hist-tab">${t.jumlah_tabung} tabung</div>
        </div>
```

**GANTI DENGAN:**
```javascript
        <div class="hist-info">
          <div class="hist-name">${t.pelanggan_nama}</div>
          <div style="margin-top:2px">${(() => {
            // Ambil status piutang terkini dari cache
            const piutangTrx = (STATE._piutangCache || window._karyawanPiutangList || [])
              .find(p => p.transaksi_id === t.id);
            if (!piutangTrx) return badgeStatusBayar(t);
            if (piutangTrx.status === 'lunas') return '<span class="badge badge-green">✓ Lunas</span>';
            if (piutangTrx.sisa_hutang < (t.sisa_hutang || 0)) {
              return `<span class="badge badge-amber">Dicicil · Sisa ${fmt(piutangTrx.sisa_hutang)}</span>`;
            }
            return badgeStatusBayar(t);
          })()}</div>
          <div class="hist-time">${time} · ${fmt(t.harga_jual)}/tabung</div>
        </div>
        <div class="hist-right">
          ${(() => {
            const piutangTrx = (STATE._piutangCache || window._karyawanPiutangList || [])
              .find(p => p.transaksi_id === t.id);
            const statusBayar = t.status_bayar || 'cash';
            if (statusBayar === 'cash') {
              return `<div class="hist-amt">${fmt(t.total_pendapatan)}</div>
                      <div class="hist-tab">${t.jumlah_tabung} tabung</div>`;
            }
            const kasTotal = piutangTrx
              ? (piutangTrx.nominal_dibayar || 0)
              : (t.nominal_dibayar || 0);
            const sisaTerkini = piutangTrx ? (piutangTrx.sisa_hutang || 0) : (t.sisa_hutang || 0);
            const isLunas = piutangTrx?.status === 'lunas';
            return `<div class="hist-amt">${fmt(kasTotal)}</div>
                    <div class="hist-tab" style="color:var(--amber-dark)">Sisa: ${isLunas ? '✓' : fmt(sisaTerkini)}</div>`;
          })()}
        </div>
```

---

## ═══════════════════════════════════════════
## FITUR 3 — Stok Otomatis Update Setiap Transaksi
## ═══════════════════════════════════════════

### 3A — Tambah fungsi helper update stok otomatis

**Lokasi:** Cari komentar `// =====================================` sebelum `// GPS TRACKING`

**TAMBAHKAN blok fungsi baru SEBELUM `// GPS TRACKING`:**

```javascript
// =====================================
// STOK OTOMATIS
// =====================================
/**
 * Dipanggil setiap ada transaksi baru / edit / hapus.
 * Menghitung ulang tabung_kosong dari stok hari ini:
 *   tabung_kosong = stok_kemarin_kosong - pengisian_hari_ini + penjualan_hari_ini
 * lalu update doc stok_harian/{today}.
 */
window.autoUpdateStok = async () => {
  const todayStr = today();
  const s = STATE.settings;
  try {
    // Hitung penjualan hari ini dari Firestore (bukan cache, agar akurat)
    const trxSnap = await getDocs(query(collection(db, 'transaksi'), where('tanggal', '==', todayStr)));
    const totalTerjualHariIni = trxSnap.docs.reduce((a, d) => a + (d.data().jumlah_tabung || 0), 0);

    // Ambil stok hari ini (jika ada)
    const stokSnap = await getDoc(doc(db, 'stok_harian', todayStr));
    const stokHariIni = stokSnap.exists() ? stokSnap.data() : null;

    // Ambil stok kemarin untuk tahu berapa kosong kemarin
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const ydStr = yesterday.toISOString().split('T')[0];
    let kemarinKosong = 0;
    try {
      const ydSnap = await getDoc(doc(db, 'stok_harian', ydStr));
      if (ydSnap.exists()) kemarinKosong = ydSnap.data().tabung_kosong || 0;
    } catch (e) {}

    const pengisian = stokHariIni?.pengisian || 0;
    const tabungKosong = Math.max(0, kemarinKosong - pengisian + totalTerjualHariIni);
    const tabungIsi = s.total_tabung - tabungKosong;

    await setDoc(doc(db, 'stok_harian', todayStr), {
      ...(stokHariIni || {}),
      pengisian,
      penjualan: totalTerjualHariIni,
      tabung_kosong: tabungKosong,
      tabung_isi: tabungIsi,
      auto_updated: true,
      auto_updated_at: serverTimestamp(),
    }, { merge: true });

    // Update STATE cache agar dashboard ikut refresh tanpa reload
    STATE.stokHariIni = {
      ...(STATE.stokHariIni || {}),
      pengisian,
      penjualan: totalTerjualHariIni,
      tabung_kosong: tabungKosong,
      tabung_isi: tabungIsi,
    };
    refreshDashboard();
  } catch (e) {
    console.warn('autoUpdateStok error:', e.message);
  }
};
```

---

### 3B — Panggil `autoUpdateStok()` saat transaksi baru disimpan

**Lokasi:** Cari fungsi `window.saveTransaksi = async () => {` (versi patch 1.2.0 yang sudah ada)

**CARI bagian setelah `addDoc` berhasil dan sebelum reset form:**
```javascript
    const trxRef = await addDoc(collection(db, 'transaksi'), data);
    // Update last_order pelanggan
    await updateDoc(doc(db, 'pelanggan', pelId), { last_order: serverTimestamp() });
```

**TAMBAHKAN satu baris di bawahnya:**
```javascript
    const trxRef = await addDoc(collection(db, 'transaksi'), data);
    // Update last_order pelanggan
    await updateDoc(doc(db, 'pelanggan', pelId), { last_order: serverTimestamp() });
    // Update stok otomatis
    autoUpdateStok().catch(() => {});
```

---

### 3C — Panggil `autoUpdateStok()` saat transaksi diedit (owner)

**Lokasi:** Cari fungsi `window.saveEditTransaksi = async () => {`

**CARI:**
```javascript
    closeModal('modal-edit-transaksi');
    showToast('✅ Transaksi diperbarui');
    loadRekapHarian();
```

**TAMBAHKAN sebelum `loadRekapHarian()`:**
```javascript
    closeModal('modal-edit-transaksi');
    showToast('✅ Transaksi diperbarui');
    autoUpdateStok().catch(() => {});
    loadRekapHarian();
```

---

### 3D — Panggil `autoUpdateStok()` saat transaksi dihapus

**Lokasi:** Cari fungsi `window.deleteTransaksi = async (id, pelId) => {`

**CARI:**
```javascript
    showToast('🗑️ Transaksi dihapus');
    loadRekapHarian();
```

**TAMBAHKAN sebelum `loadRekapHarian()`:**
```javascript
    showToast('🗑️ Transaksi dihapus');
    autoUpdateStok().catch(() => {});
    loadRekapHarian();
```

---

### 3E — Panggil `autoUpdateStok()` saat transaksi diedit (karyawan)

**Lokasi:** Cari fungsi `window.saveEditTransaksiKar = async () => {`

**CARI:**
```javascript
    closeModal('modal-edit-transaksi-kar');
    showToast('✅ Transaksi diperbarui');
```

**TAMBAHKAN setelah baris itu:**
```javascript
    closeModal('modal-edit-transaksi-kar');
    showToast('✅ Transaksi diperbarui');
    autoUpdateStok().catch(() => {});
```

---

### 3F — Subscribe stok realtime di `initOwnerApp()`

Agar dashboard stok ikut update tanpa perlu refresh manual ketika karyawan mencatat transaksi.

**Lokasi:** Cari `// Load stok hari ini` di `initOwnerApp()`

**CARI:**
```javascript
  // Load stok hari ini
  loadStokHariIni();
```

**GANTI DENGAN:**
```javascript
  // Subscribe stok hari ini realtime
  const todayStrStok = today();
  const unsubStok = onSnapshot(doc(db, 'stok_harian', todayStrStok), (snap) => {
    if (snap.exists()) {
      STATE.stokHariIni = snap.data();
    } else {
      STATE.stokHariIni = null;
    }
    refreshDashboard();
  });
  STATE.unsubscribers.push(unsubStok);
```

> **Catatan:** Dengan perubahan ini, fungsi `loadStokHariIni()` sudah tidak dipanggil lagi dari `initOwnerApp`. Fungsinya masih bisa dipakai di tempat lain jadi tidak perlu dihapus.

---

## ✅ CHECKLIST URUTAN PENGERJAAN PATCH 1.3.0

Kerjakan dari atas ke bawah:

1. **STATE init** — tambah `_piutangCache: []` ke object STATE (1B)
2. **initOwnerApp()** — tambah subscriber piutang + ganti loadStok → subscribe realtime (1A, 3F)
3. **loadRekapHarian()** — ganti card keuangan pertama (1C) + ganti render hist-right (1D)
4. **HTML** — tambah page `page-karyawan-piutang` sebelum `</main>` (2A)
5. **buildNav()** — tambah menu Piutang karyawan (2B)
6. **navigateTo()** — tambah handler karyawan-piutang (2C)
7. **Script** — tambah semua fungsi piutang karyawan sebelum GPS TRACKING (2D)
8. **savePembayaranPiutang()** — patch reload sesuai source (2E)
9. **HTML beranda karyawan** — tambah div `k-piutang-info` (2F HTML)
10. **refreshKaryawanHome()** — tambah update ringkasan piutang (2F script)
11. **loadRiwayatKaryawan()** — update badge dan nominal terkini (2G)
12. **Script** — tambah fungsi `autoUpdateStok()` sebelum GPS TRACKING (3A)
13. **saveTransaksi()** — panggil autoUpdateStok (3B)
14. **saveEditTransaksi()** — panggil autoUpdateStok (3C)
15. **deleteTransaksi()** — panggil autoUpdateStok (3D)
16. **saveEditTransaksiKar()** — panggil autoUpdateStok (3E)

---

## 💡 CATATAN PENTING

### Piutang karyawan: akses terbatas
Karyawan hanya melihat piutang dari transaksi yang **dia sendiri** catat (filter `karyawan_id`). Karyawan **tidak bisa** menandai lunas langsung (tombol "Lunas" tidak ada), hanya bisa "Catat Bayar" dan "Riwayat".

### Stok realtime
Stok sekarang dihitung ulang setiap kali ada transaksi baru/edit/hapus. Jika ada pengisian dari agen, tetap pakai tombol "Input Stok" seperti biasa — pengisian akan ikut dipakai dalam kalkulasi otomatis.

### Edit stok manual tetap bisa
Tombol ✏️ pada card stok di dashboard tetap berfungsi. Edit manual akan di-override kalkulasi otomatis jika ada transaksi baru setelahnya, kecuali field `edited_manually` dijaga — tapi untuk simplisitas patch ini, kalkulasi otomatis selalu menimpa.
