const bomForm = document.getElementById("bomForm");
const bomSummaryRoot = document.getElementById("bomSummary");
const bomBreakdownRoot = document.getElementById("bomBreakdown");
const bomCopy = document.getElementById("bomCopy");
const bomEstimatorLink = document.getElementById("bomToEstimator");
const BOM_ROWS = 10;

const bomMoney = new Intl.NumberFormat("en-GB", { style: "currency", currency: window.OrionCurrency?.code() || "GBP", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const bomCategories = {
  material: "Material for made parts",
  process: "Processing of made parts",
  bought: "Bought-in components",
  packaging: "Packaging"
};

// Quantities and unit costs for every row, keyed by input id (bomQty1, bomCost1, ...).
const bomValues = () => {
  const values = {};
  for (let i = 1; i <= BOM_ROWS; i += 1) {
    values[`bomQty${i}`] = Number(document.getElementById(`bomQty${i}`).value) || 0;
    values[`bomCost${i}`] = Number(document.getElementById(`bomCost${i}`).value) || 0;
  }
  return values;
};

// The BOM roll-up from those values. This is the tool's only copy of the maths; the
// sensitivity view calls it too, so both always agree.
const bomRollupFrom = (v) => {
  const lines = [];
  for (let i = 1; i <= BOM_ROWS; i += 1) {
    const name = (document.getElementById(`bomName${i}`).value || "").trim() || `Line ${i}`;
    const category = document.getElementById(`bomCat${i}`).value;
    const qty = Math.max(0, Number(v[`bomQty${i}`]) || 0);
    const cost = Math.max(0, Number(v[`bomCost${i}`]) || 0);
    if (qty > 0 && cost > 0) lines.push({ row: i, name, category, qty, cost, ext: qty * cost });
  }
  const totals = Object.fromEntries(Object.keys(bomCategories).map((k) => [k, 0]));
  lines.forEach((l) => (totals[l.category] += l.ext));
  const total = lines.reduce((sum, l) => sum + l.ext, 0);
  const partCount = lines.reduce((sum, l) => sum + l.qty, 0);
  const biggest = lines.slice().sort((a, b) => b.ext - a.ext);
  return { lines, totals, total, partCount, biggest };
};

const bomEscape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Sensitivity on the unit costs of the lines with the largest totals: quantities per product are
// whole numbers set by the design, while unit costs are the figures that move with quotes.
function renderBomSensitivity(biggest) {
  if (!biggest.length) {
    document.getElementById("sensitivityPanel")?.remove();
    return;
  }
  window.OrionSensitivity?.render({
    after: bomBreakdownRoot,
    title: "Which input matters most for BOM cost?",
    better: "lower",
    note: "Unit costs of the five largest lines; quantities are kept as entered.",
    format: (v) => `${bomMoney.format(v)} a product`,
    inputs: biggest.slice(0, 5).map((l) => ({ id: `bomCost${l.row}`, label: `${bomEscape(l.name)} unit cost` })),
    compute: (values) => bomRollupFrom({ ...bomValues(), ...values }).total
  });
}

const updateBomTool = () => {
  const { lines, totals, total, partCount, biggest } = bomRollupFrom(bomValues());
  renderBomSensitivity(biggest);

  bomSummaryRoot.innerHTML = `
    <div class="result-card"><strong>${bomMoney.format(total)}</strong><span>BOM cost per product</span></div>
    <div class="result-card"><strong>${partCount}</strong><span>Parts per product</span></div>
    <div class="result-card"><strong>${lines.length}</strong><span>BOM lines</span></div>
  `;

  bomBreakdownRoot.innerHTML =
    Object.entries(bomCategories)
      .map(([key, label]) => `
      <div class="comparison-item">
        <span>${label}</span>
        <strong>${bomMoney.format(totals[key])}${total > 0 ? ` <small>(${Math.round((totals[key] / total) * 100)}%)</small>` : ""}</strong>
      </div>`)
      .join("") +
    (biggest[0]
      ? `
      <div class="comparison-item">
        <span>Largest line</span>
        <strong>${biggest[0].name}: ${bomMoney.format(biggest[0].ext)}</strong>
      </div>`
      : "");

  if (bomEstimatorLink) {
    const url = new URL("product-cost-estimator.html", window.location.href);
    url.searchParams.set("materialCost", totals.material.toFixed(1));
    url.searchParams.set("processCost", totals.process.toFixed(1));
    url.searchParams.set("boughtInCost", totals.bought.toFixed(1));
    url.searchParams.set("packagingCost", totals.packaging.toFixed(1));
    bomEstimatorLink.href = `${url.pathname.split("/").pop()}${url.search}`;
  }

  if (bomCopy) {
    bomCopy.value =
      `Bill of Materials Cost Roll-up\n` +
      lines.map((l) => `${l.name} (${bomCategories[l.category].toLowerCase()}): ${l.qty} × ${bomMoney.format(l.cost)} = ${bomMoney.format(l.ext)}`).join("\n") +
      `\n` +
      Object.entries(bomCategories).map(([k, label]) => `${label}: ${bomMoney.format(totals[k])}`).join("\n") +
      `\nBOM cost per product: ${bomMoney.format(total)} (${partCount} parts, ${lines.length} lines)`;
  }

  const top3Share = total > 0 ? biggest.slice(0, 3).reduce((s, l) => s + l.ext, 0) / total : 0;
  window.OrionInsight?.show({
    level: "info",
    headline: lines.length
      ? `The bill of materials comes to ${bomMoney.format(total)} per product before assembly labour, scrap and overhead.`
      : "Add BOM lines with a quantity and unit cost to see the roll-up.",
    points: lines.length
      ? [
          `The three largest lines make up ${Math.round(top3Share * 100)}% of the BOM cost; cost-down effort usually pays most there.`,
          "Check that unit costs are for your real order quantity: prices for 100 and 10,000 parts can differ a lot.",
          "Take the totals into the Product Cost Estimator to add assembly, scrap and overhead, and see the margin."
        ]
      : [],
    next: { href: bomEstimatorLink ? bomEstimatorLink.getAttribute("href") : "product-cost-estimator.html", label: "Open these costs in the Product Cost Estimator" }
  });
};

bomForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateBomTool();
  if (window.OrionAnalytics) window.OrionAnalytics.trackEvent("calculate", { tool_name: "bom_builder" });
});
bomForm.querySelectorAll("input, select").forEach((field) => {
  field.addEventListener("input", updateBomTool);
  field.addEventListener("change", updateBomTool);
});
bomEstimatorLink?.addEventListener("click", () => {
  if (window.OrionAnalytics) window.OrionAnalytics.trackEvent("bom_to_estimator", { tool_name: "bom_builder" });
});
if (window.OrionAnalytics) window.OrionAnalytics.trackEvent("tool_used", { tool_name: "bom_builder" });

updateBomTool();

// Low / likely / high range on the unit costs of the four largest lines (shared helper in main.js).
// The drivers follow the current largest lines; compute uses bomRollupFrom, so the range matches the tool.
window.OrionRange?.attach({
  formId: "bomForm",
  noun: "BOM cost per product",
  format: (value) => bomMoney.format(value),
  drivers: () => bomRollupFrom(bomValues()).biggest.slice(0, 4).map((l) => ({ id: `bomCost${l.row}`, label: `${l.name} unit cost` })),
  compute: (get) => bomRollupFrom(Object.fromEntries(Object.keys(bomValues()).map((id) => [id, get(id)]))).total
});
