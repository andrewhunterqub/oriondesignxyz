const startupCostForm = document.getElementById("startupCostForm");
const startupCostSummaryRoot = document.getElementById("startupCostSummary");
const startupCostBreakdownRoot = document.getElementById("startupCostBreakdown");
const startupCostChartContext = document.getElementById("startupCostChart");
const startupCostCopy = document.getElementById("startupCostCopy");

let startupCostChart;

const startupCurrency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: window.OrionCurrency?.code() || "GBP",
  maximumFractionDigits: 0
});

const getStartupNumber = (id) => Number(document.getElementById(id).value);

// Pre-launch budget from raw inputs, used by the sensitivity view (same maths as below).
const startupTotalFrom = (v) =>
  (v.designEngineering + v.prototypeBuilds + v.toolingCost + v.complianceCost + v.firstInventory + v.launchCosts) *
  (1 + Math.max(0, v.contingencyRate) / 100);

function renderStartupSensitivity() {
  window.OrionSensitivity?.render({
    after: startupCostBreakdownRoot,
    title: "Which input matters most for the budget?",
    better: "lower",
    note: "With costs that simply add up, the largest items matter most: these are the figures to get firm quotes for.",
    format: (v) => startupCurrency.format(v),
    inputs: [
      { id: "designEngineering", label: "Design and engineering" },
      { id: "prototypeBuilds", label: "Prototype builds and test rigs" },
      { id: "toolingCost", label: "Tooling and production set-up" },
      { id: "complianceCost", label: "Compliance and certification" },
      { id: "firstInventory", label: "First inventory and packaging" },
      { id: "launchCosts", label: "Launch assets and go-to-market" },
      { id: "contingencyRate", label: "Contingency rate" }
    ],
    compute: startupTotalFrom
  });
}

const updateStartupCostTool = () => {
  renderStartupSensitivity();
  const designEngineering = Math.max(0, getStartupNumber("designEngineering"));
  const prototypeBuilds = Math.max(0, getStartupNumber("prototypeBuilds"));
  const toolingCost = Math.max(0, getStartupNumber("toolingCost"));
  const complianceCost = Math.max(0, getStartupNumber("complianceCost"));
  const firstInventory = Math.max(0, getStartupNumber("firstInventory"));
  const launchCosts = Math.max(0, getStartupNumber("launchCosts"));
  const monthsToLaunch = Math.max(1, getStartupNumber("monthsToLaunch"));
  const contingencyRate = Math.max(0, getStartupNumber("contingencyRate")) / 100;

  const baseTotal =
    designEngineering +
    prototypeBuilds +
    toolingCost +
    complianceCost +
    firstInventory +
    launchCosts;
  const contingency = baseTotal * contingencyRate;
  const totalNeeded = baseTotal + contingency;
  const monthlyBurn = totalNeeded / monthsToLaunch;
  const recommendedRaise = totalNeeded * 1.1;

  startupCostSummaryRoot.innerHTML = `
    <div class="result-card">
      <strong>${startupCurrency.format(totalNeeded)}</strong>
      <span>Estimated pre-launch budget including contingency</span>
    </div>
    <div class="result-card">
      <strong>${startupCurrency.format(monthlyBurn)}</strong>
      <span>Average monthly burn to launch</span>
    </div>
    <div class="result-card">
      <strong>${startupCurrency.format(recommendedRaise)}</strong>
      <span>Suggested funding target with a small buffer</span>
    </div>
  `;

  startupCostBreakdownRoot.innerHTML = `
    <div class="comparison-item">
      <span>Base project spend</span>
      <strong>${startupCurrency.format(baseTotal)}</strong>
    </div>
    <div class="comparison-item">
      <span>Contingency</span>
      <strong>${startupCurrency.format(contingency)}</strong>
    </div>
    <div class="comparison-item">
      <span>Months to launch</span>
      <strong>${monthsToLaunch}</strong>
    </div>
  `;

  if (startupCostChart) {
    startupCostChart.destroy();
  }

  startupCostChart = new Chart(startupCostChartContext, {
    type: "doughnut",
    data: {
      labels: [
        "Design and engineering",
        "Prototype builds",
        "Tooling and setup",
        "Compliance",
        "First inventory",
        "Launch work",
        "Contingency"
      ],
      datasets: [
        {
          data: [
            designEngineering,
            prototypeBuilds,
            toolingCost,
            complianceCost,
            firstInventory,
            launchCosts,
            contingency
          ],
          backgroundColor: [
            OrionColours.get("space-blue"),
            OrionColours.get("indigo"),
            OrionColours.get("teal"),
            OrionColours.get("teal-300"),
            OrionColours.get("magenta"),
            OrionColours.get("magenta-300"),
            OrionColours.get("grey-200")
          ],
          borderWidth: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom"
        },
        tooltip: {
          callbacks: {
            label(context) {
              return `${context.label}: ${startupCurrency.format(context.parsed)}`;
            }
          }
        }
      }
    }
  });

  if (startupCostCopy) {
    startupCostCopy.value =
      `Startup Cost Plan\n` +
      `Estimated pre-launch budget: ${startupCurrency.format(totalNeeded)}\n` +
      `Average monthly burn: ${startupCurrency.format(monthlyBurn)}\n` +
      `Suggested funding target: ${startupCurrency.format(recommendedRaise)}\n` +
      `Contingency included: ${startupCurrency.format(contingency)}`;
  }

  // Plain-English interpretation (shared panel in main.js).
  const gaps = [];
  if (contingencyRate < 0.15) gaps.push(`Contingency is ${Math.round(contingencyRate * 100)}%. Early hardware budgets commonly hold around 15–25%, more for novel or regulated products.`);
  if (complianceCost === 0) gaps.push("There is no budget for testing and certification. Most electrical, connected, children's and food-contact products need it before they can be sold.");
  if (firstInventory === 0) gaps.push("There is no first inventory. Minimum order quantities often mean paying for hundreds or thousands of units before the first sale.");
  if (launchCosts === 0) gaps.push("There is no launch budget. Photography, packaging artwork, a website and early marketing usually need funding before revenue arrives.");
  const toolingShare = totalNeeded > 0 ? toolingCost / totalNeeded : 0;
  const level = gaps.length === 0 ? "good" : gaps.length <= 1 ? "borderline" : "worrying";
  window.OrionInsight?.show({
    level,
    headline: gaps.length === 0
      ? `A budget of ${startupCurrency.format(totalNeeded)} covers the usual pre-launch categories, spread over about ${startupCurrency.format(monthlyBurn)} a month.`
      : `This budget of ${startupCurrency.format(totalNeeded)} is missing ${gaps.length === 1 ? "one category" : `${gaps.length} categories`} that first launches commonly underestimate.`,
    points: [
      ...gaps,
      toolingShare > 0.35 ? `Tooling is ${Math.round(toolingShare * 100)}% of the budget. Check whether a bridge route could defer some of it until demand is proven.` : "",
      "Costs land at different times, so the total is not all needed on day one; a cashflow view shows when the money is actually required."
    ],
    next: { href: "cashflow-projection.html", label: "See when the cash is needed" }
  });
};

startupCostForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateStartupCostTool();

  if (window.OrionAnalytics) {
    window.OrionAnalytics.trackEvent("calculate", {
      tool_name: "startup_cost_planner",
      months_to_launch: Math.max(1, getStartupNumber("monthsToLaunch")),
      estimated_budget: Math.max(0, getStartupNumber("designEngineering")) +
        Math.max(0, getStartupNumber("prototypeBuilds")) +
        Math.max(0, getStartupNumber("toolingCost")) +
        Math.max(0, getStartupNumber("complianceCost")) +
        Math.max(0, getStartupNumber("firstInventory")) +
        Math.max(0, getStartupNumber("launchCosts"))
    });
  }
});
startupCostForm.querySelectorAll("input, select, textarea").forEach((field) => {
  field.addEventListener("input", updateStartupCostTool);
  field.addEventListener("change", updateStartupCostTool);
});
if (window.OrionAnalytics) {
  window.OrionAnalytics.trackEvent("tool_used", {
    tool_name: "startup_cost_planner"
  });
}

updateStartupCostTool();

// Low / likely / high range on the main budget lines (shared helper in main.js).
// Mirrors totalNeeded in updateStartupCostTool; contingency stays applied on top.
window.OrionRange?.attach({
  formId: "startupCostForm",
  noun: "pre-launch budget (including contingency)",
  format: (value) => startupCurrency.format(value),
  drivers: [
    { id: "designEngineering", label: "Design and engineering" },
    { id: "prototypeBuilds", label: "Prototype builds" },
    { id: "toolingCost", label: "Tooling and setup" },
    { id: "complianceCost", label: "Compliance and certification" },
    { id: "firstInventory", label: "First inventory" },
    { id: "launchCosts", label: "Launch work" }
  ],
  compute: (get) => {
    const base = ["designEngineering", "prototypeBuilds", "toolingCost", "complianceCost", "firstInventory", "launchCosts"]
      .reduce((sum, id) => sum + Math.max(0, get(id)), 0);
    return base * (1 + Math.max(0, get("contingencyRate")) / 100);
  }
});
