(function () {
  const API_BASE = "";

  function token() {
    return localStorage.getItem("token") || "";
  }

  function headers(extra) {
    const h = { "Content-Type": "application/json", ...(extra || {}) };
    if (token()) h.Authorization = "Bearer " + token();
    return h;
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("accountRole");
    localStorage.removeItem("username");
    localStorage.removeItem("branch");
  }

  async function request(method, url, body) {
    try {
      const res = await fetch(API_BASE + url, {
        method,
        headers: headers(),
        body: body ? JSON.stringify(body) : undefined
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Request failed");
      return data;
    } catch (err) {
      if (err && err.message === "Failed to fetch") {
        throw new Error("Cannot reach server. Ensure backend is running on localhost:5000.");
      }
      throw err;
    }
  }

  async function syncState() {
    const state = await request("GET", "/api/state");
    localStorage.setItem("inventoryByBranch", JSON.stringify(state.inventoryByBranch || { Maganjo: {}, Matugga: {} }));
    localStorage.setItem("prices", JSON.stringify(state.prices || {}));
    localStorage.setItem("sales", JSON.stringify(state.sales || []));
    localStorage.setItem("credits", JSON.stringify(state.credits || []));
    localStorage.setItem("procurements", JSON.stringify(state.procurements || []));
    localStorage.setItem("suppliers", JSON.stringify(state.suppliers || []));
    if (Array.isArray(state.staff) && state.staff.length) {
      const staff = state.staff.map((s) => ({
        name: s.name,
        role: String(s.role || "").charAt(0).toUpperCase() + String(s.role || "").slice(1),
        branch: s.branch,
        id: s.id
      }));
      localStorage.setItem("staff", JSON.stringify(staff));
    }
    return state;
  }

  window.KGLApi = {
    request,
    syncState,
    login: (payload) => request("POST", "/api/auth/login", payload),
    registerUser: (payload) => request("POST", "/users/register", payload),
    savePrices: (payload) => request("PUT", "/api/prices", payload),
    recordProcurement: (payload) => request("POST", "/api/procurements", payload),
    updateProcurement: (id, payload) => request("PUT", `/api/procurements/${id}`, payload),
    deleteProcurement: (id) => request("DELETE", `/api/procurements/${id}`),
    recordCashSale: (payload) => request("POST", "/api/sales/cash", payload),
    updateCashSale: (id, payload) => request("PUT", `/api/sales/cash/${id}`, payload),
    deleteCashSale: (id) => request("DELETE", `/api/sales/cash/${id}`),
    recordCreditSale: (payload) => request("POST", "/api/sales/credit", payload),
    updateCreditSale: (id, payload) => request("PUT", `/api/sales/credit/${id}`, payload),
    deleteCreditSale: (id) => request("DELETE", `/api/sales/credit/${id}`),
    getSuppliers: () => request("GET", "/api/suppliers"),
    createSupplier: (payload) => request("POST", "/api/suppliers", payload),
    deleteSupplier: (id) => request("DELETE", `/api/suppliers/${id}`),
    getDirectorAggregates: () => request("GET", "/api/director/aggregates"),
    getStaff: () => request("GET", "/api/staff"),
    createStaff: (payload) => request("POST", "/api/staff", payload),
    updateStaff: (id, payload) => request("PUT", `/api/staff/${id}`, payload),
    deleteStaff: (id) => request("DELETE", `/api/staff/${id}`),
    updateMyAccount: (payload) => request("PUT", "/api/account/me", payload),
    getAccountChangeRequests: () => request("GET", "/api/account-change-requests"),
    approveAccountChangeRequest: (id, payload) => request("POST", `/api/account-change-requests/${id}/approve`, payload || {}),
    rejectAccountChangeRequest: (id, payload) => request("POST", `/api/account-change-requests/${id}/reject`, payload || {}),
    getMyAccountChangeRequests: () => request("GET", "/api/account-change-requests/me"),
    logout
  };
})();
