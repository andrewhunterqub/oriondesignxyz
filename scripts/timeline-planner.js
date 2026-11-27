const tlForm = document.getElementById("tlForm");
const tlSummaryRoot = document.getElementById("tlSummary");
const tlChartRoot = document.getElementById("tlChart");
const tlTableRoot = document.getElementById("tlTable");
const tlCopy = document.getElementById("tlCopy");
const tlCsvButton = document.getElementById("tlCsv");

// Typical duration ranges in weeks, consistent with the Idea to manufacture explainer.
// Prototyping is planned per round. Launch preparation overlaps the second half of industrialisation.
const tlStages = [
  { key: "discover", name: "Discover", range: [2, 8] },
  { key: "define", name: "Define", range: [2, 6] },
  { key: "concept", name: "Concept", range: [3, 8] },
  { key: "prototype", name: "Prototype", perRound: [4, 10] },
  { key: "verify", name: "Verify and certify", range: [4, 17] },
  { key: "industrialise", name: "Industrialise", range: [9, 22] },
  { key: "launch", name: "Launch preparation", range: [4, 13], overlap: 0.5 }
];
const tlPosition = { simple: 0.1, moderate: 0.4, complex: 0.75, regulated: 1 };

const tlNum = (id) => Math.max(0, Number(document.getElementById(id).value) || 0);
const lerp = ([lo, hi], t) => lo + (hi - lo) * t;

const tlPlan = (position, rounds, overrides) => {
  let cursor = 0;
  let prevStart = 0;
  let prevLength = 0;
  return tlStages
    .filter((stage) => document.getElementById(`tlInclude_${stage.key}`).value === "yes")
    .map((stage) => {
      const auto = stage.perRound ? lerp(stage.perRound, position) * rounds : lerp(stage.range, position);
      const weeks = Math.max(1, Math.round(overrides[stage.key] > 0 ? overrides[stage.key] : auto));
      const start = stage.overlap ? Math.max(prevStart, prevStart + prevLength * stage.overlap) : cursor;
      const end = start + weeks;
      prevStart = start;
      prevLength = weeks;
      cursor = Math.max(cursor, end);
      return { ...stage, weeks, start, end };
    });
};

const monthLabel = (startDate, weeks) => {
  const d = new Date(startDate.getTime() + weeks * 7 * 24 * 3600 * 1000);
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
};

let tlCurrent = [];

const updateTlTool = () => {
  const complexity = document.getElementById("tlComplexity").value;
  const rounds = Math.max(1, Math.round(tlNum("tlRounds")));
  const contingency = tlNum("tlContingency") / 100;
  const startValue = document.getElementById("tlStart").value;
  const startDate = startValue ? new Date(`${startValue}-01T00:00:00`) : new Date();
  const overrides = Object.fromEntries(tlStages.map((s) => [s.key, tlNum(`tlWeeks_${s.key}`)]));

  const plan = tlPlan(tlPosition[complexity] ?? 0.4, rounds, overrides);
  const planLow = tlPlan(0, rounds, overrides);
  const planHigh = tlPlan(1, rounds, overrides);
  const total = plan.length ? Math.max(...plan.map((s) => s.end)) : 0;
  const totalWithContingency = Math.round(total * (1 + contingency));
  const low = planLow.length ? Math.max(...planLow.map((s) => s.end)) : 0;
  const high = planHigh.length ? Math.round(Math.max(...planHigh.map((s) => s.end)) * (1 + contingency)) : 0;
  tlCurrent = plan;

  tlSummaryRoot.innerHTML = `
    <div class="result-card"><strong>${Math.round(totalWithContingency / 4.35)} months</strong><span>Planned duration, with contingency</span></div>
    <div class="result-card"><strong>${Math.round(low / 4.35)}–${Math.round(high / 4.35)} months</strong><span>Range from quick to cautious</span></div>
    <div class="result-card"><strong>${monthLabel(startDate, totalWithContingency)}</strong><span>Planned launch-ready date</span></div>
  `;

  const span = Math.max(totalWithContingency, 1);
  tlChartRoot.innerHTML =
    plan
      .map(
        (s) => `
      <div class="tl-row">
        <span class="tl-name">${s.name}</span>
        <span class="tl-track"><span class="tl-bar tl-${s.key}" style="margin-left:${(s.start / span) * 100}%;width:${(s.weeks / span) * 100}%"></span></span>
      </div>`
      )
      .join("") +
    (contingency > 0
      ? `<div class="tl-row"><span class="tl-name">Contingency</span><span class="tl-track"><span class="tl-bar tl-contingency" style="margin-left:${(total / span) * 100}%;width:${((totalWithContingency - total) / span) * 100}%"></span></span></div>`
      : "");

  tlTableRoot.innerHTML = plan
    .map(
      (s) => `
      <div class="comparison-item">
        <span>${s.name}${s.key === "prototype" ? ` (${rounds} round${rounds > 1 ? "s" : ""})` : ""}</span>
        <strong>${s.weeks} weeks <small>(${monthLabel(startDate, s.start)} to ${monthLabel(startDate, s.end)})</small></strong>
      </div>`
    )
    .join("");

  if (tlCopy) {
    tlCopy.value =
      `Product Development Timeline (${complexity}, ${rounds} prototype round${rounds > 1 ? "s" : ""})\n` +
      plan.map((s) => `${s.name}: ${s.weeks} weeks, ${monthLabel(startDate, s.start)} to ${monthLabel(startDate, s.end)}`).join("\n") +
      `\nContingency: ${Math.round(contingency * 100)}%\n` +
      `Planned duration: about ${Math.round(totalWithContingency / 4.35)} months (range ${Math.round(low / 4.35)}–${Math.round(high / 4.35)} months)\n` +
      `Planned launch-ready date: ${monthLabel(startDate, totalWithContingency)}`;
  }

  const longest = plan.slice().sort((a, b) => b.weeks - a.weeks)[0];
  window.OrionInsight?.show({
    level: "info",
    headline: plan.length
      ? `On these assumptions the product is ready to launch in about ${Math.round(totalWithContingency / 4.35)} months, with ${longest.name.toLowerCase()} the longest stage.`
      : "Include at least one stage to build a timeline.",
    points: plan.length
      ? [
          "Durations are typical ranges, not quotes. The biggest variables are how many prototype rounds you need, certification, and tooling modifications.",
          complexity === "regulated" ? "Regulated products often need more test rounds and formal reviews; take specialist advice on the certification route early." : "Decisions that take weeks to make can add more time than the engineering itself; agree who decides what, and how fast.",
          contingency < 0.15 ? "Hardware timelines almost always slip. Consider at least 15 to 25 per cent contingency." : "Release contingency deliberately as risks close, rather than spending it by default."
        ]
      : [],
    next: { href: "prototype-strategy-tool.html", label: "Plan what each prototype round must prove" }
  });
};

tlCsvButton?.addEventListener("click", () => {
  const startValue = document.getElementById("tlStart").value;
  const startDate = startValue ? new Date(`${startValue}-01T00:00:00`) : new Date();
  const iso = (weeks) => new Date(startDate.getTime() + weeks * 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const rows = [["Stage", "Weeks", "Start", "End"], ...tlCurrent.map((s) => [s.name, s.weeks, iso(s.start), iso(s.end)])];
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  link.download = "product-development-timeline.csv";
  document.body.append(link);
  link.click();
  link.remove();
  if (window.OrionAnalytics) window.OrionAnalytics.trackEvent("timeline_csv_download", { stages: tlCurrent.length });
});

tlForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateTlTool();
  if (window.OrionAnalytics) window.OrionAnalytics.trackEvent("calculate", { tool_name: "timeline_planner" });
});
tlForm.querySelectorAll("input, select").forEach((field) => {
  field.addEventListener("input", updateTlTool);
  field.addEventListener("change", updateTlTool);
});
if (window.OrionAnalytics) window.OrionAnalytics.trackEvent("tool_used", { tool_name: "timeline_planner" });

const tlStartField = document.getElementById("tlStart");
if (tlStartField && !tlStartField.value) {
  const now = new Date();
  tlStartField.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
updateTlTool();
