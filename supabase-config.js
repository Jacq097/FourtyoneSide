// ============================================================
// SUPABASE CONFIGURATION — Angkatan 41 Website
// Edit kredensial di sini jika proyek Supabase berubah.
// ============================================================

const SUPABASE_URL = 'https://tdkdpmhwlbdgqmfynpij.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRka2RwbWh3bGJkZ3FtZnlucGlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4Mzk3MjIsImV4cCI6MjEwMTQxNTcyMn0.fdx4RBRytRsH922AtQ2Odt7QoOviXfsQbfZ0UnjqjL8';

// ============================================================
// SUPABASE CLIENT (via CDN global)
// Catatan: Gunakan `var` (bukan `const`) karena CDN Supabase
// sudah mendefinisikan `window.supabase` sebagai properti global.
// `const supabase` di top-level akan bentrok dengan properti
// global `window.supabase` dan memicu error
// "Identifier 'supabase' has already been declared".
// `var` akan menimpa/mereset properti global yang sudah ada
// sehingga objek client tersedia sekali di seluruh project.
// ============================================================
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// SAFE STORAGE HELPERS (Safari Private Browsing compatible)
// Safari Private Browsing blocks localStorage/sessionStorage
// throws SecurityError / QuotaExceededError.
// ============================================================
function safeStorageGet(store, key) {
  try {
    return store.getItem(key);
  } catch (e) {
    return null;
  }
}

function safeStorageSet(store, key, value) {
  try {
    store.setItem(key, value);
    return true;
  } catch (e) {
    console.warn('Storage blocked (Safari Private Browsing?):', e.message);
    return false;
  }
}

function safeStorageRemove(store, key) {
  try {
    store.removeItem(key);
  } catch (e) {}
}

// ============================================================
// HELPER: Listen to Supabase auth state changes
// Cross-browser wrapper for onAuthStateChange
// ============================================================
function onAuthStateChange(callback) {
  if (typeof supabase !== 'undefined' && supabase.auth && supabase.auth.onAuthStateChange) {
    supabase.auth.onAuthStateChange(callback);
  }
}

// ============================================================
// HELPER GLOBAL: Pembaca sesi yang konsisten di semua halaman
// Mencari data user berurutan di sessionStorage & localStorage,
// lalu memeriksa semua kemungkinan key penyimpanan.
// Return: objek user | null
// ============================================================
function getLoggedInUser() {
  const keys = ['angkatan41_user', 'currentUser', 'user', 'angkatan41_user_session'];
  const storages = [window.sessionStorage, window.localStorage];

  // 1) Cek sessionStorage dulu (prioritas sesi aktif)
  for (var s = 0; s < storages.length; s++) {
    for (var k = 0; k < keys.length; k++) {
      var raw = safeStorageGet(storages[s], keys[k]);
      if (!raw) continue;
      try {
        var parsed = JSON.parse(raw);
        // Validasi: harus ada salah satu identitas pengguna
        if (parsed && typeof parsed === 'object' &&
            (parsed.username || parsed.nama || parsed.nama_lengkap || parsed.role || parsed.kelas)) {
          return parsed;
        }
      } catch (e) {
        // Abaikan entry corrupt
      }
    }
  }
  return null;
}

// ============================================================
// SAFE DATE PARSER (khusus anti-crash Safari/iOS)
// Safari/WebKit sering menolak format "YYYY-MM-DD" atau
// "YYYY-MM-DD HH:MM:SS" yang dikembalikan Postgres/Supabase,
// dan melempar RangeError alih-alih menghasilkan "Invalid Date"
// seperti di Chrome. Fungsi ini menormalkan string tanggal
// menjadi format yang aman untuk SEMUA browser, dan tidak pernah
// melempar error (fallback ke null / tanggal hari ini).
// ============================================================
// CATATAN: untuk input kosong/null -> return null (bukan tanggal).
// Untuk input yang ADA tapi gagal di-parse -> fallback ke `new Date()`
// (hari ini), sesuai permintaan, supaya UI tidak pernah crash. Jika
// kamu menampilkan tanggal ini ke user (mis. "Kumpul: ..."), sadari
// fallback ini bisa menampilkan tanggal hari ini utk data yang rusak —
// itu trade-off yang disengaja (tampil salah > halaman blank/crash).
function safeDate(dateStr) {
  if (!dateStr) return null;
  try {
    var safeStr = dateStr.toString().replace(/-/g, '/').replace(' ', 'T');
    var d = new Date(safeStr);
    return isNaN(d.getTime()) ? new Date() : d;
  } catch (e) {
    return new Date();
  }
}

// ============================================================
// DEBUG ALERT HELPER (KHUSUS DEBUGGING iOS SAFARI)
// Dipakai di dalam blok catch(err) di seluruh halaman supaya error
// TIDAK "tertelan" diam-diam (console.error saja tidak kelihatan di
// iPhone karena tidak ada DevTools). Selain alert(), tetap dicatat
// juga ke console.error supaya browser desktop (yang punya DevTools)
// tidak kebanjiran popup saat development.
// PENTING: helper ini untuk tahap debugging. Setelah bug di iPhone
// benar-benar ketemu & selesai diperbaiki, sebaiknya nonaktifkan lagi
// (ganti isi fungsi ini jadi hanya console.error) supaya user awam
// tidak melihat popup teknis saat pemakaian normal.
// ============================================================
function debugAlert(context, err) {
  var msg = (err && err.message) ? err.message : String(err);
  console.error(context, err);
  alert('iOS Debug Crash [' + context + ']: ' + msg);
}

// ============================================================
// CLEANUP: raw data jadwal dari DB -> object per hari
// ============================================================
function buildJadwalMap(rows) {
  const map = {};
  rows.forEach(r => {
    if (!map[r.hari]) map[r.hari] = [];
    map[r.hari].push({ id: r.id, jam: r.jam, mapel: r.mapel, guru: r.nama_guru });
  });
  return map;
}

// ============================================================
// Toast sederhana
// ============================================================
function toast(msg, type = 'success') {
  const colors = {
    success: 'bg-emerald-500/90',
    error: 'bg-rose-500/90',
    info: 'bg-sky-500/90'
  };
  const el = document.createElement('div');
  el.className = `fixed top-5 right-5 z-[200] px-5 py-3 rounded-xl text-white text-sm font-semibold shadow-2xl ${colors[type]} transition-all duration-300`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(-10px)'; }, 2500);
  setTimeout(() => el.remove(), 3000);
}
