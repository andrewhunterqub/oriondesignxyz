const breakEvenForm = document.getElementById("breakEvenForm");
const breakEvenSummaryRoot = document.getElementById("breakEvenSummary");
const breakEvenBreakdownRoot = document.getElementById("breakEvenBreakdown");
const breakEvenChartContext = document.getElementById("breakEvenChart");
const breakEvenCopy = document.getElementById("breakEvenCopy");

let breakEvenChart;

const breakEvenCurrency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: window.OrionCurrency?.code() || "GBP",
  maximumFractionDigits: 0
});

const getBreakEvenNumber = (id) => Number(document.getElementById(id).value);

function renderBreakEvenSensitivity() {
  window.OrionSensitivity?.render({
    after: breakEvenBreakdownRoot,
    title: "Which input matters most for break-even?",
    better: "lower",
    format: (v) => `${Math.round(v).toLocaleString()} units`,
    inputs: [
      { id: "fixedCosts", label: "Fixed costs" },
      { id: "sellingPriceBreakEven", label: "Selling price" },
      { id: "variableCost", label: "Variable cost" }
    ],
    compute: (v) => {
      const contribution = v.sellingPriceBreakEven - v.variableCost;
      return contribution > 0 ? v.fixedCosts / contribution : Infinity;
    }
  });
}

const updateBreakEvenTool = () => {
  renderBreakEvenSensitivity();
  const fixedCosts = Math.max(0, getBreakEvenNumber("fixedCosts"));
  const sellingPrice = Math.max(0, getBreakEvenNumber("sellingPriceBreakEven"));
  const variableCost = Math.max(0, getBreakEvenNumber("variableCost"));
  const targetUnits = Math.max(1, getBreakEvenNumber("targetUnits"));
  const chartMaxUnits = Math.max(targetUnits, getBreakEvenNumber("chartMaxUnits"));
  const contribution = sellingPrice - variableCost;
  const breakEvenUnits = contribution > 0 ? Math.ceil(fixedCosts / contribution) : Infinity;
  const breakEvenRevenue = Number.isFinite(breakEvenUnits) ? breakEvenUnits * sellingPrice : 0;
  const targetProfit = contribution * targetUnits - fixedCosts;

  breakEvenSummaryRoot.innerHTML = `
    <div class="result-card">
      <strong>${Number.isFinite(breakEvenUnits) ? breakEvenUnits.toLocaleString() : "N/A"}</strong>
      <span>Break-even units</span>
    </div>
    <div class="result-card">
      <strong>${breakEvenCurrency.format(breakEvenRevenue)}</strong>
      <span>Revenue needed at break-even</span>
    </div>
    <div class="result-card">
      <strong>${breakEvenCurrency.format(targetProfit)}</strong>
      <span>Profit or loss at the target volume</span>
    </div>
  `;

  breakEvenBreakdownRoot.innerHTML = `
    <div class="comparison-item">
      <span>Contribution per unit</span>
      <strong>${breakEvenCurrency.format(contribution)}</strong>
    </div>
    <div class="comparison-item">
      <span>Fixed costs</span>
      <strong>${breakEvenCurrency.format(fixedCosts)}</strong>
    </div>
    <div class="comparison-item">
      <span>Target volume</span>
      <strong>${targetUnits.toLocaleString()} units</strong>
    </div>
  `;

  const labels = Array.from({ length: 12 }, (_, index) => Math.round(((index + 1) * chartMaxUnits) / 12));
  const profits = labels.map((units) => contribution * units - fixedCosts);

  if (breakEvenChart) {
    breakEvenChart.destroy();
  }

  breakEvenChart = new Chart(breakEvenChartContext, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Projected profit",
          data: profits,
          borderColor: OrionColours.get("space-blue"),
          backgroundColor: OrionColours.rgba("space-blue", 0.08),
          borderWidth: 2,
          tension: 0.24
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
              return `${context.dataset.label}: ${breakEvenCurrency.format(context.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        y: {
          ticks: {
            callback(value) {
              return breakEvenCurrency.format(value);
            }
          }
        }
      }
    }
  });

  if (breakEvenCopy) {
    breakEvenCopy.value =
      `Break-even Calculation\n` +
      `Break-even units: ${Number.isFinite(breakEvenUnits) ? breakEvenUnits.toLocaleString() : "N/A"}\n` +
      `Break-even revenue: ${breakEvenCurrency.format(breakEvenRevenue)}\n` +
      `Contribution per unit: ${breakEvenCurrency.format(contribution)}\n` +
      `Profit or loss at target volume: ${breakEvenCurrency.format(targetProfit)}`;
  }

  // Plain-English interpretation (shared panel in main.js).
  const money = (value) => breakEvenCurrency.format(value);
  const contributionRate = sellingPrice > 0 ? contribution / sellingPrice : 0;
  if (contribution <= 0) {
    window.OrionInsight?.show({
      level: "worrying",
      headline: "Each unit sold loses money before fixed costs are even counted, so there is no break-even point.",
      points: [
        `The variable cost (${money(variableCost)}) is at or above the selling price (${money(sellingPrice)}).`,
        "Raise the price, reduce the variable cost, or both, before looking at volume. More sales will only increase the loss."
      ],
      next: { href: "product-cost-estimator.html", label: "Break down the unit cost in the Product Cost Estimator" }
    });
  } else {
    const ratio = breakEvenUnits / targetUnits;
    const level = ratio <= 0.5 ? "good" : ratio <= 1 ? "borderline" : "worrying";
    const headline = ratio <= 0.5
      ? `You break even at ${breakEvenUnits.toLocaleString()} units, about ${Math.round(ratio * 100)}% of your target volume, which leaves a reasonable margin of safety.`
      : ratio <= 1
        ? `You break even at ${breakEvenUnits.toLocaleString()} units, ${Math.round(ratio * 100)}% of your target, so a modest shortfall in sales would mean a loss.`
        : `Your target of ${targetUnits.toLocaleString()} units does not cover fixed costs: you would need ${breakEvenUnits.toLocaleString()} units, ${ratio.toFixed(1)} times the target.`;
    window.OrionInsight?.show({
      level,
      headline,
      points: [
        `Each unit contributes ${money(contribution)} (${Math.round(contributionRate * 100)}% of the price) towards fixed costs.`,
        contributionRate < 0.3
          ? "A contribution below about 30% of price is thin: small rises in cost or discounts move break-even a long way."
          : "Test a lower price and a higher variable cost to see how sensitive break-even is before relying on it.",
        ratio > 0.5 ? "Options: reduce fixed costs (or spread tooling over a longer period), improve contribution per unit, or plan a slower, staged launch." : ""
      ],
      next: { href: "cashflow-projection.html", label: "See how cash holds up on the way to break-even" }
    });
  }
};

breakEvenForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateBreakEvenTool();

  if (window.OrionAnalytics) {
    window.OrionAnalytics.trackEvent("calculate", {
      tool_name: "break_even_calculator",
      fixed_costs: Math.max(0, getBreakEvenNumber("fixedCosts")),
      target_units: Math.max(1, getBreakEvenNumber("targetUnits"))
    });
  }
});
breakEvenForm.querySelectorAll("input, select, textarea").forEach((field) => {
  field.addEventListener("input", updateBreakEvenTool);
  field.addEventListener("change", updateBreakEvenTool);
});
if (window.OrionAnalytics) {
  window.OrionAnalytics.trackEvent("tool_used", {
    tool_name: "break_even_calculator"
  });
}

updateBreakEvenTool();
