const PRODUCE = ['Beans', 'Grain Maize', 'Cow Peas', 'G-nuts', 'Soybeans'];

    function initData() {
      if (!localStorage.getItem('inventoryByBranch')) {
        const byBranch = { Maganjo: {}, Matugga: {} };
        PRODUCE.forEach(p => { byBranch.Maganjo[p] = 0; byBranch.Matugga[p] = 0; });
        localStorage.setItem('inventoryByBranch', JSON.stringify(byBranch));
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

      if (!localStorage.getItem('staff')) {
        localStorage.setItem('staff', JSON.stringify([
          { name: 'Orban', role: 'Director', branch: 'All', password: 'orban123' },
          { name: 'Branch Manager', role: 'Manager', branch: 'Maganjo', password: 'manager123' },
          { name: 'Branch Manager', role: 'Manager', branch: 'Matugga', password: 'manager123' }
        ]));
      }
    }

    function showLoginMsg(text) {
      const msg = document.getElementById('loginMsg');
      msg.className = 'msg msg-error';
      msg.innerText = text;
      setTimeout(() => { msg.innerText = ''; msg.className = 'msg'; }, 7000);
    }

    function normalize(v) { return String(v || '').trim().toLowerCase(); }

    initData();
    const toggleBtn = document.getElementById('togglePassword');
    toggleBtn.addEventListener('click', function () {
      const pwd = document.getElementById('password');
      const show = pwd.type === 'password';
      pwd.type = show ? 'text' : 'password';
      this.textContent = show ? '🙈' : '👁️';
    });
    document.getElementById('forgotPasswordLink').addEventListener('click', function (e) {
      e.preventDefault();
      const help = document.getElementById('forgotPasswordHelp');
      help.style.display = help.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('loginForm').addEventListener('submit', async function (e) {
      e.preventDefault();

      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value.trim();
      if (!username || !password) {
        showLoginMsg('Enter name and password.');
        return;
      }

      try {
        const result = await window.KGLApi.login({ username, password });
        if (!result || !result.user || !result.user.role || !result.token) {
          throw new Error('Login response is missing user/token. Ensure /api/auth/login is served by your backend.');
        }
        const accountRole = normalize(result.user.role);
        localStorage.setItem('token', result.token);
        localStorage.setItem('role', accountRole);
        localStorage.setItem('accountRole', accountRole);
        localStorage.setItem('username', result.user.name);
        localStorage.setItem('branch', accountRole === 'director' ? 'All' : result.user.branch);
        await window.KGLApi.syncState();

        if (accountRole === 'director') window.location.replace('director.html');
        else if (accountRole === 'manager') window.location.replace('manager.html');
        else window.location.replace('agent.html');
      } catch (err) {
        showLoginMsg(err.message || 'Login failed. Check your credentials or server connection.');
      }
    });
