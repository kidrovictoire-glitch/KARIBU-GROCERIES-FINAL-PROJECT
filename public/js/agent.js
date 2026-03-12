(function () {
      function validSession() {
        const token = localStorage.getItem('token');
        const role = localStorage.getItem('role');
        const accountRole = localStorage.getItem('accountRole');
        const branch = localStorage.getItem('branch');
        return !!token && role === 'agent' && (!accountRole || accountRole === 'agent') && !!branch && branch !== 'All';
      }
      function redirectToLogin() {
        window.location.replace('index.html');
      }
      function guardSession() {
        if (validSession()) return;
        const b = document.createElement('div');
        b.className = 'banner banner-error';
        b.innerText = 'Access denied: agent role required. Redirecting to login...';
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

    function getAgentBranch() { return localStorage.getItem('branch') || 'Maganjo'; }
    function readInv() { return JSON.parse(localStorage.getItem('inventoryByBranch') || '{"Maganjo":{},"Matugga":{}}'); }
    function writeInv(v) { localStorage.setItem('inventoryByBranch', JSON.stringify(v)); }
    function prices() { return JSON.parse(localStorage.getItem('prices') || '{}'); }
    function logoutNow() {
      window.KGLApi.logout();
      window.location.replace('index.html');
    }

    function showMsg(id, text, type = 'error', timeout = 3500) {
      const el = document.getElementById(id); if (!el) return;
      el.className = 'msg ' + (type === 'error' ? 'msg-error' : 'msg-success');
      el.innerText = text;
      if (timeout) setTimeout(() => { el.className = 'msg'; el.innerText = ''; }, timeout);
    }

    function validPhone(p) { return /^(?:\+?256|0)?7\d{8}$/.test((p || '').trim()); }
    function validNIN(n) { return /^[A-Z0-9]{8,14}$/i.test((n || '').trim()); }
    document.getElementById('toggleAgentPassword').addEventListener('click', function () {
      const input = document.getElementById('agentAccountPassword');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      this.innerText = show ? 'Hide Password' : 'Show Password';
    });

    function populateProduce(selectId) {
      const s = document.getElementById(selectId);
      s.innerHTML = '<option value="">Select Produce...</option>';
      Object.keys(PRODUCE).forEach(p => {
        const o = document.createElement('option');
        o.value = p;
        o.textContent = p;
        s.appendChild(o);
      });
    }

    function populateTypeOptions(selectEl, produceName) {
      const list = produceName ? (PRODUCE_TYPES[produceName] || PRODUCE_TYPES.default) : [];
      selectEl.innerHTML = '<option value=\"\">Select type...</option>' + list.map(v => `<option value=\"${v}\">${v}</option>`).join('');
      selectEl.disabled = !produceName;
    }

    function bindProduce(selectId, typeId, priceId) {
      const s = document.getElementById(selectId);
      const t = document.getElementById(typeId);
      const p = priceId ? document.getElementById(priceId) : null;
      if (t) populateTypeOptions(t, '');
      function update() {
        const prod = s.value;
        if (t) populateTypeOptions(t, prod);
        if (p) p.value = prod ? (prices()[prod] || 0) : '';
        if (prod) checkStockAlert(prod);
      }
      s.addEventListener('change', update);
      update();
    }

    function branchStock(branch) {
      const inv = readInv();
      return Object.values(inv[branch] || {}).reduce((s, v) => s + (Number(v) || 0), 0);
    }

    function checkStockAlert(produce) {
      const branch = getAgentBranch();
      const inv = readInv();
      const available = Number((inv[branch] || {})[produce] || 0);
      const box = document.getElementById('stockAlert');
      if (available <= 0) box.style.display = 'block'; else box.style.display = 'none';
    }

    function renderInventoryPanel() {
      const branch = getAgentBranch();
      const inv = readInv();
      const rows = Object.keys(PRODUCE).map(p => `<tr><td>${p}</td><td>${PRODUCE[p]}</td><td>${(inv[branch] || {})[p] || 0} Kg</td></tr>`).join('');
      document.getElementById('agentInventory').innerHTML = `<div class="section-title">${branch} Inventory</div><div class="table-responsive"><table class="table table-sm"><thead><tr><th>Produce</th><th>Type</th><th>Available</th></tr></thead><tbody>${rows}</tbody></table></div>`;
      document.getElementById('agentBranchStock').innerText = branchStock(branch).toLocaleString() + ' Kg';
    }

    function refreshTodaySales() {
      const branch = getAgentBranch();
      const user = localStorage.getItem('username') || 'agent';
      const today = new Date().toISOString().slice(0, 10);
      const sales = JSON.parse(localStorage.getItem('sales') || '[]');
      const total = sales.filter(s => (s.branch === branch) && (s.agent === user || s.recordedByRole === 'agent') && String(s.date || '').slice(0, 10) === today)
        .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
      document.getElementById('agentSalesToday').innerText = 'UGX ' + total.toLocaleString();
    }

    function renderRecordTables() {
      const branch = getAgentBranch();
      const user = localStorage.getItem('username') || 'agent';
      const sales = JSON.parse(localStorage.getItem('sales') || '[]')
        .filter((r) => r.branch === branch && String(r.agent || '').toLowerCase() === String(user).toLowerCase());
      const credits = JSON.parse(localStorage.getItem('credits') || '[]')
        .filter((r) => r.branch === branch && String(r.agent || '').toLowerCase() === String(user).toLowerCase());

      const cashRows = document.getElementById('agentCashRows');
      const creditRows = document.getElementById('agentCreditRows');

      if (!sales.length) {
        cashRows.innerHTML = '<tr><td colspan="6" class="text-muted">No cash sales records yet.</td></tr>';
      } else {
        cashRows.innerHTML = sales.map((r) => (
          `<tr>
            <td>${r.produce}</td>
            <td>${Number(r.tonnage || 0)} Kg</td>
            <td>UGX ${(Number(r.amount || 0)).toLocaleString()}</td>
            <td>${r.buyer}</td>
            <td>${r.date} ${r.time}</td>
            <td class="d-flex gap-2">
              <button class="btn btn-sm btn-outline-primary" data-edit-agent-cash="${r.id || ''}">Edit</button>
              <button class="btn btn-sm btn-outline-danger" data-del-agent-cash="${r.id || ''}">Delete</button>
            </td>
          </tr>`
        )).join('');
      }

      if (!credits.length) {
        creditRows.innerHTML = '<tr><td colspan="6" class="text-muted">No credit records yet.</td></tr>';
      } else {
        creditRows.innerHTML = credits.map((r) => (
          `<tr>
            <td>${r.buyer}</td>
            <td>${r.produce}</td>
            <td>UGX ${(Number(r.amountDue || 0)).toLocaleString()}</td>
            <td>${r.dueDate}</td>
            <td>${r.dispatch}</td>
            <td class="d-flex gap-2">
              <button class="btn btn-sm btn-outline-primary" data-edit-agent-credit="${r.id || ''}">Edit</button>
              <button class="btn btn-sm btn-outline-danger" data-del-agent-credit="${r.id || ''}">Delete</button>
            </td>
          </tr>`
        )).join('');
      }
    }

    document.getElementById('agentCashForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      const branch = getAgentBranch();
      const produce = document.getElementById('cashProduce').value;
      const type = document.getElementById('cashType').value;
      const tonnage = Number(document.getElementById('cashTonnage').value);
      const amount = Number(document.getElementById('cashAmount').value);
      const buyer = document.getElementById('cashBuyer').value.trim();
      const date = document.getElementById('cashDate').value;
      const time = document.getElementById('cashTime').value;
      const agent = localStorage.getItem('username') || 'agent';

      try {
        await window.KGLApi.recordCashSale({ branch, produce, produceType: type, tonnage, amount, buyer, agent, date, time });
        await window.KGLApi.syncState();
        showMsg('agentCashMsg', 'Cash sale recorded.', 'success');
        this.reset();
        renderInventoryPanel();
        refreshTodaySales();
        renderRecordTables();
      } catch (err) {
        showMsg('agentCashMsg', err.message || 'Failed to record sale.', 'error');
        checkStockAlert(produce);
      }
    });

    document.getElementById('agentCreditForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      const branch = getAgentBranch();
      const buyer = document.getElementById('creditBuyer').value.trim();
      const nin = document.getElementById('creditNIN').value.trim();
      const location = document.getElementById('creditLocation').value.trim();
      const contact = document.getElementById('creditContact').value.trim();
      const amountDue = Number(document.getElementById('creditAmount').value);
      const dueDate = document.getElementById('creditDueDate').value;
      const produce = document.getElementById('creditProduce').value;
      const type = document.getElementById('creditType').value;
      const tonnage = Number(document.getElementById('creditTonnage').value);
      const agent = localStorage.getItem('username') || 'agent';
      const dispatch = document.getElementById('creditDispatchDate').value;

      if (!validNIN(nin)) { showMsg('agentCreditMsg', 'Invalid NIN format.', 'error'); return; }
      if (!validPhone(contact)) { showMsg('agentCreditMsg', 'Invalid phone format.', 'error'); return; }

      try {
        await window.KGLApi.recordCreditSale({ buyer, nin, location, contact, amountDue, dueDate, produce, type, tonnage, agent, branch, dispatch });
        await window.KGLApi.syncState();
        showMsg('agentCreditMsg', 'Credit sale recorded.', 'success');
        this.reset();
        renderInventoryPanel();
        renderRecordTables();
      } catch (err) {
        showMsg('agentCreditMsg', err.message || 'Failed to record credit sale.', 'error');
        checkStockAlert(produce);
      }
    });

    document.getElementById('agentCashRows').addEventListener('click', async function (e) {
      const id = e.target && e.target.getAttribute('data-edit-agent-cash');
      if (id) {
        const sales = JSON.parse(localStorage.getItem('sales') || '[]');
        const row = sales.find((r) => r.id === id);
        if (!row) return;
        const tonnage = Number(window.prompt('Cash sale tonnage (Kgs):', String(row.tonnage || 0)));
        const amount = Number(window.prompt('Cash sale amount (UGX):', String(row.amount || 0)));
        const buyer = String(window.prompt('Buyer name:', row.buyer || '') || '').trim();
        if (!tonnage || !amount || !buyer) return;
        try {
          await window.KGLApi.updateCashSale(id, {
            branch: row.branch,
            produce: row.produce,
            produceType: row.produceType,
            tonnage,
            amount,
            buyer,
            agent: row.agent,
            date: row.date,
            time: row.time
          });
          await window.KGLApi.syncState();
          renderInventoryPanel();
          refreshTodaySales();
          renderRecordTables();
        } catch (err) {
          showMsg('agentCashMsg', err.message || 'Failed to edit cash sale.', 'error');
        }
        return;
      }

      const deleteId = e.target && e.target.getAttribute('data-del-agent-cash');
      if (!deleteId) return;
      if (!window.confirm('Delete this cash sale record? The sold stock will be restored.')) return;
      try {
        await window.KGLApi.deleteCashSale(deleteId);
        await window.KGLApi.syncState();
        renderInventoryPanel();
        refreshTodaySales();
        renderRecordTables();
        showMsg('agentCashMsg', 'Cash sale record deleted.', 'success');
      } catch (err) {
        showMsg('agentCashMsg', err.message || 'Failed to delete cash sale.', 'error');
      }
    });

    document.getElementById('agentCreditRows').addEventListener('click', async function (e) {
      const id = e.target && e.target.getAttribute('data-edit-agent-credit');
      if (id) {
        const credits = JSON.parse(localStorage.getItem('credits') || '[]');
        const row = credits.find((r) => r.id === id);
        if (!row) return;
        const amountDue = Number(window.prompt('Amount due (UGX):', String(row.amountDue || 0)));
        const dueDate = String(window.prompt('Due date (YYYY-MM-DD):', row.dueDate || '') || '').trim();
        const dispatch = String(window.prompt('Dispatch date (YYYY-MM-DD):', row.dispatch || '') || '').trim();
        if (!amountDue || !dueDate || !dispatch) return;
        try {
          await window.KGLApi.updateCreditSale(id, {
            buyer: row.buyer,
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
          renderInventoryPanel();
          renderRecordTables();
        } catch (err) {
          showMsg('agentCreditMsg', err.message || 'Failed to edit credit record.', 'error');
        }
        return;
      }

      const deleteId = e.target && e.target.getAttribute('data-del-agent-credit');
      if (!deleteId) return;
      if (!window.confirm('Delete this credit record? The dispatched stock will be restored.')) return;
      try {
        await window.KGLApi.deleteCreditSale(deleteId);
        await window.KGLApi.syncState();
        renderInventoryPanel();
        renderRecordTables();
        showMsg('agentCreditMsg', 'Credit sale record deleted.', 'success');
      } catch (err) {
        showMsg('agentCreditMsg', err.message || 'Failed to delete credit record.', 'error');
      }
    });

    document.getElementById('agentAccountForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      const name = document.getElementById('agentAccountName').value.trim();
      const password = document.getElementById('agentAccountPassword').value.trim();

      if (name.length < 2) { showMsg('agentAccountMsg', 'Name must be at least 2 characters.', 'error'); return; }
      if (password && password.length < 4) { showMsg('agentAccountMsg', 'Password must be at least 4 characters.', 'error'); return; }

      try {
        const payload = { name };
        if (password) payload.password = password;
        const result = await window.KGLApi.updateMyAccount(payload);
        if (result && result.user && result.user.name) {
          localStorage.setItem('username', result.user.name);
          document.getElementById('agentNameTag').innerText = 'Sales Agent: ' + result.user.name;
          document.getElementById('creditAgentName').value = result.user.name;
        }
        showMsg('agentAccountMsg', 'Account updated successfully.', 'success');
        document.getElementById('agentAccountPassword').value = '';
      } catch (err) {
        showMsg('agentAccountMsg', err.message || 'Failed to update account.', 'error');
      }
    });

    function showSection(sectionId) {
      ['home-section', 'account-section', 'cash-section', 'credit-section'].forEach(id => document.getElementById(id).classList.add('hidden-section'));
      document.getElementById(sectionId).classList.remove('hidden-section');
      document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
      const map = {
        'home-section': { nav: 'nav-home', text: 'Agent / <strong>Home</strong>' },
        'account-section': { nav: 'nav-account', text: 'Agent / <strong>My Account</strong>' },
        'cash-section': { nav: 'nav-cash', text: 'Agent / <strong>Cash Sale</strong>' },
        'credit-section': { nav: 'nav-credit', text: 'Agent / <strong>Credit Sale</strong>' }
      };
      document.getElementById(map[sectionId].nav).classList.add('active');
      document.getElementById('breadcrumb').innerHTML = map[sectionId].text;
    }

    async function boot() {
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
      const uname = localStorage.getItem('username') || 'Agent';
      const branch = getAgentBranch();
      document.getElementById('agentNameTag').innerText = 'Sales Agent: ' + uname;
      document.getElementById('creditAgentName').value = uname;
      document.getElementById('agentBranchLabel').innerText = 'Branch: ' + branch;
      document.getElementById('agentAccountName').value = uname;
      document.getElementById('agentAccountBranch').value = branch;

      populateProduce('cashProduce');
      populateProduce('creditProduce');
      bindProduce('cashProduce', 'cashType', 'cashPrice');
      bindProduce('creditProduce', 'creditType');

      const today = new Date().toISOString().slice(0, 10);
      const now = new Date().toTimeString().slice(0, 5);
      document.getElementById('cashDate').value = today;
      document.getElementById('cashTime').value = now;
      document.getElementById('creditDispatchDate').value = today;

      renderInventoryPanel();
      refreshTodaySales();
      renderRecordTables();
    }

    document.addEventListener('DOMContentLoaded', boot);
