/* ================================================================
   Tab Out — To Do List Module (todo.js)
   Table-based task manager with customisable columns, inline
   editing, user-defined sort, and per-column rename/delete/add.
   All data in localStorage; column config in a separate key.
   ================================================================ */
'use strict';

const TODO_KEY      = 'tabout_todos';
const TODO_COLS_KEY = 'tabout_todo_cols';

const DEFAULT_COLUMNS = [
  { id: 'seq',         label: '#',           type: 'auto-int', width: 44,  fixed: true },
  { id: 'title',       label: 'Title',       type: 'text',     width: 220, fixed: true },
  { id: 'description', label: 'Description', type: 'text',     width: 200 },
  { id: 'status',      label: 'Status',      type: 'select',   width: 130,
    options: ['Not started', 'In Progress', 'Done'] },
  { id: 'dueDate',     label: 'Due Date',    type: 'date',     width: 115 },
  { id: 'priority',    label: 'Priority',    type: 'select',   width: 110,
    options: ['—', 'Critical', 'High', 'Normal', 'Maybe'] },
  { id: 'fileLink',    label: 'File Link',   type: 'url',      width: 160 },
];

/* ── Persistence ─────────────────────────────────────────────── */

function loadTodoData() {
  try {
    const raw = localStorage.getItem(TODO_KEY);
    if (!raw) return { rows: [], nextSeq: 1 };
    const parsed = JSON.parse(raw);
    // Migrate old pill-format (array)
    if (Array.isArray(parsed)) return migrateLegacy(parsed);
    return parsed;
  } catch { return { rows: [], nextSeq: 1 }; }
}

function migrateLegacy(arr) {
  const rows = arr.map((t, i) => ({
    _id:         t.id || (Date.now() + i).toString(),
    seq:         i + 1,
    title:       t.text || '',
    description: '',
    status:      t.completed ? 'Done' : 'Not started',
    dueDate:     '',
    priority:    t.priority === 'critical' ? 'Critical'
                 : t.priority === 'high'   ? 'High'
                 : t.priority === 'maybe'  ? 'Maybe' : '—',
    fileLink:    '',
  }));
  return { rows, nextSeq: rows.length + 1 };
}

function saveTodoData(data) {
  localStorage.setItem(TODO_KEY, JSON.stringify(data));
}

function loadColConfig() {
  try {
    const raw = localStorage.getItem(TODO_COLS_KEY);
    if (!raw) return { columns: DEFAULT_COLUMNS.map(c => ({ ...c })), sortBy: null, sortDir: 'asc' };
    return JSON.parse(raw);
  } catch { return { columns: DEFAULT_COLUMNS.map(c => ({ ...c })), sortBy: null, sortDir: 'asc' }; }
}

function saveColConfig(cfg) {
  localStorage.setItem(TODO_COLS_KEY, JSON.stringify(cfg));
}

/* ── Utilities ───────────────────────────────────────────────── */

function escH(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function truncUrl(url) {
  try {
    const u = new URL(url);
    const s = u.hostname + (u.pathname !== '/' ? u.pathname : '');
    return s.length > 28 ? s.slice(0, 28) + '…' : s;
  } catch { return url.length > 28 ? url.slice(0, 28) + '…' : url; }
}

function statusCls(colId, val) {
  if (colId === 'status') {
    if (val === 'Done')        return 'td-status-done';
    if (val === 'In Progress') return 'td-status-inprogress';
    return 'td-status-notstarted';
  }
  if (colId === 'priority') {
    if (val === 'Critical') return 'td-pri-critical';
    if (val === 'High')     return 'td-pri-high';
    if (val === 'Maybe')    return 'td-pri-maybe';
  }
  return '';
}

function sortedRows(rows, cfg) {
  if (!cfg.sortBy) return [...rows];
  return [...rows].sort((a, b) => {
    const av = a[cfg.sortBy] ?? '', bv = b[cfg.sortBy] ?? '';
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
    return cfg.sortDir === 'asc' ? cmp : -cmp;
  });
}

function updateProgress(rows) {
  const total = rows.length, done = rows.filter(r => r.status === 'Done').length;
  const pct = total ? Math.round(done / total * 100) : 0;
  const bar = document.getElementById('todoProgressBar');
  const lbl = document.getElementById('todoProgressPct');
  if (bar) bar.style.width = pct + '%';
  if (lbl) lbl.textContent = total ? `${done}/${total}` : '';
}

/* ── HTML builders ───────────────────────────────────────────── */

function buildTableHTML(cols, rows, cfg) {
  const thead = cols.map(col => {
    const sorted = cfg.sortBy === col.id;
    const arrow  = sorted ? (cfg.sortDir === 'asc' ? ' ↑' : ' ↓') : '';
    const sortable = col.type !== 'auto-int' ? ' td-sortable' : '';
    return `<th class="td-col${sortable}${sorted ? ' td-sorted' : ''}" data-col-id="${col.id}" style="width:${col.width}px;min-width:${col.width}px">
      <div class="td-th-inner">
        <span class="td-th-label">${escH(col.label)}${arrow}</span>
        ${!col.fixed ? `<button class="td-col-menu-btn" data-col-id="${col.id}" title="Column options">⋯</button>` : ''}
      </div>
    </th>`;
  }).join('');

  const addColTh  = `<th class="td-col td-add-col-th"><button class="td-add-col-btn" title="Add column">+</button></th>`;
  const actionsTh = `<th class="td-col td-actions-th"></th>`;

  const tbody = rows.map(row => {
    const isDone = row.status === 'Done';
    const cells  = cols.map(col => {
      const val = row[col.id] ?? '';
      let inner = '';

      if (col.type === 'auto-int') {
        inner = `<span class="td-seq">${row.seq}</span>`;
      } else if (col.type === 'select') {
        const opts = (col.options || []).map(o =>
          `<option value="${escH(o)}"${o === val ? ' selected' : ''}>${escH(o)}</option>`
        ).join('');
        inner = `<select class="td-select ${statusCls(col.id, val)}" data-row-id="${row._id}" data-col-id="${col.id}">${opts}</select>`;
      } else if (col.type === 'date') {
        inner = `<span class="td-cell-text td-date" data-row-id="${row._id}" data-col-id="${col.id}">${val ? escH(fmtDate(val)) : '<span class="td-ph">—</span>'}</span>`;
      } else if (col.type === 'url') {
        inner = val
          ? `<span class="td-url-wrap"><a href="${escH(val)}" target="_blank" rel="noopener" class="td-link" title="${escH(val)}">${escH(truncUrl(val))}</a><button class="td-edit-url" data-row-id="${row._id}" data-col-id="${col.id}" title="Edit URL">✎</button></span>`
          : `<span class="td-cell-text" data-row-id="${row._id}" data-col-id="${col.id}"><span class="td-ph">—</span></span>`;
      } else {
        inner = `<span class="td-cell-text" data-row-id="${row._id}" data-col-id="${col.id}">${val ? escH(val) : '<span class="td-ph">—</span>'}</span>`;
      }

      return `<td class="td-cell" data-col-type="${col.type}">${inner}</td>`;
    }).join('');

    return `<tr class="td-row${isDone ? ' td-row-done' : ''}" data-row-id="${row._id}">${cells}<td class="td-spacer-cell"></td><td class="td-cell td-del-cell"><button class="td-del-btn" data-row-id="${row._id}" title="Delete">✕</button></td></tr>`;
  }).join('');

  const addRow = `<tr class="td-add-row"><td colspan="${cols.length + 2}"><button class="td-add-row-btn">+ Add task</button></td></tr>`;

  return `<div class="td-scroll-wrap"><table class="td-table"><thead><tr>${thead}${addColTh}${actionsTh}</tr></thead><tbody>${tbody}${addRow}</tbody></table></div>`;
}

/* ── Main render ─────────────────────────────────────────────── */

function renderTodoTable() {
  const cfg  = loadColConfig();
  const data = loadTodoData();
  const wrap = document.getElementById('todoTableWrap');
  if (!wrap) return;

  wrap.innerHTML = buildTableHTML(cfg.columns, sortedRows(data.rows, cfg), cfg);
  wireTableEvents(wrap, cfg, data);
  updateProgress(data.rows);
}

/* ── Event wiring ────────────────────────────────────────────── */

function wireTableEvents(wrap, cfg, data) {

  // Sort on header click
  wrap.querySelectorAll('th.td-sortable').forEach(th => {
    th.addEventListener('click', e => {
      if (e.target.closest('.td-col-menu-btn')) return;
      const colId = th.dataset.colId;
      if (cfg.sortBy === colId) {
        cfg.sortDir = cfg.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        cfg.sortBy  = colId;
        cfg.sortDir = 'asc';
      }
      saveColConfig(cfg);
      renderTodoTable();
    });
  });

  // Rename column on double-click
  wrap.querySelectorAll('.td-th-label').forEach(lbl => {
    lbl.addEventListener('dblclick', e => {
      e.stopPropagation();
      const th  = lbl.closest('th');
      const col = cfg.columns.find(c => c.id === th.dataset.colId);
      if (!col || col.fixed) return;
      startRenameCol(lbl, col, cfg);
    });
  });

  // Column ⋯ menu
  wrap.querySelectorAll('.td-col-menu-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      showColMenu(btn, btn.dataset.colId, cfg);
    });
  });

  // Add column
  const addColBtn = wrap.querySelector('.td-add-col-btn');
  if (addColBtn) addColBtn.addEventListener('click', e => {
    e.stopPropagation();
    showAddColForm(addColBtn, cfg);
  });

  // Add row
  const addRowBtn = wrap.querySelector('.td-add-row-btn');
  if (addRowBtn) addRowBtn.addEventListener('click', () => addNewRow());

  // Text cell edit on click
  wrap.querySelectorAll('.td-cell-text:not(.td-date)').forEach(span => {
    span.addEventListener('click', () => {
      const { rowId, colId } = span.dataset;
      if (rowId && colId) startTextEdit(span, rowId, colId, data);
    });
  });

  // Date cell edit
  wrap.querySelectorAll('.td-date').forEach(span => {
    span.addEventListener('click', () => {
      const { rowId, colId } = span.dataset;
      if (rowId && colId) startDateEdit(span, rowId, colId, data);
    });
  });

  // URL edit button
  wrap.querySelectorAll('.td-edit-url').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      startUrlEdit(btn.closest('.td-cell'), btn.dataset.rowId, btn.dataset.colId, data);
    });
  });

  // Empty URL cell click
  wrap.querySelectorAll('.td-cell[data-col-type="url"] .td-cell-text').forEach(span => {
    span.addEventListener('click', () => {
      startUrlEdit(span.closest('.td-cell'), span.dataset.rowId, span.dataset.colId, data);
    });
  });

  // Select change
  wrap.querySelectorAll('.td-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const row = data.rows.find(r => r._id === sel.dataset.rowId);
      if (!row) return;
      row[sel.dataset.colId] = sel.value;
      saveTodoData(data);
      sel.className = `td-select ${statusCls(sel.dataset.colId, sel.value)}`;
      if (sel.dataset.colId === 'status') {
        const tr = sel.closest('tr');
        if (tr) tr.classList.toggle('td-row-done', sel.value === 'Done');
      }
      updateProgress(data.rows);
    });
  });

  // Delete row
  wrap.querySelectorAll('.td-del-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      data.rows = data.rows.filter(r => r._id !== btn.dataset.rowId);
      saveTodoData(data);
      renderTodoTable();
    });
  });
}

/* ── Inline edits ────────────────────────────────────────────── */

function startTextEdit(span, rowId, colId, data) {
  if (span.querySelector('input,textarea')) return;
  const row = data.rows.find(r => r._id === rowId);
  if (!row) return;

  const isMulti = colId === 'description';
  const el = document.createElement(isMulti ? 'textarea' : 'input');
  el.value     = row[colId] || '';
  el.className = 'td-input' + (isMulti ? ' td-textarea' : '');
  if (!isMulti) el.type = 'text';

  span.replaceWith(el);
  el.focus(); el.select();

  function commit() { row[colId] = el.value.trim(); saveTodoData(data); renderTodoTable(); }
  el.addEventListener('blur', commit);
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !isMulti) el.blur();
    if (e.key === 'Escape') renderTodoTable();
  });
}

function startDateEdit(span, rowId, colId, data) {
  if (span.querySelector('input')) return;
  const row = data.rows.find(r => r._id === rowId);
  if (!row) return;

  const el     = document.createElement('input');
  el.type      = 'date';
  el.value     = row[colId] || '';
  el.className = 'td-input td-date-input';

  span.replaceWith(el);
  el.focus();

  function commit() { row[colId] = el.value; saveTodoData(data); renderTodoTable(); }
  el.addEventListener('blur', commit);
  el.addEventListener('change', () => el.blur());
  el.addEventListener('keydown', e => { if (e.key === 'Escape') renderTodoTable(); });
}

function startUrlEdit(cell, rowId, colId, data) {
  if (!cell || cell.querySelector('input')) return;
  const row = data.rows.find(r => r._id === rowId);
  if (!row) return;

  const saved  = cell.innerHTML;
  const el     = document.createElement('input');
  el.type      = 'url';
  el.value     = row[colId] || '';
  el.className = 'td-input td-url-input';
  el.placeholder = 'https://…  or  file:///path/to/file';

  cell.innerHTML = '';
  cell.appendChild(el);
  el.focus(); el.select();

  function commit() { row[colId] = el.value.trim(); saveTodoData(data); renderTodoTable(); }
  el.addEventListener('blur', commit);
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter') el.blur();
    if (e.key === 'Escape') { cell.innerHTML = saved; }
  });
}

/* ── Column rename ───────────────────────────────────────────── */

function startRenameCol(lbl, col, cfg) {
  const el     = document.createElement('input');
  el.type      = 'text';
  el.value     = col.label;
  el.className = 'td-col-rename-input';

  lbl.replaceWith(el);
  el.focus(); el.select();

  function commit() { const v = el.value.trim(); if (v) col.label = v; saveColConfig(cfg); renderTodoTable(); }
  el.addEventListener('blur', commit);
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter') el.blur();
    if (e.key === 'Escape') renderTodoTable();
  });
}

/* ── Column menu ─────────────────────────────────────────────── */

function showColMenu(btn, colId, cfg) {
  document.querySelectorAll('.td-col-menu').forEach(m => m.remove());
  const col = cfg.columns.find(c => c.id === colId);
  if (!col) return;

  const menu = document.createElement('div');
  menu.className = 'td-col-menu';
  menu.innerHTML = `
    <button class="td-menu-item" data-a="rename">Rename column</button>
    <button class="td-menu-item td-menu-danger" data-a="delete">Remove column</button>`;

  const r = btn.getBoundingClientRect();
  Object.assign(menu.style, { position: 'fixed', top: r.bottom + 4 + 'px', left: r.left + 'px', zIndex: 9999 });
  document.body.appendChild(menu);

  menu.querySelector('[data-a="rename"]').onclick = () => {
    menu.remove();
    const th  = document.querySelector(`th[data-col-id="${colId}"]`);
    const lbl = th && th.querySelector('.td-th-label');
    if (lbl) startRenameCol(lbl, col, cfg);
  };

  menu.querySelector('[data-a="delete"]').onclick = () => {
    menu.remove();
    cfg.columns = cfg.columns.filter(c => c.id !== colId);
    if (cfg.sortBy === colId) cfg.sortBy = null;
    saveColConfig(cfg);
    renderTodoTable();
  };

  setTimeout(() => {
    function outside(e) { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', outside); } }
    document.addEventListener('click', outside);
  }, 0);
}

/* ── Add column form ─────────────────────────────────────────── */

function showAddColForm(btn, cfg) {
  document.querySelectorAll('.td-add-col-form,.td-col-menu').forEach(m => m.remove());

  const form = document.createElement('div');
  form.className = 'td-add-col-form';
  form.innerHTML = `
    <div class="td-form-title">New column</div>
    <input type="text" id="_ncName" class="td-form-input" placeholder="Column name" autocomplete="off">
    <select id="_ncType" class="td-form-select">
      <option value="text">Text</option>
      <option value="select">Dropdown (select)</option>
      <option value="date">Date</option>
      <option value="url">URL / File link</option>
      <option value="number">Number</option>
    </select>
    <div id="_ncOptsWrap" style="display:none">
      <input type="text" id="_ncOpts" class="td-form-input" placeholder="Options: A, B, C" autocomplete="off">
    </div>
    <div class="td-form-actions">
      <button id="_ncAdd" class="td-form-btn-primary">Add</button>
      <button id="_ncCancel" class="td-form-btn-cancel">Cancel</button>
    </div>`;

  const r = btn.getBoundingClientRect();
  Object.assign(form.style, {
    position: 'fixed',
    top:   r.bottom + 4 + 'px',
    right: (window.innerWidth - r.right) + 'px',
    zIndex: 9999,
  });
  document.body.appendChild(form);

  const nameEl   = form.querySelector('#_ncName');
  const typeEl   = form.querySelector('#_ncType');
  const optsWrap = form.querySelector('#_ncOptsWrap');
  nameEl.focus();

  typeEl.onchange = () => { optsWrap.style.display = typeEl.value === 'select' ? 'block' : 'none'; };

  form.querySelector('#_ncAdd').onclick = () => {
    const name = nameEl.value.trim();
    if (!name) { nameEl.focus(); return; }
    const type = typeEl.value;
    const col  = { id: 'col_' + Date.now(), label: name, type, width: 150 };
    if (type === 'select') {
      const raw = form.querySelector('#_ncOpts').value;
      col.options = ['—', ...raw.split(',').map(o => o.trim()).filter(Boolean)];
      if (col.options.length < 2) col.options = ['—', 'Option A', 'Option B'];
    }
    cfg.columns.push(col);
    saveColConfig(cfg);
    form.remove();
    // Populate default value on all existing rows
    const td = loadTodoData();
    td.rows.forEach(row => { if (!(col.id in row)) row[col.id] = type === 'select' ? '—' : ''; });
    saveTodoData(td);
    renderTodoTable();
  };

  form.querySelector('#_ncCancel').onclick = () => form.remove();

  setTimeout(() => {
    function outside(e) { if (!form.contains(e.target) && e.target !== btn) { form.remove(); document.removeEventListener('click', outside); } }
    document.addEventListener('click', outside);
  }, 0);
}

/* ── Add row ─────────────────────────────────────────────────── */

function addNewRow() {
  const cfg  = loadColConfig();
  const data = loadTodoData();
  const row  = {
    _id: Date.now().toString(), seq: data.nextSeq,
    title: '', description: '', status: 'Not started',
    dueDate: '', priority: '—', fileLink: '',
  };
  cfg.columns.forEach(c => { if (!(c.id in row)) row[c.id] = c.type === 'select' ? (c.options?.[0] || '') : ''; });
  data.rows.push(row);
  data.nextSeq++;
  saveTodoData(data);
  renderTodoTable();

  requestAnimationFrame(() => {
    const tr    = document.querySelector(`tr[data-row-id="${row._id}"]`);
    const title = tr && tr.querySelector('.td-cell-text[data-col-id="title"]');
    if (title) title.click();
  });
}

/* ── Init ────────────────────────────────────────────────────── */

function initTodoModule() {
  renderTodoTable();
}

window.initTodoModule = initTodoModule;
window.renderTodos    = renderTodoTable;
