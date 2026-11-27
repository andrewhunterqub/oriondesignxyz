const ndaForm = document.getElementById("ndaForm");
const ndaSummaryRoot = document.getElementById("ndaSummary");
const ndaCopy = document.getElementById("ndaCopy");

const ndaEscapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const updateNdaTool = () => {
  const ndaType = document.getElementById("ndaType").value;
  const termYears = Number(document.getElementById("termYears").value);
  const disclosingParty = document.getElementById("disclosingParty").value.trim();
  const receivingParty = document.getElementById("receivingParty").value.trim();
  const purpose = document.getElementById("purpose").value.trim();
  const confidentialItems = document.getElementById("confidentialItems").value.trim();
  const jurisdiction = document.getElementById("jurisdiction").value.trim();

  ndaSummaryRoot.innerHTML = `
    <div class="result-card">
      <strong>${ndaEscapeHtml(ndaType)}</strong>
      <span>Agreement type</span>
    </div>
    <div class="result-card">
      <strong>${termYears} year${termYears === 1 ? "" : "s"}</strong>
      <span>Confidentiality term</span>
    </div>
    <div class="result-card">
      <strong>${ndaEscapeHtml(jurisdiction)}</strong>
      <span>Jurisdiction</span>
    </div>
  `;

  ndaCopy.value =
    `${ndaType.toUpperCase()} NON-DISCLOSURE AGREEMENT\n\n` +
    `This ${ndaType.toLowerCase()} non-disclosure agreement is made between ${disclosingParty} and ${receivingParty}.\n\n` +
    `1. Purpose\nThe parties wish to exchange information for the purpose of ${purpose}.\n\n` +
    `2. Confidential Information\nConfidential information includes ${confidentialItems}\n\n` +
    `3. Obligations\nThe receiving party agrees to keep the confidential information secret, use it only for the stated purpose, and not disclose it to third parties except where necessary and under equivalent confidentiality obligations.\n\n` +
    `4. Exclusions\nConfidential information does not include information already public, already lawfully known, independently developed without reference to the disclosed information, or required to be disclosed by law.\n\n` +
    `5. Term\nThe obligations of confidentiality continue for ${termYears} year${termYears === 1 ? "" : "s"} from the date of disclosure.\n\n` +
    `6. Return or Destruction\nOn request, confidential materials should be returned or destroyed, subject to lawful record-keeping requirements.\n\n` +
    `7. Governing Law\nThis agreement is governed by the laws of ${jurisdiction}.\n\n` +
    `Signed:\n\n${disclosingParty}: ____________________\n\n${receivingParty}: ____________________\n\n` +
    `Draft note: This text is a starting point only and should be reviewed for the specific legal and commercial context.`;

  // Plain-English interpretation (shared panel in main.js).
  const isMutual = ndaType.toLowerCase() === "mutual";
  const hasTerm = Number.isFinite(termYears) && termYears > 0;
  const termText = hasTerm ? `${termYears} year${termYears === 1 ? "" : "s"}` : "no stated term";
  const ukJurisdiction = /england|wales|scotland|northern ireland|united kingdom|\buk\b/i.test(jurisdiction);
  let keyCheck;
  if (!disclosingParty || !receivingParty) {
    keyCheck = "One of the parties is blank: name both as the correct legal entities before the draft goes anywhere.";
  } else if (!purpose || purpose.length < 20) {
    keyCheck = "The purpose is very short; describe the actual conversation so the agreement is easier to rely on.";
  } else if (!hasTerm) {
    keyCheck = "Enter a confidentiality term; two to five years is common for early product discussions.";
  } else if (jurisdiction && !ukJurisdiction) {
    keyCheck = `Governing law is ${jurisdiction}; with an overseas party or overseas law, have a solicitor review before disclosing anything.`;
  } else if (!isMutual) {
    keyCheck = `Check whether ${receivingParty} will also share drawings, pricing or test data; if so, a mutual NDA is usually the better fit.`;
  } else if (termYears < 2 || termYears > 5) {
    keyCheck = `A ${termYears}-year term is outside the two to five years common for early product discussions, so make sure it suits what is being shared.`;
  } else {
    keyCheck = "Check that the list of confidential information matches what you actually plan to share, and share only what the next step needs.";
  }
  window.OrionInsight?.show({
    appendToCopy: false, // the copy text is the NDA draft itself; keep it clean
    level: "info",
    headline: isMutual
      ? `This is a mutual draft: ${disclosingParty && receivingParty ? `${disclosingParty} and ${receivingParty}` : "both parties"} agree to protect each other's information for ${termText}${jurisdiction ? ` under the law of ${jurisdiction}` : ""}.`
      : `This is a one-way draft: ${receivingParty || "the receiving party"} agrees to protect ${disclosingParty || "the disclosing party"}'s information for ${termText}${jurisdiction ? ` under the law of ${jurisdiction}` : ""}.`,
    points: [
      keyCheck,
      "It is a starting point for discussion, not legal advice; a solicitor may add clauses it leaves out, such as remedies for breach and confirmation that no licence or ownership passes.",
      "If you are sharing something that would be hard to protect any other way, such as a process you plan to keep secret, get advice before disclosing it."
    ],
    next: { href: "../guides/how-to-protect-product-ip.html", label: "Read how to protect your product IP" }
  });
};

ndaForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateNdaTool();

  if (window.OrionAnalytics) {
    window.OrionAnalytics.trackEvent("calculate", {
      tool_name: "nda_generator",
      agreement_type: document.getElementById("ndaType").value
    });
  }
});
ndaForm.querySelectorAll("input, select, textarea").forEach((field) => {
  field.addEventListener("input", updateNdaTool);
  field.addEventListener("change", updateNdaTool);
});
if (window.OrionAnalytics) {
  window.OrionAnalytics.trackEvent("tool_used", {
    tool_name: "nda_generator"
  });
}

updateNdaTool();
