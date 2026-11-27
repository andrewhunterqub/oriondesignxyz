const rfqForm = document.getElementById("rfqForm");
const rfqSummaryRoot = document.getElementById("rfqSummary");
const rfqGapsRoot = document.getElementById("rfqGaps");
const rfqCopy = document.getElementById("rfqCopy");

const rfqText = (id) => (document.getElementById(id)?.value || "").trim();
const rfqNum = (id) => Math.max(0, Number(document.getElementById(id)?.value) || 0);
const rfqYes = (id) => document.getElementById(id)?.value === "yes";

// Pack items: [id, label, weight, why it matters, where to learn more]
const rfqItems = [
  ["rfqCad", "3D CAD files (STEP)", 3, "Suppliers price from geometry; without CAD, quotes are guesses.", "../guides/must-have-documents-before-talking-to-a-manufacturer.html"],
  ["rfqDrawings", "2D drawings with materials, finishes and critical tolerances", 3, "Drawings state what the CAD cannot: tolerances, finishes, inspection points.", "../guides/must-have-documents-before-talking-to-a-manufacturer.html"],
  ["rfqBom", "Bill of materials", 2, "Shows every part and quantity, and which parts the supplier must source.", "bom-builder.html"],
  ["rfqSpec", "Product specification or requirements", 2, "Explains what the product must do, so suppliers can suggest better routes.", "../guides/opportunity-and-concept.html"],
  ["rfqQuality", "Quality and inspection requirements", 2, "Sets acceptance criteria and cosmetic standards before arguments start.", "../guides/how-to-find-and-brief-a-manufacturer.html"],
  ["rfqCompliance", "Compliance and marking requirements", 1, "Test reports, material declarations and markings affect cost and lead time.", "../guides/product-certification-basics.html"],
  ["rfqPackaging", "Packaging and labelling requirements", 1, "Packaging can be a large share of cost and must survive shipping.", "../guides/landed-cost-freight-duty-vat.html"],
  ["rfqSamples", "Samples or prototypes available", 1, "A physical sample answers questions faster than any drawing.", "../guides/development-and-prototyping.html"],
  ["rfqNda", "Confidentiality agreement in place", 2, "Protects your design before you share it.", "nda-generator.html"]
];

const updateRfqTool = () => {
  const company = rfqText("rfqCompany") || "[Your company]";
  const product = rfqText("rfqProduct") || "[Product name]";
  const contact = rfqText("rfqContact") || "[Your name and email]";
  const process = document.getElementById("rfqProcess").value;
  const firstQty = rfqNum("rfqFirstQty");
  const annualQty = rfqNum("rfqAnnualQty");
  const target = rfqNum("rfqTarget");
  const incoterm = document.getElementById("rfqIncoterm").value;
  const deadline = rfqText("rfqDeadline");
  const samplesWeeks = rfqNum("rfqSampleWeeks");

  const have = rfqItems.filter(([id]) => rfqYes(id));
  const missing = rfqItems.filter(([id]) => !rfqYes(id));
  const maxWeight = rfqItems.reduce((s, it) => s + it[2], 0) + 2;
  let score = have.reduce((s, it) => s + it[2], 0);
  if (firstQty > 0 && annualQty > 0) score += 2;
  const pct = Math.round((score / maxWeight) * 100);

  rfqSummaryRoot.innerHTML = `
    <div class="result-card"><strong>${pct}%</strong><span>Pack completeness</span></div>
    <div class="result-card"><strong>${have.length} of ${rfqItems.length}</strong><span>Pack items ready</span></div>
    <div class="result-card"><strong>${firstQty > 0 && annualQty > 0 ? "Yes" : "No"}</strong><span>Quantities stated</span></div>
  `;

  rfqGapsRoot.innerHTML = missing.length
    ? `<p class="mat-out-title">Still to prepare</p>` +
      missing.map(([, label, , why, href]) => `<p class="mat-out"><strong>${label}</strong>: ${why} <a class="text-link-inline" href="${href}">How</a></p>`).join("")
    : `<p class="mat-out-title">Everything on the checklist is ready.</p>`;

  const processText = {
    moulding: "injection-moulded plastic parts",
    machining: "CNC-machined parts",
    sheet: "sheet-metal fabrication",
    casting: "cast parts",
    pcba: "printed circuit board assembly",
    assembly: "manufacture and assembly of the complete product",
    other: "manufacture of the parts described"
  }[process];
  const attachments = have.filter(([id]) => !["rfqNda", "rfqSamples"].includes(id)).map(([, label]) => `- ${label}`);
  const incotermText = { exw: "EXW (ex works)", fob: "FOB, naming the port", ddp: "DDP (delivered duty paid) to our UK address", any: "the delivery terms you normally offer, stated clearly" }[incoterm];

  if (rfqCopy) {
    rfqCopy.value = [
      `REQUEST FOR QUOTATION`,
      ``,
      `From: ${company}`,
      `Contact: ${contact}`,
      `Product: ${product}`,
      ``,
      `We would like a quotation for ${processText} for the product above.`,
      ``,
      `Quantities`,
      `- First order: ${firstQty > 0 ? firstQty.toLocaleString() : "[quantity]"} units`,
      `- Expected annual volume: ${annualQty > 0 ? annualQty.toLocaleString() : "[quantity]"} units`,
      `- Please also quote price breaks at other quantities you recommend.`,
      ``,
      target > 0 ? `Target price\n- We are aiming for about ${window.OrionCurrency?.symbol() || "£"}${target.toFixed(2)} per unit. Please tell us if this is unrealistic and what would change it.\n` : `Target price\n- Please quote your best price; we would welcome suggestions that reduce cost.\n`,
      `Attached`,
      ...(attachments.length ? attachments : ["- [List the files you are attaching]"]),
      ``,
      `Please include in your quotation`,
      `- Unit price for each quantity, and what it includes`,
      `- Tooling, fixture or set-up costs, tooling ownership and expected tool life (if applicable)`,
      `- Lead time to first samples${samplesWeeks > 0 ? ` (we would like samples within about ${samplesWeeks} weeks)` : ""} and to production`,
      `- Minimum order quantity`,
      `- Payment terms`,
      `- Delivery terms: please quote ${incotermText}`,
      `- Any design changes you would recommend for manufacture, cost or quality`,
      `- Your quality certifications and inspection approach`,
      ``,
      rfqYes("rfqNda") ? `This request and its attachments are confidential under our confidentiality agreement.` : `[Put a confidentiality agreement in place before sending design files.]`,
      ``,
      `Please reply by ${deadline || "[date]"} with any questions or your quotation.`,
      ``,
      `Thank you,`,
      `${contact}`,
      `${company}`
    ].join("\n");
  }

  window.OrionInsight?.show({
    level: pct >= 85 ? "good" : pct >= 60 ? "borderline" : "worrying",
    appendToCopy: false, // the copy text is the RFQ document itself; keep it clean
    headline: pct >= 85
      ? "Your pack covers what suppliers need to quote accurately."
      : pct >= 60
        ? `Your pack is ${pct}% complete: suppliers can quote, but expect questions and less accurate prices.`
        : `Your pack is only ${pct}% complete: quotes now are likely to be rough guesses and hard to compare.`,
    points: [
      missing[0] ? `Next to prepare: ${missing[0][1].toLowerCase()}.` : "Send the same pack to every supplier so the quotes can be compared like for like.",
      !rfqYes("rfqNda") ? "Put a confidentiality agreement in place before sharing CAD and drawings." : "Keep a record of what you sent to whom and when.",
      "Be honest about volumes: inflated forecasts produce prices you will not see in practice."
    ],
    next: { href: "../guides/how-to-find-and-brief-a-manufacturer.html", label: "Read how to find and brief a manufacturer" }
  });
};

rfqForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateRfqTool();
  if (window.OrionAnalytics) window.OrionAnalytics.trackEvent("calculate", { tool_name: "rfq_pack_builder" });
});
rfqForm.querySelectorAll("input, select, textarea").forEach((field) => {
  field.addEventListener("input", updateRfqTool);
  field.addEventListener("change", updateRfqTool);
});
if (window.OrionAnalytics) window.OrionAnalytics.trackEvent("tool_used", { tool_name: "rfq_pack_builder" });

updateRfqTool();
