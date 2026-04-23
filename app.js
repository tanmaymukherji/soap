const PROPERTY_RULES = [
  { key: "hardness", label: "Hardness", ideal: "29 - 54", min: 29, max: 54, type: "range" },
  { key: "cleansing", label: "Cleansing", ideal: "12 - 22", min: 12, max: 22, type: "range" },
  { key: "condition", label: "Condition", ideal: "44 - 69", min: 44, max: 69, type: "range" },
  { key: "bubbly", label: "Bubbly", ideal: "14 - 46", min: 14, max: 46, type: "range" },
  { key: "creamy", label: "Creamy", ideal: "16 - 48", min: 16, max: 48, type: "range" },
  { key: "iodine", label: "Iodine", ideal: "41 - 70", min: 41, max: 70, type: "range" },
  { key: "ins", label: "INS", ideal: "136 - 165", min: 136, max: 165, type: "range" },
  { key: "lauric", label: "Lauric", ideal: "12:0", min: 12, type: "minimum" },
  { key: "myristic", label: "Myristic", ideal: "14:0", min: 14, type: "minimum" },
  { key: "palmitic", label: "Palmitic", ideal: "16:0", min: 16, type: "minimum" },
  { key: "stearic", label: "Stearic", ideal: "18:0", min: 18, type: "minimum" },
  { key: "ricinoleic", label: "Ricinoleic", ideal: "18:1", min: 18, type: "minimum" },
  { key: "oleic", label: "Oleic", ideal: "18:1", min: 18, type: "minimum" },
  { key: "linoleic", label: "Linoleic", ideal: "18:2", min: 18, type: "minimum" },
  { key: "linolenic", label: "Linolenic", ideal: "18:3", min: 18, type: "minimum" },
];

const OIL_FIELDS = [
  { key: "naohSap", label: "NaOH SAP", step: "0.001", required: true, decimals: 3 },
  { key: "kohSap", label: "KOH SAP", step: "0.001", required: true, decimals: 3 },
  { key: "hardness", label: "Hardness", step: "0.1", decimals: 1 },
  { key: "cleansing", label: "Cleansing", step: "0.1", decimals: 1 },
  { key: "condition", label: "Condition", step: "0.1", decimals: 1 },
  { key: "bubbly", label: "Bubbly", step: "0.1", decimals: 1 },
  { key: "creamy", label: "Creamy", step: "0.1", decimals: 1 },
  { key: "iodine", label: "Iodine", step: "0.1", decimals: 1 },
  { key: "ins", label: "INS", step: "0.1", decimals: 1 },
  { key: "lauric", label: "Lauric", step: "0.1", decimals: 1 },
  { key: "myristic", label: "Myristic", step: "0.1", decimals: 1 },
  { key: "palmitic", label: "Palmitic", step: "0.1", decimals: 1 },
  { key: "stearic", label: "Stearic", step: "0.1", decimals: 1 },
  { key: "ricinoleic", label: "Ricinoleic", step: "0.1", decimals: 1 },
  { key: "oleic", label: "Oleic", step: "0.1", decimals: 1 },
  { key: "linoleic", label: "Linoleic", step: "0.1", decimals: 1 },
  { key: "linolenic", label: "Linolenic", step: "0.1", decimals: 1 },
  { key: "saturated", label: "Saturated", step: "0.1", decimals: 1 },
  { key: "unsaturated", label: "Unsaturated", step: "0.1", decimals: 1 },
];

const RECIPE_SLOTS = ["A", "B", "C"];
const DEFAULT_SELECTIONS = [
  { name: "Coconut Oil, 76 deg", percentage: 20 },
  { name: "Groundnut Oil", percentage: 80 },
  { name: "", percentage: 0 },
];

const baseOils = Array.isArray(window.SOAP_OILS) ? window.SOAP_OILS : [];
let oils = [];
let oilLookup = new Map();

const elements = {
  totalOilWeight: document.querySelector("#totalOilWeight"),
  lyeType: document.querySelector("#lyeType"),
  waterLyeRatio: document.querySelector("#waterLyeRatio"),
  recipeRows: document.querySelector("#recipeRows"),
  recipeSummary: document.querySelector("#recipeSummary"),
  propertyTableBody: document.querySelector("#propertyTableBody"),
  totalsWarning: document.querySelector("#totalsWarning"),
  selectedOilCount: document.querySelector("#selectedOilCount"),
  percentageTotal: document.querySelector("#percentageTotal"),
  referenceSearch: document.querySelector("#referenceSearch"),
  referenceSort: document.querySelector("#referenceSort"),
  referenceTableBody: document.querySelector("#referenceTableBody"),
  referenceMeta: document.querySelector("#referenceMeta"),
  submitOilForm: document.querySelector("#submitOilForm"),
  submitOilStatus: document.querySelector("#submitOilStatus"),
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function clampNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseOptionalNumber(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getMetricValue(oil, key) {
  const raw = oil?.[key];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function setStatus(element, message, isError = false) {
  if (!element) {
    return;
  }
  element.textContent = message;
  element.classList.toggle("error", Boolean(isError));
  element.classList.toggle("success", Boolean(message && !isError));
}

function buildOilCatalog(approvedOils = []) {
  const catalog = approvedOils.length ? approvedOils : baseOils;
  oils = [...catalog].sort((left, right) => left.name.localeCompare(right.name));
  oilLookup = new Map(oils.map((oil) => [oil.name, oil]));
}

function createOilOptions(selectedName = "") {
  const blankOption = `<option value="">Select an oil</option>`;
  const oilOptions = oils
    .map((oil) => {
      const selected = oil.name === selectedName ? " selected" : "";
      return `<option value="${escapeHtml(oil.name)}"${selected}>${escapeHtml(oil.name)}</option>`;
    })
    .join("");

  return blankOption + oilOptions;
}

function buildRecipeInputs() {
  elements.recipeRows.innerHTML = RECIPE_SLOTS.map((slot, index) => {
    const preset = DEFAULT_SELECTIONS[index];
    return `
      <div class="recipe-row">
        <div>
          <strong>Oil ${slot}</strong>
          <label for="oil${slot}Name">Oil selection</label>
          <select id="oil${slot}Name" data-role="oil-name">${createOilOptions(preset.name)}</select>
        </div>
        <div>
          <label for="oil${slot}Percent">Percentage</label>
          <input id="oil${slot}Percent" data-role="oil-percent" type="number" min="0" max="100" step="0.1" value="${preset.percentage}">
        </div>
        <div>
          <label for="oil${slot}Weight">Weight</label>
          <input id="oil${slot}Weight" type="text" value="0 gm" readonly>
        </div>
      </div>
    `;
  }).join("");
}

function refreshOilSelectors() {
  RECIPE_SLOTS.forEach((slot) => {
    const select = document.querySelector(`#oil${slot}Name`);
    if (!select) {
      return;
    }
    const currentValue = select.value;
    select.innerHTML = createOilOptions(currentValue);
  });
}

function readRecipe() {
  return RECIPE_SLOTS.map((slot) => {
    const name = document.querySelector(`#oil${slot}Name`).value;
    const percentage = clampNumber(document.querySelector(`#oil${slot}Percent`).value, 0);
    return {
      slot,
      name,
      percentage,
      ratio: percentage / 100,
      oil: oilLookup.get(name) ?? null,
    };
  });
}

function evaluateProperty(value, rule) {
  if (!Number.isFinite(value)) {
    return { className: "status-watch", label: "No data" };
  }

  if (rule.type === "range") {
    if (value < rule.min) {
      return { className: "status-low", label: "Below range" };
    }
    if (value > rule.max) {
      return { className: "status-high", label: "Above range" };
    }
    return { className: "status-ok", label: "In range" };
  }

  if (value >= rule.min) {
    return { className: "status-ok", label: "Meets target" };
  }
  return { className: "status-low", label: "Below target" };
}

function calculateState() {
  const totalOilWeight = clampNumber(elements.totalOilWeight.value, 0);
  const waterLyeRatio = clampNumber(elements.waterLyeRatio.value, 0);
  const lyeType = elements.lyeType.value;
  const recipe = readRecipe();

  const selectedOils = recipe.filter((item) => item.name);
  const percentageTotal = recipe.reduce((sum, item) => sum + item.percentage, 0);

  recipe.forEach((item) => {
    const weight = totalOilWeight * item.ratio;
    const weightField = document.querySelector(`#oil${item.slot}Weight`);
    weightField.value = `${formatNumber(weight)} gm`;
  });

  const lyeWeight = recipe.reduce((sum, item) => {
    const sapValue = getMetricValue(item.oil, lyeType === "NaOH" ? "naohSap" : "kohSap");
    return sum + sapValue * totalOilWeight * item.ratio;
  }, 0);

  const waterWeight = lyeWeight * waterLyeRatio;
  const totalInput = recipe.reduce((sum, item) => sum + totalOilWeight * item.ratio, 0) + lyeWeight + waterWeight;

  const propertyRows = PROPERTY_RULES.map((rule) => {
    const mixValue = recipe.reduce((sum, item) => sum + getMetricValue(item.oil, rule.key) * item.ratio, 0);
    return {
      ...rule,
      value: mixValue,
      status: evaluateProperty(mixValue, rule),
    };
  });

  const saturated = recipe.reduce((sum, item) => sum + getMetricValue(item.oil, "saturated") * item.ratio, 0);
  const unsaturated = recipe.reduce((sum, item) => sum + getMetricValue(item.oil, "unsaturated") * item.ratio, 0);

  return {
    totalOilWeight,
    lyeType,
    waterLyeRatio,
    recipe,
    selectedOils,
    percentageTotal,
    lyeWeight,
    waterWeight,
    totalInput,
    saturated,
    unsaturated,
    propertyRows,
  };
}

function renderRecipeSummary(state) {
  elements.recipeSummary.innerHTML = `
    <div class="summary-row">
      <strong>${state.lyeType}</strong>
      <span>${formatNumber(state.lyeWeight)} gm</span>
    </div>
    <div class="summary-row">
      <strong>Water</strong>
      <span>${formatNumber(state.waterWeight)} gm</span>
    </div>
    <div class="summary-row">
      <strong>Total Input</strong>
      <span>${formatNumber(state.totalInput)} gm</span>
    </div>
  `;

  elements.selectedOilCount.textContent = String(state.selectedOils.length);
  elements.percentageTotal.textContent = `${formatNumber(state.percentageTotal)}%`;
  elements.totalsWarning.hidden = Math.abs(state.percentageTotal - 100) < 0.001;
}

function renderProperties(state) {
  const rows = state.propertyRows
    .map((row) => `
      <tr>
        <td>${row.label}</td>
        <td>${formatNumber(row.value, 1)}</td>
        <td>${row.ideal}</td>
        <td><span class="property-status ${row.status.className}">${row.status.label}</span></td>
      </tr>
    `)
    .join("");

  elements.propertyTableBody.innerHTML = rows + `
    <tr>
      <td>Saturated</td>
      <td>${formatNumber(state.saturated, 1)}</td>
      <td class="muted">Reference only</td>
      <td><span class="property-status status-watch">Info</span></td>
    </tr>
    <tr>
      <td>Unsaturated</td>
      <td>${formatNumber(state.unsaturated, 1)}</td>
      <td class="muted">Reference only</td>
      <td><span class="property-status status-watch">Info</span></td>
    </tr>
  `;
}

function renderReferenceTable() {
  const search = elements.referenceSearch.value.trim().toLowerCase();
  const sortKey = elements.referenceSort.value;

  const filtered = oils.filter((oil) => oil.name.toLowerCase().includes(search));

  filtered.sort((left, right) => {
    if (sortKey === "name") {
      return left.name.localeCompare(right.name);
    }

    const leftValue = getMetricValue(left, sortKey);
    const rightValue = getMetricValue(right, sortKey);
    return rightValue - leftValue || left.name.localeCompare(right.name);
  });

  elements.referenceTableBody.innerHTML = filtered
    .slice(0, 100)
    .map((oil) => `
      <tr>
        <td>${escapeHtml(oil.name)}</td>
        <td>${formatNumber(getMetricValue(oil, "naohSap"), 3)}</td>
        <td>${formatNumber(getMetricValue(oil, "kohSap"), 3)}</td>
        <td>${formatNumber(getMetricValue(oil, "hardness"), 1)}</td>
        <td>${formatNumber(getMetricValue(oil, "cleansing"), 1)}</td>
        <td>${formatNumber(getMetricValue(oil, "condition"), 1)}</td>
        <td>${formatNumber(getMetricValue(oil, "bubbly"), 1)}</td>
        <td>${formatNumber(getMetricValue(oil, "creamy"), 1)}</td>
        <td>${formatNumber(getMetricValue(oil, "iodine"), 1)}</td>
        <td>${formatNumber(getMetricValue(oil, "ins"), 1)}</td>
        <td>${formatNumber(getMetricValue(oil, "lauric"), 1)}</td>
        <td>${formatNumber(getMetricValue(oil, "myristic"), 1)}</td>
        <td>${formatNumber(getMetricValue(oil, "palmitic"), 1)}</td>
        <td>${formatNumber(getMetricValue(oil, "stearic"), 1)}</td>
        <td>${formatNumber(getMetricValue(oil, "ricinoleic"), 1)}</td>
        <td>${formatNumber(getMetricValue(oil, "oleic"), 1)}</td>
        <td>${formatNumber(getMetricValue(oil, "linoleic"), 1)}</td>
        <td>${formatNumber(getMetricValue(oil, "linolenic"), 1)}</td>
        <td>${formatNumber(getMetricValue(oil, "saturated"), 1)}</td>
        <td>${formatNumber(getMetricValue(oil, "unsaturated"), 1)}</td>
      </tr>
    `)
    .join("");

  if (elements.referenceMeta) {
    elements.referenceMeta.textContent = `${filtered.length} approved oil record${filtered.length === 1 ? "" : "s"} available`;
  }
}

function render() {
  const state = calculateState();
  renderRecipeSummary(state);
  renderProperties(state);
  renderReferenceTable();
}

function readOilSubmissionForm() {
  const payload = {
    name: String(document.querySelector("#submitOilName")?.value || "").trim(),
    submittedBy: String(document.querySelector("#submitSubmittedBy")?.value || "").trim(),
  };

  OIL_FIELDS.forEach((field) => {
    payload[field.key] = parseOptionalNumber(document.querySelector(`#submit${field.key[0].toUpperCase()}${field.key.slice(1)}`)?.value);
  });

  return payload;
}

async function handleOilSubmission(event) {
  event.preventDefault();

  if (!window.AppDataStore?.submitOil) {
    setStatus(elements.submitOilStatus, "New oil submission is not enabled until Supabase config is added.", true);
    return;
  }

  const payload = readOilSubmissionForm();
  if (!payload.name) {
    setStatus(elements.submitOilStatus, "Oil name is required.", true);
    return;
  }

  if (payload.naohSap === null || payload.kohSap === null) {
    setStatus(elements.submitOilStatus, "Both NaOH SAP and KOH SAP are required.", true);
    return;
  }

  setStatus(elements.submitOilStatus, "Submitting for admin approval...");
  try {
    await window.AppDataStore.submitOil(payload);
    elements.submitOilForm.reset();
    setStatus(elements.submitOilStatus, `Oil "${payload.name}" submitted for admin approval.`);
  } catch (error) {
    setStatus(elements.submitOilStatus, error.message || "Oil submission failed.", true);
  }
}

async function syncApprovedOils() {
  if (!window.AppDataStore?.loadApprovedOils) {
    buildOilCatalog();
    refreshOilSelectors();
    render();
    return;
  }

  try {
    const approvedOils = await window.AppDataStore.loadApprovedOils();
    buildOilCatalog(approvedOils);
  } catch (error) {
    console.error(error);
    buildOilCatalog();
  }

  refreshOilSelectors();
  render();
}

function setupEvents() {
  document.querySelectorAll("input, select").forEach((control) => {
    control.addEventListener("input", render);
    control.addEventListener("change", render);
  });

  if (elements.submitOilForm) {
    elements.submitOilForm.addEventListener("submit", handleOilSubmission);
  }
}

async function init() {
  buildOilCatalog();
  buildRecipeInputs();
  setupEvents();
  render();
  await syncApprovedOils();
}

init();
