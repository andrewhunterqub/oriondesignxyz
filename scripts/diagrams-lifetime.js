// Product lifetime explorer for guides/why-product-lifetime-matters-more-than-recycling.html.
// Does nothing on any page without #lifetimeExplorer. Figures are illustrative, not measured data.
(() => {
  const root = document.getElementById("lifetimeExplorer");
  if (!root) return;

  const svg = document.getElementById("lifetimeChart");
  const yearsInput = document.getElementById("lifetimeYears");
  const yearsOut = document.getElementById("lifetimeYearsOut");
  const recycledInput = document.getElementById("lifetimeRecycled");
  const summary = document.getElementById("lifetimeSummary");
  const controls = document.getElementById("lifetimeControls");
  if (!svg || !yearsInput || !recycledInput || !summary || !controls) return;

  // Illustrative figures, consistent with Design A in the worked example on this page.
  const EMBODIED = 40; // kg CO2e to make and dispose of the product
  const RECYCLED_CUT = 0.1; // recycled material cuts the embodied impact by a tenth
  const USE_PER_YEAR = 2; // kg CO2e per year in use
  const MAX_YEARS = 15;
  const AXIS_MAX = 45;

  const kg = (v) => (Math.round(v * 10) / 10).toFixed(1);
  const pct = (v) => `${Math.round(v * 100)}%`;
  const embodied = (recycled) => EMBODIED * (recycled ? 1 - RECYCLED_CUT : 1);
  const perYear = (years, recycled) => embodied(recycled) / years + USE_PER_YEAR;
  const yearWord = (n) => `${n}-year`;

  const el = (tag, attrs, body = "") =>
    `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${typeof v === "number" ? v.toFixed(1) : v}"`).join(" ")}>${body}</${tag}>`;

  const draw = () => {
    const years = Number(yearsInput.value) || 1;
    const recycled = recycledInput.checked;
    const W = Math.max(280, Math.round(svg.getBoundingClientRect().width) || 560);
    const H = 260;
    const L = 34;
    const R = 6;
    const T = 26;
    const B = 40;
    const plotW = W - L - R;
    const plotH = H - T - B;
    const sy = (v) => T + plotH - (v / AXIS_MAX) * plotH;
    const slot = plotW / MAX_YEARS;
    const barW = Math.min(30, slot * 0.68);
    const doubled = years * 2;
    let out = "";

    for (let t = 0; t <= AXIS_MAX; t += 10) {
      out += el("line", { x1: L, y1: sy(t), x2: W - R, y2: sy(t), class: t === 0 ? "ixt-axis" : "ixt-gridline" });
      out += el("text", { x: L - 6, y: sy(t) + 4, class: "ixt-text ixt-small ixt-muted", "text-anchor": "end" }, String(t));
    }
    out += el("text", { x: L - 30, y: 12, class: "ixt-text ixt-small ixt-muted" }, "kg CO2e per year of use");

    for (let n = 1; n <= MAX_YEARS; n += 1) {
      const x = L + slot * (n - 1) + (slot - barW) / 2;
      const emb = embodied(recycled) / n;
      const selected = n === years;
      const state = selected ? "ixt-bar-selected" : "ixt-bar-faded";
      out += `<g class="${state}">`;
      out += el("rect", { x, y: sy(emb), width: barW, height: sy(0) - sy(emb), class: "ixt-fill-embodied" });
      out += el("rect", { x, y: sy(emb + USE_PER_YEAR), width: barW, height: sy(0) - sy(USE_PER_YEAR), class: "ixt-fill-use" });
      out += "</g>";
      if (recycled && selected) {
        const virgin = EMBODIED / n + USE_PER_YEAR;
        out += el("rect", { x, y: sy(virgin), width: barW, height: sy(emb + USE_PER_YEAR) - sy(virgin), class: "ixt-ghost" });
      }
      if (n === doubled) {
        const top = sy(perYear(n, recycled));
        out += el("rect", { x: x - 3, y: top - 3, width: barW + 6, height: sy(0) - top + 3, class: "ixt-double" });
        out += el("text", { x: x + barW / 2, y: top - 8, class: "ixt-text ixt-small ixt-text-minus", "text-anchor": "middle" }, "2×");
      }
      if (selected) {
        const top = recycled ? sy(EMBODIED / n + USE_PER_YEAR) : sy(perYear(n, recycled));
        const label = kg(perYear(n, recycled));
        const lx = Math.min(Math.max(x + barW / 2, L + 14), W - R - 14);
        out += el("text", { x: lx, y: Math.max(top - 8, T - 6), class: "ixt-text ixt-strong", "text-anchor": "middle" }, label);
      }
      out += el("text", { x: x + barW / 2, y: H - B + 16, class: `ixt-text ixt-small ${selected ? "ixt-strong" : "ixt-muted"}`, "text-anchor": "middle" }, String(n));
    }
    out += el("text", { x: L + plotW / 2, y: H - 6, class: "ixt-text ixt-small ixt-muted", "text-anchor": "middle" }, "Years of use");

    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.innerHTML = out;
    svg.setAttribute(
      "aria-label",
      `Illustrative stacked bar chart of impact per year of use for lives of 1 to 15 years. ` +
        `At ${years} ${years === 1 ? "year" : "years"}${recycled ? " with recycled material" : ""}: ${kg(perYear(years, recycled))} kg CO2e per year, ` +
        `of which ${kg(embodied(recycled) / years)} kg is the share of making the product and ${kg(USE_PER_YEAR)} kg is use.`
    );
  };

  const describe = () => {
    const years = Number(yearsInput.value) || 1;
    const recycled = recycledInput.checked;
    const current = perYear(years, recycled);
    const doubledValue = perYear(years * 2, recycled);
    const doubleSaving = (current - doubledValue) / current;
    const lead =
      `For this illustrative product${recycled ? " made with recycled material" : ""}, a ${yearWord(years)} life works out at about ` +
      `${kg(current)} kg CO2e per year of use (${kg(embodied(recycled) / years)} from making it, ${kg(USE_PER_YEAR)} from use).`;
    let compare;
    if (recycled) {
      const virgin = perYear(years, false);
      compare =
        ` Recycled material saves ${pct((virgin - current) / virgin)} against virgin material at the same life; ` +
        `doubling the life to ${years * 2} years would save ${pct(doubleSaving)}, bringing it to ${kg(doubledValue)} kg.`;
    } else {
      const recycledValue = perYear(years, true);
      compare =
        ` Doubling the life to ${years * 2} years would bring that to ${kg(doubledValue)} kg (${pct(doubleSaving)} lower); ` +
        `switching to recycled material instead would bring it to ${kg(recycledValue)} kg (${pct((current - recycledValue) / current)} lower).`;
    }
    const tail = years >= 8 ? " At long lives the yearly use impact starts to dominate, so further gains come mostly from using less energy." : "";
    return lead + compare + tail;
  };

  const update = () => {
    const years = Number(yearsInput.value) || 1;
    if (yearsOut) yearsOut.value = `${years} ${years === 1 ? "year" : "years"}`;
    draw();
    summary.textContent = describe();
  };

  controls.hidden = false;
  svg.removeAttribute("hidden");
  document.getElementById("lifetimeLegend")?.removeAttribute("hidden");
  yearsInput.addEventListener("input", update);
  recycledInput.addEventListener("change", update);
  if ("ResizeObserver" in window) {
    let width = 0;
    new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width);
      if (w && w !== width) {
        width = w;
        draw();
      }
    }).observe(root);
  }
  update();
})();
