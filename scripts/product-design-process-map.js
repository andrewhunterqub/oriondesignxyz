const processMapForm = document.getElementById("process-map-form");
const processMapSummary = document.getElementById("processMapSummary");
const processMapRecommendation = document.getElementById("processMapRecommendation");
const processMapStages = document.getElementById("processMapStages");
const processMapCopy = document.getElementById("processMapCopy");

const processRead = (id) => document.getElementById(id).value;
const processReadNumber = (id) => Number(document.getElementById(id).value);

const processTemplates = {
  discover: "User need, system context, and problem framing.",
  define: "Requirements, architecture, and concept narrowing.",
  prototype: "Build-test-learn cycles across key assumptions.",
  verify: "Performance, compliance, and reliability evidence.",
  industrialise: "Supply chain, tooling, process capability, and QA.",
  launch: "Service readiness, channel readiness, and rollout control."
};

const stageBaseScores = {
  idea: { discover: 90, define: 80, prototype: 35, verify: 15, industrialise: 5, launch: 5 },
  feasibility: { discover: 55, define: 75, prototype: 85, verify: 45, industrialise: 20, launch: 10 },
  development: { discover: 20, define: 45, prototype: 80, verify: 80, industrialise: 55, launch: 25 },
  industrialisation: { discover: 10, define: 20, prototype: 35, verify: 75, industrialise: 90, launch: 70 }
};

const clampScore = (value) => Math.max(5, Math.min(100, value));

const buildProcessStageCard = (name, score, description) => `
  <div class="map-card">
    <span class="score-chip">${name}</span>
    <p>${description}</p>
    <div class="progress-bar"><span style="width:${score}%"></span></div>
    <p>${score}% emphasis in the current plan.</p>
  </div>
`;

const updateProcessMapTool = () => {
  const projectStage = processRead("projectStage");
  const projectComplexity = processRead("projectComplexity");
  const projectRegulation = processRead("projectRegulation");
  const manufacturingNovelty = processRead("manufacturingNovelty");
  const launchWindow = Math.max(1, processReadNumber("launchWindow"));

  const scores = { ...stageBaseScores[projectStage] };

  if (projectComplexity === "high") {
    scores.define += 10;
    scores.prototype += 10;
    scores.verify += 12;
    scores.industrialise += 8;
  } else if (projectComplexity === "low") {
    scores.discover -= 10;
    scores.define -= 8;
  }

  if (projectRegulation === "high") {
    scores.verify += 18;
    scores.industrialise += 10;
  } else if (projectRegulation === "light") {
    scores.verify += 8;
  }

  if (manufacturingNovelty === "complex") {
    scores.prototype += 14;
    scores.industrialise += 16;
  } else if (manufacturingNovelty === "new") {
    scores.discover += 8;
    scores.prototype += 8;
    scores.industrialise += 8;
  }

  if (launchWindow <= 6) {
    scores.define += 8;
    scores.verify += 8;
    scores.launch += 14;
  } else if (launchWindow >= 12) {
    scores.discover += 8;
    scores.prototype += 8;
  }

  Object.keys(scores).forEach((key) => {
    scores[key] = clampScore(scores[key]);
  });

  const rankedStages = Object.entries(scores).sort((left, right) => right[1] - left[1]);
  const primaryStage = rankedStages[0];
  const secondaryStage = rankedStages[1];

  processMapSummary.innerHTML = `
    <div class="result-card">
      <strong>${primaryStage[0]}</strong>
      <span>Highest emphasis stage</span>
    </div>
    <div class="result-card">
      <strong>${secondaryStage[0]}</strong>
      <span>Second priority stage</span>
    </div>
    <div class="result-card">
      <strong>${launchWindow} months</strong>
      <span>Planned launch window</span>
    </div>
  `;

  processMapRecommendation.innerHTML = `
    <span class="score-chip ${launchWindow <= 6 ? "score-chip-caution" : "score-chip-strong"}">${launchWindow <= 6 ? "Compressed schedule" : "Manageable schedule"}</span>
    <h2>Prioritise ${primaryStage[0]} and ${secondaryStage[0]} next.</h2>
    <p>
      The current mix of ${projectComplexity} complexity, ${projectRegulation} regulation, and ${manufacturingNovelty} manufacturing novelty
      means the process should concentrate next on ${primaryStage[0]} work before trying to force later-stage activity.
    </p>
  `;

  processMapStages.innerHTML = Object.entries(scores)
    .map(([name, score]) => buildProcessStageCard(name, score, processTemplates[name]))
    .join("");

  processMapCopy.value =
    `Product Design Process Map\n` +
    `Current stage: ${projectStage}\n` +
    `Complexity: ${projectComplexity}\n` +
    `Regulation: ${projectRegulation}\n` +
    `Manufacturing novelty: ${manufacturingNovelty}\n` +
    `Launch window: ${launchWindow} months\n` +
    rankedStages.map(([name, score]) => `${name}: ${score}% emphasis`).join("\n");

  // Plain-English interpretation (shared panel in main.js).
  const stageLabels = {
    discover: "discovery",
    define: "definition",
    prototype: "prototyping",
    verify: "verification",
    industrialise: "industrialisation",
    launch: "launch"
  };
  const stageReasons = {
    discover: "the user need and problem framing still have to be pinned down",
    define: "requirements and architecture need to be settled before more is built",
    prototype: "the key assumptions still need build-test-learn cycles",
    verify: "performance, compliance and reliability evidence will take time to gather",
    industrialise: "tooling, suppliers and process capability need early attention",
    launch: "rollout and channel readiness need planning alongside the engineering"
  };
  const drivers = [];
  if (projectComplexity === "high" && ["define", "prototype", "verify", "industrialise"].includes(primaryStage[0])) drivers.push("high complexity");
  if (projectRegulation === "high" && ["verify", "industrialise"].includes(primaryStage[0])) drivers.push("heavy regulation");
  if (manufacturingNovelty === "complex" && ["prototype", "industrialise"].includes(primaryStage[0])) drivers.push("a complex manufacturing route");
  if (manufacturingNovelty === "new" && ["discover", "prototype", "industrialise"].includes(primaryStage[0])) drivers.push("a new manufacturing route");
  if (launchWindow <= 6 && ["define", "verify", "launch"].includes(primaryStage[0])) drivers.push("the short launch window");
  if (launchWindow >= 12 && ["discover", "prototype"].includes(primaryStage[0])) drivers.push("the longer launch window");
  const demanding = projectComplexity === "high" || projectRegulation === "high" || manufacturingNovelty === "complex";
  const earlyStage = projectStage === "idea" || projectStage === "feasibility";
  const highStages = rankedStages.filter(([, score]) => score >= 80);
  const primaryLabel = stageLabels[primaryStage[0]];
  const secondaryLabel = stageLabels[secondaryStage[0]];
  const article = (value) => (/^(8|11|18)$|^8\d$/.test(String(value)) ? "an" : "a");
  const sameEmphasis = primaryStage[1] === secondaryStage[1];
  let mapLevel = "good";
  let mapHeadline = `At ${projectStage} stage, ${sameEmphasis ? `${primaryLabel} and ${secondaryLabel} need equal emphasis now (${primaryStage[1]}%)` : `${primaryLabel} needs the most emphasis now (${primaryStage[1]}%), followed by ${secondaryLabel} (${secondaryStage[1]}%)`}, and ${article(launchWindow)} ${launchWindow}-month launch window looks manageable for this mix.`;
  if (launchWindow <= 6) {
    mapLevel = "borderline";
    mapHeadline = `A ${launchWindow}-month launch window is compressed: most physical products need longer to move from feasibility to production, and ${primaryLabel} (${primaryStage[1]}%) still leads the plan.`;
  } else if (demanding && earlyStage && launchWindow <= 12) {
    mapLevel = "borderline";
    mapHeadline = `${primaryLabel.charAt(0).toUpperCase() + primaryLabel.slice(1)} needs the most emphasis now (${primaryStage[1]}%), but ${article(launchWindow)} ${launchWindow}-month launch window is ambitious for a ${projectRegulation === "high" ? "regulated" : "demanding"} product still at ${projectStage} stage.`;
  }
  window.OrionInsight?.show({
    level: mapLevel,
    headline: mapHeadline,
    points: [
      `${primaryLabel.charAt(0).toUpperCase() + primaryLabel.slice(1)} leads because ${stageReasons[primaryStage[0]]}${drivers.length ? `, reinforced by ${drivers.length > 1 ? `${drivers.slice(0, -1).join(", ")} and ${drivers[drivers.length - 1]}` : drivers[0]}` : ""}.`,
      highStages.length >= 3
        ? `${highStages.length} stages score 80% or more, so expect work to overlap, for example planning compliance testing while prototypes are still being refined.`
        : `Use ${primaryLabel} and ${secondaryLabel} to set what the next three to six months should deliver, and write down the evidence that would show each is complete.`,
      mapLevel === "borderline"
        ? "Either trim the scope or test the date against real supplier lead times and any certification testing before committing to it."
        : "The percentages are relative emphasis, not time or budget, so read them as a ranking rather than a schedule."
    ],
    next: { href: "prototype-strategy-tool.html", label: "Plan which prototypes to build in the Prototype Strategy Tool" }
  });
};

processMapForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateProcessMapTool();

  if (window.OrionAnalytics) {
    window.OrionAnalytics.trackEvent("calculate", {
      tool_name: "product_design_process_map",
      project_stage: processRead("projectStage"),
      launch_window: Math.max(1, processReadNumber("launchWindow"))
    });
  }
});
processMapForm.querySelectorAll("input, select, textarea").forEach((field) => {
  field.addEventListener("input", updateProcessMapTool);
  field.addEventListener("change", updateProcessMapTool);
});
if (window.OrionAnalytics) {
  window.OrionAnalytics.trackEvent("tool_used", {
    tool_name: "product_design_process_map"
  });
}

updateProcessMapTool();
