const costForm = document.getElementById("cost-form");
const costSummaryRoot = document.getElementById("costSummary");
const costBreakdownRoot = document.getElementById("costBreakdown");
const costChartContext = document.getElementById("costChart");
const costCopy = document.getElementById("costCopy");

let costChart;

const costCurrency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: window.OrionCurrency?.code() || "GBP",
  maximumFractionDigits: 2
});

const costPercent = new Intl.NumberFormat("en-GB", {
  style: "percent",
  maximumFractionDigits: 1
});

const getCostNumber = (id) => Number(document.getElementById(id).value);

function renderCostSensitivity() {
  window.OrionSensitivity?.render({
    after: costBreakdownRoot,
    title: "Which input matters most for unit cost?",
    better: "lower",
    format: (v) => costCurrency.format(v),
    inputs: [
      { id: "materialCost", label: "Material cost" },
      { id: "processCost", label: "Process cost" },
      { id: "boughtInCost", label: "Bought-in parts" },
      { id: "packagingCost", label: "Packaging" },
      { id: "labourMinutes", label: "Assembly minutes" },
      { id: "labourRate", label: "Labour rate" },
      { id: "scrapRate", label: "Scrap rate" },
      { id: "overheadRate", label: "Overhead rate" }
    ],
    compute: (v) => {
      const direct = v.materialCost + v.processCost + v.boughtInCost + v.packagingCost + (v.labourMinutes / 60) * v.labourRate;
      const scrap = direct * (v.scrapRate / 100);
      return (direct + scrap) * (1 + v.overheadRate / 100);
    }
  });
}

const updateCostTool = () => {
  renderCostSensitivity();
  const annualVolume = Math.max(1, getCostNumber("annualVolume"));
  const sellingPrice = Math.max(0, getCostNumber("sellingPrice"));
  const materialCost = Math.max(0, getCostNumber("materialCost"));
  const processCost = Math.max(0, getCostNumber("processCost"));
  const boughtInCost = Math.max(0, getCostNumber("boughtInCost"));
  const packagingCost = Math.max(0, getCostNumber("packagingCost"));
  const labourMinutes = Math.max(0, getCostNumber("labourMinutes"));
  const labourRate = Math.max(0, getCostNumber("labourRate"));
  const scrapRate = Math.max(0, getCostNumber("scrapRate")) / 100;
  const overheadRate = Math.max(0, getCostNumber("overheadRate")) / 100;

  const labourCost = (labourMinutes / 60) * labourRate;
  const directCost = materialCost + processCost + boughtInCost + packagingCost + labourCost;
  const scrapCost = directCost * scrapRate;
  const overheadCost = (directCost + scrapCost) * overheadRate;
  const cogs = directCost + scrapCost + overheadCost;
  const grossMargin = sellingPrice - cogs;
  const marginRate = sellingPrice > 0 ? grossMargin / sellingPrice : 0;
  const annualSpend = cogs * annualVolume;

  costSummaryRoot.innerHTML = `
    <div class="result-card">
      <strong>${costCurrency.format(cogs)}</strong>
      <span>Estimated fully loaded COGS per unit</span>
    </div>
    <div class="result-card">
      <strong>${costCurrency.format(grossMargin)}</strong>
      <span>Gross margin per unit at the entered selling price</span>
    </div>
    <div class="result-card">
      <strong>${costCurrency.format(annualSpend)}</strong>
      <span>Estimated annual production spend</span>
    </div>
  `;

  costBreakdownRoot.innerHTML = `
    <div class="comparison-item">
      <span>Direct build cost</span>
      <strong>${costCurrency.format(directCost)}</strong>
    </div>
    <div class="comparison-item">
      <span>Scrap and rework allowance</span>
      <strong>${costCurrency.format(scrapCost)}</strong>
    </div>
    <div class="comparison-item">
      <span>Overhead loading</span>
      <strong>${costCurrency.format(overheadCost)}</strong>
    </div>
    <div class="comparison-item">
      <span>Gross margin rate</span>
      <strong>${costPercent.format(marginRate)}</strong>
    </div>
    <div class="comparison-item">
      <span>Annual volume</span>
      <strong>${annualVolume.toLocaleString()} units</strong>
    </div>
  `;

  if (costChart) {
    costChart.destroy();
  }

  costChart = new Chart(costChartContext, {
    type: "doughnut",
    data: {
      labels: [
        "Material",
        "Process",
        "Bought-in parts",
        "Packaging",
        "Labour",
        "Scrap",
        "Overhead"
      ],
      datasets: [
        {
          data: [
            materialCost,
            processCost,
            boughtInCost,
            packagingCost,
            labourCost,
            scrapCost,
            overheadCost
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
              return `${context.label}: ${costCurrency.format(context.parsed)}`;
            }
          }
        }
      }
    }
  });

  if (costCopy) {
    costCopy.value =
      `Product Cost Estimate\n` +
      `Annual volume: ${annualVolume.toLocaleString()} units\n` +
      `Estimated COGS per unit: ${costCurrency.format(cogs)}\n` +
      `Gross margin per unit: ${costCurrency.format(grossMargin)}\n` +
      `Gross margin rate: ${costPercent.format(marginRate)}\n` +
      `Annual production spend: ${costCurrency.format(annualSpend)}`;
  }

  // Plain-English interpretation (shared panel in main.js).
  const drivers = [
    ["materials", materialCost], ["processing", processCost], ["bought-in parts", boughtInCost],
    ["packaging", packagingCost], ["assembly labour", labourCost], ["scrap", scrapCost], ["overhead", overheadCost]
  ].sort((a, b) => b[1] - a[1]);
  const [topName, topValue] = drivers[0];
  const topShare = cogs > 0 ? Math.round((topValue / cogs) * 100) : 0;
  const driverPoint = cogs > 0 ? `The largest cost driver is ${topName} at ${costCurrency.format(topValue)} (${topShare}% of COGS), so that is the first place to look for savings.` : "";
  if (sellingPrice <= 0) {
    window.OrionInsight?.show({
      level: "info",
      headline: `The estimated cost per unit is ${costCurrency.format(cogs)}. Add an expected selling price to see whether it leaves enough margin.`,
      points: [driverPoint],
      next: { href: "route-to-market-simulator.html", label: "Work out a target cost from the retail price" }
    });
  } else {
    const level = marginRate >= 0.5 ? "good" : marginRate >= 0.3 ? "borderline" : "worrying";
    const headline = marginRate < 0
      ? `At ${costCurrency.format(sellingPrice)}, each unit costs more to make than it sells for (a loss of ${costCurrency.format(Math.abs(grossMargin))} per unit).`
      : marginRate >= 0.5
        ? `A gross margin of ${costPercent.format(marginRate)} leaves room for marketing, overheads and profit, provided the selling price is what you actually receive.`
        : marginRate >= 0.3
          ? `A gross margin of ${costPercent.format(marginRate)} is workable for some routes but tight once channel fees, marketing and returns are paid.`
          : `A gross margin of ${costPercent.format(marginRate)} is very thin for a physical product; most launch plans need considerably more.`;
    window.OrionInsight?.show({
      level,
      headline,
      points: [
        driverPoint,
        "Use the price your business receives (after VAT and any retailer or marketplace share) as the selling price, or the margin will look better than it is.",
        "Concept-stage estimates often move by a wide margin as the design firms up; replace assumptions with supplier quotes as early as you can."
      ],
      next: { href: "route-to-market-simulator.html", label: "Check this cost against each sales route" }
    });
  }
};

costForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateCostTool();

  if (window.OrionAnalytics) {
    window.OrionAnalytics.trackEvent("calculate", {
      tool_name: "product_cost_estimator",
      annual_volume: Math.max(1, getCostNumber("annualVolume")),
      selling_price: Math.max(0, getCostNumber("sellingPrice"))
    });
  }
});
costForm.querySelectorAll("input, select, textarea").forEach((field) => {
  field.addEventListener("input", updateCostTool);
  field.addEventListener("change", updateCostTool);
});
if (window.OrionAnalytics) {
  window.OrionAnalytics.trackEvent("tool_used", {
    tool_name: "product_cost_estimator"
  });
}

updateCostTool();

// Low / likely / high range on the main cost drivers (shared helper in main.js).
// Mirrors the COGS formula in updateCostTool.
window.OrionRange?.attach({
  formId: "cost-form",
  noun: "cost per unit (COGS)",
  format: (value) => costCurrency.format(value),
  drivers: [
    { id: "materialCost", label: "Raw material" },
    { id: "processCost", label: "Process" },
    { id: "boughtInCost", label: "Bought-in parts" },
    { id: "labourMinutes", label: "Assembly minutes" },
    { id: "scrapRate", label: "Scrap and rework (%)" }
  ],
  compute: (get) => {
    const labour = (Math.max(0, get("labourMinutes")) / 60) * Math.max(0, get("labourRate"));
    const direct = Math.max(0, get("materialCost")) + Math.max(0, get("processCost")) + Math.max(0, get("boughtInCost")) + Math.max(0, get("packagingCost")) + labour;
    const scrap = direct * (Math.max(0, get("scrapRate")) / 100);
    return (direct + scrap) * (1 + Math.max(0, get("overheadRate")) / 100);
  }
});
