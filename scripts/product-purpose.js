const purposeForm = document.getElementById("purpose-form");
const purposeSummary = document.getElementById("purposeSummary");
const purposeComparisons = document.getElementById("purposeComparisons");
const purposeChartCanvas = document.getElementById("purposeChart");
const purposeCopy = document.getElementById("purposeCopy");
const rangeLabels = document.querySelectorAll("[data-range-value]");

let purposeChart;
let productDataset = [];

const axes = [
  { id: "human", label: "Human value", key: "humanity" },
  { id: "planet", label: "Planet impact", key: "planet" },
  { id: "economy", label: "Economic viability", key: "economy" },
  { id: "technical", label: "Technical feasibility", key: "technical" }
];

const totalScore = (entry) => entry.humanity + entry.planet + entry.economy + entry.technical;

const syncRangeLabels = () => {
  rangeLabels.forEach((label) => {
    const input = document.getElementById(label.dataset.rangeValue);
    label.textContent = input.value;
  });
};

const getScores = () =>
  axes.reduce((scores, axis) => {
    scores[axis.key] = Number(document.getElementById(axis.id).value);
    return scores;
  }, {});

const renderRadar = (scores) => {
  if (purposeChart) {
    purposeChart.destroy();
  }

  purposeChart = new Chart(purposeChartCanvas, {
    type: "radar",
    data: {
      labels: axes.map((axis) => axis.label),
      datasets: [
        {
          label: "Your product",
          data: axes.map((axis) => scores[axis.key]),
          backgroundColor: OrionColours.rgba("teal", 0.18),
          borderColor: OrionColours.get("teal"),
          pointBackgroundColor: OrionColours.get("indigo"),
          pointRadius: 3,
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom"
        }
      },
      scales: {
        r: {
          min: 0,
          max: 10,
          ticks: {
            stepSize: 2,
            backdropColor: "transparent"
          },
          grid: {
            color: OrionColours.rgba("space-blue", 0.1)
          },
          angleLines: {
            color: OrionColours.rgba("space-blue", 0.12)
          },
          pointLabels: {
            color: OrionColours.get("space-blue"),
            font: {
              size: 12
            }
          }
        }
      }
    }
  });
};

const renderRanking = (scores) => {
  const yourProduct = {
    product: "Your product",
    ...scores
  };

  const ranked = [...productDataset, yourProduct]
    .map((item) => ({ ...item, score: totalScore(item) }))
    .sort((left, right) => right.score - left.score);

  const rank = ranked.findIndex((item) => item.product === "Your product");
  const justAbove = ranked[rank - 1];
  const justBelow = ranked[rank + 1];
  const percentile = Math.round(((ranked.length - rank) / ranked.length) * 100);

  purposeSummary.innerHTML = `
    <div class="result-card">
      <strong>${totalScore(yourProduct)} / 40</strong>
      <span>Overall concept score</span>
    </div>
    <div class="result-card">
      <strong>#${rank + 1}</strong>
      <span>Ranking against ${ranked.length} benchmark products</span>
    </div>
    <div class="result-card">
      <strong>Top ${percentile}%</strong>
      <span>Relative standing against benchmarks</span>
    </div>
  `;

  const comparisonRows = [];

  if (justAbove) {
    comparisonRows.push(`
        <div class="comparison-item">
          <span>Just above you</span>
          <strong>${justAbove.product} (${justAbove.score})</strong>
      </div>
    `);
  }

  if (justBelow) {
    comparisonRows.push(`
        <div class="comparison-item">
          <span>Just below you</span>
          <strong>${justBelow.product} (${justBelow.score})</strong>
      </div>
    `);
  }

  ranked
    .filter((item) => item.product !== "Your product")
    .slice(0, 3)
    .forEach((item, index) => {
      comparisonRows.push(`
        <div class="comparison-item">
          <span>Benchmark ${index + 1}</span>
          <strong>${item.product} (${item.score})</strong>
        </div>
      `);
    });

  purposeComparisons.innerHTML = comparisonRows.join("");

  if (purposeCopy) {
    purposeCopy.value =
      `Product Purpose Framework Summary\n` +
      `Human value: ${scores.humanity}/10\n` +
      `Planet impact: ${scores.planet}/10\n` +
      `Economic viability: ${scores.economy}/10\n` +
      `Technical feasibility: ${scores.technical}/10\n` +
      `Total score: ${totalScore(yourProduct)}/40\n` +
      `Ranking: #${rank + 1} of ${ranked.length}\n` +
      `Nearest comparisons: ${justAbove ? `${justAbove.product} above` : "No product above"}, ${justBelow ? `${justBelow.product} below` : "no product below"}`;
  }
};

const updatePurposeTool = () => {
  const scores = getScores();
  syncRangeLabels();
  renderRadar(scores);
  renderRanking(scores);

  // Plain-English interpretation (shared panel in main.js).
  const total = totalScore(scores);
  const ordered = axes
    .map((axis) => ({ ...axis, value: scores[axis.key] }))
    .sort((left, right) => left.value - right.value);
  const weakest = ordered[0];
  const strongest = ordered[ordered.length - 1];
  const tiedWeakest = ordered.filter((axis) => axis.value === weakest.value);
  const weakestLabels = tiedWeakest.map((axis) => axis.label.toLowerCase());
  const weakestNames = weakestLabels.length > 1
    ? `${weakestLabels.slice(0, -1).join(", ")} and ${weakestLabels[weakestLabels.length - 1]}`
    : weakestLabels[0];
  const spread = strongest.value - weakest.value;
  const levers = {
    humanity: "Lift human value by pinning down whose problem this solves and checking with real users that they would pay to have it solved.",
    planet: "Lift planet impact through material choice, fewer parts, a longer service life and designing for repair or disassembly.",
    economy: "Lift economic viability by testing the target price against a realistic unit cost and the volume you can credibly sell.",
    technical: "Lift technical feasibility by naming the riskiest technical question and answering it with a quick, focused prototype."
  };
  let level;
  let headline;
  if (weakest.value <= 3) {
    level = "worrying";
    headline = `${total}/40 overall, but ${weakestNames} ${tiedWeakest.length > 1 ? "score" : "scores"} only ${weakest.value}/10, which is a warning sign whatever the total.`;
  } else if (total >= 31 && weakest.value >= 6) {
    level = "good";
    headline = `A balanced profile at ${total}/40, with no axis below ${weakest.value}/10, suggests a concept worth developing further.`;
  } else if (spread === 0) {
    level = "borderline";
    headline = `An even but middling profile at ${total}/40, with every axis at ${weakest.value}/10, so no single strength is carrying the concept yet.`;
  } else {
    level = "borderline";
    headline = spread >= 4
      ? `A lopsided profile at ${total}/40: ${strongest.label.toLowerCase()} (${strongest.value}/10) is carrying a concept that is weaker on ${weakestNames} (${weakest.value}/10).`
      : `A mixed profile at ${total}/40, with ${weakestNames} the weakest at ${weakest.value}/10.`;
  }
  window.OrionInsight?.show({
    level,
    headline,
    points: [
      level === "good"
        ? `${spread === 0 ? "No axis stands out as weakest" : `The weakest ${tiedWeakest.length > 1 ? "axes are" : "axis is"} ${weakestNames}`}; the next job is to test all four scores with real users, suppliers and numbers.`
        : spread === 0 ? "" : levers[weakest.key],
      level !== "good" && spread === 0 ? "Pick the one or two axes that matter most for this product and work out what would realistically lift them." : "",
      level !== "good" && spread > 0 && tiedWeakest.length > 1 ? `${tiedWeakest.length} axes share the lowest score, so decide which one is most realistic to improve first.` : "",
      "Treat the score as a prompt for discussion, not a verdict: ask two or three people to score independently and compare where you disagree."
    ],
    next: { href: "pugh-concept-selector.html", label: "Compare alternative concepts in the Pugh Concept Selector" }
  });
};

rangeLabels.forEach((label) => {
  const input = document.getElementById(label.dataset.rangeValue);
  input.addEventListener("input", syncRangeLabels);
});

purposeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updatePurposeTool();

  if (window.OrionAnalytics) {
    const scores = getScores();
    window.OrionAnalytics.trackEvent("calculate", {
      tool_name: "product_purpose",
      total_score: totalScore(scores)
    });
  }
});
purposeForm.querySelectorAll("input, select, textarea").forEach((field) => {
  field.addEventListener("input", updatePurposeTool);
  field.addEventListener("change", updatePurposeTool);
});
if (window.OrionAnalytics) {
  window.OrionAnalytics.trackEvent("tool_used", {
    tool_name: "product_purpose"
  });
}

fetch("../data/product_index.json")
  .then((response) => response.json())
  .then((data) => {
    productDataset = data;
    updatePurposeTool();
  })
  .catch(() => {
    productDataset = [];
    updatePurposeTool();
  });
