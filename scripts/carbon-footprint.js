const carbonForm = document.getElementById("carbon-form");
const carbonSummary = document.getElementById("carbonSummary");
const carbonBreakdown = document.getElementById("carbonBreakdown");
const carbonCopy = document.getElementById("carbonCopy");
const carbonChartCanvas = document.getElementById("carbonChart");

const materialFactors = {
  aluminium: 8.6,
  steel: 2.3,
  abs: 3.4,
  pcabs: 4.5,
  recycledAbs: 2.1
};

const processFactors = {
  injection: 1.0,
  cnc: 2.7,
  printing: 3.3,
  sheet: 1.4
};

const transportFactors = {
  sea: 0.000015,
  road: 0.00008,
  air: 0.0006
};

const gridFactor = 0.193;
let carbonChart;

const carbonNumber = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 2
});

const carbonRead = (id) => Number(document.getElementById(id).value);
const carbonLabel = (id) => document.getElementById(id).selectedOptions[0].textContent;

const renderCarbonChart = (values) => {
  if (carbonChart) {
    carbonChart.destroy();
  }

  carbonChart = new Chart(carbonChartCanvas, {
    type: "doughnut",
    data: {
      labels: ["Material", "Manufacturing", "Transport", "Use phase"],
      datasets: [
        {
          data: values,
          backgroundColor: [OrionColours.get("indigo"), OrionColours.get("teal"), OrionColours.get("magenta"), OrionColours.get("space-blue")],
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
              return `${context.label}: ${carbonNumber.format(context.parsed)} kg CO2e`;
            }
          }
        }
      }
    }
  });
};

// Footprint from raw inputs and the chosen material, process and transport mode. This is the
// tool's only copy of the maths; the sensitivity view calls it too, so both always agree.
const carbonInputIds = ["materialMass", "recycledContent", "transportDistance", "annualEnergy", "lifetimeYears"];
const carbonValues = () => Object.fromEntries(carbonInputIds.map((id) => [id, carbonRead(id)]));
const carbonChoices = () => ({
  materialType: document.getElementById("materialType").value,
  processType: document.getElementById("processType").value,
  transportMode: document.getElementById("transportMode").value
});

const carbonFrom = (v, { materialType, processType, transportMode }) => {
  const materialMass = Math.max(0.01, v.materialMass);
  const recycledContent = Math.min(100, Math.max(0, v.recycledContent)) / 100;
  const transportDistance = Math.max(0, v.transportDistance);
  const annualEnergy = Math.max(0, v.annualEnergy);
  const lifetimeYears = Math.max(1, v.lifetimeYears);

  const materialImpact = materialMass * materialFactors[materialType] * (1 - recycledContent * 0.35);
  const processImpact = materialMass * processFactors[processType];
  const transportImpact = materialMass * transportDistance * transportFactors[transportMode];
  const useImpact = annualEnergy * lifetimeYears * gridFactor;
  const total = materialImpact + processImpact + transportImpact + useImpact;
  const embodied = materialImpact + processImpact + transportImpact;
  return {
    materialMass, transportDistance, annualEnergy, lifetimeYears,
    materialImpact, processImpact, transportImpact, useImpact, total, embodied
  };
};

function renderCarbonSensitivity(choices) {
  window.OrionSensitivity?.render({
    after: carbonBreakdown,
    title: "Which input matters most for the total footprint?",
    better: "lower",
    note: "Material, process and transport mode are kept as chosen.",
    format: (v) => `${carbonNumber.format(v)} kg CO2e`,
    inputs: [
      { id: "materialMass", label: "Material mass" },
      { id: "recycledContent", label: "Recycled content" },
      { id: "transportDistance", label: "Transport distance" },
      { id: "annualEnergy", label: "Annual use-phase energy" },
      { id: "lifetimeYears", label: "Expected product lifetime" }
    ],
    compute: (values) => carbonFrom({ ...carbonValues(), ...values }, choices).total
  });
}

const updateCarbonTool = () => {
  const choices = carbonChoices();
  const { processType, transportMode } = choices;
  renderCarbonSensitivity(choices);
  const {
    materialMass, transportDistance, annualEnergy, lifetimeYears,
    materialImpact, processImpact, transportImpact, useImpact, total, embodied
  } = carbonFrom(carbonValues(), choices);

  carbonSummary.innerHTML = `
    <div class="result-card">
      <strong>${carbonNumber.format(total)} kg</strong>
      <span>Estimated total footprint</span>
    </div>
    <div class="result-card">
      <strong>${carbonNumber.format(embodied)} kg</strong>
      <span>Embodied footprint before use phase</span>
    </div>
    <div class="result-card">
      <strong>${carbonNumber.format((useImpact / total) * 100 || 0)}%</strong>
      <span>Use-phase share of total footprint</span>
    </div>
  `;

  carbonBreakdown.innerHTML = `
    <div class="comparison-item">
      <span>Material: ${carbonLabel("materialType")}</span>
      <strong>${carbonNumber.format(materialImpact)} kg CO2e</strong>
    </div>
    <div class="comparison-item">
      <span>Manufacturing: ${carbonLabel("processType")}</span>
      <strong>${carbonNumber.format(processImpact)} kg CO2e</strong>
    </div>
    <div class="comparison-item">
      <span>Transport: ${carbonLabel("transportMode")}</span>
      <strong>${carbonNumber.format(transportImpact)} kg CO2e</strong>
    </div>
    <div class="comparison-item">
      <span>Use phase</span>
      <strong>${carbonNumber.format(useImpact)} kg CO2e</strong>
    </div>
  `;

  carbonCopy.value =
    `Carbon Footprint Estimate\n` +
    `Material: ${carbonLabel("materialType")} (${materialMass} kg)\n` +
    `Process: ${carbonLabel("processType")}\n` +
    `Transport: ${carbonLabel("transportMode")} over ${transportDistance} km\n` +
    `Use phase: ${annualEnergy} kWh/year for ${lifetimeYears} years\n` +
    `Estimated total footprint: ${carbonNumber.format(total)} kg CO2e\n` +
    `Embodied footprint: ${carbonNumber.format(embodied)} kg CO2e`;

  renderCarbonChart([materialImpact, processImpact, transportImpact, useImpact]);

  // Plain-English interpretation (shared panel in main.js).
  const phases = [
    { key: "material", label: "material", value: materialImpact },
    { key: "process", label: "manufacturing", value: processImpact },
    { key: "transport", label: "transport", value: transportImpact },
    { key: "use", label: "the use phase", value: useImpact }
  ].sort((a, b) => b.value - a.value);
  const leading = phases[0];
  const share = (value) => (total > 0 ? Math.round((value / total) * 100) : 0);
  const kg = (value) => `${carbonNumber.format(value)} kg CO2e`;
  const phaseAdvice = {
    material: "Reducing mass, choosing a lower-impact material or raising recycled content will move the total more than anything else.",
    process: processType === "cnc" || processType === "printing"
      ? `Machining or printing parts carries a high impact per kilogram; at volume, moulding or forming the same parts would usually bring this down.`
      : "Manufacturing leads here; check scrap rates and whether parts could be lighter or combined, since process impact scales with mass.",
    transport: transportMode === "air"
      ? "This is mostly air freight, which is many times higher per kilogram than sea; check whether air is genuinely needed beyond urgent first shipments."
      : "Transport is usually a small share, so check the distance and mode entered; if they are right, nearer manufacture or consolidated shipping are the levers.",
    use: "Energy efficiency, standby power and how long the product lasts are where design effort pays back most; material changes will barely move the total."
  };
  const runnerUpPhase = phases[1];
  const closeCall = leading.value > 0 && runnerUpPhase.value / leading.value >= 0.8;
  let carbonLevel = "info";
  if ((leading.key === "transport" && transportMode === "air") || (leading.key === "process" && (processType === "cnc" || processType === "printing"))) {
    carbonLevel = "borderline";
  }
  window.OrionInsight?.show({
    level: carbonLevel,
    headline: total > 0
      ? `${leading.label.charAt(0).toUpperCase()}${leading.label.slice(1)} is the largest share of the estimated ${kg(total)}, at about ${share(leading.value)}%, so that is where design effort will pay off most.`
      : "There is no footprint to interpret yet; enter a mass, process and any energy use to see where the impact sits.",
    points: total > 0
      ? [
          phaseAdvice[leading.key],
          closeCall ? `${runnerUpPhase.label.charAt(0).toUpperCase()}${runnerUpPhase.label.slice(1)} is close behind at about ${share(runnerUpPhase.value)}%, so improvements to either will matter.` : "",
          "Use this to compare design options, not as a declared figure; anything published for customers or retailers needs a formal lifecycle assessment with supplier data."
        ]
      : [],
    next: { href: "product-lifecycle-explorer.html", label: "See how durability and repair affect lifecycle impact" }
  });
};

carbonForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateCarbonTool();

  if (window.OrionAnalytics) {
    window.OrionAnalytics.trackEvent("calculate", {
      tool_name: "carbon_footprint",
      material_type: document.getElementById("materialType").value,
      process_type: document.getElementById("processType").value
    });
  }
});
carbonForm.querySelectorAll("input, select, textarea").forEach((field) => {
  field.addEventListener("input", updateCarbonTool);
  field.addEventListener("change", updateCarbonTool);
});
if (window.OrionAnalytics) {
  window.OrionAnalytics.trackEvent("tool_used", {
    tool_name: "carbon_footprint"
  });
}

updateCarbonTool();
