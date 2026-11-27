const investorMetricsForm = document.getElementById("investor-metrics-form");
const investorMetricsSummary = document.getElementById("investorMetricsSummary");
const investorMetricsRecommendation = document.getElementById("investorMetricsRecommendation");
const investorMetricsCopy = document.getElementById("investorMetricsCopy");
const investorMetricsChartCanvas = document.getElementById("investorMetricsChart");

let investorMetricsChart;

const investorMoney = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: window.OrionCurrency?.code() || "GBP",
  maximumFractionDigits: 0
});

const investorRead = (id) => Number(document.getElementById(id).value);

const renderInvestorMetricsChart = (values) => {
  if (investorMetricsChart) {
    investorMetricsChart.destroy();
  }

  investorMetricsChart = new Chart(investorMetricsChartCanvas, {
    type: "bar",
    data: {
      labels: ["Revenue", "Gross profit", "Net burn"],
      datasets: [
        {
          label: `Monthly figures (${window.OrionCurrency?.symbol() || "£"})`,
          data: values,
          backgroundColor: [OrionColours.get("indigo"), OrionColours.get("teal"), OrionColours.get("magenta")],
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

// Investor metrics from raw inputs. This is the tool's only copy of the maths;
// the sensitivity view calls it too, so both always agree.
const investorInputIds = ["monthlyUnits", "averageSellingPrice", "investorUnitCogs", "monthlyBurn", "cashBalance", "marketingSpend", "qualifiedLeads", "leadConversion"];
const investorValues = () => Object.fromEntries(investorInputIds.map((id) => [id, investorRead(id)]));

const investorMetricsFrom = (v) => {
  const monthlyUnits = Math.max(1, v.monthlyUnits);
  const averageSellingPrice = Math.max(1, v.averageSellingPrice);
  const investorUnitCogs = Math.max(0, v.investorUnitCogs);
  const monthlyBurn = Math.max(0, v.monthlyBurn);
  const cashBalance = Math.max(0, v.cashBalance);
  const marketingSpend = Math.max(0, v.marketingSpend);
  const qualifiedLeads = Math.max(1, v.qualifiedLeads);
  const leadConversion = Math.max(0.001, v.leadConversion) / 100;

  const monthlyRevenue = monthlyUnits * averageSellingPrice;
  const grossProfitPerUnit = averageSellingPrice - investorUnitCogs;
  const monthlyGrossProfit = monthlyUnits * grossProfitPerUnit;
  const grossMargin = averageSellingPrice > 0 ? (grossProfitPerUnit / averageSellingPrice) * 100 : 0;
  const acquiredCustomers = Math.max(1, qualifiedLeads * leadConversion);
  const cac = marketingSpend / acquiredCustomers;
  const paybackOrders = grossProfitPerUnit > 0 ? cac / grossProfitPerUnit : Infinity;
  const netBurn = Math.max(0, monthlyBurn - monthlyGrossProfit);
  const runwayMonths = netBurn > 0 ? cashBalance / netBurn : Infinity;
  return {
    monthlyUnits, averageSellingPrice, investorUnitCogs, monthlyBurn, cashBalance, marketingSpend, qualifiedLeads, leadConversion,
    monthlyRevenue, grossProfitPerUnit, monthlyGrossProfit, grossMargin, acquiredCustomers, cac, paybackOrders, netBurn, runwayMonths
  };
};

function renderInvestorSensitivity() {
  window.OrionSensitivity?.render({
    after: investorMetricsRecommendation,
    title: "Which input matters most for runway?",
    better: "higher",
    note: "Shown in months of runway; acquisition inputs do not change runway, and a change that lets gross profit cover the burn is left out.",
    format: (v) => `${v.toFixed(1)} months`,
    inputs: [
      { id: "monthlyUnits", label: "Monthly units sold" },
      { id: "averageSellingPrice", label: "Average selling price" },
      { id: "investorUnitCogs", label: "Unit COGS" },
      { id: "monthlyBurn", label: "Monthly operating burn" },
      { id: "cashBalance", label: "Cash balance" }
    ],
    compute: (values) => investorMetricsFrom({ ...investorValues(), ...values }).runwayMonths
  });
}

const updateInvestorMetricsTool = () => {
  renderInvestorSensitivity();
  const {
    monthlyUnits, averageSellingPrice, investorUnitCogs, monthlyBurn, cashBalance, marketingSpend,
    monthlyRevenue, grossProfitPerUnit, monthlyGrossProfit, grossMargin, cac, paybackOrders, netBurn, runwayMonths
  } = investorMetricsFrom(investorValues());

  investorMetricsSummary.innerHTML = `
    <div class="result-card">
      <strong>${investorMoney.format(monthlyRevenue)}</strong>
      <span>Monthly revenue</span>
    </div>
    <div class="result-card">
      <strong>${grossMargin.toFixed(1)}%</strong>
      <span>Gross margin per unit</span>
    </div>
    <div class="result-card">
      <strong>${Number.isFinite(runwayMonths) ? runwayMonths.toFixed(1) : "Cash positive"}</strong>
      <span>${Number.isFinite(runwayMonths) ? "Months of runway at current net burn" : "Gross profit currently covers monthly burn"}</span>
    </div>
  `;

  investorMetricsRecommendation.innerHTML = `
    <span class="score-chip ${grossMargin >= 45 && (Number.isFinite(runwayMonths) ? runwayMonths >= 12 : true) ? "score-chip-strong" : "score-chip-caution"}">
      ${grossMargin >= 45 ? "Margin signal is healthy" : "Margin signal needs work"}
    </span>
    <h2>${investorMoney.format(cac)} CAC with ${Number.isFinite(paybackOrders) ? paybackOrders.toFixed(1) : "n/a"} gross-profit orders to recover it.</h2>
    <p>
      Monthly gross profit is ${investorMoney.format(monthlyGrossProfit)} against ${investorMoney.format(monthlyBurn)} in operating burn.
      ${Number.isFinite(runwayMonths) ? `That leaves ${runwayMonths.toFixed(1)} months of runway at the current pace.` : "The current monthly gross profit fully offsets the operating burn."}
    </p>
  `;

  investorMetricsCopy.value =
    `Investor Metrics and KPIs\n` +
    `Monthly units sold: ${monthlyUnits.toLocaleString()}\n` +
    `Monthly revenue: ${investorMoney.format(monthlyRevenue)}\n` +
    `Monthly gross profit: ${investorMoney.format(monthlyGrossProfit)}\n` +
    `Gross margin: ${grossMargin.toFixed(1)}%\n` +
    `CAC: ${investorMoney.format(cac)}\n` +
    `Payback orders: ${Number.isFinite(paybackOrders) ? paybackOrders.toFixed(1) : "n/a"}\n` +
    `Runway: ${Number.isFinite(runwayMonths) ? `${runwayMonths.toFixed(1)} months` : "cash positive"}`;

  renderInvestorMetricsChart([monthlyRevenue, monthlyGrossProfit, netBurn]);

  // Plain-English interpretation (shared panel in main.js).
  const rank = { good: 0, borderline: 1, worrying: 2 };
  const marginLevel = grossMargin >= 45 ? "good" : grossMargin >= 30 ? "borderline" : "worrying";
  const runwayLevel = runwayMonths >= 12 ? "good" : runwayMonths >= 6 ? "borderline" : "worrying";
  const cacLevel = cac === 0 ? "good" : !Number.isFinite(paybackOrders) ? "worrying" : paybackOrders <= 1 ? "good" : "borderline";
  const signals = [
    { key: "runway", level: runwayLevel, name: "the runway" },
    { key: "margin", level: marginLevel, name: "the gross margin" },
    { key: "cac", level: cacLevel, name: "acquisition cost recovery" }
  ];
  const worst = signals.reduce((top, signal) => (rank[signal.level] > rank[top.level] ? signal : top), signals[0]);
  const level = worst.level;
  const flagged = signals.filter((signal) => signal.level === level).map((signal) => signal.name);
  const flaggedText = flagged.length > 1 ? `${flagged.slice(0, -1).join(", ")} and ${flagged[flagged.length - 1]}` : flagged[0];

  const marginText = `a ${grossMargin.toFixed(1)}% gross margin`;
  const runwayText = runwayMonths < 1 ? "less than a month of runway" : Number.isFinite(runwayMonths) ? `${runwayMonths.toFixed(1)} months of runway` : "gross profit that covers monthly burn";
  const cacText = cac === 0
    ? "no paid acquisition cost"
    : Number.isFinite(paybackOrders)
    ? `CAC of ${investorMoney.format(cac)} recovered in ${paybackOrders.toFixed(1)} orders`
    : `CAC of ${investorMoney.format(cac)} that is never recovered`;
  const summary = `With ${marginText}, ${runwayText} and ${cacText}`;
  const headline = level === "good"
    ? `${summary}, all three signals sit in the ranges commonly seen as healthy for hardware.`
    : level === "borderline"
      ? `${summary}, the business may work, but ${flaggedText} ${flagged.length > 1 ? "need" : "needs"} a clear plan to improve.`
      : `${summary}, ${flaggedText} ${flagged.length > 1 ? "need" : "needs"} attention before spending more on growth.`;

  const advice = {
    runway: runwayLevel === "worrying"
      ? `At a net burn of ${investorMoney.format(netBurn)} a month, cash lasts ${runwayMonths < 1 ? "less than a month" : `about ${runwayMonths.toFixed(1)} months`}; fundraising usually takes several months, so cost cuts or funding need to start now.`
      : "Many founders aim to raise with roughly twelve to eighteen months of runway, so plan funding or cost reductions well before cash gets tight.",
    margin: marginLevel === "worrying"
      ? "A gross margin below about 30% leaves little room for returns, discounts and channel costs; hardware businesses commonly aim for roughly 45% or more."
      : "A margin in the 30% to 45% range can work, but it needs a clear route upwards, usually through unit cost reduction or pricing.",
    cac: cacLevel === "worrying"
      ? `Each unit makes ${investorMoney.format(grossProfitPerUnit)} of gross profit, so the cost of acquiring a customer is never recovered; fix unit cost or price before spending more on marketing.`
      : `It takes about ${Number.isFinite(paybackOrders) ? paybackOrders.toFixed(1) : "n/a"} orders to recover acquisition cost; as most hardware is bought once, recovering it on the first order matters, unless you also sell consumables or services.`
  };
  const points = signals.filter((signal) => signal.level !== "good").map((signal) => advice[signal.key]);
  if (level === "good") {
    points.push(
      "These figures are a snapshot of one month; rerun them as costs and channels firm up.",
      "If you sell consumables or services alongside the device, note that separately, as repeat revenue is not included here."
    );
  }

  const next = level === "good"
    ? { href: "product-plan-builder.html", label: "Bring cost, margin and cash together in the Product Plan Builder" }
    : worst.key === "runway"
      ? { href: "cashflow-projection.html", label: "Map month-by-month cash in the Cashflow Projection" }
      : { href: "product-plan-builder.html", label: "Plan which number improves next in the Product Plan Builder" };

  window.OrionInsight?.show({ level, headline, points: points.slice(0, 3), next });
};

investorMetricsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateInvestorMetricsTool();

  if (window.OrionAnalytics) {
    window.OrionAnalytics.trackEvent("calculate", {
      tool_name: "investor_metrics_kpis",
      monthly_units: Math.max(1, investorRead("monthlyUnits")),
      cash_balance: Math.max(0, investorRead("cashBalance"))
    });
  }
});
investorMetricsForm.querySelectorAll("input, select, textarea").forEach((field) => {
  field.addEventListener("input", updateInvestorMetricsTool);
  field.addEventListener("change", updateInvestorMetricsTool);
});
if (window.OrionAnalytics) {
  window.OrionAnalytics.trackEvent("tool_used", {
    tool_name: "investor_metrics_kpis"
  });
}

updateInvestorMetricsTool();
