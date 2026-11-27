const bdForm = document.getElementById("bdForm");
const bdSummary = document.getElementById("bdSummary");
const bdStatus = document.getElementById("bdStatus");
const bdBreakdown = document.getElementById("bdBreakdown");
const bdCopy = document.getElementById("bdCopy");
const bdCase = document.getElementById("bdCase");
const bdSection = document.getElementById("bdSection");
const bdLoadMode = document.getElementById("bdLoadMode");
const bdLimitMode = document.getElementById("bdLimitMode");

const bdInputIds = [
  "bdForce", "bdMass", "bdLength", "bdModulus", "bdWidth", "bdHeight", "bdDiameter", "bdWall",
  "bdLimitRatio", "bdLimitMm", "bdAllowStress"
];
const bdNum = (id) => Number(document.getElementById(id).value) || 0;
const bdValues = () => ({
  ...Object.fromEntries(bdInputIds.map((id) => [id, bdNum(id)])),
  bdCase: bdCase.value,
  bdSection: bdSection.value,
  bdLoadMode: bdLoadMode.value === "mass" ? "mass" : "force",
  bdLimitMode: bdLimitMode.value === "mm" ? "mm" : "ratio"
});

// Fixed-point formatting without trailing zeros, e.g. 2.50 -> "2.5".
const bdFmt = (value, places = 2) => Number(value).toFixed(places).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
// Three significant figures, with thousands separators for large numbers.
const bdSig = (value) => {
  if (!Number.isFinite(value)) return "–";
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1000) return Math.round(value).toLocaleString("en-GB");
  const places = Math.min(6, Math.max(0, 2 - Math.floor(Math.log10(abs))));
  return bdFmt(value, places);
};
const bdMm = (value) => `${bdSig(value)} mm`;
const bdMpa = (value) => `${bdSig(value)} MPa`;
const bdN = (value) => `${bdSig(value)} N`;

const BD_G = 9.81;
// Status thresholds: share of the deflection limit or of the allowable stress, whichever is worse.
const BD_PASS_SHARE = 0.8;
const BD_MARGINAL_SHARE = 1;

// Load cases: deflection coefficient k in δ = F·L³/(k·E·I), and M_max as a multiple of F·L.
// For the spread load F is the total load, so w = F/L gives δ = F·L³/(8·E·I) and M_max = F·L/2.
const BD_CASES = {
  "cantilever-end": { k: 3, moment: 1, label: "Cantilever, load at the free end", deflectionText: "F × L³ ÷ (3 × E × I)", momentText: "F × L" },
  "simply-supported": { k: 48, moment: 0.25, label: "Supported at both ends, load in the centre", deflectionText: "F × L³ ÷ (48 × E × I)", momentText: "F × L ÷ 4" },
  "cantilever-udl": { k: 8, moment: 0.5, label: "Cantilever, load spread evenly along it", deflectionText: "w × L⁴ ÷ (8 × E × I)", momentText: "w × L² ÷ 2" }
};
const BD_SECTION_LABELS = {
  rect: "Solid rectangle",
  "rect-tube": "Rectangular tube",
  round: "Round bar",
  "round-tube": "Round tube"
};

// Second moment of area I (mm⁴) and outer-fibre distance c (mm) for the chosen section.
// Returns { I: NaN, problem } when the dimensions do not make a real section.
const bdSectionProps = (v) => {
  const b = Math.max(0, v.bdWidth);
  const h = Math.max(0, v.bdHeight);
  const d = Math.max(0, v.bdDiameter);
  const t = Math.max(0, v.bdWall);
  if (v.bdSection === "rect-tube") {
    if (!(b > 0 && h > 0 && t > 0)) return { I: NaN, c: NaN, problem: "Enter an outside width, outside depth and wall thickness above zero." };
    const bi = b - 2 * t;
    const hi = h - 2 * t;
    if (bi <= 0 || hi <= 0) return { I: NaN, c: NaN, problem: "The wall is at least half the outside size, so there is no hole: make the wall thinner, or choose a solid rectangle." };
    return { I: (b * h ** 3 - bi * hi ** 3) / 12, c: h / 2, depth: h, inner: `${bdFmt(bi)} × ${bdFmt(hi)} mm inside` };
  }
  if (v.bdSection === "round") {
    if (!(d > 0)) return { I: NaN, c: NaN, problem: "Enter a diameter above zero." };
    return { I: (Math.PI * d ** 4) / 64, c: d / 2, depth: d };
  }
  if (v.bdSection === "round-tube") {
    if (!(d > 0 && t > 0)) return { I: NaN, c: NaN, problem: "Enter an outside diameter and wall thickness above zero." };
    const di = d - 2 * t;
    if (di <= 0) return { I: NaN, c: NaN, problem: "The wall is at least half the diameter, so there is no hole: make the wall thinner, or choose a round bar." };
    return { I: (Math.PI * (d ** 4 - di ** 4)) / 64, c: d / 2, depth: d, inner: `${bdFmt(di)} mm inside diameter` };
  }
  if (!(b > 0 && h > 0)) return { I: NaN, c: NaN, problem: "Enter a width and thickness above zero." };
  return { I: (b * h ** 3) / 12, c: h / 2, depth: h };
};

// This is the tool's only copy of the maths; the sensitivity view calls it too, so both always agree.
const bdFrom = (v) => {
  const loadCase = BD_CASES[v.bdCase] || BD_CASES["cantilever-end"];
  const F = v.bdLoadMode === "mass" ? Math.max(0, v.bdMass) * BD_G : Math.max(0, v.bdForce);
  const L = Math.max(0, v.bdLength);
  const E = Math.max(0, v.bdModulus);
  const sigmaAllow = Math.max(0, v.bdAllowStress);
  const section = bdSectionProps(v);
  const { I, c } = section;

  const EI = E * I;
  const delta = EI > 0 ? (F * L ** 3) / (loadCase.k * EI) : NaN;
  const M = loadCase.moment * F * L;
  const sigma = I > 0 ? (M * c) / I : NaN;
  const limit = v.bdLimitMode === "mm" ? Math.max(0, v.bdLimitMm) : v.bdLimitRatio > 0 ? L / v.bdLimitRatio : 0;
  const deflectionShare = limit > 0 ? delta / limit : NaN;
  const stressShare = sigmaAllow > 0 ? sigma / sigmaAllow : NaN;
  const safetyFactor = sigma > 0 && sigmaAllow > 0 ? sigmaAllow / sigma : NaN;

  // Thickness of a solid rectangle (width b held) that just meets each limit.
  const b = Math.max(0, v.bdWidth);
  const hForDeflection = v.bdSection === "rect" && b > 0 && E > 0 && limit > 0
    ? Math.cbrt((12 * F * L ** 3) / (loadCase.k * E * b * limit))
    : NaN;
  const hForStress = v.bdSection === "rect" && b > 0 && sigmaAllow > 0 ? Math.sqrt((6 * M) / (b * sigmaAllow)) : NaN;

  const shares = [deflectionShare, stressShare].filter(Number.isFinite);
  const worst = shares.length ? Math.max(...shares) : NaN;
  const status = !Number.isFinite(worst) ? "info" : worst <= BD_PASS_SHARE ? "pass" : worst <= BD_MARGINAL_SHARE ? "warn" : "fail";
  return { loadCase, F, L, E, sigmaAllow, section, I, c, delta, M, sigma, limit, deflectionShare, stressShare, safetyFactor, hForDeflection, hForStress, worst, status };
};

// Show only the fields the chosen section, load and limit use.
const syncBdFields = () => {
  const section = bdSection.value;
  const isRect = section === "rect" || section === "rect-tube";
  const isTube = section === "rect-tube" || section === "round-tube";
  document.getElementById("bdWidthGroup").hidden = !isRect;
  document.getElementById("bdHeightGroup").hidden = !isRect;
  document.getElementById("bdDiameterGroup").hidden = isRect;
  document.getElementById("bdWallGroup").hidden = !isTube;
  document.getElementById("bdWidthLabel").textContent = section === "rect-tube" ? "Outside width, B (mm)" : "Width, b (mm)";
  document.getElementById("bdHeightLabel").textContent = section === "rect-tube" ? "Outside depth, H (mm)" : "Thickness, h (mm)";
  document.getElementById("bdDiameterLabel").textContent = section === "round-tube" ? "Outside diameter, D (mm)" : "Diameter, d (mm)";
  const byMass = bdLoadMode.value === "mass";
  document.getElementById("bdForceGroup").hidden = byMass;
  document.getElementById("bdMassGroup").hidden = !byMass;
  const byMm = bdLimitMode.value === "mm";
  document.getElementById("bdLimitRatioGroup").hidden = byMm;
  document.getElementById("bdLimitMmGroup").hidden = !byMm;
};

const renderBdSensitivity = () => {
  const round = bdSection.value === "round" || bdSection.value === "round-tube";
  window.OrionSensitivity?.render({
    after: bdBreakdown,
    title: "Which input matters most for deflection?",
    better: "lower",
    note: round ? "The section depth is the outside diameter; the wall is held." : bdSection.value === "rect-tube" ? "The section depth is the outside depth; the wall is held." : "",
    format: (v) => `${bdSig(v)} mm`,
    inputs: [
      { id: "bdLength", label: "Length, L" },
      { id: round ? "bdDiameter" : "bdHeight", label: "Section depth, h" },
      { id: bdLoadMode.value === "mass" ? "bdMass" : "bdForce", label: "Load, F" }
    ],
    compute: (values) => bdFrom({ ...bdValues(), ...values }).delta
  });
};

const updateBdTool = () => {
  syncBdFields();
  const r = bdFrom(bdValues());
  const valid = r.F > 0 && r.L > 0 && r.E > 0 && Number.isFinite(r.I) && r.I > 0 && Number.isFinite(r.delta);
  const sectionLabel = BD_SECTION_LABELS[bdSection.value] || BD_SECTION_LABELS.rect;

  if (!valid) {
    const need = r.section.problem || "Enter a load, length and elastic modulus above zero.";
    const message = Number.isFinite(r.I) ? "Enter a load, length and elastic modulus above zero." : need;
    bdSummary.innerHTML = `
      <div class="result-card"><strong>–</strong><span>${message}</span></div>`;
    bdStatus.innerHTML = "";
    bdBreakdown.innerHTML = "";
    bdCopy.value = `Bracket deflection check: ${message}`;
    window.OrionInsight?.show({
      level: "info",
      headline: "Enter the load, length, section and elastic modulus to check the bracket.",
      points: []
    });
    renderBdSensitivity();
    return;
  }

  const statusLabel = { pass: "Pass", warn: "Marginal", fail: "Over", info: "Check inputs" }[r.status];
  const statusIcon = { pass: "✓", warn: "!", fail: "✗", info: "?" }[r.status];
  const pct = (share) => (Number.isFinite(share) ? `${Math.round(share * 100).toLocaleString("en-GB")}%` : "–");
  const limitText = Number.isFinite(r.limit) && r.limit > 0
    ? (bdLimitMode.value === "mm" ? bdMm(r.limit) : `L ÷ ${bdFmt(bdNum("bdLimitRatio"), 1)} = ${bdMm(r.limit)}`)
    : "Not set";
  const sfText = Number.isFinite(r.safetyFactor) ? bdSig(r.safetyFactor) : "–";
  const loadText = bdLoadMode.value === "mass" ? `${bdFmt(bdNum("bdMass"), 2)} kg × 9.81 = ${bdN(r.F)}` : bdN(r.F);
  const sectionDims = {
    rect: `${bdFmt(bdNum("bdWidth"))} × ${bdFmt(bdNum("bdHeight"))} mm`,
    "rect-tube": `${bdFmt(bdNum("bdWidth"))} × ${bdFmt(bdNum("bdHeight"))} × ${bdFmt(bdNum("bdWall"))} mm wall (${r.section.inner})`,
    round: `${bdFmt(bdNum("bdDiameter"))} mm diameter`,
    "round-tube": `${bdFmt(bdNum("bdDiameter"))} mm × ${bdFmt(bdNum("bdWall"))} mm wall (${r.section.inner})`
  }[bdSection.value] || "";
  const largeDeflection = r.delta > r.L / 10;

  bdSummary.innerHTML = `
    <div class="result-card"><strong>${bdMm(r.delta)}</strong><span>Deflection, δ (${pct(r.deflectionShare)} of the limit)</span></div>
    <div class="result-card"><strong>${bdMpa(r.sigma)}</strong><span>Maximum bending stress, σ (${pct(r.stressShare)} of allowable)</span></div>
    <div class="result-card"><strong>${sfText}</strong><span>Safety factor on your allowable stress</span></div>
    <div class="result-card"><strong>${bdSig(r.I)} mm⁴</strong><span>Second moment of area, I</span></div>
  `;

  const missing = [];
  if (!Number.isFinite(r.deflectionShare)) missing.push("a deflection limit");
  if (!Number.isFinite(r.stressShare)) missing.push("an allowable stress");
  const driver = Number.isFinite(r.deflectionShare) && (!Number.isFinite(r.stressShare) || r.deflectionShare >= r.stressShare) ? "deflection" : "stress";
  const bothOver = r.deflectionShare > BD_MARGINAL_SHARE && r.stressShare > BD_MARGINAL_SHARE;
  const shareParts = [];
  if (Number.isFinite(r.deflectionShare)) shareParts.push(`deflection uses ${pct(r.deflectionShare)} of your limit`);
  if (Number.isFinite(r.stressShare)) shareParts.push(`stress uses ${pct(r.stressShare)} of your allowable stress`);
  const shareText = shareParts.length ? `${shareParts.join(" and ").replace(/^./, (ch) => ch.toUpperCase())}.` : "";
  const statusDetail = {
    pass: `${shareText} ${shareParts.length > 1 ? "Both are" : "It is"} within 80%.`,
    warn: `${shareText} The ${driver} is close to its limit, so a less rigid root or small changes in thickness or material could push it over.`,
    fail: bothOver
      ? `${shareText} The bracket is likely to bend further than your limit allows, and the stress is over your allowable figure, so it is likely to take a permanent bend or fail.`
      : driver === "stress"
        ? `${shareText} The stress is over your allowable figure, so the bracket is likely to take a permanent bend or fail.`
        : `${shareText} The bracket is likely to bend further than your limit allows.`,
    info: "Enter a deflection limit and an allowable stress to see the status."
  }[r.status];
  const missingNote = missing.length && r.status !== "info" ? ` Status based on one check only: enter ${missing.join(" and ")} for the other.` : "";
  bdStatus.innerHTML = `
    <div class="dfm-check dfm-check-${r.status === "info" ? "warn" : r.status}">
      <span class="dfm-badge"><span aria-hidden="true">${statusIcon}</span> ${statusLabel}</span>
      <div><strong>Deflection ${bdMm(r.delta)} against ${limitText}; stress ${bdMpa(r.sigma)} against ${r.sigmaAllow > 0 ? bdMpa(r.sigmaAllow) : "no allowable set"}</strong><p>${statusDetail}${missingNote}</p></div>
    </div>`;

  const thicknessRow = bdSection.value === "rect"
    ? `
    <div class="comparison-item"><span>Thickness needed for the deflection limit (width ${bdFmt(bdNum("bdWidth"))} mm held)</span><strong>${Number.isFinite(r.hForDeflection) ? bdMm(r.hForDeflection) : "Set a deflection limit"}</strong></div>
    <div class="comparison-item"><span>Thickness needed for the allowable stress</span><strong>${Number.isFinite(r.hForStress) ? bdMm(r.hForStress) : "Set an allowable stress"}</strong></div>`
    : `
    <div class="comparison-item"><span>Thickness needed</span><strong>Solid rectangle only: try a deeper section</strong></div>`;
  bdBreakdown.innerHTML = `
    <div class="comparison-item"><span>Load case</span><strong>${r.loadCase.label}</strong></div>
    <div class="comparison-item"><span>Load, F</span><strong>${loadText}</strong></div>
    <div class="comparison-item"><span>Section: ${sectionLabel}</span><strong>${sectionDims}</strong></div>
    <div class="comparison-item"><span>Second moment of area, I</span><strong>${bdSig(r.I)} mm⁴</strong></div>
    <div class="comparison-item"><span>Outer fibre distance, c</span><strong>${bdMm(r.c)}</strong></div>
    <div class="comparison-item"><span>Deflection, δ = ${r.loadCase.deflectionText}</span><strong>${bdMm(r.delta)}</strong></div>
    <div class="comparison-item"><span>Deflection limit</span><strong>${limitText}</strong></div>
    <div class="comparison-item"><span>Deflection against the limit</span><strong>${pct(r.deflectionShare)}</strong></div>
    <div class="comparison-item"><span>Maximum bending moment, M_max = ${r.loadCase.momentText}</span><strong>${bdSig(r.M)} N·mm</strong></div>
    <div class="comparison-item"><span>Maximum bending stress, σ = M_max × c ÷ I</span><strong>${bdMpa(r.sigma)}</strong></div>
    <div class="comparison-item"><span>Stress against your allowable ${r.sigmaAllow > 0 ? bdMpa(r.sigmaAllow) : ""}</span><strong>${pct(r.stressShare)}</strong></div>
    <div class="comparison-item"><span>Safety factor, σ_allow ÷ σ</span><strong>${sfText}</strong></div>${thicknessRow}`;

  bdCopy.value =
    `Bracket Deflection Check (Euler–Bernoulli beam, first estimate)\n` +
    `Load case: ${r.loadCase.label}\n` +
    `Load F: ${loadText}; length L ${bdFmt(r.L, 1)} mm\n` +
    `Section: ${sectionLabel}, ${sectionDims}\n` +
    `Elastic modulus E: ${bdFmt(r.E, 0)} MPa\n` +
    `Second moment of area I: ${bdSig(r.I)} mm⁴; c ${bdMm(r.c)}\n` +
    `Deflection: ${bdMm(r.delta)} against ${limitText} (${pct(r.deflectionShare)})\n` +
    `Maximum bending moment: ${bdSig(r.M)} N·mm\n` +
    `Maximum bending stress: ${bdMpa(r.sigma)} against ${r.sigmaAllow > 0 ? bdMpa(r.sigmaAllow) : "no allowable set"} (${pct(r.stressShare)})\n` +
    `Safety factor: ${sfText}\n` +
    `Status: ${statusLabel}\n` +
    (bdSection.value === "rect"
      ? `Thickness needed: ${Number.isFinite(r.hForDeflection) ? bdMm(r.hForDeflection) : "–"} for deflection, ${Number.isFinite(r.hForStress) ? bdMm(r.hForStress) : "–"} for stress\n`
      : "") +
    `Assumes small elastic deflections, a fully fixed root and no self-weight, buckling, fatigue or stress concentrations. Confirm by test or FEA.`;

  renderBdSensitivity();

  const level = { pass: "good", warn: "borderline", fail: "worrying", info: "info" }[r.status];
  const headline = {
    pass: `At about ${bdMm(r.delta)} of deflection and ${bdMpa(r.sigma)} of stress, the bracket is within both your limits with room to spare.`,
    warn: `At about ${bdMm(r.delta)} of deflection and ${bdMpa(r.sigma)} of stress, the bracket is within your limits but close to the ${driver} limit.`,
    fail: `At about ${bdMm(r.delta)} of deflection and ${bdMpa(r.sigma)} of stress, the bracket is over ${bothOver ? "both your limits" : `your ${driver} limit`}.`,
    info: `The bracket deflects about ${bdMm(r.delta)} with a stress of ${bdMpa(r.sigma)}. Enter your limits to judge it.`
  }[r.status];
  const points = [];
  if (bdSection.value === "rect" && Number.isFinite(r.hForDeflection) && Number.isFinite(r.hForStress)) {
    const needed = Math.max(r.hForDeflection, r.hForStress);
    points.push(`A flat bracket of this width needs to be at least about ${bdMm(needed)} thick to meet both limits; it is ${bdMm(bdNum("bdHeight"))} now. Deflection falls with the cube of the thickness.`);
  } else {
    points.push("Deflection falls with the cube of the section depth and rises with the cube of the length, so a deeper section or a shorter reach helps most.");
  }
  if (largeDeflection) {
    points.push("The deflection is more than a tenth of the length, beyond the small-deflection range of these formulas. Treat the bracket as far too flexible.");
  }
  points.push("The root is assumed fully fixed. Screws, thin walls and plastic bosses let it rotate, so the real bracket will usually bend more. Confirm by test or FEA.");
  window.OrionInsight?.show({
    level,
    headline,
    points,
    next: { href: "../guides/choosing-metals-for-a-product.html", label: "Read about choosing metals" }
  });
};

bdForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateBdTool();
  if (window.OrionAnalytics) window.OrionAnalytics.trackEvent("calculate", { tool_name: "bracket_deflection_calculator" });
});
// Carry the current figure across when an entry mode changes, so the hidden field is not stale.
// Values are rounded to the field's step so the browser still accepts the form.
// Registered before the generic listeners so the recalculation uses the carried value.
bdLoadMode.addEventListener("change", () => {
  if (bdLoadMode.value === "mass") {
    const force = bdNum("bdForce");
    if (force > 0) document.getElementById("bdMass").value = bdFmt(force / BD_G, 2);
  } else {
    const mass = bdNum("bdMass");
    if (mass > 0) document.getElementById("bdForce").value = bdFmt(mass * BD_G, 2);
  }
});
bdLimitMode.addEventListener("change", () => {
  const length = bdNum("bdLength");
  if (bdLimitMode.value === "mm") {
    const n = bdNum("bdLimitRatio");
    if (n > 0 && length > 0) document.getElementById("bdLimitMm").value = bdFmt(length / n, 2);
  } else {
    const mm = bdNum("bdLimitMm");
    if (mm > 0 && length > 0) document.getElementById("bdLimitRatio").value = String(Math.max(1, Math.round(length / mm)));
  }
});
bdForm.querySelectorAll("input, select").forEach((field) => {
  field.addEventListener("input", updateBdTool);
  field.addEventListener("change", updateBdTool);
});
if (window.OrionAnalytics) window.OrionAnalytics.trackEvent("tool_used", { tool_name: "bracket_deflection_calculator" });

updateBdTool();
