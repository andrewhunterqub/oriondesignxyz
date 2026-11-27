const assemblyForm = document.getElementById("assembly-form");
const assemblySummary = document.getElementById("assemblySummary");
const assemblyCopy = document.getElementById("assemblyCopy");
const assemblyChartCanvas = document.getElementById("assemblyChart");

let assemblyChart;

const assemblyCurrency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: window.OrionCurrency?.code() || "GBP",
  maximumFractionDigits: 2
});

const readAssemblyNumber = (id) => Number(document.getElementById(id).value);

const handlingLookup = {
  simple: 7,
  moderate: 12,
  complex: 18
};

const renderAssemblyChart = (breakdown) => {
  if (assemblyChart) {
    assemblyChart.destroy();
  }

  assemblyChart = new Chart(assemblyChartCanvas, {
    type: "doughnut",
    data: {
      labels: ["Handling", "Joining", "Reorientation", "QA"],
      datasets: [
        {
          data: [breakdown.handling, breakdown.joining, breakdown.reorientation, breakdown.qa],
          backgroundColor: [OrionColours.get("teal"), OrionColours.get("indigo"), OrionColours.get("magenta"), OrionColours.get("space-blue")],
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
              return `${context.label}: ${Math.round(context.parsed)} sec`;
            }
          }
        }
      }
    }
  });
};

// Assembly time and labour cost from raw inputs. This is the tool's only copy of the maths;
// the sensitivity view calls it too, so both always agree.
const assemblyInputIds = ["partCount", "batchSize", "labourRate", "fastenerCount", "fastenerTime", "reorientationCount", "qaSeconds"];
const assemblyValues = () => Object.fromEntries(assemblyInputIds.map((id) => [id, readAssemblyNumber(id)]));

const assemblyFrom = (v, handlingComplexity) => {
  const partCount = Math.max(1, v.partCount);
  const batchSize = Math.max(1, v.batchSize);
  const labourRate = Math.max(1, v.labourRate);
  const fastenerCount = Math.max(0, v.fastenerCount);
  const fastenerTime = Math.max(0, v.fastenerTime);
  const reorientationCount = Math.max(0, v.reorientationCount);
  const qaSeconds = Math.max(0, v.qaSeconds);

  const breakdown = {
    handling: partCount * handlingLookup[handlingComplexity],
    joining: fastenerCount * fastenerTime,
    reorientation: reorientationCount * 6,
    qa: qaSeconds
  };

  const totalSeconds = breakdown.handling + breakdown.joining + breakdown.reorientation + breakdown.qa;
  const timePerUnitMinutes = totalSeconds / 60;
  const costPerUnit = (timePerUnitMinutes / 60) * labourRate;
  const batchLabourCost = costPerUnit * batchSize;
  return {
    partCount, batchSize, labourRate, fastenerCount, fastenerTime, reorientationCount, qaSeconds,
    breakdown, totalSeconds, timePerUnitMinutes, costPerUnit, batchLabourCost
  };
};

function renderAssemblySensitivity(handlingComplexity) {
  window.OrionSensitivity?.render({
    after: assemblySummary,
    title: "Which input matters most for assembly time?",
    better: "lower",
    note: "Shown in seconds per unit; handling complexity is kept as chosen.",
    format: (v) => `${Math.round(v).toLocaleString()} s a unit`,
    inputs: [
      { id: "partCount", label: "Part count" },
      { id: "fastenerCount", label: "Fastener or join count" },
      { id: "fastenerTime", label: "Seconds per join" },
      { id: "reorientationCount", label: "Reorientation count" },
      { id: "qaSeconds", label: "QA or check time" }
    ],
    compute: (values) => assemblyFrom({ ...assemblyValues(), ...values }, handlingComplexity).totalSeconds
  });
}

const updateAssemblyTool = () => {
  const handlingComplexity = document.getElementById("handlingComplexity").value;
  renderAssemblySensitivity(handlingComplexity);
  const {
    partCount, batchSize, fastenerCount, fastenerTime, reorientationCount, qaSeconds,
    breakdown, totalSeconds, timePerUnitMinutes, costPerUnit, batchLabourCost
  } = assemblyFrom(assemblyValues(), handlingComplexity);

  assemblySummary.innerHTML = `
    <div class="result-card">
      <strong>${timePerUnitMinutes.toFixed(1)} min</strong>
      <span>Estimated assembly time per unit</span>
    </div>
    <div class="result-card">
      <strong>${assemblyCurrency.format(costPerUnit)}</strong>
      <span>Estimated labour cost per unit</span>
    </div>
    <div class="result-card">
      <strong>${assemblyCurrency.format(batchLabourCost)}</strong>
      <span>Estimated labour cost for ${batchSize.toLocaleString()} units</span>
    </div>
  `;

  assemblyCopy.value =
    `Assembly Time Estimate\n` +
    `Part count: ${partCount}\n` +
    `Handling complexity: ${handlingComplexity}\n` +
    `Joins: ${fastenerCount} at ${fastenerTime}s each\n` +
    `Reorientation count: ${reorientationCount}\n` +
    `QA time: ${qaSeconds}s\n` +
    `Estimated time per unit: ${timePerUnitMinutes.toFixed(1)} min\n` +
    `Estimated labour cost per unit: ${assemblyCurrency.format(costPerUnit)}\n` +
    `Estimated labour cost for batch: ${assemblyCurrency.format(batchLabourCost)}`;

  renderAssemblyChart(breakdown);

  // Plain-English interpretation (shared panel in main.js).
  const drivers = [
    { key: "handling", label: "part handling", value: breakdown.handling },
    { key: "joining", label: "joining", value: breakdown.joining },
    { key: "reorientation", label: "reorientation", value: breakdown.reorientation },
    { key: "qa", label: "checks and testing", value: breakdown.qa }
  ].sort((a, b) => b.value - a.value);
  const top = drivers[0];
  const topShare = totalSeconds > 0 ? top.value / totalSeconds : 0;
  const minutesText = `${timePerUnitMinutes.toFixed(1)} minutes`;
  const driverAdvice = {
    handling: `Handling ${partCount} ${partCount === 1 ? "part" : "parts"} is the biggest slice, so reducing part count (combining parts that do not move relative to each other or need different materials) is the strongest lever.`,
    joining: `${fastenerCount} joins at ${fastenerTime}s each are the biggest slice; snap fits, self-locating features or fewer, captive fasteners usually cut this fastest.`,
    reorientation: `Turning the assembly ${reorientationCount} times is the biggest slice; arranging the build so parts go in from one direction (ideally top-down) removes most of it.`,
    qa: "Checks and testing are the biggest slice; consider whether features that make errors impossible (keyed or asymmetric parts) could replace some inspection."
  };
  let assemblyLevel;
  let assemblyHeadline;
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    assemblyLevel = "info";
    assemblyHeadline = "With no handling, joining or checking time entered, there is nothing to estimate yet.";
  } else if (timePerUnitMinutes <= 3) {
    assemblyLevel = "good";
    assemblyHeadline = `At about ${minutesText} and ${assemblyCurrency.format(costPerUnit)} per unit, assembly is in the typical range for a simple product and unlikely to be your main cost problem.`;
  } else if (timePerUnitMinutes <= 10) {
    assemblyLevel = "borderline";
    assemblyHeadline = `At about ${minutesText} and ${assemblyCurrency.format(costPerUnit)} per unit, assembly is moderate: typical for a small electromechanical product, but worth simplifying where it is easy.`;
  } else {
    assemblyLevel = "worrying";
    assemblyHeadline = `At about ${minutesText} and ${assemblyCurrency.format(costPerUnit)} per unit, assembly is long enough that labour could become a significant part of your unit cost.`;
  }
  window.OrionInsight?.show({
    level: assemblyLevel,
    headline: assemblyHeadline,
    points: Number.isFinite(totalSeconds) && totalSeconds > 0
      ? [
          `${driverAdvice[top.key]} It accounts for about ${Math.round(topShare * 100)}% of the time.`,
          `Across a batch of ${batchSize.toLocaleString()}, that is ${assemblyCurrency.format(batchLabourCost)} of labour; compare the per-unit figure with your target unit cost to see whether it matters.`,
          "This is a design-stage estimate based on typical handling times, not a timed study; trial-build a few units before relying on it for pricing."
        ]
      : ["Enter your part count, joins and check time to see where assembly time is likely to go."],
    next: { href: "product-cost-estimator.html", label: "Add this labour cost to the Product Cost Estimator" }
  });
};

assemblyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateAssemblyTool();

  if (window.OrionAnalytics) {
    window.OrionAnalytics.trackEvent("calculate", {
      tool_name: "assembly_time",
      part_count: Math.max(1, readAssemblyNumber("partCount")),
      batch_size: Math.max(1, readAssemblyNumber("batchSize"))
    });
  }
});
assemblyForm.querySelectorAll("input, select, textarea").forEach((field) => {
  field.addEventListener("input", updateAssemblyTool);
  field.addEventListener("change", updateAssemblyTool);
});
if (window.OrionAnalytics) {
  window.OrionAnalytics.trackEvent("tool_used", {
    tool_name: "assembly_time"
  });
}

updateAssemblyTool();

// Low / likely / high range on labour cost per unit (shared helper in main.js).
// compute uses assemblyFrom, the same maths as the result cards; handling complexity is kept as chosen.
window.OrionRange?.attach({
  formId: "assembly-form",
  noun: "labour cost per unit",
  format: (value) => assemblyCurrency.format(value),
  drivers: [
    { id: "fastenerTime", label: "Seconds per join" },
    { id: "reorientationCount", label: "Reorientation count" },
    { id: "qaSeconds", label: "QA/check time per unit (seconds)" },
    { id: "labourRate", label: "Labour rate per hour" }
  ],
  compute: (get) => assemblyFrom(
    Object.fromEntries(assemblyInputIds.map((id) => [id, get(id)])),
    document.getElementById("handlingComplexity").value
  ).costPerUnit
});
