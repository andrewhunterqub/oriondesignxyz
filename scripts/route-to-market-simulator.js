const routeMarketForm = document.getElementById("route-market-form");
const routeMarketSummary = document.getElementById("routeMarketSummary");
const routeMarketBreakdown = document.getElementById("routeMarketBreakdown");
const routeMarketCopy = document.getElementById("routeMarketCopy");
const routeMarketChartCanvas = document.getElementById("routeMarketChart");

let routeMarketChart;

const routeMoney = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: window.OrionCurrency?.code() || "GBP",
  maximumFractionDigits: 0
});

const routeRead = (id) => Number(document.getElementById(id).value);

const renderRouteMarketChart = (labels, values) => {
  if (routeMarketChart) {
    routeMarketChart.destroy();
  }

  routeMarketChart = new Chart(routeMarketChartCanvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: `Target COGS ceiling per unit (${window.OrionCurrency?.symbol() || "£"})`,
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

// Retail-route COGS ceiling from raw inputs, used by the sensitivity view (same maths as below).
const routeRetailCeilingFrom = (v) => {
  const exVat = Math.max(1, v.marketListPrice) / (1 + Math.max(0, Math.min(30, v.vatRate)) / 100);
  const retained = exVat * (1 - Math.max(0, Math.min(70, v.retailerMargin)) / 100);
  const hidden = v.warehouseCost + v.secondaryPackaging + v.retailLogistics + v.retailerCosts;
  return retained - hidden - retained * (Math.max(0, Math.min(60, v.targetMargin)) / 100);
};

function renderRouteSensitivity() {
  window.OrionSensitivity?.render({
    after: routeMarketBreakdown,
    title: "Which input matters most for the retail COGS ceiling?",
    better: "higher",
    note: "Shown for the retailer route, usually the tightest.",
    format: (v) => `${new Intl.NumberFormat("en-GB", { style: "currency", currency: window.OrionCurrency?.code() || "GBP", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)} a unit`,
    inputs: [
      { id: "marketListPrice", label: "RRP including VAT" },
      { id: "retailerMargin", label: "Retailer margin" },
      { id: "targetMargin", label: "Target operating margin" },
      { id: "vatRate", label: "VAT rate" },
      { id: "retailLogistics", label: "Retail inbound logistics" },
      { id: "retailerCosts", label: "Retail trade spend and account costs" },
      { id: "warehouseCost", label: "Warehousing per unit" },
      { id: "secondaryPackaging", label: "Secondary packaging per unit" }
    ],
    compute: routeRetailCeilingFrom
  });
}

const updateRouteMarketTool = () => {
  renderRouteSensitivity();
  const rrp = Math.max(1, routeRead("marketListPrice"));
  const vatRate = Math.max(0, Math.min(30, routeRead("vatRate"))) / 100;
  const exVatPrice = rrp / (1 + vatRate);
  const targetMargin = Math.max(0, Math.min(60, routeRead("targetMargin"))) / 100;
  const currentCogs = Math.max(0, routeRead("marketCogs"));

  const warehouseCost = Math.max(0, routeRead("warehouseCost"));
  const secondaryPackaging = Math.max(0, routeRead("secondaryPackaging"));
  const sharedBase = warehouseCost + secondaryPackaging;

  const dtcLogistics = Math.max(0, routeRead("dtcLogistics"));
  const retailLogistics = Math.max(0, routeRead("retailLogistics"));
  const dtcSiteFees = Math.max(0, routeRead("dtcSiteFees"));
  const dtcMarketing = Math.max(0, routeRead("dtcMarketing"));
  const marketplaceFee = Math.max(0, Math.min(40, routeRead("marketplaceFee"))) / 100;
  const marketplaceCosts = Math.max(0, routeRead("marketplaceCosts"));
  const retailerMargin = Math.max(0, Math.min(70, routeRead("retailerMargin"))) / 100;
  const retailerCosts = Math.max(0, routeRead("retailerCosts"));

  const channelRows = [
    {
      label: "DTC",
      retainedRevenue: exVatPrice,
      hiddenCosts: sharedBase + dtcLogistics + dtcSiteFees + dtcMarketing
    },
    {
      label: "Marketplace",
      retainedRevenue: exVatPrice * (1 - marketplaceFee),
      hiddenCosts: sharedBase + dtcLogistics + marketplaceCosts
    },
    {
      label: "Retailer",
      retainedRevenue: exVatPrice * (1 - retailerMargin),
      hiddenCosts: sharedBase + retailLogistics + retailerCosts
    }
  ].map((channel) => {
    const targetProfit = channel.retainedRevenue * targetMargin;
    const maxCogs = channel.retainedRevenue - channel.hiddenCosts - targetProfit;
    const marginAtCurrentCogs = channel.retainedRevenue > 0
      ? ((channel.retainedRevenue - channel.hiddenCosts - currentCogs) / channel.retainedRevenue) * 100
      : 0;

    return {
      ...channel,
      targetProfit,
      maxCogs,
      cogsGap: maxCogs - currentCogs,
      marginAtCurrentCogs
    };
  });

  const bestChannel = [...channelRows].sort((left, right) => right.maxCogs - left.maxCogs)[0];
  const viableChannels = channelRows.filter((channel) => channel.maxCogs >= 0).length;

  routeMarketSummary.innerHTML = `
    <div class="result-card">
      <strong>${routeMoney.format(exVatPrice)}</strong>
      <span>Price left after VAT</span>
    </div>
    <div class="result-card">
      <strong>${bestChannel.label}</strong>
      <span>Route with the highest COGS ceiling</span>
    </div>
    <div class="result-card">
      <strong>${viableChannels} / ${channelRows.length}</strong>
      <span>Routes that still support a positive COGS</span>
    </div>
  `;

  routeMarketBreakdown.innerHTML = channelRows
    .map((channel) => `
      <div class="comparison-item">
        <span>${channel.label}: keeps ${routeMoney.format(channel.retainedRevenue)}, hidden costs ${routeMoney.format(channel.hiddenCosts)}</span>
        <strong>${routeMoney.format(channel.maxCogs)} target COGS${channel.cogsGap >= 0 ? `, ${routeMoney.format(channel.cogsGap)} headroom` : `, ${routeMoney.format(Math.abs(channel.cogsGap))} above target`}</strong>
      </div>
    `)
    .join("");

  routeMarketCopy.value =
    `Target COGS by Route to Market\n` +
    `RRP incl. VAT: ${routeMoney.format(rrp)}\n` +
    `Price after VAT: ${routeMoney.format(exVatPrice)}\n` +
    `Target operating margin: ${(targetMargin * 100).toFixed(0)}%\n` +
    `Current / estimated COGS: ${routeMoney.format(currentCogs)}\n` +
    channelRows
      .map((channel) =>
        `${channel.label}: retained revenue ${routeMoney.format(channel.retainedRevenue)}, hidden costs ${routeMoney.format(channel.hiddenCosts)}, target COGS ${routeMoney.format(channel.maxCogs)}, current-margin view ${channel.marginAtCurrentCogs.toFixed(1)}%`
      )
      .join("\n");

  renderRouteMarketChart(
    channelRows.map((channel) => channel.label),
    channelRows.map((channel) => Math.max(0, channel.maxCogs))
  );

  // Plain-English interpretation (shared panel in main.js).
  const working = channelRows.filter((channel) => channel.cogsGap >= 0);
  const failing = channelRows.filter((channel) => channel.cogsGap < 0);
  const names = (rows) => rows.map((channel) => channel.label).join(", ");
  let insight;
  if (!failing.length) {
    const tightest = [...channelRows].sort((a, b) => a.cogsGap - b.cogsGap)[0];
    const tight = tightest.maxCogs > 0 && tightest.cogsGap / tightest.maxCogs < 0.15;
    insight = {
      level: tight ? "borderline" : "good",
      headline: tight
        ? `Your current COGS fits every route, but ${tightest.label} has only ${routeMoney.format(tightest.cogsGap)} of headroom.`
        : "Your current COGS fits under the ceiling for every route, with room for cost increases or promotions.",
      points: ["Headroom protects you against currency moves, supplier price rises and discounting; keep some in reserve rather than spending it all on specification."]
    };
  } else if (working.length) {
    const worst = [...failing].sort((a, b) => a.cogsGap - b.cogsGap)[0];
    insight = {
      level: "borderline",
      headline: `Your current COGS works for ${names(working)} but not for ${names(failing)}.`,
      points: [
        `To sell through ${worst.label}, COGS would need to fall by about ${routeMoney.format(Math.abs(worst.cogsGap))}, or the price or target margin would need to change.`,
        "Many products launch through the route that works first and earn their way into retail with a cost-reduced version."
      ]
    };
  } else {
    const nearest = [...channelRows].sort((a, b) => b.cogsGap - a.cogsGap)[0];
    insight = {
      level: "worrying",
      headline: "Your current COGS is above the ceiling for every route at this price and margin.",
      points: [
        `The closest is ${nearest.label}, which needs COGS about ${routeMoney.format(Math.abs(nearest.cogsGap))} lower.`,
        "Design decisions such as part count, materials and assembly method are usually the biggest lever; price and target margin are the others."
      ]
    };
  }
  window.OrionInsight?.show({ ...insight, next: { href: "product-cost-estimator.html", label: "Find where the unit cost comes from" } });
};

routeMarketForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateRouteMarketTool();

  if (window.OrionAnalytics) {
    window.OrionAnalytics.trackEvent("calculate", {
      tool_name: "target_cogs_by_route",
      expected_rrp: Math.max(1, routeRead("marketListPrice")),
      target_margin: Math.max(0, routeRead("targetMargin"))
    });
  }
});
routeMarketForm.querySelectorAll("input, select, textarea").forEach((field) => {
  field.addEventListener("input", updateRouteMarketTool);
  field.addEventListener("change", updateRouteMarketTool);
});
if (window.OrionAnalytics) {
  window.OrionAnalytics.trackEvent("tool_used", {
    tool_name: "target_cogs_by_route"
  });
}

updateRouteMarketTool();
