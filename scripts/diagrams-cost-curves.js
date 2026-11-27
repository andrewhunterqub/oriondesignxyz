// Cost-curve explorer for guides/manufacturing-processes-compared.html.
// Does nothing on any page without #costCurveExplorer. Figures are illustrative for one small plastic part, not quotes.
(() => {
  const root = document.getElementById("costCurveExplorer");
  if (!root) return;
  const svg = document.getElementById("costCurveChart");
  const volumeInput = document.getElementById("costCurveVolume");
  const volumeOut = document.getElementById("costCurveVolumeOut");
  const toolInput = document.getElementById("costCurveTool");
  const toolOut = document.getElementById("costCurveToolOut");
  const summary = document.getElementById("costCurveSummary");
  const controls = document.getElementById("costCurveControls");
  if (!svg || !volumeInput || !toolInput || !summary || !controls) return;

  const VOLUMES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
  const sym = () => (window.OrionCurrency ? window.OrionCurrency.symbol() : "£");
  const money = (v) => `${sym()}${v >= 100 ? Math.round(v).toLocaleString("en-GB") : v.toFixed(2)}`;
  const count = (v) => Math.round(v).toLocaleString("en-GB");

  // Illustrative cost per part at volume n.
  const processes = [
    { key: "print", label: "3D printing", lower: "3D printing", cls: "ixt-line-print", cost: () => 14 },
    { key: "cnc", label: "CNC machining", lower: "CNC machining", cls: "ixt-line-cnc", cost: (n) => 250 / n + 22 },
    { key: "cast", label: "Vacuum casting", lower: "vacuum casting", cls: "ixt-line-cast", cost: (n) => (1000 + Math.max(0, Math.ceil(n / 25) - 1) * 250) / n + 6 },
    { key: "mould", label: "Injection moulding", lower: "injection moulding", cls: "ixt-line-mould", cost: (n, tool) => tool / n + 0.8 }
  ];

  const el = (tag, attrs, body = "") =>
    `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${typeof v === "number" ? v.toFixed(1) : v}"`).join(" ")}>${body}</${tag}>`;

  const draw = (volume, tool) => {
    const W = Math.max(280, Math.round(svg.getBoundingClientRect().width) || 560);
    const H = 280, L = 46, R = 10, T = 20, B = 40;
    const plotW = W - L - R, plotH = H - T - B;
    const xMin = Math.log10(10), xMax = Math.log10(100000);
    const yMin = Math.log10(0.5), yMax = Math.log10(2000);
    const sx = (n) => L + ((Math.log10(n) - xMin) / (xMax - xMin)) * plotW;
    const sy = (v) => T + plotH - ((Math.log10(Math.min(Math.max(v, 0.5), 2000)) - yMin) / (yMax - yMin)) * plotH;
    let out = "";
    [1, 10, 100, 1000].forEach((t) => {
      out += el("line", { x1: L, y1: sy(t), x2: W - R, y2: sy(t), class: "ixt-gridline" });
      out += el("text", { x: L - 6, y: sy(t) + 4, class: "ixt-text ixt-small ixt-muted", "text-anchor": "end" }, `${sym()}${t.toLocaleString("en-GB")}`);
    });
    [10, 100, 1000, 10000, 100000].forEach((n) => {
      out += el("text", { x: sx(n), y: H - B + 16, class: "ixt-text ixt-small ixt-muted", "text-anchor": "middle" }, n >= 1000 ? `${n / 1000}k` : String(n));
    });
    out += el("line", { x1: L, y1: T + plotH, x2: W - R, y2: T + plotH, class: "ixt-axis" });
    out += el("text", { x: L + plotW / 2, y: H - 6, class: "ixt-text ixt-small ixt-muted", "text-anchor": "middle" }, "Parts made (log scale)");
    out += el("text", { x: 4, y: 12, class: "ixt-text ixt-small ixt-muted" }, "Cost per part (log scale)");
    processes.forEach((p) => {
      const pts = [];
      for (let i = 0; i <= 80; i += 1) {
        const n = Math.pow(10, xMin + ((xMax - xMin) * i) / 80);
        pts.push(`${sx(n).toFixed(1)},${sy(p.cost(n, tool)).toFixed(1)}`);
      }
      out += el("polyline", { points: pts.join(" "), class: `ixt-line ${p.cls}`, fill: "none" });
    });
    out += el("line", { x1: sx(volume), y1: T, x2: sx(volume), y2: T + plotH, class: "ixt-datum" });
    processes.forEach((p) => {
      out += el("circle", { cx: sx(volume), cy: sy(p.cost(volume, tool)), r: 4, class: `ixt-dot ${p.cls}` });
    });
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.innerHTML = out;
  };

  const describe = (volume, tool) => {
    const ranked = processes.map((p) => ({ ...p, value: p.cost(volume, tool) })).sort((a, b) => a.value - b.value);
    const best = ranked[0];
    const crossover = tool / (14 - 0.8);
    return `At ${count(volume)} parts, with a ${money(tool)} mould, ${best.lower} is cheapest at about ${money(best.value)} a part, ` +
      `against ${ranked.slice(1).map((r) => `${r.lower} ${money(r.value)}`).join(", ")}. ` +
      `In this example injection moulding becomes cheaper than 3D printing above about ${count(crossover)} parts; a cheaper mould moves that point lower.`;
  };

  const update = () => {
    const volume = VOLUMES[Number(volumeInput.value)] || 1000;
    const tool = Number(toolInput.value) || 12000;
    if (volumeOut) volumeOut.value = `${count(volume)} parts`;
    if (toolOut) toolOut.value = money(tool);
    draw(volume, tool);
    summary.textContent = describe(volume, tool);
  };

  controls.hidden = false;
  svg.removeAttribute("hidden");
  document.getElementById("costCurveLegend")?.removeAttribute("hidden");
  volumeInput.addEventListener("input", update);
  toolInput.addEventListener("input", update);
  if ("ResizeObserver" in window) {
    let width = 0;
    new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width);
      if (w && w !== width) { width = w; update(); }
    }).observe(root);
  }
  update();
})();
