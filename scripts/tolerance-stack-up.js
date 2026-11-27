// Stack-up diagram: draws the chain and the resulting gap from the values updateStackTool()
// has already computed (it calls window.OrionToleranceDiagram.render at the end).
(() => {
  const figure = document.getElementById("stackDiagram");
  const svg = document.getElementById("stackDiagramSvg");
  const caption = document.getElementById("stackDiagramCaption");
  if (!figure || !svg || !caption) return;

  const fmt = (value) => `${Number(value).toFixed(3).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "").replace(/^-/, "−")} mm`;
  const esc = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const text = (x, y, cls, body, anchor = "start") => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="${cls}" text-anchor="${anchor}">${esc(body)}</text>`;
  const rect = (x, y, w, h, cls) => `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(0, w).toFixed(1)}" height="${h.toFixed(1)}" class="${cls}"></rect>`;
  const line = (x1, y1, x2, y2, cls) => `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="${cls}"></line>`;
  // Rough text width at 12px, used only to keep labels inside the drawing.
  const textWidth = (body) => body.length * 6.6;

  const niceStep = (span, target) => {
    const raw = span / target;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const norm = raw / mag;
    return (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  };

  let last = null;

  const draw = (data) => {
    const W = Math.max(280, Math.round(svg.getBoundingClientRect().width) || 480);
    const L = 6;
    const R = 6;
    const plotW = W - L - R;
    const { dims } = data;
    let out = "";
    let y = 0;

    if (!dims.length) {
      const H = 60;
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      svg.innerHTML = text(L, 34, "ixt-text ixt-muted", "Enter the dimensions in the stack to draw the diagram.");
      return;
    }

    // 1. The chain of dimensions, to scale by nominal.
    let pos = 0;
    const segs = dims.map((d) => {
      const start = pos;
      pos += d.sign * d.nominal;
      return { ...d, start, end: pos };
    });
    const ends = [0, ...segs.map((s) => s.end)];
    const lo = Math.min(...ends);
    const hi = Math.max(...ends);
    const sx = plotW / (hi - lo || 1);
    const cx = (v) => L + (v - lo) * sx;
    const maxTol = Math.max(...dims.map((d) => d.tol));
    const maxTolPx = maxTol * sx;
    const k = maxTol > 0 && maxTolPx < 8 ? Math.ceil(8 / maxTolPx) : 1;

    y = 16;
    out += text(L, y, "ixt-text ixt-heading", "Chain of dimensions (lengths to scale)");
    y += 8;
    const chainTop = y;
    const rowH = 38;

    segs.forEach((s, i) => {
      const ry = chainTop + i * rowH;
      const xs = cx(s.start);
      const xe = cx(s.end);
      const tone = s.sign > 0 ? "plus" : "minus";
      const label = `${s.key}  ${s.sign > 0 ? "+" : "−"}${fmt(s.nominal).replace(" mm", "")} ± ${fmt(s.tol)}`;
      const left = Math.min(xs, xe);
      const fits = left + 4 + textWidth(label) <= W - R;
      out += text(fits ? left + 4 : W - R, ry + 15, `ixt-text ixt-text-${tone}`, label, fits ? "start" : "end");
      const ly = ry + 26;
      out += line(xs, ly, xe, ly, `ixt-seg ixt-seg-${tone}`);
      out += line(xs, ly - 5, xs, ly + 5, `ixt-seg ixt-seg-${tone}`);
      if (Math.abs(xe - xs) > 6) {
        const dir = s.sign > 0 ? -1 : 1;
        out += `<polygon points="${xe},${ly} ${xe + dir * 7},${ly - 4} ${xe + dir * 7},${ly + 4}" class="ixt-arrow-${tone}"></polygon>`;
      }
      if (s.tol > 0) {
        const half = s.tol * sx * k;
        out += rect(xe - half, ly - 7, half * 2, 14, `ixt-band ixt-band-${tone}`);
      }
      if (i < segs.length - 1) out += line(xe, ly + 5, xe, ly + rowH - 5, "ixt-guide");
    });

    y = chainTop + segs.length * rowH;
    // Datum line and nominal gap bracket.
    out += line(cx(0), chainTop + 2, cx(0), y + 30, "ixt-datum");
    const gx1 = Math.min(cx(0), cx(data.nominal));
    const gx2 = Math.max(cx(0), cx(data.nominal));
    const gy = y + 24;
    out += line(gx1, gy, Math.max(gx2, gx1 + 1), gy, "ixt-gapline");
    out += line(cx(data.nominal), y - 8, cx(data.nominal), gy + 4, "ixt-guide");
    const gapLabel = `Nominal gap ${fmt(data.nominal)} (datum to end of chain)`;
    const gLeft = gx1 + 4 + textWidth(gapLabel) > W - R ? Math.max(L, W - R - textWidth(gapLabel)) : gx1 + 4;
    out += text(gLeft, y + 12, "ixt-text ixt-text-gap", gapLabel);
    y = gy + 18;
    if (k > 1) {
      out += text(L, y, "ixt-text ixt-muted", `Tolerance bands drawn ×${k} so they are visible.`);
      y += 8;
    }

    // 2. The resulting gap, zoomed in.
    y += 24;
    out += text(L, y, "ixt-text ixt-heading", "Resulting gap (zoomed in)");
    y += 10;
    const values = [data.wcMin, data.wcMax, data.minGap];
    if (data.maxGap > 0) values.push(data.maxGap);
    const vlo = Math.min(...values);
    const vhi = Math.max(...values);
    const span = vhi - vlo || Math.max(Math.abs(vhi), 1);
    const dlo = vlo - span * 0.12;
    const dhi = vhi + span * 0.12;
    const gxs = (v) => L + ((v - dlo) / (dhi - dlo)) * plotW;
    const zx1 = gxs(data.minGap);
    const zx2 = data.maxGap > 0 ? gxs(data.maxGap) : W - R;
    // Limit labels on their own strip, so they never sit on top of the bar labels.
    const minLabel = `min ${fmt(data.minGap)}`;
    const minFits = zx1 + 4 + textWidth(minLabel) <= (data.maxGap > 0 ? zx2 - 70 : W - R);
    out += text(minFits ? zx1 + 4 : zx1 - 4, y + 12, "ixt-text ixt-small ixt-text-limit", minLabel, minFits ? "start" : "end");
    if (data.maxGap > 0) {
      const maxLabel = `max ${fmt(data.maxGap)}`;
      const maxFits = zx2 + 4 + textWidth(maxLabel) <= W - R;
      out += text(maxFits ? zx2 + 4 : zx2 - 4, y + 12, "ixt-text ixt-small ixt-text-limit", maxLabel, maxFits ? "start" : "end");
    }
    const limitTop = y;
    y += 18;
    const rows = [
      { name: "Worst case", min: data.wcMin, max: data.wcMax, ok: data.wcOk, cls: "wc" },
      { name: "Statistical (RSS)", min: data.rssMin, max: data.rssMax, ok: data.rssOk, cls: "rss" }
    ];
    const bands = [];
    rows.forEach((row) => {
      const range = `${fmt(row.min)} to ${fmt(row.max)}`;
      const status = row.ok ? "meets requirement" : "misses requirement";
      const oneLine = `${row.name}: ${range} · ${status}`;
      if (textWidth(oneLine) <= plotW) {
        out += text(L, y + 12, `ixt-text ixt-text-${row.cls}`, oneLine);
        y += 18;
      } else {
        out += text(L, y + 12, `ixt-text ixt-text-${row.cls}`, `${row.name}: ${range}`);
        out += text(L, y + 27, "ixt-text ixt-small ixt-muted", status);
        y += 33;
      }
      const bandTop = y;
      out += rect(zx1, bandTop, zx2 - zx1, 26, "ixt-zone");
      const bx1 = gxs(row.min);
      const bx2 = gxs(row.max);
      const by = bandTop + 5;
      out += rect(bx1, by, Math.max(bx2 - bx1, 2), 16, `ixt-bar ixt-bar-${row.cls}`);
      // Portions outside the requirement.
      if (row.min < data.minGap) out += rect(bx1, by, Math.min(bx2, zx1) - bx1, 16, "ixt-bar-out");
      if (data.maxGap > 0 && row.max > data.maxGap) {
        const ox = Math.max(bx1, zx2);
        out += rect(ox, by, bx2 - ox, 16, "ixt-bar-out");
      }
      bands.push(bandTop);
      y += 34;
    });
    // Limit and nominal lines run through the bar bands only.
    const nx = gxs(data.nominal);
    out += line(zx1, limitTop, zx1, limitTop + 16, "ixt-limit");
    if (data.maxGap > 0) out += line(zx2, limitTop, zx2, limitTop + 16, "ixt-limit");
    bands.forEach((top) => {
      out += line(zx1, top, zx1, top + 26, "ixt-limit");
      if (data.maxGap > 0) out += line(zx2, top, zx2, top + 26, "ixt-limit");
      out += line(nx, top + 1, nx, top + 25, "ixt-nominal");
    });
    y -= 4;
    // Axis.
    out += line(L, y, W - R, y, "ixt-axis");
    const step = niceStep(dhi - dlo, W < 420 ? 4 : 6);
    const places = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
    for (let t = Math.ceil(dlo / step) * step; t <= dhi + 1e-9; t += step) {
      const tx = gxs(t);
      out += line(tx, y, tx, y + 5, "ixt-axis");
      out += text(tx, y + 18, "ixt-text ixt-small ixt-muted", (Math.abs(t) < step / 1e6 ? 0 : t).toFixed(places).replace(/^-/, "−"), "middle");
    }
    out += text(W - R, y + 34, "ixt-text ixt-small ixt-muted", "gap (mm) · vertical line = nominal", "end");
    const H = Math.ceil(y + 42);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.innerHTML =
      `<defs><pattern id="ixtHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
      `<rect width="6" height="6" class="ixt-hatch-bg"></rect><rect width="3" height="6" class="ixt-hatch-line"></rect></pattern></defs>` +
      out;
  };

  const describe = (data) => {
    if (!data.dims.length) return "Enter the dimensions in the stack to draw the diagram.";
    const small = data.wcMin < 0 ? `${fmt(data.wcMin)}, meaning the parts would clash,` : fmt(data.wcMin);
    const req = `gap of at least ${fmt(data.minGap)}${data.maxGap > 0 ? ` and no more than ${fmt(data.maxGap)}` : ""}`;
    const verdict = data.wcOk
      ? `Both ranges stay within the required ${req}.`
      : data.rssOk
        ? `Only the statistical range stays within the required ${req}.`
        : `Neither range stays within the required ${req}.`;
    return `Worst case the gap could be as small as ${small} and as large as ${fmt(data.wcMax)}; statistically, most assemblies fall between ${fmt(data.rssMin)} and ${fmt(data.rssMax)}. ${verdict}`;
  };

  window.OrionToleranceDiagram = {
    render(data) {
      last = data;
      figure.hidden = false;
      draw(data);
      const sentence = describe(data);
      if (caption.textContent !== sentence) caption.textContent = sentence;
    }
  };

  if ("ResizeObserver" in window) {
    let width = 0;
    new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width);
      if (last && w && w !== width) {
        width = w;
        draw(last);
      }
    }).observe(figure);
  }
})();

const stackForm = document.getElementById("stackForm");
const stackSummaryRoot = document.getElementById("stackSummary");
const stackBreakdownRoot = document.getElementById("stackBreakdown");
const stackCopy = document.getElementById("stackCopy");
const stackRows = ["A", "B", "C", "D", "E", "F"];

const mm = (value, places = 3) => `${Number(value).toFixed(places).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")} mm`;
const stackNum = (id) => Number(document.getElementById(id).value) || 0;

const updateStackTool = () => {
  const dims = stackRows
    .map((key) => ({
      key,
      sign: document.getElementById(`stackDir${key}`).value === "minus" ? -1 : 1,
      nominal: Math.max(0, stackNum(`stackNom${key}`)),
      tol: Math.max(0, stackNum(`stackTol${key}`))
    }))
    .filter((d) => d.nominal > 0 || d.tol > 0);
  const minGap = stackNum("stackMinGap");
  const maxGap = stackNum("stackMaxGap");

  const nominal = dims.reduce((sum, d) => sum + d.sign * d.nominal, 0);
  const worst = dims.reduce((sum, d) => sum + d.tol, 0);
  const rss = Math.sqrt(dims.reduce((sum, d) => sum + d.tol * d.tol, 0));
  const wcMin = nominal - worst;
  const wcMax = nominal + worst;
  const rssMin = nominal - rss;
  const rssMax = nominal + rss;
  const meets = (low, high) => low >= minGap && (maxGap <= 0 || high <= maxGap);
  const wcOk = meets(wcMin, wcMax);
  const rssOk = meets(rssMin, rssMax);
  const biggest = dims.slice().sort((a, b) => b.tol - a.tol)[0];
  const biggestShare = biggest && rss > 0 ? (biggest.tol * biggest.tol) / (rss * rss) : 0;

  stackSummaryRoot.innerHTML = `
    <div class="result-card"><strong>${mm(nominal)}</strong><span>Nominal gap</span></div>
    <div class="result-card"><strong>${mm(wcMin)} to ${mm(wcMax)}</strong><span>Worst-case range</span></div>
    <div class="result-card"><strong>${mm(rssMin)} to ${mm(rssMax)}</strong><span>Statistical (RSS) range</span></div>
  `;

  stackBreakdownRoot.innerHTML =
    dims
      .map((d) => `
      <div class="comparison-item">
        <span>Dimension ${d.key} (${d.sign > 0 ? "adds to" : "reduces"} the gap)</span>
        <strong>${d.sign > 0 ? "+" : "−"}${mm(d.nominal)} ± ${mm(d.tol)}</strong>
      </div>`)
      .join("") +
    `
      <div class="comparison-item">
        <span>Worst-case tolerance (sum of tolerances)</span>
        <strong>± ${mm(worst)}</strong>
      </div>
      <div class="comparison-item">
        <span>RSS tolerance (root sum of squares)</span>
        <strong>± ${mm(rss)}</strong>
      </div>
      <div class="comparison-item">
        <span>Requirement</span>
        <strong>gap ≥ ${mm(minGap)}${maxGap > 0 ? ` and ≤ ${mm(maxGap)}` : ""}</strong>
      </div>
      <div class="comparison-item">
        <span>Worst case meets requirement?</span>
        <strong>${wcOk ? "Yes" : "No"}</strong>
      </div>
      <div class="comparison-item">
        <span>RSS meets requirement?</span>
        <strong>${rssOk ? "Yes" : "No"}</strong>
      </div>`;

  if (stackCopy) {
    stackCopy.value =
      `Tolerance Stack-up\n` +
      dims.map((d) => `Dimension ${d.key}: ${d.sign > 0 ? "+" : "-"}${d.nominal} mm ± ${d.tol} mm`).join("\n") +
      `\nNominal gap: ${mm(nominal)}\n` +
      `Worst case: ${mm(wcMin)} to ${mm(wcMax)} (± ${mm(worst)})\n` +
      `RSS: ${mm(rssMin)} to ${mm(rssMax)} (± ${mm(rss)})\n` +
      `Requirement: gap >= ${mm(minGap)}${maxGap > 0 ? ` and <= ${mm(maxGap)}` : ""}\n` +
      `Worst case meets requirement: ${wcOk ? "yes" : "no"}; RSS meets requirement: ${rssOk ? "yes" : "no"}`;
  }

  let level;
  let headline;
  if (!dims.length) {
    level = "info";
    headline = "Enter the dimensions in the stack to see the result.";
  } else if (wcOk) {
    level = "good";
    headline = "The gap meets the requirement even if every part is at its tolerance limit.";
  } else if (rssOk) {
    level = "borderline";
    headline = "The gap meets the requirement statistically, but not in the worst case: a small share of assemblies could fail.";
  } else {
    level = "worrying";
    headline = "Even the statistical estimate does not meet the requirement, so some assemblies are likely to fail; the further outside the requirement, the larger the share.";
  }
  window.OrionInsight?.show({
    level,
    headline,
    points: dims.length
      ? [
          biggest && biggestShare > 0.4
            ? `Dimension ${biggest.key} contributes about ${Math.round(biggestShare * 100)}% of the statistical variation; tightening or removing it would help most.`
            : "The variation is spread across several dimensions; reducing the number of parts in the stack often helps more than tightening each one.",
          "RSS assumes independent, centred, roughly normal variation in reasonable volumes. For few parts, safety-critical fits or biased processes, design to the worst case.",
          wcOk ? "Check the opposite limit too: a gap that is always open may rattle, leak or look uneven." : "Options: change the nominal gap, tighten the critical tolerances, reduce the number of parts in the chain, or add an adjustable or compliant feature."
        ]
      : [],
    next: { href: "../guides/injection-moulding-dfm-checklist.html", label: "Check which tolerances your process can realistically hold" }
  });

  window.OrionToleranceDiagram?.render({ dims, nominal, worst, rss, wcMin, wcMax, rssMin, rssMax, minGap, maxGap, wcOk, rssOk });
};

stackForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateStackTool();
  if (window.OrionAnalytics) window.OrionAnalytics.trackEvent("calculate", { tool_name: "tolerance_stack_up" });
});
stackForm.querySelectorAll("input, select").forEach((field) => {
  field.addEventListener("input", updateStackTool);
  field.addEventListener("change", updateStackTool);
});
if (window.OrionAnalytics) window.OrionAnalytics.trackEvent("tool_used", { tool_name: "tolerance_stack_up" });

updateStackTool();
