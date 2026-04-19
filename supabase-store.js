window.AppDataStore = (() => {
  const TABLE = () => (window.APP_CONFIG && window.APP_CONFIG.SUPABASE_TABLE) || "soap_oils";
  const ADMIN_FUNCTION = () => String(window.APP_CONFIG?.ADMIN_FUNCTION_NAME || "soap-admin");
  const ADMIN_API_URL = () => `${String(window.APP_CONFIG?.SUPABASE_URL || "").replace(/\/$/, "")}/functions/v1/${ADMIN_FUNCTION()}`;
  const ADMIN_API_KEY = () => String(window.APP_CONFIG?.SUPABASE_ANON_KEY || "");
  let client = null;

  const FIELDS = [
    "naohSap",
    "kohSap",
    "hardness",
    "cleansing",
    "condition",
    "bubbly",
    "creamy",
    "iodine",
    "ins",
    "lauric",
    "myristic",
    "palmitic",
    "stearic",
    "ricinoleic",
    "oleic",
    "linoleic",
    "linolenic",
    "saturated",
    "unsaturated",
  ];

  function getClient() {
    if (client) {
      return client;
    }
    const config = window.APP_CONFIG || {};
    if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
      throw new Error("Missing Supabase config. Check config.js.");
    }
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      throw new Error("Supabase client library failed to load.");
    }
    client = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
    return client;
  }

  function normalizeOptionalNumber(value) {
    if (value === "" || value === null || value === undefined) {
      return null;
    }
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) {
      throw new Error("All oil property values must be valid numbers.");
    }
    return parsed;
  }

  function normalizeOil(payload) {
    const oil = {
      name: String(payload?.name || "").trim(),
      submittedBy: String(payload?.submittedBy || "").trim(),
    };

    if (!oil.name) {
      throw new Error("Oil name is required.");
    }

    FIELDS.forEach((field) => {
      oil[field] = normalizeOptionalNumber(payload?.[field]);
    });

    if (oil.naohSap === null || oil.kohSap === null) {
      throw new Error("NaOH SAP and KOH SAP are required.");
    }

    return oil;
  }

  function toRow(oil) {
    return {
      name: oil.name,
      submitted_by: oil.submittedBy || null,
      naoh_sap: oil.naohSap,
      koh_sap: oil.kohSap,
      hardness: oil.hardness,
      cleansing: oil.cleansing,
      condition: oil.condition,
      bubbly: oil.bubbly,
      creamy: oil.creamy,
      iodine: oil.iodine,
      ins: oil.ins,
      lauric: oil.lauric,
      myristic: oil.myristic,
      palmitic: oil.palmitic,
      stearic: oil.stearic,
      ricinoleic: oil.ricinoleic,
      oleic: oil.oleic,
      linoleic: oil.linoleic,
      linolenic: oil.linolenic,
      saturated: oil.saturated,
      unsaturated: oil.unsaturated,
    };
  }

  function fromRow(row) {
    return {
      name: row.name,
      submittedBy: row.submitted_by || "",
      naohSap: row.naoh_sap,
      kohSap: row.koh_sap,
      hardness: row.hardness,
      cleansing: row.cleansing,
      condition: row.condition,
      bubbly: row.bubbly,
      creamy: row.creamy,
      iodine: row.iodine,
      ins: row.ins,
      lauric: row.lauric,
      myristic: row.myristic,
      palmitic: row.palmitic,
      stearic: row.stearic,
      ricinoleic: row.ricinoleic,
      oleic: row.oleic,
      linoleic: row.linoleic,
      linolenic: row.linolenic,
      saturated: row.saturated,
      unsaturated: row.unsaturated,
    };
  }

  async function adminRequest(action, payload = {}) {
    const response = await fetch(ADMIN_API_URL(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ADMIN_API_KEY(),
        Authorization: `Bearer ${ADMIN_API_KEY()}`,
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

  async function notifyNewOil(oilName) {
    await adminRequest("notifyNewOil", { oilName });
  }

  async function loadApprovedOils() {
    const { data, error } = await getClient()
      .from(TABLE())
      .select("name, submitted_by, naoh_sap, koh_sap, hardness, cleansing, condition, bubbly, creamy, iodine, ins, lauric, myristic, palmitic, stearic, ricinoleic, oleic, linoleic, linolenic, saturated, unsaturated")
      .eq("status", "approved")
      .order("name");
    if (error) {
      throw new Error(`Supabase load failed: ${error.message}`);
    }
    return (data || []).map(fromRow);
  }

  async function submitOil(payload) {
    const oil = normalizeOil(payload);
    const { error } = await getClient().from(TABLE()).insert({
      ...toRow(oil),
      status: "pending",
      approved_at: null,
      approved_by: null,
    });
    if (error) {
      if (error.code === "23505") {
        throw new Error("An oil with this name already exists or is already waiting for approval.");
      }
      throw new Error(`Supabase write failed: ${error.message}`);
    }

    try {
      await notifyNewOil(oil.name);
    } catch (notifyError) {
      console.error(notifyError);
    }

    return oil;
  }

  return { loadApprovedOils, submitOil };
})();
