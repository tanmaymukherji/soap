import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SOAP_SERVICE_ROLE_KEY") ?? "";
const gmailClientId = Deno.env.get("GMAIL_CLIENT_ID") ?? "";
const gmailClientSecret = Deno.env.get("GMAIL_CLIENT_SECRET") ?? "";
const gmailRefreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN") ?? "";
const gmailSenderEmail = Deno.env.get("GMAIL_SENDER_EMAIL") ?? "";
const gmailNotifyRecipient = Deno.env.get("SOAP_NOTIFY_RECIPIENT") ?? "";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
  },
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

function requireString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function hashToken(token: string) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function generateToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function toBase64Url(input: string) {
  return btoa(input)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function getGmailAccessToken() {
  if (!gmailClientId || !gmailClientSecret || !gmailRefreshToken) {
    throw new Error("Gmail secrets are not configured.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: gmailClientId,
      client_secret: gmailClientSecret,
      refresh_token: gmailRefreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || "Could not refresh Gmail access token.");
  }

  return String(data.access_token);
}

async function sendOilNotification(oilName: string) {
  if (!gmailSenderEmail || !gmailNotifyRecipient) {
    throw new Error("Gmail sender or recipient is not configured.");
  }

  const accessToken = await getGmailAccessToken();
  const subject = "New Soap Oil Added, please validate";
  const bodyLines = [
    "New soap oil entry added, please validate.",
    "",
    `Oil: ${oilName || "Unnamed Oil"}`,
    `Submitted At: ${new Date().toISOString()}`,
  ];

  const rawMessage = [
    `From: ${gmailSenderEmail}`,
    `To: ${gmailNotifyRecipient}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    bodyLines.join("\n"),
  ].join("\r\n");

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      raw: toBase64Url(rawMessage),
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error?.message || "Gmail notification could not be sent.");
  }

  return data;
}

async function validateSession(token: string) {
  const tokenHash = await hashToken(token);

  const { data, error } = await supabase
    .from("soap_admin_sessions")
    .select("id, username, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  if (new Date(data.expires_at).getTime() <= Date.now()) {
    await supabase.from("soap_admin_sessions").delete().eq("id", data.id);
    return null;
  }

  await supabase
    .from("soap_admin_sessions")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return data;
}

async function verifyAdminPassword(username: string, password: string) {
  const { data, error } = await supabase.rpc("soap_admin_password_matches", {
    p_username: username,
    p_password: password,
  });

  if (error) {
    throw new Error(`Admin password verification failed: ${error.message}`);
  }

  return Boolean(data);
}

async function createAdminPasswordHash(password: string) {
  const { data, error } = await supabase.rpc("soap_hash_admin_password", {
    p_password: password,
  });

  if (error || typeof data !== "string" || !data) {
    throw new Error(error?.message || "Admin password hash could not be generated.");
  }

  return data;
}

async function handleLogin(password: string) {
  const { data, error } = await supabase
    .from("soap_admin_accounts")
    .select("username, password_hash")
    .eq("username", "admin")
    .maybeSingle();

  if (error) {
    return errorResponse(`Admin account lookup failed: ${error.message}`, 500);
  }

  if (!data) {
    return errorResponse("Admin account does not exist yet.", 401);
  }

  if (!data.password_hash) {
    return errorResponse("Admin password has not been initialized yet.", 401);
  }

  let validPassword = false;

  try {
    validPassword = await verifyAdminPassword("admin", password);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Admin password verification failed.";
    return errorResponse(message, 500);
  }

  if (!validPassword) {
    return errorResponse("Invalid admin password.", 401);
  }

  const token = generateToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await supabase.from("soap_admin_sessions").delete().eq("username", "admin");

  const { error: sessionError } = await supabase.from("soap_admin_sessions").insert({
    username: "admin",
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (sessionError) {
    return errorResponse("Admin session could not be created.", 500);
  }

  return jsonResponse({
    token,
    username: "admin",
    expires_at: expiresAt,
  });
}

async function handleVerify(token: string) {
  const session = await validateSession(token);
  return jsonResponse({
    valid: Boolean(session),
    username: session?.username ?? null,
    expires_at: session?.expires_at ?? null,
  });
}

async function handleListPendingOils(token: string) {
  const session = await validateSession(token);

  if (!session) {
    return errorResponse("Invalid admin session.", 401);
  }

  const { data, error } = await supabase
    .from("soap_oils")
    .select("id, name, submitted_by, naoh_sap, koh_sap, hardness, cleansing, condition, bubbly, creamy, iodine, ins, lauric, myristic, palmitic, stearic, ricinoleic, oleic, linoleic, linolenic, saturated, unsaturated, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    return errorResponse("Pending oil submissions could not be loaded.", 500);
  }

  return jsonResponse({ items: data ?? [] });
}

async function handleListAllOils(token: string) {
  const session = await validateSession(token);

  if (!session) {
    return errorResponse("Invalid admin session.", 401);
  }

  const { data, error } = await supabase
    .from("soap_oils")
    .select("id, name, submitted_by, naoh_sap, koh_sap, hardness, cleansing, condition, bubbly, creamy, iodine, ins, lauric, myristic, palmitic, stearic, ricinoleic, oleic, linoleic, linolenic, saturated, unsaturated, status, approved_at, approved_by, created_at, updated_at")
    .order("name", { ascending: true });

  if (error) {
    return errorResponse("All oil records could not be loaded.", 500);
  }

  return jsonResponse({ items: data ?? [] });
}

async function handleApproveOil(token: string, oilId: string) {
  const session = await validateSession(token);

  if (!session) {
    return errorResponse("Invalid admin session.", 401);
  }

  const { error } = await supabase
    .from("soap_oils")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: session.username,
      updated_at: new Date().toISOString(),
    })
    .eq("id", oilId);

  if (error) {
    return errorResponse(`Oil could not be approved: ${error.message}`, 500);
  }

  return jsonResponse({ ok: true });
}

async function handleRejectOil(token: string, oilId: string) {
  const session = await validateSession(token);

  if (!session) {
    return errorResponse("Invalid admin session.", 401);
  }

  const { error } = await supabase
    .from("soap_oils")
    .delete()
    .eq("id", oilId)
    .eq("status", "pending");

  if (error) {
    return errorResponse(`Oil could not be rejected: ${error.message}`, 500);
  }

  return jsonResponse({ ok: true });
}

async function handleDeleteOil(token: string, oilId: string) {
  const session = await validateSession(token);

  if (!session) {
    return errorResponse("Invalid admin session.", 401);
  }

  const { error } = await supabase
    .from("soap_oils")
    .delete()
    .eq("id", oilId);

  if (error) {
    return errorResponse(`Oil could not be deleted: ${error.message}`, 500);
  }

  return jsonResponse({ ok: true });
}

async function handleNotifyNewOil(oilName: string) {
  try {
    await sendOilNotification(oilName);
    return jsonResponse({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Oil notification failed.";
    return errorResponse(message, 500);
  }
}

async function handleChangePassword(token: string, currentPassword: string, newPassword: string) {
  const session = await validateSession(token);

  if (!session) {
    return errorResponse("Invalid admin session.", 401);
  }

  if (newPassword.length < 10) {
    return errorResponse("New password must be at least 10 characters long.", 400);
  }

  const { data, error } = await supabase
    .from("soap_admin_accounts")
    .select("password_hash")
    .eq("username", session.username)
    .maybeSingle();

  if (error || !data?.password_hash) {
    return errorResponse("Current admin password could not be verified.", 400);
  }

  let validPassword = false;

  try {
    validPassword = await verifyAdminPassword(session.username, currentPassword);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Current admin password could not be verified.";
    return errorResponse(message, 500);
  }

  if (!validPassword) {
    return errorResponse("Current password is incorrect.", 401);
  }

  let nextHash = "";

  try {
    nextHash = await createAdminPasswordHash(newPassword);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Admin password hash could not be generated.";
    return errorResponse(message, 500);
  }

  const { error: updateError } = await supabase
    .from("soap_admin_accounts")
    .update({
      password_hash: nextHash,
      updated_at: new Date().toISOString(),
    })
    .eq("username", session.username);

  if (updateError) {
    return errorResponse("Admin password could not be updated.", 500);
  }

  return jsonResponse({ ok: true });
}

async function handleLogout(token: string) {
  const tokenHash = await hashToken(token);
  await supabase.from("soap_admin_sessions").delete().eq("token_hash", tokenHash);
  return jsonResponse({ ok: true });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return errorResponse("Method not allowed.", 405);
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return errorResponse("Function secrets are not configured.", 500);
  }

  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body.", 400);
  }

  const action = requireString(body.action);
  const token = requireString(body.token);
  const password = requireString(body.password);
  const currentPassword = requireString(body.currentPassword);
  const newPassword = requireString(body.newPassword);
  const oilId = requireString(body.oilId);
  const oilName = requireString(body.oilName);

  switch (action) {
    case "login":
      return await handleLogin(password);
    case "verify":
      return await handleVerify(token);
    case "listPendingOils":
      return await handleListPendingOils(token);
    case "listAllOils":
      return await handleListAllOils(token);
    case "approveOil":
      return await handleApproveOil(token, oilId);
    case "rejectOil":
      return await handleRejectOil(token, oilId);
    case "deleteOil":
      return await handleDeleteOil(token, oilId);
    case "notifyNewOil":
      return await handleNotifyNewOil(oilName);
    case "changePassword":
      return await handleChangePassword(token, currentPassword, newPassword);
    case "logout":
      return await handleLogout(token);
    default:
      return errorResponse("Unknown admin action.", 400);
  }
});
