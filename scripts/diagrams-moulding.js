/* Interactive moulding diagrams for the injection moulding guides.
   1. Injection moulding cycle explainer (#ixm-cycle on injection-moulding-explained.html)
   2. Draft angle and undercut cross-section (#ixm-draft on injection-moulding-dfm-checklist.html)
   Progressive enhancement: the static figures work without JavaScript. This script
   reveals the controls and does nothing on pages without the diagrams. */
(function () {
  "use strict";

  /* ---------- Draft and undercut geometry (shared with the static markup) ---------- */
  var DRAFT = {
    PL: 320,        // parting line (part rim when moulded)
    H: 100,         // part height
    T: 12,          // wall thickness
    LIFT: 40,       // how far the part is drawn pushed off the core
    LEFT: 110,      // outer left of rim
    RIGHT: 330,     // outer right of rim
    EXAG: 8         // the drawn angle is this many times the real draft angle
  };

  function f(n) { return Math.round(n * 10) / 10; }

  function draftGeometry(angle, undercut) {
    var d = DRAFT;
    var tan = Math.tan((angle * d.EXAG * Math.PI) / 180);
    var inset = d.H * tan;               // outer wall inset at the top of the part
    var innerTopY = d.PL - d.H + d.T;    // underside of the part's top wall (= top of core)
    var innerInset = (d.H - d.T) * tan;
    var iL = d.LEFT + d.T, iR = d.RIGHT - d.T;
    var xIn = function (y) { return iR - (d.PL - y) * tan; }; // right inner wall x at height y
    // Snap catch on the inside of the right wall, near the rim
    var yA = d.PL - 30, yD = d.PL - 12;
    var hook = [[xIn(yA), yA], [xIn(yA) - 14, yA + 6], [xIn(yD) - 14, yD], [xIn(yD), yD]];
    var pts = function (arr, dy) {
      return arr.map(function (p) { return "L" + f(p[0]) + "," + f(p[1] + (dy || 0)); }).join(" ");
    };

    var cavity = "M70,30 H370 V140 H" + f(d.RIGHT) + " L" + f(d.RIGHT - inset) + ",40 H" + f(d.LEFT + inset) +
      " L" + f(d.LEFT) + ",140 H70 Z";

    var coreRight = undercut ? pts(hook) + " " : "";
    var core = "M70,390 V" + d.PL + " H" + iL + " L" + f(iL + innerInset) + "," + innerTopY +
      " H" + f(iR - innerInset) + " " + coreRight + "L" + iR + "," + d.PL + " H370 V390 Z";

    var L = d.LIFT;
    var partHook = undercut ? pts(hook.slice().reverse(), -L) + " " : "";
    var part = "M" + d.LEFT + "," + (d.PL - L) + " L" + f(d.LEFT + inset) + "," + (d.PL - d.H - L) +
      " H" + f(d.RIGHT - inset) + " L" + d.RIGHT + "," + (d.PL - L) + " H" + iR + " " + partHook +
      "L" + f(iR - innerInset) + "," + (innerTopY - L) + " H" + f(iL + innerInset) + " L" + iL + "," + (d.PL - L) + " Z";

    var clash = "M" + hook.map(function (p) { return f(p[0]) + "," + f(p[1] - L); }).join(" L") + " Z";

    // Contact (scuff) lines where the lifted part still overlaps the core's side walls
    var scuffTop = innerTopY, scuffBottom = d.PL - L;
    var scuff = "M" + iL + "," + scuffTop + " V" + scuffBottom + " M" + iR + "," + scuffTop + " V" + scuffBottom;

    // Draft reference line and angle marker on the left outer wall
    var ref = "M" + d.LEFT + "," + (d.PL - L) + " V" + (d.PL - d.H - L);

    return { cavity: cavity, core: core, part: part, clash: clash, scuff: scuff, ref: ref };
  }

  function draftStatus(angle, undercut) {
    if (undercut) return { line1: "Undercut: the catch locks the part on", bad: true };
    if (angle === 0) return { line1: "No draft (0°): walls drag on the core", bad: true };
    if (angle < 1) return { line1: "Light draft (" + angle + "°): marginal release", bad: false };
    return { line1: "Draft " + angle + "°: the part releases cleanly", bad: false };
  }

  function draftMessage(angle, undercut) {
    var msg;
    if (undercut) {
      msg = angle === 0
        ? "At 0° the walls would drag on the core anyway, and the snap catch makes it worse."
        : "With " + angle + "° of draft the walls themselves would release, but the snap catch still holds the part on.";
      return msg + " The catch is an undercut: it locks into the core, so the part cannot be pushed straight off. It needs a side action, a lifter or a design change, such as a hole through the wall so a core can pass through and form the catch, or a feature that flexes off. Moving tool parts add tooling cost.";
    }
    if (angle === 0) {
      msg = "At 0° the walls stay in contact with the core all the way out, so the part drags and can scuff, stick or distort on ejection.";
    } else if (angle < 1) {
      msg = "At " + angle + "° the walls clear the core as soon as the part moves. This can work for shallow, polished features, but check it with your moulder.";
    } else if (angle <= 2) {
      msg = "At " + angle + "° a small gap opens as soon as the part moves, so it releases cleanly. Around 1° to 2° is a common starting point for many plastics; deep or textured faces usually need more.";
    } else {
      msg = "At " + angle + "° the part releases easily. More draft like this is often needed on textured surfaces; the texture supplier usually specifies a minimum.";
    }
    return msg;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { draftGeometry: draftGeometry, draftStatus: draftStatus };
    return;
  }

  /* ---------- 1. Injection moulding cycle ---------- */
  var STAGES = [
    {
      name: "Clamp",
      happens: "The moving half of the tool closes against the fixed half, and the machine clamps them together hard enough to stay shut against the injection pressure.",
      control: "The part's projected area (its footprint seen in the direction the tool opens) sets the clamp force needed, and so the size of machine. A simple parting line helps the tool seal.",
      time: "A small, fairly fixed share of the cycle, set mostly by the machine and how far the tool has to travel."
    },
    {
      name: "Inject",
      happens: "The screw pushes molten plastic through the nozzle, runners and gate into the cavity. Filling usually takes seconds or less.",
      control: "Gate position, wall thickness and flow length. Thin walls over long distances are harder to fill, and material choice affects how easily the plastic flows.",
      time: "Usually a short part of the cycle. Hard-to-fill parts need higher pressure or speed rather than much more time."
    },
    {
      name: "Pack and hold",
      happens: "Pressure is held after the cavity is full, pushing in a little more plastic to make up for shrinkage until the gate freezes.",
      control: "Even wall thickness, and gating into or near the thicker sections. Isolated thick features are hard to pack and cause sink marks and voids.",
      time: "Lasts until the gate freezes off, so thick gates and thick sections extend it."
    },
    {
      name: "Cool",
      happens: "The part cools against the water-cooled tool until it is stiff enough to eject. Meanwhile the screw melts the plastic for the next shot.",
      control: "Above all, the thickest wall. Material and the tool's cooling layout (the toolmaker's job) matter too.",
      time: "Usually the longest step. As a rule of thumb, cooling time rises roughly with the square of wall thickness, so doubling the thickest wall can roughly quadruple it. Coring out thick sections is one of the most effective ways to cut part cost."
    },
    {
      name: "Open",
      happens: "The moving half pulls back from the fixed half. Any side actions or lifters move out of the way of undercuts.",
      control: "Undercuts that need side actions or lifters add movements and tool cost. Deep parts need the tool to open further.",
      time: "Short, but every movement adds to every cycle. Side actions add a little more."
    },
    {
      name: "Eject",
      happens: "Ejector pins push the part off the core and it drops or is picked out by a robot. The tool closes and the cycle repeats.",
      control: "Draft on walls in the opening direction, flat areas for ejector pins on non-cosmetic faces, and no undercuts that lock the part on.",
      time: "Short when parts release cleanly. Too little draft makes parts stick, which slows the cycle and risks marks or damage."
    }
  ];

  function initCycle(root) {
    var svg = root.querySelector("svg");
    var groups = svg ? svg.querySelectorAll(".ixm-stage") : [];
    var controls = root.querySelector(".ixm-controls");
    var row = root.querySelector(".ixm-stage-row");
    var panel = root.querySelector(".ixm-panel");
    var playBtn = root.querySelector(".ixm-play");
    if (!svg || groups.length !== STAGES.length || !controls || !row || !panel || !playBtn) return;

    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var current = -1;
    var timer = null;
    var buttons = [];

    STAGES.forEach(function (stage, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "ixm-btn";
      b.textContent = (i + 1) + ". " + stage.name;
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () { stop(); select(i); });
      row.appendChild(b);
      buttons.push(b);
      groups[i].addEventListener("click", function () { stop(); select(i); });
    });

    var heading = panel.querySelector(".ixm-panel-title");
    var list = panel.querySelector(".ixm-panel-list");
    var fields = {
      happens: panel.querySelector("[data-field='happens']"),
      control: panel.querySelector("[data-field='control']"),
      time: panel.querySelector("[data-field='time']")
    };

    function select(i) {
      current = i;
      var s = STAGES[i];
      buttons.forEach(function (b, j) { b.setAttribute("aria-pressed", j === i ? "true" : "false"); });
      Array.prototype.forEach.call(groups, function (g, j) { g.classList.toggle("ixm-stage-on", j === i); });
      heading.textContent = "Step " + (i + 1) + " of 6: " + s.name;
      fields.happens.textContent = s.happens;
      fields.control.textContent = s.control;
      fields.time.textContent = s.time;
      list.hidden = false;
    }

    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
      if (!reduce) playBtn.textContent = "Play the cycle";
    }

    if (reduce) {
      playBtn.textContent = "Next step";
      playBtn.addEventListener("click", function () { select((current + 1) % STAGES.length); });
    } else {
      playBtn.addEventListener("click", function () {
        if (timer) { stop(); return; }
        playBtn.textContent = "Pause";
        var played = 0;
        select(current >= STAGES.length - 1 || current < 0 ? 0 : current + 1);
        timer = setInterval(function () {
          played += 1;
          if (current >= STAGES.length - 1 || played >= STAGES.length) { stop(); return; }
          select(current + 1);
        }, 3000);
      });
    }

    controls.hidden = false;
    root.classList.add("ixm-ready");
  }

  /* ---------- 2. Draft angle and undercut ---------- */
  function initDraft(root) {
    var controls = root.querySelector(".ixm-controls");
    var slider = root.querySelector(".ixm-range");
    var output = root.querySelector(".ixm-draft-value");
    var toggle = root.querySelector(".ixm-undercut");
    var live = root.querySelector(".ixm-live");
    var el = function (id) { return root.querySelector("[data-ixm='" + id + "']"); };
    var parts = { cavity: el("cavity"), core: el("core"), part: el("part"), clash: el("clash"), scuff: el("scuff"), ref: el("ref"),
      status: el("status"), clashLabel: el("clash-label"), clashLeader: el("clash-leader") };
    if (!controls || !slider || !toggle || !live || !parts.part || !parts.core) return;

    function update() {
      var angle = parseFloat(slider.value) || 0;
      var undercut = toggle.checked;
      var g = draftGeometry(angle, undercut);
      ["cavity", "core", "part", "clash", "scuff", "ref"].forEach(function (k) { if (parts[k]) parts[k].setAttribute("d", g[k]); });
      var st = draftStatus(angle, undercut);
      if (parts.status) {
        parts.status.textContent = st.line1;
        parts.status.setAttribute("class", "ixm-svg-status " + (st.bad ? "ixm-svg-bad" : "ixm-svg-good"));
      }
      if (parts.scuff) parts.scuff.classList.toggle("ixm-off", angle !== 0);
      [parts.clash, parts.clashLabel, parts.clashLeader].forEach(function (n) { if (n) n.classList.toggle("ixm-off", !undercut); });
      if (output) output.textContent = angle.toFixed(1) + "°";
      slider.setAttribute("aria-valuetext", angle.toFixed(1) + " degrees");
      live.textContent = draftMessage(angle, undercut);
    }

    slider.addEventListener("input", update);
    toggle.addEventListener("change", update);
    controls.hidden = false;
    root.classList.add("ixm-ready");
    update();
  }

  function init() {
    var cycle = document.getElementById("ixm-cycle");
    if (cycle) initCycle(cycle);
    var draft = document.getElementById("ixm-draft");
    if (draft) initDraft(draft);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
