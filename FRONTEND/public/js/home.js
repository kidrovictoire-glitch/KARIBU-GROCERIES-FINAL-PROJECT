function isValidSession() {
      const token = localStorage.getItem('token');
      const role = (localStorage.getItem('role') || '').toLowerCase();
      const accountRole = (localStorage.getItem('accountRole') || '').toLowerCase();
      return !!token && !!role && (!accountRole || accountRole === role);
    }

    function guardSession() {
      if (isValidSession()) return;
      window.location.replace('index.html');
    }

    window.addEventListener('pageshow', guardSession);
    window.addEventListener('popstate', guardSession);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') guardSession();
    });
    guardSession();

function logoutNow() {
      if (window.KGLApi && typeof window.KGLApi.logout === 'function') window.KGLApi.logout();
      else {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('accountRole');
        localStorage.removeItem('username');
        localStorage.removeItem('branch');
      }
      window.location.replace('index.html');
    }

    document.getElementById('currentDate').innerText = new Date().toDateString();

    const role = localStorage.getItem('role') || 'agent';
    const username = localStorage.getItem('username') || 'User';
    const branch = localStorage.getItem('branch') || 'Maganjo';

    document.getElementById('userName').innerText = username;
    document.getElementById('userBranch').innerText = 'Branch: ' + branch;

    if (role !== 'manager') document.querySelectorAll('.manager-only').forEach(el => el.classList.add('hidden'));
    if (role !== 'agent') document.querySelectorAll('.agent-only').forEach(el => el.classList.add('hidden'));
    if (role !== 'director') document.querySelectorAll('.director-only').forEach(el => el.classList.add('hidden'));

    const inv = JSON.parse(localStorage.getItem('inventoryByBranch') || '{"Maganjo":{},"Matugga":{}}');
    const total = Object.values(inv.Maganjo || {}).reduce((s, v) => s + (Number(v) || 0), 0) + Object.values(inv.Matugga || {}).reduce((s, v) => s + (Number(v) || 0), 0);
    document.getElementById('stockAlert').innerText = total > 0 ? 'Items available' : 'Out of Stock';
