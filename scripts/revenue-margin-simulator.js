const revenueForm = document.getElementById("revenue-form");
const revenueSummary = document.getElementById("revenueSummary");
const revenueBreakdown = document.getElementById("revenueBreakdown");
const revenueCopy = document.getElementById("revenueCopy");
const revenueChartCanvas = document.getElementById("revenueChart");

const moneyFormat = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: window.OrionCurrency?.code() || "GBP",
  maximumFractionDigits: 0
});

let revenueChart;

const revenueRead = (id) => Number(document.getElementById(id).value);

const renderRevenueChart = (labels, values) => {
  if (revenueChart) {
    revenueChart.destroy();
  }

  revenueChart = new Chart(revenueChartCanvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: `Annual contribution by route (${window.OrionCurrency?.symbol() || "£"})`,
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

// Annual operating profit from raw inputs, used by the sensitivity view (same maths as below).
// Inputs not passed in are read from the form, so the channel mix stays as entered.
const revenueProfitFrom = (v) => {
  const get = (id) => (id in v ? v[id] : revenueRead(id));
  const units = Math.max(1, get("annualUnits"));
  const exVat = Math.max(1, get("sellingPrice")) / (1 + Math.max(0, Math.min(30, get("vatRate"))) / 100);
  const raw = ["dtcMix", "marketplaceMix", "retailerMix"].map((id) => Math.max(0, get(id)));
  const total = raw.reduce((a, b) => a + b, 0) || 100;
  const shared = Math.max(0, get("warehouseCost")) + Math.max(0, get("secondaryPackaging"));
  const returnRate = Math.max(0, Math.min(20, get("returnRate"))) / 100;
  const cogs = Math.max(0, get("unitCogs"));
  const routes = [
    [exVat, shared + get("dtcLogistics") + get("dtcSiteFees") + get("dtcMarketing")],
    [exVat * (1 - Math.max(0, Math.min(40, get("marketplaceFee"))) / 100), shared + get("dtcLogistics") + get("marketplaceCosts")],
    [exVat * (1 - Math.max(0, Math.min(70, get("retailerMargin"))) / 100), shared + get("retailLogistics") + get("retailerCosts")]
  ];
  const contribution = routes.reduce((sum, [kept, extra], i) => sum + units * (raw[i] / total) * (kept - cogs - extra - kept * returnRate), 0);
  return contribution - Math.max(0, get("annualOverhead"));
};

function renderRevenueSensitivity() {
  window.OrionSensitivity?.render({
    after: revenueBreakdown,
    title: "Which input matters most for operating profit?",
    better: "higher",
    note: "The channel mix is kept as entered.",
    format: (v) => `${moneyFormat.format(v)} a year`,
    inputs: [
      { id: "sellingPrice", label: "RRP including VAT" },
      { id: "unitCogs", label: "Unit COGS" },
      { id: "annualUnits", label: "Annual units" },
      { id: "annualOverhead", label: "Annual fixed overhead" },
      { id: "retailerMargin", label: "Retailer margin" },
      { id: "marketplaceFee", label: "Marketplace fee" },
      { id: "returnRate", label: "Returns and aftercare reserve" },
      { id: "dtcMarketing", label: "DTC marketing per unit" },
      { id: "dtcLogistics", label: "DTC pick, pack and delivery" },
      { id: "retailLogistics", label: "Retail inbound logistics" },
      { id: "warehouseCost", label: "Warehousing per unit" }
    ],
    compute: revenueProfitFrom
  });
}

const updateRevenueTool = () => {
  renderRevenueSensitivity();
  const annualUnits = Math.max(1, revenueRead("annualUnits"));
  const rrp = Math.max(1, revenueRead("sellingPrice"));
  const vatRate = Math.max(0, Math.min(30, revenueRead("vatRate"))) / 100;
  const exVatPrice = rrp / (1 + vatRate);
  const unitCogs = Math.max(0, revenueRead("unitCogs"));
  const annualOverhead = Math.max(0, revenueRead("annualOverhead"));

  const rawShares = [
    Math.max(0, revenueRead("dtcMix")),
    Math.max(0, revenueRead("marketplaceMix")),
    Math.max(0, revenueRead("retailerMix"))
  ];
  const totalShare = rawShares.reduce((sum, value) => sum + value, 0) || 100;
  const shares = rawShares.map((value) => value / totalShare);

  const warehouseCost = Math.max(0, revenueRead("warehouseCost"));
  const secondaryPackaging = Math.max(0, revenueRead("secondaryPackaging"));
  const sharedBase = warehouseCost + secondaryPackaging;
  const returnRate = Math.max(0, Math.min(20, revenueRead("returnRate"))) / 100;

  const dtcLogistics = Math.max(0, revenueRead("dtcLogistics"));
  const retailLogistics = Math.max(0, revenueRead("retailLogistics"));
  const dtcSiteFees = Math.max(0, revenueRead("dtcSiteFees"));
  const dtcMarketing = Math.max(0, revenueRead("dtcMarketing"));
  const marketplaceFee = Math.max(0, Math.min(40, revenueRead("marketplaceFee"))) / 100;
  const marketplaceCosts = Math.max(0, revenueRead("marketplaceCosts"));
  const retailerMargin = Math.max(0, Math.min(70, revenueRead("retailerMargin"))) / 100;
  const retailerCosts = Math.max(0, revenueRead("retailerCosts"));

  const channelRows = [
    {
      label: "DTC",
      share: shares[0],
      retainedRevenue: exVatPrice,
      extraCosts: sharedBase + dtcLogistics + dtcSiteFees + dtcMarketing
    },
    {
      label: "Marketplace",
      share: shares[1],
      retainedRevenue: exVatPrice * (1 - marketplaceFee),
      extraCosts: sharedBase + dtcLogistics + marketplaceCosts
    },
    {
      label: "Retailer",
      share: shares[2],
      retainedRevenue: exVatPrice * (1 - retailerMargin),
      extraCosts: sharedBase + retailLogistics + retailerCosts
    }
  ].map((channel) => {
    const returnReserve = channel.retainedRevenue * returnRate;
    const contributionPerUnit = channel.retainedRevenue - unitCogs - channel.extraCosts - returnReserve;
    const annualContribution = annualUnits * channel.share * contributionPerUnit;

    return {
      ...channel,
      returnReserve,
      contributionPerUnit,
      annualContribution,
      marginPercent: channel.retainedRevenue > 0 ? (contributionPerUnit / channel.retainedRevenue) * 100 : 0
    };
  });

  const weightedContributionPerUnit = channelRows.reduce(
    (sum, channel) => sum + (channel.share * channel.contributionPerUnit),
    0
  );
  const annualNetRevenue = channelRows.reduce(
    (sum, channel) => sum + (annualUnits * channel.share * channel.retainedRevenue),
    0
  );
  const annualContribution = channelRows.reduce((sum, channel) => sum + channel.annualContribution, 0);
  const contributionMargin = annualNetRevenue > 0 ? (annualContribution / annualNetRevenue) * 100 : 0;
  const operatingProfit = annualContribution - annualOverhead;
  const breakEvenUnits = weightedContributionPerUnit > 0 ? annualOverhead / weightedContributionPerUnit : Infinity;
  const strongestChannel = [...channelRows].sort((left, right) => right.contributionPerUnit - left.contributionPerUnit)[0];

  revenueSummary.innerHTML = `
    <div class="result-card">
      <strong>${moneyFormat.format(annualContribution)}</strong>
      <span>Annual contribution before overhead</span>
    </div>
    <div class="result-card">
      <strong>${contributionMargin.toFixed(1)}%</strong>
      <span>Blended contribution margin</span>
    </div>
    <div class="result-card">
      <strong>${operatingProfit === Infinity ? "N/A" : moneyFormat.format(operatingProfit)}</strong>
      <span>Operating profit after overhead</span>
    </div>
  `;

  revenueBreakdown.innerHTML = `
    <div class="comparison-item">
      <span>Net revenue kept after VAT and route deductions</span>
      <strong>${moneyFormat.format(annualNetRevenue)}</strong>
    </div>
    <div class="comparison-item">
      <span>Strongest route contribution per unit</span>
      <strong>${strongestChannel.label} at ${moneyFormat.format(strongestChannel.contributionPerUnit)}</strong>
    </div>
    <div class="comparison-item">
      <span>Break-even volume at current mix</span>
      <strong>${Number.isFinite(breakEvenUnits) ? `${Math.ceil(breakEvenUnits).toLocaleString()} units` : "Not viable at current assumptions"}</strong>
    </div>
    ${channelRows
      .map((channel) => `
        <div class="comparison-item">
          <span>${channel.label} (${(channel.share * 100).toFixed(0)}% mix, ${channel.marginPercent.toFixed(1)}% margin)</span>
          <strong>${moneyFormat.format(channel.annualContribution)} annual contribution</strong>
        </div>
      `)
      .join("")}
  `;

  revenueCopy.value =
    `Launch Margin Planner\n` +
    `Annual units: ${annualUnits.toLocaleString()}\n` +
    `RRP incl. VAT: ${moneyFormat.format(rrp)}\n` +
    `Price after VAT: ${moneyFormat.format(exVatPrice)}\n` +
    `Unit COGS: ${moneyFormat.format(unitCogs)}\n` +
    `Annual contribution: ${moneyFormat.format(annualContribution)}\n` +
    `Contribution margin: ${contributionMargin.toFixed(1)}%\n` +
    `Operating profit after overhead: ${moneyFormat.format(operatingProfit)}\n` +
    `Break-even volume: ${Number.isFinite(breakEvenUnits) ? Math.ceil(breakEvenUnits).toLocaleString() : "Not viable"}\n` +
    channelRows
      .map((channel) => `${channel.label}: ${(channel.share * 100).toFixed(0)}% mix, ${moneyFormat.format(channel.contributionPerUnit)} per unit, ${moneyFormat.format(channel.annualContribution)} annual contribution`)
      .join("\n");

  renderRevenueChart(
    channelRows.map((channel) => channel.label),
    channelRows.map((channel) => Math.max(0, channel.annualContribution))
  );

  // Plain-English interpretation (shared panel in main.js).
  const money = (value) => moneyFormat.format(value);
  const activeRoutes = channelRows.filter((channel) => channel.share > 0);
  const weakestRoute = [...activeRoutes].sort((left, right) => left.contributionPerUnit - right.contributionPerUnit)[0];
  const thinRoute = activeRoutes.length > 1 && weakestRoute && (weakestRoute.contributionPerUnit <= 0 || weakestRoute.marginPercent < 10) ? weakestRoute : null;
  const breakEvenRatio = Number.isFinite(breakEvenUnits) ? breakEvenUnits / annualUnits : Infinity;
  const cogsShareOfRrp = unitCogs / rrp;
  const retailInMix = shares[2] > 0;

  let level;
  let headline;
  if (!Number.isFinite(breakEvenUnits)) {
    level = "worrying";
    headline = weightedContributionPerUnit < 0
      ? `At the current mix each unit loses ${money(-weightedContributionPerUnit)} on average before overhead, so there is no break-even volume and more sales would only increase the loss.`
      : "At the current mix each unit contributes nothing towards overhead, so there is no break-even volume at any level of sales.";
  } else if (operatingProfit < 0) {
    level = breakEvenRatio > 1.25 ? "worrying" : "borderline";
    headline = breakEvenRatio > 1.25
      ? `The plan loses ${money(-operatingProfit)} a year: break-even needs ${Math.ceil(breakEvenUnits).toLocaleString()} units, ${breakEvenRatio.toFixed(1)} times your forecast of ${annualUnits.toLocaleString()}.`
      : `The plan is just short of break-even, losing ${money(-operatingProfit)} a year: you need ${Math.ceil(breakEvenUnits).toLocaleString()} units against a forecast of ${annualUnits.toLocaleString()}.`;
  } else if (breakEvenRatio > 0.8) {
    level = "borderline";
    headline = `The plan makes ${money(operatingProfit)} a year, but break-even at ${Math.ceil(breakEvenUnits).toLocaleString()} units is ${Math.round(breakEvenRatio * 100)}% of your forecast, so a modest shortfall in sales would mean a loss.`;
  } else {
    level = thinRoute ? "borderline" : "good";
    headline = `The plan makes ${money(operatingProfit)} a year after overhead, with break-even at ${Math.ceil(breakEvenUnits).toLocaleString()} units, ${Math.round(breakEvenRatio * 100)}% of your forecast, and a blended contribution margin of ${contributionMargin.toFixed(1)}%.`;
  }

  const points = [];
  if (thinRoute) {
    points.push(thinRoute.contributionPerUnit <= 0
      ? `${thinRoute.label} loses ${money(-thinRoute.contributionPerUnit)} per unit, which the other routes are carrying; consider whether it is worth its cost at launch or better added later.`
      : `${thinRoute.label} keeps only ${thinRoute.marginPercent.toFixed(1)}% of its revenue as contribution (${money(thinRoute.contributionPerUnit)} per unit), so check the volume it brings justifies it.`);
  } else if (strongestChannel && activeRoutes.length > 1) {
    points.push(`${strongestChannel.label} contributes the most per unit at ${money(strongestChannel.contributionPerUnit)}; shifting the mix towards it raises margin, if the volume holds.`);
  }
  if (level !== "good" && retailInMix && cogsShareOfRrp > 0.3) {
    points.push(`Unit COGS is ${Math.round(cogsShareOfRrp * 100)}% of the RRP; when retail is in the mix, a COGS of roughly a quarter of RRP or less is a common target, so look at cost before assuming volume will close the gap.`);
  } else if (level === "worrying") {
    points.push("Look first at unit COGS and the most expensive route, rather than assuming higher volume will close the gap.");
  }
  points.push("If unit COGS has not yet been confirmed by a manufacturer, try a figure 10% to 20% higher to see how much headroom the plan really has.");

  const next = level === "worrying" || (level === "borderline" && cogsShareOfRrp > 0.3)
    ? { href: "product-cost-estimator.html", label: "Check the unit cost in the Product Cost Estimator" }
    : { href: "route-to-market-simulator.html", label: "Compare routes in more detail in the Route to Market Simulator" };

  window.OrionInsight?.show({ level, headline, points: points.slice(0, 3), next });
};

revenueForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateRevenueTool();

  if (window.OrionAnalytics) {
    window.OrionAnalytics.trackEvent("calculate", {
      tool_name: "launch_margin_planner",
      annual_units: Math.max(1, revenueRead("annualUnits")),
      rrp: Math.max(1, revenueRead("sellingPrice"))
    });
  }
});
revenueForm.querySelectorAll("input, select, textarea").forEach((field) => {
  field.addEventListener("input", updateRevenueTool);
  field.addEventListener("change", updateRevenueTool);
});
if (window.OrionAnalytics) {
  window.OrionAnalytics.trackEvent("tool_used", {
    tool_name: "launch_margin_planner"
  });
}

updateRevenueTool();
