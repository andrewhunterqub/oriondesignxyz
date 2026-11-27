const productionStrategyForm = document.getElementById("production-strategy-form");
const productionStrategySummary = document.getElementById("productionStrategySummary");
const productionStrategyRecommendation = document.getElementById("productionStrategyRecommendation");
const productionStrategyStages = document.getElementById("productionStrategyStages");
const productionStrategyCopy = document.getElementById("productionStrategyCopy");

const productionRead = (id) => document.getElementById(id).value;
const productionReadNumber = (id) => Number(document.getElementById(id).value);

const buildStageCard = (title, route, reason) => `
  <div class="map-card">
    <span class="score-chip">${title}</span>
    <h3>${route}</h3>
    <p>${reason}</p>
  </div>
`;

const updateProductionStrategyTool = () => {
  const forecastVolume = Math.max(1, productionReadNumber("forecastVolume"));
  const capexBudget = Math.max(0, productionReadNumber("capexBudget"));
  const demandCertainty = productionRead("demandCertainty");
  const productStability = productionRead("productStability");
  const qualityCriticality = productionRead("qualityCriticality");
  const leadTolerance = Math.max(1, productionReadNumber("leadTolerance"));

  const prototypeRoute = productStability === "low" ? "3D printing + rapid CNC" : "Rapid tooling + CNC validation";
  const bridgeRoute =
    forecastVolume >= 8000 || qualityCriticality !== "standard"
      ? "Soft tooling / bridge production cell"
      : "Machined and fabricated low-volume build";
  const scaleRoute =
    forecastVolume >= 20000 && productStability === "high" && capexBudget >= 150000
      ? "Hard tooling / dedicated production line"
      : forecastVolume >= 6000 && capexBudget >= 60000
        ? "Bridge production with selective tooling"
        : "Extended low-volume route until design and demand stabilise";

  const riskScore =
    (demandCertainty === "low" ? 2 : demandCertainty === "medium" ? 1 : 0) +
    (productStability === "low" ? 2 : productStability === "medium" ? 1 : 0) +
    (qualityCriticality === "high" ? 2 : qualityCriticality === "elevated" ? 1 : 0) +
    (leadTolerance <= 8 ? 1 : 0);

  const riskLabel = riskScore >= 5 ? "High transition risk" : riskScore >= 3 ? "Managed risk" : "Commitment window is favourable";
  const readinessLabel = scaleRoute.includes("Hard tooling") ? "Scale commitment justified" : "Hold capex until evidence strengthens";

  productionStrategySummary.innerHTML = `
    <div class="result-card">
      <strong>${forecastVolume.toLocaleString()}</strong>
      <span>Year-one units in the current scenario</span>
    </div>
    <div class="result-card">
      <strong>${riskLabel}</strong>
      <span>Risk profile from stability, certainty, and lead time</span>
    </div>
    <div class="result-card">
      <strong>${readinessLabel}</strong>
      <span>Scale-up posture</span>
    </div>
  `;

  productionStrategyRecommendation.innerHTML = `
    <span class="score-chip ${riskScore >= 5 ? "score-chip-caution" : "score-chip-strong"}">${riskLabel}</span>
    <h2>${scaleRoute}</h2>
    <p>
      The current combination of ${demandCertainty} demand certainty, ${productStability} product stability,
      ${qualityCriticality} quality criticality, and a ${leadTolerance}-week lead-time tolerance points to a staged manufacturing route.
    </p>
    <p>
      Capex assumption: GBP ${capexBudget.toLocaleString()}. Treat the bridge phase as the decision gate for whether full tooling is worth committing.
    </p>
  `;

  productionStrategyStages.innerHTML =
    buildStageCard("Prototype", prototypeRoute, "Optimise learning speed, feature changes, and validation cadence before process lock-in.") +
    buildStageCard("Bridge", bridgeRoute, "Use bridge production to test demand, quality repeatability, and service readiness.") +
    buildStageCard("Scale", scaleRoute, "Only commit to hard tooling when geometry, demand, and process capability justify the spend.");

  productionStrategyCopy.value =
    `Production Strategy Planner\n` +
    `Forecast volume: ${forecastVolume.toLocaleString()} units\n` +
    `Capex budget: GBP ${capexBudget.toLocaleString()}\n` +
    `Demand certainty: ${demandCertainty}\n` +
    `Product stability: ${productStability}\n` +
    `Quality criticality: ${qualityCriticality}\n` +
    `Prototype route: ${prototypeRoute}\n` +
    `Bridge route: ${bridgeRoute}\n` +
    `Scale route: ${scaleRoute}\n` +
    `Risk posture: ${riskLabel}`;

  // Plain-English interpretation (shared panel in main.js).
  if (!Number.isFinite(forecastVolume) || !Number.isFinite(capexBudget) || !Number.isFinite(leadTolerance)) {
    window.OrionInsight?.show({ level: "info", headline: "Fill in volume, budget and lead time to see whether the recommended route is clear or a close call." });
    return;
  }
  const hardTooling = scaleRoute.includes("Hard tooling");
  const gbp = (value) => `${window.OrionCurrency?.symbol() || "£"}${Math.round(value).toLocaleString("en-GB")}`;
  const near = (value, threshold) => value >= threshold * 0.8 && value < threshold * 1.15;
  const blockers = [];
  if (forecastVolume < 20000) blockers.push(`year-one volume reaching about 20,000 units (currently ${forecastVolume.toLocaleString()})`);
  if (productStability !== "high") blockers.push("a frozen, stable design");
  if (capexBudget < 150000) blockers.push(`a tooling budget of about ${gbp(150000)} (currently ${gbp(capexBudget)})`);
  const closeCall = hardTooling
    ? near(forecastVolume, 20000) || near(capexBudget, 150000)
    : blockers.length === 1 || (scaleRoute.startsWith("Bridge") && (near(forecastVolume, 6000) || near(capexBudget, 60000)));
  const riskFactors = [
    { weight: demandCertainty === "low" ? 2 : demandCertainty === "medium" ? 1 : 0, text: "firmer demand evidence, such as pre-orders, retailer commitments or a paid pilot" },
    { weight: productStability === "low" ? 2 : productStability === "medium" ? 1 : 0, text: "a more settled design, proven through testing on production-intent parts" },
    { weight: qualityCriticality === "high" ? 2 : qualityCriticality === "elevated" ? 1 : 0, text: "clear quality requirements and a capable process to meet them" },
    { weight: leadTolerance <= 8 ? 1 : 0, text: "more room in the launch plan for tooling lead time" }
  ].sort((a, b) => b.weight - a.weight);
  const biggestRisk = riskFactors[0];
  const strategyLevel = riskScore >= 5 ? "worrying" : riskScore >= 3 || closeCall ? "borderline" : "good";
  let strategyHeadline;
  if (hardTooling) {
    strategyHeadline = closeCall
      ? `Hard tooling is recommended for ${forecastVolume.toLocaleString()} units, but only just: ${near(forecastVolume, 20000) ? "the volume" : "the budget"} sits close to the point where a bridge route would be the safer choice.`
      : `Hard tooling is a clear recommendation: ${forecastVolume.toLocaleString()} units a year, a stable design and a ${gbp(capexBudget)} budget support the commitment.`;
  } else if (riskScore >= 5) {
    strategyHeadline = `With a risk score of ${riskScore} out of 7, several factors are uncertain at once, so heavy tooling spend now could lock in the wrong design or volume.`;
  } else {
    strategyHeadline = closeCall
      ? `The planner suggests "${scaleRoute.toLowerCase()}", but it is a close call: one change in the evidence could move you to the next stage.`
      : `The planner clearly suggests "${scaleRoute.toLowerCase()}" at ${forecastVolume.toLocaleString()} ${forecastVolume === 1 ? "unit" : "units"}; committing to hard tooling now is not yet justified.`;
  }
  window.OrionInsight?.show({
    level: strategyLevel,
    headline: strategyHeadline,
    points: [
      biggestRisk.weight > 0
        ? `The biggest uncertainty to reduce first is ${biggestRisk.text}.`
        : !hardTooling
          ? "Demand, design and quality look settled, so it is volume and budget, rather than risk, that hold back tooling."
          : "Demand, design and quality look settled; get firm tooling quotes, agree tool ownership and maintenance terms, and confirm the design freeze before cutting steel.",
      !hardTooling && blockers.length
        ? `Hard tooling would become the recommendation with ${blockers.length > 1 ? `${blockers.slice(0, -1).join(", ")} and ${blockers[blockers.length - 1]}` : blockers[0]}.`
        : "",
      "Tooling lead times are often several weeks to a few months, and modifications add more, so build that into the launch date."
    ],
    next: { href: "manufacturing-payoff.html", label: "Check where tooling pays back in the Manufacturing Payoff tool" }
  });
};

productionStrategyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateProductionStrategyTool();

  if (window.OrionAnalytics) {
    window.OrionAnalytics.trackEvent("calculate", {
      tool_name: "production_strategy_planner",
      forecast_volume: Math.max(1, productionReadNumber("forecastVolume")),
      capex_budget: Math.max(0, productionReadNumber("capexBudget"))
    });
  }
});
productionStrategyForm.querySelectorAll("input, select, textarea").forEach((field) => {
  field.addEventListener("input", updateProductionStrategyTool);
  field.addEventListener("change", updateProductionStrategyTool);
});
if (window.OrionAnalytics) {
  window.OrionAnalytics.trackEvent("tool_used", {
    tool_name: "production_strategy_planner"
  });
}

updateProductionStrategyTool();
