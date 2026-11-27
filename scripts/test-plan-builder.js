const tpForm = document.getElementById("tpForm");
const tpSummaryRoot = document.getElementById("tpSummary");
const tpTableRoot = document.getElementById("tpTable");
const tpCopy = document.getElementById("tpCopy");

const tpHas = (id) => document.getElementById(id)?.value === "yes";

// [area, what to test, example reference or method, stage, condition]
// References are examples of where requirements commonly come from; confirm the designated
// standards for your own product category.
const tpLibrary = [
  ["Function", "Performance against every measurable requirement", "Your requirements list", "Engineering prototype", () => true],
  ["Users", "Set-up, use and understanding by first-time users", "Observed user sessions", "Engineering prototype", () => true],
  ["Fit and tolerances", "Assembly fit, gaps and alignment across several units", "Drawings; tolerance stack-up", "Design verification", () => true],
  ["Drop and impact", "Survives drops and knocks expected in real use", "Drop height and surface from your use case", "Design verification", () => tpHas("tpPortable")],
  ["Life and durability", "Buttons, hinges, latches and moving parts over their expected cycles", "Cycle count from expected use × safety factor", "Design verification", () => tpHas("tpMoving")],
  ["Temperature and humidity", "Operation and storage across the expected range", "For example the IEC 60068-2 environmental test series", "Design verification", () => tpHas("tpMains") || tpHas("tpBattery") || tpHas("tpOutdoor")],
  ["Water and dust ingress", "Protection against water and dust for the claimed IP rating", "IEC 60529 (IP code)", "Formal testing", () => tpHas("tpOutdoor")],
  ["UV and weathering", "Colour, strength and seals after sunlight and weather exposure", "Accelerated weathering; material supplier data", "Design verification", () => tpHas("tpOutdoor")],
  ["Electrical safety", "Shock, fire and heating hazards", "The designated safety standard for the category, for example IEC 62368-1 for audio, video and IT equipment", "Pre-compliance, then formal testing", () => tpHas("tpMains") || tpHas("tpBattery")],
  ["EMC", "Electromagnetic emissions and immunity", "The EMC standard for the product category", "Pre-compliance, then formal testing", () => tpHas("tpMains") || tpHas("tpBattery") || tpHas("tpRadio")],
  ["Radio", "Radio performance, spectrum use and related safety and EMC", "Standards under the Radio Equipment Regulations; pre-certified module reports", "Pre-compliance, then formal testing", () => tpHas("tpRadio")],
  ["Battery safety", "Cell and pack safety, charging, short circuit and abuse", "For example IEC 62133 for portable lithium batteries", "Formal testing", () => tpHas("tpBattery")],
  ["Battery transport", "Safe air and road transport of lithium batteries", "UN 38.3 test summary from the cell or pack supplier", "Before shipping", () => tpHas("tpBattery")],
  ["Toy safety", "Mechanical, flammability and chemical requirements for toys", "The EN 71 series of toy safety standards", "Formal testing", () => tpHas("tpChildren")],
  ["Small parts and choking", "Parts that could detach and be swallowed", "Toy safety and general product safety requirements", "Design verification", () => tpHas("tpChildren")],
  ["Food contact", "Migration of substances into food", "Supplier declarations of compliance for each material", "Design verification", () => tpHas("tpFood")],
  ["Materials and substances", "Restricted substances in materials and components", "RoHS for electrical products; supplier declarations", "Design verification", () => tpHas("tpMains") || tpHas("tpBattery") || tpHas("tpRadio")],
  ["Cosmetic quality", "Finish, colour and marks against an agreed standard", "Golden sample and cosmetic inspection criteria", "Pilot production", () => true],
  ["Packaging and transit", "Product and packaging survive shipping and handling", "For example ISTA transit test procedures", "Pilot production", () => true],
  ["Production consistency", "Units from the production line match the tested design", "First-article inspection and end-of-line checks", "Pilot production", () => true]
];
const tpStages = ["Engineering prototype", "Design verification", "Pre-compliance, then formal testing", "Formal testing", "Pilot production", "Before shipping"];

const updateTpTool = () => {
  const tests = tpLibrary.filter((t) => t[4]());
  const byStage = tpStages.map((stage) => ({ stage, count: tests.filter((t) => t[3] === stage).length })).filter((s) => s.count);
  const formal = tests.filter((t) => /formal/i.test(t[3])).length;

  tpSummaryRoot.innerHTML = `
    <div class="result-card"><strong>${tests.length}</strong><span>Test areas in the plan</span></div>
    <div class="result-card"><strong>${formal}</strong><span>Needing formal or laboratory testing</span></div>
    <div class="result-card"><strong>${byStage.length}</strong><span>Development stages involved</span></div>
  `;

  tpTableRoot.innerHTML = `
    <div class="tp-scroll">
      <table class="tool-table tp-table">
        <thead><tr><th>Area</th><th>What to test</th><th>Example reference</th><th>When</th></tr></thead>
        <tbody>
          ${tests.map(([area, what, ref, stage]) => `<tr><td><strong>${area}</strong></td><td>${what}</td><td>${ref}</td><td>${stage}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>`;

  if (tpCopy) {
    tpCopy.value = [
      "TEST PLAN",
      "",
      "For each test, record: method, sample quantity, pass criterion, date, result and evidence (report or photos).",
      "",
      ...tpStages
        .filter((stage) => tests.some((t) => t[3] === stage))
        .flatMap((stage) => [
          stage.toUpperCase(),
          ...tests.filter((t) => t[3] === stage).map(([area, what, ref]) => `- ${area}: ${what}. Reference: ${ref}. Pass criterion: [define]. Result: [ ]`),
          ""
        ]),
      "References are examples; confirm the designated standards and regulations that apply to your product."
    ].join("\n");
  }

  window.OrionInsight?.show({
    level: "info",
    appendToCopy: false, // the copy text is the test plan document itself
    headline: `Your plan covers ${tests.length} test areas, ${formal} of which usually need formal or laboratory testing.`,
    points: [
      "Write a pass criterion for every test before you run it, so the result is a decision, not an opinion.",
      formal ? "Book pre-compliance testing on engineering prototypes: fixing failures before tooling is far cheaper than after." : "Even without formal certification, test against your own requirements and keep the evidence.",
      "References are examples of where requirements commonly come from. Confirm the designated standards for your product category with a test laboratory or the official guidance."
    ],
    next: { href: "../guides/product-certification-basics.html", label: "Read product certification basics" }
  });
};

tpForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateTpTool();
  if (window.OrionAnalytics) window.OrionAnalytics.trackEvent("calculate", { tool_name: "test_plan_builder" });
});
tpForm.querySelectorAll("select").forEach((field) => field.addEventListener("change", updateTpTool));
if (window.OrionAnalytics) window.OrionAnalytics.trackEvent("tool_used", { tool_name: "test_plan_builder" });

updateTpTool();
