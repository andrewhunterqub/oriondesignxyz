// Shared engine for the readiness self-checks. Each page sets data-readiness="manufacturer" or "tooling"
// on its form; questions are answered Yes (2), Partly (1) or No (0) and weighted by importance.
const readyForm = document.querySelector("[data-readiness]");
const readySummaryRoot = document.getElementById("readySummary");
const readyGapsRoot = document.getElementById("readyGaps");
const readyCopy = document.getElementById("readyCopy");

const readinessSets = {
  manufacturer: {
    title: "Ready to talk to a manufacturer?",
    questions: [
      ["q1", "Do you have 3D CAD of the parts in a standard format such as STEP?", 3, "../guides/must-have-documents-before-talking-to-a-manufacturer.html", "Prepare 3D CAD"],
      ["q2", "Do you have drawings showing materials, finishes and critical tolerances?", 3, "../guides/must-have-documents-before-talking-to-a-manufacturer.html", "Prepare 2D drawings"],
      ["q3", "Is there a bill of materials listing every part and quantity?", 2, "bom-builder.html", "Build the bill of materials"],
      ["q4", "Do you know realistic quantities for the first order and per year?", 3, "../guides/how-to-validate-a-product-idea.html", "Firm up volume estimates"],
      ["q5", "Do you have a target unit cost worked back from your price and route to market?", 2, "route-to-market-simulator.html", "Set a target cost"],
      ["q6", "Has the design been tested in a prototype that works as intended?", 2, "prototype-strategy-tool.html", "Plan the next prototype round"],
      ["q7", "Have you checked the design against the process's design-for-manufacture rules?", 2, "dfm-checker.html", "Run a DFM check"],
      ["q8", "Do you know which regulations and markings apply to the product?", 2, "../guides/product-certification-basics.html", "Identify compliance needs"],
      ["q9", "Is a confidentiality agreement ready to sign before you share files?", 2, "nda-generator.html", "Draft an NDA"],
      ["q10", "Have you decided what you will ask suppliers to quote, and on what delivery terms?", 1, "rfq-pack-builder.html", "Build the RFQ pack"]
    ],
    good: "You are ready to approach manufacturers: they will be able to quote properly and take you seriously.",
    mid: "You can start conversations, but fill the main gaps first or expect rough quotes and repeated questions.",
    low: "It is too early for useful quotes. Work through the gaps first; a supplier conversation now is likely to waste time on both sides.",
    next: { href: "rfq-pack-builder.html", label: "Build your RFQ pack" }
  },
  tooling: {
    title: "Ready to commit to tooling?",
    questions: [
      ["q1", "Have production-intent parts passed testing against your requirements?", 3, "../guides/development-and-prototyping.html", "Complete design verification"],
      ["q2", "Is the design frozen, with changes now going through change control?", 3, "../guides/development-and-prototyping.html", "Freeze the design"],
      ["q3", "Have you done pre-compliance or formal compliance testing where required?", 2, "../guides/product-certification-basics.html", "Plan compliance testing"],
      ["q4", "Has a moulder or toolmaker reviewed the parts for manufacturability?", 2, "dfm-checker.html", "Get a DFM review"],
      ["q5", "Is there evidence of demand beyond the break-even volume for the tooling?", 3, "manufacturing-payoff.html", "Check when tooling pays off"],
      ["q6", "Have you compared bridge tooling or low-volume routes with production tooling?", 2, "production-strategy-planner.html", "Compare production routes"],
      ["q7", "Is the material and grade chosen and tested?", 2, "material-selector.html", "Choose and test the material"],
      ["q8", "Are tool ownership, life, modifications and samples agreed in writing?", 2, "../guides/injection-moulding-explained.html", "Agree tooling terms"],
      ["q9", "Can you fund the tooling and the first stock order together?", 3, "cashflow-projection.html", "Check the cash"],
      ["q10", "Is there time and budget for at least one round of tool modifications?", 1, "timeline-planner.html", "Plan for modifications"]
    ],
    good: "The main tooling risks look covered. Commit with clear terms, and keep a contingency for modifications.",
    mid: "Tooling now carries avoidable risk. Close the biggest gaps first, or consider a cheaper bridge tool to buy time.",
    low: "Committing to production tooling now is likely to be expensive to reverse. Keep to low-volume or bridge routes until the gaps close.",
    next: { href: "production-strategy-planner.html", label: "Compare tooling now, bridge first or stay low-volume" }
  },
  certification: {
    title: "Certification readiness",
    questions: [
      ["q1", "Have you listed the product regulations that apply (for example electrical safety, EMC, radio, toys)?", 3, "../guides/product-certification-basics.html", "Identify the applicable regulations"],
      ["q2", "Have you identified the designated or harmonised standards you will test against?", 3, "../guides/product-certification-basics.html", "List the standards"],
      ["q3", "Do you know whether you can self-assess or need a conformity assessment body?", 2, "../guides/product-certification-basics.html", "Confirm the conformity route"],
      ["q4", "Have you done pre-compliance testing on engineering prototypes?", 2, "../guides/development-and-prototyping.html", "Book pre-compliance testing"],
      ["q5", "Is formal testing planned with a laboratory, with time for a re-test?", 2, "timeline-planner.html", "Plan formal testing and re-tests"],
      ["q6", "Is there a documented risk assessment for the product?", 2, "../guides/ip-partners-and-compliance.html", "Write the risk assessment"],
      ["q7", "Is the technical documentation being compiled as you go (drawings, test reports, standards list)?", 2, "../guides/product-certification-basics.html", "Start the technical file"],
      ["q8", "Are labels, markings, addresses and English instructions designed?", 1, "../guides/product-certification-basics.html", "Design labels and instructions"],
      ["q9", "Is there a way to keep production consistent with the tested design (change control, traceability)?", 2, "../guides/development-and-prototyping.html", "Set up change control and traceability"],
      ["q10", "Have you covered producer responsibilities (waste electricals, batteries, packaging) where they apply?", 1, "../guides/sustainability-and-product-life.html", "Check producer responsibilities"]
    ],
    good: "Certification looks well planned. Keep the technical file up to date as the design and suppliers change.",
    mid: "Certification is partly planned. Close the gaps before tooling, when changes are still cheap.",
    low: "Certification has not been planned yet. Identify the rules and standards now: they can change the design.",
    next: { href: "../guides/product-certification-basics.html", label: "Read product certification basics" }
  }
};

const readyLabels = ["No", "Partly", "Yes"];

const updateReadyTool = () => {
  const set = readinessSets[readyForm.dataset.readiness];
  const answers = set.questions.map(([id, text, weight, href, action]) => ({
    id, text, weight, href, action, value: Number(document.getElementById(id).value) || 0
  }));
  const max = answers.reduce((s, a) => s + a.weight * 2, 0);
  const score = answers.reduce((s, a) => s + a.weight * a.value, 0);
  const pct = Math.round((score / max) * 100);
  const gaps = answers.filter((a) => a.value < 2).sort((a, b) => b.weight * (2 - b.value) - a.weight * (2 - a.value));
  const critical = gaps.filter((a) => a.weight === 3 && a.value === 0);

  readySummaryRoot.innerHTML = `
    <div class="result-card"><strong>${pct}%</strong><span>Readiness score</span></div>
    <div class="result-card"><strong>${answers.length - gaps.length} of ${answers.length}</strong><span>Fully in place</span></div>
    <div class="result-card"><strong>${critical.length}</strong><span>Critical gaps</span></div>
  `;

  readyGapsRoot.innerHTML = gaps.length
    ? `<p class="mat-out-title">Close these gaps, most important first</p>` +
      gaps.map((a) => `<p class="mat-out"><strong>${a.action}</strong>${a.value === 1 ? " (partly done)" : ""}: <a class="text-link-inline" href="${a.href}">how</a></p>`).join("")
    : `<p class="mat-out-title">Everything on the checklist is in place.</p>`;

  if (readyCopy) {
    readyCopy.value =
      `${set.title} Readiness ${pct}%\n` +
      answers.map((a) => `- ${a.text} ${readyLabels[a.value]}`).join("\n") +
      (gaps.length ? `\nGaps to close: ${gaps.map((a) => a.action).join("; ")}` : "\nNo gaps.");
  }

  const level = critical.length === 0 && pct >= 80 ? "good" : pct >= 55 && critical.length <= 1 ? "borderline" : "worrying";
  window.OrionInsight?.show({
    level,
    headline: level === "good" ? set.good : level === "borderline" ? set.mid : set.low,
    points: [
      critical.length ? `Critical gap${critical.length > 1 ? "s" : ""}: ${critical.map((a) => a.action.toLowerCase()).join("; ")}.` : gaps[0] ? `Start with: ${gaps[0].action.toLowerCase()}.` : "",
      "Answer honestly: this is for your own planning, and nothing is sent anywhere.",
      "Save the result to your product plan and repeat the check as gaps close."
    ],
    next: set.next
  });
};

readyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateReadyTool();
  if (window.OrionAnalytics) window.OrionAnalytics.trackEvent("calculate", { tool_name: `readiness_${readyForm.dataset.readiness}` });
});
readyForm.querySelectorAll("select").forEach((field) => field.addEventListener("change", updateReadyTool));
if (window.OrionAnalytics) window.OrionAnalytics.trackEvent("tool_used", { tool_name: `readiness_${readyForm.dataset.readiness}` });

updateReadyTool();
