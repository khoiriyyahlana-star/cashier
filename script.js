/* ============================================================
   KasirAI — tampilan.js
   Connects to Langflow via MCP for AI responses
  ============================================================ */

'use strict';

// ============================================================
// STATE
// ============================================================

// Langflow credentials dari MCP IBM Bob (.bob/mcp.json)
const LANGFLOW_DEFAULTS = {
  url:   'http://localhost:7860/api/v1/run/7701c193-a4f6-4252-b1ed-f81f135e6940',
  token: 'sk-Dx5_kaJTFh5Yl4VOR4KwTso-T-onHP0OIDmOO0npOO4',
};

const STATE = {
  transactions: [],
  chatHistory:  [],
  settings: {
    storeName:     'Toko Saya',
    cashierName:   'Admin',
    profitMargin:  30,
    aiProvider:    'langflow',   // 'demo' | 'langflow' | 'openai'
    langflowUrl:   LANGFLOW_DEFAULTS.url,
    langflowToken: LANGFLOW_DEFAULTS.token,
    apiKey:        '',
  },
  autoRecap:      false,
  autoRecapTimer: null,
  sheetData:      [],
  isOnline:       navigator.onLine,
};

// ============================================================
// UTILITIES
// ============================================================

const fmt = n =>
  'Rp\u00A0' + Math.round(n).toLocaleString('id-ID');

const fmtTime = () => {
  const d = new Date();
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const today = () => new Date().toISOString().slice(0, 10);

const todayTx = () => STATE.transactions.filter(t => t.date === today());

function rupiah(n) {
  return 'Rp ' + Number(n).toLocaleString('id-ID');
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mdBold(str) {
  return esc(str).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

// ============================================================
// PERSIST
// ============================================================

function persist() {
  try {
    localStorage.setItem('kasirAI_tx',       JSON.stringify(STATE.transactions));
    localStorage.setItem('kasirAI_settings', JSON.stringify(STATE.settings));
    localStorage.setItem('kasirAI_chat',     JSON.stringify(STATE.chatHistory));
    localStorage.setItem('kasirAI_autoRecap',JSON.stringify(STATE.autoRecap));
  } catch (_) {}
}

function hydrate() {
  try {
    const tx = localStorage.getItem('kasirAI_tx');
    if (tx) STATE.transactions = JSON.parse(tx);
    const st = localStorage.getItem('kasirAI_settings');
    if (st) Object.assign(STATE.settings, JSON.parse(st));
    const ch = localStorage.getItem('kasirAI_chat');
    if (ch) STATE.chatHistory = JSON.parse(ch);
    const ar = localStorage.getItem('kasirAI_autoRecap');
    if (ar) STATE.autoRecap = JSON.parse(ar);
  } catch (_) {}

  // Selalu pastikan credential Langflow MCP terisi (jika user belum pernah set manual)
  if (!STATE.settings.langflowUrl)   STATE.settings.langflowUrl   = LANGFLOW_DEFAULTS.url;
  if (!STATE.settings.langflowToken) STATE.settings.langflowToken = LANGFLOW_DEFAULTS.token;
  if (STATE.settings.aiProvider === 'demo') STATE.settings.aiProvider = 'langflow';
}

// ============================================================
// NAVIGATION
// ============================================================

const TITLES = {
  dashboard:   'Dashboard',
  spreadsheet: 'Spreadsheet Real-Time',
  recap:       'Rekap Bulanan Gmail',
  settings:    'Pengaturan',
};

function initNav() {
  // Nav items
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchPanel(btn.dataset.panel));
  });

  // Hamburger toggle
  document.getElementById('hamburger').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    const main    = document.getElementById('main');
    sidebar.classList.toggle('hidden');
    main.classList.toggle('full');
  });

  // Sidebar close button (mobile)
  document.getElementById('sidebarClose').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('hidden');
    document.getElementById('main').classList.add('full');
  });
}

function switchPanel(name) {
  document.querySelectorAll('.nav-item').forEach(b =>
    b.classList.toggle('active', b.dataset.panel === name)
  );
  document.querySelectorAll('.panel').forEach(p =>
    p.classList.toggle('active', p.id === `panel-${name}`)
  );
  document.getElementById('pageTitle').textContent = TITLES[name] || name;
}

// ============================================================
// TOPBAR DATE
// ============================================================

function tickDate() {
  const el = document.getElementById('topbarDate');
  if (el) {
    el.textContent = new Date().toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }
}

// ============================================================
// TRANSACTIONS
// ============================================================

/**
 * Core function to add a transaction and update all views.
 */
function addTx(product, qty, price, note = '', cashier = '') {
  const tx = {
    id:      STATE.transactions.length + 1,
    date:    today(),
    time:    fmtTime(),
    product: String(product).trim(),
    qty:     Math.max(1, parseInt(qty) || 1),
    price:   Math.max(0, parseFloat(price) || 0),
    total:   Math.max(1, parseInt(qty) || 1) * Math.max(0, parseFloat(price) || 0),
    note:    String(note).trim(),
    cashier: (cashier || STATE.settings.cashierName).trim(),
  };
  STATE.transactions.unshift(tx);
  persist();
  renderTxTable();
  updateKPIs();
  return tx;
}

function renderTxTable(filter = '') {
  const tbody = document.getElementById('txBody');
  const list  = todayTx().filter(tx =>
    !filter || tx.product.toLowerCase().includes(filter.toLowerCase()) ||
               tx.note.toLowerCase().includes(filter.toLowerCase())
  );

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-row">Belum ada transaksi hari ini.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map((tx, i) => `
    <tr class="${i === 0 && !filter ? 'row-flash' : ''}">
      <td style="color:var(--muted);font-size:12px">${tx.id}</td>
      <td style="color:var(--muted);font-size:12px">${tx.time}</td>
      <td>
        <strong>${esc(tx.product)}</strong>
        ${tx.note ? `<div style="font-size:11px;color:var(--muted)">${esc(tx.note)}</div>` : ''}
      </td>
      <td style="text-align:center">${tx.qty}</td>
      <td style="color:var(--gray-500)">${fmt(tx.price)}</td>
      <td style="font-weight:600;color:#1d4ed8">${fmt(tx.total)}</td>
      <td style="color:var(--muted);font-size:12px">${esc(tx.cashier)}</td>
    </tr>
  `).join('');
}

function updateKPIs() {
  const txs    = todayTx();
  const rev    = txs.reduce((s, t) => s + t.total, 0);
  const items  = txs.reduce((s, t) => s + t.qty, 0);
  const profit = rev * (STATE.settings.profitMargin / 100);
  const custs  = txs.length > 0 ? Math.max(1, Math.ceil(txs.length / 1.5)) : 0;

  setText('kpiRevenue',    fmt(rev));
  setText('kpiRevenueSub', `${txs.length} transaksi`);
  setText('kpiItems',      items);
  setText('kpiItemsSub',   'pcs hari ini');
  setText('kpiCustomers',  custs);
  setText('kpiProfit',     fmt(profit));
  setText('kpiProfitSub',  `margin ${STATE.settings.profitMargin}%`);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function getTopProducts(n = 5) {
  const map = {};
  todayTx().forEach(tx => {
    if (!map[tx.product]) map[tx.product] = { name: tx.product, qty: 0, total: 0 };
    map[tx.product].qty   += tx.qty;
    map[tx.product].total += tx.total;
  });
  return Object.values(map).sort((a, b) => b.total - a.total).slice(0, n);
}

// ============================================================
// MODAL — Add Transaction
// ============================================================

function initModal() {
  const bg      = document.getElementById('modalBg');
  const btnOpen = document.getElementById('btnNewTx');
  const close   = document.getElementById('modalClose');
  const cancel  = document.getElementById('modalCancel');
  const submit  = document.getElementById('modalSubmit');

  // Compute total preview
  const updateTotal = () => {
    const qty   = parseInt(document.getElementById('mxQty').value) || 0;
    const price = parseFloat(document.getElementById('mxPrice').value) || 0;
    document.getElementById('modalTotal').textContent = `Total: ${fmt(qty * price)}`;
  };

  document.getElementById('mxQty').addEventListener('input',   updateTotal);
  document.getElementById('mxPrice').addEventListener('input', updateTotal);

  const openModal = () => {
    document.getElementById('mxCashier').value = STATE.settings.cashierName;
    document.getElementById('mxProduct').value = '';
    document.getElementById('mxQty').value     = '1';
    document.getElementById('mxPrice').value   = '0';
    document.getElementById('mxNote').value    = '';
    document.getElementById('modalTotal').textContent = 'Total: Rp 0';
    bg.classList.add('open');
    setTimeout(() => document.getElementById('mxProduct').focus(), 80);
  };

  const closeModal = () => bg.classList.remove('open');

  btnOpen.addEventListener('click', openModal);
  close.addEventListener('click',   closeModal);
  cancel.addEventListener('click',  closeModal);
  bg.addEventListener('click', e => { if (e.target === bg) closeModal(); });
  bg.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  submit.addEventListener('click', () => {
    const product = document.getElementById('mxProduct').value.trim();
    if (!product) { document.getElementById('mxProduct').focus(); return; }

    const tx = addTx(
      product,
      document.getElementById('mxQty').value,
      document.getElementById('mxPrice').value,
      document.getElementById('mxNote').value,
      document.getElementById('mxCashier').value,
    );

    closeModal();
    aiAutoComment(tx);
  });

  bg.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target !== cancel) submit.click();
  });
}

// ============================================================
// SEARCH & EXPORT
// ============================================================

function initSearch() {
  document.getElementById('searchTx').addEventListener('input', e =>
    renderTxTable(e.target.value)
  );

  document.getElementById('exportTxCSV').addEventListener('click', () => {
    exportCSVData([
      ['#', 'Tanggal', 'Waktu', 'Produk', 'Catatan', 'Qty', 'Harga', 'Total', 'Kasir'],
      ...STATE.transactions.map(tx =>
        [tx.id, tx.date, tx.time, tx.product, tx.note, tx.qty, tx.price, tx.total, tx.cashier]
      ),
    ], `transaksi-${today()}.csv`);
  });
}

function exportCSVData(rows, filename) {
  if (!rows.length) { alert('Tidak ada data untuk diekspor.'); return; }
  const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a    = Object.assign(document.createElement('a'), {
    href:     URL.createObjectURL(blob),
    download: filename,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

// ============================================================
// AI CHAT
// ============================================================

function initChat() {
  const input   = document.getElementById('chatInput');
  const sendBtn = document.getElementById('btnSend');
  const clearBtn= document.getElementById('clearChat');

  const send = () => {
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    appendMsg('user', msg);
    STATE.chatHistory.push({ role: 'user', content: msg });
    handleAI(msg);
  };

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });

  clearBtn.addEventListener('click', () => {
    STATE.chatHistory = [];
    document.getElementById('chatBody').innerHTML = '';
    persist();
    appendAI('Chat dibersihkan. Siap membantu! 👋');
  });

  // Restore history
  STATE.chatHistory.forEach(m => appendMsg(m.role, m.content, false));

  if (!STATE.chatHistory.length) {
    appendAI(
      `Halo! Saya **Asisten AI Kasir** Anda 🤖\n\n` +
      `**Input Transaksi Cepat:**\n` +
      `• \`coba: NamaProduk Qty Harga\`\n` +
      `  contoh: \`coba: Kopi Susu 2 15000\`\n\n` +
      `**Perintah lainnya:**\n` +
      `• "produk terlaris hari ini"\n` +
      `• "rekap singkat"\n` +
      `• "pendapatan berapa"\n` +
      `• "tambah Mie Ayam 3 pcs 12000"\n\n` +
      `Mode: ${providerLabel()}`
    );
  }

  updateAIProviderLabel();
}

function providerLabel() {
  const p = STATE.settings.aiProvider;
  if (p === 'langflow') return `Langflow MCP (${STATE.settings.langflowUrl || 'belum diatur'})`;
  if (p === 'openai')   return 'OpenAI GPT-4o';
  return 'Demo Built-in';
}

function updateAIProviderLabel() {
  const el = document.getElementById('aiProviderLabel');
  if (el) el.textContent = providerLabel();
}

function appendMsg(role, text, scroll = true) {
  const box = document.getElementById('chatBody');
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.innerHTML = `
    <div class="msg-bubble">${role === 'ai' ? mdBold(text) : esc(text)}</div>
    <div class="msg-time">${fmtTime()}</div>
  `;
  box.appendChild(div);
  if (scroll) box.scrollTop = box.scrollHeight;
}

function appendAI(text, scroll = true) {
  const box = document.getElementById('chatBody');
  const div = document.createElement('div');
  div.className = 'msg ai';
  div.innerHTML = `
    <div class="msg-bubble">${mdBold(text)}</div>
    <div class="msg-time">${fmtTime()}</div>
  `;
  box.appendChild(div);
  if (scroll) box.scrollTop = box.scrollHeight;
}

function showTyping() {
  const box = document.getElementById('chatBody');
  const el  = document.createElement('div');
  el.id = 'typingEl';
  el.className = 'msg ai';
  el.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div>`;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
}

function hideTyping() {
  const el = document.getElementById('typingEl');
  if (el) el.remove();
}

/**
 * Detects shortcut format: "coba: NamaProduk Qty Harga"
 * e.g. "coba: Kopi Susu 2 15000"
 * Returns true if the message was handled (transaction saved), false otherwise.
 */
function tryShortcutTx(userMsg) {
  const match = userMsg.match(/^coba\s*:\s*(.+?)\s+(\d+)\s+(\d+)$/i);
  if (!match) return false;

  const [, product, qty, price] = match;
  const tx = addTx(product.trim(), parseInt(qty), parseInt(price));

  const reply =
    `✅ **Transaksi berhasil dicatat!**\n` +
    `• Produk: **${tx.product}**\n` +
    `• Qty: ${tx.qty} pcs\n` +
    `• Harga: ${fmt(tx.price)}/pcs\n` +
    `• Total: **${fmt(tx.total)}**`;

  appendAI(reply);
  STATE.chatHistory.push({ role: 'assistant', content: reply });
  persist();
  return true;
}

async function handleAI(userMsg) {
  // Handle shortcut input format: "coba: produk-qty-harga"
  if (tryShortcutTx(userMsg)) return;

  showTyping();

  const provider = STATE.settings.aiProvider;

  if (provider === 'langflow' && STATE.settings.langflowUrl) {
    await callLangflow(userMsg);
  } else if (provider === 'openai' && STATE.settings.apiKey) {
    await callOpenAI(userMsg);
  } else {
    // Demo mode with realistic delay
    await delay(500 + Math.random() * 700);
    hideTyping();
    const reply = demoReply(userMsg);
    appendAI(reply);
    STATE.chatHistory.push({ role: 'assistant', content: reply });
    persist();
  }
}

// ============================================================
// LANGFLOW MCP INTEGRATION
// ============================================================

/**
 * Calls a Langflow flow endpoint (MCP-style REST).
 *
 * Expected Langflow v1 API format:
 *   POST {endpoint}
 *   Body: { input_value: string, input_type: "chat", output_type: "chat", session_id: string }
 *   Auth: Authorization: Bearer {token}  (optional)
 *
 * The response shape varies by flow; we try common paths.
 */
async function callLangflow(userMsg) {
  const url   = (STATE.settings.langflowUrl   || LANGFLOW_DEFAULTS.url).trim();
  const token = (STATE.settings.langflowToken || LANGFLOW_DEFAULTS.token).trim();

  // Build context to inject into the prompt
  const context = buildContext();

  // Compose the input we send to Langflow
  const inputPayload = `[KASIR CONTEXT]\n${context}\n\n[USER]\n${userMsg}`;

  // Langflow native auth: x-api-key header
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key':    token,
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        input_value:  inputPayload,
        input_type:   'chat',
        output_type:  'chat',
        session_id:   'kasirAI-session',
        tweaks:       {},
      }),
    });

    if (!res.ok) throw new Error(`Langflow HTTP ${res.status}`);

    const data = await res.json();

    // Extract text dari berbagai format response Langflow v1
    const reply =
      data?.outputs?.[0]?.outputs?.[0]?.results?.message?.text     ??
      data?.outputs?.[0]?.outputs?.[0]?.artifacts?.message         ??
      data?.outputs?.[0]?.outputs?.[0]?.messages?.[0]?.message     ??
      data?.output                                                  ??
      data?.result                                                  ??
      data?.message                                                 ??
      JSON.stringify(data);

    hideTyping();
    appendAI(String(reply));
    STATE.chatHistory.push({ role: 'assistant', content: String(reply) });
    persist();

    // Check if Langflow returned an action command
    tryParseAction(String(reply));

  } catch (err) {
    hideTyping();
    appendAI(
      `❌ **Langflow tidak dapat dihubungi**\n${err.message}\n\n` +
      `Beralih ke mode demo…`
    );
    await delay(200);
    const fallback = demoReply(userMsg);
    appendAI(fallback);
  }
}

/**
 * Parse action JSON from Langflow/AI response, e.g.:
 * {"action":"add_transaction","product":"Print KRS","qty":3,"price":2000,"note":"atas nama Muna"}
 */
function tryParseAction(text) {
  const match = text.match(/\{[^{}]*"action"\s*:\s*"add_transaction"[^{}]*\}/);
  if (!match) return;
  try {
    const cmd = JSON.parse(match[0]);
    if (cmd.action === 'add_transaction' && cmd.product) {
      const tx = addTx(cmd.product, cmd.qty || 1, cmd.price || 0, cmd.note || '');
      appendAI(`✅ **Transaksi dicatat otomatis:** ${tx.product} × ${tx.qty} = **${fmt(tx.total)}**`);
    }
  } catch (_) {}
}

// ============================================================
// OPENAI INTEGRATION
// ============================================================

async function callOpenAI(userMsg) {
  const context = buildContext();
  const msgs = [
    { role: 'system', content: `Kamu adalah asisten AI kasir untuk toko "${STATE.settings.storeName}".\n\n${context}\n\nJawab dalam Bahasa Indonesia. Jika user meminta catat transaksi, sertakan JSON action: {"action":"add_transaction","product":"...","qty":N,"price":N,"note":"..."}` },
    ...STATE.chatHistory.slice(-10),
  ];

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${STATE.settings.apiKey}`,
      },
      body: JSON.stringify({ model: 'gpt-4o', messages: msgs, max_tokens: 600, temperature: 0.7 }),
    });

    if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
    const data  = await res.json();
    const reply = data.choices[0].message.content;

    hideTyping();
    appendAI(reply);
    STATE.chatHistory.push({ role: 'assistant', content: reply });
    persist();
    tryParseAction(reply);

  } catch (err) {
    hideTyping();
    appendAI(`❌ OpenAI error: ${err.message}\n\nBeralih ke mode demo…`);
    const fallback = demoReply(userMsg);
    appendAI(fallback);
  }
}

// ============================================================
// CONTEXT FOR AI PROVIDERS
// ============================================================

function buildContext() {
  const txs   = todayTx();
  const rev   = txs.reduce((s, t) => s + t.total, 0);
  const items = txs.reduce((s, t) => s + t.qty, 0);
  const top   = getTopProducts(3).map(p => `${p.name} (${p.qty} pcs, ${fmt(p.total)})`).join(', ');

  return [
    `Toko: ${STATE.settings.storeName}`,
    `Tanggal: ${today()}`,
    `Total transaksi hari ini: ${txs.length}`,
    `Pendapatan hari ini: ${fmt(rev)}`,
    `Item terjual: ${items} pcs`,
    `Margin laba: ${STATE.settings.profitMargin}%`,
    `Laba estimasi: ${fmt(rev * STATE.settings.profitMargin / 100)}`,
    `Produk terlaris: ${top || 'belum ada'}`,
  ].join('\n');
}

// ============================================================
// DEMO AI REPLIES
// ============================================================

function demoReply(msg) {
  const q    = msg.toLowerCase();
  const txs  = todayTx();
  const rev  = txs.reduce((s, t) => s + t.total, 0);
  const items= txs.reduce((s, t) => s + t.qty, 0);

  // --- Greeting ---
  if (/^(halo|hai|hi|hei|selamat)/i.test(q)) {
    return `Halo! Siap membantu kasir **${STATE.settings.storeName}** 🎯`;
  }

  // --- Terlaris ---
  if (q.includes('terlaris') || q.includes('best seller') || q.includes('paling laku')) {
    const top = getTopProducts(5);
    if (!top.length) return 'Belum ada data transaksi hari ini.';
    return '**Produk Terlaris Hari Ini:**\n' +
      top.map((p, i) => `${i + 1}. ${p.name} — ${p.qty} pcs (${fmt(p.total)})`).join('\n');
  }

  // --- Pendapatan ---
  if (q.includes('pendapatan') || q.includes('omzet') || q.includes('revenue') || q.includes('uang masuk')) {
    return `**Pendapatan Hari Ini**\nTotal: **${fmt(rev)}**\n${txs.length} transaksi, ${items} item\nLaba (${STATE.settings.profitMargin}%): **${fmt(rev * STATE.settings.profitMargin / 100)}**`;
  }

  // --- Rekap ---
  if (q.includes('rekap') || q.includes('ringkasan') || q.includes('summary') || q.includes('laporan')) {
    const top1 = getTopProducts(1)[0];
    return `**Rekap ${today()}**\n\n• Transaksi: ${txs.length}\n• Pendapatan: ${fmt(rev)}\n• Item terjual: ${items} pcs\n• Produk #1: ${top1 ? top1.name : '-'}\n• Laba est.: ${fmt(rev * STATE.settings.profitMargin / 100)}`;
  }

  // --- Transaksi count ---
  if ((q.includes('transaksi') || q.includes('order')) && (q.includes('berapa') || q.includes('jumlah'))) {
    return `Hari ini ada **${txs.length} transaksi** senilai **${fmt(rev)}**.`;
  }

  // --- Laba ---
  if (q.includes('laba') || q.includes('profit') || q.includes('untung')) {
    return `**Laba Bersih Estimasi Hari Ini**\nMargin: ${STATE.settings.profitMargin}%\nLaba: **${fmt(rev * STATE.settings.profitMargin / 100)}** dari pendapatan ${fmt(rev)}`;
  }

  // --- Pelanggan ---
  if (q.includes('pelanggan') || q.includes('customer') || q.includes('pembeli')) {
    const c = txs.length > 0 ? Math.max(1, Math.ceil(txs.length / 1.5)) : 0;
    return `Estimasi **${c} pelanggan** hari ini dari ${txs.length} transaksi.`;
  }

  // --- Ada yang beli lagi ---
  if (q.includes('beli lagi') || q.includes('pelanggan baru') || q.includes('ada yang')) {
    const last = txs[0];
    if (!last) return 'Belum ada transaksi hari ini.';
    return `Transaksi terakhir: **${last.product}** × ${last.qty} oleh kasir ${last.cashier} pada ${last.time}.`;
  }

  // --- Catat transaksi via chat ---
  // Pattern: "tambah [produk] [qty] [pcs/unit/lembar] [harga?] [atas nama?]"
  const printMatch = msg.match(
    /(?:print|cetak|catat|tambah|buat|order)\s+(.+?)\s+(\d+)\s+(?:lembar|pcs|buah|unit|bungkus|cup|gelas|porsi|eks?emplar)(?:\s+(?:harga\s+)?(\d+))?(?:\s+(?:atas\s+nama|an|nama)\s+(.+))?/i
  );
  if (printMatch) {
    const [, product, qty, price, nama] = printMatch;
    const note   = nama ? `atas nama ${nama}` : '';
    const harga  = price ? parseInt(price) : 0;
    const tx     = addTx(product.trim(), qty, harga, note);
    return `✅ **Transaksi dicatat:**\n• Produk: **${tx.product}**\n• Qty: ${tx.qty} pcs\n• Harga: ${fmt(tx.price)}/pcs\n• Total: **${fmt(tx.total)}**${tx.note ? `\n• Catatan: ${tx.note}` : ''}`;
  }

  // Pattern: "tambah kopi susu 2 pcs 20000"
  const addMatch = msg.match(/(?:tambah|add|catat|input)\s+(.+?)\s+(\d+)(?:\s+pcs?)?\s+(?:harga\s+)?(\d+)/i);
  if (addMatch) {
    const [, product, qty, price] = addMatch;
    const tx = addTx(product.trim(), qty, price);
    return `✅ **Dicatat:** ${tx.product} × ${tx.qty} = **${fmt(tx.total)}**`;
  }

  // --- Saran ---
  if (q.includes('saran') || q.includes('tips') || q.includes('rekomendasi')) {
    const tips = [
      'Tawarkan paket bundling untuk meningkatkan nilai per transaksi.',
      'Cek produk yang paling banyak ditanya tapi tidak tersedia — jadikan stok prioritas.',
      'Berikan diskon loyalitas untuk pelanggan yang sering berbelanja.',
      'Analisis jam puncak transaksi agar tenaga kasir bisa dioptimalkan.',
      'Gunakan fitur Google Sheet untuk menyinkronkan data dengan tim.',
    ];
    return `💡 **Tips untuk ${STATE.settings.storeName}:**\n\n${tips[Math.floor(Math.random() * tips.length)]}`;
  }

  // --- Langflow ---
  if (q.includes('langflow') || q.includes('mcp')) {
    const url = STATE.settings.langflowUrl || 'belum diatur';
    return `Integrasi Langflow MCP: **${url}**\n\nUntuk mengaktifkan, buka **Pengaturan → AI Provider → Langflow MCP** dan masukkan endpoint flow Anda.`;
  }

  // Default
  const d = [
    `Saya punya data **${txs.length} transaksi** hari ini senilai **${fmt(rev)}**. Mau tahu apa?`,
    `Toko **${STATE.settings.storeName}** sedang berjalan. Coba tanya "produk terlaris" atau "rekap hari ini".`,
    `Saya bisa membantu analisis penjualan, pencatatan transaksi cepat, atau rekap bulanan.`,
  ];
  return d[Math.floor(Math.random() * d.length)];
}

/**
 * Auto-comment when a transaction is added manually.
 */
function aiAutoComment(tx) {
  const txs = todayTx();
  const rev = txs.reduce((s, t) => s + t.total, 0);

  let msg = `✅ Dicatat: **${tx.product}** × ${tx.qty}` +
    (tx.note ? ` (${tx.note})` : '') +
    ` = **${fmt(tx.total)}**`;

  if (txs.length === 1) msg += `\n\nTransaksi pertama hari ini — semangat! 💪`;
  if (txs.length % 10 === 0) {
    msg += `\n\n🎉 **${txs.length} transaksi!** Total pendapatan hari ini: **${fmt(rev)}**`;
  }

  appendAI(msg);
  STATE.chatHistory.push({ role: 'assistant', content: msg });
  persist();
}

// ============================================================
// GOOGLE SHEET
// ============================================================

function initSpreadsheet() {
  document.getElementById('btnLoadSheet').addEventListener('click', loadSheet);
  document.getElementById('sheetSearch').addEventListener('input', e =>
    renderSheetTable(STATE.sheetData, e.target.value)
  );
  document.getElementById('exportCSV').addEventListener('click', () => {
    if (STATE.sheetData.length) {
      exportCSVData(STATE.sheetData, `sheet-${today()}.csv`);
    } else {
      alert('Muat sheet terlebih dahulu.');
    }
  });
}

function extractSheetId(url) {
  const m = url.match(/\/d\/([\w-]+)/);
  return m ? m[1] : null;
}

async function loadSheet() {
  const url    = document.getElementById('sheetUrl').value.trim();
  const status = document.getElementById('sheetStatus');

  if (!url) { status.textContent = '⚠ Masukkan URL terlebih dahulu.'; return; }

  const id = extractSheetId(url);
  if (!id) {
    status.textContent = '⚠ URL tidak valid. Format: https://docs.google.com/spreadsheets/d/ID/…';
    return;
  }

  status.textContent = '⏳ Memuat data dari Google Sheet…';
  document.getElementById('sheetTableWrap').innerHTML = '';

  const csvUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=0`;

  try {
    const res = await fetch(csvUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const csv = await res.text();
    STATE.sheetData = parseCSV(csv);
    renderSheetTable(STATE.sheetData, '');
    status.innerHTML = `<span style="color:#15803d">✔ Berhasil dimuat — ${STATE.sheetData.length - 1} baris</span>`;
  } catch (err) {
    status.innerHTML = `<span style="color:#dc2626">❌ Gagal: ${esc(err.message)}</span>`;
    document.getElementById('sheetTableWrap').innerHTML = `
      <div class="sheet-empty">
        <p>Tidak dapat memuat sheet. Pastikan:</p>
        <ul style="text-align:left;margin:8px 0 0 20px;font-size:12px;color:var(--muted)">
          <li>File → Bagikan → Siapa pun dengan tautan dapat melihat</li>
          <li>URL adalah Google Spreadsheet yang valid</li>
        </ul>
      </div>`;
  }
}

function parseCSV(text) {
  const rows = [];
  for (const line of text.split('\n')) {
    const cols = [];
    let cur = '', inQ = false;
    for (const c of line) {
      if (c === '"')       { inQ = !inQ; }
      else if (c === ',' && !inQ) { cols.push(cur); cur = ''; }
      else                 { cur += c; }
    }
    cols.push(cur.replace(/\r$/, ''));
    if (cols.length > 1 || cols[0].trim()) rows.push(cols);
  }
  return rows;
}

function renderSheetTable(rows, filter = '') {
  const wrap = document.getElementById('sheetTableWrap');
  if (!rows?.length) {
    wrap.innerHTML = '<div class="sheet-empty"><p>Sheet kosong.</p></div>';
    return;
  }

  const [headers, ...body] = rows;
  const filtered = filter
    ? body.filter(r => r.some(c => c.toLowerCase().includes(filter.toLowerCase())))
    : body;

  wrap.innerHTML = `
    <table>
      <thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${filtered.map(r =>
        `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`
      ).join('')}</tbody>
    </table>`;
}

// ============================================================
// RECAP — GMAIL
// ============================================================

function initRecap() {
  document.getElementById('recapMonth').value = today().slice(0, 7);

  document.getElementById('btnPreviewRecap').addEventListener('click', previewRecap);
  document.getElementById('btnSendRecap').addEventListener('click',    sendRecap);

  const autoChk = document.getElementById('autoRecap');
  autoChk.checked = STATE.autoRecap;
  autoChk.addEventListener('change', e => {
    STATE.autoRecap = e.target.checked;
    persist();
    updateAutoStatus();
    if (STATE.autoRecap) scheduleAutoRecap(); else cancelAutoRecap();
  });

  updateAutoStatus();
  if (STATE.autoRecap) scheduleAutoRecap();
}

function monthTx(monthStr) {
  return STATE.transactions.filter(tx => tx.date?.startsWith(monthStr));
}

function buildRecapText(monthStr) {
  const txs    = monthTx(monthStr);
  const rev    = txs.reduce((s, t) => s + t.total, 0);
  const items  = txs.reduce((s, t) => s + t.qty, 0);
  const profit = rev * (STATE.settings.profitMargin / 100);
  const custs  = Math.max(0, Math.ceil(txs.length / 1.5));

  const map = {};
  txs.forEach(tx => {
    if (!map[tx.product]) map[tx.product] = { qty: 0, total: 0 };
    map[tx.product].qty   += tx.qty;
    map[tx.product].total += tx.total;
  });

  const [yr, mo] = monthStr.split('-');
  const monthName = new Date(+yr, +mo - 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' });

  const lines = [
    `REKAP BULANAN — ${STATE.settings.storeName.toUpperCase()}`,
    `Periode : ${monthName}`,
    `Tanggal : ${new Date().toLocaleDateString('id-ID')}`,
    `${'═'.repeat(44)}`,
    ``,
    `RINGKASAN`,
    `  Total Transaksi   : ${txs.length}`,
    `  Total Pendapatan  : ${fmt(rev)}`,
    `  Total Item Terjual: ${items} pcs`,
    `  Est. Pelanggan    : ${custs}`,
    `  Laba Bersih (${STATE.settings.profitMargin}%): ${fmt(profit)}`,
    ``,
  ];

  const top = Object.entries(map).sort((a, b) => b[1].total - a[1].total).slice(0, 5);
  if (top.length) {
    lines.push('PRODUK TERLARIS');
    top.forEach(([name, d], i) => {
      lines.push(`  ${i + 1}. ${name.padEnd(24)} ${String(d.qty).padStart(3)} pcs   ${fmt(d.total)}`);
    });
    lines.push('');
  }

  lines.push(`${'═'.repeat(44)}`);
  lines.push(`Dikirim oleh KasirAI`);

  return lines.join('\n');
}

function previewRecap() {
  const month = document.getElementById('recapMonth').value;
  if (!month) { alert('Pilih bulan terlebih dahulu.'); return; }
  const text = buildRecapText(month);
  document.getElementById('recapPreview').textContent = text;
  const [yr, mo] = month.split('-');
  document.getElementById('previewPeriod').textContent =
    new Date(+yr, +mo - 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' });
}

function sendRecap() {
  const email   = document.getElementById('recapEmail').value.trim();
  const month   = document.getElementById('recapMonth').value;
  const subject = document.getElementById('recapSubject').value.trim() || 'Rekap Kasir Bulanan';

  if (!email) { alert('Masukkan email tujuan.'); document.getElementById('recapEmail').focus(); return; }
  if (!month) { alert('Pilih bulan rekap.'); return; }

  // Auto-preview before sending
  const body = buildRecapText(month);
  document.getElementById('recapPreview').textContent = body;

  const href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = href;
}

function scheduleAutoRecap() {
  cancelAutoRecap();
  STATE.autoRecapTimer = setInterval(() => {
    const d      = new Date();
    const lastDay= new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    if (d.getDate() === lastDay && d.getHours() === 8 && d.getMinutes() === 0) {
      const email = document.getElementById('recapEmail').value.trim();
      if (email) {
        sendRecap();
        updateAutoStatus(`Rekap otomatis terkirim: ${d.toLocaleString('id-ID')}`);
      }
    }
  }, 60_000);
}

function cancelAutoRecap() {
  if (STATE.autoRecapTimer) {
    clearInterval(STATE.autoRecapTimer);
    STATE.autoRecapTimer = null;
  }
}

function updateAutoStatus(msg) {
  const el = document.getElementById('autoStatus');
  if (!el) return;
  el.textContent = STATE.autoRecap
    ? (msg || '⏰ Aktif — rekap dikirim otomatis setiap akhir bulan pukul 08.00')
    : '';
}

// ============================================================
// SETTINGS
// ============================================================

function initSettings() {
  // Load into form
  setText2('cfgStoreName', STATE.settings.storeName);
  setText2('cfgCashier',   STATE.settings.cashierName);
  setText2('cfgMargin',    STATE.settings.profitMargin);
  setText2('cfgApiKey',    STATE.settings.apiKey);
  setText2('cfgLangflowUrl',   STATE.settings.langflowUrl);
  setText2('cfgLangflowToken', STATE.settings.langflowToken);

  const providerSel = document.getElementById('cfgAiProvider');
  if (providerSel) providerSel.value = STATE.settings.aiProvider;
  toggleProviderRows(STATE.settings.aiProvider);

  providerSel?.addEventListener('change', e => toggleProviderRows(e.target.value));

  document.getElementById('btnSaveSettings').addEventListener('click', () => {
    STATE.settings.storeName     = val('cfgStoreName') || 'Toko Saya';
    STATE.settings.cashierName   = val('cfgCashier')   || 'Admin';
    STATE.settings.profitMargin  = Number(val('cfgMargin'))  || 30;
    STATE.settings.aiProvider    = val('cfgAiProvider') || 'langflow';
    STATE.settings.apiKey        = val('cfgApiKey');
    STATE.settings.langflowUrl   = val('cfgLangflowUrl')   || LANGFLOW_DEFAULTS.url;
    STATE.settings.langflowToken = val('cfgLangflowToken') || LANGFLOW_DEFAULTS.token;
    persist();
    updateKPIs();
    updateAIProviderLabel();

    const toast = document.getElementById('saveToast');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  });
}

function toggleProviderRows(provider) {
  const lf = document.getElementById('cfgLangflowRow');
  const oa = document.getElementById('cfgOpenAiRow');
  const lt = document.getElementById('cfgLangflowTokenRow');
  if (lf) lf.style.display = provider === 'langflow' ? 'flex' : 'none';
  if (lt) lt.style.display = provider === 'langflow' ? 'flex' : 'none';
  if (oa) oa.style.display = provider === 'openai'   ? 'flex' : 'none';
}

function setText2(id, v) {
  const el = document.getElementById(id);
  if (el) el.value = v;
}

function val(id) {
  return (document.getElementById(id)?.value ?? '').trim();
}

// ============================================================
// OFFLINE / ONLINE
// ============================================================

function initNetworkStatus() {
  const banner = document.getElementById('offlineBanner');
  const dot    = document.getElementById('connDot');
  const label  = document.getElementById('connLabel');

  const update = () => {
    STATE.isOnline = navigator.onLine;
    if (!STATE.isOnline) {
      banner.classList.add('visible');
      dot.classList.add('offline');
      if (label) label.textContent = 'Offline';
    } else {
      banner.classList.remove('visible');
      dot.classList.remove('offline');
      if (label) label.textContent = 'Online';
    }
  };

  window.addEventListener('online',  update);
  window.addEventListener('offline', update);
  update();
}

// ============================================================
// LANGFLOW MCP STATUS CHECK
// ============================================================

async function checkLangflowStatus() {
  const badge = document.getElementById('langflowBadge');
  if (!badge) return;

  if (STATE.settings.aiProvider !== 'langflow') return;

  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 3000);
    // Langflow health endpoint
    await fetch('http://localhost:7860/health', {
      method: 'GET',
      signal: controller.signal,
    });
    badge.classList.add('connected');
    badge.title = 'Langflow terhubung ✅';
  } catch (_) {
    badge.classList.remove('connected');
    badge.title = 'Langflow tidak dapat dijangkau';
  }
}

// ============================================================
// HELPER
// ============================================================

const delay = ms => new Promise(r => setTimeout(r, ms));

// ============================================================
// BOOT
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  hydrate();
  initNav();
  initModal();
  initSearch();
  initChat();
  initSpreadsheet();
  initRecap();
  initSettings();
  initNetworkStatus();

  // Initial render
  renderTxTable();
  updateKPIs();
  tickDate();

  // Tick date every minute
  setInterval(tickDate, 60_000);

  // Check Langflow every 30s
  checkLangflowStatus();
  setInterval(checkLangflowStatus, 30_000);
});
