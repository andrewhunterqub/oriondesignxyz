/*
 * Interactive roadmap: turns each phase checklist on /ready-to-launch/ into
 * tickable steps, remembers progress in this browser, shows overall progress
 * and the next suggested focus, and lets the visitor email their progress.
 * Without JavaScript the page remains a readable static roadmap.
 */
(() => {
  const grid = document.querySelector("[data-roadmap]");
  const panel = document.querySelector("[data-roadmap-progress]");
  if (!grid || !panel) return;

  const storageKey = "orion-roadmap-progress-v1";
  const track = (name, params) => {
    if (typeof trackAnalyticsEvent === "function") trackAnalyticsEvent(name, params);
  };
  const load = () => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "{}");
    } catch (error) {
      return {};
    }
  };
  const save = (state) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      /* storage unavailable: progress lasts for this visit only */
    }
  };

  let state = load();

  const phases = [...grid.querySelectorAll("article")].map((card, phaseIndex) => {
    const title = card.querySelector("h2, h3")?.textContent.trim() || `Phase ${phaseIndex + 1}`;
    const kicker = card.querySelector(".card-kicker");
    const firstLink = card.querySelector(".page-links a");
    card.id = card.id || `phase-${phaseIndex + 1}`;

    const counter = document.createElement("span");
    counter.className = "roadmap-count";
    kicker?.after(counter);

    const items = [...card.querySelectorAll(".checklist > div")].map((row, itemIndex) => {
      const key = `${phaseIndex}-${itemIndex}`;
      const text = row.textContent.trim();
      const button = document.createElement("button");
      button.type = "button";
      button.className = "roadmap-check";
      button.setAttribute("role", "checkbox");
      button.textContent = text;
      button.addEventListener("click", () => {
        state[key] = !state[key];
        if (!state[key]) delete state[key];
        save(state);
        track("roadmap_step_toggle", { phase: phaseIndex + 1, step: itemIndex + 1, checked: Boolean(state[key]) });
        render();
      });
      row.replaceWith(button);
      return { key, text, button };
    });

    card.querySelector(".checklist")?.classList.add("checklist-interactive");
    return { card, title, number: phaseIndex + 1, items, counter, firstLink };
  });

  const total = phases.reduce((sum, phase) => sum + phase.items.length, 0);

  panel.innerHTML = `
    <div class="roadmap-progress-head">
      <div class="roadmap-ring" aria-hidden="true"><svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="52" class="ring-track"></circle>
        <circle cx="60" cy="60" r="52" class="ring-fill" data-ring></circle>
      </svg><strong data-percent>0%</strong></div>
      <div>
        <p class="eyebrow">Your progress</p>
        <h2 data-headline>Tick off what your project already has in place.</h2>
        <p class="roadmap-sub" data-sub>Progress is saved in this browser only. Nothing is sent anywhere unless you choose to email it.</p>
      </div>
    </div>
    <ol class="roadmap-phase-bar" aria-label="Progress by phase" data-phase-bar></ol>
    <div class="roadmap-next" data-next></div>
    <div class="button-row">
      <a class="button button-primary" data-send href="mailto:hello@oriondesign.xyz">Send my progress to Andrew</a>
      <button class="button button-secondary" type="button" data-reset>Reset</button>
    </div>
  `;

  const ring = panel.querySelector("[data-ring]");
  const circumference = 2 * Math.PI * 52;
  ring.style.strokeDasharray = `${circumference}`;

  const phaseBar = panel.querySelector("[data-phase-bar]");
  phases.forEach((phase) => {
    const li = document.createElement("li");
    li.innerHTML = `<a href="#${phase.card.id}"><span class="seg"><span></span></span><small>${phase.number}. ${phase.title}</small></a>`;
    phase.segment = li.querySelector(".seg > span");
    phaseBar.append(li);
  });

  panel.querySelector("[data-reset]").addEventListener("click", () => {
    if (!Object.keys(state).length) return;
    if (!window.confirm("Clear your roadmap progress in this browser?")) return;
    state = {};
    save(state);
    track("roadmap_reset", {});
    render();
  });

  panel.querySelector("[data-send]").addEventListener("click", () => {
    track("roadmap_send_progress", { completed: Object.keys(state).length, total });
  });

  const headlineFor = (done) => {
    if (done === 0) return "Tick off what your project already has in place.";
    if (done === total) return "Every phase covered. Time to pressure-test the launch plan.";
    if (done / total >= 0.66) return "Strong foundations. The remaining gaps are where risk hides.";
    if (done / total >= 0.33) return "Good momentum. Keep closing the earliest gaps first.";
    return "A solid start. Early phases make later ones cheaper.";
  };

  function render() {
    let done = 0;
    let next = null;

    phases.forEach((phase) => {
      const complete = phase.items.filter((item) => state[item.key]).length;
      done += complete;
      phase.items.forEach((item) => {
        const checked = Boolean(state[item.key]);
        item.button.setAttribute("aria-checked", String(checked));
        item.button.classList.toggle("is-checked", checked);
        if (!checked && !next) next = { phase, item };
      });
      phase.counter.textContent = `${complete}/${phase.items.length} in place`;
      phase.card.classList.toggle("is-complete", complete === phase.items.length && complete > 0);
      phase.segment.style.width = `${phase.items.length ? (complete / phase.items.length) * 100 : 0}%`;
    });

    const percent = total ? Math.round((done / total) * 100) : 0;
    panel.querySelector("[data-percent]").textContent = `${percent}%`;
    ring.style.strokeDashoffset = `${circumference * (1 - percent / 100)}`;
    panel.querySelector("[data-headline]").textContent = headlineFor(done);

    const nextBox = panel.querySelector("[data-next]");
    if (next) {
      const link = next.phase.firstLink;
      nextBox.innerHTML = `
        <p class="roadmap-next-label">Suggested next focus · Phase ${next.phase.number}: ${next.phase.title}</p>
        <p class="roadmap-next-step"></p>
        ${link ? `<a class="text-link" href="${link.getAttribute("href")}"></a>` : ""}`;
      nextBox.querySelector(".roadmap-next-step").textContent = next.item.text;
      if (link) nextBox.querySelector("a").textContent = `${link.textContent.trim()} →`;
    } else {
      nextBox.innerHTML = `<p class="roadmap-next-label">All steps ticked</p>
        <p class="roadmap-next-step">If you'd like a second pair of eyes before committing to tooling or launch spend, send your progress over.</p>`;
    }

    const lines = phases.map((phase) => {
      const rows = phase.items.map((item) => `  [${state[item.key] ? "x" : " "}] ${item.text}`).join("\n");
      return `Phase ${phase.number}: ${phase.title}\n${rows}`;
    });
    const body = `Hi Andrew,\n\nHere's where my product is on the Orion Design roadmap (${done}/${total} steps, ${percent}%).\n\n${lines.join("\n\n")}\n\nA bit about the product:\n\n`;
    panel.querySelector("[data-send]").href =
      `mailto:hello@oriondesign.xyz?subject=${encodeURIComponent("My product roadmap progress")}&body=${encodeURIComponent(body)}`;
  }

  render();
})();
