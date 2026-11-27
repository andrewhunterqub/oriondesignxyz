const heatForm = document.getElementById("heatForm");
const heatSummary = document.getElementById("heatSummary");
const heatStatus = document.getElementById("heatStatus");
const heatBreakdown = document.getElementById("heatBreakdown");
const heatCopy = document.getElementById("heatCopy");
const heatAreaMode = document.getElementById("heatAreaMode");
const heatAreaGroup = document.getElementById("heatAreaGroup");
const heatDimsGroup = document.getElementById("heatDimsGroup");

const heatInputIds = [
  "heatPower", "heatAmbient", "heatTarget", "heatRjc", "heatRpad", "heatRextra",
  "heatLength", "heatWidth", "heatArea", "heatH"
];
const heatNum = (id) => Number(document.getElementById(id).value) || 0;
const heatValues = () => ({
  ...Object.fromEntries(heatInputIds.map((id) => [id, heatNum(id)])),
  heatAreaMode: heatAreaMode.value === "area" ? "area" : "dims"
});

// Fixed-point formatting without trailing zeros, e.g. 2.50 -> "2.5".
const heatFmt = (value, places = 2) => Number(value).toFixed(places).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
const heatDeg = (value) => `${heatFmt(value, 1)} °C`;
const heatRes = (value) => `${heatFmt(value, 2)} °C/W`;
const heatWatts = (value) => `${heatFmt(value, value < 10 ? 2 : 1)} W`;
const heatSquareMetres = (value) => `${heatFmt(value, 4)} m²`;

// Status thresholds: share of the rise the target allows (target − ambient).
const HEAT_PASS_SHARE = 0.8;
const HEAT_MARGINAL_SHARE = 1;

// Steady-state, single series path. This is the tool's only copy of the maths;
// the sensitivity view calls it too, so both always agree.
const heatFrom = (v) => {
  const P = Math.max(0, v.heatPower);
  const Ta = v.heatAmbient;
  const Tt = v.heatTarget;
  const Rjc = Math.max(0, v.heatRjc);
  const Rpad = Math.max(0, v.heatRpad);
  const Rextra = Math.max(0, v.heatRextra);
  const h = Math.max(0, v.heatH);
  const A = v.heatAreaMode === "area"
    ? Math.max(0, v.heatArea)
    : (Math.max(0, v.heatLength) * Math.max(0, v.heatWidth)) / 1e6;

  const Rsurface = h > 0 && A > 0 ? 1 / (h * A) : NaN;
  const Rinternal = Rjc + Rpad + Rextra;
  const R = Rinternal + Rsurface;
  const dT = P * R;
  const Tcomp = Ta + dT;
  const Tsurface = Ta + P * Rsurface;
  const allowedRise = Tt - Ta;
  const margin = Tt - Tcomp;
  const share = allowedRise > 0 ? dT / allowedRise : NaN;
  const Pmax = allowedRise > 0 && R > 0 ? allowedRise / R : 0;
  // Surface resistance the target allows once the internal steps are paid for.
  const RsurfaceAllowed = P > 0 ? allowedRise / P - Rinternal : NaN;
  const Aneeded = h > 0 && RsurfaceAllowed > 0 ? 1 / (h * RsurfaceAllowed) : NaN;
  const status = allowedRise <= 0 ? "fail" : share <= HEAT_PASS_SHARE ? "pass" : share <= HEAT_MARGINAL_SHARE ? "warn" : "fail";
  return { P, Ta, Tt, Rjc, Rpad, Rextra, h, A, Rsurface, Rinternal, R, dT, Tcomp, Tsurface, allowedRise, margin, share, Pmax, RsurfaceAllowed, Aneeded, status };
};

const syncHeatAreaMode = () => {
  const byArea = heatAreaMode.value === "area";
  heatAreaGroup.hidden = !byArea;
  heatDimsGroup.hidden = byArea;
};

const renderHeatSensitivity = () => {
  const byArea = heatAreaMode.value === "area";
  window.OrionSensitivity?.render({
    after: heatBreakdown,
    title: "Which input matters most for component temperature?",
    better: "lower",
    note: byArea ? "" : "Area is moved by changing the surface length, with the width held.",
    format: (v) => `${heatFmt(v, 1)} °C`,
    inputs: [
      { id: "heatPower", label: "Power dissipated, P" },
      { id: "heatH", label: "Coefficient, h" },
      { id: byArea ? "heatArea" : "heatLength", label: "Surface area, A" }
    ],
    compute: (values) => heatFrom({ ...heatValues(), ...values }).Tcomp
  });
};

const updateHeatTool = () => {
  syncHeatAreaMode();
  const r = heatFrom(heatValues());
  // An empty ambient or target would otherwise be read as 0 °C and give a misleading status.
  const tempsEntered = ["heatAmbient", "heatTarget"].every((id) => document.getElementById(id).value.trim() !== "");
  const valid = tempsEntered && r.P > 0 && Number.isFinite(r.Rsurface);

  if (!valid) {
    heatSummary.innerHTML = `
      <div class="result-card"><strong>–</strong><span>Enter the ambient and target temperatures, and a power, surface area and coefficient h above zero</span></div>`;
    heatStatus.innerHTML = "";
    heatBreakdown.innerHTML = "";
    heatCopy.value = "Enclosure temperature rise: enter the ambient and target temperatures, and a power, surface area and coefficient h above zero.";
    window.OrionInsight?.show({
      level: "info",
      headline: "Enter the power, temperatures, surface area and coefficient h to estimate the temperature.",
      points: []
    });
    renderHeatSensitivity();
    return;
  }

  const statusLabel = { pass: "Pass", warn: "Marginal", fail: "Over target" }[r.status];
  const statusIcon = { pass: "✓", warn: "!", fail: "✗" }[r.status];
  const marginText = r.margin >= 0 ? `${heatDeg(r.margin)} under` : `${heatDeg(-r.margin)} over`;
  const sharePct = Number.isFinite(r.share) ? Math.round(r.share * 100) : NaN;
  const pmaxText = r.allowedRise > 0 ? heatWatts(r.Pmax) : "None: target at or below ambient";
  const areaNeededText = Number.isFinite(r.Aneeded)
    ? `${heatSquareMetres(r.Aneeded)} (about ${heatFmt(Math.sqrt(r.Aneeded) * 1000, 0)} × ${heatFmt(Math.sqrt(r.Aneeded) * 1000, 0)} mm)`
    : "Not reachable by area alone";

  heatSummary.innerHTML = `
    <div class="result-card"><strong>${heatDeg(r.Tcomp)}</strong><span>Estimated component temperature</span></div>
    <div class="result-card"><strong>${marginText}</strong><span>Margin to your ${heatDeg(r.Tt)} target</span></div>
    <div class="result-card"><strong>${heatDeg(r.dT)}</strong><span>Temperature rise, ΔT = P × Rθ</span></div>
    <div class="result-card"><strong>${heatRes(r.R)}</strong><span>Total thermal resistance, Rθ</span></div>
  `;

  const statusDetail = r.allowedRise <= 0
    ? `The target is at or below the ${heatDeg(r.Ta)} ambient, so there is no room for any rise. Check the target and ambient.`
    : {
        pass: `The rise uses ${sharePct}% of the ${heatDeg(r.allowedRise)} your target allows, leaving ${heatDeg(r.margin)} of margin.`,
        warn: `The rise uses ${sharePct}% of the ${heatDeg(r.allowedRise)} your target allows. It is under the target, but with little room for a higher power, a thicker pad or a hotter day.`,
        fail: `The rise uses ${sharePct}% of the ${heatDeg(r.allowedRise)} your target allows, so the component is likely to run ${heatDeg(-r.margin)} too hot.`
      }[r.status];
  heatStatus.innerHTML = `
    <div class="dfm-check dfm-check-${r.status}">
      <span class="dfm-badge"><span aria-hidden="true">${statusIcon}</span> ${statusLabel}</span>
      <div><strong>${heatDeg(r.Tcomp)} against a ${heatDeg(r.Tt)} target</strong><p>${statusDetail}</p></div>
    </div>`;

  const areaInput = heatAreaMode.value === "area"
    ? heatSquareMetres(r.A)
    : `${heatFmt(heatNum("heatLength"), 1)} × ${heatFmt(heatNum("heatWidth"), 1)} mm = ${heatSquareMetres(r.A)}`;
  heatBreakdown.innerHTML = `
    <div class="comparison-item"><span>Surface area, A</span><strong>${areaInput}</strong></div>
    <div class="comparison-item"><span>Surface to air, 1 ÷ (h × A)</span><strong>${heatRes(r.Rsurface)}</strong></div>
    <div class="comparison-item"><span>Component to case + pad + extra path</span><strong>${heatRes(r.Rinternal)}</strong></div>
    <div class="comparison-item"><span>Total thermal resistance, Rθ</span><strong>${heatRes(r.R)}</strong></div>
    <div class="comparison-item"><span>Temperature rise, ΔT = ${heatWatts(r.P)} × ${heatRes(r.R)}</span><strong>${heatDeg(r.dT)}</strong></div>
    <div class="comparison-item"><span>Component temperature, ${heatDeg(r.Ta)} ambient + ΔT</span><strong>${heatDeg(r.Tcomp)}</strong></div>
    <div class="comparison-item"><span>Maximum power for the target</span><strong>${pmaxText}</strong></div>
    <div class="comparison-item"><span>Surface area needed for the target</span><strong>${areaNeededText}</strong></div>
    <div class="comparison-item"><span>Outer surface temperature (rough; check touch limits in your standard)</span><strong>${heatDeg(r.Tsurface)}</strong></div>`;

  heatCopy.value =
    `Enclosure Temperature Rise Estimate (steady state, single path)\n` +
    `Power P: ${heatWatts(r.P)}; ambient ${heatDeg(r.Ta)}; target ${heatDeg(r.Tt)}\n` +
    `Resistances: component to case ${heatRes(r.Rjc)}, pad and contact ${heatRes(r.Rpad)}, extra path ${heatRes(r.Rextra)}\n` +
    `Surface: ${areaInput}, h ${heatFmt(r.h, 2)} W/m²·°C\n` +
    `Surface to air 1/(h·A): ${heatRes(r.Rsurface)}\n` +
    `Total Rθ: ${heatRes(r.R)}\n` +
    `Temperature rise ΔT: ${heatDeg(r.dT)}\n` +
    `Component temperature: ${heatDeg(r.Tcomp)}: ${statusLabel}\n` +
    `Margin to target: ${marginText}\n` +
    `Maximum power for target: ${pmaxText}\n` +
    `Surface area needed: ${areaNeededText}\n` +
    `Outer surface temperature (rough): ${heatDeg(r.Tsurface)}`;

  renderHeatSensitivity();

  const level = { pass: "good", warn: "borderline", fail: "worrying" }[r.status];
  const headline = {
    pass: `At about ${heatDeg(r.Tcomp)}, the component should stay below your ${heatDeg(r.Tt)} target with room to spare.`,
    warn: `At about ${heatDeg(r.Tcomp)}, the component is just under your ${heatDeg(r.Tt)} target, with little margin.`,
    fail: `At about ${heatDeg(r.Tcomp)}, the component is likely to run over your ${heatDeg(r.Tt)} target.`
  }[r.status];
  const points = [];
  const largest = [
    ["the surface to air", r.Rsurface],
    ["the pad and contact surfaces", r.Rpad],
    ["the component-to-case step", r.Rjc],
    ["the extra path", r.Rextra]
  ].sort((a, b) => b[1] - a[1])[0];
  points.push(`The largest resistance is ${largest[0]}, at ${heatRes(largest[1])} of the ${heatRes(r.R)} total, so improving it helps most.`);
  if (r.allowedRise > 0) {
    points.push(Number.isFinite(r.Aneeded)
      ? `The design can take about ${heatWatts(r.Pmax)} before reaching the target, and needs about ${heatSquareMetres(r.Aneeded)} of surface at this h.`
      : `The design can take about ${heatWatts(r.Pmax)}. The internal resistances alone use up the rise the target allows, so no surface area can fix it: lower the power or the internal resistances.`);
  }
  points.push("This is a steady-state, single-path estimate with no sunshine. Confirm it with thermocouples on a prototype at your worst-case ambient and load.");
  window.OrionInsight?.show({
    level,
    headline,
    points,
    next: { href: "../guides/managing-heat-in-a-product-enclosure.html", label: "Read about managing heat in an enclosure" }
  });
};

heatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateHeatTool();
  if (window.OrionAnalytics) window.OrionAnalytics.trackEvent("calculate", { tool_name: "temperature_rise_estimator" });
});
// Carry the current surface across when the area mode changes, so the hidden field is not stale.
// Registered before the generic listeners so the recalculation uses the carried value.
heatAreaMode.addEventListener("change", () => {
  const length = heatNum("heatLength");
  const width = heatNum("heatWidth");
  const area = heatNum("heatArea");
  if (heatAreaMode.value === "area") {
    if (length > 0 && width > 0) document.getElementById("heatArea").value = heatFmt((length * width) / 1e6, 6);
  } else if (area > 0) {
    // Keep the width and set the length to give the same area.
    const keptWidth = width > 0 ? width : Math.sqrt(area) * 1000;
    document.getElementById("heatWidth").value = heatFmt(keptWidth, 1);
    document.getElementById("heatLength").value = heatFmt((area * 1e6) / keptWidth, 1);
  }
});
heatForm.querySelectorAll("input, select").forEach((field) => {
  field.addEventListener("input", updateHeatTool);
  field.addEventListener("change", updateHeatTool);
});
if (window.OrionAnalytics) window.OrionAnalytics.trackEvent("tool_used", { tool_name: "temperature_rise_estimator" });

updateHeatTool();
