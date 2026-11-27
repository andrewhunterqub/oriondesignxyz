const prototypeStrategyForm = document.getElementById("prototypeStrategyForm");
const prototypeSummaryRoot = document.getElementById("prototypeSummary");
const prototypeRankingRoot = document.getElementById("prototypeRanking");
const prototypeChartContext = document.getElementById("prototypeChart");
const prototypeCopy = document.getElementById("prototypeCopy");

let prototypeChart;

const routeScores = (route, inputs) => {
  const quantityFit =
    route === "3D printing" ? Math.max(0, 5 - inputs.quantity / 40) :
    route === "CNC machining" ? Math.max(0, 5 - inputs.quantity / 60) :
    route === "Vacuum casting" ? Math.max(0, 5 - Math.abs(inputs.quantity - 80) / 40) :
    route === "Bridge tooling" ? Math.max(0, 5 - Math.abs(inputs.quantity - 250) / 120) :
    Math.max(0, 5 - Math.abs(inputs.quantity - 600) / 250);

  const urgencyFit =
    route === "3D printing" ? inputs.urgency :
    route === "CNC machining" ? inputs.urgency - 0.5 :
    route === "Vacuum casting" ? inputs.urgency - 1 :
    route === "Bridge tooling" ? inputs.urgency - 1.5 :
    inputs.urgency - 2;

  const cosmeticFit =
    route === "Vacuum casting" ? inputs.cosmetic + 0.8 :
    route === "Bridge tooling" ? inputs.cosmetic + 0.4 :
    route === "Pilot injection" ? inputs.cosmetic + 0.6 :
    inputs.cosmetic - 0.2;

  const functionalFit =
    route === "CNC machining" ? inputs.functional + 0.8 :
    route === "3D printing" ? inputs.functional + 0.2 :
    route === "Bridge tooling" ? inputs.functional + 0.3 :
    inputs.functional;

  const budgetFit =
    route === "3D printing" ? Math.max(0, 5 - inputs.unitBudget / 35) :
    route === "CNC machining" ? Math.max(0, 5 - inputs.unitBudget / 45) :
    route === "Vacuum casting" ? Math.max(0, 5 - Math.abs(inputs.unitBudget - 45) / 15) :
    route === "Bridge tooling" ? Math.max(0, 5 - Math.abs(inputs.unitBudget - 35) / 10) :
    Math.max(0, inputs.unitBudget / 20);

  const commitmentFit =
    route === "Pilot injection" ? inputs.toolingTolerance :
    route === "Bridge tooling" ? inputs.toolingTolerance + 0.4 :
    6 - inputs.toolingTolerance;

  let goalBias = 0;
  if (inputs.goal === "demo" && route === "3D printing") goalBias = 0.8;
  if (inputs.goal === "looks" && route === "Vacuum casting") goalBias = 0.8;
  if (inputs.goal === "functional" && route === "CNC machining") goalBias = 0.8;
  if (inputs.goal === "pilot" && (route === "Bridge tooling" || route === "Pilot injection")) goalBias = 0.8;

  return Math.max(0, quantityFit + urgencyFit + cosmeticFit + functionalFit + budgetFit + commitmentFit + goalBias);
};

const updatePrototypeStrategyTool = () => {
  const inputs = {
    goal: document.getElementById("buildGoal").value,
    quantity: Number(document.getElementById("buildQuantity").value),
    unitBudget: Number(document.getElementById("unitBudget").value),
    cosmetic: Number(document.getElementById("cosmeticFidelity").value),
    functional: Number(document.getElementById("functionalFidelity").value),
    urgency: Number(document.getElementById("urgencyLevel").value),
    toolingTolerance: Number(document.getElementById("toolingTolerance").value)
  };

  const routes = [
    "3D printing",
    "CNC machining",
    "Vacuum casting",
    "Bridge tooling",
    "Pilot injection"
  ].map((route) => ({
    route,
    score: Number(routeScores(route, inputs).toFixed(1))
  })).sort((left, right) => right.score - left.score);

  const winner = routes[0];

  prototypeSummaryRoot.innerHTML = `
    <div class="result-card">
      <strong>${winner.route}</strong>
      <span>Best fit for the current prototype brief</span>
    </div>
    <div class="result-card">
      <strong>${winner.score}</strong>
      <span>Highest route score</span>
    </div>
    <div class="result-card">
      <strong>${inputs.quantity.toLocaleString()}</strong>
      <span>Units being planned for this build</span>
    </div>
  `;

  prototypeRankingRoot.innerHTML = routes.map((entry, index) => `
    <div class="comparison-item">
      <span>${index + 1}. ${entry.route}</span>
      <strong>${entry.score}</strong>
    </div>
  `).join("");

  if (prototypeChart) {
    prototypeChart.destroy();
  }

  prototypeChart = new Chart(prototypeChartContext, {
    type: "bar",
    data: {
      labels: routes.map((entry) => entry.route),
      datasets: [
        {
          label: "Route fit score",
          data: routes.map((entry) => entry.score),
          backgroundColor: [OrionColours.get("space-blue"), OrionColours.get("indigo"), OrionColours.get("teal"), OrionColours.get("magenta"), OrionColours.get("grey-200")],
          borderWidth: 0
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
      }
    }
  });

  if (prototypeCopy) {
    prototypeCopy.value =
      `Prototype Strategy Recommendation\n` +
      `Recommended route: ${winner.route}\n` +
      `Goal: ${inputs.goal}\n` +
      `Quantity: ${inputs.quantity}\n` +
      `Route ranking: ${routes.map((entry) => `${entry.route} ${entry.score}`).join(" | ")}`;
  }

  // Plain-English interpretation (shared panel in main.js).
  const runnerUp = routes[1];
  const tooled = (route) => route === "Bridge tooling" || route === "Pilot injection";
  const functionalRoutes = ["3D printing", "CNC machining"];
  if (!Number.isFinite(winner.score) || !Number.isFinite(runnerUp.score)) {
    window.OrionInsight?.show({
      level: "info",
      headline: "Fill in every field to see which prototype route fits the brief.",
      points: ["Quantity, budget and the 1 to 5 ratings all feed the route scores."]
    });
    return;
  }
  const lc = (route) => (/^(CNC|3D)/.test(route) ? route : route.charAt(0).toLowerCase() + route.slice(1));
  const gap = Number((winner.score - runnerUp.score).toFixed(1));
  const closeRoutes = gap < 1;
  const tooledEarly = tooled(winner.route) && inputs.toolingTolerance <= 2;
  let evidence;
  if (tooled(winner.route) !== tooled(runnerUp.route)) {
    evidence = "The choice is between a tooled and an untooled route, so it turns on how stable the design is and how firm the quantity is; confirm both before committing to a tool.";
  } else if (functionalRoutes.includes(winner.route) && functionalRoutes.includes(runnerUp.route)) {
    evidence = "Between CNC and 3D printing, the deciding evidence is usually tolerance, material behaviour and whether cosmetic finish matters yet; a quote for one critical part from each will settle it.";
  } else if (winner.route === "Vacuum casting" || runnerUp.route === "Vacuum casting") {
    evidence = "Close scores here usually mean the brief mixes appearance and function; splitting into a looks-like and a works-like prototype often resolves it.";
  } else {
    evidence = "Write down the one decision this prototype must unlock, then choose the route that produces that evidence most directly.";
  }
  const prototypeLevel = tooledEarly || closeRoutes ? "borderline" : "info";
  const prototypeHeadline = closeRoutes
    ? `${winner.route} (${winner.score}) and ${lc(runnerUp.route)} (${runnerUp.score}) are a close call, so the brief is not yet pointing firmly one way.`
    : gap >= 2
      ? `${winner.route} is a clear fit for this build, scoring ${winner.score} against ${runnerUp.score} for ${lc(runnerUp.route)}.`
      : `${winner.route} leads with ${winner.score}, ahead of ${lc(runnerUp.route)} on ${runnerUp.score}, a reasonable but not decisive margin.`;
  window.OrionInsight?.show({
    level: prototypeLevel,
    headline: prototypeHeadline,
    points: [
      tooledEarly
        ? `A tooled route is ranking first while your tolerance for tooling commitment is low (${inputs.toolingTolerance} of 5); check the design is stable first, because tool changes are slow and costly.`
        : "",
      closeRoutes || gap < 2
        ? evidence
        : `Get quotes for ${lc(winner.route)} and confirm lead time before planning the build around it.`,
      "The score is a route-fit signal for this build, not the final manufacturing route."
    ],
    next: tooled(winner.route) || tooled(runnerUp.route)
      ? { href: "manufacturing-payoff.html", label: "Check whether tooling pays back in the Manufacturing Payoff tool" }
      : { href: "production-strategy-planner.html", label: "Plan the route from prototype to production" }
  });
};

prototypeStrategyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updatePrototypeStrategyTool();

  if (window.OrionAnalytics) {
    window.OrionAnalytics.trackEvent("calculate", {
      tool_name: "prototype_strategy_tool",
      quantity: Number(document.getElementById("buildQuantity").value),
      goal: document.getElementById("buildGoal").value
    });
  }
});
prototypeStrategyForm.querySelectorAll("input, select, textarea").forEach((field) => {
  field.addEventListener("input", updatePrototypeStrategyTool);
  field.addEventListener("change", updatePrototypeStrategyTool);
});
if (window.OrionAnalytics) {
  window.OrionAnalytics.trackEvent("tool_used", {
    tool_name: "prototype_strategy_tool"
  });
}

updatePrototypeStrategyTool();
