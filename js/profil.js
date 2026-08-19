tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
          },
        },
      },
    };
  

// ===== PROTECTION: if not logged in and not viewing another user, redirect to login =====
    (function protectPage() {
      const urlParams = new URLSearchParams(window.location.search);
      const targetUserId = urlParams.get('id');
      const targetUsername = urlParams.get('username');

      // If viewing another user's profile (visitor mode), allow access without login
      if (targetUserId || targetUsername) {
        return;
      }

      // PENTING (fix bug iPhone): jangan hanya cek sessionStorage — di Safari/iOS
      // sessionStorage gampang hilang saat tab di-reload oleh sistem (app dibackground,
      // memori ditekan, dsb), padahal localStorage masih menyimpan sesi yang valid.
      // Cek localStorage juga sebagai fallback sebelum menganggap user belum login.
      var raw = safeStorageGet(sessionStorage, 'user') || safeStorageGet(sessionStorage, 'angkatan41_user')
             || safeStorageGet(localStorage, 'user') || safeStorageGet(localStorage, 'angkatan41_user');
      if (!raw) {
        window.location.href = 'login.html';
        return;
      }
      try {
        var user = JSON.parse(raw);
        if (!user || !user.nama_lengkap) {
          safeStorageRemove(sessionStorage, 'user');
          safeStorageRemove(sessionStorage, 'angkatan41_user');
          safeStorageRemove(localStorage, 'user');
          safeStorageRemove(localStorage, 'angkatan41_user');
          window.location.href = 'login.html';
        }
      } catch (e) {
        safeStorageRemove(sessionStorage, 'user');
        safeStorageRemove(sessionStorage, 'angkatan41_user');
        safeStorageRemove(localStorage, 'user');
        safeStorageRemove(localStorage, 'angkatan41_user');
        window.location.href = 'login.html';
      }
    })();

    lucide.createIcons();

    // ===== Get current user from session (key: `user`, fallback `angkatan41_user`) =====
    var storedRaw = safeStorageGet(sessionStorage, 'user') || safeStorageGet(sessionStorage, 'angkatan41_user')
                 || safeStorageGet(localStorage, 'user') || safeStorageGet(localStorage, 'angkatan41_user');
    let currentUser = null;
    if (storedRaw) {
      try { currentUser = JSON.parse(storedRaw); } catch (e) { currentUser = null; }
    }

    // Map role to display jabatan
    function roleDisplay(role) {
      const map = {
        'admin': 'Admin / Wali Kelas',
        'siswa': 'Siswa',
        'ketua_kelas': 'Ketua Kelas',
        'wakil_ketua': 'Wakil Ketua'
      };
      return map[role] || role || 'Siswa';
    }

// ===== Render profile info (LANGSUNG FETCH dari tabel `users`) =====
    // Ambil `username` dari session, lalu query langsung ke Supabase
    // supaya nama yang tampil SELALU data terbaru dari DB (bukan dari session).
    async function renderProfile() {
      const urlParams = new URLSearchParams(window.location.search);
      const targetUserId = urlParams.get('id');
      const targetUsername = urlParams.get('username');

      let userDb = null;
      let error = null;

      if (targetUserId) {
        const { data, error: err } = await supabase
          .from('users')
          .select('*')
          .eq('id', targetUserId)
          .single();
        userDb = data;
        error = err;
      } else if (targetUsername) {
        const { data, error: err } = await supabase
          .from('users')
          .select('*')
          .eq('username', targetUsername)
          .single();
        userDb = data;
        error = err;
      } else if (currentUser && currentUser.username) {
        const { data, error: err } = await supabase
          .from('users')
          .select('*')
          .eq('username', currentUser.username)
          .single();
        userDb = data;
        error = err;
      }

      if (error || !userDb) {
        console.error('Gagal mengambil data user:', error && error.message);
        document.getElementById('profileNama').textContent = 'Data tidak ditemukan';
        return;
      }

      const profileUser = userDb;
      const isOwner = currentUser && (currentUser.id === profileUser.id || currentUser.username === profileUser.username);

      // 3) Pasangkan data userDb ke HTML
      //    - Header Nama: pakai userDb.nama_lengkap (BUKAN username)
      //    - Box Nama Lengkap: pakai userDb.nama_lengkap (BUKAN username)
      //    - Box Username: pakai '@' + userDb.username
      const nama = profileUser.nama_lengkap || profileUser.nama || 'User';
      const username = profileUser.username || 'username';
      const kelas = profileUser.kelas || 'IX-A';
      const role = profileUser.role || 'siswa';
      const jabatan = roleDisplay(role);

      document.getElementById('profileNama').textContent = nama;
      document.getElementById('profileUsername').textContent = '@' + username;
      document.getElementById('profileKelas').textContent = kelas;
      document.getElementById('profileJabatan').textContent = jabatan;

      document.getElementById('infoNama').textContent = nama;
      document.getElementById('infoUsername').textContent = username;
      document.getElementById('infoJabatan').textContent = jabatan;
      document.getElementById('infoKelas').textContent = kelas;
      document.getElementById('infoBio').textContent = profileUser.bio || '-';

      const roleBadge = document.getElementById('roleBadge');
      roleBadge.textContent = role === 'admin' ? 'Admin' : 'Siswa';
      if (role === 'admin') {
        roleBadge.classList.remove('bg-emerald-500');
        roleBadge.classList.add('bg-amber-500');
      }

      const fotoEl = document.getElementById('profileFoto');
      const fotoUrl = profileUser.foto_url || profileUser.foto || profileUser.avatar;
      if (fotoEl && fotoUrl) {
        fotoEl.src = fotoUrl;
      }

      // 4) Simpan userDb dan ownership status SEBELUM update UI
      window.__userDb = profileUser;
      window.__isOwner = isOwner;

      updateNoteBubble(profileUser);
      updateSocialLinks(profileUser);

      const editBtn = document.getElementById('editProfileBtn');
      if (editBtn) {
        editBtn.style.display = isOwner ? '' : 'none';
      }

      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) {
        logoutBtn.style.display = isOwner ? '' : 'none';
      }

      // Control Notes access: only owner can see note bubble as interactive
      const noteBubble = document.getElementById('noteBubble');
      if (noteBubble) {
        if (isOwner) {
          noteBubble.style.display = '';
          noteBubble.classList.remove('opacity-50', 'pointer-events-none');
        } else {
          noteBubble.style.display = 'none';
        }
      }

      // Hide Note Modal elements for visitors
      const noteModal = document.getElementById('noteModal');
      const btnHapusNote = document.getElementById('btnHapusNote');
      if (noteModal) noteModal.style.display = isOwner ? '' : 'none';
      if (btnHapusNote) btnHapusNote.style.display = isOwner ? '' : 'none';

      // 5) Muat absensi setelah data user tersedia
      loadAbsensi();
    }
    renderProfile();

    function isNoteActive(noteCreatedAt) {
      if (!noteCreatedAt) return false;
      try {
        const d = safeDate(noteCreatedAt);
        if (!d || isNaN(d.getTime())) return false;
        return (Date.now() - d.getTime()) < 24 * 60 * 60 * 1000;
      } catch (e) {
        return false;
      }
    }

    function updateNoteBubble(userDb) {
      const bubble = document.getElementById('noteBubble');
      const noteText = userDb.note_text || '';
      const noteCreatedAt = userDb.note_created_at || null;
      const active = isNoteActive(noteCreatedAt);
      const display = active && noteText ? (noteText.length > 30 ? noteText.slice(0, 30) + '...' : noteText) : 'Notes..';
      const bubbleClass = active && noteText
        ? 'bg-white text-slate-700 border border-slate-200'
        : 'bg-slate-50 text-slate-500 border border-slate-200';

      const isOwner = window.__isOwner !== false;

      if (isOwner) {
        bubble.textContent = display;
        bubble.className = `absolute -top-3 -right-2 whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-semibold ${bubbleClass} cursor-pointer hover:bg-slate-50 transition z-10`;
        bubble.style.display = '';
      } else {
        bubble.style.display = 'none';
      }
    }

    // ===== Note Modal Logic =====
    const noteModal = document.getElementById('noteModal');
    const noteBubble = document.getElementById('noteBubble');
    const closeNoteModal = document.getElementById('closeNoteModal');
    const noteModalBackdrop = document.getElementById('noteModalBackdrop');
    const noteForm = document.getElementById('noteForm');
    const noteInput = document.getElementById('noteInput');
    const btnHapusNote = document.getElementById('btnHapusNote');

    function openNoteModal() {
      if (window.__isOwner === false) return;
      const userDb = window.__userDb || {};
      const hasActiveNote = !!(userDb.note_text && isNoteActive(userDb.note_created_at));
      
      if (btnHapusNote) {
        btnHapusNote.classList.toggle('hidden', !hasActiveNote);
      }
      
      noteModal.classList.remove('hidden');
      noteModal.classList.add('flex');
      noteInput.value = userDb.note_text || '';
      noteInput.focus();
    }

    function closeNoteModalFn() {
      noteModal.classList.add('hidden');
      noteModal.classList.remove('flex');
    }

    noteBubble.addEventListener('click', openNoteModal);
    closeNoteModal.addEventListener('click', closeNoteModalFn);
    noteModalBackdrop.addEventListener('click', closeNoteModalFn);

    noteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = noteInput.value.trim();
      if (!text) return;

      const { error } = await supabase
        .from('users')
        .update({
          note_text: text,
          note_created_at: new Date().toISOString()
        })
        .eq('username', currentUser.username);

      if (error) {
        console.error('Gagal update note:', error.message);
        return;
      }

      if (window.__userDb) {
        window.__userDb.note_text = text;
        window.__userDb.note_created_at = new Date().toISOString();
      }

      updateNoteBubble(window.__userDb);
      closeNoteModalFn();
    });

    btnHapusNote.addEventListener('click', async () => {
      if (window.__isOwner === false) return;
      const { error } = await supabase
        .from('users')
        .update({
          note_text: null,
          note_created_at: null
        })
        .eq('username', currentUser.username);

      if (error) {
        console.error('Gagal menghapus note:', error.message);
        return;
      }

      if (window.__userDb) {
        window.__userDb.note_text = '';
        window.__userDb.note_created_at = null;
      }

      updateNoteBubble(window.__userDb);
      closeNoteModalFn();
    });

    // ===== Edit Profil Logic =====
    const editProfileBtn = document.getElementById('editProfileBtn');
    const editProfileModal = document.getElementById('editProfileModal');
    const closeEditModal = document.getElementById('closeEditModal');
    const editModalBackdrop = document.getElementById('editModalBackdrop');
    const editProfileForm = document.getElementById('editProfileForm');
    const editFoto = document.getElementById('editFoto');
    const editBio = document.getElementById('editBio');
    const editInstagram = document.getElementById('editInstagram');
    const editTiktok = document.getElementById('editTiktok');
    const btnBatalEdit = document.getElementById('btnBatalEdit');
    const btnHapusFoto = document.getElementById('btnHapusFoto');
    const hapusFotoWrapper = document.getElementById('hapusFotoWrapper');

    // Crop modal elements
    const cropModal = document.getElementById('cropModal');
    const cropImage = document.getElementById('cropImage');
    const zoomSlider = document.getElementById('zoomSlider');
    const btnTerapkanCrop = document.getElementById('btnTerapkanCrop');
    const btnBatalCrop = document.getElementById('btnBatalCrop');
    const closeCropModal = document.getElementById('closeCropModal');
    const cropModalBackdrop = document.getElementById('cropModalBackdrop');

    let cropper = null;
    let croppedBlob = null;

    function getFileNameFromUrl(url) {
      if (!url) return null;
      const parts = url.split('/');
      return parts[parts.length - 1];
    }

    async function deleteAvatarFromStorage(publicUrl) {
      console.log("--- PROSES HAPUS FOTO DIMULAI ---");
      console.log("1. URL Asli yang diterima:", publicUrl);

      if (!publicUrl) {
        console.warn("URL foto kosong/null, proses hapus dibatalkan.");
        return false;
      }

      const fileName = getFileNameFromUrl(publicUrl);
      console.log("2. Nama File hasil ekstraksi:", fileName);

      if (!fileName) {
        console.error("Gagal mengekstrak nama file dari URL!");
        return false;
      }

      console.log("3. Mengirim perintah .remove() ke bucket 'avatars'...");
      const { data, error } = await supabase.storage
        .from('avatars')
        .remove([fileName]);

      if (error) {
        console.error("❌ GAGAL HAPUS DI SUPABASE STORAGE:", error.message, error);
        return false;
      }

      console.log("✅ BERHASIL HAPUS DI SUPABASE STORAGE:", data);
      return true;
    }

    function openEditModal() {
      if (window.__isOwner === false) return;
      const userDb = window.__userDb || {};
      editFoto.value = '';
      editBio.value = userDb.bio || '';
      editInstagram.value = userDb.instagram_url || '';
      editTiktok.value = userDb.tiktok_url || '';
      croppedBlob = null;

      const fotoUrl = userDb.foto_url || userDb.foto || userDb.avatar;
      if (hapusFotoWrapper) {
        hapusFotoWrapper.classList.toggle('hidden', !fotoUrl);
      }

      editProfileModal.classList.remove('hidden');
      editProfileModal.classList.add('flex');
    }

    function closeEditModalFn() {
      editProfileModal.classList.add('hidden');
      editProfileModal.classList.remove('flex');
    }

    function openCropModal(file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        cropImage.src = e.target.result;
        cropModal.classList.remove('hidden');
        cropModal.classList.add('flex');
        zoomSlider.value = 0;

        if (cropper) cropper.destroy();

        const initCropper = () => {
          try {
            cropper = new Cropper(cropImage, {
              aspectRatio: 1,
              viewMode: 1,
              background: false,
              zoomable: true,
              dragMode: 'move',
              autoCropArea: 1,
              responsive: true,
              checkCrossOrigin: false,
              ready() {
                cropper.zoomTo(0);
              }
            });
          } catch (err) {
            console.error('Error init cropper:', err);
          }
        };

        if (cropImage.complete && cropImage.naturalWidth > 0) {
          initCropper();
        } else {
          cropImage.onload = initCropper;
        }
      };
      reader.readAsDataURL(file);
    }

    function closeCropModalFn() {
      cropModal.classList.add('hidden');
      cropModal.classList.remove('flex');
      if (cropper) {
        cropper.destroy();
        cropper = null;
      }
      cropImage.src = '';
      croppedBlob = null;
    }

    window.bukaModalPotong = function (event) {
      const file = event.target.files[0];
      if (!file) return;
      if (file.size > 3 * 1024 * 1024) {
        alert('Ukuran gambar maksimal 3MB!');
        event.target.value = '';
        return;
      }
      openCropModal(file);
    };

    editProfileBtn.addEventListener('click', openEditModal);
    closeEditModal.addEventListener('click', closeEditModalFn);
    editModalBackdrop.addEventListener('click', closeEditModalFn);
    btnBatalEdit.addEventListener('click', closeEditModalFn);

    if (btnHapusFoto) {
      btnHapusFoto.addEventListener('click', async () => {
        console.log("--- TOMBOL HAPUS FOTO DIKLIK ---");
        if (window.__isOwner === false) {
          console.warn("Bukan owner, batalkan hapus.");
          return;
        }
        const userDb = window.__userDb || {};
        const fotoUrl = userDb.foto_url || userDb.foto || userDb.avatar;
        console.log("Foto URL dari userDb:", fotoUrl);

        if (!fotoUrl) {
          console.warn("Tidak ada fotoUrl, batalkan hapus.");
          return;
        }

        if (!confirm('Apakah kamu yakin ingin menghapus foto profil?')) {
          console.log("User membatalkan konfirmasi hapus.");
          return;
        }

        const deleted = await deleteAvatarFromStorage(fotoUrl);
        console.log("Hasil deleteAvatarFromStorage:", deleted);
        if (!deleted) {
          alert('Gagal menghapus foto dari storage.');
          return;
        }

        console.log("Mengupdate kolom foto_url di tabel users...");
        const { error } = await supabase
          .from('users')
          .update({ foto_url: null })
          .eq('username', currentUser.username);

        if (error) {
          console.error('Gagal hapus foto profil di DB:', error.message);
          alert('Gagal menghapus foto profil: ' + error.message);
          return;
        }

        console.log("Berhasil update DB. Reset state lokal & UI...");
        if (window.__userDb) {
          window.__userDb.foto_url = null;
          window.__userDb.foto = null;
          window.__userDb.avatar = null;
        }

        const fotoEl = document.getElementById('profileFoto');
        if (fotoEl) fotoEl.src = 'https://ui-avatars.com/api/?name=User&background=random';

        if (hapusFotoWrapper) hapusFotoWrapper.classList.add('hidden');

        closeEditModalFn();
      });
    }

    closeCropModal.addEventListener('click', closeCropModalFn);
    cropModalBackdrop.addEventListener('click', closeCropModalFn);
    btnBatalCrop.addEventListener('click', closeCropModalFn);

    zoomSlider.addEventListener('input', () => {
      if (cropper) {
        cropper.zoomTo(parseFloat(zoomSlider.value));
      }
    });

    btnTerapkanCrop.addEventListener('click', async () => {
      if (window.__isOwner === false) return;
      if (!cropper) return;

      const canvas = cropper.getCroppedCanvas({
        width: 500,
        height: 500,
        minWidth: 256,
        minHeight: 256,
        maxWidth: 500,
        maxHeight: 500,
        fillColor: '#fff',
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
      });

      if (!canvas) return;

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        croppedBlob = blob;

        const ext = 'jpg';
        const fileName = `avatar_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

        const userDb = window.__userDb || {};
        const oldFotoUrl = userDb.foto_url || userDb.foto || userDb.avatar;
        if (oldFotoUrl) {
          await deleteAvatarFromStorage(oldFotoUrl);
        }

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, blob, { upsert: true, contentType: 'image/jpeg' });

        if (uploadError) {
          console.error('Gagal upload foto:', uploadError.message);
          alert('Gagal upload foto: ' + uploadError.message);
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);

        const fotoUrl = publicUrlData.publicUrl;

        const updateData = {
          bio: editBio.value.trim() || null,
          instagram_url: editInstagram.value.trim() || null,
          tiktok_url: editTiktok.value.trim() || null,
          foto_url: fotoUrl
        };

        const { error } = await supabase
          .from('users')
          .update(updateData)
          .eq('username', currentUser.username);

        if (error) {
          console.error('Gagal update profil:', error.message);
          alert('Gagal update profil: ' + error.message);
          return;
        }

        if (window.__userDb) {
          window.__userDb.foto_url = fotoUrl;
          window.__userDb.bio = updateData.bio;
          window.__userDb.instagram_url = updateData.instagram_url;
          window.__userDb.tiktok_url = updateData.tiktok_url;
        }

        const fotoEl = document.getElementById('profileFoto');
        if (fotoEl && fotoUrl) fotoEl.src = fotoUrl;
        document.getElementById('infoBio').textContent = updateData.bio || '-';
        updateSocialLinks(window.__userDb);

        closeCropModalFn();
        closeEditModalFn();
      }, 'image/jpeg', 0.9);
    });

    editProfileForm.addEventListener('submit', async (e) => {
      if (window.__isOwner === false) return;
      e.preventDefault();
      const updateData = {
        bio: editBio.value.trim() || null,
        instagram_url: editInstagram.value.trim() || null,
        tiktok_url: editTiktok.value.trim() || null
      };

      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('username', currentUser.username);

      if (error) {
        console.error('Gagal update profil:', error.message);
        alert('Gagal update profil: ' + error.message);
        return;
      }

      if (window.__userDb) {
        window.__userDb.bio = updateData.bio;
        window.__userDb.instagram_url = updateData.instagram_url;
        window.__userDb.tiktok_url = updateData.tiktok_url;
      }

      document.getElementById('infoBio').textContent = updateData.bio || '-';
      updateSocialLinks(window.__userDb);
      closeEditModalFn();
    });

    function updateSocialLinks(userDb) {
      const igLink = document.getElementById('linkInstagram');
      const ttLink = document.getElementById('linkTiktok');
      const igUrl = userDb.instagram_url || '';
      const ttUrl = userDb.tiktok_url || '';

      igLink.href = igUrl || '#';
      if (igUrl) {
        igLink.classList.remove('opacity-30');
        igLink.classList.add('text-slate-400', 'hover:text-pink-500');
      } else {
        igLink.classList.add('opacity-30');
        igLink.classList.remove('hover:text-pink-500');
      }

      ttLink.href = ttUrl || '#';
      if (ttUrl) {
        ttLink.classList.remove('opacity-30');
        ttLink.classList.add('text-slate-400', 'hover:text-slate-600');
      } else {
        ttLink.classList.add('opacity-30');
        ttLink.classList.remove('hover:text-slate-600');
      }
    }

    // ===== Load absensi =====
    // Menggunakan nama_lengkap dari userDb (hasil FETCH LANGSUNG tabel `users`)
    async function loadAbsensi() {
      const userDb = window.__userDb || currentUser;
      if (!userDb || !userDb.nama_lengkap) return;
const tbody = document.getElementById('absensiBody');
      const emptyEl = document.getElementById('absensiEmpty');
      const summaryChip = document.getElementById('summaryChip');

      // ===== 5 Hari Sekolah Terakhir (Senin - Jumat) =====
      // Menghasilkan array berisi HANYA hari kerja (skip Sabtu & Minggu).
      // Setiap item: { iso: 'YYYY-MM-DD', label: 'Jum, 7 Agu' }
      // Memakai aritmetika tanggal LOKAL (bukan toISOString/UTC yang rawan geser hari).
      function getLastSchoolDays(count = 5) {
        const days = [];
        const d = new Date();
        // Offset untuk waktu lokal, agar tanggal yang dihasilkan sesuai zona lokal
        const offset = d.getTimezoneOffset() * 60000;

        function toLocalISO(date) {
          return new Date(date.getTime() - offset).toISOString().split('T')[0];
        }

        while (days.length < count) {
          const dayOfWeek = d.getDay(); // 0=Minggu, 6=Sabtu
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            days.push({
              iso: toLocalISO(d),
              label: d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
            });
          }
          d.setDate(d.getDate() - 1); // mundur 1 hari (mengikuti waktu lokal)
        }
        return days.reverse(); // urutkan dari yang terlama ke terbaru
      }
      const days = getLastSchoolDays(5);

// ===== DETERMINE TARGET USER =====
      const targetUsername = (userDb ? userDb.username : null) || (currentUser ? currentUser.username : null);
      const targetFullName = (userDb ? (userDb.nama_lengkap || userDb.nama) : null) || (currentUser ? (currentUser.nama_lengkap || currentUser.nama) : null);
      if (!targetUsername && !targetFullName) return;

// ===== AUTO-EXPIRE PENDING ABSENSI LAMPAU =====
      const todayObj = new Date();
      const todayOffset = todayObj.getTimezoneOffset() * 60000;
      const todayStr = new Date(todayObj.getTime() - todayOffset).toISOString().split('T')[0];

      // Targetkan nama dari profil yang sedang dibuka
      console.log("🔍 Mencari absensi untuk Username:", targetUsername, "| Nama Lengkap:", targetFullName);

      // Tarik data absensi untuk user target (bukan currentUser)
      let absensiQuery = supabase
        .from('absensi')
        .select('*')
        .gte('tanggal', days[0].iso)
        .lte('tanggal', days[days.length - 1].iso)
        .order('tanggal');

      if (targetUsername && targetFullName) {
        absensiQuery = absensiQuery.or(`nama_siswa.ilike.${targetUsername},nama_siswa.ilike.${targetFullName}`);
      } else if (targetUsername) {
        absensiQuery = absensiQuery.eq('nama_siswa', targetUsername);
      } else if (targetFullName) {
        absensiQuery = absensiQuery.eq('nama_siswa', targetFullName);
      }

      const { data: absensiData, error } = await absensiQuery;

      // ===== DEBUG LOG (cek di Console F12) =====
      console.log('targetUsername:', targetUsername, '| targetFullName:', targetFullName);
      console.log('Rentang tanggal (iso):', days[0].iso, 's/d', days[days.length - 1].iso);
      console.log('Data Absensi Ditemukan:', absensiData);

      const data = absensiData || [];
      if (error) {
        console.error('Absensi query error:', error.message);
        tbody.innerHTML = `<tr><td colspan="3" class="py-8 text-center text-rose-300">
          <i data-lucide="alert-circle" class="w-6 h-6 mx-auto mb-2"></i>
          Gagal memuat data absensi: ${error.message}
        </td></tr>`;
        lucide.createIcons();
        return;
      }

      // Auto-update DB: ubah pending lampau menjadi Alpa / Ditolak
      const expiredPending = (data || []).filter(r => {
        const approval = (r.status_approval || r.status_acc || '').toLowerCase();
        const isPending = approval === 'pending' || approval === 'belum acc' || approval === 'menunggu' || approval === 'menunggu acc';
        return r.tanggal < todayStr && isPending;
      });
      if (expiredPending.length > 0) {
        const ids = expiredPending.map(r => r.id);
        const { error: updateError } = await supabase
          .from('absensi')
          .update({ keterangan: 'Alpa', status_approval: 'ditolak', status_acc: 'ditolak' })
          .in('id', ids);
        if (updateError) {
          console.error('Auto-expire update error:', updateError.message);
        } else {
          console.log('Auto-expired absensi IDs:', ids);
        }
      }

      // Build lookup by tanggal
      const byDate = {};
      (data || []).forEach(r => { byDate[r.tanggal] = r; });

let hadirCount = 0;
      const rows = days.map(day => {
        const rec = byDate[day.iso];
        const dateLabel = day.label;
        let ket = 'Alpa';
        let ketColor = 'text-slate-500';
        let ketBg = 'bg-slate-50';
        if (rec) {
          const k = (rec.keterangan || 'Alpa').toLowerCase();
          if (k === 'hadir') { ket = 'Hadir'; ketColor = 'text-blue-700'; ketBg = 'bg-blue-50'; }
          else if (k === 'izin') { ket = 'Izin'; ketColor = 'text-sky-700'; ketBg = 'bg-sky-50'; }
          else if (k === 'sakit') { ket = 'Sakit'; ketColor = 'text-amber-700'; ketBg = 'bg-amber-50'; }
          else { ket = rec.keterangan || 'Alpa'; ketColor = 'text-slate-600'; ketBg = 'bg-slate-50'; }
        }

// Status ACC berdasarkan kolom `status_approval` (fallback toleran ke `status_acc`)
        const approval = rec ? ((rec.status_approval || rec.status_acc || '').toLowerCase()) : '';
        const isApproved = approval === 'approved' || approval.includes('sudah') || approval === 'acc' || approval === 'disetujui';
        const isPending = approval === 'pending' || approval === 'belum acc' || approval === 'menunggu' || approval === 'menunggu acc';

        // Auto-expire: jika tanggal lampau dan masih menunggu ACC, anggap Alpa/Ditolak
        const isExpired = rec && day.iso < todayStr && isPending;
        if (isExpired) {
          ket = 'Alpa';
          ketColor = 'text-slate-600';
          ketBg = 'bg-slate-50';
        }

        // Hitung HADIR hanya jika keterangan === 'Hadir' DAN sudah di-ACC (Approved)
        const isHadirApproved = rec && (rec.keterangan || '').toLowerCase() === 'hadir' && isApproved;
        if (isHadirApproved) hadirCount++;

        let statusBadge;
        if (!rec) {
          // Tidak ada data di tanggal sekolah tersebut
          statusBadge = `<span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 whitespace-nowrap">Belum Absen</span>`;
        } else if (isApproved) {
          statusBadge = `<span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">Disetujui</span>`;
        } else if (isPending) {
          if (isExpired) {
            statusBadge = `<span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">Ditolak</span>`;
          } else {
            statusBadge = `<span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">Menunggu ACC</span>`;
          }
        } else {
          statusBadge = `<span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 whitespace-nowrap">${rec.status_approval || rec.status_acc || 'Pending'}</span>`;
        }

        return `
          <tr class="border-b border-slate-200 hover:bg-slate-50 transition">
            <td class="py-3 pr-4 whitespace-nowrap font-medium">${dateLabel}</td>
            <td class="py-3 pr-4">
              <span class="px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${ketBg} ${ketColor}">${ket}</span>
            </td>
            <td class="py-3">${statusBadge}</td>
          </tr>
        `;
      });

      tbody.innerHTML = rows.join('');
      emptyEl.classList.add('hidden');
      summaryChip.textContent = `${hadirCount} Hadir / 5 Hari`;
      lucide.createIcons();
    }

    // formatDate() dibungkus try/catch + memakai safeDate() dari
    // supabase-config.js (anti-crash Safari/iOS untuk parsing tanggal).
    function formatDate(iso) {
      if (!iso) return '-';
      try {
        const d = safeDate(iso);
        if (!d || isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
      } catch (e) {
        return '-';
      }
    }

    // Catatan: loadAbsensi() dipanggil di dalam renderProfile()
    // setelah userDb berhasil di-fetch, supaya memakai userDb.nama_lengkap.

    // ===== Image Preview Lightbox =====
    const previewModal = document.getElementById('imagePreviewModal');
    const previewImage = document.getElementById('previewImage');
    const closePreviewBtn = document.getElementById('closePreviewBtn');
    const previewBackdrop = document.getElementById('previewBackdrop');
    const profileFoto = document.getElementById('profileFoto');

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

    if (profileFoto) {
      profileFoto.addEventListener('click', () => {
        openPreview(profileFoto.src);
      });
    }

    // ===== Logout =====
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      showLogoutModal(async function() {
        try {
          var result = await supabase.auth.getSession();
          if (result.data && result.data.session) await supabase.auth.signOut();
        } catch (e) {}
        const keys = ['angkatan41_user', 'currentUser', 'user', 'angkatan41_user_session'];
        const storages = [window.sessionStorage, window.localStorage];
        for (const store of storages) {
          for (const key of keys) {
            safeStorageRemove(store, key);
          }
        }
        window.location.href = 'index.html';
      });
    });

    // ===== Reveal on scroll =====
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('active'); revealObserver.unobserve(e.target); } });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
