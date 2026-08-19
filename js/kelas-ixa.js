tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
          },
        },
      },
    };
  

    // ===== Init =====
    lucide.createIcons();

    // ===== CONFIG =====
const kelasConfig = {
      className: 'IX-A',
      wali: 'Atik Desiana',
      slogan: '"Di atas langit masih ada agit."',
      jumlahSiswa: 11
    };

    const CURRENT_PAGE_CLASS = kelasConfig.className;

    // apply config
    document.querySelectorAll('#className, #bannerClass, #bannerClassName, #footClass').forEach(el => el.textContent = kelasConfig.className);
    document.getElementById('classSlogan').textContent = kelasConfig.slogan;
    document.getElementById('waliKelas').textContent = kelasConfig.wali;
    document.getElementById('jumlahSiswa').textContent = kelasConfig.jumlahSiswa;

// ===== STATE =====
    let currentUser = null; // { name, class, role }
    let canManagePR = false; // manager ATAU siswa kelas ini

// ===== DATA KAS =====
    const kasData = []; // { id, tipe, jumlah, keterangan, tanggal }

    // ===== DELETE per item handler =====
    async function deleteItem(type, index) {
      if (type === 'jadwal') {
        const item = jadwalData[currentDay][index];
        if (!item) return;
        const { error } = await supabase.from('jadwal').delete().eq('id', item.id);
        if (error) { toast(error.message, 'error'); return; }
        jadwalData[currentDay].splice(index, 1); renderJadwal();
        toast('Jadwal dihapus!');
      }
      if (type === 'pr') {
        if (!isSekretaris()) {
          alert('Akses ditolak! Hanya Sekretaris yang dapat menghapus tugas.');
          return;
        }
        const item = prData[index];
        if (!item) return;
        if (item.id) {
          const { error } = await supabase.from('tugas').delete().eq('id', item.id);
          if (error) { toast(error.message, 'error'); return; }
          toast('Tugas dihapus!');
        }
        prData.splice(index, 1); renderPR();
      }
      if (type === 'piket') { piketData.splice(index, 1); renderPiket(); }
    }

    function confirmDeletePR(index) {
      showDeleteConfirmModal(function() {
        deleteItem('pr', index);
      });
    }

// ===== RENDER JADWAL (via renderJadwalToUI ke #jadwal-container) =====
    let currentDay = 'Senin';
    function renderJadwal() {
      // Diisolasi dengan try/catch: jika ada error di sini, fungsi render
      // LAIN (renderPR, renderPiket, dst) tetap jalan (anti chain-reaction crash).
      try {
        // Bangun ulang map dari jadwalData, lalu render ke container
        const days = ['Senin','Selasa','Rabu','Kamis','Jumat'];
        const map = {};
        days.forEach(d => map[d] = (jadwalData[d] || []).map(r => ({ id: r.id, jam: r.jam, mapel: r.mapel, guru: r.guru })));
        renderJadwalToUI(map);
      } catch (e) {
        debugAlert('renderJadwal', e);
      }
    }
    document.querySelectorAll('.day-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.day-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentDay = tab.dataset.day;
        renderJadwal();
      });
    });

    function autoSelectTodaySchedule() {
      const daftarHari = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
      const todayIndex = new Date().getDay();
      let currentDayName = daftarHari[todayIndex];

      if (currentDayName === 'sabtu' || currentDayName === 'minggu') {
        currentDayName = 'senin';
      }

      const capitalizedDay = currentDayName.charAt(0).toUpperCase() + currentDayName.slice(1);

      const targetTab = document.querySelector('.day-tab[data-day="' + capitalizedDay + '"]');
      if (!targetTab) return;

      document.querySelectorAll('.day-tab').forEach(t => t.classList.remove('active'));
      targetTab.classList.add('active');

      currentDay = capitalizedDay;
      renderJadwal();
    }

    // ===== RENDER PR =====
    function renderPR() {
      // Diisolasi dengan try/catch (anti chain-reaction crash di iOS Safari).
      try {
        const list = document.getElementById('prList');
        if (!list) return;
        if (prData.length === 0) {
          list.innerHTML = '<p class="text-sm text-slate-500 text-center py-6">Tidak ada tugas 🎉</p>';
          return;
        }
        list.innerHTML = prData.map((row, i) => `
          <div class="p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition group">
            <div class="flex items-center justify-between">
<span class="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 editable" data-type="pr" data-idx="${i}" data-field="mapel">${row.mapel}</span>
              ${canManagePR ? `<button onclick="confirmDeletePR(${i})" class="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}
            </div>
            <p class="mt-2 text-sm text-slate-700 editable" data-type="pr" data-idx="${i}" data-field="desc">${row.desc}</p>
            <p class="mt-1 text-[11px] text-blue-600 inline-flex items-center gap-1">
              <i data-lucide="calendar" class="w-3 h-3"></i> Kumpul: ${formatDate(row.due)}
            </p>
          </div>
        `).join('');
        lucide.createIcons();
      } catch (e) {
        debugAlert('renderPR (Tugas)', e);
      }
    }

    // ===== RENDER PIKET =====
    function renderPiket() {
      // Diisolasi dengan try/catch (anti chain-reaction crash di iOS Safari).
      try {
        const list = document.getElementById('piketList');
        if (!list) return;
        if (piketData.length === 0) {
          list.innerHTML = '<p class="text-sm text-slate-500 text-center py-6">Belum ada jadwal piket.</p>';
          return;
        }
        const canManage = canManageSchedule();
        list.innerHTML = piketData.map((row, i) => `
          <div class="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white group" data-piket-day="${String(row.hari || '').toLowerCase()}">
            <span class="shrink-0 w-16 text-xs font-bold text-blue-700">${row.hari}</span>
            <p class="flex-1 text-sm text-slate-700">${row.nama_siswa}</p>
            ${canManage ? `
              <button onclick="editPiket('${row.id}','${('' + row.hari).replace(/'/g, "\\'")}','${('' + row.nama_siswa).replace(/'/g, "\\'")}')" class="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 transition" title="Edit jadwal piket"><i data-lucide="pencil" class="w-4 h-4"></i></button>
              <button onclick="deletePiket('${row.id}')" class="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition" title="Hapus jadwal piket"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            ` : ''}
          </div>
        `).join('');
        lucide.createIcons();
        highlightTodayPiket();
      } catch (e) {
        debugAlert('renderPiket', e);
      }
    }

    function highlightTodayPiket() {
      const daftarHari = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
      const todayIndex = new Date().getDay();
      const todayName = daftarHari[todayIndex];

      const rows = document.querySelectorAll('[data-piket-day]');
      rows.forEach(function(row) {
        row.classList.remove('border-2', 'border-blue-500', 'bg-blue-50', 'shadow-md');
      });

      if (todayName === 'sabtu' || todayName === 'minggu') return;

      const targetRow = document.querySelector('[data-piket-day="' + todayName + '"]');
      if (!targetRow) return;

      targetRow.classList.add('border-2', 'border-blue-500', 'bg-blue-50', 'shadow-md');
    }

    // ===== LOAD PIKET (READ dari Supabase) =====
    async function loadPiketList() {
      var list = document.getElementById('piketList');
      if (list) {
        list.innerHTML = '<p class="text-sm text-slate-500 text-center py-6"><i data-lucide="loader" class="w-5 h-5 animate-spin inline mr-2"></i>Memuat jadwal piket...</p>';
        lucide.createIcons();
      }

      try {
        var result = await supabaseFetchWithRetry(function() {
          return supabase.from('piket').select('*').ilike('kelas', kelasConfig.className).order('id', { ascending: true });
        }, 5000, 3);
        var data = result.data;
        var error = result.error;

        if (error) {
          console.error('load piket error:', error.message);
          toast('Gagal memuat jadwal piket: ' + error.message, 'error');
          if (list) {
            list.innerHTML = '<p class="text-sm text-rose-500 text-center py-6">Gagal memuat jadwal piket. Periksa koneksi internet Anda. <button type="button" onclick="loadPiketList()" style="background:none;border:none;color:inherit;text-decoration:underline;cursor:pointer;">Coba Lagi</button></p>';
          }
          return;
        }
        piketData.length = 0;
        (data || []).forEach(function(r) { piketData.push({ id: r.id, hari: r.hari, nama_siswa: r.nama_siswa }); });
        renderPiket();
      } catch (err) {
        debugAlert('loadPiketList (fetch piket)', err);
        if (list) {
          list.innerHTML = '<p class="text-sm text-rose-500 text-center py-6">Gagal memuat data. Periksa koneksi internet Anda. <button type="button" onclick="loadPiketList()" style="background:none;border:none;color:inherit;text-decoration:underline;cursor:pointer;">Coba Lagi</button></p>';
        }
      }
    }

    // ===== TAMBAH JADWAL PIKET (CREATE) =====
    async function addPiket(hari, namaSiswa) {
      const payload = {
        kelas: kelasConfig.className,
        hari: hari,
        nama_siswa: namaSiswa
      };
      const { data, error } = await supabase.from('piket').insert(payload).select();
      if (error) { toast(error.message, 'error'); return; }
      if (data && data[0]) {
        piketData.push({ id: data[0].id, hari: data[0].hari, nama_siswa: data[0].nama_siswa });
      }
      toast('Jadwal piket berhasil ditambahkan! ✅');
      closeEditFn();
      loadPiketList();
    }

    // ===== EDIT JADWAL PIKET (UPDATE) =====
    async function updatePiket(piketId, hari, namaSiswa) {
      const { error } = await supabase
        .from('piket')
        .update({ hari: hari, nama_siswa: namaSiswa })
        .eq('id', piketId);
      if (error) { toast(error.message, 'error'); return; }
      toast('Jadwal piket berhasil diperbarui! ✅');
      closeEditFn();
      loadPiketList();
    }

    // ===== HAPUS JADWAL PIKET (DELETE) =====
    async function deletePiket(id) {
      const { error } = await supabase.from('piket').delete().eq('id', id);
      if (error) { toast(error.message, 'error'); return; }
      toast('Jadwal piket berhasil dihapus! 🗑️');
      loadPiketList();
    }

    // ===== BUKA MODAL TAMBAH/EDIT PIKET =====
    let editPiketId = null;
    function openPiketModal(piketId, hari, namaSiswa) {
      editPiketId = piketId || null;
      addType = 'piket';
      editModalTitle.innerHTML = '<i data-lucide="broom" class="w-5 h-5 text-blue-600"></i> ' + (editPiketId ? 'Edit Piket' : 'Tambah Piket');
      editFields.innerHTML = `
        <div><label class="block text-sm font-medium text-slate-700 mb-1.5">Hari</label>
          <select id="nf_hari" class="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 outline-none focus:border-blue-500 text-sm">
            <option value="Senin" ${hari === 'Senin' ? 'selected' : ''}>Senin</option>
            <option value="Selasa" ${hari === 'Selasa' ? 'selected' : ''}>Selasa</option>
            <option value="Rabu" ${hari === 'Rabu' ? 'selected' : ''}>Rabu</option>
            <option value="Kamis" ${hari === 'Kamis' ? 'selected' : ''}>Kamis</option>
            <option value="Jumat" ${hari === 'Jumat' ? 'selected' : ''}>Jumat</option>
          </select></div>
        <div><label class="block text-sm font-medium text-slate-700 mb-1.5">Nama Siswa</label>
          <input id="nf_nama" value="${namaSiswa || ''}" placeholder="Ahmad, Rizky, dll" class="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 outline-none focus:border-blue-500 text-sm"></div>`;
      lucide.createIcons();
      editModal.classList.remove('hidden'); editModal.classList.add('flex');
    }
    function editPiket(id, hari, namaSiswa) {
      openPiketModal(id, hari, namaSiswa);
    }

// ===== RENDER KAS (READ dari Supabase) =====
    function formatRupiah(n) {
      return 'Rp' + Number(n || 0).toLocaleString('id-ID');
    }

    function formatRupiahInput(value) {
      var clean = String(value).replace(/\D/g, '');
      if (!clean) return '';
      return Number(clean).toLocaleString('id-ID');
    }

    async function loadKasList() {
      var list = document.getElementById('kasList');
      if (list) {
        list.innerHTML = '<p class="text-sm text-slate-500 text-center py-6"><i data-lucide="loader" class="w-5 h-5 animate-spin inline mr-2"></i>Memuat transaksi kas...</p>';
        lucide.createIcons();
      }

      try {
        var result = await supabaseFetchWithRetry(function() {
          return supabase.from('kas_ixa').select('*').order('created_at', { ascending: false });
        }, 5000, 3);
        var data = result.data;
        var error = result.error;

        if (error) {
          console.error('load kas error:', error.message);
          toast('Gagal memuat kas: ' + error.message, 'error');
          if (list) {
            list.innerHTML = '<p class="text-sm text-rose-500 text-center py-6">Gagal memuat transaksi kas. Periksa koneksi internet Anda. <button type="button" onclick="loadKasList()" style="background:none;border:none;color:inherit;text-decoration:underline;cursor:pointer;">Coba Lagi</button></p>';
          }
          return;
        }
        kasData.length = 0;
        (data || []).forEach(function(r) { kasData.push({ id: r.id, tipe: r.tipe, jumlah: r.jumlah, keterangan: r.keterangan, tanggal: r.created_at }); });
        renderKas();
      } catch (err) {
        debugAlert('loadKasList (fetch kas)', err);
        if (list) {
          list.innerHTML = '<p class="text-sm text-rose-500 text-center py-6">Gagal memuat data. Periksa koneksi internet Anda. <button type="button" onclick="loadKasList()" style="background:none;border:none;color:inherit;text-decoration:underline;cursor:pointer;">Coba Lagi</button></p>';
        }
      }
    }

    // ===== MODAL RIWAYAT KAS =====
    const kasRiwayatModal = document.getElementById('kasRiwayatModal');
    const kasRiwayatBackdrop = document.getElementById('kasRiwayatBackdrop');
    const closeKasRiwayatBtn = document.getElementById('closeKasRiwayat');
    function openKasRiwayat() {
      renderKas();
      kasRiwayatModal.classList.remove('hidden'); kasRiwayatModal.classList.add('flex');
    }
    function closeKasRiwayat() {
      kasRiwayatModal.classList.add('hidden'); kasRiwayatModal.classList.remove('flex');
    }
    if (closeKasRiwayatBtn) closeKasRiwayatBtn.addEventListener('click', closeKasRiwayat);
    if (kasRiwayatBackdrop) kasRiwayatBackdrop.addEventListener('click', closeKasRiwayat);

    function renderKas() {
      // Diisolasi dengan try/catch: error di render Kas (mis. dari formatDateSafe)
      // TIDAK BOLEH ikut mematikan render Tugas/Piket/Jadwal.
      try {
        const saldoEl = document.getElementById('kasSaldo');
        if (saldoEl) {
          const total = kasData.reduce((acc, r) => {
            return r.tipe === 'pemasukan' ? acc + Number(r.jumlah) : acc - Number(r.jumlah);
          }, 0);
          saldoEl.textContent = formatRupiah(total);
        }

        const list = document.getElementById('kasList');
        if (!list) return;
        if (kasData.length === 0) {
          list.innerHTML = '<p class="text-sm text-slate-500 text-center py-6">Belum ada transaksi kas.</p>';
          return;
        }
        list.innerHTML = kasData.map(r => {
          const isMasuk = r.tipe === 'pemasukan';
          return `
            <div class="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white">
              <div class="shrink-0 w-9 h-9 rounded-lg ${isMasuk ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'} flex items-center justify-center">
                <i data-lucide="${isMasuk ? 'arrow-down-left' : 'arrow-up-right'}" class="w-4 h-4"></i>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold truncate text-slate-800">${r.keterangan}</p>
                 <p class="text-[11px] text-slate-500">${formatDateSafe(r.tanggal)}</p>
              </div>
              <span class="shrink-0 text-sm font-bold ${isMasuk ? 'text-blue-600' : 'text-rose-600'}">
                ${isMasuk ? '+' : '-'}${formatRupiah(r.jumlah)}
              </span>
            </div>
          `;
        }).join('');
        lucide.createIcons();
      } catch (e) {
        debugAlert('renderKas', e);
      }
    }

    // ===== TAMBAH TRANSAKSI KAS (CREATE) =====
    async function addKasTransaction(tipe, jumlah, keterangan) {
      const payload = {
        tipe: tipe,
        jumlah: jumlah,
        keterangan: keterangan,
        tanggal: new Date().toISOString().split('T')[0]
      };
const { data, error } = await supabase.from('kas_ixa').insert(payload).select();
      if (error) { toast(error.message, 'error'); return false; }
      if (data && data[0]) {
        kasData.unshift({
          id: data[0].id,
          tipe: data[0].tipe,
          jumlah: data[0].jumlah,
          keterangan: data[0].keterangan,
          tanggal: data[0].tanggal
        });
      }
      toast('Transaksi kas berhasil disimpan! ✅');
      renderKas();
      return true;
    }

    // ===== format date =====
    // PENTING (fix bug iPhone): jika `iso` kosong/null/format tidak valid, Date yang
    // dihasilkan menjadi "Invalid Date". Di Chrome (Android/Windows) memanggil
    // .toLocaleDateString() pada Invalid Date cuma balikin teks "Invalid Date" — TIDAK error.
    // Tapi di Safari/WebKit (SEMUA browser di iPhone wajib pakai mesin WebKit) hal yang sama
    // melempar RangeError ("Invalid time value"), yang menghentikan seluruh proses render
    // daftar PR & Tugas di tengah jalan (list jadi kosong/gagal) — hanya terjadi di iPhone.
    // formatDate/formatDateSafe kini memakai safeDate() dari
    // supabase-config.js (satu sumber logika parsing tanggal anti-crash
    // Safari/iOS, dipakai bersama di semua halaman).
    function formatDate(iso) {
      if (!iso) return '-';
      try {
        const d = safeDate(iso);
        if (!d || isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      } catch (e) {
        return '-';
      }
    }

    function formatDateSafe(dateStr) {
      if (!dateStr) return '-';
      try {
        const d = safeDate(dateStr);
        if (!d || isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('id-ID');
      } catch (e) {
        return dateStr;
      }
    }

// ===== load data from Supabase =====
    const jadwalData = {};

// ============================================================
    // 1. fetchAndRenderJadwal(targetKelas)
    // Catatan: fungsi buildJadwalMap() sudah disediakan oleh
    // supabase-config.js (dimuat sebelum script ini).
    // ============================================================
    // Mengambil data jadwal dari tabel 'jadwal' (filter kelas),
    // mengelompokkan per hari via buildJadwalMap, lalu render ke UI.
    // ============================================================
    async function fetchAndRenderJadwal(targetKelas) {
      const container = document.getElementById('jadwal-container');
      if (!container) {
        console.warn('Element #jadwal-container tidak ditemukan.');
        return;
      }

      container.innerHTML = `
        <div class="flex items-center justify-center gap-3 py-10 text-blue-800">
          <i data-lucide="loader" class="w-5 h-5 animate-spin"></i>
          <span class="text-sm">Memuat jadwal ${targetKelas}...</span>
        </div>`;
      lucide.createIcons();

      try {
        var result = await supabaseFetchWithRetry(function() {
          return supabase.from('jadwal').select('*').ilike('kelas', targetKelas).order('hari').order('jam');
        }, 5000, 3);
        var data = result.data;
        var error = result.error;

        if (error) {
          console.error('Error fetching jadwal:', error.message);
          toast('Gagal memuat jadwal: ' + error.message, 'error');
          container.innerHTML = `
            <div class="text-center py-10 text-rose-500">
              <i data-lucide="alert-triangle" class="w-8 h-8 mx-auto mb-2 opacity-70"></i>
              <p class="text-sm">Gagal memuat jadwal. Periksa koneksi internet Anda. <button type="button" onclick="fetchAndRenderJadwal('${targetKelas}')" style="background:none;border:none;color:inherit;text-decoration:underline;cursor:pointer;">Coba Lagi</button></p>
            </div>`;
          lucide.createIcons();
          return;
        }

        console.log('Jadwal ' + targetKelas + ' berhasil diambil:', data.length, 'baris');

        const jadwalMap = buildJadwalMap(data || []);

        Object.keys(jadwalData).forEach(function(k) { delete jadwalData[k]; });
        const days = ['Senin','Selasa','Rabu','Kamis','Jumat'];
        days.forEach(function(d) { jadwalData[d] = (jadwalMap[d] || []).map(function(r) { return { id: r.id, jam: r.jam, mapel: r.mapel, guru: r.guru }; }); });

        autoSelectTodaySchedule();
      } catch (err) {
        debugAlert('fetchAndRenderJadwal', err);
        container.innerHTML = `
          <div class="text-center py-10 text-rose-500">
            <i data-lucide="alert-triangle" class="w-8 h-8 mx-auto mb-2 opacity-70"></i>
            <p class="text-sm">Gagal memuat jadwal. Periksa koneksi internet Anda. <button type="button" onclick="fetchAndRenderJadwal('${targetKelas}')" style="background:none;border:none;color:inherit;text-decoration:underline;cursor:pointer;">Coba Lagi</button></p>
          </div>`;
        lucide.createIcons();
        toast('Terjadi kesalahan tak terduga.', 'error');
      }
    }

// ============================================================
    // 2. renderJadwalToUI(jadwalMap)
    // Mengisi container #jadwal-container dengan kartu per hari
    // gaya Bento Grid / Glassmorphism.
    // HANYA menampilkan hari yang sedang aktif (currentDay),
    // sehingga daftar tidak menumpuk ke bawah (tidak stacked).
    // ============================================================
    function renderJadwalToUI(jadwalMap) {
      const container = document.getElementById('jadwal-container');
      if (!container) return;

      const days = ['Senin','Selasa','Rabu','Kamis','Jumat'];

      // Cek apakah ada data sama sekali
      const hasData = days.some(d => (jadwalMap[d] || []).length > 0);
      if (!hasData) {
        container.innerHTML = `
          <div class="text-center py-10 text-slate-500">
            <i data-lucide="calendar-x" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
            <p class="text-sm">Belum ada jadwal untuk kelas ini.</p>
          </div>`;
        lucide.createIcons();
        return;
      }

      // Hanya tampilkan jadwal untuk hari yang aktif (currentDay)
      const day = currentDay;
      const items = jadwalMap[day] || [];

      if (items.length === 0) {
        container.innerHTML = `
          <div class="text-center py-10 text-slate-500">
            <i data-lucide="calendar-x" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
            <p class="text-sm">Tidak ada jadwal pelajaran hari ${day}.</p>
          </div>`;
        lucide.createIcons();
        return;
      }

      container.innerHTML = `
        <div class="card rounded-2xl overflow-hidden">
          <div class="flex items-center gap-2 px-4 py-3 bg-blue-50 border-b border-blue-200">
            <i data-lucide="calendar-days" class="w-4 h-4 text-blue-600"></i>
            <h3 class="font-bold text-sm text-blue-800">${day}</h3>
            <span class="ml-auto text-[11px] text-slate-500">${items.length} pelajaran</span>
          </div>
          <div class="divide-y divide-slate-200">
            ${items.map((row, i) => `
              <div class="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition">
                <div class="shrink-0 w-24 text-center">
                  <span class="inline-block px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-bold text-blue-700">
                    ${row.jam}
                  </span>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="font-semibold text-sm text-slate-800 truncate">${row.mapel}</p>
                  <p class="text-[11px] text-slate-500 truncate flex items-center gap-1">
                    <i data-lucide="user" class="w-3 h-3"></i> ${row.guru}
                  </p>
                </div>
              </div>
            `).join('')}
          </div>
        </div>`;

      lucide.createIcons();
    }

const prData = [];
    async function loadPrFromDB() {
      var list = document.getElementById('prList');
      if (list) {
        list.innerHTML = '<p class="text-sm text-slate-500 text-center py-6"><i data-lucide="loader" class="w-5 h-5 animate-spin inline mr-2"></i>Memuat PR...</p>';
        lucide.createIcons();
      }

      try {
        var result = await supabaseFetchWithRetry(function() {
          return supabase.from('tugas').select('*').ilike('kelas', kelasConfig.className).order('deadline');
        }, 5000, 3);
        var data = result.data;
        var error = result.error;

        if (error) {
          console.error('load tugas error:', error.message);
          if (list) {
            list.innerHTML = '<p class="text-sm text-rose-500 text-center py-6">Gagal memuat PR. Periksa koneksi internet Anda. <button type="button" onclick="loadPrFromDB()" style="background:none;border:none;color:inherit;text-decoration:underline;cursor:pointer;">Coba Lagi</button></p>';
          }
          return;
        }
        prData.length = 0;
        data.forEach(function(t) { prData.push({ id: t.id, mapel: t.mapel, desc: t.deskripsi, due: t.deadline }); });
        renderPR();
      } catch (err) {
        debugAlert('loadPrFromDB (fetch tugas)', err);
        if (list) {
          list.innerHTML = '<p class="text-sm text-rose-500 text-center py-6">Gagal memuat data. Periksa koneksi internet Anda. <button type="button" onclick="loadPrFromDB()" style="background:none;border:none;color:inherit;text-decoration:underline;cursor:pointer;">Coba Lagi</button></p>';
        }
      }
    }
    const piketData = [];
    async function loadPiketFromDB() {
      await loadPiketList();
    }

    // ===== initial renders (dipanggil setelah restoreSession selesai) =====
    async function initialLoad() {
      await Promise.allSettled([
        loadPrFromDB(),
        loadPiketFromDB(),
        loadKasList()
      ]);
    }

// ===== initial renders =====
    // initialLoad() dipanggil di dalam restoreSession()

    // ===== SUPABASE FETCH HELPERS (Timeout + Retry + Cache Buster) =====
    async function supabaseFetch(queryFn, timeoutMs) {
      timeoutMs = timeoutMs || 5000;
      return new Promise(function(resolve, reject) {
        var timer = setTimeout(function() {
          reject(new Error('TIMEOUT'));
        }, timeoutMs);
        queryFn().then(function(result) {
          clearTimeout(timer);
          resolve(result);
        }).catch(function(err) {
          clearTimeout(timer);
          reject(err);
        });
      });
    }

    async function supabaseFetchWithRetry(queryFn, timeoutMs, maxRetries) {
      timeoutMs = timeoutMs || 5000;
      maxRetries = maxRetries || 3;
      var retryDelay = 1000;
      for (var attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await supabaseFetch(queryFn, timeoutMs);
        } catch (err) {
          if (attempt >= maxRetries) {
            throw err;
          }
          await new Promise(function(resolve) { setTimeout(resolve, retryDelay); });
          retryDelay = retryDelay * 2;
        }
      }
    }

    // ===== SAFE STORAGE WRAPPER (Safari Private Browsing compatible) =====
    var safeStorage = {
      getItem: function(key) {
        try {
          var val = localStorage.getItem(key);
          if (val !== null) return val;
        } catch (e) {}
        try {
          var val2 = sessionStorage.getItem(key);
          if (val2 !== null) return val2;
        } catch (e) {}
        return null;
      },
      setItem: function(key, value) {
        try { localStorage.setItem(key, value); return; } catch (e) {}
        try { sessionStorage.setItem(key, value); } catch (e) {}
      },
      removeItem: function(key) {
        try { localStorage.removeItem(key); } catch (e) {}
        try { sessionStorage.removeItem(key); } catch (e) {}
      }
    };

    // ===== FORCE BENDARA UI (explicit kas form render for Safari iOS) =====
    function forceBendaharaUI() {
      // Diisolasi try/catch: kalau ini gagal, jangan sampai ikut menjatuhkan
      // alur restoreSession/initialLoad lainnya (Tugas/Piket tetap harus tampil).
      try {
        checkRoleKasAccess();
      } catch (e) {
        debugAlert('forceBendaharaUI', e);
      }
    }

    // ===== RESTORE LOGIN SESSION =====
    // Menggunakan helper global getLoggedInUser() dari supabase-config.js
    // yang mengecek sessionStorage & localStorage untuk semua key yang mungkin.
    async function restoreSession() {
      var stored = null;

      // 1) Coba validasi session langsung via Supabase Auth (paling akurat) dengan timeout/retry
      try {
        var sessionResult = await supabaseFetchWithRetry(function() {
          return supabase.auth.getSession();
        }, 5000, 3);
        var session = sessionResult.data && sessionResult.data.session;
        if (session && session.user) {
          var profileResult = await supabaseFetchWithRetry(function() {
            return supabase.from('profiles').select('nama, kelas, role, nama_lengkap, username').eq('id', session.user.id).single();
          }, 5000, 3);
          var profile = profileResult.data;
          if (profile) {
            currentUser = {
              id: session.user.id,
              name: profile.nama_lengkap || profile.nama || profile.username || 'User',
              cls: profile.kelas || null,
              role: profile.role || 'siswa'
            };
            safeStorageSet(window.localStorage, 'angkatan41_user', JSON.stringify(currentUser));
            safeStorageSet(window.localStorage, 'currentUser', JSON.stringify(currentUser));
            applyRolePermissions();
            forceBendaharaUI();
            initialLoad();
            applyAuthUI();
            return;
          }
        }
      } catch (err) {
        console.warn('Gagal validasi session Supabase Auth, fallback ke localStorage:', err.message || err);
      }

      // 2) Fallback: baca localStorage / sessionStorage (dengan retry untuk Safari)
      var maxRetries = 3;
      var retryDelay = 120;
      for (var attempt = 1; attempt <= maxRetries; attempt++) {
        stored = getLoggedInUser();
        if (stored) break;
        if (attempt < maxRetries) {
          await new Promise(function(resolve) { setTimeout(resolve, retryDelay); });
        }
      }

      if (!stored) {
        // 3) Fallback ekstra: cek safeStorage untuk role tertentu (Safari Private Mode)
        var fallbackRole = safeStorage.getItem('user_role');
        if (fallbackRole) {
          currentUser = {
            name: safeStorage.getItem('user_name') || 'User',
            cls: safeStorage.getItem('user_kelas') || null,
            role: fallbackRole
          };
          applyRolePermissions();
          forceBendaharaUI();
          initialLoad();
          applyAuthUI();
          return;
        }

        currentUser = null;
        resetToGuestMode();
        initialLoad();
        applyAuthUI();
        return;
      }

      currentUser = {
        name: stored.nama_lengkap || stored.nama || stored.username || 'User',
        cls: stored.kelas || null,
        role: stored.role || 'siswa'
      };
      applyRolePermissions();
      forceBendaharaUI();
      initialLoad();
      applyAuthUI();
    }

    // ===== GUEST / READ-ONLY MODE =====
    // Menampilkan tampilan publik: sembunyikan absen & tombol edit.
    function resetToGuestMode() {
      var loginBtnEl = document.getElementById('loginBtn');
      var userChip = document.getElementById('userChip');
      if (loginBtnEl) loginBtnEl.classList.remove('hidden');
      if (userChip) { userChip.classList.add('hidden'); userChip.classList.remove('flex'); }

      var notLoggedIn = document.getElementById('notLoggedIn');
      var loggedIn = document.getElementById('loggedIn');
      if (notLoggedIn) notLoggedIn.classList.remove('hidden');
      if (loggedIn) loggedIn.classList.add('hidden');

      var accPanel = document.getElementById('accPanel');
      if (accPanel) accPanel.classList.add('hidden');

      document.querySelectorAll('.admin-only').forEach(function(el) { el.classList.add('hidden'); });
      var addPrBtn = document.getElementById('addPrBtn');
      if (addPrBtn) addPrBtn.classList.add('hidden');

      canManagePR = false;

      var kasCard = document.getElementById('kas');
      if (kasCard) kasCard.classList.add('hidden');

      try { renderJadwal(); } catch (e) { debugAlert('renderJadwal (resetToGuestMode)', e); }
      try { renderPR(); } catch (e) { debugAlert('renderPR (resetToGuestMode)', e); }
      try { renderPiket(); } catch (e) { debugAlert('renderPiket (resetToGuestMode)', e); }
      try { loadAccList(); } catch (e) { debugAlert('loadAccList (resetToGuestMode)', e); }
      try { updateStats(); } catch (e) { debugAlert('updateStats (resetToGuestMode)', e); }
    }
    // restoreSession() dipanggil di paling bawah script,
    // setelah semua data & fungsi terdefinisi (hindari error TDZ).


    // ============================================================
    // 3. DOMContentLoaded -> fetchAndRenderJadwal('IX-B')
    // Memuat jadwal otomatis saat halaman selesai dimuat.
    // ============================================================
    document.addEventListener('DOMContentLoaded', () => {
      // Kelas halaman ini adalah IX-B (lihat kelasConfig)
      fetchAndRenderJadwal(kelasConfig.className);
    });

    // Fallback: jika DOM sudah siap sebelum listener terpasang
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      fetchAndRenderJadwal(kelasConfig.className);
    }

    // ===== MOBILE MENU =====
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    mobileMenuBtn.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));

    // ===== REVEAL =====
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('active'); revealObserver.unobserve(e.target); } });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

    // ===== LOGIN MODAL =====
    const loginModal = document.getElementById('loginModal');
    const loginBtn = document.getElementById('loginBtn');
    const closeLogin = document.getElementById('closeLogin');
const loginBackdrop = document.getElementById('loginBackdrop');
    function closeLoginFn() { loginModal.classList.add('hidden'); loginModal.classList.remove('flex'); }
    // Login button now navigates to login.html
    loginBtn.addEventListener('click', (e) => { e.preventDefault(); window.location.href = 'login.html'; });
    closeLogin.addEventListener('click', closeLoginFn);
    loginBackdrop.addEventListener('click', closeLoginFn);

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { toast(error.message, 'error'); return; }
const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
      if (!profile) { toast('Profil tidak ditemukan!', 'error'); return; }
currentUser = { id: data.user.id, name: profile.nama, cls: profile.kelas, role: profile.role };
      safeStorageSet(window.localStorage, 'angkatan41_user', JSON.stringify(currentUser));
      safeStorageSet(window.localStorage, 'currentUser', JSON.stringify(currentUser));
      closeLoginFn();
      applyRolePermissions();
      applyAuthUI();
      syncHeaderAvatar();
      console.log('Logged in as', currentUser);
    });

// ===== ROLE & KELAS VALIDATION =====
    // Aturan resmi hak akses (validasi KELAS dulu, lalu ROLE).
    // Jika user.kelas != KELAS_HALAMAN_INI -> SEMUA fitur action READ-ONLY.
    // Jika user berada di kelasnya sendiri, terapkan pembagian grup role berikut:

    // ===== (1) NORMALISASI FORMAT KELAS =====
    // Case-insensitive & abaikan karakter non-alfanumerik.
    // 'IX-B', 'IXB', 'ix b' semuanya menjadi 'IXB'.
    function normalizeKelas(k) {
      return String(k || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    }
    const PAGES_KELAS = normalizeKelas(kelasConfig.className); // 'IXB'

    // KELOMPOK A: dapat ABSEN & EDIT/TAMBAH TUGAS/PR.
    // Berikut untuk SEMUA role di daftar ini:
    const GROUP_A_ROLES = ['wali_kelas', 'ketua_kelas', 'wakil_ketua', 'sekretaris', 'bendahara', 'kebersihan', 'perlengkapan', 'kedisiplinan', 'siswa'];
    // KELOMPOK B: dapat EDIT JAM PELAJARAN, EDIT PIKET, & ACC ABSEN.
    // KHUSUS 3 role berikut:
    const GROUP_B_ROLES = ['wali_kelas', 'ketua_kelas', 'wakil_ketua'];

    // Normalisasi role juga (case-insensitive)
    function normRole(r) {
      return String(r || '').toLowerCase();
    }

    function isThisClassUser() {
      if (!currentUser) return false;
      const userKelas = normalizeKelas(currentUser.cls);
      return userKelas === PAGES_KELAS;
    }
    function isGlobalAdmin() {
      return currentUser && normRole(currentUser.role) === 'admin';
    }
    function isGroupA() {
      const r = normRole(currentUser && currentUser.role);
      return isThisClassUser() && GROUP_A_ROLES.includes(r);
    }
    function isGroupB() {
      const r = normRole(currentUser && currentUser.role);
      return isThisClassUser() && GROUP_B_ROLES.includes(r);
    }
    function isSekretaris() {
      if (!currentUser) return false;
      const roleMatch = normRole(currentUser.role) === 'sekretaris';
      const userClass = String(currentUser.kelas || currentUser.cls || currentUser.class || '').toUpperCase();
      return roleMatch && userClass === CURRENT_PAGE_CLASS;
    }
    // Absen & kelola PR/Tugas: admin global ATAU user kelas ini dengan role Kelompok A.
    function canAbsenAndManagePR() {
      return isGlobalAdmin() || isGroupA();
    }
    // Edit jam pelajaran, piket, & ACC absen: admin global ATAU user kelas ini dengan role Kelompok B.
    function canManageSchedule() {
      return isGlobalAdmin() || isGroupB();
    }
    // Kelola kas: HANYA Bendahara dengan kelas yang sama.
    function canManageKas() {
      if (!currentUser) return false;
      const userRole = String(currentUser.role || currentUser.jabatan || '').toLowerCase();
      const userClass = String(currentUser.kelas || currentUser.class || currentUser.cls || '').toLowerCase();

      if (userRole !== 'bendahara') {
        return false;
      }

      const pageClass = String(kelasConfig.className || '').toLowerCase();
      const isSameClass = userClass.includes(pageClass) || userClass.includes(pageClass.replace('-', ''));

      return isSameClass;
    }

    // ===== KAS ROLE-BASED ACCESS =====
    function updateKasSubmitListener() {
      const kasForm = document.getElementById('kasForm');
      if (!kasForm || !kasForm._kasHandler) return;

      const userRole = (currentUser?.role || currentUser?.jabatan || '').toLowerCase();
      const userKelas = (currentUser?.kelas || currentUser?.cls || currentUser?.class || '').toUpperCase();
      const targetPageKelas = kelasConfig.className.toUpperCase();
      const isAuthorized = (userRole === 'bendahara') && (userKelas === targetPageKelas);

      if (isAuthorized) {
        if (!kasForm._listenerAttached) {
          kasForm.addEventListener('submit', kasForm._kasHandler);
          kasForm._listenerAttached = true;
        }
      } else {
        if (kasForm._listenerAttached) {
          kasForm.removeEventListener('submit', kasForm._kasHandler);
          kasForm._listenerAttached = false;
        }
      }
    }

    function checkRoleKasAccess() {
      const kasFormEl = document.getElementById('kasForm');
      if (!kasFormEl) return;

      if (!currentUser) {
        kasFormEl.classList.add('hidden');
        kasFormEl.style.setProperty('display', 'none', 'important');
        return;
      }

      const userRole = (currentUser?.role || currentUser?.jabatan || '').toLowerCase();
      const userKelas = (currentUser?.kelas || currentUser?.cls || currentUser?.class || '').toUpperCase();
      const targetPageKelas = (kelasConfig?.className || '').toUpperCase();

      const isAuthorized = (userRole === 'bendahara') && (userKelas === targetPageKelas);

      if (isAuthorized) {
        kasFormEl.classList.remove('hidden');
        kasFormEl.style.setProperty('display', 'block', 'important');
      } else {
        kasFormEl.classList.add('hidden');
        kasFormEl.style.setProperty('display', 'none', 'important');
      }

      updateKasSubmitListener();
    }

    function applyRolePermissions() {
      const isThisClass = isThisClassUser();
      const isGrpA = isGroupA();
      const isGrpB = isGroupB();
      const canAbsenPR = canAbsenAndManagePR();
      const canManSched = canManageSchedule();

      // ===== (3) DEBUG LOG (buka Console Browser F12) =====
      console.log("=== applyRolePermissions() ===");
      console.log("User Data:", currentUser);
      console.log("Kelas Halaman (normalized):", PAGES_KELAS);
      console.log("User kelas (raw):", currentUser && currentUser.cls, "-> (normalized):", currentUser && normalizeKelas(currentUser.cls));
      console.log("Is Siswa Kelas Ini:", isThisClass);
      console.log("Is Group A:", isGrpA);
      console.log("Is Group B:", isGrpB);
      console.log("canAbsenAndManagePR:", canAbsenPR);
      console.log("canManageSchedule:", canManSched);
      console.log('User Role:', (currentUser ? currentUser.role : null) || (currentUser ? currentUser.jabatan : null), 'Can Manage Kas:', canManageKas());

      if (currentUser) {
        document.getElementById('loginBtn').classList.add('hidden');
        document.getElementById('userChip').classList.remove('hidden');
        document.getElementById('userChip').classList.add('flex');
        document.getElementById('userName').textContent = currentUser.name;
      } else {
        document.getElementById('loginBtn').classList.remove('hidden');
        document.getElementById('userChip').classList.add('hidden');
        document.getElementById('userChip').classList.remove('flex');
      }

      // ===== ABSENSI (KELOMPOK A): hanya untuk user kelas ini =====
      // Syarat aktif: sudah login DAN user.kelas === KELAS_HALAMAN_INI
      if (canAbsenPR) {
        document.getElementById('notLoggedIn').classList.add('hidden');
        document.getElementById('loggedIn').classList.remove('hidden');
        document.getElementById('absenName').textContent = currentUser.name;
      } else {
        document.getElementById('loggedIn').classList.add('hidden');
        document.getElementById('notLoggedIn').classList.remove('hidden');
      }

// ===== JADWAL & PIKET MANAGEMENT (KELOMPOK B): HANYA wali/ketua/wakil KELAS INI / global admin =====
      document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !canManSched));

      // ===== PANEL ACC ABSEN (KELOMPOK B): wali/ketua/wakil kelas ini / global admin =====
      const accPanel = document.getElementById('accPanel');
      if (accPanel) {
        accPanel.classList.toggle('hidden', !canManSched);
      }

      // ===== PR/TUGAS MANAGEMENT: HANYA SEKRETARIS =====
      canManagePR = isSekretaris();
      document.getElementById('addPrBtn').classList.toggle('hidden', !isSekretaris());

      // ===== KAS MANAGEMENT =====
      checkRoleKasAccess();

      // Re-render: setiap panggilan dipisah try/catch supaya satu fungsi yang
      // error TIDAK menghentikan fungsi render lain sesudahnya (anti chain-reaction).
      try { renderJadwal(); } catch (e) { debugAlert('renderJadwal (applyRolePermissions)', e); }
      try { renderPR(); } catch (e) { debugAlert('renderPR (applyRolePermissions)', e); }
      try { renderPiket(); } catch (e) { debugAlert('renderPiket (applyRolePermissions)', e); }
      try { loadAccList(); } catch (e) { debugAlert('loadAccList (applyRolePermissions)', e); }
      try { updateStats(); } catch (e) { debugAlert('updateStats (applyRolePermissions)', e); }
      if (currentUser) { try { checkUserAbsenToday(); } catch (e) { debugAlert('checkUserAbsenToday', e); } }
    }

// ===== ABSENSI SUPABASE =====
    // Helper: tanggal & jam hari ini
function todayDateStr() {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    // Senin di minggu ini (YYYY-MM-DD)
    function getMonday() {
      const d = new Date();
      const day = d.getDay(); // 0=Min,1=Sen,...,6=Sab
      const diff = (day === 0) ? -6 : 1 - day;
      const monday = new Date(d);
      monday.setDate(d.getDate() + diff);
      const y = monday.getFullYear();
      const m = String(monday.getMonth() + 1).padStart(2, '0');
      const dd = String(monday.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    }
    // Jumlah hari sekolah (Sen-Jum) yang sudah lewat sejak Senin sampai hari ini
    function countWeekdaysElapsed() {
      const d = new Date();
      const day = d.getDay(); // 0=Min,1=Sen
      if (day === 0) return 0;
      if (day === 6) return 5;
      return day; // Sen=1, Sel=2, Rab=3, Kam=4, Jum=5
    }

// Tampilkan UI berdasarkan status ACC
    // mode: 'pending' (menunggu) | 'approved' (disetujui)
    function setSudahAbsenUI(mode) {
      const absenStatus = document.getElementById('absenStatus');
      const absenBtn = document.getElementById('absenBtn');
      if (absenStatus) {
        absenStatus.classList.remove('hidden');
        absenStatus.innerHTML = '';
        if (mode === 'approved') {
          absenStatus.className = 'mt-3 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm font-semibold';
          absenStatus.innerHTML = '<i data-lucide="check-circle-2" class="w-4 h-4 inline"></i> Sudah absen hari ini (Disetujui)';
        } else {
          absenStatus.className = 'mt-3 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm font-semibold';
          absenStatus.innerHTML = '<i data-lucide="clock" class="w-4 h-4 inline"></i> Menunggu konfirmasi absen';
        }
        lucide.createIcons();
      }
      if (absenBtn) {
        absenBtn.classList.add('disabled', 'opacity-50', 'pointer-events-none');
        absenBtn.innerHTML = '<i data-lucide="check-circle" class="w-5 h-5"></i> Sudah Absen Hari Ini';
        lucide.createIcons();
      }
    }

    // Cek apakah user ini sudah absen hari ini
    async function checkUserAbsenToday() {
      if (!currentUser) return;
      const nama = currentUser.name;
      const tanggal = todayDateStr();
      try {
        const { data, error } = await supabaseFetchWithRetry(function() {
          return supabase.from('absensi').select('*').eq('kelas', kelasConfig.className).eq('tanggal', tanggal).eq('nama_siswa', nama);
        }, 5000, 3);
        if (error) { console.error('check absen error:', error.message); return; }
        if (data && data.length > 0) {
          const status = (data[0].status_approval || 'Pending').toLowerCase();
          const approved = status === 'approved';
          setSudahAbsenUI(approved ? 'approved' : 'pending');
        }
      } catch (err) {
        debugAlert('checkUserAbsenToday (fetch)', err);
      }
    }

// ===== ABSEN MODAL (pilihan status) =====
    const absenModal = document.getElementById('absenModal');
    const openAbsenModal = () => {
      document.getElementById('absenForm').reset();
      document.getElementById('absenAlasan').value = '';
      document.getElementById('alasanField').classList.add('hidden');
      absenModal.classList.remove('hidden'); absenModal.classList.add('flex');
    };
    const closeAbsenModal = () => {
      absenModal.classList.add('hidden'); absenModal.classList.remove('flex');
    };
    document.getElementById('closeAbsenModal').addEventListener('click', closeAbsenModal);
    document.getElementById('absenBackdrop').addEventListener('click', closeAbsenModal);

    // Toggle field alasan saat status Izin/Sakit dipilih
    document.querySelectorAll('input[name="absenStatus"]').forEach(r => {
      r.addEventListener('change', () => {
        const v = document.querySelector('input[name="absenStatus"]:checked').value;
        document.getElementById('alasanField').classList.toggle('hidden', v === 'Hadir');
      });
    });

    // ===== TOMBOL ABSEN HARI INI (buka modal) =====
    document.getElementById('absenBtn').addEventListener('click', async () => {
      if (!currentUser) {
        toast('Login dulu sebagai siswa kelas ini untuk absen.', 'error');
        return;
      }
      if (normalizeKelas(currentUser.cls) !== PAGES_KELAS) {
        toast('Kamu bukan siswa kelas ' + kelasConfig.className + '. Tidak bisa absen di sini.', 'error');
        return;
      }
      const nama = currentUser.name;
      const tanggal = todayDateStr();

      // Cek apakah sudah absen hari ini
      const { data: existing, error: cekErr } = await supabase
        .from('absensi')
        .select('*')
        .eq('kelas', kelasConfig.className)
        .eq('tanggal', tanggal)
        .eq('nama_siswa', nama);
      if (cekErr) { toast(cekErr.message, 'error'); return; }
if (existing && existing.length > 0) {
        toast('Kamu sudah absen hari ini.', 'info');
        const st = (existing[0].status_approval || 'Pending').toLowerCase();
        const approved = st === 'approved';
        setSudahAbsenUI(approved ? 'approved' : 'pending');
        return;
      }
      openAbsenModal();
    });

    // ===== SUBMIT ABSEN MODAL =====
    document.getElementById('absenForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentUser) { toast('Login dulu.', 'error'); return; }
      const nama = currentUser.name || currentUser.nama_lengkap;
      const tanggal = todayDateStr();
      const status = document.querySelector('input[name="absenStatus"]:checked').value;
      const alasan = document.getElementById('absenAlasan').value.trim();

const payload = {
        nama_siswa: nama,
        kelas: kelasConfig.className,
        tanggal: tanggal,
        keterangan: status, // 'Hadir', 'Izin', 'Sakit'
        alasan: alasan || '',
        status_approval: 'Pending'
      };
      const { error } = await supabase.from('absensi').insert(payload);
      if (error) { toast(error.message, 'error'); return; }

      closeAbsenModal();
      setSudahAbsenUI('pending');
      toast('Absen ' + status + ' terkirim! Menunggu konfirmasi.');
      loadAccList();
      updateStats();
    });

    // ===== PANEL ACC ABSENSI (query data REAL dari Supabase) =====
    async function loadAccList() {
      const list = document.getElementById('accList');
      if (!list) return;
      const tanggal = todayDateStr();
      try {
        const { data, error } = await supabaseFetchWithRetry(function() {
          return supabase.from('absensi').select('*').eq('kelas', kelasConfig.className).eq('tanggal', tanggal).eq('status_approval', 'Pending');
        }, 5000, 3);
        if (error) { console.error('load acc list error:', error.message); return; }

        if (!data || data.length === 0) {
          list.innerHTML = `<p class="text-xs text-slate-500 text-center py-3">Belum ada siswa yang absen hari ini.</p>`;
          return;
        }
        list.innerHTML = data.map(s => `
          <div class="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-slate-200">
            <div class="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
              <i data-lucide="user" class="w-4 h-4 text-white"></i>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold truncate">${s.nama_siswa}</p>
              <p class="text-[11px] text-slate-500">${s.keterangan}</p>
            </div>
            <button onclick="accStudent('${s.id}')" class="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-bold border border-blue-200 hover:bg-blue-100 transition">
              ACC
            </button>
          </div>
        `).join('');
        lucide.createIcons();
      } catch (err) {
        debugAlert('loadAccList (fetch)', err);
      }
    }

// ===== EKSEKUSI TOMBOL ACC =====
    async function accStudent(id) {
      const upd = { status_approval: 'Approved', approved_by: currentUser ? currentUser.name : null };
      const { error } = await supabase
        .from('absensi')
        .update(upd)
        .eq('id', id);
      if (error) { toast(error.message, 'error'); return; }
      toast('Absensi siswa disetujui ✅');
      loadAccList();
      updateStats();
    }

    // ===== STATISTIK KEHADIRAN (Hari Ini & Minggu Ini) =====
    async function updateStats() {
      const tanggal = todayDateStr();
      const monday = getMonday();
      const weekdays = countWeekdaysElapsed();

      let totalSiswa = 0;
      try {
        const result = await supabaseFetchWithRetry(function() {
          return supabase.from('profiles').select('*').eq('kelas', kelasConfig.className).eq('role', 'siswa');
        }, 5000, 3);
        const siswa = result.data;
        const errKelas = result.error;
        if (!errKelas && siswa) totalSiswa = siswa.length;
      } catch (err) {
        debugAlert('updateStats (profiles)', err);
      }
      if (totalSiswa === 0) totalSiswa = kelasConfig.jumlahSiswa;

      let hadirToday = 0;
      try {
        const result = await supabaseFetchWithRetry(function() {
          return supabase.from('absensi').select('*').eq('kelas', kelasConfig.className).eq('tanggal', tanggal);
        }, 5000, 3);
        const today = result.data;
        const errToday = result.error;
        hadirToday = (!errToday && today) ? today.filter(function(row) { return (row.status_approval || '').toLowerCase() === 'approved' && row.keterangan === 'Hadir'; }).length : 0;
      } catch (err) {
        debugAlert('updateStats (today)', err);
      }

      let weekTotal = 0;
      try {
        const result = await supabaseFetchWithRetry(function() {
          return supabase.from('absensi').select('*').eq('kelas', kelasConfig.className).gte('tanggal', monday);
        }, 5000, 3);
        const week = result.data;
        const errWeek = result.error;
        weekTotal = (!errWeek && week) ? week.filter(function(row) { return (row.status_approval || '').toLowerCase() === 'approved' && row.keterangan === 'Hadir'; }).length : 0;
      } catch (err) {
        debugAlert('updateStats (week)', err);
      }

      const todayPct = totalSiswa ? Math.round((hadirToday / totalSiswa) * 100) : 0;
      const expectedWeek = totalSiswa * weekdays;
      const weekPct = expectedWeek ? Math.round((weekTotal / expectedWeek) * 100) : 0;

      const statToday = document.getElementById('statToday');
      const statTodayBar = document.getElementById('statTodayBar');
      const statWeek = document.getElementById('statWeek');
      const statWeekBar = document.getElementById('statWeekBar');
      if (statToday) statToday.textContent = `${hadirToday}/${totalSiswa}`;
      if (statTodayBar) statTodayBar.style.width = Math.min(100, todayPct) + '%';
      if (statWeek) statWeek.textContent = weekPct + '%';
      if (statWeekBar) statWeekBar.style.width = Math.min(100, weekPct) + '%';
    }

// ===== ADD MODAL (generic) =====
    const editModal = document.getElementById('editModal');
    const editBackdrop = document.getElementById('editBackdrop');
    const closeEdit = document.getElementById('closeEdit');
    const editFields = document.getElementById('editFields');
    const editForm = document.getElementById('editForm');
    const editModalTitle = document.getElementById('editModalTitle');
    let addType = null;

    function openEditModal(type) {
      if (type === 'pr' && !isSekretaris()) {
        alert('Akses ditolak! Hanya Sekretaris yang dapat menambah atau mengedit tugas.');
        return;
      }
      addType = type;
      editFields.innerHTML = '';
      if (type === 'jadwal') {
        editModalTitle.innerHTML = '<i data-lucide="calendar-plus" class="w-5 h-5 text-blue-600"></i> Tambah Jadwal';
        editFields.innerHTML = `
          <div><label class="block text-sm font-medium text-slate-600 mb-1.5">Hari</label>
            <select id="nf_day" class="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 outline-none focus:border-blue-500 text-sm ">
              <option>Senin</option><option>Selasa</option><option>Rabu</option><option>Kamis</option><option>Jumat</option>
            </select></div>
          <div><label class="block text-sm font-medium text-slate-600 mb-1.5">Jam</label>
            <input id="nf_jam" placeholder="07.00 - 08.20" class="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 outline-none focus:border-blue-500 text-sm"></div>
          <div><label class="block text-sm font-medium text-slate-600 mb-1.5">Mata Pelajaran</label>
            <input id="nf_mapel" placeholder="Matematika" class="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 outline-none focus:border-blue-500 text-sm"></div>
          <div><label class="block text-sm font-medium text-slate-600 mb-1.5">Guru</label>
            <input id="nf_guru" placeholder="Pak Budi" class="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 outline-none focus:border-blue-500 text-sm"></div>`;
      } else if (type === 'pr') {
        editModalTitle.innerHTML = '<i data-lucide="book-plus" class="w-5 h-5 text-blue-600"></i> Tambah PR';
        editFields.innerHTML = `
          <div><label class="block text-sm font-medium text-slate-600 mb-1.5">Mata Pelajaran</label>
            <input id="nf_mapel" placeholder="Matematika" class="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 outline-none focus:border-blue-500 text-sm"></div>
          <div><label class="block text-sm font-medium text-slate-600 mb-1.5">Deskripsi</label>
            <textarea id="nf_desc" rows="2" placeholder="Deskripsi tugas..." class="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 outline-none focus:border-blue-500 text-sm"></textarea></div>
          <div><label class="block text-sm font-medium text-slate-600 mb-1.5">Tanggal Kumpul</label>
            <input type="date" id="nf_due" class="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 outline-none focus:border-blue-500 text-sm "></div>`;
      } else if (type === 'piket') {
        editModalTitle.innerHTML = '<i data-lucide="broom" class="w-5 h-5 text-blue-600"></i> Tambah Piket';
        editFields.innerHTML = `
          <div><label class="block text-sm font-medium text-slate-600 mb-1.5">Hari</label>
            <select id="nf_hari" class="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 outline-none focus:border-blue-500 text-sm ">
              <option>Senin</option><option>Selasa</option><option>Rabu</option><option>Kamis</option><option>Jumat</option>
            </select></div>
          <div><label class="block text-sm font-medium text-slate-600 mb-1.5">Nama Siswa</label>
            <input id="nf_nama" placeholder="Ahmad, Rizky, dll" class="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 outline-none focus:border-blue-500 text-sm"></div>`;
      }
      lucide.createIcons();
      editModal.classList.remove('hidden'); editModal.classList.add('flex');
    }
    function closeEditFn() { editModal.classList.add('hidden'); editModal.classList.remove('flex'); }
    document.getElementById('addJadwalBtn').addEventListener('click', () => openEditModal('jadwal'));
    document.getElementById('addPrBtn').addEventListener('click', () => openEditModal('pr'));
document.getElementById('addPiketBtn').addEventListener('click', () => openPiketModal());
    closeEdit.addEventListener('click', closeEditFn);
    editBackdrop.addEventListener('click', closeEditFn);

    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (addType === 'jadwal') {
        const day = document.getElementById('nf_day').value;
        const payload = {
          kelas: kelasConfig.className,
          hari: day,
          jam: document.getElementById('nf_jam').value,
          mapel: document.getElementById('nf_mapel').value,
          nama_guru: document.getElementById('nf_guru').value
        };
        const { data, error } = await supabase.from('jadwal').insert(payload).select();
        if (error) { toast(error.message, 'error'); return; }
        jadwalData[day] = jadwalData[day] || [];
        jadwalData[day].push({ id: data[0].id, jam: payload.jam, mapel: payload.mapel, guru: payload.nama_guru });
        renderJadwal();
        toast('Jadwal ditambahkan!');
      } else if (addType === 'pr') {
        if (!isSekretaris()) {
          alert('Akses ditolak! Hanya Sekretaris yang dapat menambah atau mengedit tugas.');
          return;
        }
        const payload = {
          kelas: kelasConfig.className,
          mapel: document.getElementById('nf_mapel').value,
          deskripsi: document.getElementById('nf_desc').value,
          deadline: document.getElementById('nf_due').value
        };
        const { data, error } = await supabase.from('tugas').insert(payload).select();
        if (error) { toast(error.message, 'error'); return; }
        prData.push({ id: data[0].id, mapel: payload.mapel, desc: payload.deskripsi, due: payload.deadline });
        renderPR();
        toast('Tugas ditambahkan!');
      } else if (addType === 'piket') {
        const hari = document.getElementById('nf_hari').value;
        const namaSiswa = document.getElementById('nf_nama').value.trim();
        if (!namaSiswa) { toast('Nama siswa wajib diisi.', 'error'); return; }
        if (editPiketId) {
          await updatePiket(editPiketId, hari, namaSiswa);
        } else {
          await addPiket(hari, namaSiswa);
        }
        return;
      }
      closeEditFn();
    });

    // ===== TAMBAH KAS (via form) =====
    const kasFormEl = document.getElementById('kasForm');
    if (kasFormEl) {
      kasFormEl._kasHandler = async (e) => {
        e.preventDefault();
        const tipe = document.querySelector('input[name="kasTipe"]:checked').value;
        const jumlah = Number(document.getElementById('kasJumlah').value.replace(/\./g, ''));
        if (!jumlah || jumlah <= 0) { toast('Nominal tidak valid.', 'error'); return; }
        const keterangan = document.getElementById('kasKeterangan').value.trim();
        if (!keterangan) { toast('Keterangan wajib diisi.', 'error'); return; }
        const ok = await addKasTransaction(tipe, jumlah, keterangan);
        if (ok) { document.getElementById('kasForm').reset(); }
      };
    }

    // ===== Auth State Change Listener =====
    onAuthStateChange(function(event, session) {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        restoreSession();
      } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        clearStoredUser();
        resetToGuestMode();
        initialLoad();
        applyAuthUI();
      }
    });

    // ===== iOS Safari bfcache handling =====
    window.addEventListener('pageshow', function(event) {
      if (event.persisted) {
        restoreSession().then(function() {
          forceBendaharaUI();
          applyAuthUI();
        });
      }
    });

    // ===== RESTORE SESSION (di akhir, setelah semua data terdefinisi) =====
    (function() { restoreSession(); })();

    // ===== Login Status Check =====
    function readStoredUser() {
      const keys = ['angkatan41_user', 'currentUser', 'user', 'angkatan41_user_session'];
      const storages = [window.sessionStorage, window.localStorage];
      for (const store of storages) {
        for (const key of keys) {
          var raw = safeStorageGet(store, key);
          if (!raw) continue;
          try {
            var parsed = JSON.parse(raw);
            if (parsed && (parsed.username || parsed.nama || parsed.role)) {
              return parsed;
            }
          } catch (e) { /* ignore corrupt entries */ }
        }
      }
      return null;
    }

    function clearStoredUser() {
      const keys = ['angkatan41_user', 'currentUser', 'user', 'angkatan41_user_session'];
      const storages = [window.sessionStorage, window.localStorage];
      for (const store of storages) {
        for (const key of keys) {
          safeStorageRemove(store, key);
        }
      }
    }

    function applyAuthUI() {
      const loginBtn = document.getElementById('loginBtn');
      const userChip = document.getElementById('userChip');
      const userName = document.getElementById('userName');
      const logoutBtn = document.getElementById('logoutBtn');
      const user = readStoredUser() || currentUser;

      if (user) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (userChip) { userChip.classList.remove('hidden'); userChip.classList.add('flex'); }
        if (userName) userName.textContent = user.nama_lengkap || user.nama || user.username || 'User';
        if (logoutBtn) logoutBtn.classList.remove('hidden');
      } else {
        if (loginBtn) loginBtn.style.display = '';
        if (userChip) { userChip.classList.add('hidden'); userChip.classList.remove('flex'); }
        if (logoutBtn) logoutBtn.classList.add('hidden');
      }
    }

    // ===== Sync Header Avatar from Supabase =====
    async function syncHeaderAvatar() {
      var currentUser = typeof readStoredUser === 'function' ? readStoredUser() : null;
      if (!currentUser || !currentUser.id) return;
      var headerAvatar = document.getElementById('headerAvatarImg');
      var userName = document.getElementById('userName');
      if (!headerAvatar) return;
      try {
        var result = await supabaseFetchWithRetry(function() {
          return supabase.from('users').select('foto_url, username, nama_lengkap').eq('id', currentUser.id).single();
        }, 5000, 3);
        var userData = result.data;
        var error = result.error;
        if (error) throw error;
        if (userData && userData.foto_url) {
          headerAvatar.src = userData.foto_url;
        } else {
          var name = (userData && (userData.nama_lengkap || userData.username)) ? (userData.nama_lengkap || userData.username) : 'User';
          headerAvatar.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=random';
        }
        if (userData && userName) {
          userName.textContent = userData.nama_lengkap || userData.nama || userData.username || 'User';
        }
      } catch (err) {
        debugAlert('syncHeaderAvatar', err);
      }
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        showLogoutModal(function() {
          clearStoredUser();
          try { if (typeof supabase !== 'undefined' && supabase.auth) supabase.auth.signOut(); } catch (e) {}
          if (typeof applyAuthUI === 'function') applyAuthUI();
          window.location.href = 'index.html';
        });
      });
    }

    applyAuthUI();
    syncHeaderAvatar();
