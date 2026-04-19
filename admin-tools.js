const loginForm = document.getElementById("loginForm");
const loginStatus = document.getElementById("loginStatus");
const sessionStatus = document.getElementById("sessionStatus");
const queueMeta = document.getElementById("queueMeta");
const queueList = document.getElementById("queueList");
const allOilsMeta = document.getElementById("allOilsMeta");
const allOilsList = document.getElementById("allOilsList");
const sessionPanel = document.getElementById("sessionPanel");
const queuePanel = document.getElementById("queuePanel");
const allOilsPanel = document.getElementById("allOilsPanel");
const signOutButton = document.getElementById("signOutButton");
const refreshQueueButton = document.getElementById("refreshQueue");

const ADMIN_SESSION_KEY = "soap-admin-session";
const ADMIN_API_URL = `${String(window.APP_CONFIG?.SUPABASE_URL || "").replace(/\/$/, "")}/functions/v1/${String(window.APP_CONFIG?.ADMIN_FUNCTION_NAME || "soap-admin")}`;
const ADMIN_API_KEY = String(window.APP_CONFIG?.SUPABASE_ANON_KEY || "");

function normalizeText(value) {
  return (value || "").trim();
}

function setStatus(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("error", Boolean(isError));
  element.classList.toggle("success", Boolean(message && !isError));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(value) {
  if (!value) {
    return "Unknown date";
  }
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function formatMetric(value, digits = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return "-";
  }
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(parsed);
}

function getStoredToken() {
  return window.sessionStorage.getItem(ADMIN_SESSION_KEY) || "";
}

function storeToken(token) {
  if (token) {
    window.sessionStorage.setItem(ADMIN_SESSION_KEY, token);
    return;
  }
  window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

function updateSessionUi(isSignedIn) {
  loginForm.style.display = isSignedIn ? "none" : "grid";
  sessionPanel.hidden = !isSignedIn;
  queuePanel.hidden = !isSignedIn;
  allOilsPanel.hidden = !isSignedIn;
  sessionPanel.classList.toggle("active", Boolean(isSignedIn));
  queuePanel.classList.toggle("active", Boolean(isSignedIn));
  allOilsPanel.classList.toggle("active", Boolean(isSignedIn));
}

async function adminRequest(action, payload = {}) {
  const response = await fetch(ADMIN_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ADMIN_API_KEY,
      Authorization: `Bearer ${ADMIN_API_KEY}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    throw new Error(data?.error || "Admin request failed.");
  }
  return data;
}

function renderQueue(items) {
  queueList.innerHTML = "";
  if (!items.length) {
    queueList.innerHTML = '<article class="admin-card"><p>No pending oil submissions right now.</p></article>';
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "admin-card";
    card.innerHTML = `
      <div class="admin-card-header">
        <h4>${escapeHtml(item.name)}</h4>
        <span class="admin-badge">Pending</span>
      </div>
      <p><strong>Submitted By:</strong> ${escapeHtml(item.submitted_by || "Anonymous")}</p>
      <p><strong>Submitted:</strong> ${escapeHtml(formatDate(item.created_at))}</p>
      <p><strong>NaOH SAP:</strong> ${escapeHtml(formatMetric(item.naoh_sap, 3))}</p>
      <p><strong>KOH SAP:</strong> ${escapeHtml(formatMetric(item.koh_sap, 3))}</p>
      <p><strong>Profile:</strong> Hardness ${escapeHtml(formatMetric(item.hardness))}, Cleansing ${escapeHtml(formatMetric(item.cleansing))}, Condition ${escapeHtml(formatMetric(item.condition))}, INS ${escapeHtml(formatMetric(item.ins))}</p>
      <div class="btn-row">
        <button class="btn btn-primary btn-small" type="button" data-approve="${item.id}">Approve</button>
        <button class="btn btn-danger btn-small" type="button" data-reject="${item.id}">Reject</button>
      </div>
    `;
    queueList.appendChild(card);
  });
}

function renderAllOils(items) {
  allOilsList.innerHTML = "";
  if (!items.length) {
    allOilsList.innerHTML = '<article class="admin-card"><p>No oil records found.</p></article>';
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "admin-card";
    card.innerHTML = `
      <div class="admin-card-header">
        <h4>${escapeHtml(item.name)}</h4>
        <span class="admin-badge ${item.status === "approved" ? "approved" : "pending"}">${escapeHtml(item.status || "unknown")}</span>
      </div>
      <p><strong>NaOH SAP:</strong> ${escapeHtml(formatMetric(item.naoh_sap, 3))}</p>
      <p><strong>KOH SAP:</strong> ${escapeHtml(formatMetric(item.koh_sap, 3))}</p>
      <p><strong>Submitted By:</strong> ${escapeHtml(item.submitted_by || "Anonymous")}</p>
      <p><strong>Updated:</strong> ${escapeHtml(formatDate(item.updated_at || item.created_at))}</p>
      <div class="btn-row">
        <button class="btn btn-danger btn-small" type="button" data-delete-oil="${item.id}">Delete</button>
      </div>
    `;
    allOilsList.appendChild(card);
  });
}

async function verifySession() {
  const token = getStoredToken();
  if (!token) {
    updateSessionUi(false);
    document.body.classList.remove("auth-loading");
    return false;
  }

  try {
    const data = await adminRequest("verify", { token });
    if (!data?.valid) {
      throw new Error("Session invalid");
    }
    updateSessionUi(true);
    document.body.classList.remove("auth-loading");
    return true;
  } catch {
    storeToken("");
    updateSessionUi(false);
    queueMeta.textContent = "Your admin session has expired. Please sign in again.";
    allOilsMeta.textContent = "Your admin session has expired. Please sign in again.";
    document.body.classList.remove("auth-loading");
    return false;
  }
}

async function loadPendingQueue() {
  const token = getStoredToken();
  if (!token) {
    queueMeta.textContent = "Sign in as admin to load pending oil submissions.";
    queueList.innerHTML = "";
    return;
  }
  queueMeta.textContent = "Loading pending oil submissions...";
  try {
    const data = await adminRequest("listPendingOils", { token });
    const items = Array.isArray(data?.items) ? data.items : [];
    queueMeta.textContent = `${items.length} pending oil submission${items.length === 1 ? "" : "s"} in the queue`;
    renderQueue(items);
  } catch (error) {
    queueMeta.textContent = error.message || "Pending oils could not be loaded.";
  }
}

async function loadAllOils() {
  const token = getStoredToken();
  if (!token) {
    allOilsMeta.textContent = "Sign in as admin to load all oil records.";
    allOilsList.innerHTML = "";
    return;
  }
  allOilsMeta.textContent = "Loading all oil records...";
  try {
    const data = await adminRequest("listAllOils", { token });
    const items = Array.isArray(data?.items) ? data.items : [];
    allOilsMeta.textContent = `${items.length} oil record${items.length === 1 ? "" : "s"} found`;
    renderAllOils(items);
  } catch (error) {
    allOilsMeta.textContent = error.message || "Oil records could not be loaded.";
  }
}

async function approveOil(id) {
  try {
    await adminRequest("approveOil", { token: getStoredToken(), oilId: id });
    setStatus(sessionStatus, "Oil approved and now visible in the public reference table.");
    await loadPendingQueue();
    await loadAllOils();
  } catch (error) {
    setStatus(sessionStatus, error.message || "Oil could not be approved.", true);
  }
}

async function rejectOil(id) {
  try {
    await adminRequest("rejectOil", { token: getStoredToken(), oilId: id });
    setStatus(sessionStatus, "Pending oil rejected and removed.");
    await loadPendingQueue();
    await loadAllOils();
  } catch (error) {
    setStatus(sessionStatus, error.message || "Oil could not be rejected.", true);
  }
}

async function deleteOil(id) {
  try {
    await adminRequest("deleteOil", { token: getStoredToken(), oilId: id });
    setStatus(sessionStatus, "Oil deleted.");
    await loadPendingQueue();
    await loadAllOils();
  } catch (error) {
    setStatus(sessionStatus, error.message || "Oil could not be deleted.", true);
  }
}

queueList.addEventListener("click", async (event) => {
  const approveId = event.target.closest("[data-approve]")?.dataset.approve;
  const rejectId = event.target.closest("[data-reject]")?.dataset.reject;
  if (approveId) {
    await approveOil(approveId);
  }
  if (rejectId) {
    await rejectOil(rejectId);
  }
});

allOilsList.addEventListener("click", async (event) => {
  const deleteId = event.target.closest("[data-delete-oil]")?.dataset.deleteOil;
  if (deleteId) {
    await deleteOil(deleteId);
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = normalizeText(document.getElementById("adminPassword").value);
  if (!password) {
    setStatus(loginStatus, "Enter the admin password.", true);
    return;
  }
  setStatus(loginStatus, "Signing in...");
  try {
    const data = await adminRequest("login", { password });
    if (!data?.token) {
      throw new Error("Admin login failed.");
    }
    storeToken(data.token);
    document.getElementById("adminPassword").value = "";
    updateSessionUi(true);
    setStatus(loginStatus, "Signed in successfully.");
    await loadPendingQueue();
    await loadAllOils();
  } catch (error) {
    setStatus(loginStatus, error.message || "Admin login failed.", true);
  }
});

signOutButton.addEventListener("click", async () => {
  const token = getStoredToken();
  try {
    if (token) {
      await adminRequest("logout", { token });
    }
  } catch {
    // Ignore sign-out cleanup errors.
  }
  storeToken("");
  updateSessionUi(false);
  queueMeta.textContent = "Sign in as admin to load pending oil submissions.";
  queueList.innerHTML = "";
  allOilsMeta.textContent = "Sign in as admin to load all oil records.";
  allOilsList.innerHTML = "";
  setStatus(sessionStatus, "");
  setStatus(loginStatus, "");
});

refreshQueueButton.addEventListener("click", async () => {
  await loadPendingQueue();
  await loadAllOils();
});

(async () => {
  const valid = await verifySession();
  if (valid) {
    await loadPendingQueue();
    await loadAllOils();
  }
})();
