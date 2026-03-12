(function () {
      function validSession() {
        const token = localStorage.getItem('token');
        const role = localStorage.getItem('role');
        const branch = localStorage.getItem('branch');
        return !!token && role === 'director' && (!branch || branch === 'All');
      }
      function redirectToLogin() {
        window.location.replace('index.html');
      }
      function guardSession() {
        if (validSession()) return;
        const b = document.createElement('div');
        b.className = 'banner banner-error';
        b.innerText = 'Access denied: director role required. Redirecting to login...';
        document.body.insertBefore(b, document.body.firstChild);
        setTimeout(redirectToLogin, 300);
      }
      window.addEventListener('pageshow', guardSession);
      window.addEventListener('popstate', guardSession);
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') guardSession();
      });
      guardSession();
    })();

    const PRODUCE = ['Beans', 'Grain Maize', 'Cow Peas', 'G-nuts', 'Soybeans'];
    const BRANCHES = ['Maganjo', 'Matugga'];
    const SALES_STATE = {
      filters: { quick: '', branch: 'All', status: 'All', customer: 'All', product: 'All', from: '', to: '', search: '' },
      page: 1,
      perPage: 10
    };
    let STAFF_CACHE = [];
    let ACCOUNT_REQ_CACHE = [];

    function ugx(v) { return 'UGX ' + (Number(v) || 0).toLocaleString(); }
    function fmtDateTime(v) {
      const d = v ? new Date(v) : null;
      if (!d || isNaN(d.getTime())) return '-';
      return d.toLocaleString();
    }
    function parseDateOnly(v) {
      if (!v) return null;
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return null;
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
    function isSameDay(a, b) { return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
    function isSameMonth(a, b) { return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth(); }
    function addDays(d, days) { const nd = new Date(d); nd.setDate(nd.getDate() + days); return nd; }
    function startOfWeek(d) {
      const date = new Date(d);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      return new Date(date.getFullYear(), date.getMonth(), diff);
    }
    function parseDate(v) { if (!v) return null; const d = new Date(v); return isNaN(d.getTime()) ? null : d; }
    function inWindow(d, start, end) { return !!d && d >= start && d <= end; }

    function readSales() { return JSON.parse(localStorage.getItem('sales') || '[]'); }
    function readCredits() { return JSON.parse(localStorage.getItem('credits') || '[]'); }
    function readPrices() { return JSON.parse(localStorage.getItem('prices') || '{}'); }
    function readInv() { return JSON.parse(localStorage.getItem('inventoryByBranch') || '{"Maganjo":{},"Matugga":{}}'); }

    function buildSalesDataset() {
      const sales = readSales().map((r) => ({
        id: r.id || r._id || r.ref || `CASH-${Math.random().toString(36).slice(2, 8)}`,
        ref: r.id || r._id || r.ref || 'cash',
        type: 'cash',
        branch: r.branch || 'Maganjo',
        date: r.date,
        dateObj: parseDateOnly(r.date) || new Date(),
        total: Number(r.amount) || 0,
        balance: 0,
        status: 'Paid',
        customer: r.buyer || 'Walk-in buyer',
        product: r.produce || 'Produce'
      }));
      const credits = readCredits().map((r) => ({
        id: r.id || r._id || r.ref || `CR-${Math.random().toString(36).slice(2, 8)}`,
        ref: r.id || r._id || r.ref || 'credit',
        type: 'credit',
        branch: r.branch || 'Maganjo',
        date: r.dispatch || r.dueDate,
        dateObj: parseDateOnly(r.dispatch || r.dueDate) || new Date(),
        total: Number(r.amountDue) || 0,
        balance: Number(r.amountDue) || 0,
        status: 'Pending',
        customer: r.buyer || 'Customer',
        product: r.produce || 'Produce'
      }));
      return [...sales, ...credits].sort((a, b) => b.dateObj - a.dateObj);
    }

    function readStaff() {
      if (!localStorage.getItem('staff')) {
        localStorage.setItem('staff', JSON.stringify([
          { name: 'Orban', role: 'Director', branch: 'All', password: 'orban123' },
          { name: 'Branch Manager', role: 'Manager', branch: 'Maganjo', password: 'manager123' },
          { name: 'Branch Manager', role: 'Manager', branch: 'Matugga', password: 'manager123' }
        ]));
      }
      return JSON.parse(localStorage.getItem('staff') || '[]');
    }

    function matchesQuickFilter(dateObj, quick) {
      if (!quick) return true;
      const today = parseDateOnly(new Date());
      if (!dateObj) return false;
      if (quick === 'today') return isSameDay(dateObj, today);
      if (quick === 'yesterday') return isSameDay(dateObj, addDays(today, -1));
      if (quick === 'thisWeek') {
        const start = startOfWeek(today);
        const end = addDays(start, 6);
        return dateObj >= start && dateObj <= end;
      }
      if (quick === 'lastWeek') {
        const end = addDays(startOfWeek(today), -1);
        const start = addDays(end, -6);
        return dateObj >= start && dateObj <= end;
      }
      if (quick === 'thisMonth') return isSameMonth(dateObj, today);
      if (quick === 'lastMonth') {
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        return dateObj.getFullYear() === lastMonth.getFullYear() && dateObj.getMonth() === lastMonth.getMonth();
      }
      return true;
    }

    function applySalesFilters(rows) {
      const f = SALES_STATE.filters;
      return rows.filter((row) => {
        if (f.branch !== 'All' && row.branch !== f.branch) return false;
        if (f.status !== 'All' && row.status !== f.status) return false;
        if (f.customer !== 'All' && row.customer !== f.customer) return false;
        if (f.product !== 'All' && row.product !== f.product) return false;
        if (f.from) {
          const from = parseDateOnly(f.from);
          if (from && row.dateObj < from) return false;
        }
        if (f.to) {
          const to = parseDateOnly(f.to);
          if (to && row.dateObj > to) return false;
        }
        if (f.quick && !matchesQuickFilter(row.dateObj, f.quick)) return false;
        if (f.search) {
          const s = f.search.toLowerCase();
          const hay = `${row.ref} ${row.branch} ${row.customer} ${row.product}`.toLowerCase();
          if (!hay.includes(s)) return false;
        }
        return true;
      });
    }

    function renderSalesFiltersOptions(rows) {
      const customerSel = document.getElementById('directorFilterCustomer');
      const productSel = document.getElementById('directorFilterProduct');
      if (!customerSel || !productSel) return;
      const customers = Array.from(new Set(rows.map(r => r.customer))).sort();
      const products = Array.from(new Set(rows.map(r => r.product))).sort();
      const setOpts = (sel, items) => {
        sel.innerHTML = '<option value=\"All\">All</option>' + items.map(v => `<option value=\"${v}\">${v}</option>`).join('');
      };
      setOpts(customerSel, customers);
      setOpts(productSel, products);
    }

    function formatRef(ref) {
      const clean = String(ref || '').replace(/[^a-zA-Z0-9]/g, '');
      if (!clean) return '#';
      return '# ' + clean.slice(-8).toUpperCase();
    }

    function formatDateLabel(d) {
      if (!d) return '';
      const opts = { month: 'short', day: 'numeric', year: 'numeric' };
      return d.toLocaleDateString(undefined, opts);
    }

    function renderDirectorSales() {
      const data = buildSalesDataset();
      renderSalesFiltersOptions(data);
      const rows = applySalesFilters(data);
      const perPage = Number(SALES_STATE.perPage) || 10;
      const totalPages = Math.max(1, Math.ceil(rows.length / perPage));
      if (SALES_STATE.page > totalPages) SALES_STATE.page = totalPages;
      const start = (SALES_STATE.page - 1) * perPage;
      const pageRows = rows.slice(start, start + perPage);
      const tbody = document.getElementById('directorSalesBody');
      if (tbody) {
        tbody.innerHTML = pageRows.length ? pageRows.map((r) => (
          `<tr>
            <td><input class=\"form-check-input\" type=\"checkbox\"></td>
            <td class=\"text-primary\">${formatRef(r.ref)}</td>
            <td>${formatDateLabel(r.dateObj)}</td>
            <td><span class=\"branch-pill\"><span class=\"dot\"></span>${r.branch}</span></td>
            <td class=\"text-success fw-semibold\">${ugx(r.total)}</td>
            <td class=\"text-success\">${ugx(r.balance)}</td>
            <td><span class=\"status-pill ${r.status === 'Paid' ? 'pill-paid' : 'pill-pending'}\">${r.status}</span></td>
            <td>
              <div class=\"table-actions\">
                <button class=\"btn-icon\" title=\"View\"><i class=\"bi bi-eye\"></i></button>
                <button class=\"btn-icon\" title=\"Edit\"><i class=\"bi bi-pencil-square\"></i></button>
                <button class=\"btn-icon\" title=\"Delete\"><i class=\"bi bi-trash\"></i></button>
              </div>
            </td>
          </tr>`
        )).join('') : '<tr><td colspan=\"8\" class=\"text-muted text-center py-4\">No sales match these filters.</td></tr>';
      }

      const pageRevenue = pageRows.reduce((s, r) => s + Number(r.total || 0), 0);
      const pageBalance = pageRows.reduce((s, r) => s + Number(r.balance || 0), 0);
      const allRevenue = rows.reduce((s, r) => s + Number(r.total || 0), 0);
      const allBalance = rows.reduce((s, r) => s + Number(r.balance || 0), 0);
      document.getElementById('directorPageRevenue').innerText = ugx(pageRevenue);
      document.getElementById('directorPageBalance').innerText = ugx(pageBalance);
      document.getElementById('directorAllRevenue').innerText = ugx(allRevenue);
      document.getElementById('directorAllBalance').innerText = ugx(allBalance);

      const showing = document.getElementById('directorSalesShowing');
      if (showing) {
        const end = Math.min(rows.length, start + pageRows.length);
        showing.innerText = rows.length ? `Showing ${start + 1} to ${end} of ${rows.length} results` : 'No results to show';
      }
      renderDirectorPagination(totalPages);
    }

    function renderDirectorPagination(totalPages) {
      const container = document.getElementById('directorSalesPagination');
      if (!container) return;
      const buttons = [];
      const addBtn = (label, page, disabled = false, active = false) => {
        buttons.push(`<button class=\"btn btn-sm ${active ? 'btn-primary' : 'btn-outline-secondary'} ${disabled ? 'disabled' : ''}\" data-page=\"${page}\">${label}</button>`);
      };
      addBtn('Prev', Math.max(1, SALES_STATE.page - 1), SALES_STATE.page === 1);

      const buildPages = () => {
        if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
        const pages = [1];
        const start = Math.max(2, SALES_STATE.page - 1);
        const end = Math.min(totalPages - 1, SALES_STATE.page + 1);
        if (start > 2) pages.push('...');
        for (let i = start; i <= end; i += 1) pages.push(i);
        if (end < totalPages - 1) pages.push('...');
        pages.push(totalPages);
        return pages;
      };

      buildPages().forEach(p => {
        if (p === '...') {
          buttons.push('<button class=\"btn btn-sm btn-outline-secondary disabled\">...</button>');
        } else {
          addBtn(p, p, false, SALES_STATE.page === p);
        }
      });

      addBtn('Next', Math.min(totalPages, SALES_STATE.page + 1), SALES_STATE.page === totalPages);
      container.innerHTML = buttons.join('');
    }

    function exportDirectorCsv() {
      const rows = applySalesFilters(buildSalesDataset());
      if (!rows.length) return;
      const header = ['Ref', 'Date', 'Branch', 'Total', 'Balance', 'Status', 'Customer', 'Product'];
      const lines = rows.map(r => [
        formatRef(r.ref),
        r.date || '',
        r.branch,
        Number(r.total || 0),
        Number(r.balance || 0),
        r.status,
        r.customer,
        r.product
      ].join(','));
      const blob = new Blob([[header.join(','), ...lines].join('\\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sales.csv';
      a.click();
      URL.revokeObjectURL(url);
    }

    function saveStaff(staff) {
      localStorage.setItem('staff', JSON.stringify(staff));
    }

    function normalizeRole(role) {
      const r = String(role || '').toLowerCase();
      if (r === 'director') return 'Director';
      if (r === 'manager') return 'Manager';
      return 'Agent';
    }

    function bindDirectorSalesEvents() {
      const quickButtons = document.querySelectorAll('[data-quick-filter]');
      quickButtons.forEach(btn => {
        if (btn.dataset.quickFilter === SALES_STATE.filters.quick) btn.classList.add('active');
      });
      quickButtons.forEach(btn => btn.addEventListener('click', () => {
        quickButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        SALES_STATE.filters.quick = btn.dataset.quickFilter || '';
        SALES_STATE.page = 1;
        renderDirectorSales();
      }));

      const mapChange = (id, key) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('change', () => {
          SALES_STATE.filters[key] = el.value;
          SALES_STATE.page = 1;
          renderDirectorSales();
        });
      };
      [['directorFilterBranch', 'branch'], ['directorFilterStatus', 'status'], ['directorFilterCustomer', 'customer'], ['directorFilterProduct', 'product'], ['directorFilterFrom', 'from'], ['directorFilterTo', 'to']].forEach(([id, key]) => mapChange(id, key));

      const search = document.getElementById('directorSalesSearch');
      if (search) search.addEventListener('input', () => {
        SALES_STATE.filters.search = search.value.trim();
        SALES_STATE.page = 1;
        renderDirectorSales();
      });

      const perPage = document.getElementById('directorSalesPerPage');
      if (perPage) perPage.addEventListener('change', () => {
        SALES_STATE.perPage = Number(perPage.value) || 10;
        SALES_STATE.page = 1;
        renderDirectorSales();
      });

      const pagination = document.getElementById('directorSalesPagination');
      if (pagination) pagination.addEventListener('click', (e) => {
        const page = e.target && e.target.getAttribute('data-page');
        if (!page || e.target.classList.contains('disabled')) return;
        SALES_STATE.page = Number(page);
        renderDirectorSales();
      });

      const resetBtn = document.getElementById('directorSalesReset');
      if (resetBtn) resetBtn.addEventListener('click', () => {
        SALES_STATE.filters = { quick: '', branch: 'All', status: 'All', customer: 'All', product: 'All', from: '', to: '', search: '' };
        document.querySelectorAll('[data-quick-filter]').forEach(b => b.classList.remove('active'));
        ['directorFilterBranch', 'directorFilterStatus', 'directorFilterCustomer', 'directorFilterProduct', 'directorFilterFrom', 'directorFilterTo', 'directorSalesSearch'].forEach(id => {
          const el = document.getElementById(id);
          if (!el) return;
          if (id === 'directorSalesSearch') el.value = '';
          else if (id === 'directorFilterFrom' || id === 'directorFilterTo') el.value = '';
          else el.value = 'All';
        });
        SALES_STATE.page = 1;
        renderDirectorSales();
      });

      const exportBtn = document.getElementById('directorExportSalesBtn');
      if (exportBtn) exportBtn.addEventListener('click', exportDirectorCsv);
    }

    function uiRoleToApi(role) {
      return String(role || '').toLowerCase();
    }

    function computeRevenueCards() {
      const sales = readSales();
      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(dayStart); weekStart.setDate(weekStart.getDate() - 6);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const yearStart = new Date(now.getFullYear(), 0, 1);

      let daily = 0, weekly = 0, monthly = 0, annual = 0;
      let magRev = 0, matRev = 0;

      sales.forEach(s => {
        const d = parseDate((s.date ? s.date : s.created));
        const amt = Number(s.amount) || 0;
        if (inWindow(d, dayStart, now)) daily += amt;
        if (inWindow(d, weekStart, now)) weekly += amt;
        if (inWindow(d, monthStart, now)) monthly += amt;
        if (inWindow(d, yearStart, now)) annual += amt;
        if (s.branch === 'Maganjo') magRev += amt;
        if (s.branch === 'Matugga') matRev += amt;
      });

      const credits = readCredits();
      const magCredit = credits.filter(c => c.branch === 'Maganjo').reduce((s, c) => s + (Number(c.amountDue) || 0), 0);
      const matCredit = credits.filter(c => c.branch === 'Matugga').reduce((s, c) => s + (Number(c.amountDue) || 0), 0);

      document.getElementById('dailySales').innerText = ugx(daily);
      document.getElementById('weeklySales').innerText = ugx(weekly);
      document.getElementById('monthlySales').innerText = ugx(monthly);
      document.getElementById('annualSales').innerText = ugx(annual);
      document.getElementById('magRevenue').innerText = ugx(magRev);
      document.getElementById('matRevenue').innerText = ugx(matRev);
      document.getElementById('magCredit').innerText = ugx(magCredit);
      document.getElementById('matCredit').innerText = ugx(matCredit);
    }

    function computeStockCards() {
      const prices = readPrices();
      const inv = readInv();
      const branches = ['Maganjo', 'Matugga'];

      let totalValue = 0, low = 0, out = 0;
      let magVal = 0, matVal = 0, magUnits = 0, matUnits = 0, magLow = 0, matLow = 0;

      branches.forEach(b => {
        PRODUCE.forEach(p => {
          const q = Number((inv[b] || {})[p] || 0);
          const val = q * (Number(prices[p]) || 0);
          totalValue += val;
          if (q <= 0) out++;
          if (q > 0 && q < 500) low++;
          if (b === 'Maganjo') { magVal += val; magUnits += q; if (q > 0 && q < 500) magLow++; }
          if (b === 'Matugga') { matVal += val; matUnits += q; if (q > 0 && q < 500) matLow++; }
        });
      });

      document.getElementById('totalStockValue').innerText = ugx(totalValue);
      document.getElementById('lowStockItems').innerText = low;
      document.getElementById('outStockItems').innerText = out;
      document.getElementById('trackedProducts').innerText = PRODUCE.length;
      document.getElementById('magStockValue').innerText = ugx(magVal);
      document.getElementById('matStockValue').innerText = ugx(matVal);
      document.getElementById('magUnits').innerText = magUnits.toLocaleString();
      document.getElementById('matUnits').innerText = matUnits.toLocaleString();
      document.getElementById('magLow').innerText = magLow;
      document.getElementById('matLow').innerText = matLow;
    }

    function loadStaff() {
      const rows = document.getElementById('staffRows');
      rows.innerHTML = '';
      const staff = readStaff().filter(s => s && String(s.name || '').trim() && String(s.branch || '').trim());
      STAFF_CACHE = staff;

      staff.forEach((s, idx) => {
        const tr = document.createElement('tr');
        const rowId = s.id || String(idx);
        const displayName = s.name || '';
        const displayRole = normalizeRole(s.role);
        const displayBranch = s.branch || '';
        const displayPassword = s.password || '********';

        tr.innerHTML = `<td>${displayName}</td><td><span class="badge bg-info-subtle text-info border border-info">${displayRole}</span></td><td>${displayBranch}</td><td>${displayPassword}</td><td>
      <button class="btn btn-sm text-warning" data-action="edit" data-id="${rowId}"><i class="bi bi-pencil-square"></i></button>
      <button class="btn btn-sm text-danger" data-action="delete" data-id="${rowId}"><i class="bi bi-trash3"></i></button>
    </td>`;

        rows.appendChild(tr);
      });
    }

    async function loadAccountChangeRequests() {
      const rows = document.getElementById('accountChangeRows');
      const msg = document.getElementById('accountReqMsg');
      if (!rows || !msg) return;
      rows.innerHTML = '';
      msg.textContent = '';

      try {
        const list = await window.KGLApi.getAccountChangeRequests();
        ACCOUNT_REQ_CACHE = Array.isArray(list) ? list : [];
      } catch (err) {
        msg.textContent = err.message || 'Failed to load account change requests.';
        return;
      }

      if (!ACCOUNT_REQ_CACHE.length) {
        rows.innerHTML = '<tr><td colspan="6" class="text-muted">No account change requests yet.</td></tr>';
        return;
      }

      rows.innerHTML = ACCOUNT_REQ_CACHE.map((r) => {
        const statusClass = r.status === 'approved' ? 'success' : (r.status === 'rejected' ? 'danger' : 'warning');
        const canAct = r.status === 'pending';
        const reqName = r.requestedName ? r.requestedName : '<span class="text-muted">No name change</span>';
        const passCell = r.hasPasswordChange ? '<span class="text-warning">Requested</span>' : '<span class="text-muted">No</span>';
        const staff = `${r.requestedByName} (${normalizeRole(r.requestedByRole)} - ${r.requestedByBranch})`;
        const actions = canAct
          ? `<button class="btn btn-sm btn-success me-1" data-req-action="approve" data-id="${r.id}">Approve</button>
             <button class="btn btn-sm btn-outline-danger" data-req-action="reject" data-id="${r.id}">Reject</button>`
          : '<span class="text-muted">Processed</span>';
        return `<tr>
          <td>${staff}</td>
          <td>${reqName}</td>
          <td>${passCell}</td>
          <td><span class="badge bg-${statusClass}-subtle text-${statusClass} border border-${statusClass}">${r.status}</span></td>
          <td>${fmtDateTime(r.createdAt)}</td>
          <td>${actions}</td>
        </tr>`;
      }).join('');
    }

    async function handleAccountRequestAction(id, action) {
      const note = window.prompt(`Optional note for ${action}:`, '') || '';
      try {
        if (action === 'approve') {
          await window.KGLApi.approveAccountChangeRequest(id, { note });
        } else {
          await window.KGLApi.rejectAccountChangeRequest(id, { note });
        }
        await window.KGLApi.syncState();
        await loadStaff();

      } catch (err) {
        const msg = document.getElementById('accountReqMsg');
        msg.textContent = err.message || `Failed to ${action} request.`;
      }
    }

    function openAddStaffModal() {
      document.getElementById('staffModalTitle').innerText = 'Register New Staff';
      document.getElementById('staffSubmitBtn').innerText = 'Create Account';
      document.getElementById('staffEditIndex').value = '-1';
      document.getElementById('staffName').value = '';
      document.getElementById('staffRole').value = 'Manager';
      document.getElementById('staffBranch').value = 'Maganjo';
      document.getElementById('staffPassword').value = '';
    }

    function openEditStaffModal(id) {
      const item = STAFF_CACHE.find(s => (s.id || '') === id) || STAFF_CACHE[Number(id)];
      if (!item) return;

      document.getElementById('staffModalTitle').innerText = 'Edit Staff';
      document.getElementById('staffSubmitBtn').innerText = 'Update Staff';
      document.getElementById('staffEditIndex').value = String(item.id || '');
      document.getElementById('staffName').value = item.name || '';
      document.getElementById('staffRole').value = normalizeRole(item.role) || 'Agent';
      document.getElementById('staffBranch').value = item.branch || 'Maganjo';
      document.getElementById('staffPassword').value = '';

      bootstrap.Modal.getOrCreateInstance(document.getElementById('addUserModal')).show();
    }

    async function deleteStaff(id) {
      const item = STAFF_CACHE.find(s => (s.id || '') === id) || STAFF_CACHE[Number(id)];
      if (!item) return;

      const ok = window.confirm(`Delete ${item.name} (${item.role}) from ${item.branch}?`);
      if (!ok) return;

      try {
        await window.KGLApi.deleteStaff(item.id || id);
        await window.KGLApi.syncState();
        loadStaff();
      } catch (err) {
        window.alert(err.message || 'Failed to delete staff.');
      }
    }

    document.getElementById('openAddStaffBtn').addEventListener('click', openAddStaffModal);

    document.getElementById('staffRows').addEventListener('click', function (e) {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');

      if (action === 'edit') openEditStaffModal(id);
      if (action === 'delete') deleteStaff(id);
    });

    const accountChangeRowsEl = document.getElementById('accountChangeRows');
    if (accountChangeRowsEl) {
      accountChangeRowsEl.addEventListener('click', function (e) {
        const btn = e.target.closest('button[data-req-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-req-action');
        const id = btn.getAttribute('data-id');
        if (!id || !action) return;
        handleAccountRequestAction(id, action);
      });
    }

    document.getElementById('staffForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      const name = document.getElementById('staffName').value.trim();
      const role = document.getElementById('staffRole').value;
      const branch = document.getElementById('staffBranch').value;
      const password = document.getElementById('staffPassword').value.trim();
      const editId = document.getElementById('staffEditIndex').value;

      try {
        if (editId && editId !== '-1') {
          const payload = { name, role: uiRoleToApi(role), branch };
          if (password) payload.password = password;
          await window.KGLApi.updateStaff(editId, payload);
        } else {
          if (password.length < 4) return;
          await window.KGLApi.createStaff({ name, role: uiRoleToApi(role), branch, password });
        }
        await window.KGLApi.syncState();
        loadStaff();
        this.reset();
        document.getElementById('staffEditIndex').value = '-1';
        bootstrap.Modal.getOrCreateInstance(document.getElementById('addUserModal')).hide();
      } catch (err) {
        window.alert(err.message || 'Failed to save staff.');
      }
    });

    document.getElementById('staffRole').addEventListener('change', function (e) {
      const role = String(e.target.value || '').toLowerCase();
      const branchSelect = document.getElementById('staffBranch');
      if (role === 'director') {
        branchSelect.value = 'All';
      } else if (branchSelect.value === 'All') {
        branchSelect.value = 'Maganjo';
      }
    });

    function showSection(id) {
      ['agg-section', 'sales-section', 'stock-section', 'user-section', 'reports-section'].forEach(sec => {
        const el = document.getElementById(sec);
        if (el) el.classList.add('hidden-section');
      });
      const target = document.getElementById(id);
      if (target) target.classList.remove('hidden-section');

      document.querySelectorAll('.nav-link[data-section]').forEach(link => link.classList.remove('active'));
      const active = document.querySelector(`.nav-link[data-section="${id}"]`);
      if (active) active.classList.add('active');

      const label = id === 'agg-section' ? 'Global Analytics'
        : id === 'sales-section' ? 'Sales'
          : id === 'stock-section' ? 'Stock Aggregates'
            : id === 'reports-section' ? 'Reports & Export'
              : 'User Management';
      document.getElementById('breadcrumb').innerHTML = `Director / <strong>${label}</strong>`;
    }

    function logoutNow() {
      window.KGLApi.logout();
      window.location.replace('index.html');
    }

    async function boot() {
      try {
        await window.KGLApi.syncState();
        const a = await window.KGLApi.getDirectorAggregates();
        document.getElementById('dailySales').innerText = ugx(a.dailySales);
        document.getElementById('weeklySales').innerText = ugx(a.weeklySales);
        document.getElementById('monthlySales').innerText = ugx(a.monthlySales);
        document.getElementById('annualSales').innerText = ugx(a.annualSales);
        document.getElementById('magRevenue').innerText = ugx(a.magRevenue);
        document.getElementById('matRevenue').innerText = ugx(a.matRevenue);
        document.getElementById('magCredit').innerText = ugx(a.magCredit);
        document.getElementById('matCredit').innerText = ugx(a.matCredit);
        document.getElementById('totalStockValue').innerText = ugx(a.totalStockValue);
        document.getElementById('lowStockItems').innerText = a.lowStockItems;
        document.getElementById('outStockItems').innerText = a.outStockItems;
        document.getElementById('trackedProducts').innerText = a.trackedProducts;
        document.getElementById('magStockValue').innerText = ugx(a.magStockValue);
        document.getElementById('matStockValue').innerText = ugx(a.matStockValue);
        document.getElementById('magUnits').innerText = Number(a.magUnits || 0).toLocaleString();
        document.getElementById('matUnits').innerText = Number(a.matUnits || 0).toLocaleString();
        document.getElementById('magLow').innerText = a.magLow;
        document.getElementById('matLow').innerText = a.matLow;
        loadStaff();
        bindDirectorSalesEvents();
        renderDirectorSales();
        const frame = document.querySelector('.reports-frame');
        if (frame) frame.src = frame.src;

      } catch (err) {
        const b = document.createElement('div');
        b.className = 'banner banner-error';
        b.innerText = 'Session expired. Redirecting to login...';
        document.body.insertBefore(b, document.body.firstChild);
        setTimeout(() => window.location.replace('index.html'), 300);
      }
    }

    document.addEventListener('DOMContentLoaded', boot);
