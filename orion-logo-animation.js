/* qa:self-styled — styles live in the shadow DOM below.
 *
 * <orion-logo-animation> — animated Orion Design mark.
 *
 * The mark is one continuous stroke: an O and a D that also read as a
 * planet with something launching from it into orbit. The animation tells
 * that story in four beats:
 *
 *   1. Planet   — the O and the inner bowl of the D draw out from the point
 *                 where they meet.
 *   2. Ignition — a glow builds at the foot of the D's spine.
 *   3. Launch   — the spine draws upward, accelerating, with an exhaust trail.
 *   4. Orbit    — the stroke swings over the top into the big outer arc,
 *                 decelerating, and closes the loop at the base of the O.
 *
 * Afterwards a small satellite light keeps circling the closed path (turn off
 * with orbit="off").
 *
 * Usage:
 *   <script src="/orion-logo-animation.js" defer></script>
 *   <orion-logo-animation style="width:160px"></orion-logo-animation>
 *
 * Attributes:
 *   trigger   "view" (default) plays when scrolled into view,
 *             "load" plays immediately, "manual" waits for .play().
 *   replay    "hover" | "click" | "none" (default "click").
 *   orbit     "on" (default) | "off" — idle satellite after the launch.
 *   theme     "light" (default) | "dark" — lifts the darkest colours so the
 *             mark reads on dark backgrounds.
 *   wordmark  present → shows the ORION DESIGN lockup beside the mark.
 *   label     accessible name (default "Orion Design").
 *
 * Respects prefers-reduced-motion: the finished logo is shown, no motion.
 */
(function () {
  "use strict";

  if (typeof window === "undefined" || !window.customElements) return;
  if (customElements.get("orion-logo-animation")) return;

  var NS = "http://www.w3.org/2000/svg";

  // Geometry taken from images/brand/orion-design-logo-mark.svg (1181 × 1181).
  var X = 542.31;
  var STROKE = 86.05;
  var SPINE_TOP = 72.25;
  var SPINE_BOTTOM = 915.85;
  var D_CY = 590.6; // centre of the outer arc and inner bowl
  var D_R = 518.35;
  var BOWL_R = 325.25;
  var O_CY = 687.2;
  var O_R = 421.8;

  function polar(cx, cy, r, deg) {
    var a = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }
  function pt(p) {
    return p[0].toFixed(2) + "," + p[1].toFixed(2);
  }

  // Each segment is a separate path so it can be timed and coloured on its
  // own. Neighbouring arcs overlap by a degree or two to avoid hairline seams.
  var oStart = polar(X, O_CY, O_R, -88.5);
  var oLeft = polar(X, O_CY, O_R, 180);
  var oBottom = polar(X, O_CY, O_R, 90);
  var PATH_O =
    "M" + pt(oStart) +
    " A" + O_R + "," + O_R + " 0 0 0 " + pt(oLeft) +
    " A" + O_R + "," + O_R + " 0 0 0 " + pt(oBottom);

  var PATH_BOWL =
    "M" + pt([X, D_CY - BOWL_R]) +
    " A" + BOWL_R + "," + BOWL_R + " 0 0 1 " + pt([X + BOWL_R, D_CY]) +
    " A" + BOWL_R + "," + BOWL_R + " 0 0 1 " + pt([X, D_CY + BOWL_R]);

  var PATH_SPINE = "M" + pt([X, SPINE_BOTTOM]) + " L" + pt([X, SPINE_TOP]);

  var PATH_OUTER =
    "M" + pt([X, SPINE_TOP]) +
    " A" + D_R + "," + D_R + " 0 0 1 " + pt([X + D_R, D_CY]) +
    " A" + D_R + "," + D_R + " 0 0 1 " + pt(polar(X, D_CY, D_R, 91.5));

  // The whole mark as one closed loop, for the idle satellite.
  var PATH_LOOP =
    "M" + pt([X, SPINE_BOTTOM]) + " L" + pt([X, SPINE_TOP]) +
    " A" + D_R + "," + D_R + " 0 0 1 " + pt([X + D_R, D_CY]) +
    " A" + D_R + "," + D_R + " 0 0 1 " + pt([X, D_CY + D_R]) +
    " A" + O_R + "," + O_R + " 0 0 1 " + pt(oLeft) +
    " A" + O_R + "," + O_R + " 0 0 1 " + pt([X, O_CY - O_R]) +
    " A" + BOWL_R + "," + BOWL_R + " 0 0 1 " + pt([X + BOWL_R, D_CY]) +
    " A" + BOWL_R + "," + BOWL_R + " 0 0 1 " + pt([X, D_CY + BOWL_R]) + " Z";

  // Brand colours sampled from the raster logo.
  var PALETTES = {
    light: {
      o: ["#10122a", "#1c2a4e", "#2e4a85"],
      bowl: ["#2f4f92", "#386da6", "#3d9aaa"],
      spine: ["#3fb3ab", "#3760a8", "#a5225f"],
      outer: ["#a22a6c", "#661b46", "#1e1530"],
      wordmark: "#111111"
    },
    dark: {
      o: ["#2c3a6e", "#34508f", "#3e64a8"],
      bowl: ["#3e64a8", "#3f7fb8", "#43b0b0"],
      spine: ["#46c2b8", "#4471bd", "#c22d76"],
      outer: ["#c22d76", "#8e2a68", "#4a2a6a"],
      wordmark: "#ffffff"
    }
  };

  // Timeline (ms). The launch eases in and the orbit eases out; the orbit
  // duration is chosen so speed is continuous where the two meet:
  //   3·Lspine/T_launch = 3·Louter/T_orbit
  var T_PLANET = 1000;
  var T_IGNITE = 420;
  var T_LAUNCH = 760;
  var L_SPINE = SPINE_BOTTOM - SPINE_TOP;
  var L_OUTER = Math.PI * D_R * (181.5 / 180);
  var T_ORBIT = Math.round((T_LAUNCH * L_OUTER) / L_SPINE);
  var T_SETTLE = 700;

  var t0Ignite = T_PLANET;
  var t0Launch = t0Ignite + T_IGNITE;
  var t0Orbit = t0Launch + T_LAUNCH;
  var tLanded = t0Orbit + T_ORBIT;
  var tEnd = tLanded + T_SETTLE;

  var SATELLITE_PERIOD = 11000;

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function easeInCubic(t) {
    return t * t * t;
  }
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function hexToRgb(h) {
    var n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(h1, h2, t) {
    var a = hexToRgb(h1);
    var b = hexToRgb(h2);
    return (
      "rgb(" +
      Math.round(lerp(a[0], b[0], t)) + "," +
      Math.round(lerp(a[1], b[1], t)) + "," +
      Math.round(lerp(a[2], b[2], t)) + ")"
    );
  }

  function el(name, attrs, parent) {
    var node = document.createElementNS(NS, name);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  var uid = 0;

  var STYLE =
    ":host{display:inline-block;line-height:0;-webkit-tap-highlight-color:transparent}" +
    ":host([wordmark]){display:inline-flex;align-items:center;gap:.9em;line-height:1}" +
    ".mark{display:block;width:100%;height:auto;overflow:visible}" +
    ":host([wordmark]) .mark{width:auto;height:var(--orion-mark-size,4.2em);flex:none}" +
    ":host([replay=click]) .mark,:host(:not([replay])) .mark{cursor:pointer}" +
    ".wm{display:none;font-family:var(--orion-wordmark-font,\"Century Gothic\",\"Futura\",\"Avenir Next\",Arial,sans-serif);" +
    "color:var(--orion-wordmark-color,currentColor);text-transform:uppercase;white-space:nowrap}" +
    ":host([wordmark]) .wm{display:block}" +
    ".wm span{display:block;letter-spacing:.42em;margin-right:-.42em;opacity:0;transform:translateX(-.6em);" +
    "transition:opacity .7s ease,transform .9s cubic-bezier(.2,.7,.2,1)}" +
    ".wm .w1{font-weight:700;font-size:1.55em}" +
    ".wm .w2{font-weight:300;font-size:1.55em;transition-delay:.12s}" +
    ".wm.on span{opacity:1;transform:none}" +
    "@media (prefers-reduced-motion:reduce){.wm span{transition:none}}";

  class OrionLogoAnimation extends HTMLElement {
    constructor() {
      super();
      this._id = "orion" + ++uid;
      this._raf = 0;
      this._start = 0;
      this._particles = [];
      this._lastFrame = 0;
      this._built = false;
      this._playing = false;
      this._finished = false;
      this._tick = this._tick.bind(this);
    }

    static get observedAttributes() {
      return ["theme", "label"];
    }

    connectedCallback() {
      if (!this._built) this._build();
      this._reducedMotion =
        window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (this._reducedMotion) {
        this._showFinal();
        return;
      }

      this._render(0);
      var trigger = this.getAttribute("trigger") || "view";
      if (trigger === "load") {
        this.play();
      } else if (trigger === "view") {
        if ("IntersectionObserver" in window) {
          var self = this;
          this._io = new IntersectionObserver(
            function (entries) {
              if (entries[0].isIntersecting) {
                self._io.disconnect();
                self._io = null;
                self.play();
              }
            },
            { threshold: 0.4 }
          );
          this._io.observe(this);
        } else {
          this.play();
        }
      }
    }

    disconnectedCallback() {
      if (this._io) this._io.disconnect();
      cancelAnimationFrame(this._raf);
      this._raf = 0;
    }

    attributeChangedCallback() {
      if (!this._built) return;
      this._applyPalette();
      this._svg.setAttribute("aria-label", this.getAttribute("label") || "Orion Design");
    }

    /** Play (or replay) the launch sequence from the start. */
    play() {
      if (this._reducedMotion) {
        this._showFinal();
        return;
      }
      this._clearParticles();
      this._satStart = 0;
      this._playing = true;
      this._finished = false;
      this._wm.classList.remove("on");
      this._start = performance.now();
      this._lastFrame = this._start;
      if (!this._raf) this._raf = requestAnimationFrame(this._tick);
    }

    _build() {
      this._built = true;
      var root = this.attachShadow({ mode: "open" });
      var style = document.createElement("style");
      style.textContent = STYLE;
      root.appendChild(style);

      var id = this._id;
      var svg = el("svg", {
        class: "mark",
        viewBox: "0 0 1181 1181",
        role: "img",
        "aria-label": this.getAttribute("label") || "Orion Design"
      });
      this._svg = svg;
      var defs = el("defs", {}, svg);

      function grad(name, x1, y1, x2, y2) {
        var g = el("linearGradient", {
          id: id + name, gradientUnits: "userSpaceOnUse",
          x1: x1, y1: y1, x2: x2, y2: y2
        }, defs);
        return [0, 0.5, 1].map(function (o) {
          return el("stop", { offset: o }, g);
        });
      }
      this._stops = {
        o: grad("o", X, O_CY + O_R, X - 200, O_CY - O_R),
        bowl: grad("bowl", X, D_CY - BOWL_R, X, D_CY + BOWL_R),
        spine: grad("spine", X, SPINE_BOTTOM, X, SPINE_TOP),
        outer: grad("outer", X + 140, SPINE_TOP, X - 60, D_CY + D_R)
      };

      // Soft glow used by the rocket head, exhaust and satellite.
      var glow = el("radialGradient", { id: id + "glow" }, defs);
      el("stop", { offset: 0, "stop-color": "#ffffff", "stop-opacity": 1 }, glow);
      this._glowMid = el("stop", { offset: 0.35, "stop-color": "#7fe3d8", "stop-opacity": 0.75 }, glow);
      this._glowEdge = el("stop", { offset: 1, "stop-color": "#36b7a7", "stop-opacity": 0 }, glow);

      var flare = el("radialGradient", { id: id + "flare" }, defs);
      el("stop", { offset: 0, "stop-color": "#ffffff", "stop-opacity": 0.9 }, flare);
      el("stop", { offset: 0.4, "stop-color": "#ffffff", "stop-opacity": 0.25 }, flare);
      el("stop", { offset: 1, "stop-color": "#ffffff", "stop-opacity": 0 }, flare);

      var common = {
        fill: "none",
        "stroke-width": STROKE,
        "stroke-linecap": "butt",
        "stroke-linejoin": "miter"
      };
      function strokePath(d, gid, parent) {
        return el("path", Object.assign({ d: d, stroke: "url(#" + id + gid + ")" }, common), parent);
      }

      this._planet = el("g", {}, svg);
      this._pO = strokePath(PATH_O, "o", this._planet);
      this._pBowl = strokePath(PATH_BOWL, "bowl", this._planet);
      this._pSpine = strokePath(PATH_SPINE, "spine", svg);
      this._pOuter = strokePath(PATH_OUTER, "outer", svg);

      // The original path has mitred 90° corners where the spine meets the
      // bowl (bottom) and the outer arc (top). Butt-capped segments leave a
      // notch there, so fill each corner with a small square.
      var h = STROKE / 2;
      this._cornerBottom = el("rect", {
        x: X - h, y: SPINE_BOTTOM - h, width: STROKE, height: STROKE
      }, svg);
      this._cornerTop = el("rect", {
        x: X - h, y: SPINE_TOP - h, width: STROKE, height: STROKE
      }, svg);
      // Keep the bottom square beneath the spine's gradient.
      svg.insertBefore(this._cornerBottom, this._pSpine);

      this._fx = el("g", { "pointer-events": "none" }, svg);
      this._ring = el("circle", {
        cx: X, cy: D_CY, r: D_R, fill: "none", stroke: "#ffffff",
        "stroke-width": 10, opacity: 0
      }, this._fx);
      this._exhaust = el("g", {}, this._fx);
      this._halo = el("circle", { r: 150, fill: "url(#" + id + "glow)", opacity: 0 }, this._fx);
      this._head = el("circle", { r: 54, fill: "url(#" + id + "glow)", opacity: 0 }, this._fx);
      this._flare = el("circle", { cx: X, cy: D_CY + D_R, r: 160, fill: "url(#" + id + "flare)", opacity: 0 }, this._fx);

      this._loop = el("path", { d: PATH_LOOP, fill: "none", stroke: "none" }, svg);
      this._sat = el("g", { opacity: 0 }, this._fx);
      el("circle", { r: 70, fill: "url(#" + id + "glow)", opacity: 0.55 }, this._sat);
      el("circle", { r: 13, fill: "#ffffff" }, this._sat);

      root.appendChild(svg);

      var wm = document.createElement("div");
      wm.className = "wm";
      wm.setAttribute("aria-hidden", "true");
      wm.innerHTML = '<span class="w1">Orion</span><span class="w2">Design</span>';
      root.appendChild(wm);
      this._wm = wm;

      this._len = {
        o: this._pO.getTotalLength(),
        bowl: this._pBowl.getTotalLength(),
        spine: this._pSpine.getTotalLength(),
        outer: this._pOuter.getTotalLength(),
        loop: this._loop.getTotalLength()
      };

      this._applyPalette();

      var self = this;
      svg.addEventListener("click", function () {
        var r = self.getAttribute("replay") || "click";
        if (r === "click" && !self._playing) self.play();
      });
      svg.addEventListener("mouseenter", function () {
        if (self.getAttribute("replay") === "hover" && !self._playing) self.play();
      });
    }

    _applyPalette() {
      var pal = PALETTES[this.getAttribute("theme") === "dark" ? "dark" : "light"];
      this._pal = pal;
      ["o", "bowl", "spine", "outer"].forEach(function (k) {
        this._stops[k].forEach(function (s, i) {
          s.setAttribute("stop-color", pal[k][i]);
        });
      }, this);
      this._cornerBottom.setAttribute("fill", pal.spine[0]);
      this._cornerTop.setAttribute("fill", pal.outer[0]);
      if (!this.style.getPropertyValue("--orion-wordmark-color")) {
        this._wm.style.color = "var(--orion-wordmark-color," + pal.wordmark + ")";
      }
    }

    _draw(path, len, frac) {
      if (frac <= 0) {
        path.style.opacity = "0";
        return;
      }
      path.style.opacity = "1";
      if (frac >= 1) {
        path.style.strokeDasharray = "none";
        return;
      }
      path.style.strokeDasharray = len * frac + " " + (len + 10);
      path.style.strokeDashoffset = "0";
    }

    _showFinal() {
      this._playing = false;
      this._finished = true;
      this._render(tEnd);
      this._sat.setAttribute("opacity", "0");
      this._wm.classList.add("on");
    }

    _tick(now) {
      this._raf = 0;
      var t = now - this._start;
      var dt = Math.min(64, now - this._lastFrame);
      this._lastFrame = now;

      if (this._playing) {
        this._render(t);
        this._spawn(t);
        if (t >= tLanded - 250) this._wm.classList.add("on");
        if (t >= tEnd) {
          this._playing = false;
          this._finished = true;
        }
      }
      this._updateParticles(dt);
      this._updateSatellite(now);

      var orbit = this.getAttribute("orbit") !== "off";
      if (this._playing || this._particles.length || (this._finished && orbit)) {
        this._raf = requestAnimationFrame(this._tick);
      }
    }

    _render(t) {
      var pal = this._pal;

      // 1. Planet: O and bowl grow out from the joint at the top.
      var p = easeInOutCubic(clamp01(t / T_PLANET));
      this._draw(this._pO, this._len.o, p);
      this._draw(this._pBowl, this._len.bowl, Math.min(1, p * 1.12));
      var s = lerp(0.9, 1, easeOutCubic(clamp01(t / T_PLANET)));
      this._planet.setAttribute(
        "transform",
        "translate(" + X + " " + O_CY + ") scale(" + s + ") translate(" + -X + " " + -O_CY + ")"
      );

      // 3. Launch: spine accelerates upward.
      var launch = easeInCubic(clamp01((t - t0Launch) / T_LAUNCH));
      this._draw(this._pSpine, this._len.spine, launch);
      this._cornerBottom.style.opacity = t >= t0Launch ? "1" : "0";
      this._cornerTop.style.opacity = launch >= 1 ? "1" : "0";

      // 4. Orbit: outer arc decelerates round to close the loop.
      var orbit = easeOutCubic(clamp01((t - t0Orbit) / T_ORBIT));
      this._draw(this._pOuter, this._len.outer, orbit);

      // Rocket head position and colour.
      var head = null;
      var headOpacity = 0;
      var headScale = 1;
      var color = pal.spine[0];
      if (t >= t0Ignite && t < t0Launch) {
        var k = clamp01((t - t0Ignite) / T_IGNITE);
        head = [X, SPINE_BOTTOM];
        headOpacity = easeOutCubic(k);
        headScale = 0.4 + 0.6 * k + 0.08 * Math.sin(k * Math.PI * 6);
      } else if (t >= t0Launch && t < t0Orbit) {
        head = [X, lerp(SPINE_BOTTOM, SPINE_TOP, launch)];
        headOpacity = 1;
        headScale = 1 + 0.25 * launch;
        color = launch < 0.5
          ? mix(pal.spine[0], pal.spine[1], launch * 2)
          : mix(pal.spine[1], pal.spine[2], (launch - 0.5) * 2);
      } else if (t >= t0Orbit && t < tLanded + 200) {
        var pp = this._pOuter.getPointAtLength(this._len.outer * Math.min(orbit, 1));
        head = [pp.x, pp.y];
        headOpacity = 1 - clamp01((t - tLanded) / 200);
        headScale = lerp(1.25, 0.8, orbit);
        color = orbit < 0.5
          ? mix(pal.outer[0], pal.outer[1], orbit * 2)
          : mix(pal.outer[1], pal.spine[0], (orbit - 0.5) * 2);
      }
      this._headPos = head;
      if (head) {
        this._head.setAttribute("cx", head[0]);
        this._head.setAttribute("cy", head[1]);
        this._head.setAttribute("r", 54 * headScale);
        this._halo.setAttribute("cx", head[0]);
        this._halo.setAttribute("cy", head[1]);
        this._halo.setAttribute("r", 150 * headScale);
        this._glowMid.setAttribute("stop-color", color);
        this._glowEdge.setAttribute("stop-color", color);
      }
      this._head.setAttribute("opacity", head ? headOpacity : 0);
      this._halo.setAttribute("opacity", head ? headOpacity * 0.45 : 0);

      // Landing: flash where the orbit closes into the O, then a ring pulse.
      var land = clamp01((t - tLanded + 120) / T_SETTLE);
      this._flare.setAttribute("opacity", t >= tLanded - 120 ? (1 - land) * 0.9 : 0);
      this._ring.setAttribute("r", D_R + 70 * easeOutCubic(land));
      this._ring.setAttribute("opacity", t >= tLanded - 120 && land < 1 ? 0.35 * (1 - land) : 0);
      this._ring.setAttribute("stroke", pal.spine[0]);
    }

    _spawn(t) {
      if (!this._headPos) return;
      var n = 0;
      var dir = [0, 1];
      if (t >= t0Ignite && t < t0Launch) {
        n = Math.random() < 0.5 ? 1 : 0;
      } else if (t >= t0Launch && t < t0Orbit) {
        n = 2;
      } else if (t >= t0Orbit && t < t0Orbit + T_ORBIT * 0.35) {
        n = Math.random() < 0.6 ? 1 : 0;
        // Trail backwards along the tangent of the arc.
        var dx = this._headPos[0] - X;
        var dy = this._headPos[1] - D_CY;
        var m = Math.sqrt(dx * dx + dy * dy) || 1;
        dir = [dy / m, -dx / m];
      }
      for (var i = 0; i < n; i++) {
        var speed = 0.25 + Math.random() * 0.35;
        var spread = (Math.random() - 0.5) * 0.5;
        var c = el("circle", {
          cx: this._headPos[0] + (Math.random() - 0.5) * 30,
          cy: this._headPos[1] + (Math.random() - 0.5) * 30,
          r: 14,
          fill: "url(#" + this._id + "glow)"
        }, this._exhaust);
        var life = 520 + Math.random() * 420;
        this._particles.push({
          node: c,
          x: +c.getAttribute("cx"),
          y: +c.getAttribute("cy"),
          vx: (dir[0] + spread * dir[1]) * speed,
          vy: (dir[1] - spread * dir[0]) * speed,
          r: 16 + Math.random() * 22,
          age: 0,
          life: life
        });
      }
    }

    _updateParticles(dt) {
      var keep = [];
      for (var i = 0; i < this._particles.length; i++) {
        var p = this._particles[i];
        p.age += dt;
        if (p.age >= p.life) {
          p.node.remove();
          continue;
        }
        var k = p.age / p.life;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.97;
        p.vy *= 0.97;
        p.node.setAttribute("cx", p.x.toFixed(1));
        p.node.setAttribute("cy", p.y.toFixed(1));
        p.node.setAttribute("r", (p.r * (1 + k * 1.6)).toFixed(1));
        p.node.setAttribute("opacity", (0.7 * (1 - k) * (1 - k)).toFixed(3));
        keep.push(p);
      }
      this._particles = keep;
    }

    _clearParticles() {
      this._particles.forEach(function (p) {
        p.node.remove();
      });
      this._particles = [];
    }

    _updateSatellite(now) {
      var on = this._finished && this.getAttribute("orbit") !== "off";
      if (!on) {
        this._sat.setAttribute("opacity", 0);
        return;
      }
      if (!this._satStart) this._satStart = now;
      var since = now - this._satStart;
      // Start where the launch ended (bottom of the O), carry on round.
      var startLen = this._len.spine + Math.PI * D_R;
      var d = (startLen + (since / SATELLITE_PERIOD) * this._len.loop) % this._len.loop;
      var q = this._loop.getPointAtLength(d);
      this._sat.setAttribute("transform", "translate(" + q.x.toFixed(1) + " " + q.y.toFixed(1) + ")");
      this._sat.setAttribute("opacity", (0.9 * clamp01(since / 900)).toFixed(3));
    }
  }

  customElements.define("orion-logo-animation", OrionLogoAnimation);
})();
