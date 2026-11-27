const dfmForm = document.getElementById("dfmForm");
const dfmSummaryRoot = document.getElementById("dfmSummary");
const dfmChecksRoot = document.getElementById("dfmChecks");
const dfmCopy = document.getElementById("dfmCopy");

// Indicative nominal wall ranges (mm) commonly quoted for unfilled grades. Always confirm with the
// material datasheet and the moulder: flow length, part size and grade change the answer.
const dfmMaterials = {
  abs: { name: "ABS", min: 1.2, max: 3.5 },
  pcabs: { name: "PC/ABS", min: 1.0, max: 3.5 },
  pc: { name: "Polycarbonate (PC)", min: 1.0, max: 3.8 },
  pp: { name: "Polypropylene (PP)", min: 0.8, max: 3.8 },
  pe: { name: "Polyethylene (HDPE)", min: 0.8, max: 5.0 },
  pa: { name: "Nylon (PA6 / PA66)", min: 0.8, max: 3.0 },
  pom: { name: "Acetal (POM)", min: 0.8, max: 3.0 },
  pmma: { name: "Acrylic (PMMA)", min: 0.8, max: 3.8 },
  tpe: { name: "TPE", min: 0.5, max: 3.0 }
};

const dfmValue = (id) => Math.max(0, Number(document.getElementById(id).value) || 0);
const fmt = (n, d = 1) => Number(n).toFixed(d).replace(/\.0+$/, "");

const updateDfmTool = () => {
  const material = dfmMaterials[document.getElementById("dfmMaterial").value] || dfmMaterials.abs;
  const wall = Math.max(0.1, dfmValue("dfmWall"));
  const thickest = Math.max(wall, dfmValue("dfmThickest"));
  const draft = dfmValue("dfmDraft");
  const textured = document.getElementById("dfmTexture").value === "yes";
  const rib = dfmValue("dfmRib");
  const ribHeight = dfmValue("dfmRibHeight");
  const hole = dfmValue("dfmBossHole");
  const bossOd = dfmValue("dfmBossOd");
  const radius = dfmValue("dfmRadius");
  const undercuts = Math.round(dfmValue("dfmUndercuts"));

  const checks = [];
  const add = (status, title, detail) => checks.push({ status, title, detail });

  // Wall thickness against the material's indicative range.
  if (wall < material.min) add("warn", `Wall ${fmt(wall)} mm is thin for ${material.name}`, `Typical guidance for ${material.name} is roughly ${fmt(material.min)}–${fmt(material.max)} mm. Thin walls can be hard to fill, especially over long flow lengths. Check with your moulder.`);
  else if (wall > material.max) add("fail", `Wall ${fmt(wall)} mm is thick for ${material.name}`, `Typical guidance is roughly ${fmt(material.min)}–${fmt(material.max)} mm. Thick walls lengthen cooling time and risk sink marks and voids; add ribs for stiffness instead.`);
  else add("pass", `Wall ${fmt(wall)} mm suits ${material.name}`, `Within the typical ${fmt(material.min)}–${fmt(material.max)} mm range. Keep it as uniform as possible.`);

  // Wall uniformity.
  const ratio = thickest / wall;
  if (ratio <= 1.25) add("pass", "Walls are close to uniform", `The thickest section is ${fmt(ratio, 2)} times the nominal wall.`);
  else if (ratio <= 1.75) add("warn", `Thickest section is ${fmt(ratio, 1)}× the nominal wall`, "Blend thickness changes gradually and core out thick areas where you can, to avoid sink and warping.");
  else add("fail", `Thickest section is ${fmt(ratio, 1)}× the nominal wall`, "A section this much thicker than the wall is likely to sink or contain voids. Core it out so it is made of walls close to the nominal thickness.");

  // Draft.
  const draftNeed = textured ? 3 : 1;
  if (draft >= draftNeed) add("pass", `${fmt(draft)}° draft`, textured ? "Adequate for many light textures; confirm the minimum with the texture supplier." : "Adequate for most smooth faces of moderate depth.");
  else if (draft >= (textured ? 1.5 : 0.5)) add("warn", `${fmt(draft)}° draft is on the low side`, textured ? "Textured faces usually need more draft, often several degrees; the texture supplier will specify a minimum." : "Fine for shallow features, but deep walls may drag on ejection. Around 1° or more is a safer starting point.");
  else add("fail", `${fmt(draft)}° draft is too little`, "Faces parallel to the tool opening need draft to release cleanly. Add at least 0.5–1° (more for deep or textured faces).");

  // Ribs.
  if (rib > 0) {
    const ribRatio = rib / wall;
    if (ribRatio >= 0.4 && ribRatio <= 0.6) add("pass", `Rib ${fmt(rib)} mm is ${Math.round(ribRatio * 100)}% of the wall`, "Within the commonly used 40–60% range.");
    else if (ribRatio > 0.6 && ribRatio <= 0.75) add("warn", `Rib ${fmt(rib)} mm is ${Math.round(ribRatio * 100)}% of the wall`, "Slightly thick: it may show a sink mark on the opposite face, especially on cosmetic surfaces. Aim for 40–60%.");
    else if (ribRatio > 0.75) add("fail", `Rib ${fmt(rib)} mm is ${Math.round(ribRatio * 100)}% of the wall`, "Thick ribs cause sink marks opposite them. Thin the rib to about 40–60% of the wall and add more ribs if you need stiffness.");
    else add("warn", `Rib ${fmt(rib)} mm is ${Math.round(ribRatio * 100)}% of the wall`, "Very thin ribs can be hard to fill and fragile. Check fill and strength with the moulder.");
    if (ribHeight > 0) {
      const h = ribHeight / wall;
      if (h <= 3) add("pass", `Rib height ${fmt(ribHeight)} mm is ${fmt(h, 1)}× the wall`, "Within the usual guidance of up to about 3× the wall.");
      else if (h <= 5) add("warn", `Rib height ${fmt(ribHeight)} mm is ${fmt(h, 1)}× the wall`, "Tall ribs are harder to fill and eject. Consider two shorter ribs, more draft, or check with the moulder.");
      else add("fail", `Rib height ${fmt(ribHeight)} mm is ${fmt(h, 1)}× the wall`, "Very tall ribs are prone to short shots, sticking and buckling. Reduce the height or redesign the stiffening.");
    }
  }

  // Bosses.
  if (hole > 0 && bossOd > 0) {
    if (bossOd <= hole) {
      add("fail", "Boss outside diameter is not larger than the hole", "Check the inputs: the boss must be larger than the hole it surrounds.");
    } else {
      const odRatio = bossOd / hole;
      const bossWall = (bossOd - hole) / 2;
      const bwRatio = bossWall / wall;
      if (odRatio >= 1.8 && odRatio <= 2.5) add("pass", `Boss diameter is ${fmt(odRatio, 1)}× the hole`, "Close to the common starting point of about twice the hole. Follow the screw maker's hole size for your plastic.");
      else add("warn", `Boss diameter is ${fmt(odRatio, 1)}× the hole`, odRatio < 1.8 ? "A thin boss may crack when the screw is driven. Check the screw maker's guidance and support the boss with gussets." : "A large boss means thick plastic around the hole. Core it out and keep the boss wall thinner than the main wall.");
      if (bwRatio <= 0.6) add("pass", `Boss wall ${fmt(bossWall, 2)} mm is ${Math.round(bwRatio * 100)}% of the wall`, "Thin enough to avoid sink on the opposite face.");
      else if (bwRatio <= 0.8) add("warn", `Boss wall ${fmt(bossWall, 2)} mm is ${Math.round(bwRatio * 100)}% of the wall`, "May cause a sink mark opposite the boss on cosmetic faces. Aim for about 60% or less, and use gussets for strength.");
      else add("fail", `Boss wall ${fmt(bossWall, 2)} mm is ${Math.round(bwRatio * 100)}% of the wall`, "A boss wall this thick is likely to sink. Reduce it and support the boss with gussets or by joining it to a nearby wall.");
    }
  }

  // Inside corner radius.
  const rRatio = radius / wall;
  if (rRatio >= 0.5) add("pass", `Inside radius ${fmt(radius)} mm is ${fmt(rRatio, 2)}× the wall`, "Meets the common guidance of at least half the wall. Make the outside radius about inside radius plus wall to keep the wall even.");
  else if (rRatio >= 0.25) add("warn", `Inside radius ${fmt(radius)} mm is ${fmt(rRatio, 2)}× the wall`, "Small radii concentrate stress and restrict flow. Increase towards half the wall where you can.");
  else add("fail", radius === 0 ? "Sharp inside corners" : `Inside radius ${fmt(radius)} mm is very small`, "Sharp inside corners concentrate stress and can crack. Add radii of at least about half the wall.");

  // Undercuts.
  if (undercuts === 0) add("pass", "No undercuts", "The part can pull straight out of the tool, which keeps the tool simpler and cheaper.");
  else if (undercuts <= 2) add("warn", `${undercuts} undercut${undercuts > 1 ? "s" : ""}`, "Each usually needs a side action, lifter or other moving tool part, adding cost and maintenance. Check whether a pass-through core or a redesign could remove it.");
  else add("fail", `${undercuts} undercuts`, "Several undercuts make the tool considerably more complex. Review each one; many can be designed out.");

  const counts = { pass: 0, warn: 0, fail: 0 };
  checks.forEach((c) => (counts[c.status] += 1));

  dfmSummaryRoot.innerHTML = `
    <div class="result-card"><strong>${counts.pass}</strong><span>Checks passed</span></div>
    <div class="result-card"><strong>${counts.warn}</strong><span>Worth a closer look</span></div>
    <div class="result-card"><strong>${counts.fail}</strong><span>Likely problems</span></div>
  `;

  const label = { pass: "OK", warn: "Check", fail: "Fix" };
  dfmChecksRoot.innerHTML = checks
    .map((c) => `
      <div class="dfm-check dfm-check-${c.status}">
        <span class="dfm-badge">${label[c.status]}</span>
        <div><strong>${c.title}</strong><p>${c.detail}</p></div>
      </div>`)
    .join("");

  if (dfmCopy) {
    dfmCopy.value =
      `Injection Moulding DFM Check (${material.name}, ${fmt(wall)} mm nominal wall)\n` +
      `Passed: ${counts.pass}, worth a closer look: ${counts.warn}, likely problems: ${counts.fail}\n` +
      checks.map((c) => `- [${label[c.status]}] ${c.title}`).join("\n");
  }

  const fails = checks.filter((c) => c.status === "fail");
  const warns = checks.filter((c) => c.status === "warn");
  window.OrionInsight?.show({
    level: fails.length ? "worrying" : warns.length ? "borderline" : "good",
    headline: fails.length
      ? `${fails.length} feature${fails.length > 1 ? "s are" : " is"} likely to cause moulding problems: fix ${fails.length > 1 ? "them" : "it"} on the CAD model before asking for tooling quotes.`
      : warns.length
        ? `No obvious problems, but ${warns.length} feature${warns.length > 1 ? "s are" : " is"} worth discussing with your moulder.`
        : "These features follow common injection-moulding guidance.",
    points: [
      fails[0] ? `Start with: ${fails[0].title.toLowerCase()}.` : warns[0] ? `Start with: ${warns[0].title.toLowerCase()}.` : "",
      "These are rules of thumb. Ask shortlisted moulders for a DFM review and, for complex parts, a mould-flow analysis.",
      "Uniform walls and draft matter most; they affect sink marks, warping, cycle time and how easily parts release."
    ],
    next: { href: "../guides/injection-moulding-dfm-checklist.html", label: "Read the full injection moulding DFM checklist" }
  });
};

dfmForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateDfmTool();
  if (window.OrionAnalytics) {
    window.OrionAnalytics.trackEvent("calculate", { tool_name: "dfm_checker", material: document.getElementById("dfmMaterial").value });
  }
});
dfmForm.querySelectorAll("input, select").forEach((field) => {
  field.addEventListener("input", updateDfmTool);
  field.addEventListener("change", updateDfmTool);
});
if (window.OrionAnalytics) {
  window.OrionAnalytics.trackEvent("tool_used", { tool_name: "dfm_checker" });
}

updateDfmTool();
