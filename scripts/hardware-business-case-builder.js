const businessCaseForm = document.getElementById("business-case-form");
const businessCaseSummary = document.getElementById("businessCaseSummary");
const businessCaseRecommendation = document.getElementById("businessCaseRecommendation");
const businessCaseCopy = document.getElementById("businessCaseCopy");
const businessCaseChartCanvas = document.getElementById("businessCaseChart");

let businessCaseChart;

const businessMoney = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: window.OrionCurrency?.code() || "GBP",
  maximumFractionDigits: 0
});

const businessRead = (id) => Number(document.getElementById(id).value);

const renderBusinessCaseChart = (values) => {
  if (businessCaseChart) {
    businessCaseChart.destroy();
  }

  businessCaseChart = new Chart(businessCaseChartCanvas, {
    type: "bar",
    data: {
      labels: ["Addressable", "Reachable", "Converted"],
      datasets: [
        {
          label: "Units",
          data: values,
          backgroundColor: [OrionColours.get("space-blue"), OrionColours.get("indigo"), OrionColours.get("teal")],
          borderRadius: 12
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
};

// Business case figures from raw inputs. This is the tool's only copy of the maths;
// the sensitivity view calls it too, so both always agree.
const businessInputIds = ["marketUnits", "reachableShare", "conversionRate", "businessPrice", "businessCogs", "developmentSpend", "annualOpex"];
const businessValues = () => Object.fromEntries(businessInputIds.map((id) => [id, businessRead(id)]));

const businessCaseFrom = (v) => {
  const marketUnits = Math.max(100, v.marketUnits);
  const reachableShare = Math.max(0.001, v.reachableShare) / 100;
  const conversionRate = Math.max(0.001, v.conversionRate) / 100;
  const businessPrice = Math.max(1, v.businessPrice);
  const businessCogs = Math.max(0, v.businessCogs);
  const developmentSpend = Math.max(0, v.developmentSpend);
  const annualOpex = Math.max(0, v.annualOpex);

  const reachableUnits = marketUnits * reachableShare;
  const soldUnits = reachableUnits * conversionRate;
  const revenue = soldUnits * businessPrice;
  const grossProfit = soldUnits * (businessPrice - businessCogs);
  const annualContribution = grossProfit - annualOpex;
  const totalYearOneProfit = annualContribution - developmentSpend;
  const breakEvenUnits = (developmentSpend + annualOpex) / Math.max(1, businessPrice - businessCogs);
  const paybackMonths = annualContribution > 0 ? (developmentSpend / annualContribution) * 12 : Infinity;
  return {
    marketUnits, reachableShare, conversionRate, businessPrice, businessCogs, developmentSpend, annualOpex,
    reachableUnits, soldUnits, revenue, grossProfit, annualContribution, totalYearOneProfit, breakEvenUnits, paybackMonths
  };
};

function renderBusinessCaseSensitivity() {
  window.OrionSensitivity?.render({
    after: businessCaseRecommendation,
    title: "Which input matters most for the year-one result?",
    better: "higher",
    format: (v) => businessMoney.format(v),
    inputs: [
      { id: "marketUnits", label: "Addressable market units per year" },
      { id: "reachableShare", label: "Reachable market share" },
      { id: "conversionRate", label: "Conversion from reachable market" },
      { id: "businessPrice", label: "Selling price per unit" },
      { id: "businessCogs", label: "Unit COGS" },
      { id: "developmentSpend", label: "Development and tooling spend" },
      { id: "annualOpex", label: "Annual operating cost" }
    ],
    compute: (values) => businessCaseFrom({ ...businessValues(), ...values }).totalYearOneProfit
  });
}

const updateBusinessCaseTool = () => {
  renderBusinessCaseSensitivity();
  const {
    marketUnits, reachableShare, conversionRate, businessPrice, businessCogs, developmentSpend, annualOpex,
    reachableUnits, soldUnits, revenue, grossProfit, annualContribution, totalYearOneProfit, breakEvenUnits, paybackMonths
  } = businessCaseFrom(businessValues());

  businessCaseSummary.innerHTML = `
    <div class="result-card">
      <strong>${Math.round(soldUnits).toLocaleString()}</strong>
      <span>Estimated annual units sold</span>
    </div>
    <div class="result-card">
      <strong>${businessMoney.format(revenue)}</strong>
      <span>Estimated annual revenue</span>
    </div>
    <div class="result-card">
      <strong>${businessMoney.format(totalYearOneProfit)}</strong>
      <span>Year-one result after development spend</span>
    </div>
  `;

  businessCaseRecommendation.innerHTML = `
    <span class="score-chip ${annualContribution > 0 ? "score-chip-strong" : "score-chip-caution"}">
      ${annualContribution > 0 ? "Positive contribution" : "Contribution gap"}
    </span>
    <h2>${annualContribution > 0 ? "The opportunity can support the planned operating base." : "The current assumptions do not support the planned operating base."}</h2>
    <p>
      Reachable demand of ${Math.round(reachableUnits).toLocaleString()} units and a ${Math.round(soldUnits).toLocaleString()} unit conversion scenario
      ${annualContribution > 0 ? "produce" : "do not produce"} enough gross contribution to cover annual operating cost.
    </p>
    <p>
      Break-even volume: ${Math.ceil(breakEvenUnits).toLocaleString()} units.
      ${Number.isFinite(paybackMonths) ? `Estimated payback on development spend: ${paybackMonths.toFixed(1)} months.` : "Development spend is not repaid under the current assumptions."}
    </p>
  `;

  businessCaseCopy.value =
    `Hardware Business Case Builder\n` +
    `Addressable market units: ${marketUnits.toLocaleString()}\n` +
    `Reachable share: ${(reachableShare * 100).toFixed(1)}%\n` +
    `Conversion rate: ${(conversionRate * 100).toFixed(1)}%\n` +
    `Estimated units sold: ${Math.round(soldUnits).toLocaleString()}\n` +
    `Annual revenue: ${businessMoney.format(revenue)}\n` +
    `Annual gross profit: ${businessMoney.format(grossProfit)}\n` +
    `Year-one result: ${businessMoney.format(totalYearOneProfit)}\n` +
    `Break-even volume: ${Math.ceil(breakEvenUnits).toLocaleString()} units`;

  renderBusinessCaseChart([marketUnits, reachableUnits, soldUnits]);

  // Plain-English interpretation (shared panel in main.js).
  const unitGrossProfit = businessPrice - businessCogs;
  const unitsToCoverOpex = unitGrossProfit > 0 ? annualOpex / unitGrossProfit : Infinity;
  const cautiousContribution = grossProfit / 2 - annualOpex;
  const cautiousPoint = cautiousContribution > 0
    ? `At half the reachable share, the case still contributes ${businessMoney.format(cautiousContribution)} a year, so it does not hinge on optimistic share figures.`
    : `At half the reachable share, contribution falls to ${businessMoney.format(cautiousContribution)} a year, so the case depends on the share and conversion figures; back them with evidence such as pre-orders, pilots or comparable products.`;

  if (annualContribution <= 0) {
    window.OrionInsight?.show({
      level: "worrying",
      headline: unitGrossProfit <= 0
        ? `Each unit sells at or below its cost, so the case loses ${businessMoney.format(-annualContribution)} a year and cannot repay development or operating spend.`
        : `Gross profit of ${businessMoney.format(grossProfit)} a year does not cover annual operating cost of ${businessMoney.format(annualOpex)}, so the ${businessMoney.format(developmentSpend)} development spend is never repaid.`,
      points: [
        unitGrossProfit <= 0
          ? `Each unit sells at or below its cost (${businessMoney.format(businessPrice)} price against ${businessMoney.format(businessCogs)} COGS), so more volume only adds to the loss.`
          : `Covering operating cost alone needs about ${Math.ceil(unitsToCoverOpex).toLocaleString()} units a year, against ${Math.round(soldUnits).toLocaleString()} estimated.`,
        "Revisit price, unit cost and the size of the team behind the product, or consider whether a narrower first market would be easier to win."
      ],
      next: { href: "break-even-calculator.html", label: "Work out the volume you need in the Break-Even Calculator" }
    });
  } else {
    let level = paybackMonths <= 24 ? "good" : "borderline";
    if (level === "good" && cautiousContribution <= 0) level = "borderline";
    const fragile = paybackMonths <= 24 && cautiousContribution <= 0;
    const headline = developmentSpend === 0
      ? `With no development spend to repay, the case contributes ${businessMoney.format(annualContribution)} a year after operating cost${fragile ? ", but only if the share and conversion figures hold" : ""}.`
      : fragile
        ? `Development spend of ${businessMoney.format(developmentSpend)} is repaid in about ${Math.round(paybackMonths)} months, but only if the share and conversion figures hold: at half the share, the case no longer covers operating cost.`
        : paybackMonths <= 24
        ? `Development spend of ${businessMoney.format(developmentSpend)} is repaid in about ${Math.round(paybackMonths)} months, within the one to two years commonly seen as promising.`
        : `Development spend of ${businessMoney.format(developmentSpend)} takes about ${(paybackMonths / 12).toFixed(1)} years to repay, beyond the one to two years commonly seen as comfortable.`;
    window.OrionInsight?.show({
      level,
      headline,
      points: [
        `The estimate rests on ${Math.round(soldUnits).toLocaleString()} units a year, each contributing ${businessMoney.format(unitGrossProfit)} of gross profit.`,
        cautiousPoint,
        paybackMonths > 24 ? "To shorten payback, look at a leaner cost base, a lower development budget or a higher price before relying on more volume." : ""
      ],
      next: level === "good"
        ? { href: "cashflow-projection.html", label: "Check the cash dip before payback in the Cashflow Projection" }
        : { href: "break-even-calculator.html", label: "Test price and volume in the Break-Even Calculator" }
    });
  }
};

businessCaseForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateBusinessCaseTool();

  if (window.OrionAnalytics) {
    window.OrionAnalytics.trackEvent("calculate", {
      tool_name: "hardware_business_case_builder",
      market_units: Math.max(100, businessRead("marketUnits")),
      selling_price: Math.max(1, businessRead("businessPrice"))
    });
  }
});
businessCaseForm.querySelectorAll("input, select, textarea").forEach((field) => {
  field.addEventListener("input", updateBusinessCaseTool);
  field.addEventListener("change", updateBusinessCaseTool);
});
if (window.OrionAnalytics) {
  window.OrionAnalytics.trackEvent("tool_used", {
    tool_name: "hardware_business_case_builder"
  });
}

updateBusinessCaseTool();

// Low / likely / high range on the year-one result after development spend (shared helper in main.js).
// compute uses businessCaseFrom, the same maths as the result cards and sensitivity panel.
// Share and conversion raise the result while costs lower it; the helper orders each end of the range.
window.OrionRange?.attach({
  formId: "business-case-form",
  noun: "year-one result after development spend",
  format: (value) => businessMoney.format(value),
  drivers: [
    { id: "reachableShare", label: "Reachable market share" },
    { id: "conversionRate", label: "Conversion from reachable market" },
    { id: "businessCogs", label: "Unit COGS" },
    { id: "developmentSpend", label: "Development and tooling spend" },
    { id: "annualOpex", label: "Annual operating cost" }
  ],
  compute: (get) => businessCaseFrom(Object.fromEntries(businessInputIds.map((id) => [id, get(id)]))).totalYearOneProfit
});
