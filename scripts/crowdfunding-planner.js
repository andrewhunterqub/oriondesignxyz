const cfForm = document.getElementById("cfForm");
const cfSummaryRoot = document.getElementById("cfSummary");
const cfBreakdownRoot = document.getElementById("cfBreakdown");
const cfCopy = document.getElementById("cfCopy");

const cfMoney = new Intl.NumberFormat("en-GB", { style: "currency", currency: window.OrionCurrency?.code() || "GBP", maximumFractionDigits: 0 });
const cfMoney2 = new Intl.NumberFormat("en-GB", { style: "currency", currency: window.OrionCurrency?.code() || "GBP", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cfNum = (id) => Math.max(0, Number(document.getElementById(id).value) || 0);

// The campaign maths from raw inputs. This is the tool's only copy of it; the sensitivity view
// calls it too, so both always agree.
const cfInputIds = ["cfPledge", "cfBackers", "cfUnitCost", "cfShipping", "cfPlatformFee", "cfPaymentFee", "cfVat", "cfFixed", "cfMarketing"];
const cfValues = () => Object.fromEntries(cfInputIds.map((id) => [id, cfNum(id)]));

const cfPlanFrom = (v, shippingCharged) => {
  const pledge = Math.max(0, v.cfPledge);
  const backers = Math.round(Math.max(0, v.cfBackers));
  const unitCost = Math.max(0, v.cfUnitCost);
  const shipping = Math.max(0, v.cfShipping);
  const platformFee = Math.max(0, v.cfPlatformFee) / 100;
  const paymentFee = Math.max(0, v.cfPaymentFee) / 100;
  const vatRate = Math.max(0, v.cfVat) / 100;
  const fixedCosts = Math.max(0, v.cfFixed);
  const marketing = Math.max(0, v.cfMarketing);

  // Per backer: the pledge (plus shipping if charged separately), less fees on the total collected,
  // VAT included in the pledge, and the cost of making and delivering the reward.
  const collected = pledge + (shippingCharged ? shipping : 0);
  const fees = collected * (platformFee + paymentFee);
  const vat = vatRate > 0 ? collected - collected / (1 + vatRate) : 0;
  const perBacker = collected - fees - vat - unitCost - shipping;
  const totalCollected = collected * backers;
  const totalNet = perBacker * backers;
  const toCover = fixedCosts + marketing;
  const surplus = totalNet - toCover;
  const neededBackers = perBacker > 0 ? Math.ceil(toCover / perBacker) : Infinity;
  return {
    pledge, backers, unitCost, shipping, fixedCosts, marketing,
    collected, fees, vat, perBacker, totalCollected, totalNet, toCover, surplus, neededBackers
  };
};

function renderCfSensitivity(shippingCharged) {
  window.OrionSensitivity?.render({
    after: cfBreakdownRoot,
    title: "Which input matters most for backers needed?",
    better: "lower",
    format: (v) => `${Math.round(v).toLocaleString()} backers`,
    inputs: [
      { id: "cfPledge", label: "Reward pledge price" },
      { id: "cfUnitCost", label: "Landed cost to make each reward" },
      { id: "cfShipping", label: "Shipping to each backer" },
      { id: "cfPlatformFee", label: "Platform fee" },
      { id: "cfPaymentFee", label: "Payment processing fee" },
      { id: "cfVat", label: "VAT included in pledges" },
      { id: "cfFixed", label: "Fixed costs to fund" },
      { id: "cfMarketing", label: "Campaign marketing and video" }
    ],
    compute: (values) => cfPlanFrom({ ...cfValues(), ...values }, shippingCharged).neededBackers
  });
}

const updateCfTool = () => {
  const shippingCharged = document.getElementById("cfShippingCharged").value === "yes";
  renderCfSensitivity(shippingCharged);
  const {
    pledge, backers, unitCost, shipping, fixedCosts, marketing,
    collected, fees, vat, perBacker, totalCollected, totalNet, toCover, surplus, neededBackers
  } = cfPlanFrom(cfValues(), shippingCharged);

  cfSummaryRoot.innerHTML = `
    <div class="result-card"><strong>${cfMoney2.format(perBacker)}</strong><span>Left per backer after fees, VAT, product and shipping</span></div>
    <div class="result-card"><strong>${Number.isFinite(neededBackers) ? neededBackers.toLocaleString() : "Not possible"}</strong><span>Backers needed to cover fixed and campaign costs</span></div>
    <div class="result-card"><strong>${cfMoney.format(Math.abs(surplus))}</strong><span>${surplus >= 0 ? "Surplus" : "Shortfall"} at ${backers.toLocaleString()} backers</span></div>
  `;

  const rows = [
    ["Total collected from backers", totalCollected],
    ["Platform and payment fees", -fees * backers],
    ["VAT included in pledges", -vat * backers],
    ["Making the rewards", -unitCost * backers],
    ["Shipping to backers", -shipping * backers],
    ["Left after fulfilling rewards", totalNet],
    ["Fixed costs to fund (tooling, certification, first batch set-up)", -fixedCosts],
    ["Campaign marketing and video", -marketing]
  ];
  cfBreakdownRoot.innerHTML = rows
    .map(([label, value]) => `
      <div class="comparison-item">
        <span>${label}</span>
        <strong>${value < 0 ? "−" : ""}${cfMoney.format(Math.abs(value))}</strong>
      </div>`)
    .join("");

  if (cfCopy) {
    cfCopy.value =
      `Crowdfunding Plan\n` +
      `Pledge: ${cfMoney2.format(pledge)}${shippingCharged ? ` + ${cfMoney2.format(shipping)} shipping` : " (shipping included)"}; backers: ${backers.toLocaleString()}\n` +
      rows.map(([label, value]) => `${label}: ${value < 0 ? "-" : ""}${cfMoney.format(Math.abs(value))}`).join("\n") +
      `\nLeft per backer: ${cfMoney2.format(perBacker)}\n` +
      `Backers needed to cover fixed and campaign costs: ${Number.isFinite(neededBackers) ? neededBackers.toLocaleString() : "not possible at this pledge"}\n` +
      `${surplus >= 0 ? "Surplus" : "Shortfall"}: ${cfMoney.format(Math.abs(surplus))}`;
  }

  const level = perBacker <= 0 ? "worrying" : surplus >= toCover * 0.2 ? "good" : surplus >= 0 ? "borderline" : "worrying";
  window.OrionInsight?.show({
    level,
    headline: perBacker <= 0
      ? "Each backer costs more to fulfil than they pay, so more backers would only increase the loss."
      : surplus >= 0
        ? `At ${backers.toLocaleString()} backers the campaign covers its fixed and campaign costs${surplus >= toCover * 0.2 ? " with some margin to spare" : ", but with little margin for surprises"}.`
        : `You need about ${neededBackers.toLocaleString()} backers to cover fixed and campaign costs, ${(neededBackers - backers).toLocaleString()} more than planned.`,
    points: [
      `Each backer contributes ${cfMoney2.format(perBacker)} after fees, VAT, the product and shipping, from a pledge of ${cfMoney2.format(collected)}.`,
      "Shipping, especially international, is the cost most often under-estimated in hardware campaigns. Get carrier quotes for real parcel sizes.",
      "Pledges for rewards are usually treated as sales for VAT purposes; confirm the treatment with your accountant. Check your platform's current fees before launch.",
      "Leave room for delays: manufacturing problems are common, and backers expect honest, regular updates."
    ],
    next: { href: "cashflow-projection.html", label: "Check the cash between campaign and delivery" }
  });
};

cfForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateCfTool();
  if (window.OrionAnalytics) window.OrionAnalytics.trackEvent("calculate", { tool_name: "crowdfunding_planner" });
});
cfForm.querySelectorAll("input, select").forEach((field) => {
  field.addEventListener("input", updateCfTool);
  field.addEventListener("change", updateCfTool);
});
if (window.OrionAnalytics) window.OrionAnalytics.trackEvent("tool_used", { tool_name: "crowdfunding_planner" });

updateCfTool();

// Low / likely / high range on backers needed (shared helper in main.js).
// compute uses cfPlanFrom, the same maths as the result cards and sensitivity panel;
// whether shipping is charged on top is kept as chosen. Every driver here is a cost,
// so higher values always need more backers.
window.OrionRange?.attach({
  formId: "cfForm",
  noun: "backers needed",
  format: (value) => (Number.isFinite(value) ? `${Math.round(value).toLocaleString()} backers` : "not reachable"),
  drivers: [
    { id: "cfUnitCost", label: "Landed cost to make each reward" },
    { id: "cfShipping", label: "Shipping to each backer" },
    { id: "cfFixed", label: "Fixed costs to fund" },
    { id: "cfMarketing", label: "Campaign marketing and video" }
  ],
  compute: (get) => cfPlanFrom(
    Object.fromEntries(cfInputIds.map((id) => [id, Math.max(0, get(id))])),
    document.getElementById("cfShippingCharged").value === "yes"
  ).neededBackers
});
