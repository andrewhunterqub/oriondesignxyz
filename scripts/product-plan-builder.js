/*
 * Product Plan Builder: renders results saved from the tools (main.js
 * OrionPlan store) into the seven plan sections, keeps project details and
 * section notes, lists open questions, and exports the plan as print/PDF (standard or
 * presentation layout), Markdown, email or a plan file (.json) that can be imported again.
 */
(() => {
  const Plan = window.OrionPlan;
  if (!Plan) return;

  // Tool names come from the shared journey definition in main.js.
  const TOOLS = Object.fromEntries((window.OrionJourney || []).flatMap((section) => section.tools));

  const track = (name, params = {}) => window.OrionAnalytics?.trackEvent?.(name, params);
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const formatDate = (iso) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  // What each tool adds to the plan, shown when it is still missing from a section.
  const GAP_HINTS = {
    "product-purpose": "who the product is for and the problem it solves",
    "pugh-concept-selector": "why this concept was chosen over the alternatives",
    "hardware-business-case-builder": "the case for investing, in one page",
    "product-design-process-map": "which development stages matter most for this product",
    "timeline-planner": "a realistic schedule to launch",
    "prototype-strategy-tool": "which prototypes to build and what each will prove",
    "test-plan-builder": "how the product will be tested and approved",
    "assembly-time": "how long the product takes to assemble",
    "dfm-checker": "whether moulded parts are ready to tool",
    "tolerance-stack-up": "whether critical parts will fit together",
    "snap-fit-calculator": "whether snap-fit hooks will flex without cracking",
    "bracket-deflection-calculator": "whether brackets and beams are stiff and strong enough",
    "temperature-rise-estimator": "whether the hottest component stays below its temperature target",
    "material-selector": "the material choice and why",
    "manufacturing-payoff": "when tooling pays back against low-volume methods",
    "bom-builder": "the bill of materials and its cost",
    "product-cost-estimator": "the unit cost at your volumes",
    "landed-cost-calculator": "the cost once freight, duty and VAT are added",
    "production-strategy-planner": "the production route for each stage",
    "ready-for-tooling": "whether the design is ready to commit to tooling",
    "change-request-builder": "how design changes are requested, approved and released",
    "carbon-footprint": "an early estimate of the product's footprint",
    "product-lifecycle-explorer": "how product life and repair change the impact",
    "route-to-market-simulator": "the unit cost each sales route can support",
    "revenue-margin-simulator": "margins and profit across your channel mix",
    "pricing-ladder": "the shelf price once every margin is included",
    "break-even-calculator": "how many units you must sell to break even",
    "startup-cost-planner": "the budget needed to reach launch",
    "cashflow-projection": "the cash needed month by month",
    "crowdfunding-planner": "whether a campaign could fund the first batch",
    "investor-metrics-kpis": "the numbers investors will ask about",
    "ready-for-manufacturer": "whether you are ready to brief a manufacturer",
    "certification-readiness": "the compliance route and what is still needed",
    "nda-generator": "a starting NDA for early conversations",
    "rfq-pack-builder": "a complete quote request for suppliers"
  };
  // The hub guide behind each plan section.
  const HUB_GUIDES = {
    opportunity: ["opportunity-and-concept", "Opportunity and concept"],
    development: ["development-and-prototyping", "Development and prototyping"],
    manufacturing: ["manufacturing-and-cost", "Manufacturing and cost"],
    sustainability: ["sustainability-and-product-life", "Sustainability and product life"],
    market: ["route-to-market-and-margins", "Route to market and margins"],
    funding: ["funding-and-cash", "Funding and cash"],
    ip: ["ip-partners-and-compliance", "IP, partners and compliance"]
  };

  const sections = [...document.querySelectorAll("[data-plan-section]")].map((node) => ({
    id: node.dataset.planSection,
    node,
    title: node.querySelector("h2").textContent.trim(),
    // Tools per section come from the shared journey in main.js, so newly added tools appear automatically;
    // the static data-tools attribute is only a fallback.
    tools:
      (window.OrionJourney || []).find((section) => section.id === node.dataset.planSection)?.tools.map(([id]) => id) ||
      node.dataset.tools.split(","),
    entries: node.querySelector("[data-plan-entries]"),
    status: node.querySelector("[data-plan-status]"),
    notes: node.querySelector("[data-plan-notes]"),
    notesPrint: node.querySelector("[data-plan-notes-print]")
  }));

  const roadmapPercent = () => {
    try {
      const ticked = Object.keys(JSON.parse(localStorage.getItem("orion-roadmap-progress-v1") || "{}")).length;
      return Math.round((ticked / 18) * 100);
    } catch (e) {
      return 0;
    }
  };

  // ----- Project fields and notes -------------------------------------------------
  const projectFields = [...document.querySelectorAll("[data-plan-field]")];
  const fillInputs = () => {
    const plan = Plan.load();
    projectFields.forEach((field) => {
      if (document.activeElement !== field) field.value = plan.project[field.dataset.planField] || "";
    });
    sections.forEach((section) => {
      if (document.activeElement !== section.notes) section.notes.value = plan.notes[section.id] || "";
      section.notesPrint.textContent = plan.notes[section.id] || "";
    });
  };
  projectFields.forEach((field) =>
    field.addEventListener("input", () =>
      Plan.update((plan) => {
        plan.project[field.dataset.planField] = field.value;
      })
    )
  );
  sections.forEach((section) =>
    section.notes.addEventListener("input", () => {
      section.notesPrint.textContent = section.notes.value;
      Plan.update((plan) => {
        plan.notes[section.id] = section.notes.value;
      });
    })
  );

  // ----- Section rendering --------------------------------------------------------
  const renderEntry = (entry) => {
    const card = el("article", "plan-entry");
    const head = el("div", "plan-entry-head");
    const title = el("h3", "", entry.title || TOOLS[entry.id] || entry.id);
    const meta = el("span", "plan-entry-date", `Saved ${formatDate(entry.savedAt)}`);
    head.append(title, meta);

    const summary = el("pre", "plan-entry-summary", entry.summary || "No summary captured.");

    const actions = el("div", "plan-entry-actions");
    const open = el("a", "text-link", "Open with these numbers");
    open.href = `${Plan.siteBase()}${entry.path}`;
    open.addEventListener("click", () => {
      if (entry.formId && entry.values) Plan.restoreInputs(entry.formId, entry.values);
      track("plan_entry_reopen", { tool_id: entry.id });
    });
    const remove = el("button", "plan-entry-remove", "Remove");
    remove.type = "button";
    remove.addEventListener("click", () => {
      Plan.update((plan) => {
        delete plan.entries[entry.id];
      });
      track("plan_entry_removed", { tool_id: entry.id });
    });
    actions.append(open, remove);

    card.append(head, summary, actions);
    if (entry.inputs?.length) {
      const details = el("details", "plan-entry-inputs");
      details.append(el("summary", "", `Inputs used (${entry.inputs.length})`));
      const list = el("dl");
      entry.inputs.forEach((input) => list.append(el("dt", "", input.label), el("dd", "", input.value)));
      details.append(list);
      card.append(details);
    }
    return card;
  };

  const renderSections = (plan) => {
    let covered = 0;
    let suggestion = null;

    sections.forEach((section) => {
      section.entries.replaceChildren();
      const saved = section.tools.filter((id) => plan.entries[id]);
      const missing = section.tools.filter((id) => !plan.entries[id]);
      if (saved.length) covered += 1;
      else if (!suggestion) suggestion = { section, tool: missing[0] };

      saved.forEach((id) => section.entries.append(renderEntry(plan.entries[id])));

      const add = el("div", "plan-add");
      if (missing.length) {
        add.append(el("span", "plan-label", saved.length ? "Still missing from this section" : "Fill this section with"));
        const list = el("ul", "plan-missing");
        missing.forEach((id) => {
          const item = el("li");
          const link = el("a", "text-link-inline", TOOLS[id] || id);
          link.href = `${id}.html`;
          item.append(link);
          if (GAP_HINTS[id]) item.append(document.createTextNode(`: ${GAP_HINTS[id]}`));
          list.append(item);
        });
        add.append(list);
      }
      if (!(plan.notes[section.id] || "").trim()) {
        add.append(el("p", "plan-missing-note", "No notes yet: add the decisions and open questions behind this section."));
      }
      if (HUB_GUIDES[section.id]) {
        const hub = el("p", "plan-hub-link");
        const link = el("a", "text-link-inline", HUB_GUIDES[section.id][1]);
        link.href = `../guides/${HUB_GUIDES[section.id][0]}.html`;
        hub.append(document.createTextNode("Guide for this section: "), link);
        add.append(hub);
      }
      if (add.childNodes.length) section.entries.append(add);

      section.status.textContent = saved.length
        ? `${saved.length}/${section.tools.length} tools`
        : "Not started";
      section.node.classList.toggle("is-started", saved.length > 0);
      section.node.classList.toggle("is-complete", saved.length === section.tools.length);
    });

    return { covered, suggestion };
  };

  // ----- Health panel -------------------------------------------------------------
  const ring = document.querySelector("[data-plan-ring]");
  const circumference = 2 * Math.PI * 52;
  ring.style.strokeDasharray = `${circumference}`;

  const headline = (covered, count) => {
    if (!count) return "Start with any tool. Every result you save fills in part of the plan.";
    if (covered === sections.length) return "Every section has evidence behind it. That's a plan worth sharing.";
    if (covered >= 5) return "Nearly there. The empty sections are where a reviewer will ask questions.";
    if (covered >= 3) return "Taking shape. Keep going section by section.";
    return "Good start. Each section you add makes the plan more convincing.";
  };

  const renderHealth = (plan, { covered, suggestion }) => {
    const count = Object.keys(plan.entries).length;
    document.querySelector("[data-plan-coverage]").textContent = `${covered}/${sections.length}`;
    ring.style.strokeDashoffset = `${circumference * (1 - covered / sections.length)}`;
    document.querySelector("[data-plan-count]").textContent = count;
    document.querySelector("[data-plan-roadmap]").textContent = `${roadmapPercent()}%`;
    document.querySelector("[data-plan-headline]").textContent = headline(covered, count);

    const next = document.querySelector("[data-plan-next]");
    if (suggestion) {
      next.innerHTML = `<p class="roadmap-next-label"></p><p class="roadmap-next-step"></p><a class="text-link"></a>`;
      next.querySelector(".roadmap-next-label").textContent = `Suggested next · Section ${sections.indexOf(suggestion.section) + 1}`;
      next.querySelector(".roadmap-next-step").textContent = suggestion.section.title;
      const link = next.querySelector("a");
      link.href = `${suggestion.tool}.html`;
      link.textContent = `Open the ${TOOLS[suggestion.tool]} →`;
    } else {
      next.innerHTML = `<p class="roadmap-next-label">All sections started</p>
        <p class="roadmap-next-step">Add notes to each section, then share the plan with someone who will challenge it.</p>`;
    }

    document.querySelector("[data-plan-email]").href = buildMailto(plan, covered);
  };

  // ----- Open questions ------------------------------------------------------------
  const whatItMeans = (entry) => (entry.summary || "").split("\n").find((line) => line.startsWith("What this means:"))?.replace("What this means:", "").trim();
  const buildQuestions = (plan) => {
    const questions = [];
    sections.forEach((section, index) => {
      const saved = section.tools.filter((id) => plan.entries[id]);
      if (!saved.length) {
        questions.push({ kind: "gap", text: `${index + 1}. ${section.title}: no evidence yet. Start with the ${TOOLS[section.tools[0]] || "first tool"}.`, href: `${section.tools[0]}.html` });
      }
      saved.forEach((id) => {
        const entry = plan.entries[id];
        if (entry.level === "worrying" || entry.level === "borderline") {
          const meaning = whatItMeans(entry);
          questions.push({ kind: entry.level, text: `${entry.title || TOOLS[id]}: ${meaning || (entry.level === "worrying" ? "the result needs attention" : "the result is worth a closer look")}`, href: `${id}.html` });
        }
      });
      (plan.notes[section.id] || "").split("\n").map((line) => line.trim()).filter((line) => line.endsWith("?")).forEach((line) => {
        questions.push({ kind: "note", text: `${section.title}: ${line}` });
      });
    });
    return questions;
  };
  const renderQuestions = (plan) => {
    const root = document.querySelector("[data-plan-questions]");
    if (!root) return;
    const questions = buildQuestions(plan);
    root.innerHTML = "";
    const title = el("p", "plan-questions-title", questions.length ? `Open questions (${questions.length})` : "No open questions");
    root.append(title);
    if (!questions.length) return;
    const list = el("ul", "plan-questions-list");
    questions.slice(0, 12).forEach((q) => {
      const item = el("li", `plan-question plan-question-${q.kind}`);
      if (q.href) {
        const link = el("a", "text-link-inline", q.text);
        link.href = q.href;
        item.append(link);
      } else {
        item.textContent = q.text;
      }
      list.append(item);
    });
    root.append(list);
    if (questions.length > 12) root.append(el("p", "helper-text", `And ${questions.length - 12} more in the downloaded plan.`));
  };

  // ----- Export -------------------------------------------------------------------
  const buildMarkdown = (plan) => {
    const p = plan.project;
    const lines = [`# ${p.name || "Product plan"}`, ""];
    if (p.summary) lines.push(p.summary, "");
    if (p.stage) lines.push(`- Stage: ${p.stage}`);
    if (p.volume) lines.push(`- Expected first-year volume: ${p.volume}`);
    if (p.launch) lines.push(`- Target launch: ${p.launch}`);
    lines.push(`- Roadmap progress: ${roadmapPercent()}%`, "");
    sections.forEach((section, index) => {
      lines.push(`## ${index + 1}. ${section.title}`, "");
      const saved = section.tools.filter((id) => plan.entries[id]);
      if (!saved.length) lines.push("_Not started yet._", "");
      saved.forEach((id) => {
        const entry = plan.entries[id];
        lines.push(`### ${entry.title || TOOLS[id]} (saved ${formatDate(entry.savedAt)})`, "", "```", entry.summary || "", "```", "");
      });
      if (plan.notes[section.id]) lines.push("**Notes:**", "", plan.notes[section.id], "");
    });
    lines.push("---", `Built with the Orion Design Product Plan Builder: https://oriondesign.xyz/tools/product-plan-builder.html`);
    const open = buildQuestions(plan);
    if (open.length) {
      lines.push("## Open questions", "");
      open.forEach((q) => lines.push(`- ${q.text}`));
      lines.push("");
    }
    return lines.join("\n");
  };

  const buildMailto = (plan, covered) => {
    const p = plan.project;
    const lines = ["Hi Andrew,", "", `Here is my product plan from the Orion Design Product Plan Builder (${covered}/${sections.length} sections started).`, ""];
    if (p.name) lines.push(`Product: ${p.name}`);
    if (p.summary) lines.push(`What it does: ${p.summary}`);
    if (p.stage) lines.push(`Stage: ${p.stage}`);
    if (p.volume) lines.push(`Expected volume: ${p.volume}`);
    if (p.launch) lines.push(`Target launch: ${p.launch}`);
    lines.push("");
    sections.forEach((section, index) => {
      const saved = section.tools.filter((id) => plan.entries[id]);
      lines.push(`${index + 1}. ${section.title}: ${saved.length ? saved.map((id) => TOOLS[id]).join(", ") : "not started"}`);
      saved.forEach((id) => {
        const firstLines = (plan.entries[id].summary || "").split("\n").slice(1, 4).join("; ");
        if (firstLines) lines.push(`   ${firstLines.slice(0, 220)}`);
      });
      if (plan.notes[section.id]) lines.push(`   Notes: ${plan.notes[section.id].replace(/\s+/g, " ").slice(0, 200)}`);
    });
    lines.push("", "(Full plan attached: use 'Download' or 'Print or save as PDF' on the plan page.)", "", "The decision I'd like help with:", "");
    let body = lines.join("\n");
    if (body.length > 1800) body = `${body.slice(0, 1700)}\n…\n\n(Shortened. Full plan attached.)\n\nThe decision I'd like help with:\n`;
    const subject = `Product plan: ${p.name || "my product"}`;
    return `mailto:hello@oriondesign.xyz?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  document.querySelector("[data-plan-print]").addEventListener("click", () => {
    track("plan_printed", { plan_size: Plan.count() });
    window.print();
  });

  document.querySelector("[data-plan-download]").addEventListener("click", () => {
    const plan = Plan.load();
    const blob = new Blob([buildMarkdown(plan)], { type: "text/markdown" });
    const link = document.createElement("a");
    const slug = (plan.project.name || "product-plan").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    link.href = URL.createObjectURL(blob);
    link.download = `${slug || "product-plan"}.md`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    track("plan_downloaded", { plan_size: Plan.count() });
  });

  document.querySelector("[data-plan-email]").addEventListener("click", () => track("plan_emailed", { plan_size: Plan.count() }));

  document.querySelector("[data-plan-clear]").addEventListener("click", () => {
    if (!window.confirm("Clear your whole product plan from this browser? This cannot be undone.")) return;
    Plan.save({ project: {}, entries: {}, notes: {} });
    track("plan_cleared", {});
  });

  // ----- Presentation print, plan file export and import ------------------------------
  const fileStatus = document.querySelector("[data-plan-file-status]");
  const fillCover = () => {
    const cover = document.querySelector("[data-plan-cover]");
    if (!cover) return;
    const plan = Plan.load();
    const p = plan.project;
    cover.innerHTML = "";
    cover.append(el("p", "plan-cover-kicker", "Product plan"));
    cover.append(el("h2", "plan-cover-title", p.name || "Product plan"));
    if (p.summary) cover.append(el("p", "plan-cover-summary", p.summary));
    const facts = [p.stage && `Stage: ${p.stage}`, p.volume && `First-year volume: ${p.volume}`, p.launch && `Target launch: ${p.launch}`, `Prepared ${formatDate(new Date().toISOString())}`].filter(Boolean);
    cover.append(el("p", "plan-cover-facts", facts.join(" · ")));
  };
  document.querySelector("[data-plan-present]")?.addEventListener("click", () => {
    fillCover();
    document.body.classList.add("print-presentation");
    track("plan_printed", { plan_size: Plan.count(), layout: "presentation" });
    window.print();
  });
  window.addEventListener("afterprint", () => document.body.classList.remove("print-presentation"));

  document.querySelector("[data-plan-export]")?.addEventListener("click", () => {
    const plan = Plan.load();
    const payload = { format: "orion-product-plan", version: 1, exportedAt: new Date().toISOString(), plan };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    const slug = (plan.project.name || "product-plan").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    link.href = URL.createObjectURL(blob);
    link.download = `${slug || "product-plan"}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    if (fileStatus) fileStatus.textContent = "Plan file downloaded. Import it on another device or browser to carry on.";
    track("plan_exported", { plan_size: Plan.count() });
  });

  document.querySelector("[data-plan-import]")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const incoming = data && data.format === "orion-product-plan" ? data.plan : data;
        if (!incoming || typeof incoming !== "object" || typeof incoming.entries !== "object") throw new Error("not a plan");
        const plan = { project: incoming.project || {}, entries: incoming.entries || {}, notes: incoming.notes || {} };
        const current = Plan.count();
        if (current && !window.confirm(`Replace your current plan (${current} saved result${current === 1 ? "" : "s"}) with the imported one?`)) return;
        Plan.save(plan);
        if (fileStatus) fileStatus.textContent = `Imported ${Object.keys(plan.entries).length} saved result${Object.keys(plan.entries).length === 1 ? "" : "s"}.`;
        track("plan_imported", { plan_size: Object.keys(plan.entries).length });
      } catch (e) {
        if (fileStatus) fileStatus.textContent = "That file is not an Orion product plan. Export a plan file from this page and try again.";
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  });

  // ----- Render loop --------------------------------------------------------------
  const render = () => {
    const plan = Plan.load();
    fillInputs();
    renderHealth(plan, renderSections(plan));
    renderQuestions(plan);
  };
  document.addEventListener("orion-plan-change", render);
  window.addEventListener("storage", (event) => {
    if (event.key === Plan.key || event.key === "orion-roadmap-progress-v1") render();
  });
  render();
})();
