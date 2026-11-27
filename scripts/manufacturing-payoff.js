const manufacturingForm = document.getElementById("manufacturing-form");
const summaryRoot = document.getElementById("manufacturingSummary");
const crossoverRoot = document.getElementById("crossoverList");
const chartContext = document.getElementById("manufacturingChart");
const manufacturingCopy = document.getElementById("manufacturingCopy");

const methodPalette = {
  printing: OrionColours.get("teal"),
  cnc: OrionColours.get("indigo"),
  vacuum: OrionColours.get("magenta"),
  moulding: OrionColours.get("space-blue")
};

// What the tooled route stands for. The sums are the same either way, so only the words
// change; the route's internal key stays "moulding" so saved states and old links still work.
// No die-casting figures are suggested: switching keeps the numbers the visitor already has.
const tooledRouteSelect = document.getElementById("tooledRoute");
const tooledRouteNote = document.getElementById("tooledRouteNote");
const tooledRoutes = {
  "injection-moulding": {
    label: "Injection moulding",
    toolLabel: "Injection moulding tool cost",
    toolTip: "Full injection mould tooling and qualification.",
    unitLabel: "Injection moulding unit cost",
    unitTip: "Cost per moulded part in £. Only material and labour.",
    paysBack: "the tool pays back",
    bridge: "a bridge route such as vacuum casting usually keeps you safer while the market is proven.",
    commit: "Only commit to tooling once the design is stable and demand is credible; tool changes after the steel is cut are slow and expensive.",
    notYet: "tooling is not justified at this volume yet.",
    quotes: "replace the defaults with real quotes for your part."
  },
  "die-casting": {
    label: "Die casting",
    toolLabel: "Die casting tool cost",
    toolTip: "The quoted die, trim tool, fixtures and first-off approval.",
    unitLabel: "Die casting unit cost",
    unitTip: "Quoted cost per cast part in £, including trimming and any machining or finishing.",
    paysBack: "the die pays back",
    bridge: "staying with CNC machining, or investment casting with its cheaper tooling, usually keeps you safer while the market is proven.",
    commit: "Only commit to a die once the design is stable and demand is credible; die changes after the steel is cut are slow and expensive.",
    notYet: "a die is not justified at this volume yet.",
    quotes: "enter the die caster's quoted die and unit costs, not the example figures."
  }
};
const tooledRoute = () => tooledRoutes[tooledRouteSelect?.value] || tooledRoutes["injection-moulding"];

// Relabel the tooled route's inputs, keeping each label's tooltip element in place.
const setFieldLabel = (id, text, tip) => {
  const label = document.querySelector(`label[for="${id}"]`);
  if (!label) return;
  const textNode = [...label.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
  if (textNode) textNode.textContent = `\n                    ${text}\n                    `;
  const trigger = label.querySelector(".tooltip-trigger");
  if (trigger) trigger.setAttribute("data-tooltip", tip);
};

const applyTooledRoute = () => {
  const route = tooledRoute();
  setFieldLabel("mouldSetup", route.toolLabel, route.toolTip);
  setFieldLabel("mouldUnit", route.unitLabel, route.unitTip);
  // The note only describes the select while it is showing (aria-describedby reads hidden text too).
  const dieCasting = route === tooledRoutes["die-casting"];
  if (tooledRouteNote) tooledRouteNote.hidden = !dieCasting;
  if (dieCasting) tooledRouteSelect?.setAttribute("aria-describedby", "tooledRouteNote");
  else tooledRouteSelect?.removeAttribute("aria-describedby");
};

let manufacturingChart;

const currency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: window.OrionCurrency?.code() || "GBP",
  maximumFractionDigits: 0
});

const getNumber = (id) => Number(document.getElementById(id).value);

const buildMethods = (v) => [
  {
    key: "printing",
    label: "3D printing",
    setup: v.printingSetup,
    unit: v.printingUnit
  },
  {
    key: "cnc",
    label: "CNC machining",
    setup: v.cncSetup,
    unit: v.cncUnit
  },
  {
    key: "vacuum",
    label: "Vacuum casting",
    setup: v.vacuumSetup,
    unit: v.vacuumUnit
  },
  {
    key: "moulding",
    label: tooledRoute().label,
    setup: v.mouldSetup,
    unit: v.mouldUnit
  }
];

const getTotalCost = (method, quantity) => method.setup + method.unit * quantity;

// Route costs from raw inputs. This is the tool's only copy of the maths;
// the sensitivity view calls it too, so both always agree.
const manufacturingInputIds = ["targetQuantity", "maxQuantity", "printingSetup", "printingUnit", "cncSetup", "cncUnit", "vacuumSetup", "vacuumUnit", "mouldSetup", "mouldUnit"];
const manufacturingValues = () => Object.fromEntries(manufacturingInputIds.map((id) => [id, getNumber(id)]));

const manufacturingFrom = (v) => {
  const targetQuantity = Math.max(1, v.targetQuantity);
  const maxQuantity = Math.max(targetQuantity, v.maxQuantity);
  const methods = buildMethods(v);
  const costs = methods
    .map((method) => ({
      ...method,
      total: getTotalCost(method, targetQuantity)
    }))
    .sort((left, right) => left.total - right.total);

  const winner = costs[0];
  const delta = costs[1] ? costs[1].total - costs[0].total : 0;
  return { targetQuantity, maxQuantity, methods, costs, winner, delta };
};

function renderManufacturingSensitivity() {
  const route = tooledRoute();
  window.OrionSensitivity?.render({
    after: crossoverRoot,
    title: "Which input matters most for the cheapest route's cost?",
    better: "lower",
    note: "Shown as the total cost of whichever route is cheapest at the target quantity.",
    format: (v) => currency.format(v),
    inputs: [
      { id: "targetQuantity", label: "Target quantity" },
      { id: "printingSetup", label: "3D printing setup cost" },
      { id: "printingUnit", label: "3D printing unit cost" },
      { id: "cncSetup", label: "CNC setup cost" },
      { id: "cncUnit", label: "CNC unit cost" },
      { id: "vacuumSetup", label: "Vacuum casting setup cost" },
      { id: "vacuumUnit", label: "Vacuum casting unit cost" },
      { id: "mouldSetup", label: route.toolLabel },
      { id: "mouldUnit", label: route.unitLabel }
    ],
    compute: (values) => manufacturingFrom({ ...manufacturingValues(), ...values }).winner.total
  });
}

const buildSummary = ({ methods, targetQuantity, costs, winner, delta }) => {

  summaryRoot.innerHTML = `
    <div class="result-card">
      <strong>${winner.label}</strong>
      <span>Lowest total cost at ${targetQuantity.toLocaleString()} units</span>
    </div>
    <div class="result-card">
      <strong>${currency.format(winner.total)}</strong>
      <span>Estimated total cost for the winning route</span>
    </div>
    <div class="result-card">
      <strong>${currency.format(delta)}</strong>
      <span>Gap to the next-best route</span>
    </div>
  `;

  crossoverRoot.innerHTML = costs
    .map(
      (method, index) => `
        <div class="comparison-item">
          <span>${index + 1}. ${method.label}</span>
          <strong>${currency.format(method.total)}</strong>
        </div>
      `
    )
    .join("");

  if (manufacturingCopy) {
    manufacturingCopy.value =
      `Manufacturing Payoff Summary\n` +
      `Target quantity: ${targetQuantity.toLocaleString()} units\n` +
      `Best route: ${winner.label}\n` +
      `Estimated total cost: ${currency.format(winner.total)}\n` +
      `Gap to next best route: ${currency.format(delta)}\n` +
      `Ranking: ${costs.map((method) => `${method.label} ${currency.format(method.total)}`).join(" | ")}`;
  }

  // Plain-English interpretation (shared panel in main.js).
  const runnerUp = costs[1];
  const gapShare = runnerUp && runnerUp.total > 0 ? delta / runnerUp.total : 1;
  const moulding = methods.find((method) => method.key === "moulding");
  const route = tooledRoute();
  const crossoverWith = (a, b) => (a.unit === b.unit ? Infinity : (b.setup - a.setup) / (a.unit - b.unit));
  const points = [];
  let level = "good";
  let headline;
  if (winner.key === "moulding" && runnerUp) {
    const payback = crossoverWith(winner, runnerUp);
    const margin = Number.isFinite(payback) && payback > 0 ? targetQuantity / payback : Infinity;
    if (margin < 1.5) {
      level = "borderline";
      headline = `${route.label} wins at ${targetQuantity.toLocaleString()} units, but only just: ${route.paysBack} against ${runnerUp.label.toLowerCase()} at about ${Math.round(payback).toLocaleString()} units.`;
      points.push(`If demand is uncertain or the design may still change, ${route.bridge}`);
    } else {
      headline = `${route.label} is clearly the cheapest route at ${targetQuantity.toLocaleString()} units, saving ${currency.format(delta)} over ${runnerUp.label.toLowerCase()}.`;
      points.push(route.commit);
    }
  } else {
    headline = `${winner.label} is the cheapest route at ${targetQuantity.toLocaleString()} units, ${currency.format(delta)} less than the next option.`;
    if (moulding && winner.key !== "moulding") {
      const mouldPoint = crossoverWith(winner, moulding);
      if (Number.isFinite(mouldPoint) && mouldPoint > 0) points.push(`${route.label} would overtake it from about ${Math.round(mouldPoint).toLocaleString()} units, so ${route.notYet}`);
    }
  }
  if (gapShare < 0.1 && runnerUp) {
    level = "borderline";
    points.push(`The top two routes are within ${Math.round(gapShare * 100)}% of each other, so choose on lead time, design stability and cash flow rather than cost alone.`);
  }
  points.push(`These figures are only as good as the setup and unit costs entered; ${route.quotes}`);
  window.OrionInsight?.show({ level, headline, points, next: { href: "product-cost-estimator.html", label: "Build the full unit cost in the Product Cost Estimator" } });
};

const findCrossovers = (methods, maxQuantity) => {
  const pairs = [];

  for (let left = 0; left < methods.length; left += 1) {
    for (let right = left + 1; right < methods.length; right += 1) {
      const first = methods[left];
      const second = methods[right];
      const slopeDelta = first.unit - second.unit;

      if (slopeDelta === 0) {
        continue;
      }

      const quantity = (second.setup - first.setup) / slopeDelta;

      if (quantity > 0 && quantity <= maxQuantity) {
        pairs.push({
          pair: `${first.label} / ${second.label}`,
          quantity: Math.round(quantity)
        });
      }
    }
  }

  if (pairs.length === 0) {
    crossoverRoot.insertAdjacentHTML(
      "beforeend",
      `
        <div class="comparison-item">
          <span>Crossover points</span>
          <strong>None inside chart range</strong>
        </div>
      `
    );
    return;
  }

  pairs
    .sort((left, right) => left.quantity - right.quantity)
    .forEach((item) => {
      crossoverRoot.insertAdjacentHTML(
        "beforeend",
        `
          <div class="comparison-item">
            <span>${item.pair}</span>
            <strong>~${item.quantity.toLocaleString()} units</strong>
          </div>
        `
      );
    });
};

const renderChart = (methods, maxQuantity) => {
  const steps = 12;
  const labels = Array.from({ length: steps }, (_, index) => Math.round(((index + 1) * maxQuantity) / steps));

  const datasets = methods.map((method) => ({
    label: method.label,
    data: labels.map((quantity) => getTotalCost(method, quantity)),
    borderColor: methodPalette[method.key],
    backgroundColor: `${methodPalette[method.key]}22`,
    pointRadius: 0,
    borderWidth: 2,
    tension: 0.22
  }));

  if (manufacturingChart) {
    manufacturingChart.destroy();
  }

  manufacturingChart = new Chart(chartContext, {
    type: "line",
    data: {
      labels,
      datasets
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
              return `${context.dataset.label}: ${currency.format(context.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: "Quantity"
          },
          grid: {
            color: OrionColours.rgba("space-blue", 0.08)
          }
        },
        y: {
          title: {
            display: true,
            text: "Total cost"
          },
          ticks: {
            callback(value) {
              return currency.format(value);
            }
          },
          grid: {
            color: OrionColours.rgba("space-blue", 0.08)
          }
        }
      }
    }
  });
};

const updateManufacturingTool = () => {
  applyTooledRoute();
  renderManufacturingSensitivity();
  const result = manufacturingFrom(manufacturingValues());
  const { methods, maxQuantity } = result;

  buildSummary(result);
  findCrossovers(methods, maxQuantity);
  renderChart(methods, maxQuantity);
};

manufacturingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateManufacturingTool();

  if (window.OrionAnalytics) {
    window.OrionAnalytics.trackEvent("calculate", {
      tool_name: "manufacturing_payoff",
      target_quantity: Math.max(1, getNumber("targetQuantity")),
      max_quantity: Math.max(getNumber("targetQuantity"), getNumber("maxQuantity")),
      tooled_route: tooledRouteSelect?.value || "injection-moulding"
    });
  }
});
manufacturingForm.querySelectorAll("input, select, textarea").forEach((field) => {
  field.addEventListener("input", updateManufacturingTool);
  field.addEventListener("change", updateManufacturingTool);
});
if (window.OrionAnalytics) {
  window.OrionAnalytics.trackEvent("tool_used", {
    tool_name: "manufacturing_payoff"
  });
}

updateManufacturingTool();
