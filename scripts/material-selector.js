const matForm = document.getElementById("matForm");
const matSummaryRoot = document.getElementById("matSummary");
const matListRoot = document.getElementById("matList");
const matCopy = document.getElementById("matCopy");

// Orion Design's relative ratings (1 = poor, 5 = excellent; for cost, 5 = cheapest) for typical
// unfilled general-purpose grades. A shortlisting aid, not datasheet values: grades vary widely.
const matCriteria = [
  ["stiffness", "Stiffness"],
  ["toughness", "Impact toughness"],
  ["heat", "Heat resistance"],
  ["chemical", "Chemical resistance"],
  ["uv", "UV and outdoor resistance"],
  ["wear", "Low friction and wear"],
  ["finish", "Surface finish, paint and print"],
  ["cost", "Low material cost"]
];
const matData = [
  { name: "Polypropylene (PP)", r: [2, 4, 3, 5, 2, 3, 2, 5], clear: false, soft: false, note: "Living hinges and chemical resistance; hard to bond and paint." },
  { name: "Polyethylene (HDPE)", r: [1, 5, 2, 5, 2, 3, 1, 5], clear: false, soft: false, note: "Very tough and chemical resistant; low stiffness, hard to print or bond." },
  { name: "ABS", r: [3, 3, 2, 2, 1, 2, 5, 4], clear: false, soft: false, note: "Excellent finish and easy to colour; limited UV and chemical resistance." },
  { name: "PC/ABS", r: [3, 4, 3, 2, 2, 2, 4, 3], clear: false, soft: false, note: "Balanced toughness, heat and finish; common for electronics enclosures." },
  { name: "Polycarbonate (PC)", r: [3, 5, 4, 2, 2, 2, 3, 3], clear: true, soft: false, note: "Very tough, transparent grades; can stress-crack with some chemicals; UV-stabilised grades are available for outdoor use." },
  { name: "PETG", r: [3, 3, 2, 3, 2, 2, 3, 4], clear: true, soft: false, note: "Clear and tough for its cost; lower heat resistance." },
  { name: "Nylon (PA6 / PA66)", r: [3, 4, 4, 4, 2, 4, 2, 3], clear: false, soft: false, note: "Strong and wear resistant; absorbs moisture, which changes size and stiffness." },
  { name: "Acetal (POM)", r: [4, 3, 3, 4, 1, 5, 2, 3], clear: false, soft: false, note: "Low friction and stable for gears and mechanisms; poor UV resistance, hard to bond." },
  { name: "Acrylic (PMMA)", r: [4, 1, 2, 2, 5, 2, 4, 3], clear: true, soft: false, note: "Clear with good scratch and UV resistance; brittle." },
  { name: "TPE / TPU", r: [1, 4, 2, 3, 3, 2, 3, 3], clear: false, soft: true, note: "Rubber-like and soft touch; can be over-moulded onto rigid parts." },
  { name: "High-performance (PPS, PEEK)", r: [5, 3, 5, 5, 3, 4, 2, 1], clear: false, soft: false, note: "For demanding heat and chemical conditions; expensive and harder to process." }
];
const importanceLabel = ["Not needed", "Useful", "Important", "Essential"];

const updateMatTool = () => {
  const weights = matCriteria.map(([key]) => Number(document.getElementById(`mat_${key}`).value) || 0);
  const needClear = document.getElementById("matClear").value === "yes";
  const needSoft = document.getElementById("matSoft").value;

  const results = matData.map((m) => {
    const reasons = [];
    if (needClear && !m.clear) reasons.push("not available as a clear grade");
    if (needSoft === "soft" && !m.soft) reasons.push("not soft or rubber-like");
    if (needSoft === "rigid" && m.soft) reasons.push("not rigid");
    matCriteria.forEach(([, label], i) => {
      if (weights[i] === 3 && m.r[i] < 4) reasons.push(`${label.toLowerCase()} is not a strength`);
    });
    const maxScore = weights.reduce((sum, w) => sum + w * 5, 0) || 1;
    const score = weights.reduce((sum, w, i) => sum + w * m.r[i], 0);
    return { ...m, reasons, pct: Math.round((score / maxScore) * 100) };
  });
  const suitable = results.filter((m) => !m.reasons.length).sort((a, b) => b.pct - a.pct);
  const ruledOut = results.filter((m) => m.reasons.length).sort((a, b) => a.reasons.length - b.reasons.length || b.pct - a.pct);

  matSummaryRoot.innerHTML = `
    <div class="result-card"><strong>${suitable[0] ? suitable[0].name : "None"}</strong><span>Best match on these criteria</span></div>
    <div class="result-card"><strong>${suitable.length}</strong><span>Materials that meet the essentials</span></div>
    <div class="result-card"><strong>${ruledOut.length}</strong><span>Ruled out</span></div>
  `;

  const strengths = (m) =>
    matCriteria
      .map(([, label], i) => ({ label, v: m.r[i], w: weights[i] }))
      .filter((x) => x.w > 0 && x.v >= 4)
      .map((x) => x.label.toLowerCase())
      .slice(0, 3)
      .join(", ");

  matListRoot.innerHTML =
    suitable
      .map(
        (m, i) => `
      <div class="mat-row${i < 3 ? " mat-row-top" : ""}">
        <div class="mat-head"><strong>${i + 1}. ${m.name}</strong><span class="mat-score">${m.pct}% match</span></div>
        <div class="mat-bar"><span style="width:${m.pct}%"></span></div>
        <p>${m.note}${strengths(m) ? ` Strong on: ${strengths(m)}.` : ""}</p>
      </div>`
      )
      .join("") +
    (ruledOut.length
      ? `<p class="mat-out-title">Ruled out by your essentials</p>` +
        ruledOut.map((m) => `<p class="mat-out"><strong>${m.name}</strong>: ${m.reasons.join("; ")}.</p>`).join("")
      : "");

  if (matCopy) {
    matCopy.value =
      `Plastic Material Shortlist (indicative)\n` +
      matCriteria.map(([, label], i) => `${label}: ${importanceLabel[weights[i]]}`).join("\n") +
      `\nClear grade needed: ${needClear ? "yes" : "no"}; feel: ${needSoft}\n` +
      `Shortlist: ${suitable.slice(0, 3).map((m) => `${m.name} (${m.pct}%)`).join(", ") || "none"}\n` +
      `Ruled out: ${ruledOut.map((m) => m.name).join(", ") || "none"}`;
  }

  const essentials = weights.filter((w) => w === 3).length;
  window.OrionInsight?.show({
    level: suitable.length === 0 ? "worrying" : suitable.length <= 2 ? "borderline" : "good",
    headline: suitable.length === 0
      ? "No common plastic meets every essential you set. Relax one essential, or look at specialist grades, fillers or a different material."
      : suitable.length <= 2
        ? `Only ${suitable.length} material${suitable.length > 1 ? "s meet" : " meets"} all your essentials, so check those grades carefully against datasheets.`
        : `${suitable[0].name}, ${suitable[1].name} and ${suitable[2].name} are the strongest starting points for these requirements.`,
    points: [
      "These are relative ratings for typical unfilled grades, to help you shortlist. Specific grades, fillers and additives change the picture considerably.",
      essentials > 2 ? "Many essentials narrow the field quickly; make sure each one is truly essential." : "Ask suppliers for datasheets of specific grades and test prototypes in the real material before tooling.",
      "Check regulatory needs separately, such as flame ratings for electrical enclosures or food-contact suitability."
    ],
    next: { href: "../guides/choosing-plastic-materials.html", label: "Read the guide to choosing plastic materials" }
  });
};

matForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateMatTool();
  if (window.OrionAnalytics) window.OrionAnalytics.trackEvent("calculate", { tool_name: "material_selector" });
});
matForm.querySelectorAll("select").forEach((field) => field.addEventListener("change", updateMatTool));
if (window.OrionAnalytics) window.OrionAnalytics.trackEvent("tool_used", { tool_name: "material_selector" });

updateMatTool();
