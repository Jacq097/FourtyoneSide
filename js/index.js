// ===== iOS SAFARI GLOBAL ERROR CATCHER (khusus debugging) =====
    // Menangkap error JS yang tidak tertangani (mis. SyntaxError/RangeError
    // yang menghentikan seluruh script di Safari iOS) dan menampilkannya
    // lewat alert() supaya terlihat di iPhone, bukan cuma gagal diam-diam.
    window.onerror = function(msg, url, lineNo, columnNo, error) {
      alert('iOS Error: ' + msg + '\nLine: ' + lineNo);
      return false;
    };
  

    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
          },
        },
      },
    };
  

    // ===== Initialize Lucide Icons =====
    lucide.createIcons();

    // ===== Login Status Check =====
    // Read session from sessionStorage OR localStorage, across likely keys.
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

    const currentUser = readStoredUser();

    function applyAuthUI() {
      const loginBtn = document.getElementById('loginBtn');
      const userChip = document.getElementById('userChip');
      const profileName = document.getElementById('profileName');
      const logoutBtn = document.getElementById('logoutBtn');
      const mobileLoginBtn = document.getElementById('mobileLoginBtn');
      const mobileProfilBtn = document.getElementById('mobileProfilBtn');
      const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');

      const user = readStoredUser();

      if (user) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (userChip) { userChip.classList.remove('hidden'); userChip.classList.add('flex'); }
        if (profileName) profileName.textContent = user.nama_lengkap || user.nama || user.username || 'User';
        if (logoutBtn) {
          logoutBtn.className = 'hidden md:inline-flex p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition text-slate-600';
        }
        if (mobileLoginBtn) mobileLoginBtn.classList.add('hidden');
        if (mobileProfilBtn) mobileProfilBtn.classList.remove('hidden');
        if (mobileLogoutBtn) {
          mobileLogoutBtn.classList.remove('hidden');
          mobileLogoutBtn.onclick = function() {
            showLogoutModal(function() {
              clearStoredUser();
              try { if (typeof supabase !== 'undefined' && supabase.auth) supabase.auth.signOut(); } catch (e) {}
              if (typeof applyAuthUI === 'function') applyAuthUI();
              window.location.href = 'index.html';
            });
          };
        }
      } else {
        if (loginBtn) loginBtn.style.display = '';
        if (userChip) { userChip.classList.add('hidden'); userChip.classList.remove('flex'); }
        if (logoutBtn) {
          logoutBtn.className = 'hidden p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition text-slate-600';
        }
        if (mobileLoginBtn) mobileLoginBtn.classList.remove('hidden');
        if (mobileProfilBtn) mobileProfilBtn.classList.add('hidden');
        if (mobileLogoutBtn) mobileLogoutBtn.classList.add('hidden');
      }

      // Desktop logout handler
      if (logoutBtn && !logoutBtn._logoutHandlerAttached) {
        logoutBtn._logoutHandlerAttached = true;
        logoutBtn.addEventListener('click', () => {
          showLogoutModal(function() {
            clearStoredUser();
            try {
              if (typeof supabase !== 'undefined' && supabase.auth) supabase.auth.signOut();
            } catch (e) {}
            if (typeof applyAuthUI === 'function') applyAuthUI();
            window.location.href = 'index.html';
          });
        });
      }
    }

    // Run on load (script is at end of body, DOM is ready) + DOMContentLoaded for safety
    applyAuthUI();
    document.addEventListener('DOMContentLoaded', applyAuthUI);
    window.addEventListener('load', applyAuthUI);

    // ===== Sync Header Avatar from Supabase =====
    async function syncHeaderAvatar() {
      var currentUser = readStoredUser();
      if (!currentUser || !currentUser.id) return;
      var headerAvatar = document.getElementById('headerAvatarImg');
      if (!headerAvatar) return;
      try {
        var userDataResult = await supabase
          .from('users')
          .select('foto_url, username, nama_lengkap')
          .eq('id', currentUser.id)
          .single();
        var userData = userDataResult.data;
        var error = userDataResult.error;
        if (error) throw error;
        if (userData && userData.foto_url) {
          headerAvatar.src = userData.foto_url;
          headerAvatar.classList.remove('hidden');
        } else {
          var name = (userData && userData.nama_lengkap) ? userData.nama_lengkap : ((userData && userData.username) ? userData.username : 'User');
          headerAvatar.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=random';
        }
        safeStorageSet(window.localStorage, 'currentUser', JSON.stringify(Object.assign({}, currentUser, userData)));
      } catch (err) {
        debugAlert('syncHeaderAvatar', err);
      }
    }
    syncHeaderAvatar();

    // ===== Mobile Menu Toggle =====
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    mobileMenuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!mobileMenu.contains(e.target) && !mobileMenuBtn.contains(e.target) && !mobileMenu.classList.contains('hidden')) {
        mobileMenu.classList.add('hidden');
      }
    });

    // ===== Reveal on Scroll =====
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

    // ===== Galeri: Fetch dari Supabase =====
    let galleryData = [];

    async function fetchGallery() {
      var grid = document.getElementById('galleryGrid');
      if (grid) {
        grid.innerHTML = '<div class="col-span-full text-center py-16 text-slate-500"><i data-lucide="loader" class="w-10 h-10 mx-auto mb-3 animate-spin"></i><p>Memuat galeri...</p></div>';
        lucide.createIcons();
      }

      var result = await supabase
        .from('galeri')
        .select('*')
        .order('tanggal', { ascending: false })
        .limit(6);

      var data = result.data;
      var error = result.error;

      if (error) {
        console.error('Gagal fetch galeri:', error.message);
        if (grid) {
          grid.innerHTML = '<div class="col-span-full text-center py-16 text-rose-400"><i data-lucide="alert-triangle" class="w-10 h-10 mx-auto mb-3 opacity-70"></i><p>Gagal memuat galeri.</p></div>';
          lucide.createIcons();
        }
        return;
      }

      galleryData = (data || []).map(function(item) {
        return {
          src: item.foto_url || item.image_url || '',
          caption: item.caption || '',
          date: item.tanggal || ''
        };
      });

      renderGallery();
    }

    // formatDate() dibungkus try/catch + memakai safeDate() dari
    // supabase-config.js (anti-crash Safari/iOS untuk parsing tanggal).
    function formatDate(iso) {
      if (!iso) return '';
      try {
        const d = safeDate(iso);
        if (!d || isNaN(d.getTime())) return '';
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
      } catch (e) {
        return '';
      }
    }

    function renderGallery() {
      const grid = document.getElementById('galleryGrid');
      if (!grid) return;

      if (galleryData.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-16 text-slate-500">
          <i data-lucide="image-x" class="w-10 h-10 mx-auto mb-3 opacity-50"></i>
          <p>Belum ada foto di galeri.</p>
        </div>`;
        lucide.createIcons();
        return;
      }

      grid.innerHTML = galleryData.map((item, i) => `
        <div class="card rounded-2xl overflow-hidden mb-5 break-inside-avoid reveal">
          <div class="relative">
             <img src="${item.src}" alt="${item.caption}" class="w-full object-cover hover:scale-105 transition duration-500 previewable-img cursor-pointer" />
            <span class="absolute top-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white text-[11px] font-semibold text-slate-700 border border-slate-200">
              <i data-lucide="calendar" class="w-3 h-3"></i>
              ${formatDate(item.date)}
            </span>
          </div>
          <div class="p-4">
            <p class="text-sm font-medium text-slate-800">${item.caption}</p>
          </div>
        </div>
      `).join('');
      lucide.createIcons();
      grid.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
    }

    fetchGallery();

    let allSiswaData = [];

    async function fetchStudents() {
      var grid = document.getElementById('studentsGrid');
      if (grid) {
        grid.innerHTML = '<div class="col-span-full text-center py-16 text-slate-500"><i data-lucide="loader" class="w-10 h-10 mx-auto mb-3 animate-spin"></i><p>Memuat data siswa...</p></div>';
        lucide.createIcons();
      }

      var result = await supabase
        .from('users')
        .select('*')
        .neq('role', 'wali_kelas')
        .order('kelas');

      var data = result.data;
      var error = result.error;

      if (error) {
        console.error('Gagal fetch siswa:', error.message);
        if (grid) {
          grid.innerHTML = '<div class="col-span-full text-center py-16 text-rose-400"><i data-lucide="alert-triangle" class="w-10 h-10 mx-auto mb-3 opacity-70"></i><p>Gagal memuat data siswa.</p></div>';
          lucide.createIcons();
        }
        return;
      }

      allSiswaData = (data || []).map(function(s) {
        return {
          id: s.id,
          nama: s.nama_lengkap || s.nama || 'Tanpa Nama',
          kelas: s.kelas || 'IX-A',
          foto_url: s.foto_url || s.foto || s.avatar || null,
          quotes: s.quotes || s.motto || '',
          verif: !!s.verif || !!s.verified || false,
          note_text: s.note_text || '',
          note_created_at: s.note_created_at || null
        };
      });

      filterByKelas('Semua');
      updateStats();
    }

    function isNoteActive(note, noteCreatedAt) {
      if (!note || !noteCreatedAt) return false;
      try {
        const noteTime = new Date(noteCreatedAt).getTime();
        const now = new Date().getTime();
        const hoursDifference = (now - noteTime) / (1000 * 60 * 60);
        return hoursDifference < 24;
      } catch (e) {
        return false;
      }
    }

    function filterByKelas(selectedKelas) {
      let filtered = allSiswaData;
      if (selectedKelas !== 'Semua') {
        filtered = allSiswaData.filter(s =>
          s.kelas && s.kelas.trim().toUpperCase() === selectedKelas.trim().toUpperCase()
        );
      }
      renderSiswaCards(filtered);
    }

    function updateStats() {
      const countA = allSiswaData.filter(s => s.kelas && s.kelas.trim().toUpperCase() === 'IX-A').length;
      const countB = allSiswaData.filter(s => s.kelas && s.kelas.trim().toUpperCase() === 'IX-B').length;
      const statA = document.getElementById('statClassA');
      const statB = document.getElementById('statClassB');
      const statTotal = document.getElementById('statSiswa');

      if (statA) statA.textContent = `${countA} Siswa`;
      if (statB) statB.textContent = `${countB} Siswa`;
      if (statTotal) statTotal.textContent = allSiswaData.length;
    }

    function renderSiswaCards(data) {
      const search = document.getElementById('searchInput').value.toLowerCase();
      const filtered = data.filter(s => s.nama.toLowerCase().includes(search));

      const grid = document.getElementById('studentsGrid');
      if (filtered.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-16 text-slate-500">
          <i data-lucide="search-x" class="w-10 h-10 mx-auto mb-3 opacity-50"></i>
          <p>Tidak ada siswa ditemukan.</p>
        </div>`;
        lucide.createIcons();
        return;
      }

      grid.innerHTML = filtered.map(s => {
        const avatarSrc = s.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.nama)}&background=random`;
        const badgeClass = s.kelas && s.kelas.trim().toUpperCase() === 'IX-A'
          ? 'bg-blue-50 text-blue-700 border border-blue-200'
          : 'bg-blue-50 text-blue-700 border border-blue-200';
        const noteActive = s.note_text && isNoteActive(s.note_text, s.note_created_at);
        const noteDisplay = noteActive ? (s.note_text.length > 30 ? s.note_text.slice(0, 30) + '...' : s.note_text) : '';
        const noteBubbleClass = noteActive
          ? 'bg-white text-slate-700 border border-slate-200'
          : 'bg-slate-50 text-slate-500 border border-slate-200';

        return `
          <div class="card rounded-2xl p-5 text-center hover:border-blue-300 hover:-translate-y-1 transition duration-300 cursor-pointer" onclick="window.location.href='profil.html?id=${s.id}'">
            <div class="relative inline-block mb-3">
              <div class="relative inline-block">
                <img src="${avatarSrc}" alt="${s.nama}"
                     class="w-20 h-20 rounded-full object-cover border-2 border-slate-200 mx-auto" />
                ${s.verif ? `<span class="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                  <i data-lucide="check" class="w-3 h-3 text-white"></i>
                </span>` : ''}
              </div>
              ${noteActive ? `<div class="absolute -top-3 -right-2 whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-semibold ${noteBubbleClass} cursor-pointer hover:bg-slate-50 transition z-10">
                ${noteDisplay}
              </div>` : ''}
            </div>
            <h3 class="mt-4 font-bold text-slate-800">${s.nama}</h3>
            <span class="mt-1 inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${badgeClass}">
              ${s.kelas}
            </span>
            ${s.quotes ? `<p class="mt-3 text-sm text-slate-500 italic">"${s.quotes}"</p>` : ''}
          </div>
        `;
      }).join('');

      lucide.createIcons();
    }

    fetchStudents();

    // ===== Search & Filter Logic =====
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const activeBtn = document.querySelector('.filter-btn.active');
        const selectedKelas = activeBtn ? activeBtn.dataset.filter : 'all';
        const kelas = selectedKelas === 'all' ? 'Semua' : selectedKelas;
        filterByKelas(kelas);
      });
    }

    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filterByKelas(btn.dataset.filter === 'all' ? 'Semua' : btn.dataset.filter);
      });
    });

    // ===== Image Preview Lightbox =====
    const previewModal = document.getElementById('imagePreviewModal');
    const previewImage = document.getElementById('previewImage');
    const closePreviewBtn = document.getElementById('closePreviewBtn');
    const previewBackdrop = document.getElementById('previewBackdrop');

    function openPreview(src) {
      if (!src) return;
      previewImage.src = src;
      previewModal.classList.remove('hidden');
      previewModal.classList.add('flex');
      document.body.style.overflow = 'hidden';
      void previewModal.offsetWidth;
      previewModal.classList.add('is-open');
    }

    function closePreview() {
      previewModal.classList.remove('is-open');
      document.body.style.overflow = '';
      setTimeout(() => {
        previewModal.classList.add('hidden');
        previewModal.classList.remove('flex');
        previewImage.src = '';
      }, 300);
    }

    if (closePreviewBtn) closePreviewBtn.addEventListener('click', closePreview);
    if (previewBackdrop) previewBackdrop.addEventListener('click', closePreview);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !previewModal.classList.contains('hidden')) {
        closePreview();
      }
    });

    // Hero image click
    const heroImg = document.querySelector('#beranda .previewable-img');
    if (heroImg) {
      heroImg.addEventListener('click', () => openPreview(heroImg.src));
    }

    // Gallery images (event delegation because images are rendered dynamically)
    const galleryGrid = document.getElementById('galleryGrid');
    if (galleryGrid) {
      galleryGrid.addEventListener('click', (e) => {
        const img = e.target.closest('.previewable-img');
        if (img) openPreview(img.src);
      });
    }

    // ===== NOTES AUTO-EXPIRE REFRESH =====
    // Refresh data siswa secara periodik agar note bubble yang kadaluarsa
    // otomatis hilang dari card siswa meskipun halaman dibiarkan terbuka.
    setInterval(function() {
      fetchStudents();
    }, 5 * 60 * 1000);

    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'visible') {
        fetchStudents();
      }
    });
