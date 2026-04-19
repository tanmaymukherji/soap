const changePasswordForm = document.getElementById("changePasswordForm");
const changePasswordStatus = document.getElementById("changePasswordStatus");

const ADMIN_SESSION_KEY = "soap-admin-session";
const ADMIN_API_URL = `${String(window.APP_CONFIG?.SUPABASE_URL || "").replace(/\/$/, "")}/functions/v1/${String(window.APP_CONFIG?.ADMIN_FUNCTION_NAME || "soap-admin")}`;
const ADMIN_API_KEY = String(window.APP_CONFIG?.SUPABASE_ANON_KEY || "");

function normalizeText(value) {
  return (value || "").trim();
}

function setStatus(message, isError = false) {
  changePasswordStatus.textContent = message;
  changePasswordStatus.classList.toggle("error", Boolean(isError));
  changePasswordStatus.classList.toggle("success", Boolean(message && !isError));
}

function getStoredToken() {
  return window.sessionStorage.getItem(ADMIN_SESSION_KEY) || "";
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

async function ensureSession() {
  const token = getStoredToken();
  if (!token) {
    window.location.href = "./admin-tools.html";
    return;
  }

  try {
    const data = await adminRequest("verify", { token });
    if (!data?.valid) {
      window.location.href = "./admin-tools.html";
    }
  } catch {
    window.location.href = "./admin-tools.html";
  }
}

changePasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const currentPassword = normalizeText(document.getElementById("currentPassword").value);
  const newPassword = normalizeText(document.getElementById("newPassword").value);
  const confirmPassword = normalizeText(document.getElementById("confirmPassword").value);

  if (!currentPassword || !newPassword || !confirmPassword) {
    setStatus("Fill in all password fields.", true);
    return;
  }

  if (newPassword.length < 10) {
    setStatus("New password must be at least 10 characters long.", true);
    return;
  }

  if (newPassword !== confirmPassword) {
    setStatus("New password and confirmation do not match.", true);
    return;
  }

  setStatus("Updating password...");
  try {
    await adminRequest("changePassword", {
      token: getStoredToken(),
      currentPassword,
      newPassword,
    });
    changePasswordForm.reset();
    setStatus("Admin password updated successfully.");
  } catch (error) {
    setStatus(error.message || "Admin password could not be updated.", true);
  }
});

ensureSession();
