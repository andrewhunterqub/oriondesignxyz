const landedForm = document.getElementById("landedForm");
const landedSummaryRoot = document.getElementById("landedSummary");
const landedBreakdownRoot = document.getElementById("landedBreakdown");
const landedBarRoot = document.getElementById("landedBar");
const landedCopy = document.getElementById("landedCopy");

const landedMoney = new Intl.NumberFormat("en-GB", { style: "currency", currency: window.OrionCurrency?.code() || "GBP", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const landedMoney0 = new Intl.NumberFormat("en-GB", { style: "currency", currency: window.OrionCurrency?.code() || "GBP", maximumFractionDigits: 0 });
const landedNumber = (id) => Math.max(0, Number(document.getElementById(id).value) || 0);

// Landed cost per unit from raw inputs, used by the sensitivity view (same maths as below).
const landedPerUnitFrom = (v) => {
  const units = Math.max(1, v.landedUnits);
  const customsValue = (v.landedUnitPrice + v.landedPackaging) * units + v.landedOrigin + v.landedFreight + v.landedInsurance;
  const duty = customsValue * (v.landedDutyRate / 100);
  const vatReclaimable = document.getElementById("landedVatStatus").value === "registered";
  const importVat = vatReclaimable ? 0 : (customsValue + duty) * (v.landedVatRate / 100);
  return (customsValue + duty + v.landedClearance + v.landedDelivery + v.landedOther + importVat) / units;
};

function renderLandedSensitivity() {
  window.OrionSensitivity?.render({
    after: landedBreakdownRoot,
    title: "Which input matters most for landed cost?",
    better: "lower",
    format: (v) => `${landedMoney.format(v)} a unit`,
    inputs: [
      { id: "landedUnitPrice", label: "Supplier price per unit" },
      { id: "landedUnits", label: "Units in the shipment" },
      { id: "landedFreight", label: "Main freight" },
      { id: "landedDutyRate", label: "Import duty rate" },
      { id: "landedPackaging", label: "Packaging per unit" },
      { id: "landedOrigin", label: "Origin charges" },
      { id: "landedInsurance", label: "Insurance" },
      { id: "landedClearance", label: "Customs clearance" },
      { id: "landedDelivery", label: "Delivery to your warehouse" },
      { id: "landedOther", label: "Other costs" }
    ],
    compute: landedPerUnitFrom
  });
}

const updateLandedTool = () => {
  renderLandedSensitivity();
  const units = Math.max(1, landedNumber("landedUnits"));
  const unitPrice = landedNumber("landedUnitPrice");
  const packaging = landedNumber("landedPackaging");
  const origin = landedNumber("landedOrigin");
  const freight = landedNumber("landedFreight");
  const insurance = landedNumber("landedInsurance");
  const dutyRate = landedNumber("landedDutyRate") / 100;
  const clearance = landedNumber("landedClearance");
  const delivery = landedNumber("landedDelivery");
  const other = landedNumber("landedOther");
  const vatRate = landedNumber("landedVatRate") / 100;
  const vatReclaimable = document.getElementById("landedVatStatus").value === "registered";

  const goods = unitPrice * units;
  const packagingTotal = packaging * units;
  // UK customs value is normally the price paid plus transport and insurance to the UK border.
  const customsValue = goods + packagingTotal + origin + freight + insurance;
  const duty = customsValue * dutyRate;
  const importVat = (customsValue + duty) * vatRate;
  const landedExVat = customsValue + duty + clearance + delivery + other;
  const landedTotal = landedExVat + (vatReclaimable ? 0 : importVat);
  const perUnit = landedTotal / units;
  const supplierPerUnit = unitPrice + packaging;
  const uplift = supplierPerUnit > 0 ? perUnit / supplierPerUnit - 1 : 0;
  const perShipment = origin + freight + insurance + clearance + delivery + other;
  const perShipmentShare = landedTotal > 0 ? perShipment / landedTotal : 0;

  landedSummaryRoot.innerHTML = `
    <div class="result-card">
      <strong>${landedMoney.format(perUnit)}</strong>
      <span>Landed cost per unit</span>
    </div>
    <div class="result-card">
      <strong>${Math.round(uplift * 100)}%</strong>
      <span>Above the supplier price</span>
    </div>
    <div class="result-card">
      <strong>${landedMoney0.format(landedTotal)}</strong>
      <span>Landed cost of the shipment</span>
    </div>
  `;

  const parts = [
    ["Goods and packaging", goods + packagingTotal, "landed-seg-goods"],
    ["Freight, insurance and origin charges", origin + freight + insurance, "landed-seg-freight"],
    ["Import duty", duty, "landed-seg-duty"],
    ["Clearance, delivery and other", clearance + delivery + other, "landed-seg-fees"],
  ];
  if (!vatReclaimable) parts.push(["Import VAT (not reclaimable)", importVat, "landed-seg-vat"]);

  landedBarRoot.innerHTML = parts
    .filter(([, value]) => value > 0)
    .map(([label, value, cls]) => `<span class="landed-seg ${cls}" style="flex-grow:${value}" title="${label}: ${landedMoney0.format(value)}"></span>`)
    .join("");

  landedBreakdownRoot.innerHTML = parts
    .map(([label, value, cls]) => `
      <div class="comparison-item">
        <span><i class="landed-key ${cls}" aria-hidden="true"></i>${label}</span>
        <strong>${landedMoney0.format(value)} <small>(${landedMoney.format(value / units)} a unit)</small></strong>
      </div>`)
    .join("") + `
      <div class="comparison-item">
        <span>Customs value (duty is charged on this)</span>
        <strong>${landedMoney0.format(customsValue)}</strong>
      </div>
      <div class="comparison-item">
        <span>Import VAT ${vatReclaimable ? "(normally reclaimable; affects cash, not cost)" : "(included above as a cost)"}</span>
        <strong>${landedMoney0.format(importVat)}</strong>
      </div>`;

  if (landedCopy) {
    landedCopy.value =
      `Landed Cost Calculation\n` +
      `Units in shipment: ${units.toLocaleString()}\n` +
      `Supplier price per unit (incl. packaging): ${landedMoney.format(supplierPerUnit)}\n` +
      `Freight, insurance and origin charges: ${landedMoney0.format(origin + freight + insurance)}\n` +
      `Customs value: ${landedMoney0.format(customsValue)}\n` +
      `Import duty at ${(dutyRate * 100).toFixed(1)}%: ${landedMoney0.format(duty)}\n` +
      `Clearance, delivery and other: ${landedMoney0.format(clearance + delivery + other)}\n` +
      `Import VAT: ${landedMoney0.format(importVat)} (${vatReclaimable ? "reclaimable, excluded from cost" : "not reclaimable, included in cost"})\n` +
      `Landed cost per unit: ${landedMoney.format(perUnit)} (${Math.round(uplift * 100)}% above supplier price)`;
  }

  const level = uplift <= 0.15 ? "good" : uplift <= 0.35 ? "borderline" : "worrying";
  const headline = uplift <= 0.15
    ? `Getting the goods to your warehouse adds about ${Math.round(uplift * 100)}% to the supplier price, a modest uplift.`
    : uplift <= 0.35
      ? `Getting the goods to your warehouse adds about ${Math.round(uplift * 100)}% to the supplier price, enough to matter in your margins.`
      : `Getting the goods to your warehouse adds about ${Math.round(uplift * 100)}% to the supplier price, a large share of the unit cost.`;
  window.OrionInsight?.show({
    level,
    headline,
    points: [
      `Use ${landedMoney.format(perUnit)} per unit, not the supplier's ${landedMoney.format(supplierPerUnit)}, in your margin and break-even calculations.`,
      perShipmentShare > 0.15
        ? `Per-shipment charges make up ${Math.round(perShipmentShare * 100)}% of the landed cost. Larger or less frequent shipments would spread them further, but tie up more cash in stock.`
        : "Per-shipment charges are a small share of the total, so shipment size is not the main lever here.",
      dutyRate > 0 ? "Duty depends on the commodity code and origin: confirm the rate on the UK Trade Tariff, and check whether a trade agreement could reduce it." : "No duty is entered. Check the commodity code on the UK Trade Tariff to confirm a zero rate.",
      !vatReclaimable ? "Import VAT is treated as a cost because you are not VAT-registered. If you register, it can normally be reclaimed." : ""
    ],
    next: { href: "route-to-market-simulator.html", label: "Check this landed cost against your target cost by route to market" }
  });
};

landedForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateLandedTool();
  if (window.OrionAnalytics) {
    window.OrionAnalytics.trackEvent("calculate", { tool_name: "landed_cost_calculator", units: Math.max(1, landedNumber("landedUnits")) });
  }
});
landedForm.querySelectorAll("input, select").forEach((field) => {
  field.addEventListener("input", updateLandedTool);
  field.addEventListener("change", updateLandedTool);
});
if (window.OrionAnalytics) {
  window.OrionAnalytics.trackEvent("tool_used", { tool_name: "landed_cost_calculator" });
}

updateLandedTool();

// Low / likely / high range on the uncertain landed-cost inputs (shared helper in main.js).
// compute uses landedPerUnitFrom, the same maths as the result cards.
const landedInputIds = ["landedUnits", "landedUnitPrice", "landedPackaging", "landedOrigin", "landedFreight", "landedInsurance", "landedDutyRate", "landedClearance", "landedDelivery", "landedOther", "landedVatRate"];
window.OrionRange?.attach({
  formId: "landedForm",
  noun: "landed cost per unit",
  format: (value) => landedMoney.format(value),
  drivers: [
    { id: "landedUnitPrice", label: "Supplier price per unit" },
    { id: "landedFreight", label: "International freight for the shipment" },
    { id: "landedDutyRate", label: "Import duty rate (%)" },
    { id: "landedClearance", label: "Customs clearance and port charges" },
    { id: "landedOther", label: "Other per-shipment costs" }
  ],
  compute: (get) => landedPerUnitFrom(Object.fromEntries(landedInputIds.map((id) => [id, Math.max(0, get(id))])))
});
