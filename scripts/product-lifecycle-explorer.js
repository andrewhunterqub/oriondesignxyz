const lifecycleForm = document.getElementById("lifecycle-form");
const lifecycleSummary = document.getElementById("lifecycleSummary");
const lifecycleBreakdown = document.getElementById("lifecycleBreakdown");
const lifecycleCopy = document.getElementById("lifecycleCopy");
const lifecycleChartCanvas = document.getElementById("lifecycleChart");

let lifecycleChart;

const lifecycleRead = (id) => Number(document.getElementById(id).value);

const lifecycleNumber = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1
});

const renderLifecycleChart = (values) => {
  if (lifecycleChart) {
    lifecycleChart.destroy();
  }

  lifecycleChart = new Chart(lifecycleChartCanvas, {
    type: "radar",
    data: {
      labels: ["Longevity", "Repair", "Upgrade", "Materials", "Recovery"],
      datasets: [
        {
          data: values,
          backgroundColor: OrionColours.rgba("indigo", 0.14),
          borderColor: OrionColours.get("indigo"),
          pointBackgroundColor: OrionColours.get("teal"),
          pointBorderColor: OrionColours.get("teal")
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          suggestedMin: 0,
          suggestedMax: 100,
          ticks: {
            display: false
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
};

const updateLifecycleTool = () => {
  const lifecycleYears = Math.max(1, lifecycleRead("lifecycleYears"));
  const repairability = Math.max(1, lifecycleRead("repairability"));
  const upgradeability = Math.max(1, lifecycleRead("upgradeability"));
  const recycledMaterial = Math.max(0, lifecycleRead("recycledMaterial"));
  const annualLifecycleEnergy = Math.max(0, lifecycleRead("annualLifecycleEnergy"));
  const takeBackScheme = document.getElementById("takeBackScheme").value;
  const recoveryRate = Math.max(0, lifecycleRead("recoveryRate"));

  const longevityScore = Math.min(100, lifecycleYears * 10 + repairability * 6 + upgradeability * 4);
  const repairScore = repairability * 20;
  const upgradeScore = upgradeability * 20;
  const materialScore = Math.min(100, recycledMaterial * 0.9 + (takeBackScheme === "yes" ? 10 : 0));
  const recoveryScore = Math.min(100, recoveryRate * 0.8 + (takeBackScheme === "yes" ? 15 : 0));
  const circularityScore =
    longevityScore * 0.3 +
    repairScore * 0.2 +
    upgradeScore * 0.15 +
    materialScore * 0.15 +
    recoveryScore * 0.2;
  const usePhaseImpact = annualLifecycleEnergy * lifecycleYears * 0.193;

  let dominantDriver = "durability and repair";

  if (usePhaseImpact >= 18) {
    dominantDriver = "use-phase energy";
  } else if (lifecycleYears <= 3 || repairability <= 2) {
    dominantDriver = "short product life";
  } else if (recycledMaterial <= 15 && recoveryRate <= 40) {
    dominantDriver = "embodied materials";
  }

  lifecycleSummary.innerHTML = `
    <div class="result-card">
      <strong>${lifecycleNumber.format(circularityScore)}</strong>
      <span>Circularity score out of 100</span>
    </div>
    <div class="result-card">
      <strong>${dominantDriver}</strong>
      <span>Dominant lifecycle driver</span>
    </div>
    <div class="result-card">
      <strong>${lifecycleNumber.format(usePhaseImpact)} kg</strong>
      <span>Use-phase carbon signal over life</span>
    </div>
  `;

  lifecycleBreakdown.innerHTML = `
    <div class="comparison-item">
      <span>Longevity leverage</span>
      <strong>${lifecycleNumber.format(longevityScore)}</strong>
    </div>
    <div class="comparison-item">
      <span>Repair and upgrade leverage</span>
      <strong>${lifecycleNumber.format((repairScore + upgradeScore) / 2)}</strong>
    </div>
    <div class="comparison-item">
      <span>Material circularity leverage</span>
      <strong>${lifecycleNumber.format((materialScore + recoveryScore) / 2)}</strong>
    </div>
    <div class="comparison-item">
      <span>Take-back strategy</span>
      <strong>${takeBackScheme === "yes" ? "Enabled" : "Not enabled"}</strong>
    </div>
  `;

  lifecycleCopy.value =
    `Product Lifecycle Explorer\n` +
    `Expected lifetime: ${lifecycleYears} years\n` +
    `Repairability: ${repairability}/5\n` +
    `Upgradeability: ${upgradeability}/5\n` +
    `Recycled material: ${recycledMaterial}%\n` +
    `Use-phase energy: ${annualLifecycleEnergy} kWh/year\n` +
    `Take-back scheme: ${takeBackScheme}\n` +
    `Recovery potential: ${recoveryRate}%\n` +
    `Circularity score: ${lifecycleNumber.format(circularityScore)}\n` +
    `Dominant lifecycle driver: ${dominantDriver}`;

  renderLifecycleChart([longevityScore, repairScore, upgradeScore, materialScore, recoveryScore]);

  // Plain-English interpretation (shared panel in main.js).
  const dimensions = [
    { key: "longevity", label: "longevity", value: longevityScore },
    { key: "repair", label: "repair", value: repairScore },
    { key: "upgrade", label: "upgrade", value: upgradeScore },
    { key: "materials", label: "material content", value: materialScore },
    { key: "recovery", label: "end-of-life recovery", value: recoveryScore }
  ].sort((a, b) => a.value - b.value);
  const weakest = dimensions[0];
  const scoreText = lifecycleNumber.format(circularityScore);
  const leverAdvice = {
    longevity: "Longevity is the weakest area: specifying for a longer service life (wear parts, hinges, batteries, seals) usually does more than any material change.",
    repair: "Repair is the weakest area: screws instead of glue, standard fasteners and a replaceable battery or wear part are usually the cheapest improvements.",
    upgrade: "Upgrade is the weakest area: a modular layout, such as a swappable electronics module or accessory interface, lets the product keep up without being replaced.",
    materials: "Material content is the weakest area: raising recycled content in housings and packaging is often straightforward where appearance and strength allow.",
    recovery: "Recovery is the weakest area: using fewer material types, avoiding mixed-material bonds and marking plastics makes the product easier to take apart and recycle."
  };
  let lifecycleLevel;
  let lifecycleHeadline;
  if (!Number.isFinite(circularityScore)) {
    window.OrionInsight?.show({ level: "info", headline: "Fill in every field to see what the circularity score means for this product." });
    return;
  }
  if (circularityScore < 40 || dominantDriver === "short product life") {
    lifecycleLevel = "worrying";
    lifecycleHeadline = dominantDriver === "short product life"
      ? `A circularity score of ${scoreText} with short product life as the dominant driver suggests this product is likely to be replaced rather than repaired.`
      : `A circularity score of ${scoreText} is low on this tool's scale, so the product is likely to be replaced rather than repaired or recovered.`;
  } else if (circularityScore > 70 && weakest.value >= 40) {
    lifecycleLevel = "good";
    lifecycleHeadline = `A circularity score of ${scoreText} with no very weak area suggests a product designed to last and to be recovered.`;
  } else {
    lifecycleLevel = "borderline";
    lifecycleHeadline = circularityScore > 70
      ? `A circularity score of ${scoreText} is strong overall, but ${weakest.label} is a clear weak point at ${lifecycleNumber.format(weakest.value)}.`
      : `A circularity score of ${scoreText} is typical of a conventional product, with ${weakest.label} the weakest area at ${lifecycleNumber.format(weakest.value)}.`;
  }
  window.OrionInsight?.show({
    level: lifecycleLevel,
    headline: lifecycleHeadline,
    points: [
      dominantDriver === "use-phase energy"
        ? `Use-phase energy dominates (about ${lifecycleNumber.format(usePhaseImpact)} kg CO2e over life), so efficiency and standby power will matter far more than recycled content.`
        : leverAdvice[weakest.key],
      lifecycleLevel === "good"
        ? "Check that the lifetime and repair claims can be backed up in testing and by spare parts and service planning."
        : "Change one input at a time to see which lever moves the score most before committing design effort.",
      "The score is a relative guide on this tool's own scale, not a certified rating."
    ],
    next: { href: "carbon-footprint.html", label: "Estimate where the carbon sits in the Carbon Footprint Estimator" }
  });
};

lifecycleForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateLifecycleTool();

  if (window.OrionAnalytics) {
    window.OrionAnalytics.trackEvent("calculate", {
      tool_name: "product_lifecycle_explorer",
      expected_lifetime: Math.max(1, lifecycleRead("lifecycleYears")),
      take_back_scheme: document.getElementById("takeBackScheme").value
    });
  }
});
lifecycleForm.querySelectorAll("input, select, textarea").forEach((field) => {
  field.addEventListener("input", updateLifecycleTool);
  field.addEventListener("change", updateLifecycleTool);
});
if (window.OrionAnalytics) {
  window.OrionAnalytics.trackEvent("tool_used", {
    tool_name: "product_lifecycle_explorer"
  });
}

updateLifecycleTool();
