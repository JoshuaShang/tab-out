/* ================================================================
   Tab Out — Favorites Module (favorites.js)

   Stores website shortcuts and local file paths.
   Data lives in chrome.storage.local under 'tabout_favorites'.
   Call initFavoritesModule() once on page load.
   ================================================================ */

'use strict';

const FAV_KEY = 'tabout_favorites';

/* ----------------------------------------------------------------
   Storage helpers
   ---------------------------------------------------------------- */

function loadFavorites(cb) {
  chrome.storage.local.get(FAV_KEY, data => cb(data[FAV_KEY] || []));
}

function saveFavorites(favs, cb) {
  chrome.storage.local.set({ [FAV_KEY]: favs }, cb);
}

/* ----------------------------------------------------------------
   URL / path helpers
   ---------------------------------------------------------------- */

function isFilePath(url) {
  return url.startsWith('file://') ||
         /^[A-Za-z]:[\\\/]/.test(url) ||
         url.startsWith('/');
}

/**
 * Normalise any input (URL, Windows path, Unix path) into a
 * chrome-openable URL string.
 */
function normaliseUrl(raw) {
  const s = raw.trim();
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('file://')) return s;
  if (/^[A-Za-z]:[\\\/]/.test(s)) return 'file:///' + s.replace(/\\/g, '/');  // D:\path → file:///D:/path
  if (s.startsWith('/'))           return 'file://' + s;                         // /usr/... → file:///usr/...
  return 'https://' + s;                                                          // bare domain
}

function getAutoLabel(raw) {
  try {
    const url = normaliseUrl(raw);
    const u   = new URL(url);
    if (u.protocol === 'file:') {
      const parts = decodeURIComponent(u.pathname).split('/').filter(Boolean);
      return parts[parts.length - 1] || 'File';
    }
    return u.hostname.replace(/^www\./, '');
  } catch { return raw; }
}

function esc(str) {
  return (str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ----------------------------------------------------------------
   Build item HTML
   ---------------------------------------------------------------- */

function buildFavHTML(fav) {
  const label  = esc(fav.name || getAutoLabel(fav.url));
  const urlEsc = esc(fav.url);
  const file   = isFilePath(fav.url);

  let iconHTML;
  if (file) {
    iconHTML = `
      <svg class="fav-file-icon" xmlns="http://www.w3.org/2000/svg" fill="none"
           viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125
             1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25
             m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0
             .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504
             1.125-1.125V11.25a9 9 0 0 0-9-9Z"/>
      </svg>`;
  } else {
    let domain = '';
    try { domain = new URL(normaliseUrl(fav.url)).hostname; } catch {}
    iconHTML = `
      <img class="fav-favicon"
           src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32"
           alt="" onerror="this.style.display='none'">`;
  }

  return `
    <div class="fav-item" data-id="${esc(fav.id)}" title="${urlEsc}">
      <div class="fav-item-inner" data-action="fav-open" data-url="${urlEsc}">
        <div class="fav-icon">${iconHTML}</div>
        <span class="fav-label">${label}</span>
      </div>
      <button class="fav-remove" data-action="fav-remove" data-id="${esc(fav.id)}" title="Remove">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
             stroke-width="2.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>`;
}

/* ----------------------------------------------------------------
   Render
   ---------------------------------------------------------------- */

function renderFavorites() {
  const list  = document.getElementById('favList');
  const empty = document.getElementById('favEmpty');
  if (!list) return;

  loadFavorites(favs => {
    if (favs.length === 0) {
      list.innerHTML = '';
      if (empty) empty.style.display = 'block';
    } else {
      if (empty) empty.style.display = 'none';
      list.innerHTML = favs.map(buildFavHTML).join('');
    }
  });
}

/* ----------------------------------------------------------------
   Mutations
   ---------------------------------------------------------------- */

function addFavorite(url, name) {
  const trimUrl = url.trim();
  if (!trimUrl) return;
  loadFavorites(favs => {
    favs.push({ id: Date.now().toString(), url: trimUrl, name: name.trim() });
    saveFavorites(favs, renderFavorites);
  });
}

function removeFavorite(id) {
  loadFavorites(favs => saveFavorites(favs.filter(f => f.id !== id), renderFavorites));
}

function openFavorite(url) {
  chrome.tabs.create({ url: normaliseUrl(url) });
}

/* ----------------------------------------------------------------
   Init — wire events once
   ---------------------------------------------------------------- */

function initFavoritesModule() {
  const addBtn     = document.getElementById('favAddBtn');
  const addForm    = document.getElementById('favAddForm');
  const urlInput   = document.getElementById('favUrlInput');
  const nameInput  = document.getElementById('favNameInput');
  const confirmBtn = document.getElementById('favConfirmAdd');
  const cancelBtn  = document.getElementById('favCancelAdd');
  const list       = document.getElementById('favList');

  if (!addBtn) return;

  function showForm() {
    addForm.style.display = 'block';
    urlInput.focus();
  }

  function hideForm() {
    addForm.style.display = 'none';
    urlInput.value  = '';
    nameInput.value = '';
  }

  function doAdd() {
    const url  = urlInput.value.trim();
    const name = nameInput.value.trim();
    if (!url) { urlInput.focus(); return; }
    addFavorite(url, name);
    hideForm();
  }

  addBtn.addEventListener('click', () => {
    addForm.style.display === 'none' ? showForm() : hideForm();
  });

  confirmBtn.addEventListener('click', doAdd);

  cancelBtn.addEventListener('click', hideForm);

  [urlInput, nameInput].forEach(inp => {
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter')  doAdd();
      if (e.key === 'Escape') hideForm();
    });
  });

  // Auto-fill label when URL loses focus
  urlInput.addEventListener('blur', () => {
    if (!urlInput.value.trim() || nameInput.value.trim()) return;
    nameInput.value = getAutoLabel(urlInput.value);
  });

  // Event delegation for open + remove actions inside the list
  if (list) {
    list.addEventListener('click', e => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      e.stopPropagation();
      if (el.dataset.action === 'fav-open')   openFavorite(el.dataset.url);
      if (el.dataset.action === 'fav-remove') removeFavorite(el.dataset.id);
    });
  }

  renderFavorites();
}

window.initFavoritesModule = initFavoritesModule;
window.renderFavorites     = renderFavorites;
