const ladderForm = document.getElementById("ladderForm");
const ladderSummaryRoot = document.getElementById("ladderSummary");
const ladderStepsRoot = document.getElementById("ladderSteps");
const ladderCopy = document.getElementById("ladderCopy");

const ladderMoney = new Intl.NumberFormat("en-GB", { style: "currency", currency: window.OrionCurrency?.code() || "GBP", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ladderNum = (id) => Math.max(0, Number(document.getElementById(id).value) || 0);
// Price needed to earn a margin m (as a share of the selling price) on a cost.
const withMargin = (cost, marginPct) => (marginPct >= 100 ? Infinity : cost / (1 - marginPct / 100));

// Pricing ladder from raw inputs. This is the tool's only copy of the maths;
// the sensitivity view calls it too, so both always agree.
const ladderInputIds = ["ladderLanded", "ladderBrandMargin", "ladderDistMargin", "ladderRetailMargin", "ladderVat", "ladderTarget"];
const ladderValues = () => Object.fromEntries(ladderInputIds.map((id) => [id, ladderNum(id)]));

const ladderFrom = (v) => {
  const landed = Math.max(0, v.ladderLanded);
  const brandMargin = Math.max(0, v.ladderBrandMargin);
  const distMargin = Math.max(0, v.ladderDistMargin);
  const retailMargin = Math.max(0, v.ladderRetailMargin);
  const vat = Math.max(0, v.ladderVat);
  const target = Math.max(0, v.ladderTarget);

  const brandPrice = withMargin(landed, brandMargin);
  const distPrice = distMargin > 0 ? withMargin(brandPrice, distMargin) : brandPrice;
  const retailNet = withMargin(distPrice, retailMargin);
  const rrp = retailNet * (1 + vat / 100);
  const multiple = landed > 0 ? rrp / landed : 0;
  const finite = Number.isFinite(rrp);
  return { landed, brandMargin, distMargin, retailMargin, vat, target, brandPrice, distPrice, retailNet, rrp, multiple, finite };
};

function renderLadderSensitivity() {
  window.OrionSensitivity?.render({
    after: ladderStepsRoot,
    title: "Which input matters most for the shelf price?",
    better: "lower",
    format: (v) => ladderMoney.format(v),
    inputs: [
      { id: "ladderLanded", label: "Landed cost per unit" },
      { id: "ladderBrandMargin", label: "Your margin" },
      { id: "ladderDistMargin", label: "Distributor margin" },
      { id: "ladderRetailMargin", label: "Retailer margin" },
      { id: "ladderVat", label: "VAT" }
    ],
    compute: (values) => ladderFrom({ ...ladderValues(), ...values }).rrp
  });
}

const updateLadderTool = () => {
  renderLadderSensitivity();
  const { landed, brandMargin, distMargin, retailMargin, vat, target, brandPrice, distPrice, retailNet, rrp, multiple, finite } = ladderFrom(ladderValues());

  ladderSummaryRoot.innerHTML = `
    <div class="result-card"><strong>${finite ? ladderMoney.format(rrp) : "N/A"}</strong><span>Shelf price needed (inc. VAT)</span></div>
    <div class="result-card"><strong>${finite ? `${multiple.toFixed(1)}×` : "N/A"}</strong><span>Shelf price as a multiple of landed cost</span></div>
    <div class="result-card"><strong>${target > 0 && finite ? ladderMoney.format(target - rrp) : "—"}</strong><span>${target > 0 ? "Headroom against your target price" : "Enter a target price to compare"}</span></div>
  `;

  const steps = [
    ["Landed cost to you", landed, "What it costs to make and get to your warehouse"],
    [`Your price to ${distMargin > 0 ? "the distributor" : "the retailer"}`, brandPrice, `Your ${brandMargin}% margin`],
    ...(distMargin > 0 ? [["Distributor's price to the retailer", distPrice, `Distributor's ${distMargin}% margin`]] : []),
    ["Retail price before VAT", retailNet, `Retailer's ${retailMargin}% margin`],
    ["Shelf price including VAT", rrp, `VAT at ${vat}%`]
  ];
  const max = Math.max(...steps.map((s) => (Number.isFinite(s[1]) ? s[1] : 0)), 1);
  ladderStepsRoot.innerHTML = steps
    .map(([label, value, note]) => `
      <div class="ladder-step">
        <div class="ladder-head"><span>${label}</span><strong>${Number.isFinite(value) ? ladderMoney.format(value) : "N/A"}</strong></div>
        <span class="ladder-bar"><span style="width:${Number.isFinite(value) ? Math.max(3, (value / max) * 100) : 100}%"></span></span>
        <small>${note}</small>
      </div>`)
    .join("");

  if (ladderCopy) {
    ladderCopy.value =
      `Pricing Ladder\n` +
      steps.map(([label, value, note]) => `${label}: ${Number.isFinite(value) ? ladderMoney.format(value) : "N/A"} (${note})`).join("\n") +
      `\nShelf price is ${finite ? multiple.toFixed(1) : "N/A"}× landed cost` +
      (target > 0 && finite ? `\nTarget shelf price ${ladderMoney.format(target)}: headroom ${ladderMoney.format(target - rrp)}` : "");
  }

  let level = "info";
  let headline = "";
  if (!finite) {
    level = "worrying";
    headline = "A margin of 100% or more cannot be achieved; check the margin inputs.";
  } else if (target > 0) {
    level = rrp <= target * 0.95 ? "good" : rrp <= target ? "borderline" : "worrying";
    headline = rrp <= target
      ? `Everyone in the chain can earn their margin at or below your ${ladderMoney.format(target)} target shelf price.`
      : `To give everyone their margin, the shelf price would need to be ${ladderMoney.format(rrp)}, which is ${ladderMoney.format(rrp - target)} above your target.`;
  } else {
    headline = `With these margins the product needs a shelf price of about ${ladderMoney.format(rrp)}, ${multiple.toFixed(1)} times its landed cost.`;
  }
  const maxLanded = target > 0 ? target / (1 + vat / 100) * (1 - retailMargin / 100) * (distMargin > 0 ? 1 - distMargin / 100 : 1) * (1 - brandMargin / 100) : 0;
  window.OrionInsight?.show({
    level,
    headline,
    points: [
      target > 0 && finite && rrp > target ? `At your target price, landed cost would need to fall to about ${ladderMoney.format(maxLanded)}, or someone in the chain must accept a lower margin.` : "",
      "Margins here are shares of each seller's selling price, as retailers and distributors usually quote them. Confirm which they mean before agreeing terms.",
      distMargin > 0 ? "Each extra link in the chain multiplies the shelf price. Selling directly to retailers, or direct to consumers, shortens the ladder." : "Check what similar products sell for: if the shelf price is well above them, revisit cost, channel or positioning."
    ],
    next: { href: "route-to-market-simulator.html", label: "Work backwards from a retail price to target cost" }
  });
};

ladderForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateLadderTool();
  if (window.OrionAnalytics) window.OrionAnalytics.trackEvent("calculate", { tool_name: "pricing_ladder" });
});
ladderForm.querySelectorAll("input, select").forEach((field) => {
  field.addEventListener("input", updateLadderTool);
  field.addEventListener("change", updateLadderTool);
});
if (window.OrionAnalytics) window.OrionAnalytics.trackEvent("tool_used", { tool_name: "pricing_ladder" });

updateLadderTool();
