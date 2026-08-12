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
  

    // ===== Init icons =====
    lucide.createIcons();

    // ===== Toggle password visibility =====
    const passInput = document.getElementById('password');
    const togglePass = document.getElementById('togglePass');
    togglePass.addEventListener('click', () => {
      const isHidden = passInput.type === 'password';
      passInput.type = isHidden ? 'text' : 'password';
      togglePass.innerHTML = `<i data-lucide="${isHidden ? 'eye-off' : 'eye'}" class="w-5 h-5"></i>`;
      lucide.createIcons();
    });

    // ===== Helper: show error =====
    const errorBox = document.getElementById('errorBox');
    const errorText = document.getElementById('errorText');
    function showError(msg) {
      errorText.textContent = msg;
      errorBox.classList.remove('hidden');
    }
    function hideError() {
      errorBox.classList.add('hidden');
    }

    // ===== Login Form Submit =====
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      hideError();

      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;
      const submitBtn = document.getElementById('submitBtn');

      if (!username || !password) {
        showError('Username dan password wajib diisi.');
        return;
      }

      // Loading state
      const original = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i data-lucide="loader" class="w-5 h-5 animate-spin"></i> Memproses...';
      lucide.createIcons();

      try {
        // ===== Cek user di tabel `users` =====
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('username', username)
          .single();

        if (error) {
          console.error('Query error:', error.message);
          showError('Username atau password salah.');
          return;
        }

        if (!data) {
          showError('Username atau password salah.');
          return;
        }

        // Cek password (pastikan kolom `password` ada di tabel users)
        if (data.password !== password) {
          showError('Username atau password salah.');
          return;
        }

// ===== Ambil nama_lengkap dari tabel profiles =====
        // Prioritas: profile.nama_lengkap -> data.nama -> data.username
        // Catatan: id di tabel users BISA BERBEDA dari id (uuid) di tabel profiles.
        // Jadi coba cocokkan lewat id, lalu fallback ke nama_lengkap.
        let namaLengkap = data.nama || data.username;
        try {
          // 1) Coba match via id
          let profile = null;
          const { data: pById, error: errById } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.id)
            .maybeSingle();
          if (!errById && pById) {
            profile = pById;
          }

          // 2) Fallback: match via nama_lengkap sama dengan nama di tabel users
          if (!profile && data.nama) {
            const { data: pByName, error: errByName } = await supabase
              .from('profiles')
              .select('*')
              .eq('nama_lengkap', data.nama)
              .maybeSingle();
            if (!errByName && pByName) profile = pByName;
          }

          if (profile) {
            // Nama diambil dari nama_lengkap (kolom di tabel profiles)
            namaLengkap = profile.nama_lengkap || profile.nama || namaLengkap;
            // Lengkapi data lain dari profiles jika tersedia
            data.role = profile.role || data.role;
            data.kelas = profile.kelas || data.kelas;
          }
        } catch (profErr) {
          console.warn('Gagal mengambil profiles, pakai nama dari users:', profErr.message || profErr);
        }

        // ===== Berhasil: simpan SELURUH data user ke sessionStorage DAN localStorage =====
        // Termasuk `nama_lengkap`, `role`, dan `kelas` dari Supabase.
        // PENTING (fix bug iPhone): sessionStorage di Safari/iOS sangat mudah hilang
        // (tab di-reload otomatis oleh iOS saat app dibackground / memori ditekan),
        // sehingga user yang sudah login "ke-logout" sendiri secara acak dan semua
        // fitur berbasis role (tambah Piket, tambah PR, form input Kas Bendahara)
        // ikut hilang. Semua halaman lain (kelas ix-a/ix-b, index, profil) SUDAH
        // didesain untuk fallback baca localStorage, jadi di sini kita WAJIB juga
        // menulis ke localStorage, bukan cuma sessionStorage.
        var userData = {
          id: data.id,
          username: data.username,
          nama: namaLengkap,
          nama_lengkap: namaLengkap,
          role: data.role || 'siswa',
          kelas: data.kelas || null,
          login_at: new Date().toISOString()
        };
        // Key utama aplikasi (dipakai semua halaman)
        safeStorageSet(sessionStorage, 'angkatan41_user', JSON.stringify(userData));
        safeStorageSet(localStorage, 'angkatan41_user', JSON.stringify(userData));
        // Key `user` (seperti yang diminta)
        safeStorageSet(sessionStorage, 'user', JSON.stringify(userData));
        safeStorageSet(localStorage, 'user', JSON.stringify(userData));

        // Tampilkan pesan sukses
        errorBox.classList.remove('hidden');
        errorBox.classList.remove('bg-rose-500/15', 'border-rose-500/30', 'text-rose-300');
        errorBox.classList.add('bg-emerald-500/15', 'border-emerald-500/30', 'text-emerald-300');
        errorText.textContent = 'Login berhasil! Mengalihkan...';

        // ===== Redirect ke halaman utama =====
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 800);
      } catch (err) {
        debugAlert('loginForm submit', err);
        showError('Terjadi kesalahan saat login. Coba lagi.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = original;
        lucide.createIcons();
      }
    });
