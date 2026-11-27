const pughForm = document.getElementById("pugh-form");
const pughSummary = document.getElementById("pughSummary");
const pughRecommendation = document.getElementById("pughRecommendation");
const pughCopy = document.getElementById("pughCopy");
const pughChartCanvas = document.getElementById("pughChart");

const pughCriteria = [
  ["Value", "Value"],
  ["Feasibility", "Feasibility"],
  ["Manufacturing", "Manufacturing"],
  ["Sustainability", "Sustainability"],
  ["Commercial", "Commercial"]
];

let pughChart;
let pughLeadName = "Concept A";

const pughReadNumber = (id) => Math.max(1, Number(document.getElementById(id).value) || 1);
const pughReadName = (id, fallback) => document.getElementById(id).value.trim() || fallback;
const pughEscapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderPughChart = (labels, values) => {
  if (pughChart) {
    pughChart.destroy();
  }

  pughChart = new Chart(pughChartCanvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Weighted score",
          data: values,
          backgroundColor: [OrionColours.get("indigo"), OrionColours.get("teal"), OrionColours.get("magenta")],
          borderRadius: 12
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true
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

const updatePughTool = () => {
  const names = [
    pughReadName("conceptAName", "Concept A"),
    pughReadName("conceptBName", "Concept B"),
    pughReadName("conceptCName", "Concept C")
  ];

  const totals = [0, 0, 0];
  const criteriaBreakdown = [];

  pughCriteria.forEach(([key, label]) => {
    const weight = pughReadNumber(`weight${key}`);
    const scores = [
      pughReadNumber(`scoreA${key}`),
      pughReadNumber(`scoreB${key}`),
      pughReadNumber(`scoreC${key}`)
    ];

    scores.forEach((score, index) => {
      totals[index] += score * weight;
    });

    criteriaBreakdown.push(`${label} x${weight}: ${scores.join(" / ")}`);
  });

  const ranked = names
    .map((name, index) => ({ name, score: totals[index] }))
    .sort((left, right) => right.score - left.score);

  const lead = ranked[0];
  const runnerUp = ranked[1];
  const spread = lead.score - runnerUp.score;
  const average = totals.reduce((sum, value) => sum + value, 0) / totals.length;
  const leadDisplayName = pughEscapeHtml(lead.name);
  const runnerUpDisplayName = pughEscapeHtml(runnerUp.name);

  pughLeadName = lead.name;

  pughSummary.innerHTML = `
    <div class="result-card">
      <strong>${leadDisplayName}</strong>
      <span>Highest weighted concept</span>
    </div>
    <div class="result-card">
      <strong>${lead.score}</strong>
      <span>Winning score</span>
    </div>
    <div class="result-card">
      <strong>${spread}</strong>
      <span>Lead over second place</span>
    </div>
  `;

  pughRecommendation.innerHTML = `
    <span class="score-chip ${spread >= 8 ? "score-chip-strong" : "score-chip-caution"}">${spread >= 8 ? "Clear lead" : "Close decision"}</span>
    <h2>${leadDisplayName} is currently the strongest option.</h2>
    <p>
      ${leadDisplayName} leads on weighted score with ${lead.score} points versus ${runnerUp.score} for ${runnerUpDisplayName}.
      ${spread >= 8
        ? "The margin is large enough to progress while focusing on the lowest-scoring criterion as the next de-risking task."
        : "The margin is narrow, so the decision is sensitive to weighting and should be stress-tested before locking the concept."}
    </p>
    <p>Average concept score across the set: ${average.toFixed(1)}.</p>
  `;

  pughCopy.value =
    `Pugh Concept Selector\n` +
    `Concepts: ${names.join(", ")}\n` +
    `${criteriaBreakdown.join("\n")}\n` +
    `Winner: ${lead.name} (${lead.score})\n` +
    `Runner-up: ${runnerUp.name} (${runnerUp.score})\n` +
    `Lead margin: ${spread}`;

  renderPughChart(names, totals);

  // Plain-English interpretation (shared panel in main.js).
  const order = [0, 1, 2].sort((left, right) => totals[right] - totals[left]);
  const [leadIndex, runnerUpIndex] = order;
  const letters = ["A", "B", "C"];
  const criterionRows = pughCriteria.map(([key, label]) => {
    const weight = pughReadNumber(`weight${key}`);
    const leadScore = pughReadNumber(`score${letters[leadIndex]}${key}`);
    const runnerUpScore = pughReadNumber(`score${letters[runnerUpIndex]}${key}`);
    return { key, label, weight, leadScore, gap: (leadScore - runnerUpScore) * weight };
  });
  const maxScore = criterionRows.reduce((sum, row) => sum + row.weight * 5, 0);
  const advantages = criterionRows.filter((row) => row.gap > 0).sort((left, right) => right.gap - left.gap);
  const deficits = criterionRows.filter((row) => row.gap < 0).sort((left, right) => left.gap - right.gap);
  const weakCore = criterionRows.filter((row) => (row.key === "Value" || row.key === "Feasibility") && row.leadScore <= 2);
  const listLabels = (rows) => rows.map((row) => row.label.toLowerCase()).join(" and ");
  const pughPoints = [];
  let pughLevel;
  let pughHeadline;
  if (spread === 0) {
    pughLevel = "borderline";
    pughHeadline = `${lead.name} and ${runnerUp.name} are tied on ${lead.score} points, so the matrix cannot choose between them yet.`;
  } else if (spread >= 8) {
    pughLevel = "good";
    pughHeadline = `${lead.name} has a clear lead: ${lead.score} points against ${runnerUp.score} for ${runnerUp.name}, a gap of ${spread}.`;
  } else {
    pughLevel = "borderline";
    pughHeadline = `This is a close call: ${lead.name} leads ${runnerUp.name} by only ${spread} point${spread === 1 ? "" : "s"} (${lead.score} against ${runnerUp.score}).`;
  }
  if (weakCore.length) {
    pughLevel = "worrying";
    pughPoints.push(`The leader scores only ${weakCore.map((row) => `${row.leadScore} on ${row.label.toLowerCase()}`).join(" and ")}; it may be better to generate stronger concepts than to pick the least weak one.`);
  } else if (maxScore > 0 && lead.score < maxScore * 0.5) {
    pughLevel = "worrying";
    pughPoints.push(`Even the leader reaches less than half of the ${maxScore} points available, so it may be better to generate stronger concepts than to pick the least weak one.`);
  }
  if (advantages.length) {
    const deciding = advantages.slice(0, 2);
    pughPoints.push(
      `${lead.name} pulls ahead on ${listLabels(deciding)}` +
        (deficits.length ? `, while ${runnerUp.name} is stronger on ${listLabels(deficits.slice(0, 2))}.` : ".")
    );
    const swing = advantages.find((row) => row.weight >= spread) || advantages[0];
    pughPoints.push(
      spread === 0
        ? `With the totals level, the weights decide: nudge the ${deciding[0].label.toLowerCase()} weight up or down by one and test whichever criterion is least certain with a quick prototype.`
        : swing.weight >= spread
        ? `A one-point change on ${swing.label.toLowerCase()} (weight ${swing.weight}) would close the gap, so test that score with a quick prototype or supplier conversation before committing.`
        : `Check that the ${deciding[0].label.toLowerCase()} scores hold up with evidence, then treat ${lead.name}'s lowest-scoring criterion as the next de-risking task.`
    );
  } else {
    pughPoints.push("The two concepts score the same on every criterion that matters here, so a quick prototype or a supplier conversation on the most uncertain criterion is the fastest way to separate them.");
  }
  window.OrionInsight?.show({
    level: pughLevel,
    headline: pughHeadline,
    points: pughPoints.slice(0, 3),
    next: { href: "product-design-process-map.html", label: "Plan the next stage in the Product Design Process Map" }
  });
};

pughForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updatePughTool();

  if (window.OrionAnalytics) {
    window.OrionAnalytics.trackEvent("calculate", {
      tool_name: "pugh_concept_selector",
      leading_label: pughLeadName
    });
  }
});
pughForm.querySelectorAll("input, select, textarea").forEach((field) => {
  field.addEventListener("input", updatePughTool);
  field.addEventListener("change", updatePughTool);
});
if (window.OrionAnalytics) {
  window.OrionAnalytics.trackEvent("tool_used", {
    tool_name: "pugh_concept_selector"
  });
}

updatePughTool();
