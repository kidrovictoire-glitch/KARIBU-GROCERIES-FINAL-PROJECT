(function () {
      function validSession() {
        const token = localStorage.getItem('token');
        const role = localStorage.getItem('role');
        const accountRole = localStorage.getItem('accountRole');
        const branch = localStorage.getItem('branch');
        return !!token && role === 'manager' && (!accountRole || accountRole === 'manager') && !!branch && branch !== 'All';
      }
      function redirectToLogin() {
        window.location.replace('index.html');
      }
      function guardSession() {
        if (validSession()) return;
        const b = document.createElement('div');
        b.className = 'banner banner-error';
        b.innerText = 'Access denied: manager role required. Redirecting to login...';
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

    const PRODUCE = {
      'Beans': 'Legume (Navy, Kidney, Pinto, Black)',
      'Grain Maize': 'Cereal Grain (White, Yellow, Flint, Dent)',
      'Cow Peas': 'Legume (Black-eyed, Brown, Red)',
      'G-nuts': 'Oilseed/Legume (Red, White, Valencia, Virginia)',
      'Soybeans': 'Oilseed/Legume (Yellow, Black, Green)'
    };
    const PRODUCE_TYPES = {
      'Beans': ['Kidney Beans', 'Navy Beans', 'Black Beans', 'Green/Snap Beans'],
      'Grain Maize': ['Dent Maize', 'Flint Maize', 'Flour Maize'],
      'Cow Peas': ['Black-eyed Peas', 'Yardlong Beans'],
      'G-nuts': ['Spanish Types', 'Brown/Red Types', 'Runner Types', 'Virginia Types', 'Valencia Types'],
      'Soybeans': ['Edamame', 'Yellow Soybeans'],
      'default': ['Standard Grade']
    };
    const BRANCHES = ['Maganjo', 'Matugga'];
    const USER_BRANCH = localStorage.getItem('branch') || 'Maganjo';
    let stockAlertsCache = { lowItems: [], overItems: [], outItems: [] };
    const SALES_STATE = {
      filters: { quick: '', branch: 'All', status: 'All', customer: 'All', product: 'All', from: '', to: '', search: '' },
      page: 1,
      perPage: 10
    };
    const SALES_STATUS_LABEL = { cash: 'Paid', credit: 'Pending' };

    function initData() {
      if (!localStorage.getItem('inventoryByBranch')) {
        const data = { Maganjo: {}, Matugga: {} };
        Object.keys(PRODUCE).forEach(p => { data.Maganjo[p] = 0; data.Matugga[p] = 0; });
        localStorage.setItem('inventoryByBranch', JSON.stringify(data));
      }
      if (!localStorage.getItem('prices')) {
        localStorage.setItem('prices', JSON.stringify({
          'Beans': 3500,
          'Grain Maize': 1200,
          'Cow Peas': 2800,
          'G-nuts': 4200,
          'Soybeans': 3100
        }));
      }
      if (!localStorage.getItem('sales')) localStorage.setItem('sales', JSON.stringify([]));
      if (!localStorage.getItem('procurements')) localStorage.setItem('procurements', JSON.stringify([]));
      if (!localStorage.getItem('credits')) localStorage.setItem('credits', JSON.stringify([]));
    }

    function showMsg(id, text, type = 'error', timeout = 3500) {
      const el = document.getElementById(id);
      if (!el) return;
      el.className = 'msg ' + (type === 'error' ? 'msg-error' : 'msg-success');
      el.innerText = text;
      if (timeout) setTimeout(() => { el.className = 'msg'; el.innerText = ''; }, timeout);
    }

    function validPhone(p) { return /^(?:\+?256|0)?7\d{8}$/.test((p || '').trim()); }
    function validNIN(n) { return /^[A-Z0-9]{8,14}$/i.test((n || '').trim()); }
    function validAlphaNumMin2(v) { return /^[A-Za-z0-9][A-Za-z0-9 .,'-]{1,}$/.test((v || '').trim()); }
    function validProduceType(v) { return /^[A-Za-z][A-Za-z0-9 ,()/-]{1,}$/.test((v || '').trim()); }
    function escapeHtml(v) {
      return String(v || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
    const fieldValidators = {};

    function ensureInvalidFeedback(input) {
      if (!input) return null;
      let feedback = input.parentElement.querySelector('.invalid-feedback[data-live="1"]');
      if (!feedback) {
        feedback = document.createElement('div');
        feedback.className = 'invalid-feedback';
        feedback.dataset.live = '1';
        input.parentElement.appendChild(feedback);
      }
      return feedback;
    }

    function setFieldError(input, message) {
      if (!input) return;
      const feedback = ensureInvalidFeedback(input);
      input.classList.add('is-invalid');
      if (feedback) {
        feedback.textContent = message;
        feedback.style.display = 'block';
      }
    }

    function clearFieldError(input) {
      if (!input) return;
      const feedback = ensureInvalidFeedback(input);
      input.classList.remove('is-invalid');
      if (feedback) feedback.style.display = 'none';
    }

    function wireFieldValidation(inputId, validateFn) {
      const input = document.getElementById(inputId);
      if (!input) return;
      const run = () => {
        const msg = validateFn((input.value || '').trim(), input);
        if (msg) {
          setFieldError(input, msg);
          return false;
        }
        clearFieldError(input);
        return true;
      };
      fieldValidators[inputId] = run;
      ['input', 'change', 'blur'].forEach((evt) => input.addEventListener(evt, run));
    }

    function validateFields(ids) {
      let ok = true;
      ids.forEach((id) => {
        const run = fieldValidators[id];
        if (typeof run === 'function' && !run()) ok = false;
      });
      return ok;
    }

    function readInventoryByBranch() { return JSON.parse(localStorage.getItem('inventoryByBranch') || '{"Maganjo":{},"Matugga":{}}'); }
    function writeInventoryByBranch(v) { localStorage.setItem('inventoryByBranch', JSON.stringify(v)); }
    function formatUgx(v) { return 'UGX ' + (Number(v) || 0).toLocaleString(); }
    function logoutNow() {
      window.KGLApi.logout();
      window.location.replace('index.html');
    }

    function renderRecordTables() {
      const cashRows = document.getElementById('managerCashRows');
      const creditRows = document.getElementById('managerCreditRows');
      const procurementRows = document.getElementById('managerProcurementRows');
      if (!cashRows || !creditRows || !procurementRows) return;

      const sales = JSON.parse(localStorage.getItem('sales') || '[]').filter((r) => r.branch === USER_BRANCH);
      const credits = JSON.parse(localStorage.getItem('credits') || '[]').filter((r) => r.branch === USER_BRANCH);
      const procurements = JSON.parse(localStorage.getItem('procurements') || '[]').filter((r) => r.branch === USER_BRANCH);

      if (!sales.length) {
        cashRows.innerHTML = '<tr><td colspan="6" class="text-muted">No cash sales records yet.</td></tr>';
      } else {
        cashRows.innerHTML = sales.map((r) => (
          `<tr>
            <td>${escapeHtml(r.produce)}</td>
            <td>${Number(r.tonnage || 0)} Kg</td>
            <td>${formatUgx(r.amount)}</td>
            <td>${escapeHtml(r.buyer)}</td>
            <td>${escapeHtml(r.date)} ${escapeHtml(r.time)}</td>
            <td class="d-flex gap-2">
              <button class="btn btn-sm btn-outline-primary" data-edit-cash="${escapeHtml(r.id)}">Edit</button>
              <button class="btn btn-sm btn-outline-danger" data-del-cash="${escapeHtml(r.id)}">Delete</button>
            </td>
          </tr>`
        )).join('');
      }

      if (!credits.length) {
        creditRows.innerHTML = '<tr><td colspan="6" class="text-muted">No credit sales records yet.</td></tr>';
      } else {
        creditRows.innerHTML = credits.map((r) => (
          `<tr>
            <td>${escapeHtml(r.buyer)}</td>
            <td>${escapeHtml(r.produce)}</td>
            <td>${formatUgx(r.amountDue)}</td>
            <td>${escapeHtml(r.dueDate)}</td>
            <td>${escapeHtml(r.dispatch)}</td>
            <td class="d-flex gap-2">
              <button class="btn btn-sm btn-outline-primary" data-edit-credit="${escapeHtml(r.id)}">Edit</button>
              <button class="btn btn-sm btn-outline-danger" data-del-credit="${escapeHtml(r.id)}">Delete</button>
            </td>
          </tr>`
        )).join('');
      }

      if (!procurements.length) {
        procurementRows.innerHTML = '<tr><td colspan="6" class="text-muted">No procurement records yet.</td></tr>';
      } else {
        procurementRows.innerHTML = procurements.map((r) => (
          `<tr>
            <td>${escapeHtml(r.name)}</td>
            <td>${Number(r.tonnage || 0)} Kg</td>
            <td>${formatUgx(r.cost)}</td>
            <td>${escapeHtml(r.dealer)}</td>
            <td>${escapeHtml(r.date)} ${escapeHtml(r.time)}</td>
            <td class="d-flex gap-2">
              <button class="btn btn-sm btn-outline-primary" data-edit-procurement="${escapeHtml(r.id)}">Edit</button>
              <button class="btn btn-sm btn-outline-danger" data-del-procurement="${escapeHtml(r.id)}">Delete</button>
            </td>
          </tr>`
        )).join('');
      }

      renderSalesBoard();
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
      const day = date.getDay(); // 0=Sun
      const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day
      return new Date(date.getFullYear(), date.getMonth(), diff);
    }

    function buildSalesDataset() {
      const sales = JSON.parse(localStorage.getItem('sales') || '[]').map((r) => ({
        id: r.id || r._id || r.ref || `CASH-${Math.random().toString(36).slice(2, 8)}`,
        ref: r.id || r._id || r.ref || 'cash',
        type: 'cash',
        branch: r.branch || USER_BRANCH,
        date: r.date,
        dateObj: parseDateOnly(r.date) || new Date(),
        total: Number(r.amount) || 0,
        balance: 0,
        status: 'Paid',
        customer: r.buyer || 'Walk-in buyer',
        product: r.produce || 'Produce',
        raw: r
      }));
      const credits = JSON.parse(localStorage.getItem('credits') || '[]').map((r) => ({
        id: r.id || r._id || r.ref || `CR-${Math.random().toString(36).slice(2, 8)}`,
        ref: r.id || r._id || r.ref || 'credit',
        type: 'credit',
        branch: r.branch || USER_BRANCH,
        date: r.dispatch || r.dueDate,
        dateObj: parseDateOnly(r.dispatch || r.dueDate) || new Date(),
        total: Number(r.amountDue) || 0,
        balance: Number(r.amountDue) || 0,
        status: 'Pending',
        customer: r.buyer || 'Customer',
        product: r.produce || 'Produce',
        raw: r
      }));
      return [...sales, ...credits].sort((a, b) => (b.dateObj - a.dateObj));
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
      const customerSel = document.getElementById('salesFilterCustomer');
      const productSel = document.getElementById('salesFilterProduct');
      if (!customerSel || !productSel) return;
      const customers = Array.from(new Set(rows.map(r => r.customer))).sort();
      const products = Array.from(new Set(rows.map(r => r.product))).sort();
      const setOpts = (sel, items) => {
        sel.innerHTML = '<option value=\"All\">All</option>' + items.map(v => `<option value=\"${escapeHtml(v)}\">${escapeHtml(v)}</option>`).join('');
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

    function renderSalesBoard() {
      const data = buildSalesDataset();
      renderSalesFiltersOptions(data);
      const rows = applySalesFilters(data);
      const badge = document.getElementById('nav-sales-count');
      if (badge) badge.innerText = data.length || 0;
      const perPage = Number(SALES_STATE.perPage) || 10;
      const totalPages = Math.max(1, Math.ceil(rows.length / perPage));
      if (SALES_STATE.page > totalPages) SALES_STATE.page = totalPages;
      const start = (SALES_STATE.page - 1) * perPage;
      const pageRows = rows.slice(start, start + perPage);
      const tbody = document.getElementById('salesTableBody');
      if (tbody) {
        tbody.innerHTML = pageRows.length ? pageRows.map((r) => (
          `<tr>
            <td><input class=\"form-check-input\" type=\"checkbox\"></td>
            <td class=\"text-primary\">${formatRef(r.ref)}</td>
            <td>${formatDateLabel(r.dateObj)}</td>
            <td><span class=\"branch-pill\"><span class=\"dot\"></span>${escapeHtml(r.branch)}</span></td>
            <td class=\"text-success fw-semibold\">${formatUgx(r.total)}</td>
            <td class=\"text-success\">${formatUgx(r.balance)}</td>
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
      const setText = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = formatUgx(v); };
      setText('salesPageRevenue', pageRevenue);
      setText('salesPageBalance', pageBalance);
      setText('salesAllRevenue', allRevenue);
      setText('salesAllBalance', allBalance);

      const showing = document.getElementById('salesShowing');
      if (showing) {
        const end = Math.min(rows.length, start + pageRows.length);
        showing.innerText = rows.length ? `Showing ${start + 1} to ${end} of ${rows.length} results` : 'No results to show';
      }
      renderSalesPagination(totalPages);
    }

    function renderSalesPagination(totalPages) {
      const container = document.getElementById('salesPagination');
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

    function exportSalesCsv() {
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

    function bindSalesBoardEvents() {
      const quickButtons = document.querySelectorAll('[data-quick-filter]');
      quickButtons.forEach(btn => {
        if (btn.dataset.quickFilter === SALES_STATE.filters.quick) btn.classList.add('active');
      });
      quickButtons.forEach(btn => btn.addEventListener('click', () => {
        quickButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        SALES_STATE.filters.quick = btn.dataset.quickFilter || '';
        SALES_STATE.page = 1;
        renderSalesBoard();
      }));
      const mapChange = (id, key) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('change', () => {
          SALES_STATE.filters[key] = el.value;
          SALES_STATE.page = 1;
          renderSalesBoard();
        });
      };
      ['salesFilterBranch', 'salesFilterStatus', 'salesFilterCustomer', 'salesFilterProduct', 'salesFilterFrom', 'salesFilterTo'].forEach((id, idx) => {
        const keys = ['branch', 'status', 'customer', 'product', 'from', 'to'];
        mapChange(id, keys[idx]);
      });
      const search = document.getElementById('salesSearch');
      if (search) search.addEventListener('input', () => { SALES_STATE.filters.search = search.value.trim(); SALES_STATE.page = 1; renderSalesBoard(); });

      const perPage = document.getElementById('salesPerPage');
      if (perPage) perPage.addEventListener('change', () => {
        SALES_STATE.perPage = Number(perPage.value) || 10;
        SALES_STATE.page = 1;
        renderSalesBoard();
      });

      const pagination = document.getElementById('salesPagination');
      if (pagination) pagination.addEventListener('click', (e) => {
        const page = e.target && e.target.getAttribute('data-page');
        if (!page || e.target.classList.contains('disabled')) return;
        SALES_STATE.page = Number(page);
        renderSalesBoard();
      });

      const resetBtn = document.getElementById('salesFiltersReset');
      if (resetBtn) resetBtn.addEventListener('click', () => {
        SALES_STATE.filters = { quick: '', branch: 'All', status: 'All', customer: 'All', product: 'All', from: '', to: '', search: '' };
        document.querySelectorAll('[data-quick-filter]').forEach(b => b.classList.remove('active'));
        ['salesFilterBranch', 'salesFilterStatus', 'salesFilterCustomer', 'salesFilterProduct', 'salesFilterFrom', 'salesFilterTo', 'salesSearch'].forEach(id => {
          const el = document.getElementById(id);
          if (!el) return;
          if (id === 'salesSearch') el.value = '';
          else if (id === 'salesFilterFrom' || id === 'salesFilterTo') el.value = '';
          else el.value = 'All';
        });
        SALES_STATE.page = 1;
        renderSalesBoard();
      });

      const exportBtn = document.getElementById('exportSalesBtn');
      if (exportBtn) exportBtn.addEventListener('click', exportSalesCsv);
      const newSaleBtn = document.getElementById('newSaleBtn');
      if (newSaleBtn) newSaleBtn.addEventListener('click', () => showSection('cash-section'));
    }

    function initSalesBoard() {
      bindSalesBoardEvents();
      renderSalesBoard();
    }

    function populateProduceSelect(id) {
      const s = document.getElementById(id);
      s.innerHTML = '<option value="">Select Produce...</option>';
      Object.keys(PRODUCE).forEach(p => {
        const o = document.createElement('option');
        o.value = p;
        o.textContent = p;
        s.appendChild(o);
      });
    }

    function populateTypeSelect(selectEl, produceName) {
      if (!selectEl) return;
      const list = produceName ? (PRODUCE_TYPES[produceName] || PRODUCE_TYPES.default) : [];
      selectEl.innerHTML = '<option value=\"\">Select type...</option>' + list.map(t => `<option value=\"${t}\">${t}</option>`).join('');
      selectEl.disabled = !produceName;
    }

    function setupProduceTypeLink(selectId, typeSelectId, priceInputId) {
      const select = document.getElementById(selectId);
      const typeSelect = typeSelectId ? document.getElementById(typeSelectId) : null;
      const priceInput = priceInputId ? document.getElementById(priceInputId) : null;
      function update() {
        const p = select.value;
        const prices = JSON.parse(localStorage.getItem('prices') || '{}');
        if (typeSelect) populateTypeSelect(typeSelect, p);
        if (priceInput) priceInput.value = p ? (prices[p] || 0) : '';
      }
      select.addEventListener('change', update);
      update();
    }

    function renderStockAlertLists() {
      const panel = document.getElementById('stockAlertsPanel');
      const lowList = document.getElementById('homeLowStockList');
      const overList = document.getElementById('homeOverStockList');
      const outList = document.getElementById('homeOutStockList');
      if (!panel || !lowList || !overList || !outList) return;
      const lowItems = stockAlertsCache.lowItems;
      const overItems = stockAlertsCache.overItems;
      const outItems = stockAlertsCache.outItems;
      panel.classList.remove('d-none');

      lowList.innerHTML = lowItems.length
        ? lowItems.map((item) => `<li class="list-group-item d-flex justify-content-between"><span>${item.branch} - ${item.produce}</span><strong>${item.qty} Kg</strong></li>`).join('')
        : '<li class="list-group-item text-muted">No low stock items.</li>';

      overList.innerHTML = overItems.length
        ? overItems.map((item) => `<li class="list-group-item d-flex justify-content-between"><span>${item.branch} - ${item.produce}</span><strong>${item.qty} Kg</strong></li>`).join('')
        : '<li class="list-group-item text-muted">No over stock items.</li>';

      outList.innerHTML = outItems.length
        ? outItems.map((item) => `<li class="list-group-item d-flex justify-content-between text-danger"><span>${item.produce}</span><strong>000 Kg</strong></li>`).join('')
        : '<li class="list-group-item text-danger">No out of stock items.</li>';
    }

    function updateCashAmountStatus() {
      const tonnage = Number(document.getElementById('managerCashTonnage')?.value || 0);
      const unitPrice = Number(document.getElementById('managerCashUnitPrice')?.value || 0);
      const amountInput = document.getElementById('managerCashAmount');
      const hint = document.getElementById('managerCashAmountHint');
      if (!amountInput || !hint) return;

      const expected = tonnage * unitPrice;
      const amount = Number(amountInput.value || 0);

      if (!(tonnage > 0 && unitPrice > 0)) {
        hint.textContent = '';
        hint.className = 'form-text';
        return;
      }

      if (amount === expected) {
        hint.textContent = `Amount is correct: ${formatUgx(expected)}`;
        hint.className = 'form-text text-success';
      } else if (amount < expected) {
        hint.textContent = `Amount is short by ${formatUgx(expected - amount)}. Expected ${formatUgx(expected)}.`;
        hint.className = 'form-text text-danger';
      } else {
        hint.textContent = `Amount is above expected by ${formatUgx(amount - expected)}. Expected ${formatUgx(expected)}.`;
        hint.className = 'form-text text-danger';
      }
    }

    function refreshInventoryDisplay() {
      const inv = readInventoryByBranch();
      const rows = [];
      const visibleBranches = USER_BRANCH === 'All' ? BRANCHES : [USER_BRANCH];
      const LOW_STOCK_LIMIT = 500;
      const lowItems = [];
      const overItems = [];
      const outItems = [];

      visibleBranches.forEach(b => {
        Object.keys(PRODUCE).forEach(p => {
          const qty = Number(inv[b][p]) || 0;
          const qtyLabel = qty <= 0 ? '000 Kg' : `${qty} Kg`;
          rows.push(`<tr><td>${b}</td><td>${p}</td><td>${PRODUCE[p]}</td><td>${qtyLabel}</td></tr>`);
          if (qty > 0 && qty < LOW_STOCK_LIMIT) lowItems.push({ branch: b, produce: p, qty });
          if (qty > LOW_STOCK_LIMIT) overItems.push({ branch: b, produce: p, qty });
          if (qty <= 0) outItems.push({ branch: b, produce: p });
        });
      });

      document.getElementById('inventoryTable').innerHTML = `<table class="table table-sm"><thead><tr><th>Branch</th><th>Produce</th><th>Type</th><th>Available</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;

      const total = visibleBranches.reduce((sum, b) => sum + Object.values(inv[b]).reduce((s, v) => s + (Number(v) || 0), 0), 0);
      const outCount = visibleBranches.reduce((c, b) => c + Object.values(inv[b]).filter(v => (Number(v) || 0) <= 0).length, 0);
      const credits = JSON.parse(localStorage.getItem('credits') || '[]').filter(c => visibleBranches.includes(c.branch));
      stockAlertsCache = { lowItems, overItems, outItems };
      renderStockAlertLists();

      document.getElementById('homeTotalStock').innerText = total.toLocaleString() + ' Kg';
      document.getElementById('homeOutOfStock').innerText = outCount + ' Items';
      document.getElementById('homeCreditCount').innerText = credits.length + ' Records';
      const lowEl = document.getElementById('homeLowStock');
      const overEl = document.getElementById('homeOverStock');
      if (lowEl) lowEl.innerText = lowItems.length + ' Items';
      if (overEl) overEl.innerText = overItems.length + ' Items';
    }

    function populatePricesEditor() {
      const prices = JSON.parse(localStorage.getItem('prices') || '{}');
      const container = document.getElementById('pricesList');
      container.innerHTML = '';
      Object.keys(PRODUCE).forEach(p => {
        const col = document.createElement('div');
        col.className = 'col-md-4 mb-3';
        col.innerHTML = `<label class="form-label">${p} (${PRODUCE[p]})</label><input data-key="${p}" type="number" class="form-control price-input" min="100" value="${prices[p] || ''}" required>`;
        container.appendChild(col);
      });
    }

    async function renderSuppliers() {
      let rows = [];
      try {
        rows = await window.KGLApi.getSuppliers();
      } catch (err) {
        showMsg('supplierMsg', err.message || 'Failed to load suppliers.', 'error');
      }
      const el = document.getElementById('supplierRows');
      if (!rows.length) {
        el.innerHTML = '<tr><td colspan="6" class="text-muted">No suppliers added yet.</td></tr>';
        return;
      }
      el.innerHTML = rows.map((r, index) => (
        `<tr>
          <td>${escapeHtml(r.sourceType)}</td>
          <td>${escapeHtml(r.entityName)}</td>
          <td>${escapeHtml(r.location)}</td>
          <td>${escapeHtml(r.produce)}</td>
          <td>${r.contact ? `<a href="tel:${escapeHtml(r.contact)}">${escapeHtml(r.contact)}</a>` : '<span class="text-muted">N/A</span>'}</td>
          <td><button class="btn btn-sm btn-outline-danger" data-del-supplier="${escapeHtml(r.id)}">Remove</button></td>
        </tr>`
      )).join('');
    }

    document.getElementById('savePricesBtn').addEventListener('click', async function () {
      const prices = JSON.parse(localStorage.getItem('prices') || '{}');
      document.querySelectorAll('.price-input').forEach(i => { prices[i.dataset.key] = Number(i.value) || 0; });
      try {
        await window.KGLApi.savePrices(prices);
        await window.KGLApi.syncState();
        showMsg('pricesMsg', 'Prices saved successfully.', 'success');
      } catch (err) {
        showMsg('pricesMsg', err.message || 'Failed to save prices.', 'error');
      }
    });

    document.getElementById('procurementForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!validateFields(['procureName', 'procureType', 'procureSourceType', 'procureDate', 'procureTime', 'procureTonnage', 'procureCost', 'procureSellPrice', 'procureDealer', 'procureContact'])) {
        showMsg('procureMsg', 'Fix highlighted fields before submitting.', 'error');
        return;
      }
      const name = document.getElementById('procureName').value;
      const type = document.getElementById('procureType').value;
      const sourceType = document.getElementById('procureSourceType').value;
      const date = document.getElementById('procureDate').value;
      const time = document.getElementById('procureTime').value;
      const tonnage = Number(document.getElementById('procureTonnage').value);
      const cost = Number(document.getElementById('procureCost').value);
      const sell = Number(document.getElementById('procureSellPrice').value);
      const branch = document.getElementById('procureBranch').value;
      const dealer = document.getElementById('procureDealer').value.trim();
      const contact = document.getElementById('procureContact').value.trim();

      if (!validPhone(contact)) { showMsg('procureMsg', 'Invalid dealer phone format.', 'error'); return; }
      if (!name || !type || !date || !time) { showMsg('procureMsg', 'Complete all required fields.', 'error'); return; }
      if (tonnage < 1000) { showMsg('procureMsg', 'Tonnage must be at least 1000 Kgs.', 'error'); return; }

      try {
        await window.KGLApi.recordProcurement({ name, type, sourceType, date, time, tonnage, cost, sell, branch, dealer, contact });
        await window.KGLApi.syncState();
        showMsg('procureMsg', 'Procurement recorded and stock updated.', 'success');
        this.reset();
        lockBranchSelectors();
        refreshInventoryDisplay();
        populatePricesEditor();
        renderRecordTables();
      } catch (err) {
        showMsg('procureMsg', err.message || 'Failed to record procurement.', 'error');
      }
    });

    document.getElementById('managerCashForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!validateFields(['managerCashProduce', 'managerCashType', 'managerCashTonnage', 'managerCashAmount', 'managerCashBuyer', 'managerCashAgent', 'managerCashDate', 'managerCashTime'])) {
        showMsg('managerCashMsg', 'Fix highlighted fields before submitting.', 'error');
        return;
      }
      const branch = document.getElementById('managerCashBranch').value;
      const produce = document.getElementById('managerCashProduce').value;
      const type = document.getElementById('managerCashType').value;
      const tonnage = Number(document.getElementById('managerCashTonnage').value);
      const amount = Number(document.getElementById('managerCashAmount').value);
      const buyer = document.getElementById('managerCashBuyer').value.trim();
      const agent = document.getElementById('managerCashAgent').value.trim();
      const date = document.getElementById('managerCashDate').value;
      const time = document.getElementById('managerCashTime').value;
      const unitPrice = Number(document.getElementById('managerCashUnitPrice').value || 0);
      const expectedAmount = tonnage * unitPrice;

      if (amount !== expectedAmount) {
        showMsg('managerCashMsg', `Amount paid must equal sale total (${formatUgx(expectedAmount)}).`, 'error');
        return;
      }

      try {
        await window.KGLApi.recordCashSale({ branch, produce, produceType: type, tonnage, amount, buyer, agent, date, time });
        await window.KGLApi.syncState();
        showMsg('managerCashMsg', 'Cash sale recorded and stock reduced.', 'success');
        this.reset();
        lockBranchSelectors();
        refreshInventoryDisplay();
        renderRecordTables();
      } catch (err) {
        showMsg('managerCashMsg', err.message || 'Failed to record cash sale.', 'error');
      }
    });

    document.getElementById('creditFormManager').addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!validateFields(['creditBuyer', 'creditNIN', 'creditLocation', 'creditContact', 'creditAmountDue', 'creditDueDate', 'creditProduceName', 'creditProduceType', 'creditTonnage', 'creditAgentName', 'creditDispatch'])) {
        showMsg('creditMgrMsg', 'Fix highlighted fields before submitting.', 'error');
        return;
      }
      const buyer = document.getElementById('creditBuyer').value.trim();
      const nin = document.getElementById('creditNIN').value.trim();
      const location = document.getElementById('creditLocation').value.trim();
      const contact = document.getElementById('creditContact').value.trim();
      const amountDue = Number(document.getElementById('creditAmountDue').value);
      const dueDate = document.getElementById('creditDueDate').value;
      const branch = document.getElementById('creditBranch').value;
      const produce = document.getElementById('creditProduceName').value;
      const type = document.getElementById('creditProduceType').value;
      const tonnage = Number(document.getElementById('creditTonnage').value);
      const agent = document.getElementById('creditAgentName').value.trim();
      const dispatch = document.getElementById('creditDispatch').value;

      if (!validNIN(nin)) { showMsg('creditMgrMsg', 'Invalid NIN format.', 'error'); return; }
      if (!validPhone(contact)) { showMsg('creditMgrMsg', 'Invalid phone format.', 'error'); return; }

      try {
        await window.KGLApi.recordCreditSale({ buyer, nin, location, contact, amountDue, dueDate, produce, type, tonnage, agent, branch, dispatch });
        await window.KGLApi.syncState();
        showMsg('creditMgrMsg', 'Credit sale logged and stock reduced.', 'success');
        this.reset();
        lockBranchSelectors();
        refreshInventoryDisplay();
        renderRecordTables();
      } catch (err) {
        showMsg('creditMgrMsg', err.message || 'Failed to log credit sale.', 'error');
      }
    });

    document.getElementById('supplierForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!validateFields(['supplierSourceType', 'supplierEntityName', 'supplierLocation', 'supplierProduce', 'supplierContact'])) {
        showMsg('supplierMsg', 'Fix highlighted fields before submitting.', 'error');
        return;
      }
      const sourceType = document.getElementById('supplierSourceType').value;
      const entityName = document.getElementById('supplierEntityName').value.trim();
      const location = document.getElementById('supplierLocation').value.trim();
      const produce = document.getElementById('supplierProduce').value.trim();
      const contact = document.getElementById('supplierContact').value.trim();

      if (entityName.length < 2 || location.length < 2 || produce.length < 2 || !validPhone(contact)) {
        showMsg('supplierMsg', 'Fill all supplier fields correctly.', 'error');
        return;
      }

      try {
        await window.KGLApi.createSupplier({ sourceType, entityName, location, produce, contact, branch: USER_BRANCH });
        await renderSuppliers();
        showMsg('supplierMsg', 'Supplier added.', 'success');
        this.reset();
      } catch (err) {
        showMsg('supplierMsg', err.message || 'Failed to add supplier.', 'error');
      }
    });

    document.getElementById('supplierRows').addEventListener('click', async function (e) {
      const id = e.target && e.target.getAttribute('data-del-supplier');
      if (!id) return;
      try {
        await window.KGLApi.deleteSupplier(id);
        await renderSuppliers();
        showMsg('supplierMsg', 'Supplier removed.', 'success');
      } catch (err) {
        showMsg('supplierMsg', err.message || 'Failed to remove supplier.', 'error');
      }
    });

    document.getElementById('managerCashRows').addEventListener('click', async function (e) {
      const id = e.target && e.target.getAttribute('data-edit-cash');
      if (id) {
        const sales = JSON.parse(localStorage.getItem('sales') || '[]');
        const row = sales.find((r) => r.id === id);
        if (!row) return;
        const tonnage = Number(window.prompt('Cash sale tonnage (Kgs):', String(row.tonnage || 0)));
        const amount = Number(window.prompt('Cash sale amount (UGX):', String(row.amount || 0)));
        const buyer = String(window.prompt('Buyer name:', row.buyer || '') || '').trim();
        const agent = String(window.prompt('Agent name:', row.agent || '') || '').trim();
        if (!tonnage || !amount || !buyer || !agent) return;
        try {
          await window.KGLApi.updateCashSale(id, {
            branch: row.branch,
            produce: row.produce,
            produceType: row.produceType,
            tonnage,
            amount,
            buyer,
            agent,
            date: row.date,
            time: row.time
          });
          await window.KGLApi.syncState();
          refreshInventoryDisplay();
          renderRecordTables();
        } catch (err) {
          showMsg('managerCashMsg', err.message || 'Failed to edit cash sale.', 'error');
        }
        return;
      }

      const deleteId = e.target && e.target.getAttribute('data-del-cash');
      if (!deleteId) return;
      if (!window.confirm('Delete this cash sale record? The sold stock will be restored to branch inventory.')) return;
      try {
        await window.KGLApi.deleteCashSale(deleteId);
        await window.KGLApi.syncState();
        refreshInventoryDisplay();
        renderRecordTables();
        showMsg('managerCashMsg', 'Cash sale record deleted.', 'success');
      } catch (err) {
        showMsg('managerCashMsg', err.message || 'Failed to delete cash sale.', 'error');
      }
    });

    document.getElementById('managerCreditRows').addEventListener('click', async function (e) {
      const id = e.target && e.target.getAttribute('data-edit-credit');
      if (id) {
        const credits = JSON.parse(localStorage.getItem('credits') || '[]');
        const row = credits.find((r) => r.id === id);
        if (!row) return;
        const amountDue = Number(window.prompt('Amount due (UGX):', String(row.amountDue || 0)));
        const dueDate = String(window.prompt('Due date (YYYY-MM-DD):', row.dueDate || '') || '').trim();
        const dispatch = String(window.prompt('Dispatch date (YYYY-MM-DD):', row.dispatch || '') || '').trim();
        const buyer = String(window.prompt('Buyer name:', row.buyer || '') || '').trim();
        if (!amountDue || !dueDate || !dispatch || !buyer) return;
        try {
          await window.KGLApi.updateCreditSale(id, {
            buyer,
            nin: row.nin,
            location: row.location,
            contact: row.contact,
            amountDue,
            dueDate,
            produce: row.produce,
            type: row.type,
            tonnage: row.tonnage,
            agent: row.agent,
            branch: row.branch,
            dispatch
          });
          await window.KGLApi.syncState();
          refreshInventoryDisplay();
          renderRecordTables();
        } catch (err) {
          showMsg('creditMgrMsg', err.message || 'Failed to edit credit sale.', 'error');
        }
        return;
      }

      const deleteId = e.target && e.target.getAttribute('data-del-credit');
      if (!deleteId) return;
      if (!window.confirm('Delete this credit sale record? The dispatched stock will be restored to branch inventory.')) return;
      try {
        await window.KGLApi.deleteCreditSale(deleteId);
        await window.KGLApi.syncState();
        refreshInventoryDisplay();
        renderRecordTables();
        showMsg('creditMgrMsg', 'Credit sale record deleted.', 'success');
      } catch (err) {
        showMsg('creditMgrMsg', err.message || 'Failed to delete credit sale.', 'error');
      }
    });

    document.getElementById('managerProcurementRows').addEventListener('click', async function (e) {
      const id = e.target && e.target.getAttribute('data-edit-procurement');
      if (id) {
        const procurements = JSON.parse(localStorage.getItem('procurements') || '[]');
        const row = procurements.find((r) => r.id === id);
        if (!row) return;
        const tonnage = Number(window.prompt('Procurement tonnage (Kgs):', String(row.tonnage || 0)));
        const cost = Number(window.prompt('Procurement cost (UGX):', String(row.cost || 0)));
        const sell = Number(window.prompt('Selling price (UGX/Kg):', String(row.sell || 0)));
        const dealer = String(window.prompt('Dealer name:', row.dealer || '') || '').trim();
        const contact = String(window.prompt('Dealer contact:', row.contact || '') || '').trim();
        if (!tonnage || !cost || !sell || !dealer || !contact) return;
        try {
          await window.KGLApi.updateProcurement(id, {
            name: row.name,
            type: row.type,
            sourceType: row.sourceType,
            date: row.date,
            time: row.time,
            tonnage,
            cost,
            sell,
            branch: row.branch,
            dealer,
            contact
          });
          await window.KGLApi.syncState();
          refreshInventoryDisplay();
          populatePricesEditor();
          renderRecordTables();
        } catch (err) {
          showMsg('procureMsg', err.message || 'Failed to edit procurement record.', 'error');
        }
        return;
      }

      const deleteId = e.target && e.target.getAttribute('data-del-procurement');
      if (!deleteId) return;
      if (!window.confirm('Delete this procurement record? This will remove its stock intake if still available.')) return;
      try {
        await window.KGLApi.deleteProcurement(deleteId);
        await window.KGLApi.syncState();
        refreshInventoryDisplay();
        populatePricesEditor();
        renderRecordTables();
        showMsg('procureMsg', 'Procurement record deleted.', 'success');
      } catch (err) {
        showMsg('procureMsg', err.message || 'Failed to delete procurement record.', 'error');
      }
    });

    function showSection(sectionId) {
      const sections = ['sales-section', 'home-section', 'account-section', 'cash-section', 'credit-section', 'procurement-section', 'suppliers-section', 'prices-section'];
      sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden-section');
      });
      const target = document.getElementById(sectionId);
      if (target) target.classList.remove('hidden-section');

      document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
      const navMap = {
        'sales-section': { nav: 'nav-sales', text: 'Sales / <strong>List</strong>' },
        'home-section': { nav: 'nav-home', text: 'Home / <strong>Dashboard</strong>' },
        'account-section': { nav: 'nav-account', text: 'Home / <strong>My Account</strong>' },
        'prices-section': { nav: 'nav-prices', text: 'Home / <strong>Prices</strong>' },
        'cash-section': { nav: 'nav-cash', text: 'Home / Sales / <strong>Cash Sale</strong>' },
        'credit-section': { nav: 'nav-credit', text: 'Home / Sales / <strong>Credit Sale</strong>' },
        'procurement-section': { nav: 'nav-procurement', text: 'Home / Stock / <strong>Procurement</strong>' },
        'suppliers-section': { nav: 'nav-suppliers', text: 'Home / Logistics / <strong>Suppliers</strong>' }
      };
      const cfg = navMap[sectionId];
      if (cfg) {
        const navEl = document.getElementById(cfg.nav);
        if (navEl) navEl.classList.add('active');
        const bc = document.getElementById('breadcrumb');
        if (bc) bc.innerHTML = cfg.text;
      }
    }

    function lockBranchSelectors() {
      ['managerCashBranch', 'creditBranch', 'procureBranch'].forEach(id => {
        const s = document.getElementById(id);
        if (!s) return;
        s.value = USER_BRANCH;
        s.setAttribute('disabled', 'disabled');
      });
    }

    function setupLiveValidation() {
      wireFieldValidation('managerAccountName', (v) => (v.length < 2 || !validAlphaNumMin2(v)) ? 'Enter a valid name (at least 2 characters).' : '');
      wireFieldValidation('managerAccountPassword', (v) => (v && v.length < 4) ? 'Password must be at least 4 characters.' : '');

      wireFieldValidation('managerCashProduce', (v) => !v ? 'Select produce.' : '');
      wireFieldValidation('managerCashType', (v) => !validProduceType(v) ? 'Enter a valid produce type.' : '');
      wireFieldValidation('managerCashTonnage', (v) => Number(v) < 100 ? 'Tonnage must be at least 100 Kgs.' : '');
      wireFieldValidation('managerCashAmount', (v) => {
        const amount = Number(v);
        if (amount < 10000) return 'Amount paid must be at least 10000 UgX.';
        const tonnage = Number(document.getElementById('managerCashTonnage').value || 0);
        const unitPrice = Number(document.getElementById('managerCashUnitPrice').value || 0);
        const expected = tonnage * unitPrice;
        if (tonnage > 0 && unitPrice > 0 && amount !== expected) return `Amount must equal ${formatUgx(expected)}.`;
        return '';
      });
      wireFieldValidation('managerCashBuyer', (v) => !validAlphaNumMin2(v) ? 'Enter a valid buyer name.' : '');
      wireFieldValidation('managerCashAgent', (v) => !validAlphaNumMin2(v) ? 'Enter a valid agent name.' : '');
      wireFieldValidation('managerCashDate', (v) => !v ? 'Date is required.' : '');
      wireFieldValidation('managerCashTime', (v) => !v ? 'Time is required.' : '');

      wireFieldValidation('creditBuyer', (v) => !validAlphaNumMin2(v) ? 'Enter a valid buyer name.' : '');
      wireFieldValidation('creditNIN', (v) => !validNIN(v) ? 'Invalid NIN format.' : '');
      wireFieldValidation('creditLocation', (v) => !validAlphaNumMin2(v) ? 'Enter a valid location.' : '');
      wireFieldValidation('creditContact', (v) => !validPhone(v) ? 'Invalid phone format.' : '');
      wireFieldValidation('creditAmountDue', (v) => Number(v) < 10000 ? 'Amount due must be at least 10000 UgX.' : '');
      wireFieldValidation('creditDueDate', (v) => !v ? 'Due date is required.' : '');
      wireFieldValidation('creditProduceName', (v) => !v ? 'Select produce.' : '');
      wireFieldValidation('creditProduceType', (v) => !validProduceType(v) ? 'Enter a valid produce type.' : '');
      wireFieldValidation('creditTonnage', (v) => Number(v) < 100 ? 'Tonnage must be at least 100 Kgs.' : '');
      wireFieldValidation('creditAgentName', (v) => !validAlphaNumMin2(v) ? 'Enter a valid agent name.' : '');
      wireFieldValidation('creditDispatch', (v) => !v ? 'Dispatch date is required.' : '');

      wireFieldValidation('procureName', (v) => !v ? 'Select produce.' : '');
      wireFieldValidation('procureType', (v) => !validProduceType(v) ? 'Enter a valid produce type.' : '');
      wireFieldValidation('procureSourceType', (v) => !v ? 'Select source type.' : '');
      wireFieldValidation('procureDate', (v) => !v ? 'Date is required.' : '');
      wireFieldValidation('procureTime', (v) => !v ? 'Time is required.' : '');
      wireFieldValidation('procureTonnage', (v) => Number(v) < 1000 ? 'Tonnage must be at least 1000 Kgs.' : '');
      wireFieldValidation('procureCost', (v) => Number(v) < 10000 ? 'Cost must be at least 10000 UgX.' : '');
      wireFieldValidation('procureSellPrice', (v) => Number(v) < 100 ? 'Selling price must be at least 100 UgX/Kg.' : '');
      wireFieldValidation('procureDealer', (v) => !validAlphaNumMin2(v) ? 'Enter a valid dealer name.' : '');
      wireFieldValidation('procureContact', (v) => !validPhone(v) ? 'Invalid dealer phone format.' : '');

      wireFieldValidation('supplierSourceType', (v) => !v ? 'Select source type.' : '');
      wireFieldValidation('supplierEntityName', (v) => !validAlphaNumMin2(v) ? 'Enter a valid entity name.' : '');
      wireFieldValidation('supplierLocation', (v) => !validAlphaNumMin2(v) ? 'Enter a valid location/branch.' : '');
      wireFieldValidation('supplierProduce', (v) => !validAlphaNumMin2(v) ? 'Enter a valid produce list.' : '');
      wireFieldValidation('supplierContact', (v) => !validPhone(v) ? 'Invalid supplier phone format.' : '');
    }

    document.getElementById('managerAccountForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!validateFields(['managerAccountName', 'managerAccountPassword'])) {
        showMsg('managerAccountMsg', 'Fix highlighted fields before submitting.', 'error');
        return;
      }
      const name = document.getElementById('managerAccountName').value.trim();
      const password = document.getElementById('managerAccountPassword').value.trim();

      if (name.length < 2) {
        showMsg('managerAccountMsg', 'Name must be at least 2 characters.', 'error');
        return;
      }
      if (password && password.length < 4) {
        showMsg('managerAccountMsg', 'Password must be at least 4 characters.', 'error');
        return;
      }

      try {
        const payload = { name };
        if (password) payload.password = password;
        await window.KGLApi.updateMyAccount(payload);
        showMsg('managerAccountMsg', 'Change request sent. Director approval is required before account update.', 'success');
        document.getElementById('managerAccountPassword').value = '';
      } catch (err) {
        showMsg('managerAccountMsg', err.message || 'Failed to update account.', 'error');
      }
    });

    document.getElementById('toggleManagerPassword').addEventListener('change', function () {
      document.getElementById('managerAccountPassword').type = this.checked ? 'text' : 'password';
    });

    async function bootstrap() {
      try {
        await window.KGLApi.syncState();
      } catch (err) {
        const b = document.createElement('div');
        b.className = 'banner banner-error';
        b.innerText = 'Session expired. Redirecting to login...';
        document.body.insertBefore(b, document.body.firstChild);
        setTimeout(() => window.location.replace('index.html'), 300);
        return;
      }
      initData();
      populateProduceSelect('procureName');
      populateProduceSelect('managerCashProduce');
      populateProduceSelect('creditProduceName');
      setupLiveValidation();
      setupProduceTypeLink('procureName', 'procureType');
      setupProduceTypeLink('managerCashProduce', 'managerCashType', 'managerCashUnitPrice');
      ['managerCashProduce', 'managerCashTonnage', 'managerCashAmount'].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        ['input', 'change'].forEach((evt) => el.addEventListener(evt, updateCashAmountStatus));
      });
      document.getElementById('managerCashProduce').addEventListener('change', function () {
        updateCashAmountStatus();
      });
      setupProduceTypeLink('creditProduceName', 'creditProduceType');
      populatePricesEditor();
      await renderSuppliers();
      lockBranchSelectors();
      refreshInventoryDisplay();
      renderRecordTables();
      initSalesBoard();

      const today = new Date().toISOString().slice(0, 10);
      const now = new Date().toTimeString().slice(0, 5);
      ['managerCashDate', 'creditDispatch', 'procureDate'].forEach(id => document.getElementById(id).value = today);
      ['managerCashTime', 'procureTime'].forEach(id => document.getElementById(id).value = now);
      document.getElementById('managerAccountName').value = localStorage.getItem('username') || '';
      document.getElementById('managerAccountBranch').value = USER_BRANCH;
      updateCashAmountStatus();
      showSection('sales-section');
    }

    document.addEventListener('DOMContentLoaded', bootstrap);
