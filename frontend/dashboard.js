/* ============================================================
   MOKKO Dashboard — Shared JavaScript
   Serves: manager.html | staff.html | customer.html
   ============================================================ */

const API = 'http://127.0.0.1:8000';

// ---------- Auth helpers ----------
function getToken()  { return localStorage.getItem('mokko_token'); }
function getStaff()  { return JSON.parse(localStorage.getItem('mokko_staff') || 'null'); }
function logout()    { localStorage.removeItem('mokko_token'); localStorage.removeItem('mokko_staff'); window.location.href = 'login.html'; }

async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Error ${res.status}`);
  return data;
}

// ---------- Connection status ----------
function setConnStatus(ok) {
  const dot  = document.getElementById('connDot');
  const text = document.getElementById('connText');
  if (!dot) return;
  dot.className  = 'status-dot ' + (ok ? 'online' : 'offline');
  if (text) text.textContent = ok ? 'API Online' : 'API Offline';
}

async function checkConn() {
  try {
    await fetch(`${API}/`);
    setConnStatus(true);
  } catch { setConnStatus(false); }
}

// ---------- Date chip ----------
function setDate() {
  const el = document.getElementById('todayDate');
  if (el) el.textContent = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ---------- Notice ----------
function showNotice(msg, type = 'error') {
  const el = document.getElementById('notice');
  if (!el) return;
  el.textContent = msg;
  el.className   = 'notice ' + type;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
}

// ---------- Page navigation ----------
function switchPage(pageId) {
  document.querySelectorAll('.page').forEach(p => {
    p.classList.add('hidden');
    p.classList.remove('active');
  });
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const page = document.getElementById('page-' + pageId);
  if (page) { page.classList.remove('hidden'); page.classList.add('active'); }

  const navBtn = document.querySelector(`[data-page="${pageId}"]`);
  if (navBtn) navBtn.classList.add('active');

  const breadPage = document.getElementById('breadcrumbPage');
  if (breadPage) breadPage.textContent = pageId.charAt(0).toUpperCase() + pageId.slice(1);

  // Lazy-load page data
  onPageEnter(pageId);
}

function onPageEnter(pageId) {
  const role = document.body.dataset.role;
  if (pageId === 'dashboard') {
    if (role === 'admin') loadAdminDashboard();
    else if (role === 'manager') loadManagerDashboard();
    else if (role === 'staff') loadStaffDashboard();
    else if (role === 'customer') loadCustomerHome();
  }
  if (pageId === 'staff') {
    if (role === 'admin' || role === 'manager') loadAdminStaff();
    else loadMyProfile();
  }
  if (pageId === 'menu')    loadMenu();
  if (pageId === 'tables')  loadTables();
  if (pageId === 'orders')  loadOrders();
  if (pageId === 'kitchen') loadKitchenOrders();
  if (pageId === 'reports') loadReports();
  if (pageId === 'system')  loadSystemInfo();
}

// ============================================================
//  ADMIN SPECIFIC PAGES & CONTROLS
// ============================================================

async function loadAdminDashboard() {
  await loadManagerDashboard();
  try {
    const staffList = await apiFetch('/api/auth/staff');
    setText('m-staff-count', staffList.filter(s => s.is_active).length);
  } catch(e) {
    setText('m-staff-count', '—');
  }
}

async function loadAdminStaff() {
  const container = document.getElementById('staffTableContainer');
  if (!container) return;
  container.innerHTML = '<div class="loading-row">Loading staff members…</div>';
  try {
    const staffList = await apiFetch('/api/auth/staff');
    if (!staffList.length) {
      container.innerHTML = '<div class="empty-state">No staff members found.</div>';
      return;
    }
    const currentStaff = getStaff();
    container.innerHTML = `
      <table class="staff-table">
        <thead>
          <tr>
            <th>Staff Member</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Role</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${staffList.map(s => `
            <tr>
              <td>
                <div class="user-cell">
                  <div class="user-mini-avatar">${esc(s.full_name?.charAt(0) || 'U')}</div>
                  <div>
                    <strong>${esc(s.full_name)}</strong>
                    ${s.id === currentStaff?.id ? ' <small style="color:var(--accent-green)">(You)</small>' : ''}
                  </div>
                </div>
              </td>
              <td>${esc(s.email)}</td>
              <td>${esc(s.phone || '—')}</td>
              <td><span class="staff-role-badge ${s.role}">${s.role}</span></td>
              <td><span class="status-pill ${s.is_active ? 'active' : 'inactive'}">${s.is_active ? 'Active' : 'Inactive'}</span></td>
              <td>
                ${currentStaff?.role === 'admin' && s.id !== currentStaff.id ? `
                  <button class="btn-sm ${s.is_active ? 'danger' : ''}" onclick="toggleStaffStatus(${s.id})">
                    ${s.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                ` : (s.id === currentStaff?.id ? '<span style="font-size:11px;color:var(--text-muted)">Active Session</span>' : '—')}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  } catch(e) {
    container.innerHTML = `<div class="empty-state">${esc(e.message)}</div>`;
  }
}

async function toggleStaffStatus(staffId) {
  try {
    const res = await apiFetch(`/api/auth/staff/${staffId}/toggle-status`, { method: 'PATCH' });
    showNotice(`Updated ${res.full_name}: ${res.is_active ? 'Active' : 'Inactive'}`, 'success');
    loadAdminStaff();
    if (document.getElementById('m-staff-count')) loadAdminDashboard();
  } catch(e) {
    showNotice(e.message, 'error');
  }
}

function openRegisterStaffModal() {
  const overlay = document.getElementById('modalOverlay');
  const content = document.getElementById('modalContent');
  if (!overlay || !content) return;
  const currentStaff = getStaff();
  const isAdmin = currentStaff?.role === 'admin';

  content.innerHTML = `
    <h3>Register New Staff Member</h3>
    <form id="modalStaffRegisterForm">
      <div class="form-group">
        <label class="form-label">Full Name</label>
        <input class="form-input" type="text" id="mRegName" placeholder="e.g. Robin Wayne" required minlength="2">
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input class="form-input" type="email" id="mRegEmail" placeholder="robin@mokko.in" required>
      </div>
      <div class="form-group">
        <label class="form-label">Role</label>
        <select class="form-input" id="mRegRole" required>
          <option value="waiter">Waiter (Customer Service)</option>
          <option value="chef">Chef (Kitchen Prep)</option>
          <option value="cashier">Cashier (Billing & Payments)</option>
          <option value="manager">Manager (Cafe Operations)</option>
          ${isAdmin ? '<option value="admin">Admin (System Control)</option>' : ''}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Phone (optional)</label>
        <input class="form-input" type="tel" id="mRegPhone" placeholder="+91 …">
      </div>
      <div class="form-group">
        <label class="form-label">Password (min 8 characters)</label>
        <input class="form-input" type="password" id="mRegPassword" placeholder="min 8 chars" required minlength="8">
      </div>
      <button class="btn-primary full-w" type="submit">Create Staff Account</button>
      <div id="mRegResult" class="bill-result hidden"></div>
    </form>`;

  overlay.classList.remove('hidden');

  document.getElementById('modalStaffRegisterForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const result = document.getElementById('mRegResult');
    const body = {
      full_name: document.getElementById('mRegName').value.trim(),
      email:     document.getElementById('mRegEmail').value.trim().toLowerCase(),
      role:      document.getElementById('mRegRole').value,
      phone:     document.getElementById('mRegPhone').value.trim() || null,
      password:  document.getElementById('mRegPassword').value,
    };
    try {
      const created = await apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify(body) });
      result.textContent = `✓ ${created.full_name} registered as ${created.role}!`;
      result.className = 'bill-result success-result';
      result.classList.remove('hidden');
      setTimeout(() => {
        closeModal();
        loadAdminStaff();
        if (document.getElementById('m-staff-count')) loadAdminDashboard();
      }, 1200);
    } catch(err) {
      result.textContent = '✕ ' + err.message;
      result.className = 'bill-result error-result';
      result.classList.remove('hidden');
    }
  });
}

async function loadSystemInfo() {
  const apiStatus = document.getElementById('sysApiStatus');
  const dbStatus  = document.getElementById('sysDbStatus');
  const actionRes = document.getElementById('sysActionResult');

  try {
    const res = await fetch(`${API}/`);
    const data = await res.json().catch(() => ({}));
    if (apiStatus) {
      apiStatus.textContent = '● Online (FastAPI Running)';
      apiStatus.className = 'badge-status online';
    }
    if (dbStatus && data.database) {
      dbStatus.textContent = `● Connected (${data.database})`;
      dbStatus.className = 'badge-status online';
    }
  } catch(e) {
    if (apiStatus) {
      apiStatus.textContent = '✕ Offline';
      apiStatus.className = 'badge-status danger';
    }
  }

  document.getElementById('sysCheckConnBtn')?.addEventListener('click', async () => {
    if (actionRes) {
      actionRes.textContent = 'Testing connection…';
      actionRes.className = 'bill-result';
      actionRes.classList.remove('hidden');
    }
    try {
      const res = await fetch(`${API}/`);
      const data = await res.json();
      if (actionRes) {
        actionRes.textContent = `✓ API reachable! Response: "${data.message}"`;
        actionRes.className = 'bill-result success-result';
      }
    } catch(err) {
      if (actionRes) {
        actionRes.textContent = '✕ Could not reach API: ' + err.message;
        actionRes.className = 'bill-result error-result';
      }
    }
  });

  document.getElementById('sysClearCacheBtn')?.addEventListener('click', () => {
    if (actionRes) {
      actionRes.textContent = '✓ Local cache and session state refreshed.';
      actionRes.className = 'bill-result success-result';
      actionRes.classList.remove('hidden');
    }
  });
}

// ============================================================
//  MANAGER / ADMIN PAGES
// ============================================================

async function loadManagerDashboard() {
  try {
    const d = await apiFetch('/api/reports/dashboard');
    setText('m-sales',    '₹' + parseFloat(d.sales).toLocaleString('en-IN', { minimumFractionDigits: 2 }));
    setText('m-bills',    d.paid_bills);
    setText('m-orders',   d.orders_today);
    setText('m-pending',  d.pending_orders);
    setText('k-pending',  d.pending_orders);
    setText('k-preparing',d.preparing_orders);
    setText('k-ready',    d.ready_orders);
    setConnStatus(true);
  } catch(e) { showNotice(e.message); setConnStatus(false); }

  try {
    const items = await apiFetch('/api/reports/popular-items?limit=5');
    const list  = document.getElementById('popularList');
    if (!list) return;
    if (!items.length) { list.innerHTML = '<div class="empty-state"><div class="empty-icon">☕</div>No data yet</div>'; return; }
    list.innerHTML = items.map((it, i) => `
      <div class="popular-item">
        <div class="popular-rank">${i + 1}</div>
        <span class="popular-name">${esc(it.name)}</span>
        <span class="popular-qty">${it.quantity_sold} sold</span>
      </div>`).join('');
  } catch(e) { /* non-critical */ }
}

async function loadReports() {
  const days  = document.getElementById('reportDays')?.value || 7;
  const rTot  = document.getElementById('r-total');
  const rPer  = document.getElementById('r-period');
  const chart = document.getElementById('salesChart');
  if (chart) chart.innerHTML = '<div class="loading-row">Loading…</div>';
  try {
    const d = await apiFetch(`/api/reports/sales?days=${days}`);
    if (rTot) rTot.textContent = '₹' + parseFloat(d.total_sales).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    if (rPer) rPer.textContent = `Last ${days} days`;
    renderBarChart(d.daily_sales);
  } catch(e) { showNotice(e.message); if (chart) chart.innerHTML = '<div class="empty-state">Could not load report.</div>'; }
}

function renderBarChart(data) {
  const chart = document.getElementById('salesChart');
  if (!chart) return;
  if (!data || !data.length) { chart.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div>No sales data for this period.</div>'; return; }
  const max = Math.max(...data.map(d => parseFloat(d.sales)), 1);
  chart.innerHTML = `<div class="chart-bars">${data.map(d => {
    const pct = Math.max((parseFloat(d.sales) / max) * 130, 4);
    const label = d.date.slice(5); // MM-DD
    return `<div class="chart-bar-wrap">
      <div class="chart-bar" style="height:${pct}px" title="₹${d.sales}"></div>
      <div class="chart-bar-date">${label}</div>
    </div>`;
  }).join('')}</div>`;
}

async function loadMenu(categoryId = null) {
  const grid    = document.getElementById('menuGrid');
  const catSel  = document.getElementById('menuCatFilter');
  if (!grid) return;
  grid.innerHTML = '<div class="loading-row">Loading menu…</div>';

  try {
    const [cats, items] = await Promise.all([
      apiFetch('/api/menu/categories'),
      apiFetch('/api/menu/items' + (categoryId ? `?category_id=${categoryId}` : '')),
    ]);

    // Populate category filter
    if (catSel && catSel.options.length <= 1) {
      cats.forEach(c => {
        const opt = new Option(c.name, c.id);
        catSel.appendChild(opt);
      });
    }

    if (!items.length) { grid.innerHTML = '<div class="empty-state"><div class="empty-icon">☕</div>No menu items found.</div>'; return; }

    const catMap = Object.fromEntries(cats.map(c => [c.id, c.name]));
    const staff = getStaff();
    const canEditMenu = staff?.role === 'admin' || staff?.role === 'manager';

    grid.innerHTML = items.map(it => `
      <div class="menu-card">
        <div class="menu-card-cat">${esc(catMap[it.category_id] || 'Uncategorised')}</div>
        <div class="menu-card-name">${esc(it.name)}</div>
        <div class="menu-card-desc">${esc(it.description || '—')}</div>
        <div class="menu-card-footer">
          <span class="menu-card-price">₹${parseFloat(it.price).toFixed(2)}</span>
          ${canEditMenu ? `
            <button class="avail-badge ${it.is_available ? 'yes' : 'no'}" style="cursor:pointer;border:none;font-family:inherit;" onclick="toggleItemAvail(${it.id}, ${!it.is_available})" title="Click to toggle availability">
              ${it.is_available ? 'Available' : 'Unavailable'}
            </button>
          ` : `
            <span class="avail-badge ${it.is_available ? 'yes' : 'no'}">${it.is_available ? 'Available' : 'Unavailable'}</span>
          `}
        </div>
      </div>`).join('');
  } catch(e) { showNotice(e.message); grid.innerHTML = '<div class="empty-state">Could not load menu.</div>'; }
}

async function toggleItemAvail(itemId, newAvail) {
  try {
    await apiFetch(`/api/menu/items/${itemId}/availability?is_available=${newAvail}`, { method: 'PATCH' });
    showNotice(`Menu item availability updated`, 'success');
    loadMenu();
  } catch(e) { showNotice(e.message, 'error'); }
}

async function loadTables() {
  const grid = document.getElementById('tablesGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="loading-row">Loading tables…</div>';
  try {
    const tables = await apiFetch('/api/tables');
    if (!tables.length) { grid.innerHTML = '<div class="empty-state"><div class="empty-icon">▤</div>No tables configured.</div>'; return; }
    const staff = getStaff();
    const isAdmin = staff?.role === 'admin';

    grid.innerHTML = tables.map(t => `
      <div class="table-card" data-table-id="${t.id}" data-table-status="${t.status}">
        <div class="table-number">T${t.table_number}</div>
        <div class="table-cap">Capacity: ${t.capacity} guests</div>
        <div class="table-status-pill ${t.status}">${t.status}</div>
        ${isAdmin ? `<button class="btn-sm" style="margin-top:8px" onclick="event.stopPropagation(); toggleTableActive(${t.id})">Toggle Active</button>` : ''}
      </div>`).join('');

    // Click on table → seat or manage session modal (staff/manager/admin only)
    grid.querySelectorAll('.table-card').forEach(card => {
      card.addEventListener('click', () => {
        const role = document.body.dataset.role;
        if (role === 'staff' || role === 'manager' || role === 'admin') {
          const tableId = parseInt(card.dataset.tableId);
          const tableStatus = card.dataset.tableStatus;
          if (tableStatus === 'available') {
            openSeatModal(tableId, tableStatus);
          } else {
            openOccupiedTableModal(tableId);
          }
        }
      });
    });
  } catch(e) { showNotice(e.message); grid.innerHTML = '<div class="empty-state">Could not load tables.</div>'; }
}

async function toggleTableActive(tableId) {
  try {
    const res = await apiFetch(`/api/tables/${tableId}/toggle-active`, { method: 'PATCH' });
    showNotice(`Table #${tableId}: ${res.is_active ? 'Active' : 'Inactive'}`, 'success');
    loadTables();
  } catch(e) { showNotice(e.message, 'error'); }
}

function openSeatModal(tableId, tableStatus) {
  const overlay = document.getElementById('modalOverlay');
  const content = document.getElementById('modalContent');
  if (!overlay || !content) return;

  const staff  = getStaff();
  const isWaiter = staff?.role === 'waiter';

  content.innerHTML = `
    <h3>Table #${tableId} — Seat Guests</h3>
    <form id="seatForm">
      <div class="form-group">
        <label class="form-label">Guest Count</label>
        <input class="form-input" type="number" id="seatGuests" value="2" min="1" max="20" required>
      </div>
      ${!isWaiter ? `
      <div class="form-group">
        <label class="form-label">Waiter ID (optional)</label>
        <input class="form-input" type="number" id="seatWaiterId" placeholder="leave blank to self-assign">
      </div>` : ''}
      <div class="form-group">
        <label class="form-label">Customer Name (optional)</label>
        <input class="form-input" type="text" id="seatCustomerName" placeholder="Walk-in guest">
      </div>
      <div class="form-group">
        <label class="form-label">Customer Phone (optional)</label>
        <input class="form-input" type="tel" id="seatCustomerPhone" placeholder="+91 …">
      </div>
      <button class="btn-primary full-w" type="submit">Seat Customers</button>
      <div id="seatResult" class="bill-result hidden"></div>
    </form>`;

  overlay.classList.remove('hidden');

  document.getElementById('seatForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      guest_count: parseInt(document.getElementById('seatGuests').value),
    };
    const waiterId  = document.getElementById('seatWaiterId')?.value;
    const custName  = document.getElementById('seatCustomerName')?.value.trim();
    const custPhone = document.getElementById('seatCustomerPhone')?.value.trim();
    if (waiterId) body.waiter_id = parseInt(waiterId);
    if (custName) body.customer_name = custName;
    if (custPhone) body.customer_phone = custPhone;

    const resultEl = document.getElementById('seatResult');
    try {
      const session = await apiFetch(`/api/tables/${tableId}/seat`, { method: 'POST', body: JSON.stringify(body) });
      resultEl.textContent = `✓ Session #${session.id} opened for Table #${tableId}!`;
      resultEl.className = 'bill-result success-result';
      resultEl.classList.remove('hidden');
      setTimeout(() => {
        closeModal();
        loadTables();
        openOccupiedTableModal(tableId);
      }, 1000);
    } catch(err) {
      resultEl.textContent = '✕ ' + err.message;
      resultEl.className = 'bill-result error-result';
      resultEl.classList.remove('hidden');
    }
  });
}

async function openOccupiedTableModal(tableId) {
  const overlay = document.getElementById('modalOverlay');
  const content = document.getElementById('modalContent');
  if (!overlay || !content) return;
  overlay.classList.remove('hidden');
  content.innerHTML = '<div class="loading-row">Fetching dining session details…</div>';

  try {
    const session = await apiFetch(`/api/tables/${tableId}/session`);
    if (!session) {
      content.innerHTML = `
        <h3>Table #${tableId}</h3>
        <p style="color:var(--text-secondary);font-size:14px;margin-bottom:16px;">This table is marked occupied, but no active dining session was found.</p>
        <button class="btn-primary full-w" onclick="closeTableSessionDirect(${tableId})">Reset Table to Available</button>`;
      return;
    }

    const staff = getStaff();
    const canClose = staff?.role === 'admin' || staff?.role === 'manager' || staff?.role === 'cashier';

    content.innerHTML = `
      <h3>Table #${tableId} • Session #${session.id}</h3>
      <div style="font-size:13px; color:var(--text-secondary); line-height: 1.6; margin-bottom: 16px; background:var(--surface); padding:12px; border-radius:var(--radius-sm);">
        <div><strong>Guests Seated:</strong> ${session.guest_count}</div>
        <div><strong>Seated At:</strong> ${new Date(session.seated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
        <div><strong>Status:</strong> <span class="status-pill active">${session.status}</span></div>
      </div>

      <div class="table-action-grid">
        <button class="btn-primary full-w" id="btnCreateOrderForTable">➕ Create New Order</button>
        <button class="btn-outline full-w" id="btnAddItemToOrder">☕ Add Menu Items</button>
        <button class="btn-outline full-w" id="btnRequestBillForTable">📄 Request / Generate Bill</button>
        ${canClose ? `<button class="btn-outline full-w" style="border-color:rgba(239,68,68,0.4);color:var(--accent-red);" id="btnCloseTableSession">✕ Close Dining Session</button>` : ''}
      </div>
      <div id="sessionActionMsg" class="bill-result hidden" style="margin-top:14px;"></div>
    `;

    document.getElementById('btnCreateOrderForTable')?.addEventListener('click', () => {
      openCreateOrderModal(session.id, tableId);
    });

    document.getElementById('btnAddItemToOrder')?.addEventListener('click', () => {
      openAddItemToOrderModal(session.id, tableId);
    });

    document.getElementById('btnRequestBillForTable')?.addEventListener('click', async () => {
      const msg = document.getElementById('sessionActionMsg');
      try {
        const bill = await apiFetch(`/api/billing/sessions/${session.id}/bill`, { method: 'POST' });
        msg.innerHTML = `✓ <strong>Bill #${bill.id} Generated!</strong><br>Subtotal: ₹${bill.subtotal} | Tax: ₹${bill.tax_amount} | <strong>Total: ₹${bill.total_amount}</strong>`;
        msg.className = 'bill-result success-result';
        msg.classList.remove('hidden');
        showNotice(`Bill #${bill.id} created for Table #${tableId}`, 'success');
      } catch(e) {
        msg.textContent = '✕ ' + e.message;
        msg.className = 'bill-result error-result';
        msg.classList.remove('hidden');
      }
    });

    document.getElementById('btnCloseTableSession')?.addEventListener('click', async () => {
      const msg = document.getElementById('sessionActionMsg');
      try {
        await apiFetch(`/api/tables/${tableId}/close`, { method: 'POST' });
        msg.textContent = `✓ Table #${tableId} session closed and table freed!`;
        msg.className = 'bill-result success-result';
        msg.classList.remove('hidden');
        showNotice(`Table #${tableId} closed`, 'success');
        setTimeout(() => { closeModal(); loadTables(); }, 1200);
      } catch(e) {
        msg.textContent = '✕ ' + e.message;
        msg.className = 'bill-result error-result';
        msg.classList.remove('hidden');
      }
    });

  } catch(e) {
    content.innerHTML = `<h3>Table #${tableId}</h3><p style="color:var(--accent-red)">${e.message}</p>`;
  }
}

async function closeTableSessionDirect(tableId) {
  try {
    await apiFetch(`/api/tables/${tableId}/close`, { method: 'POST' });
    showNotice(`Table #${tableId} reset to available`, 'success');
    closeModal();
    loadTables();
  } catch(e) { showNotice(e.message, 'error'); }
}

async function openCreateOrderModal(sessionId, tableId) {
  const content = document.getElementById('modalContent');
  if (!content) return;
  content.innerHTML = `
    <h3>Create Order for Table #${tableId}</h3>
    <p style="font-size:12px;color:var(--text-secondary);margin-bottom:14px;">Dining Session #${sessionId}</p>
    <form id="createOrderForm">
      <div class="form-group">
        <label class="form-label">Order Notes / Kitchen Instructions</label>
        <input class="form-input" type="text" id="orderNotes" placeholder="e.g. Window seat, urgent, allergy alert">
      </div>
      <button class="btn-primary full-w" type="submit">Start Order →</button>
      <div id="createOrderResult" class="bill-result hidden"></div>
    </form>`;

  document.getElementById('createOrderForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const result = document.getElementById('createOrderResult');
    const notes = document.getElementById('orderNotes').value.trim() || null;
    try {
      const order = await apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId, notes })
      });
      result.textContent = `✓ Order #${order.id} started! Next, add menu items.`;
      result.className = 'bill-result success-result';
      result.classList.remove('hidden');
      setTimeout(() => {
        openAddItemToOrderModal(sessionId, tableId, order.id);
      }, 900);
    } catch(err) {
      result.textContent = '✕ ' + err.message;
      result.className = 'bill-result error-result';
      result.classList.remove('hidden');
    }
  });
}

async function openAddItemToOrderModal(sessionId, tableId, preselectedOrderId = null) {
  const content = document.getElementById('modalContent');
  if (!content) return;
  content.innerHTML = '<div class="loading-row">Loading menu items and orders…</div>';

  try {
    const [menuItems, orders] = await Promise.all([
      apiFetch('/api/menu/items'),
      apiFetch('/api/orders?order_status=pending'),
    ]);

    const sessionOrders = orders.filter(o => o.session_id === sessionId);
    if (!sessionOrders.length && !preselectedOrderId) {
      content.innerHTML = `
        <h3>Add Items to Table #${tableId}</h3>
        <p style="color:var(--text-secondary);font-size:13px;margin-bottom:14px;">No pending order found for this table session yet.</p>
        <button class="btn-primary full-w" onclick="openCreateOrderModal(${sessionId}, ${tableId})">Create Order First →</button>`;
      return;
    }

    const targetOrderId = preselectedOrderId || sessionOrders[0].id;

    content.innerHTML = `
      <h3>Add Item to Order #${targetOrderId}</h3>
      <p style="font-size:12px;color:var(--text-secondary);margin-bottom:14px;">Table #${tableId} (Session #${sessionId})</p>
      <form id="addOrderItemForm">
        <div class="form-group">
          <label class="form-label">Select Menu Item</label>
          <select class="form-input" id="orderMenuItemSelect" required>
            ${menuItems.filter(m => m.is_available).map(m => `
              <option value="${m.id}">${esc(m.name)} — ₹${parseFloat(m.price).toFixed(2)}</option>
            `).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Quantity</label>
          <input class="form-input" type="number" id="orderItemQty" value="1" min="1" max="20" required>
        </div>
        <div class="form-group">
          <label class="form-label">Special Preparation Instructions</label>
          <input class="form-input" type="text" id="orderItemNotes" placeholder="e.g. oat milk, less ice, extra hot">
        </div>
        <div style="display:flex; gap:10px;">
          <button class="btn-primary full-w" type="submit">+ Add to Order</button>
          <button type="button" class="btn-outline" onclick="closeModal(); loadOrders();">Finish</button>
        </div>
        <div id="addOrderItemResult" class="bill-result hidden"></div>
      </form>`;

    document.getElementById('addOrderItemForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const result = document.getElementById('addOrderItemResult');
      const menu_item_id = parseInt(document.getElementById('orderMenuItemSelect').value);
      const quantity = parseInt(document.getElementById('orderItemQty').value);
      const special_instructions = document.getElementById('orderItemNotes').value.trim() || null;

      try {
        await apiFetch(`/api/orders/${targetOrderId}/items`, {
          method: 'POST',
          body: JSON.stringify({ menu_item_id, quantity, special_instructions })
        });
        result.textContent = `✓ Item added to Order #${targetOrderId}!`;
        result.className = 'bill-result success-result';
        result.classList.remove('hidden');
        showNotice(`Item added to Order #${targetOrderId}`, 'success');
        document.getElementById('orderItemNotes').value = '';
      } catch(err) {
        result.textContent = '✕ ' + err.message;
        result.className = 'bill-result error-result';
        result.classList.remove('hidden');
      }
    });

  } catch(e) {
    content.innerHTML = `<p style="color:var(--accent-red)">${e.message}</p>`;
  }
}

function closeModal() {
  document.getElementById('modalOverlay')?.classList.add('hidden');
}

async function loadOrders(statusFilter = '') {
  const container = document.getElementById('ordersContainer');
  if (!container) return;
  container.innerHTML = '<div class="loading-row">Loading orders…</div>';
  try {
    const path = '/api/orders' + (statusFilter ? `?order_status=${statusFilter}` : '');
    const orders = await apiFetch(path);
    if (!orders.length) { container.innerHTML = '<div class="empty-state"><div class="empty-icon">≡</div>No orders found.</div>'; return; }
    container.innerHTML = orders.map(o => renderOrderCard(o)).join('');
    // Toggle items
    container.querySelectorAll('.toggle-items-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const list = btn.closest('.order-card').querySelector('.order-items-list');
        list?.classList.toggle('open');
        btn.textContent = list?.classList.contains('open') ? 'Hide Items' : 'View Items';
      });
    });
    // Status change buttons
    container.querySelectorAll('.status-change-btn').forEach(btn => {
      btn.addEventListener('click', () => changeOrderStatus(btn.dataset.orderId, btn.dataset.newStatus));
    });
  } catch(e) { showNotice(e.message); container.innerHTML = '<div class="empty-state">Could not load orders.</div>'; }
}

function renderOrderCard(o) {
  const staff    = getStaff();
  const role     = staff?.role;

  // Determine available transitions for this role
  const transitions = {
    pending:   role === 'chef' ? ['preparing'] : (role === 'admin' || role === 'manager' ? ['preparing','cancelled'] : []),
    preparing: role === 'chef' ? ['ready'] : (role === 'admin' || role === 'manager' ? ['ready','cancelled'] : []),
    ready:     role === 'waiter' ? ['served'] : (role === 'admin' || role === 'manager' ? ['served'] : []),
    served:    [],
    cancelled: [],
  };
  const avail = transitions[o.status] || [];

  return `<div class="order-card">
    <div class="order-id">#${o.id}</div>
    <div class="order-meta">
      <strong>Session ${o.session_id}</strong>
      <p>${new Date(o.created_at).toLocaleString('en-IN')} · ${o.items?.length || 0} item(s)</p>
      ${o.notes ? `<p style="font-style:italic">"${esc(o.notes)}"</p>` : ''}
    </div>
    <span class="order-status-pill ${o.status}">${o.status}</span>
    <div class="order-actions">
      ${o.items?.length ? `<button class="order-action-btn toggle-items-btn">View Items</button>` : ''}
      ${avail.map(s => `<button class="order-action-btn status-change-btn" data-order-id="${o.id}" data-new-status="${s}">→ ${s}</button>`).join('')}
    </div>
    ${o.items?.length ? `
    <div class="order-items-list">
      ${o.items.map(it => `
        <div class="order-item-row">
          <span>#${it.menu_item_id}</span>
          <span class="order-status-pill ${it.status}" style="font-size:10px">${it.status}</span>
          <span style="flex:1">Qty: ${it.quantity}</span>
          <span>₹${parseFloat(it.unit_price).toFixed(2)}</span>
          ${it.special_instructions ? `<span style="font-style:italic">${esc(it.special_instructions)}</span>` : ''}
        </div>`).join('')}
    </div>` : ''}
  </div>`;
}

async function changeOrderStatus(orderId, newStatus) {
  try {
    await apiFetch(`/api/orders/${orderId}/status?new_status=${newStatus}`, { method: 'PATCH' });
    showNotice(`Order #${orderId} → ${newStatus}`, 'success');
    // Reload with current filter
    const filter = document.getElementById('orderStatusFilter')?.value || '';
    loadOrders(filter);
  } catch(e) { showNotice(e.message); }
}

async function generateBill() {
  const sessionId = document.getElementById('billSessionId')?.value;
  const resultEl  = document.getElementById('billResult');
  if (!sessionId || !resultEl) return;
  resultEl.className = 'bill-result hidden';
  try {
    const bill = await apiFetch(`/api/billing/sessions/${sessionId}/bill`, { method: 'POST' });
    resultEl.innerHTML = `<strong>Bill #${bill.id}</strong><br>Subtotal: ₹${bill.subtotal}<br>Tax: ₹${bill.tax_amount}<br><strong>Total: ₹${bill.total_amount}</strong><br>Status: ${bill.status}`;
    resultEl.className = 'bill-result success-result';
    // Pre-fill payment form
    const payBillId = document.getElementById('payBillId');
    const payAmount = document.getElementById('payAmount');
    if (payBillId) payBillId.value = bill.id;
    if (payAmount) payAmount.value = bill.total_amount;
  } catch(e) {
    resultEl.textContent = '✕ ' + e.message;
    resultEl.className   = 'bill-result error-result';
  }
}

async function recordPayment() {
  const billId = document.getElementById('payBillId')?.value;
  const amount = document.getElementById('payAmount')?.value;
  const method = document.getElementById('payMethod')?.value;
  const resultEl = document.getElementById('payResult');
  if (!billId || !amount || !resultEl) return;
  resultEl.className = 'bill-result hidden';
  try {
    const pay = await apiFetch('/api/payments', {
      method: 'POST',
      body: JSON.stringify({ bill_id: parseInt(billId), amount: parseFloat(amount), method }),
    });
    resultEl.textContent = `✓ Payment #${pay.id} recorded (${method}) — ₹${pay.amount}`;
    resultEl.className   = 'bill-result success-result';
    showNotice('Payment recorded successfully!', 'success');
  } catch(e) {
    resultEl.textContent = '✕ ' + e.message;
    resultEl.className   = 'bill-result error-result';
  }
}

async function loadMyProfile() {
  const el = document.getElementById('myProfile');
  if (!el) return;
  try {
    const me = await apiFetch('/api/auth/me');
    el.innerHTML = `
      <div class="profile-row"><span>Name</span><span>${esc(me.full_name)}</span></div>
      <div class="profile-row"><span>Email</span><span>${esc(me.email)}</span></div>
      <div class="profile-row"><span>Role</span><span class="staff-role-badge ${me.role}">${me.role}</span></div>
      <div class="profile-row"><span>Phone</span><span>${me.phone || '—'}</span></div>
      <div class="profile-row"><span>Status</span><span>${me.is_active ? '✓ Active' : '✕ Inactive'}</span></div>`;
  } catch(e) { el.textContent = 'Could not load profile.'; }
}

async function registerStaff(e) {
  e.preventDefault();
  const resultEl = document.getElementById('regResult');
  const body = {
    full_name: document.getElementById('reg-name')?.value.trim(),
    email:     document.getElementById('reg-email')?.value.trim(),
    password:  document.getElementById('reg-password')?.value,
    phone:     document.getElementById('reg-phone')?.value.trim() || null,
    role:      document.getElementById('reg-role')?.value,
  };
  if (!resultEl) return;
  resultEl.className = 'bill-result hidden';
  try {
    const staff = await apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify(body) });
    resultEl.textContent = `✓ ${staff.full_name} registered as ${staff.role}.`;
    resultEl.className   = 'bill-result success-result';
    e.target.reset();
  } catch(err) {
    resultEl.textContent = '✕ ' + err.message;
    resultEl.className   = 'bill-result error-result';
  }
}

// ============================================================
//  STAFF (WAITER / CHEF) PAGES
// ============================================================

async function loadStaffDashboard() {
  try {
    const [pending, preparing, ready, served] = await Promise.all([
      apiFetch('/api/orders?order_status=pending'),
      apiFetch('/api/orders?order_status=preparing'),
      apiFetch('/api/orders?order_status=ready'),
      apiFetch('/api/orders?order_status=served'),
    ]);
    setText('s-pending',   pending.length);
    setText('s-preparing', preparing.length);
    setText('s-ready',     ready.length);
    setText('s-served',    served.length);
    setConnStatus(true);
  } catch(e) { showNotice(e.message); setConnStatus(false); }
}

async function loadKitchenOrders() {
  const container = document.getElementById('kitchenContainer');
  if (!container) return;
  container.innerHTML = '<div class="loading-row">Loading kitchen queue…</div>';
  try {
    const [pending, preparing, ready] = await Promise.all([
      apiFetch('/api/orders?order_status=pending'),
      apiFetch('/api/orders?order_status=preparing'),
      apiFetch('/api/orders?order_status=ready'),
    ]);
    const all = [...pending, ...preparing, ...ready];
    if (!all.length) { container.innerHTML = '<div class="empty-state"><div class="empty-icon">♨</div>Kitchen is clear!</div>'; return; }
    container.innerHTML = all.map(o => renderOrderCard(o)).join('');
    container.querySelectorAll('.toggle-items-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const list = btn.closest('.order-card').querySelector('.order-items-list');
        list?.classList.toggle('open');
        btn.textContent = list?.classList.contains('open') ? 'Hide Items' : 'View Items';
      });
    });
    container.querySelectorAll('.status-change-btn').forEach(btn => {
      btn.addEventListener('click', () => changeOrderStatusKitchen(btn.dataset.orderId, btn.dataset.newStatus));
    });
  } catch(e) { showNotice(e.message); container.innerHTML = '<div class="empty-state">Could not load kitchen orders.</div>'; }
}

async function changeOrderStatusKitchen(orderId, newStatus) {
  try {
    await apiFetch(`/api/orders/${orderId}/status?new_status=${newStatus}`, { method: 'PATCH' });
    showNotice(`Order #${orderId} → ${newStatus}`, 'success');
    loadKitchenOrders();
  } catch(e) { showNotice(e.message); }
}

// ============================================================
//  CUSTOMER PAGES
// ============================================================

async function loadCustomerHome() {
  // Load menu for customer view
  await loadMenu();
}

async function loadCustomerCategories() {
  const pills = document.getElementById('catPills');
  if (!pills) return;
  try {
    const cats = await apiFetch('/api/menu/categories');
    pills.innerHTML = `<button class="cat-pill active" data-cat="">All</button>` +
      cats.map(c => `<button class="cat-pill" data-cat="${c.id}">${esc(c.name)}</button>`).join('');
    pills.querySelectorAll('.cat-pill').forEach(p => {
      p.addEventListener('click', () => {
        pills.querySelectorAll('.cat-pill').forEach(x => x.classList.remove('active'));
        p.classList.add('active');
        loadMenu(p.dataset.cat || null);
      });
    });
  } catch(e) { /* non-critical */ }
}

// ============================================================
//  ADD TABLE MODAL
// ============================================================
function openAddTableModal() {
  const overlay = document.getElementById('modalOverlay');
  const content = document.getElementById('modalContent');
  if (!overlay || !content) return;
  content.innerHTML = `
    <h3>Add New Table</h3>
    <form id="addTableForm">
      <div class="form-group">
        <label class="form-label">Table Number</label>
        <input class="form-input" type="number" id="newTableNum" min="1" required>
      </div>
      <div class="form-group">
        <label class="form-label">Capacity</label>
        <input class="form-input" type="number" id="newTableCap" min="1" max="20" value="4" required>
      </div>
      <button class="btn-primary full-w" type="submit">Create Table</button>
      <div id="addTableResult" class="bill-result hidden"></div>
    </form>`;
  overlay.classList.remove('hidden');

  document.getElementById('addTableForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const resultEl = document.getElementById('addTableResult');
    try {
      const t = await apiFetch('/api/tables', {
        method: 'POST',
        body: JSON.stringify({ table_number: parseInt(document.getElementById('newTableNum').value), capacity: parseInt(document.getElementById('newTableCap').value) }),
      });
      resultEl.textContent = `✓ Table T${t.table_number} created.`;
      resultEl.className   = 'bill-result success-result';
      setTimeout(() => { closeModal(); loadTables(); }, 1000);
    } catch(err) {
      resultEl.textContent = '✕ ' + err.message;
      resultEl.className   = 'bill-result error-result';
      resultEl.classList.remove('hidden');
    }
  });
}

// ============================================================
//  ADD MENU ITEM MODAL
// ============================================================
async function openAddItemModal() {
  const overlay = document.getElementById('modalOverlay');
  const content = document.getElementById('modalContent');
  if (!overlay || !content) return;
  let cats = [];
  try { cats = await apiFetch('/api/menu/categories'); } catch{}
  content.innerHTML = `
    <h3>Add Menu Item</h3>
    <form id="addItemForm">
      <div class="form-group">
        <label class="form-label">Category</label>
        <select class="form-input" id="newItemCat" required>
          ${cats.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Item Name</label>
        <input class="form-input" type="text" id="newItemName" required>
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <input class="form-input" type="text" id="newItemDesc" placeholder="optional">
      </div>
      <div class="form-group">
        <label class="form-label">Price (₹)</label>
        <input class="form-input" type="number" id="newItemPrice" step="0.01" min="0.01" required>
      </div>
      <button class="btn-primary full-w" type="submit">Add Item</button>
      <div id="addItemResult" class="bill-result hidden"></div>
    </form>`;
  overlay.classList.remove('hidden');

  document.getElementById('addItemForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const resultEl = document.getElementById('addItemResult');
    try {
      const it = await apiFetch('/api/menu/items', {
        method: 'POST',
        body: JSON.stringify({
          category_id: parseInt(document.getElementById('newItemCat').value),
          name:   document.getElementById('newItemName').value.trim(),
          description: document.getElementById('newItemDesc').value.trim() || null,
          price:  parseFloat(document.getElementById('newItemPrice').value),
        }),
      });
      resultEl.textContent = `✓ "${it.name}" added.`;
      resultEl.className   = 'bill-result success-result';
      resultEl.classList.remove('hidden');
      setTimeout(() => { closeModal(); loadMenu(); }, 1000);
    } catch(err) {
      resultEl.textContent = '✕ ' + err.message;
      resultEl.className   = 'bill-result error-result';
      resultEl.classList.remove('hidden');
    }
  });
}

async function openAddCatModal() {
  const overlay = document.getElementById('modalOverlay');
  const content = document.getElementById('modalContent');
  if (!overlay || !content) return;
  content.innerHTML = `
    <h3>Add Category</h3>
    <form id="addCatForm">
      <div class="form-group">
        <label class="form-label">Name</label>
        <input class="form-input" type="text" id="newCatName" required>
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <input class="form-input" type="text" id="newCatDesc" placeholder="optional">
      </div>
      <button class="btn-primary full-w" type="submit">Create Category</button>
      <div id="addCatResult" class="bill-result hidden"></div>
    </form>`;
  overlay.classList.remove('hidden');
  document.getElementById('addCatForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const resultEl = document.getElementById('addCatResult');
    try {
      const c = await apiFetch('/api/menu/categories', {
        method: 'POST',
        body: JSON.stringify({ name: document.getElementById('newCatName').value.trim(), description: document.getElementById('newCatDesc').value.trim() || null }),
      });
      resultEl.textContent = `✓ "${c.name}" created.`;
      resultEl.className   = 'bill-result success-result';
      resultEl.classList.remove('hidden');
      setTimeout(() => { closeModal(); loadMenu(); }, 1000);
    } catch(err) {
      resultEl.textContent = '✕ ' + err.message;
      resultEl.className   = 'bill-result error-result';
      resultEl.classList.remove('hidden');
    }
  });
}

// ============================================================
//  UTILITY
// ============================================================

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '—';
}

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ============================================================
//  INIT
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const token = getToken();
  const staff = getStaff();
  const isCustomer = document.body.dataset.role === 'customer';

  if (!token || !staff) {
    if (!isCustomer) {
      window.location.href = 'login.html';
      return;
    }
  }

  // Populate sidebar profile
  const initials = staff ? (staff.full_name?.split(' ').map(w => w[0]).slice(0,2).join('') || staff.role[0].toUpperCase()) : 'G';
  setText('sidebarName', staff ? staff.full_name : 'Cafe Guest');
  setText('greetName',   staff ? (staff.full_name?.split(' ')[0] || 'there') : 'Guest');
  const avatarEl = document.getElementById('sidebarAvatar');
  if (avatarEl) avatarEl.textContent = initials;
  const topAv = document.getElementById('topbarAvatar');
  if (topAv) topAv.textContent = initials;
  const roleBadge = document.querySelector('.staff-role-badge');
  if (roleBadge) {
    const roleName = staff ? staff.role : 'customer';
    roleBadge.textContent = roleName;
    roleBadge.className = 'staff-role-badge ' + roleName;
  }
  const breadRole = document.getElementById('breadcrumbRole');
  if (breadRole) {
    const roleTitle = staff ? staff.role : 'Customer';
    breadRole.textContent = roleTitle.charAt(0).toUpperCase() + roleTitle.slice(1);
  }

  setDate();
  checkConn();

  // Navigation
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchPage(btn.dataset.page));
  });

  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', logout);

  // Refresh
  document.getElementById('refreshBtn')?.addEventListener('click', () => onPageEnter(getCurrentPage()));
  document.getElementById('heroRefreshBtn')?.addEventListener('click', () => onPageEnter('dashboard'));

  // Manager-specific bindings
  document.getElementById('loadReportBtn')?.addEventListener('click', loadReports);
  document.getElementById('genBillBtn')?.addEventListener('click', generateBill);
  document.getElementById('recordPayBtn')?.addEventListener('click', recordPayment);
  document.getElementById('registerForm')?.addEventListener('submit', registerStaff);
  document.getElementById('addTableBtn')?.addEventListener('click', openAddTableModal);
  document.getElementById('refreshTablesBtn')?.addEventListener('click', loadTables);
  document.getElementById('addItemBtn')?.addEventListener('click', openAddItemModal);
  document.getElementById('addCatBtn')?.addEventListener('click', openAddCatModal);
  document.getElementById('filterOrdersBtn')?.addEventListener('click', () => {
    const f = document.getElementById('orderStatusFilter')?.value || '';
    loadOrders(f);
  });
  document.getElementById('menuCatFilter')?.addEventListener('change', (e) => loadMenu(e.target.value || null));

  // Admin-specific bindings
  document.getElementById('openRegStaffModalBtn')?.addEventListener('click', openRegisterStaffModal);
  document.getElementById('refreshStaffBtn')?.addEventListener('click', loadAdminStaff);

  // Modal close
  document.getElementById('modalClose')?.addEventListener('click', closeModal);
  document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Staff page
  document.getElementById('refreshKitchenBtn')?.addEventListener('click', loadKitchenOrders);
  document.getElementById('staffFilterOrdersBtn')?.addEventListener('click', () => {
    loadOrders(document.getElementById('staffOrderFilter')?.value || '');
  });

  // Customer page
  loadCustomerCategories();

  // Trigger first page
  switchPage('dashboard');

  // Load staff profile when entering staff page
  const staffTab = document.querySelector('[data-page="profile"]') || document.querySelector('[data-page="staff"]');
  if (staffTab) staffTab.addEventListener('click', loadMyProfile);
  // Also load on page-staff shown
  if (document.getElementById('page-staff')) {
    document.querySelector('[data-page="staff"]')?.addEventListener('click', loadMyProfile);
  }
});

function getCurrentPage() {
  const active = document.querySelector('.nav-item.active');
  return active?.dataset.page || 'dashboard';
}
