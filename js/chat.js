/* ============================================================
   FOURTYONESIDE CHAT — app.js
   Realtime chat + Instagram Notes via Supabase
   Depends on: supabase-config.js (provides `supabase`, helpers)
   ============================================================ */

'use strict';

/* ──────────────────────────────────────────────
   1. SESSION / CURRENT USER
   Uses project-wide getLoggedInUser() from supabase-config.js
   with fallback "Ekin" as default guest.
──────────────────────────────────────────────── */
let currentUser = (function () {
  // Try all storage keys used by the project
  const u = (typeof getLoggedInUser === 'function') ? getLoggedInUser() : null;
  if (u && (u.username || u.nama || u.nama_lengkap)) return u;

  // Fallback: try raw localStorage 'user_session'
  try {
    const raw = localStorage.getItem('user_session');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.username || parsed.nama)) return parsed;
    }
  } catch (_) { /* ignore */ }

  // Default guest
  return { username: 'Ekin', nama: 'Ekin', nama_lengkap: 'Ekin', role: 'siswa', kelas: 'IX-A' };
})();

/** Resolves the best display name from a user object */
function resolveDisplayName(u) {
  if (!u) return 'Pengguna';
  return u.nama_lengkap || u.nama || u.username || 'Pengguna';
}

const MY_NAME     = resolveDisplayName(currentUser);
const MY_USERNAME = currentUser.username || MY_NAME;
const MY_KELAS    = currentUser.kelas || 'IX-A';

/* ──────────────────────────────────────────────
   2. STATE
──────────────────────────────────────────────── */
let activeContact     = null;   // { name, kelas } of open conversation
let messagesChannel   = null;   // Supabase realtime channel for messages
let notesChannel      = null;   // Supabase realtime channel for notes
let pendingImageFile  = null;   // File awaiting confirmation in preview modal
let contacts          = [];     // Known conversation partners
let lastRenderedDate  = null;   // For date separators

/* ──────────────────────────────────────────────
   3. UTILITY HELPERS
──────────────────────────────────────────────── */
/** Escape HTML to prevent XSS */
function escapeHTML(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Get initials from a name string */
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/** Deterministic pastel-blue avatar color from name */
function avatarColor(name) {
  const colors = [
    'from-blue-400 to-blue-600',
    'from-sky-400 to-blue-500',
    'from-indigo-400 to-blue-600',
    'from-violet-400 to-indigo-500',
    'from-blue-500 to-indigo-600',
    'from-cyan-400 to-blue-500',
  ];
  if (!name) return colors[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

/** Format a timestamp to HH:MM local time */
function fmtTime(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch (_) { return ''; }
}

/** Format date for separator label */
function fmtDateLabel(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const dStr = d.toDateString();
    if (dStr === today.toDateString()) return 'Hari ini';
    if (dStr === yesterday.toDateString()) return 'Kemarin';
    return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
  } catch (_) { return ''; }
}

/** Date string (YYYY-MM-DD) for grouping */
function dateKey(isoStr) {
  if (!isoStr) return '';
  try {
    return new Date(isoStr).toDateString();
  } catch (_) { return ''; }
}

/** Re-render all Lucide icons after DOM mutations */
function refreshIcons() {
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

/** Show toast notification */
function showToast(msg, type = 'success') {
  if (typeof toast === 'function') { toast(msg, type); return; }
  const colors = { success: '#22c55e', error: '#ef4444', info: '#3b82f6' };
  const el = document.createElement('div');
  el.className = 'toast-enter';
  el.style.cssText = `
    position:fixed;top:20px;right:20px;z-index:9999;
    background:${colors[type] || colors.success};
    color:#fff;padding:10px 18px;border-radius:12px;
    font-size:13px;font-weight:600;
    box-shadow:0 4px 16px rgba(0,0,0,0.18);
    transition:opacity 0.3s,transform 0.3s;
  `;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(-10px)'; }, 2600);
  setTimeout(() => el.remove(), 3100);
}

/** Auto-resize textarea */
function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 144) + 'px';
}

/** Scroll chat body to bottom */
function scrollToBottom(smooth = true) {
  const body = document.getElementById('chatBody');
  if (!body) return;
  body.scrollTo({ top: body.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
}

/* ──────────────────────────────────────────────
   4. CONTACTS / SIDEBAR LIST
──────────────────────────────────────────────── */
/** Build unique contact list from messages */
async function loadContacts() {
  try {
    // Get all unique senders/receivers that involve the current user
    const { data, error } = await supabase
      .from('messages')
      .select('sender_name, receiver_name, created_at, content, image_url')
      .or(`sender_name.eq.${MY_NAME},receiver_name.eq.${MY_NAME}`)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;

    // Build contact map: name -> last message info
    const contactMap = {};
    (data || []).forEach(msg => {
      const other = msg.sender_name === MY_NAME ? msg.receiver_name : msg.sender_name;
      if (!other || other === MY_NAME) return;
      if (!contactMap[other]) {
        contactMap[other] = {
          name: other,
          lastMsg: msg.content || (msg.image_url ? '📷 Gambar' : ''),
          lastTime: msg.created_at,
        };
      }
    });

    // Also add any known class members as potential contacts (fallback)
    const defaultContacts = ['Kelas IX-A', 'Kelas IX-B'];
    defaultContacts.forEach(c => {
      if (!contactMap[c]) {
        contactMap[c] = { name: c, lastMsg: 'Mulai percakapan...', lastTime: null };
      }
    });

    contacts = Object.values(contactMap);
    renderContactList(contacts);
  } catch (err) {
    console.error('loadContacts error:', err);
    // Render default contacts as fallback
    contacts = [
      { name: 'Kelas IX-A', lastMsg: 'Mulai percakapan...', lastTime: null },
      { name: 'Kelas IX-B', lastMsg: 'Mulai percakapan...', lastTime: null },
    ];
    renderContactList(contacts);
  }
}

/** Render contact list items */
function renderContactList(list) {
  const container = document.getElementById('contactList');
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-slate-400 text-sm">
        <p>Belum ada percakapan.</p>
      </div>`;
    return;
  }

  const searchVal = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const filtered = searchVal
    ? list.filter(c => c.name.toLowerCase().includes(searchVal))
    : list;

  container.innerHTML = filtered.map(c => {
    const isActive = activeContact && activeContact.name === c.name;
    const initials = getInitials(c.name);
    const color = avatarColor(c.name);
    const time = c.lastTime ? fmtTime(c.lastTime) : '';
    const preview = escapeHTML(c.lastMsg || 'Kirim pesan pertama...');
    return `
      <div class="contact-item${isActive ? ' active' : ''}"
           onclick="openChat(${JSON.stringify(c.name)})">
        <div class="relative flex-shrink-0">
          <div class="w-12 h-12 rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white font-bold text-base">
            ${escapeHTML(initials)}
          </div>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between">
            <span class="text-[14px] font-semibold text-slate-900 truncate">${escapeHTML(c.name)}</span>
            <span class="text-[11px] text-slate-400 ml-2 flex-shrink-0">${escapeHTML(time)}</span>
          </div>
          <p class="text-[12px] text-slate-400 truncate mt-0.5">${preview}</p>
        </div>
      </div>`;
  }).join('');

  refreshIcons();
}

/* Search filter */
document.getElementById('searchInput')?.addEventListener('input', () => {
  renderContactList(contacts);
});

/* ──────────────────────────────────────────────
   5. OPEN / CLOSE CHAT
──────────────────────────────────────────────── */
function openChat(contactName) {
  activeContact = { name: contactName };

  // Mobile: show main area, hide sidebar
  const sidebar  = document.getElementById('sidebar');
  const mainArea = document.getElementById('mainArea');
  const noChat   = document.getElementById('noChatPanel');

  sidebar?.classList.add('mobile-hidden');
  mainArea?.classList.remove('hidden');
  mainArea?.classList.add('mobile-open');
  if (noChat) noChat.style.display = 'none';

  // Update header
  updateChatHeader(contactName);

  // Re-render contact list to highlight active
  renderContactList(contacts);

  // Load messages
  loadMessages();

  // Subscribe realtime for this conversation
  subscribeMessages();
}

function closeChatMobile() {
  const sidebar  = document.getElementById('sidebar');
  const mainArea = document.getElementById('mainArea');
  sidebar?.classList.remove('mobile-hidden');
  mainArea?.classList.remove('mobile-open');
  mainArea?.classList.add('hidden');
  activeContact = null;
  renderContactList(contacts);
}

function updateChatHeader(name) {
  const nameEl    = document.getElementById('chatPartnerName');
  const statusEl  = document.getElementById('chatPartnerStatus');
  const avatarEl  = document.getElementById('chatPartnerAvatar');
  const initialEl = document.getElementById('chatPartnerInitial');
  const dotEl     = document.getElementById('chatOnlineDot');

  if (nameEl)    nameEl.textContent    = name;
  if (statusEl)  statusEl.textContent  = 'Aktif baru-baru ini';
  if (initialEl) initialEl.textContent = getInitials(name);
  if (dotEl)     dotEl.classList.remove('hidden');

  if (avatarEl) {
    const color = avatarColor(name);
    avatarEl.className = `w-10 h-10 rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white font-bold text-base overflow-hidden`;
  }
}

/* ──────────────────────────────────────────────
   6. LOAD & RENDER MESSAGES
──────────────────────────────────────────────── */
async function loadMessages() {
  if (!activeContact) return;

  const body = document.getElementById('chatBody');
  if (!body) return;

  // Show loading
  body.innerHTML = `
    <div class="flex items-center justify-center h-full">
      <div class="spinner"></div>
    </div>`;

  try {
    const other = activeContact.name;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_name.eq.${MY_NAME},receiver_name.eq.${other}),` +
        `and(sender_name.eq.${other},receiver_name.eq.${MY_NAME})`
      )
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) throw error;

    body.innerHTML = '';
    lastRenderedDate = null;

    if (!data || data.length === 0) {
      body.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full gap-3 py-12">
          <div class="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
            <i data-lucide="message-circle" class="w-8 h-8 text-blue-400"></i>
          </div>
          <p class="text-slate-400 text-sm font-medium">Mulai percakapan dengan ${escapeHTML(other)}</p>
        </div>`;
      refreshIcons();
      return;
    }

    data.forEach(msg => appendMessageBubble(msg, false));
    refreshIcons();
    scrollToBottom(false);
  } catch (err) {
    console.error('loadMessages error:', err);
    const body = document.getElementById('chatBody');
    if (body) {
      body.innerHTML = `
        <div class="flex items-center justify-center h-full text-red-400 text-sm gap-2">
          <i data-lucide="alert-circle" class="w-5 h-5"></i>
          <span>Gagal memuat pesan. Coba refresh.</span>
        </div>`;
      refreshIcons();
    }
  }
}

/**
 * Append a single message bubble to the chat body.
 * @param {Object} msg   - Message row from Supabase
 * @param {boolean} live - If true, scroll to bottom after appending
 */
function appendMessageBubble(msg, live = true) {
  const body = document.getElementById('chatBody');
  if (!body) return;

  // Remove empty state if present
  const emptyState = body.querySelector('.flex.flex-col.items-center');
  if (emptyState && emptyState.classList.contains('py-12')) emptyState.remove();
  const loader = body.querySelector('.spinner');
  if (loader) loader.closest('.flex')?.remove();

  const isMine = msg.sender_name === MY_NAME;
  const time   = fmtTime(msg.created_at);
  const dKey   = dateKey(msg.created_at);

  // Date separator
  if (dKey && dKey !== lastRenderedDate) {
    lastRenderedDate = dKey;
    const sep = document.createElement('div');
    sep.className = 'date-separator';
    sep.textContent = fmtDateLabel(msg.created_at);
    body.appendChild(sep);
  }

  // Wrapper
  const row = document.createElement('div');
  row.className = `flex items-end gap-2 mb-1 ${isMine ? 'justify-end' : 'justify-start'}`;
  row.dataset.msgId = msg.id;

  // Avatar (only for received)
  let avatarHtml = '';
  if (!isMine) {
    const color = avatarColor(msg.sender_name);
    avatarHtml = `
      <div class="w-7 h-7 rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 self-end">
        ${escapeHTML(getInitials(msg.sender_name))}
      </div>`;
  }

  // Content bubble
  let contentHtml = '';
  if (msg.image_url) {
    contentHtml = `
      <div class="flex flex-col ${isMine ? 'items-end' : 'items-start'} gap-1">
        <div class="bubble-image" onclick="openImageFull('${escapeHTML(msg.image_url)}')">
          <img src="${escapeHTML(msg.image_url)}" alt="Gambar" loading="lazy" />
        </div>
        ${msg.content ? `<div class="${isMine ? 'bubble-sent' : 'bubble-received'}">${escapeHTML(msg.content)}</div>` : ''}
        <span class="msg-time ${isMine ? 'text-right' : ''}">${escapeHTML(time)}</span>
      </div>`;
  } else {
    contentHtml = `
      <div class="flex flex-col ${isMine ? 'items-end' : 'items-start'} gap-0.5">
        <div class="${isMine ? 'bubble-sent' : 'bubble-received'}">${escapeHTML(msg.content || '')}</div>
        <span class="msg-time ${isMine ? 'text-right' : ''}">${escapeHTML(time)}</span>
      </div>`;
  }

  row.innerHTML = isMine
    ? contentHtml
    : avatarHtml + contentHtml;

  body.appendChild(row);

  if (live) {
    refreshIcons();
    scrollToBottom();
  }
}

/** Open an image in a full-screen lightbox */
function openImageFull(url) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:9999;
    background:rgba(0,0,0,0.9);
    display:flex;align-items:center;justify-content:center;
    cursor:zoom-out;
  `;
  overlay.innerHTML = `<img src="${escapeHTML(url)}" style="max-width:95vw;max-height:95vh;border-radius:12px;object-fit:contain;" />`;
  overlay.onclick = () => overlay.remove();
  document.body.appendChild(overlay);
}

/* ──────────────────────────────────────────────
   7. SEND MESSAGE
──────────────────────────────────────────────── */
async function sendMessage() {
  if (!activeContact) {
    showToast('Pilih kontak terlebih dahulu.', 'error');
    return;
  }
  const input = document.getElementById('msgInput');
  if (!input) return;

  const content = input.value.trim();
  if (!content) return;

  // Optimistic disable
  const sendBtn = document.getElementById('sendBtn');
  if (sendBtn) sendBtn.disabled = true;

  // Clear input immediately
  input.value = '';
  input.style.height = 'auto';

  try {
    const { error } = await supabase
      .from('messages')
      .insert({
        sender_name:   MY_NAME,
        receiver_name: activeContact.name,
        content:       content,
      });

    if (error) throw error;

    // Realtime listener will pick it up; also refresh contacts
    loadContacts();
  } catch (err) {
    console.error('sendMessage error:', err);
    showToast('Gagal mengirim pesan.', 'error');
    // Restore input on failure
    input.value = content;
    autoResizeTextarea(input);
  } finally {
    if (sendBtn) sendBtn.disabled = false;
    input.focus();
  }
}

/** Handle Enter key (send) and Shift+Enter (newline) */
function handleMsgKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

/* ──────────────────────────────────────────────
   8. REALTIME — MESSAGES
──────────────────────────────────────────────── */
function subscribeMessages() {
  // Unsubscribe previous channel
  if (messagesChannel) {
    supabase.removeChannel(messagesChannel);
    messagesChannel = null;
  }

  messagesChannel = supabase
    .channel('chat-messages-' + Date.now())
    .on('postgres_changes', {
      event:  'INSERT',
      schema: 'public',
      table:  'messages',
    }, (payload) => {
      const msg = payload.new;
      if (!activeContact) return;

      const other = activeContact.name;
      const isRelevant =
        (msg.sender_name === MY_NAME   && msg.receiver_name === other) ||
        (msg.sender_name === other     && msg.receiver_name === MY_NAME);

      if (isRelevant) {
        appendMessageBubble(msg, true);
      }
    })
    .subscribe();
}

/* ──────────────────────────────────────────────
   9. IMAGE UPLOAD
──────────────────────────────────────────────── */
let pendingImageDataUrl = null;

function handleImageUpload(input) {
  const file = input.files?.[0];
  if (!file) return;

  // Validate type & size (max 5 MB)
  if (!file.type.startsWith('image/')) {
    showToast('File harus berupa gambar.', 'error');
    input.value = '';
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('Ukuran gambar maksimal 5 MB.', 'error');
    input.value = '';
    return;
  }

  pendingImageFile = file;

  // Show preview modal
  const reader = new FileReader();
  reader.onload = (e) => {
    pendingImageDataUrl = e.target.result;
    const previewEl = document.getElementById('imgPreviewEl');
    if (previewEl) previewEl.src = pendingImageDataUrl;
    const modal = document.getElementById('imgPreviewModal');
    if (modal) modal.classList.remove('hidden');
    refreshIcons();
  };
  reader.readAsDataURL(file);

  // Reset input so same file can be picked again
  input.value = '';
}

function closeImgPreview() {
  const modal = document.getElementById('imgPreviewModal');
  if (modal) modal.classList.add('hidden');
  pendingImageFile = null;
  pendingImageDataUrl = null;
}

async function confirmSendImage() {
  if (!pendingImageFile) return;
  if (!activeContact) {
    showToast('Pilih kontak terlebih dahulu.', 'error');
    return;
  }

  const btn = document.getElementById('sendImgBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;border-top-color:#fff;border-color:#ffffff55;"></div> Mengirim...';
  }

  try {
    const caption   = document.getElementById('imgCaptionInput')?.value.trim() || '';
    const ext       = pendingImageFile.name.split('.').pop().toLowerCase() || 'jpg';
    const filename  = `chat/${MY_USERNAME}_${Date.now()}.${ext}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('chat-attachments')
      .upload(filename, pendingImageFile, {
        cacheControl: '3600',
        upsert: false,
        contentType: pendingImageFile.type,
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('chat-attachments')
      .getPublicUrl(uploadData.path || filename);

    const publicUrl = urlData?.publicUrl;
    if (!publicUrl) throw new Error('Gagal mendapatkan URL gambar.');

    // Insert message
    const { error: insertError } = await supabase
      .from('messages')
      .insert({
        sender_name:   MY_NAME,
        receiver_name: activeContact.name,
        content:       caption,
        image_url:     publicUrl,
      });

    if (insertError) throw insertError;

    closeImgPreview();
    showToast('Gambar terkirim!');
    loadContacts();
  } catch (err) {
    console.error('confirmSendImage error:', err);
    showToast('Gagal mengirim gambar: ' + (err.message || 'Unknown error'), 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="send" class="w-4 h-4"></i> Kirim';
      refreshIcons();
    }
  }
}

/* ──────────────────────────────────────────────
   10. INSTAGRAM NOTES
──────────────────────────────────────────────── */
let myCurrentNote = null;  // The current user's note (if any)

async function loadNotes() {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('user_notes')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    if (error) throw error;

    renderNotes(data || []);
  } catch (err) {
    console.error('loadNotes error:', err);
    renderNotes([]);
  }
}

function renderNotes(notes) {
  // Separate: my note vs others
  const myNote      = notes.find(n => n.author_name === MY_NAME);
  const friendNotes = notes.filter(n => n.author_name !== MY_NAME);

  myCurrentNote = myNote || null;

  // ── My note bubble ──
  const myBubble = document.getElementById('myNoteBubble');
  const myPlusIcon  = document.getElementById('myNotePlusIcon');
  const myInitialEl = document.getElementById('myNoteInitial');

  if (myInitialEl) myInitialEl.textContent = getInitials(MY_NAME);

  if (myNote && myBubble) {
    myBubble.classList.remove('hidden');
    const noteTextEl = document.getElementById('myNoteText');
    if (noteTextEl) {
      noteTextEl.textContent = myNote.note_text || '';
    }
    if (myPlusIcon) myPlusIcon.classList.add('hidden');
  } else {
    if (myBubble) myBubble.classList.add('hidden');
    if (myPlusIcon) myPlusIcon.classList.remove('hidden');
  }

  // ── Friend notes ──
  const container = document.getElementById('friendNotesContainer');
  if (!container) return;

  if (friendNotes.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = friendNotes.map(note => {
    const color    = avatarColor(note.author_name);
    const initials = getInitials(note.author_name);
    const hasSong  = Boolean(note.song_title);
    const noteText = escapeHTML(note.note_text || '');
    const songText = hasSong ? escapeHTML(note.song_title) : '';

    return `
      <div class="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer note-avatar-wrap"
           onclick="replyToNote(${JSON.stringify(note.author_name)}, ${JSON.stringify(note.note_text || '')})">
        <div class="relative">
          <!-- Note bubble above avatar -->
          <div class="note-bubble note-bubble-above">
            ${noteText}
            ${hasSong ? `<span class="song-gradient text-[10px] font-semibold mt-0.5 block flex items-center gap-1">♪ ${songText}</span>` : ''}
          </div>
          <!-- Story ring -->
          <div class="story-ring w-16 h-16 rounded-full p-[2px]">
            <div class="w-full h-full rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white font-bold text-base">
              ${escapeHTML(initials)}
            </div>
          </div>
          <!-- Online dot -->
          <span class="online-pulse absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white"></span>
        </div>
        <span class="text-[11px] text-slate-500 font-medium truncate max-w-[64px] text-center">
          ${escapeHTML(note.author_name?.split(' ')[0] || 'Teman')}
        </span>
      </div>`;
  }).join('');

  refreshIcons();
}

/** When a friend's note is clicked, pre-fill the input with a reply */
function replyToNote(authorName, noteText) {
  // Open chat with that person first
  openChat(authorName);

  const input = document.getElementById('msgInput');
  if (!input) return;

  const prefix = `Balas note ${escapeHTML(authorName)} ("${escapeHTML(noteText)}"): `;
  input.value = prefix;
  autoResizeTextarea(input);
  input.focus();
  // Place cursor at end
  input.selectionStart = input.selectionEnd = input.value.length;
}

/* ──────────────────────────────────────────────
   11. NOTE MODAL
──────────────────────────────────────────────── */
function openNoteModal() {
  const modal = document.getElementById('noteModal');
  if (!modal) return;

  // Pre-fill if existing note
  const textInput = document.getElementById('noteTextInput');
  const songInput = document.getElementById('noteSongInput');
  if (textInput) textInput.value = myCurrentNote?.note_text || '';
  if (songInput) songInput.value = myCurrentNote?.song_title || '';

  updateNotePreview();
  modal.classList.remove('hidden');
  textInput?.focus();
  refreshIcons();
}

function closeNoteModal() {
  const modal = document.getElementById('noteModal');
  if (modal) modal.classList.add('hidden');
}

function updateNotePreview() {
  const textInput = document.getElementById('noteTextInput');
  const songInput = document.getElementById('noteSongInput');
  const previewWrap  = document.getElementById('notePreviewWrap');
  const previewText  = document.getElementById('notePreviewText');
  const previewSong  = document.getElementById('notePreviewSong');
  const previewInit  = document.getElementById('notePreviewInitial');
  const charCount    = document.getElementById('noteCharCount');

  const text = textInput?.value || '';
  const song = songInput?.value || '';

  if (charCount) charCount.textContent = text.length;

  const hasContent = text.trim().length > 0;
  if (previewWrap) previewWrap.classList.toggle('hidden', !hasContent);
  if (previewText) previewText.textContent = text;
  if (previewInit) previewInit.textContent = getInitials(MY_NAME);

  if (previewSong) {
    if (song.trim()) {
      previewSong.textContent = '♪ ' + song;
      previewSong.classList.remove('hidden');
      previewSong.classList.add('song-gradient');
    } else {
      previewSong.classList.add('hidden');
    }
  }
}

// Attach live preview to note inputs
document.getElementById('noteTextInput')?.addEventListener('input', updateNotePreview);
document.getElementById('noteSongInput')?.addEventListener('input', updateNotePreview);

async function saveNote() {
  const textInput = document.getElementById('noteTextInput');
  const songInput = document.getElementById('noteSongInput');
  const saveBtn   = document.getElementById('saveNoteBtn');

  const noteText  = textInput?.value.trim() || '';
  const songTitle = songInput?.value.trim() || '';

  if (!noteText) {
    showToast('Tulis sesuatu dulu!', 'error');
    return;
  }

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Menyimpan...';
  }

  try {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    if (myCurrentNote) {
      // Update existing note
      const { error } = await supabase
        .from('user_notes')
        .update({
          note_text:   noteText,
          song_title:  songTitle || null,
          created_at:  new Date().toISOString(),  // reset 24h timer
        })
        .eq('id', myCurrentNote.id);
      if (error) throw error;
    } else {
      // Insert new note
      const { error } = await supabase
        .from('user_notes')
        .insert({
          author_name: MY_NAME,
          note_text:   noteText,
          song_title:  songTitle || null,
        });
      if (error) throw error;
    }

    closeNoteModal();
    showToast('Note dibagikan!');
    await loadNotes();
  } catch (err) {
    console.error('saveNote error:', err);
    showToast('Gagal menyimpan note: ' + (err.message || ''), 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Bagikan Note';
    }
  }
}

/* ──────────────────────────────────────────────
   12. REALTIME — NOTES
──────────────────────────────────────────────── */
function subscribeNotes() {
  if (notesChannel) {
    supabase.removeChannel(notesChannel);
    notesChannel = null;
  }

  notesChannel = supabase
    .channel('user-notes-' + Date.now())
    .on('postgres_changes', {
      event:  '*',
      schema: 'public',
      table:  'user_notes',
    }, () => {
      loadNotes();
    })
    .subscribe();
}

/* ──────────────────────────────────────────────
   13. SIDEBAR USERNAME DISPLAY
──────────────────────────────────────────────── */
function initSidebarUser() {
  const el = document.getElementById('sidebarUsername');
  if (el) el.textContent = MY_NAME;

  // Update my note avatar initial
  const init = document.getElementById('myNoteInitial');
  if (init) init.textContent = getInitials(MY_NAME);

  // Update avatar color
  const myAvatar = document.getElementById('myNoteAvatar');
  if (myAvatar) {
    const color = avatarColor(MY_NAME);
    myAvatar.className = `w-full h-full rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white font-bold text-lg overflow-hidden`;
  }
}

/* ──────────────────────────────────────────────
   14. DESKTOP LAYOUT INIT
──────────────────────────────────────────────── */
function initDesktopLayout() {
  const isDesktop = window.innerWidth >= 768;
  const noChat    = document.getElementById('noChatPanel');
  const mainArea  = document.getElementById('mainArea');

  if (isDesktop) {
    if (noChat) noChat.style.display = 'flex';
    if (mainArea) mainArea.classList.add('hidden');
  }
}

/* ──────────────────────────────────────────────
   15. SUPABASE TABLE SCHEMA NOTE
   ──────────────────────────────────────────────
   The app expects these tables in Supabase:

   TABLE: messages
     id            uuid primary key default uuid_generate_v4()
     sender_name   text not null
     receiver_name text not null
     content       text
     image_url     text
     created_at    timestamptz default now()

   TABLE: user_notes
     id            uuid primary key default uuid_generate_v4()
     author_name   text not null
     note_text     text
     song_title    text
     created_at    timestamptz default now()

   STORAGE BUCKET: chat-attachments (public read)

   RLS policies:
     - messages: select public; insert for anon/authenticated
     - user_notes: select public; insert/update for anon/authenticated
     - chat-attachments bucket: public read, insert for anon/authenticated
──────────────────────────────────────────────── */

/* ──────────────────────────────────────────────
   16. INIT
──────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  // Render icons first
  refreshIcons();

  // Set sidebar username
  initSidebarUser();

  // Desktop layout: show empty right panel
  initDesktopLayout();

  // Load contacts
  await loadContacts();

  // Load notes
  await loadNotes();

  // Subscribe to notes realtime
  subscribeNotes();

  // Close modals on backdrop click
  document.getElementById('noteModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('noteModal')) closeNoteModal();
  });
  document.getElementById('imgPreviewModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('imgPreviewModal')) closeImgPreview();
  });

  // Resize handler for responsive layout
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768 && !activeContact) {
      initDesktopLayout();
    }
  });

  console.log(`[FortyOneside Chat] Initialized as: ${MY_NAME} (${MY_KELAS})`);
});
