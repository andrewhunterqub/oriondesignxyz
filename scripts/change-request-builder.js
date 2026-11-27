const ecrForm = document.getElementById("ecrForm");
const ecrSummaryRoot = document.getElementById("ecrSummary");
const ecrGapsRoot = document.getElementById("ecrGaps");
const ecrDocRoot = document.getElementById("ecrDoc");
const ecrCopy = document.getElementById("ecrCopy");
const ecrAddPart = document.getElementById("ecrAddPart");
const ecrRemovePart = document.getElementById("ecrRemovePart");
const ecrPartsStatus = document.getElementById("ecrPartsStatus");
const ECR_ROWS = 6;

const ecrText = (id) => (document.getElementById(id)?.value || "").trim();
const ecrValue = (id) => document.getElementById(id)?.value || "";
const ecrEscape = (text) => String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Part rows: the table holds ECR_ROWS rows; rows after the first stay hidden until used,
// so saved inputs, presets and shared links (all handled by main.js) restore without extra state.
const ecrPartFields = ["ecrPart", "ecrDesc", "ecrCurRev", "ecrNewRev", "ecrNewPn"];
const ecrRowFilled = (i) => ecrPartFields.some((f) => ecrText(`${f}${i}`));
const ecrLastFilled = () => {
  for (let i = ECR_ROWS; i >= 1; i -= 1) if (ecrRowFilled(i)) return i;
  return 0;
};
let ecrVisibleRows = 1;
const ecrSyncRows = () => {
  ecrVisibleRows = Math.min(ECR_ROWS, Math.max(1, ecrVisibleRows, ecrLastFilled()));
  ecrForm.querySelectorAll("[data-ecr-part-row]").forEach((row) => {
    row.hidden = Number(row.getAttribute("data-ecr-part-row")) > ecrVisibleRows;
  });
  ecrAddPart.disabled = ecrVisibleRows >= ECR_ROWS;
  ecrRemovePart.disabled = ecrVisibleRows <= 1;
};

// Option wording used in the document.
const ecrReasons = {
  fault: "Fault or failure",
  cost: "Cost reduction",
  supply: "Supply",
  feedback: "Customer feedback",
  compliance: "Compliance",
  other: "Other"
};
const ecrStockText = { notchecked: "", none: "No stock or work in progress affected", useup: "Use up existing stock, then obsolete", rework: "Rework existing stock", scrap: "Scrap existing stock" };
const ecrToolingText = { notchecked: "", none: "No tooling change", modify: "Tool modification needed", new: "New tool needed" };
const ecrCertText = { notchecked: "", none: "Existing certification and test results still hold", retest: "Re-test or review needed before the change takes effect" };
const ecrCostText = { notchecked: "", none: "No cost change", oneoff: "One-off cost only", unit: "Unit cost changes", both: "One-off cost and unit cost change" };
const ecrDocs = [
  ["ecrDocCad", "CAD models"],
  ["ecrDocDrawing", "Drawings"],
  ["ecrDocBom", "Bill of materials"],
  ["ecrDocInstructions", "Instructions"],
  ["ecrDocPackaging", "Packaging and labels"]
];
const ecrEffText = { date: "date", batch: "production batch", serial: "serial number" };
const TBC = "[not checked yet]";

const updateEcrTool = () => {
  ecrSyncRows();
  const number = ecrText("ecrNumber");
  const ref = number || "[change number]";
  const raised = ecrText("ecrDate");
  const requester = ecrText("ecrRequester");
  const product = ecrText("ecrProduct");
  const reason = ecrValue("ecrReason");
  const description = ecrText("ecrDescription");
  const fff = ecrValue("ecrFff");
  const stock = ecrValue("ecrStock");
  const tooling = ecrValue("ecrTooling");
  const cert = ecrValue("ecrCert");
  const cost = ecrValue("ecrCost");
  const costNote = ecrText("ecrCostNote");
  const suppliers = ecrText("ecrSuppliers");
  const impactNotes = ecrText("ecrImpactNotes");
  const decision = ecrValue("ecrDecision");
  const decisionDate = ecrText("ecrDecisionDate");
  const effType = ecrValue("ecrEffType");
  const effFrom = ecrText("ecrEffFrom");

  const parts = [];
  for (let i = 1; i <= ECR_ROWS; i += 1) {
    if (!ecrRowFilled(i)) continue;
    parts.push({
      pn: ecrText(`ecrPart${i}`),
      desc: ecrText(`ecrDesc${i}`),
      cur: ecrText(`ecrCurRev${i}`),
      next: ecrText(`ecrNewRev${i}`),
      newPn: ecrText(`ecrNewPn${i}`)
    });
  }
  const partChange = (p) => {
    if (p.newPn) return `New part number ${p.newPn}${p.next ? ` rev ${p.next}` : ""}`;
    if (p.next) return `Rev ${p.cur || "?"} to rev ${p.next}`;
    return "[new revision or part number]";
  };
  const partName = (p) => `${p.pn || "[part number]"}${p.cur ? ` rev ${p.cur}` : ""}${p.desc ? `, ${p.desc}` : ""}`;

  const approvers = [1, 2]
    .map((i) => ({ name: ecrText(`ecrApprover${i}`), role: ecrText(`ecrRole${i}`) }))
    .filter((a) => a.name || a.role);
  const docsToUpdate = ecrDocs.filter(([id]) => ecrValue(id) === "update").map(([, label]) => label);
  const docsUnchecked = ecrDocs.filter(([id]) => ecrValue(id) === "notchecked").map(([, label]) => label.toLowerCase());

  // Impact areas, in the guide's order.
  const impact = [
    ["Stock and work in progress", ecrStockText[stock], stock !== "notchecked"],
    ["Tooling", ecrToolingText[tooling], tooling !== "notchecked"],
    ["Certification and testing", ecrCertText[cert], cert !== "notchecked"],
    ["Cost", `${ecrCostText[cost]}${cost !== "notchecked" && costNote ? `. ${costNote}` : ""}`, cost !== "notchecked"],
    ["Suppliers to notify", suppliers, Boolean(suppliers)],
    ["Documents to update", docsUnchecked.length ? "" : docsToUpdate.length ? docsToUpdate.join(", ") : "No documents change", !docsUnchecked.length]
  ];
  const checked = impact.filter((row) => row[2]).length;
  const unchecked = impact.filter((row) => !row[2]).map((row) => row[0].toLowerCase());

  const typeLabel = fff === "interchangeable" ? "New revision" : fff === "not" ? "New part number" : "Not decided";
  const fffText = {
    interchangeable: "Interchangeable in form, fit and function: raise the revision of each changed part and keep its part number.",
    not: "Not interchangeable in form, fit and function: give each changed part a new part number, and raise the revision of the parent BOM that uses it.",
    unsure: "Not decided yet. Ask whether anyone, including a repair technician years from now, could pick up the wrong part and get into trouble. If so, it needs a new part number."
  }[fff];

  // Gaps and contradictions.
  const gaps = [];
  if (!number) gaps.push("Give the request a change number so it can be found in the change log.");
  if (!requester) gaps.push("Say who requested the change.");
  if (!parts.some((p) => p.pn)) gaps.push("List at least one affected part number with its current revision.");
  parts.filter((p) => p.pn && !p.cur).forEach((p) => gaps.push(`Add the current revision of ${p.pn}.`));
  parts.filter((p) => p.pn && !p.next && !p.newPn).forEach((p) => gaps.push(`Add the new revision or new part number for ${p.pn}.`));
  if (!description) gaps.push("Describe what should change and why.");
  if (fff === "unsure") gaps.push("Answer the form, fit and function question: it decides between a new revision and a new part number.");
  if (fff === "interchangeable" && parts.some((p) => p.newPn)) gaps.push("You marked the change interchangeable but gave a new part number. Interchangeable changes keep the part number and raise the revision.");
  if (fff === "not" && parts.length && !parts.some((p) => p.newPn)) gaps.push("The change is not interchangeable, so the changed part needs a new part number. Add it in the New part no. column.");
  if (unchecked.length) gaps.push(`Finish the impact check: ${unchecked.join(", ")}.`);
  if (!approvers.some((a) => a.name)) gaps.push("Name the person who will approve or reject the change.");
  if (decision !== "pending" && !decisionDate) gaps.push("Record the date of the decision.");
  const noEffectivity = effType === "undecided" || !effFrom;
  if (decision === "approved" && noEffectivity) gaps.push("The change is approved but has no effectivity. State the date, batch or serial number it applies from.");
  else if (decision === "pending" && noEffectivity) gaps.push("Propose an effectivity: the date, batch or serial number the change should apply from.");
  if (decision === "approved" && unchecked.length) gaps.push("The change is approved before the impact check is finished. Check the open items before release.");

  ecrSummaryRoot.innerHTML = `
    <div class="result-card"><strong>${typeLabel}</strong><span>Change type</span></div>
    <div class="result-card"><strong>${parts.filter((p) => p.pn).length}</strong><span>Part numbers affected</span></div>
    <div class="result-card"><strong>${checked} of ${impact.length}</strong><span>Impact areas checked</span></div>
  `;

  ecrGapsRoot.innerHTML = gaps.length
    ? `<p class="mat-out-title">Still to complete</p>` + gaps.map((g) => `<p class="mat-out">${ecrEscape(g)}</p>`).join("")
    : `<p class="mat-out-title">Every part of the request is filled in.</p>`;

  // Step 4: release wording, using the guide's release states.
  const oldState = stock === "useup" ? "\"use up existing stock, then obsolete\"" : "obsolete";
  let release;
  if (decision === "approved") {
    release = [
      "Update the CAD, drawing and BOM together and release them at the new revision or new part number.",
      `Mark the previous revision ${oldState}. Keep its files, marked clearly, so products already built can be supported.`
    ];
  } else if (decision === "rejected") {
    release = ["Not released. The current released revisions stay in use. Keep this request and the decision in the change log."];
  } else {
    release = ["Not released yet. Changed files stay draft until the change is approved; do not use them to cut tooling or order production parts."];
  }

  const effective = decision === "rejected"
    ? "not applicable (change rejected)"
    : effType === "undecided" || !effFrom
    ? `[${effType === "undecided" ? "date, batch or serial" : ecrEffText[effType].toLowerCase()} not decided yet]`
    : `${ecrEffText[effType]} ${effFrom}`;
  const statusText = { pending: "Awaiting decision", approved: "Approved", rejected: "Rejected" }[decision];

  // What happens next, following the five steps.
  const next = [];
  if (unchecked.length) next.push(`Finish the impact check: ${unchecked.join(", ")}. Use the indented BOM to find every assembly that contains the part.`);
  if (decision === "pending") next.push(`Ask ${approvers[0]?.name || "the named approver"} to approve or reject the change, and record the decision with the date.`);
  if (decision !== "rejected") {
    next.push("Update the CAD, drawing and BOM together. Never edit a released file: copy it, raise the revision and work on the copy. Name files with part number and revision, such as 1103_C.step and 1103_C.pdf.");
    next.push(fff === "not"
      ? "Issue the new part number from your part number register, and raise the revision of every parent BOM that lists the old one."
      : "Check every parent assembly in the indented BOM; if its BOM lists the revision that changes, reissue it at a new revision.");
    next.push(fff === "not" ? `Release the new part number and mark the old part ${oldState}.` : `Release the new revision and mark the old one ${oldState}.`);
    if (cert === "retest") next.push("Repeat the affected tests, for example on first-off parts of the new revision, and keep the evidence.");
    if (tooling === "modify" || tooling === "new") next.push("Agree the tooling cost and timing with the toolmaker, and check they fit the effectivity.");
    next.push(`Tell ${suppliers ? `each supplier listed (${suppliers})` : "every affected supplier"} in writing, send the released files (STEP model, PDF drawing and matching BOM) and ask them to confirm. Log what you sent, to whom and when.`);
    next.push(effType === "undecided" || !effFrom
      ? "Decide the effectivity: the date, batch or serial number from which the change applies. Record it in the change log, so you can always tell which units have the change."
      : `Record the effectivity (${effective}) in the change log, so you can always tell which units have the change.`);
  } else {
    next.push("Tell the requester why the change was rejected, and keep the request in the change log.");
  }

  const dash = (v) => (v ? ecrEscape(v) : `<span class="ecr-tbc">${TBC}</span>`);
  ecrDocRoot.innerHTML = `
    <h2 class="ecr-doc-title">Engineering change request ${ecrEscape(ref)}</h2>
    <dl class="ecr-meta">
      <div><dt>Date raised</dt><dd>${raised ? ecrEscape(raised) : "[date]"}</dd></div>
      <div><dt>Requested by</dt><dd>${requester ? ecrEscape(requester) : "[name and role]"}</dd></div>
      <div><dt>Product</dt><dd>${product ? ecrEscape(product) : "[product]"}</dd></div>
      <div><dt>Status</dt><dd>${statusText}</dd></div>
    </dl>
    <h3>1. Change request</h3>
    <p><strong>Reason:</strong> ${ecrReasons[reason]}</p>
    <p>${description ? ecrEscape(description).replace(/\n/g, "<br>") : "[What should change, and why]"}</p>
    <div class="tool-table-wrap">
      <table class="tool-table ecr-doc-table">
        <caption class="visually-hidden">Affected parts</caption>
        <thead><tr><th scope="col">Part no.</th><th scope="col">Description</th><th scope="col">Current rev</th><th scope="col">Change</th></tr></thead>
        <tbody>
          ${(parts.length ? parts : [{ pn: "", desc: "", cur: "", next: "", newPn: "" }])
            .map((p) => `<tr><td>${ecrEscape(p.pn || "[part number]")}</td><td>${ecrEscape(p.desc)}</td><td>${ecrEscape(p.cur)}</td><td>${ecrEscape(partChange(p))}</td></tr>`)
            .join("")}
        </tbody>
      </table>
    </div>
    <p><strong>Form, fit and function:</strong> ${ecrEscape(fffText)}</p>
    <h3>2. Impact check</h3>
    <dl class="ecr-meta">
      ${impact.map(([label, text]) => `<div><dt>${label}</dt><dd>${dash(text)}</dd></div>`).join("")}
    </dl>
    ${impactNotes ? `<p><strong>Notes:</strong> ${ecrEscape(impactNotes).replace(/\n/g, "<br>")}</p>` : ""}
    <h3>3. Approval</h3>
    <dl class="ecr-meta">
      ${(approvers.length ? approvers : [{ name: "", role: "" }])
        .map((a) => `<div><dt>${a.role ? ecrEscape(a.role) : "Approver"}</dt><dd>${a.name ? ecrEscape(a.name) : "[name]"}</dd></div>`)
        .join("")}
      <div><dt>Decision</dt><dd>${statusText}${decisionDate ? `, ${ecrEscape(decisionDate)}` : ""}</dd></div>
    </dl>
    <h3>4. Release</h3>
    ${release.map((line) => `<p>${line}</p>`).join("")}
    <h3>5. Effectivity</h3>
    <p>Takes effect from: ${ecrEscape(effective)}</p>
    <h3>What happens next</h3>
    <ul class="print-checklist">
      ${next.map((line) => `<li>${ecrEscape(line)}</li>`).join("")}
    </ul>`;

  if (ecrCopy) {
    ecrCopy.value = [
      `ENGINEERING CHANGE REQUEST ${ref}`,
      ``,
      `Date raised: ${raised || "[date]"}`,
      `Requested by: ${requester || "[name and role]"}`,
      `Product: ${product || "[product]"}`,
      `Status: ${statusText}`,
      ``,
      `1. CHANGE REQUEST`,
      `Reason: ${ecrReasons[reason]}`,
      `Description: ${description || "[What should change, and why]"}`,
      `Affected parts:`,
      ...(parts.length ? parts.map((p) => `- ${partName(p)}: ${partChange(p)}`) : ["- [part number, current revision, new revision]"]),
      `Form, fit and function: ${fffText}`,
      ``,
      `2. IMPACT CHECK`,
      ...impact.map(([label, text]) => `- ${label}: ${text || TBC}`),
      ...(impactNotes ? [`Notes: ${impactNotes}`] : []),
      ``,
      `3. APPROVAL`,
      ...(approvers.length ? approvers.map((a) => `- ${a.role || "Approver"}: ${a.name || "[name]"}`) : ["- Approver: [name]"]),
      `Decision: ${statusText}${decisionDate ? `, ${decisionDate}` : ""}`,
      ``,
      `4. RELEASE`,
      ...release,
      ``,
      `5. EFFECTIVITY`,
      `Takes effect from: ${effective}`,
      ``,
      `WHAT HAPPENS NEXT`,
      ...next.map((line) => `[ ] ${line}`)
    ].join("\n");
  }

  const ready = !gaps.length;
  window.OrionInsight?.show({
    level: decision === "approved" && unchecked.length ? "worrying" : decision === "rejected" ? "info" : ready ? "good" : "borderline",
    appendToCopy: false, // the copy text is the change request itself; keep it clean
    headline: decision === "approved" && unchecked.length
      ? `This change is marked approved, but ${unchecked.length} impact area${unchecked.length === 1 ? " is" : "s are"} still unchecked.`
      : ready
        ? decision === "rejected"
          ? `Change request ${ref} is complete and rejected; keep it in the change log.`
          : `Change request ${ref} is complete: ${typeLabel.toLowerCase()}, ${statusText.toLowerCase()}, effective from ${effective}.`
        : `Change request ${ref} has ${gaps.length} item${gaps.length === 1 ? "" : "s"} to complete before it is ready ${decision === "pending" ? "for a decision" : "to file"}.`,
    points: [
      fff === "unsure" ? "Settle the form, fit and function question first: it decides whether the part keeps its number." : fffText,
      "Release the CAD, drawing and BOM together at the same revision, every time.",
      "Without an effectivity date, batch or serial number, nobody can tell later which units have the change."
    ],
    next: { href: "../guides/bills-of-materials-and-revision-control.html#change", label: "Read the change process in the BOM guide" }
  });
};

ecrAddPart.addEventListener("click", () => {
  if (ecrVisibleRows >= ECR_ROWS) return;
  ecrVisibleRows += 1;
  ecrSyncRows();
  document.getElementById(`ecrPart${ecrVisibleRows}`)?.focus();
  ecrPartsStatus.textContent = `Part row ${ecrVisibleRows} added.`;
});
ecrRemovePart.addEventListener("click", () => {
  if (ecrVisibleRows <= 1) return;
  const row = ecrVisibleRows;
  ecrPartFields.forEach((f) => {
    const field = document.getElementById(`${f}${row}`);
    if (field) field.value = "";
  });
  ecrVisibleRows -= 1;
  // Let main.js save the cleared row, then refresh the document.
  document.getElementById(`ecrPart${row}`)?.dispatchEvent(new Event("input", { bubbles: true }));
  updateEcrTool();
  (ecrRemovePart.disabled ? ecrAddPart : ecrRemovePart).focus();
  ecrPartsStatus.textContent = `Part row ${row} removed.`;
});
// A worked example replaces the rows, so show only the rows it fills.
document.querySelectorAll("[data-tool-preset]").forEach((button) =>
  button.addEventListener("click", () => {
    ecrVisibleRows = 1;
    updateEcrTool();
  })
);

ecrForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateEcrTool();
  if (window.OrionAnalytics) window.OrionAnalytics.trackEvent("calculate", { tool_name: "change_request_builder" });
});
ecrForm.querySelectorAll("input, select, textarea").forEach((field) => {
  field.addEventListener("input", updateEcrTool);
  field.addEventListener("change", updateEcrTool);
});
if (window.OrionAnalytics) window.OrionAnalytics.trackEvent("tool_used", { tool_name: "change_request_builder" });

updateEcrTool();
