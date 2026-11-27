const snapForm = document.getElementById("snapForm");
const snapSummary = document.getElementById("snapSummary");
const snapStatus = document.getElementById("snapStatus");
const snapBreakdown = document.getElementById("snapBreakdown");
const snapCopy = document.getElementById("snapCopy");

const snapInputIds = [
  "snapLength", "snapThickness", "snapWidth", "snapDeflection", "snapModulus",
  "snapStrainLimit", "snapFriction", "snapLeadAngle", "snapRetentionAngle"
];
const snapNum = (id) => Number(document.getElementById(id).value) || 0;
const snapValues = () => Object.fromEntries(snapInputIds.map((id) => [id, snapNum(id)]));

// Fixed-point formatting without trailing zeros, e.g. 2.50 -> "2.5".
const snapFmt = (value, places = 2) => Number(value).toFixed(places).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
const snapPct = (value) => `${Number(value).toFixed(2)}%`;
const snapForce = (value) => `${snapFmt(value, value < 10 ? 2 : 1)} N`;

// Snap-fit thresholds: share of the permissible strain.
const SNAP_PASS_SHARE = 0.8;
const SNAP_MARGINAL_SHARE = 1;

// Mating force from the deflection force for a face at angle (degrees) with friction mu.
// Returns Infinity when 1 − μ·tan(angle) ≤ 0 (friction locks the face: self-locking or jamming).
const snapFaceForce = (P, mu, angleDeg) => {
  if (angleDeg >= 90) return Infinity;
  const tan = Math.tan((angleDeg * Math.PI) / 180);
  const denominator = 1 - mu * tan;
  if (denominator <= 0) return Infinity;
  return (P * (mu + tan)) / denominator;
};

// Constant rectangular section cantilever, units N, mm, MPa. This is the tool's only copy of the
// maths; the sensitivity view calls it too, so both always agree.
const snapFrom = (v) => {
  const L = Math.max(0, v.snapLength);
  const t = Math.max(0, v.snapThickness);
  const b = Math.max(0, v.snapWidth);
  const y = Math.max(0, v.snapDeflection);
  const E = Math.max(0, v.snapModulus);
  const strainLimit = Math.max(0, v.snapStrainLimit) / 100;
  const mu = Math.max(0, v.snapFriction);
  const leadAngle = Math.min(90, Math.max(0, v.snapLeadAngle));
  const retentionAngle = Math.min(90, Math.max(0, v.snapRetentionAngle));

  const strain = L > 0 ? (1.5 * t * y) / (L * L) : NaN;
  const share = strainLimit > 0 ? strain / strainLimit : NaN;
  const P = L > 0 ? ((b * t * t) / 6) * ((E * strain) / L) : NaN;
  const W = snapFaceForce(P, mu, leadAngle);
  const Wsep = snapFaceForce(P, mu, retentionAngle);
  const yMax = t > 0 && strainLimit > 0 ?(strainLimit * L * L) / (1.5 * t) : NaN;
  const status = !Number.isFinite(share) ? "info" : share <= SNAP_PASS_SHARE ? "pass" : share <= SNAP_MARGINAL_SHARE ? "warn" : "fail";
  return { L, t, b, y, E, strainLimit, mu, leadAngle, retentionAngle, strain, share, P, W, Wsep, yMax, status };
};

const renderSnapSensitivity = () => {
  window.OrionSensitivity?.render({
    after: snapBreakdown,
    title: "Which dimension matters most for root strain?",
    better: "lower",
    note: "Shown as the change in root strain, in percentage points.",
    format: (v) => `${snapFmt(v, 2)} points`,
    inputs: [
      { id: "snapLength", label: "Beam length, L" },
      { id: "snapThickness", label: "Thickness at root, t" },
      { id: "snapDeflection", label: "Deflection needed, y" }
    ],
    compute: (values) => snapFrom({ ...snapValues(), ...values }).strain * 100
  });
};

const updateSnapTool = () => {
  const r = snapFrom(snapValues());
  const valid = r.L > 0 && r.t > 0 && r.y > 0 && Number.isFinite(r.strain);
  const strainPct = r.strain * 100;
  const limitPct = r.strainLimit * 100;
  const sharePct = r.share * 100;
  const statusLabel = { pass: "Pass", warn: "Marginal", fail: "Too high", info: "Check inputs" }[valid ? r.status : "info"];
  const statusIcon = { pass: "✓", warn: "!", fail: "✗", info: "?" }[valid ? r.status : "info"];
  const sepText = Number.isFinite(r.Wsep) ? snapForce(r.Wsep) : "Self-locking";
  const assemblyText = Number.isFinite(r.W) ? snapForce(r.W) : "Jams";

  if (!valid) {
    snapSummary.innerHTML = `
      <div class="result-card"><strong>–</strong><span>Enter a beam length, thickness and deflection above zero</span></div>`;
    snapStatus.innerHTML = "";
    snapBreakdown.innerHTML = "";
    snapCopy.value = "Snap-fit check: enter a beam length, thickness and deflection above zero.";
    window.OrionInsight?.show({
      level: "info",
      headline: "Enter the beam length, thickness and deflection to check the snap fit.",
      points: []
    });
    renderSnapSensitivity();
    return;
  }

  snapSummary.innerHTML = `
    <div class="result-card"><strong>${snapPct(strainPct)}</strong><span>Strain at the root</span></div>
    <div class="result-card"><strong>${Number.isFinite(sharePct) ? `${Math.round(sharePct)}%` : "–"}</strong><span>Of the permissible strain (${snapPct(limitPct)})</span></div>
    <div class="result-card"><strong>${assemblyText}</strong><span>Assembly force</span></div>
    <div class="result-card"><strong>${sepText}</strong><span>Separation force</span></div>
  `;

  const statusDetail = {
    pass: `The root strain is ${Math.round(sharePct)}% of the permissible strain, comfortably within it.`,
    warn: `The root strain is ${Math.round(sharePct)}% of the permissible strain: close to the limit, so small variations in thickness or material could push it over.`,
    fail: `The root strain is ${Math.round(sharePct)}% of the permissible strain. The hook is likely to crack or take a permanent set.`,
    info: "Enter the permissible strain from your supplier's design data to see the status."
  }[r.status];
  snapStatus.innerHTML = `
    <div class="dfm-check dfm-check-${r.status === "info" ? "warn" : r.status}">
      <span class="dfm-badge"><span aria-hidden="true">${statusIcon}</span> ${statusLabel}</span>
      <div><strong>Root strain ${snapPct(strainPct)} against ${snapPct(limitPct)} permissible</strong><p>${statusDetail}</p></div>
    </div>`;

  snapBreakdown.innerHTML = `
    <div class="comparison-item"><span>Deflection force, P</span><strong>${snapForce(r.P)}</strong></div>
    <div class="comparison-item"><span>Assembly force, W (lead-in ${snapFmt(r.leadAngle, 1)}°)</span><strong>${Number.isFinite(r.W) ? snapForce(r.W) : "Jams: 1 − μ·tan α ≤ 0"}</strong></div>
    <div class="comparison-item"><span>Separation force, W′ (retention ${snapFmt(r.retentionAngle, 1)}°)</span><strong>${Number.isFinite(r.Wsep) ? snapForce(r.Wsep) : "Self-locking"}</strong></div>
    <div class="comparison-item"><span>Largest deflection at the permissible strain</span><strong>${Number.isFinite(r.yMax) ? `${snapFmt(r.yMax, 2)} mm` : "–"}</strong></div>
    <div class="comparison-item"><span>Deflection needed, y</span><strong>${snapFmt(r.y, 2)} mm</strong></div>`;

  const sepCopy = Number.isFinite(r.Wsep)
    ? snapForce(r.Wsep)
    : "self-locking (1 - μ·tan α′ ≤ 0): will not release without deflecting the hook by hand";
  snapCopy.value =
    `Snap-fit Check (cantilever, constant rectangular section)\n` +
    `Beam: L ${snapFmt(r.L)} mm, t ${snapFmt(r.t)} mm, b ${snapFmt(r.b)} mm; deflection y ${snapFmt(r.y)} mm\n` +
    `Material: E ${snapFmt(r.E, 0)} MPa, permissible strain ${snapFmt(limitPct)}%; friction μ ${snapFmt(r.mu)}\n` +
    `Angles: lead-in ${snapFmt(r.leadAngle, 1)}°, retention ${snapFmt(r.retentionAngle, 1)}°\n` +
    `Root strain: ${snapPct(strainPct)} (${Number.isFinite(sharePct) ? Math.round(sharePct) : "–"}% of permissible): ${statusLabel}\n` +
    `Deflection force P: ${snapForce(r.P)}\n` +
    `Assembly force W: ${Number.isFinite(r.W) ? snapForce(r.W) : "jams (1 - μ·tan α ≤ 0)"}\n` +
    `Separation force W′: ${sepCopy}\n` +
    `Largest deflection at permissible strain: ${Number.isFinite(r.yMax) ? `${snapFmt(r.yMax, 2)} mm` : "–"}`;

  renderSnapSensitivity();

  const level = { pass: "good", warn: "borderline", fail: "worrying", info: "info" }[r.status];
  const headline = {
    pass: `The root strain of ${snapPct(strainPct)} is within the permissible ${snapPct(limitPct)}, so the hook should flex without damage.`,
    warn: `The root strain of ${snapPct(strainPct)} is close to the permissible ${snapPct(limitPct)}, so there is little margin for variation.`,
    fail: `The root strain of ${snapPct(strainPct)} is above the permissible ${snapPct(limitPct)}, so the hook is likely to crack or take a set.`,
    info: `The root strain is ${snapPct(strainPct)}. Enter your supplier's permissible strain to judge it.`
  }[r.status];
  const points = [];
  if (r.status === "fail" || r.status === "warn") {
    points.push(`At this length and thickness the beam can deflect about ${snapFmt(r.yMax, 2)} mm at the permissible strain. Lengthen the beam (strain falls with its square), thin it, or reduce the undercut.`);
  } else if (r.status === "pass") {
    points.push(`The beam could deflect up to about ${snapFmt(r.yMax, 2)} mm before reaching the permissible strain, so there is room for moulding variation.`);
  }
  if (Number.isFinite(r.W)) {
    points.push(Number.isFinite(r.Wsep)
      ? `It takes about ${snapForce(r.W)} to assemble and ${snapForce(r.Wsep)} to pull apart. Check both suit the user and the loads in use.`
      : `It takes about ${snapForce(r.W)} to assemble, and the retention face is self-locking: it will not release without deflecting the hook by hand or with a tool.`);
  } else {
    points.push("The lead-in face is too steep for this friction, so the hook would jam instead of assembling. Reduce the lead-in angle.");
  }
  points.push("A tapered beam or a root radius changes the result. Treat this as a first estimate and confirm it by testing moulded parts; 3D-printed prototypes behave differently.");
  window.OrionInsight?.show({
    level,
    headline,
    points,
    next: { href: "../guides/designing-snap-fits-and-living-hinges.html", label: "Read about designing snap fits" }
  });
};

snapForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateSnapTool();
  if (window.OrionAnalytics) window.OrionAnalytics.trackEvent("calculate", { tool_name: "snap_fit_calculator" });
});
snapForm.querySelectorAll("input, select").forEach((field) => {
  field.addEventListener("input", updateSnapTool);
  field.addEventListener("change", updateSnapTool);
});
if (window.OrionAnalytics) window.OrionAnalytics.trackEvent("tool_used", { tool_name: "snap_fit_calculator" });

updateSnapTool();
