// Currency display (GBP / EUR / USD). Display only: figures are never converted.
// Tool scripts read window.OrionCurrency.code() when they build their money formatters,
// so this must run before them. The choice is remembered in this browser only.
const OrionCurrency = (() => {
  const key = "orion-currency-v1";
  const options = { GBP: { symbol: "£", label: "£ GBP" }, EUR: { symbol: "€", label: "€ EUR" }, USD: { symbol: "$", label: "$ USD" } };
  let current = "GBP";
  let used = false;
  try {
    const saved = localStorage.getItem(key);
    if (options[saved]) current = saved;
  } catch (e) {}
  return {
    options,
    code: () => { used = true; return current; },
    symbol: () => { used = true; return options[current].symbol; },
    wasUsed: () => used,
    set(code) {
      if (!options[code]) return;
      try { localStorage.setItem(key, code); } catch (e) {}
    }
  };
})();
window.OrionCurrency = OrionCurrency;

// Named site colours for charts and canvas drawing, read from the CSS custom
// properties in styles.css (:root) so charts follow any palette change.
// get("teal") -> "rgb(54, 183, 167)"; rgba("space-blue", 0.08) -> translucent tint.
const OrionColours = (() => {
  const fallback = {
    "space-blue": "31, 42, 68", indigo: "62, 94, 154", teal: "54, 183, 167", magenta: "162, 42, 108",
    white: "255, 255, 255", "teal-300": "127, 202, 193", "magenta-300": "209, 108, 160", "grey-200": "207, 215, 227"
  };
  const style = () => getComputedStyle(document.documentElement);
  const channels = (name) => {
    const fromCss = style().getPropertyValue(`--rgb-${name}`).trim();
    if (fromCss) return fromCss;
    const hex = style().getPropertyValue(`--${name}`).trim();
    const m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).join(", ");
    return fallback[name] || "0, 0, 0";
  };
  return {
    get: (name) => `rgb(${channels(name)})`,
    rgba: (name, alpha) => `rgba(${channels(name)}, ${alpha})`
  };
})();
window.OrionColours = OrionColours;

// Chart text and gridlines follow the palette too (light or dark, from the device setting).
if (window.Chart) {
  Chart.defaults.color = OrionColours.get("muted-strong");
  Chart.defaults.borderColor = OrionColours.rgba("space-blue", 0.12);
  // Respect "reduce motion": charts appear in their final state instead of animating in.
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) Chart.defaults.animation = false;

  // If the device switches between light and dark while a page is open, recolour existing charts:
  // every chart colour came from OrionColours, so map each old palette colour to its new value.
  const paletteNames = ["space-blue", "indigo", "teal", "magenta", "white", "teal-300", "magenta-300", "grey-200", "muted-strong"];
  const snapshot = () => new Map(paletteNames.map((n) => [n, OrionColours.get(n).replace(/^rgb\(|\)$/g, "")]));
  let palette = snapshot();
  const scheme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
  if (scheme && scheme.addEventListener) {
    scheme.addEventListener("change", () => {
      const next = snapshot();
      const swap = new Map();
      for (const [name, channels] of palette) if (next.get(name) !== channels) swap.set(channels.replace(/\s/g, ""), next.get(name));
      palette = next;
      if (!swap.size) return;
      const recolour = (value) => value.replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g, (m, r, g, b) => {
        const to = swap.get(`${r},${g},${b}`);
        return to ? `${m.startsWith("rgba") ? "rgba" : "rgb"}(${to}` : m;
      });
      const walk = (obj, seen = new Set()) => {
        if (!obj || typeof obj !== "object" || seen.has(obj)) return;
        seen.add(obj);
        for (const key of Object.keys(obj)) {
          const v = obj[key];
          if (typeof v === "string" && /rgba?\(/.test(v)) obj[key] = recolour(v);
          else if (Array.isArray(v)) v.forEach((item, i) => { if (typeof item === "string") v[i] = recolour(item); else walk(item, seen); });
          else if (v && typeof v === "object" && !(v instanceof HTMLElement)) walk(v, seen);
        }
      };
      Chart.defaults.color = OrionColours.get("muted-strong");
      Chart.defaults.borderColor = OrionColours.rgba("space-blue", 0.12);
      Object.values(Chart.instances || {}).forEach((chart) => {
        walk(chart.config.data);
        walk(chart.config.options);
        chart.update("none");
      });
    });
  }
}

const header = document.querySelector("[data-header]");
const navToggle = document.querySelector("[data-nav-toggle]");
const nav = document.querySelector("[data-nav]");
const reveals = document.querySelectorAll(".reveal");
const copyButtons = document.querySelectorAll("[data-copy-target]");
const analyticsLinks = document.querySelectorAll("[data-analytics-event]");
const mailtoLinks = document.querySelectorAll('a[href^="mailto:"]');
const toolForm = document.querySelector(".tool-form");
const toolLeadLinks = document.querySelectorAll("[data-tool-lead-link]");
const contactLeadContext = document.querySelector("[data-lead-context]");
const leadContextTool = document.querySelector("[data-lead-context-tool]");
const leadContextCopy = document.querySelector("[data-lead-context-copy]");
const leadContextMailto = document.querySelector("[data-lead-context-mailto]");
const leadContextFeedback = document.querySelector("[data-lead-context-feedback]");

const trackAnalyticsEvent = (name, params = {}) => {
  if (window.OrionAnalytics && typeof window.OrionAnalytics.trackEvent === "function") {
    window.OrionAnalytics.trackEvent(name, params);
  }
};

const truncateText = (value, maxLength = 800) => {
  const cleanValue = String(value || "").replace(/\s+/g, " ").trim();

  if (cleanValue.length <= maxLength) {
    return cleanValue;
  }

  return `${cleanValue.slice(0, maxLength - 1).trim()}…`;
};

const getFieldLabel = (field) => {
  if (field.id) {
    const label = document.querySelector(`label[for="${CSS.escape(field.id)}"]`);

    if (label) {
      return label.textContent.trim();
    }
  }

  const labelledBy = field.getAttribute("aria-labelledby");
  const labelledText = labelledBy
    ? labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent.trim() || "").join(" ").trim()
    : "";
  return field.getAttribute("aria-label") || labelledText || field.closest("label")?.textContent.trim() || field.name || field.id || "Input";
};

const getFieldValue = (field) => {
  if (field.tagName === "SELECT") {
    return Array.from(field.selectedOptions).map((option) => option.textContent.trim()).join(", ");
  }

  if (field.type === "checkbox" || field.type === "radio") {
    return field.checked ? "Yes" : "No";
  }

  return field.value;
};

const buildToolLeadContext = () => {
  const toolTitle = document.querySelector("h1")?.textContent.trim() || document.title.replace(/\s*\|\s*Orion Design\s*$/i, "");
  const resultSummary = document.querySelector(".copy-output")?.value.trim() ||
    document.querySelector(".result-panel, .tool-card")?.textContent.trim() ||
    "";
  const inputs = toolForm
    ? Array.from(toolForm.querySelectorAll("input, select, textarea"))
        .filter((field) => field.type !== "submit" && field.type !== "button" && field.type !== "hidden")
        .map((field) => ({
          label: getFieldLabel(field),
          value: truncateText(getFieldValue(field), 240)
        }))
        .filter((item) => item.value !== "")
    : [];

  return {
    source: "tool",
    toolTitle,
    pageUrl: window.location.href,
    pagePath: window.location.pathname,
    capturedAt: new Date().toISOString(),
    inputs,
    resultSummary: truncateText(resultSummary, 1800)
  };
};

const buildToolLeadText = (context) => {
  const lines = [
    `Tool result context: ${context.toolTitle || "Orion Design tool"}`,
    `Page: ${context.pageUrl || ""}`,
    ""
  ];

  if (context.inputs && context.inputs.length > 0) {
    lines.push("Inputs:");
    context.inputs.forEach((input) => {
      lines.push(`- ${input.label}: ${input.value}`);
    });
    lines.push("");
  }

  if (context.resultSummary) {
    lines.push("Result summary:");
    lines.push(context.resultSummary);
    lines.push("");
  }

  lines.push("What I would like help deciding:");
  lines.push("");

  return lines.join("\n").trim();
};

const storeToolLeadContext = (context) => {
  try {
    window.sessionStorage.setItem("orionToolLeadContext", JSON.stringify(context));
  } catch {
    // The contact page still receives the source and tool name through the URL.
  }
};

const readStoredToolLeadContext = () => {
  try {
    const value = window.sessionStorage.getItem("orionToolLeadContext");
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

if (toolForm) {
  const shareableFields = Array.from(toolForm.querySelectorAll("input[type='number'], input[type='range'], select"))
    .filter((field) => field.id);
  const currentUrl = new URL(window.location.href);

  shareableFields.forEach((field) => {
    const value = currentUrl.searchParams.get(field.id);
    if (value !== null) {
      field.value = value;
    }
  });

  const syncToolUrl = () => {
    const nextUrl = new URL(window.location.href);

    shareableFields.forEach((field) => {
      if (field.value === "") {
        nextUrl.searchParams.delete(field.id);
      } else {
        nextUrl.searchParams.set(field.id, field.value);
      }
    });

    window.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
  };

  shareableFields.forEach((field) => {
    field.addEventListener("input", syncToolUrl);
    field.addEventListener("change", syncToolUrl);
  });
}

toolLeadLinks.forEach((link) => {
  const updateLeadLink = () => {
    const context = buildToolLeadContext();
    const nextUrl = new URL(link.getAttribute("href") || "../contact/index.html", window.location.href);

    nextUrl.searchParams.set("source", "tool");
    nextUrl.searchParams.set("tool", context.toolTitle);
    link.href = nextUrl.toString();

    return context;
  };

  link.addEventListener("focus", updateLeadLink);
  link.addEventListener("pointerenter", updateLeadLink);
  link.addEventListener("click", () => {
    const context = updateLeadLink();
    storeToolLeadContext(context);

    trackAnalyticsEvent("tool_lead_context_created", {
      page_path: window.location.pathname,
      tool_name: context.toolTitle
    });
  });
});

document.querySelectorAll("[data-tool-preset]").forEach((button) => {
  button.addEventListener("click", () => {
    let values = {};

    try {
      values = JSON.parse(button.getAttribute("data-tool-preset") || "{}");
    } catch {
      values = {};
    }

    Object.entries(values).forEach(([id, value]) => {
      const field = document.getElementById(id);
      if (!field) {
        return;
      }

      field.value = value;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
});

const syncHeader = () => {
  if (!header) {
    return;
  }

  header.classList.toggle("is-scrolled", window.scrollY > 12);
};

syncHeader();
window.addEventListener("scroll", syncHeader, { passive: true });

if (navToggle && nav) {
  navToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

if ("IntersectionObserver" in window && reveals.length > 0) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.18 }
  );

  reveals.forEach((item) => observer.observe(item));
} else {
  reveals.forEach((item) => item.classList.add("is-visible"));
}

copyButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const selector = button.getAttribute("data-copy-target");
    const feedbackSelector = button.getAttribute("data-copy-feedback");
    const target = selector ? document.querySelector(selector) : null;
    const feedback = feedbackSelector ? document.querySelector(feedbackSelector) : null;

    if (!target) {
      return;
    }

    try {
      const value = "value" in target ? target.value : target.textContent;
      await navigator.clipboard.writeText(value.trim());

      if (feedback) {
        feedback.textContent = "Copied to clipboard.";
        setTimeout(() => {
          feedback.textContent = "";
        }, 2000);
      }

      trackAnalyticsEvent("copy_result", {
        page_path: window.location.pathname,
        copy_target: selector
      });
    } catch {
      if (feedback) {
        feedback.textContent = "Copy failed. Select the text and copy manually.";
      }
    }
  });
});

analyticsLinks.forEach((link) => {
  link.addEventListener("click", () => {
    trackAnalyticsEvent(link.dataset.analyticsEvent, {
      page_path: window.location.pathname,
      link_context: link.dataset.analyticsLabel || undefined
    });
  });
});

mailtoLinks.forEach((link) => {
  link.addEventListener("click", () => {
    trackAnalyticsEvent("contact_click", {
      method: "email",
      page_path: window.location.pathname
    });
  });
});

if (window.location.pathname.endsWith("/contact/") || window.location.pathname.endsWith("/contact/index.html")) {
  const params = new URLSearchParams(window.location.search);
  const leadContext = params.get("source") === "tool"
    ? readStoredToolLeadContext() || {
        source: "tool",
        toolTitle: params.get("tool") || "Orion Design tool",
        pageUrl: "",
        inputs: [],
        resultSummary: ""
      }
    : null;

  if (leadContext && contactLeadContext && leadContextCopy && leadContextMailto) {
    const body = buildToolLeadText(leadContext);
    const mailBody = body.length > 1800
      ? `${body.slice(0, 1750).trim()}\n\n[Context shortened for email. The full context is shown on the contact page.]`
      : body;
    const subject = `Product design advice: ${leadContext.toolTitle || "tool result"}`;

    contactLeadContext.hidden = false;
    leadContextCopy.value = body;
    leadContextMailto.href = `mailto:hello@oriondesign.xyz?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(mailBody)}`;

    if (leadContextTool) {
      leadContextTool.textContent = leadContext.toolTitle || "Tool result";
    }

    if (leadContextFeedback) {
      leadContextFeedback.textContent = "Review the context below before sending anything.";
    }
  }

  trackAnalyticsEvent("lead_intent", {
    page_type: "contact",
    source: leadContext ? "tool_result" : "direct",
    page_path: window.location.pathname
  });
}

// Tool input persistence via localStorage.
// Fields are keyed by name, falling back to id (most tool inputs only have ids).
// main.js runs before each tool script, so restored values are used for the first calculation.
const fieldKey = (field) => field.name || field.id;
const readToolInputs = (form) => {
  const data = {};
  form.querySelectorAll("input, select, textarea").forEach((field) => {
    const key = fieldKey(field);
    if (!key || ["submit", "button", "hidden", "file"].includes(field.type)) return;
    data[key] = field.type === "checkbox" || field.type === "radio" ? field.checked : field.value;
  });
  return data;
};
const applyToolInputs = (form, data) => {
  Object.entries(data || {}).forEach(([key, value]) => {
    const field = form.querySelector(`[name="${CSS.escape(key)}"]`) || form.querySelector(`#${CSS.escape(key)}`);
    if (!field) return;
    if (field.type === "checkbox" || field.type === "radio") field.checked = Boolean(value);
    else field.value = value;
  });
};

document.querySelectorAll(".tool-form").forEach((form) => {
  const formId = form.id;
  if (!formId) return;
  const storageKey = `orion-tool-${formId}`;

  try {
    applyToolInputs(form, JSON.parse(localStorage.getItem(storageKey) || "{}"));
  } catch (e) {
    // Ignore unreadable saved values and keep the defaults.
  }

  const persist = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(readToolInputs(form)));
    } catch (e) {
      // Storage unavailable (private mode): values last for this visit only.
    }
  };
  form.addEventListener("input", persist);
  form.addEventListener("change", (event) => {
    persist();
    trackAnalyticsEvent("tool_input_changed", {
      form_id: formId,
      input_name: fieldKey(event.target) || "",
      page_path: window.location.pathname
    });
  });
});

// Copy format selector for tools
const copyFormatSelectors = document.querySelectorAll(".copy-format-btn");
copyFormatSelectors.forEach((btn) => {
  btn.addEventListener("click", () => {
    const group = btn.parentElement;
    group.querySelectorAll(".copy-format-btn").forEach((b) => {
      b.classList.remove("active");
    });
    btn.classList.add("active");
    trackAnalyticsEvent("copy_format_selected", {
      format: btn.dataset.format,
      page_path: window.location.pathname
    });
  });
});


// Homepage product-stage navigator. Keeps the first interaction useful even for visitors
// who do not yet know the vocabulary of product-development services.
const projectNavigator = document.querySelector("[data-project-navigator]");
if (projectNavigator) {
  const journeys = {
    idea: {
      title: "First clarify what deserves to be built.",
      copy: "Start by defining the user need and what must be true for the idea to be worth developing. A cheap learning loop beats an impressive prototype that answers the wrong question.",
      tool: ["Product Purpose Framework", "tools/product-purpose.html"],
      guide: ["How to validate a product idea", "guides/how-to-validate-a-product-idea.html"],
      contact: "contact/index.html?stage=idea"
    },
    prototype: {
      title: "Use the prototype to decide what to learn next.",
      copy: "A prototype is evidence, not the finish line. Separate what it proves from what is still unknown, then choose the next prototype or engineering task around the highest-risk assumption.",
      tool: ["Prototype Strategy Tool", "tools/prototype-strategy-tool.html"],
      guide: ["Prototyping vs production", "guides/prototyping-vs-production-startup-guide.html"],
      contact: "contact/index.html?stage=prototype"
    },
    manufacture: {
      title: "Make the manufacturing logic explicit before tooling locks it in.",
      copy: "Review part count, assembly, tolerances, process capability, expected volume, supplier assumptions, and where tooling spend is actually justified.",
      tool: ["Manufacturing Payoff Visualiser", "tools/manufacturing-payoff.html"],
      guide: ["Estimate manufacturing cost", "guides/how-to-estimate-manufacturing-cost.html"],
      contact: "contact/index.html?stage=manufacture"
    },
    launch: {
      title: "Connect the physical product to the commercial model.",
      copy: "A viable product needs more than a good prototype. Test COGS, channel margin, fixed costs, volume, cash timing, and the assumptions that could make the launch plan fail.",
      tool: ["Hardware Business Case Builder", "tools/hardware-business-case-builder.html"],
      guide: ["Build a hardware business case", "guides/building-a-hardware-business-case.html"],
      contact: "contact/index.html?stage=launch"
    }
  };

  const buttons = projectNavigator.querySelectorAll("[data-journey-stage]");
  const title = projectNavigator.querySelector("[data-journey-title]");
  const copy = projectNavigator.querySelector("[data-journey-copy]");
  const tool = projectNavigator.querySelector("[data-journey-tool]");
  const guide = projectNavigator.querySelector("[data-journey-guide]");
  const contact = projectNavigator.querySelector("[data-journey-contact]");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const journey = journeys[button.dataset.journeyStage];
      if (!journey) return;

      buttons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      title.textContent = journey.title;
      copy.textContent = journey.copy;
      tool.textContent = journey.tool[0];
      tool.href = journey.tool[1];
      guide.textContent = journey.guide[0];
      guide.href = journey.guide[1];
      contact.href = journey.contact;
      projectNavigator.querySelector("[data-journey-result]")?.classList.add("is-active");

      trackAnalyticsEvent("project_stage_selected", {
        stage: button.dataset.journeyStage,
        page_path: window.location.pathname
      });
    });
  });
}

// Static-site enquiry builder. The generated text stays in the browser and is only
// handed to the visitor's email client if they explicitly click the email button.
const projectBrief = document.querySelector("[data-project-brief]");
if (projectBrief) {
  const form = projectBrief.querySelector("[data-project-brief-form]");
  const output = projectBrief.querySelector("[data-project-brief-output]");
  const mailto = projectBrief.querySelector("[data-project-brief-mailto]");
  const params = new URLSearchParams(window.location.search);
  const stageHints = {
    idea: "Idea / opportunity",
    prototype: "Working prototype",
    manufacture: "Design for manufacture",
    launch: "Launch / commercial planning"
  };

  if (stageHints[params.get("stage")]) {
    form.querySelector("#briefStage").value = stageHints[params.get("stage")];
  }

  const buildProjectBrief = () => {
    const value = (selector) => form.querySelector(selector)?.value.trim() || "";
    const name = value("#briefName");
    const company = value("#briefCompany");
    const stage = value("#briefStage");
    const need = value("#briefNeed");
    const decision = value("#briefDecision");
    const volume = value("#briefVolume");
    const timing = value("#briefTiming");
    const storedTool = readStoredToolLeadContext();

    const lines = ["Hi Andrew,", "", "I would like some help with a physical-product project.", ""];
    if (name) lines.push(`Name: ${name}`);
    if (company) lines.push(`Company / project: ${company}`);
    if (stage) lines.push(`Current stage: ${stage}`);
    if (need) lines.push(`Help needed: ${need}`);
    if (volume) lines.push(`Expected volume: ${volume}`);
    if (timing) lines.push(`Timing: ${timing}`);
    if (decision) lines.push("", "Main question / uncertainty:", decision);

    if (storedTool && new URLSearchParams(window.location.search).get("source") === "tool") {
      lines.push("", `I also arrived from the ${storedTool.toolTitle || "Orion Design tool"}.`);
    }

    lines.push("", "Thanks,");
    if (name) lines.push(name);

    const body = lines.join("\n").trim();
    output.value = body;
    const subjectBase = company || need || stage || "product design enquiry";
    mailto.href = `mailto:hello@oriondesign.xyz?subject=${encodeURIComponent(`Product design enquiry: ${subjectBase}`)}&body=${encodeURIComponent(body)}`;
    return body;
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    buildProjectBrief();
    output.focus();
    trackAnalyticsEvent("project_brief_built", { page_path: window.location.pathname });
  });

  form.addEventListener("input", buildProjectBrief);
  form.addEventListener("change", buildProjectBrief);
  form.addEventListener("reset", () => {
    window.setTimeout(() => {
      output.value = "";
      mailto.href = "mailto:hello@oriondesign.xyz";
    }, 0);
  });

  buildProjectBrief();
}

// ---------------------------------------------------------------------------
// Product plan notebook: every tool can save its current result into one plan,
// which tools/product-plan-builder.html arranges into a business-plan outline.
// Everything stays in this browser's localStorage.
// ---------------------------------------------------------------------------
const OrionPlan = (() => {
  const key = "orion-product-plan-v1";
  const empty = () => ({ project: {}, entries: {}, notes: {} });
  const load = () => {
    try {
      return { ...empty(), ...JSON.parse(localStorage.getItem(key) || "{}") };
    } catch (e) {
      return empty();
    }
  };
  const save = (plan) => {
    try {
      localStorage.setItem(key, JSON.stringify(plan));
      document.dispatchEvent(new CustomEvent("orion-plan-change"));
      return true;
    } catch (e) {
      return false;
    }
  };
  const update = (fn) => {
    const plan = load();
    fn(plan);
    return save(plan);
  };
  const count = () => Object.keys(load().entries).length;
  const siteBase = () => {
    const href = document.querySelector(".brand")?.getAttribute("href") || "/";
    return href.replace(/index\.html$/, "");
  };
  const planUrl = () => `${siteBase()}tools/product-plan-builder.html`;
  const restoreInputs = (formId, values) => {
    try {
      localStorage.setItem(`orion-tool-${formId}`, JSON.stringify(values || {}));
    } catch (e) {
      /* ignore */
    }
  };
  return { load, save, update, count, siteBase, planUrl, restoreInputs, key };
})();
window.OrionPlan = OrionPlan;

// "My plan" link in the main navigation once anything has been saved.
const syncPlanNavLink = () => {
  const navEl = document.querySelector("[data-nav]");
  if (!navEl) return;
  const total = OrionPlan.count();
  let link = navEl.querySelector("[data-plan-nav]");
  if (!total) {
    link?.remove();
    return;
  }
  if (!link) {
    link = document.createElement("a");
    link.setAttribute("data-plan-nav", "");
    link.className = "nav-plan";
    link.href = OrionPlan.planUrl();
    const cta = navEl.querySelector(".nav-cta");
    if (cta) cta.before(link);
    else navEl.append(link);
  }
  if (/product-plan-builder\.html$/.test(window.location.pathname)) link.classList.add("active");
  link.innerHTML = `My plan <span class="nav-plan-count">${total}</span>`;
  link.setAttribute("aria-label", `My product plan, ${total} saved result${total === 1 ? "" : "s"}`);
};
syncPlanNavLink();
document.addEventListener("orion-plan-change", syncPlanNavLink);
window.addEventListener("storage", (event) => {
  if (event.key === OrionPlan.key) syncPlanNavLink();
});

// "Save to my product plan" on every tool page.
const planToolForm = document.querySelector(".tool-form");
const planCopyShell = document.querySelector(".copy-shell");
if (planToolForm && planCopyShell) {
  const canonical = document.querySelector('link[rel="canonical"]')?.href || window.location.href;
  const toolPath = canonical.replace(/^https?:\/\/[^/]+\//, "");
  const toolId = toolPath.split("/").pop().replace(/\.html$/, "");
  const row = planCopyShell.querySelector(".button-row") || planCopyShell;

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "button button-primary button-plan";
  const status = document.createElement("p");
  status.className = "plan-save-status";
  status.setAttribute("aria-live", "polite");
  row.append(saveButton);
  planCopyShell.append(status);

  const showStatus = () => {
    const entry = OrionPlan.load().entries[toolId];
    saveButton.textContent = entry ? "Update in my product plan" : "Save to my product plan";
    status.innerHTML = entry
      ? `Saved ${new Date(entry.savedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}. <a href="${OrionPlan.planUrl()}">View your product plan →</a>`
      : `Build a product plan as you go: results from every tool collect in one place you can print, download or share. <a href="${OrionPlan.planUrl()}">How it works</a>`;
  };

  saveButton.addEventListener("click", () => {
    const context = buildToolLeadContext();
    const ok = OrionPlan.update((plan) => {
      plan.entries[toolId] = {
        id: toolId,
        title: context.toolTitle,
        path: toolPath,
        formId: planToolForm.id,
        summary: (document.querySelector(".copy-output")?.value || context.resultSummary).trim().slice(0, 4000),
        inputs: context.inputs.slice(0, 24),
        values: readToolInputs(planToolForm),
        level: document.querySelector(".insight-panel")?.className.match(/is-(good|borderline|worrying|info)/)?.[1] || "",
        savedAt: new Date().toISOString()
      };
    });
    if (!ok) {
      status.textContent = "This browser is blocking storage, so the plan can't be saved. Use Copy result summary instead.";
      return;
    }
    showStatus();
    saveButton.classList.add("is-saved");
    window.setTimeout(() => saveButton.classList.remove("is-saved"), 1200);
    trackAnalyticsEvent("plan_result_saved", { tool_id: toolId, plan_size: OrionPlan.count() });
  });

  showStatus();
}

// ---------------------------------------------------------------------------
// Product journey: the order tools are best used in, grouped into the seven
// product-plan sections. Shared by the "where this fits" strip on tool pages
// and the Product Plan Builder.
// ---------------------------------------------------------------------------
const OrionJourney = [
  { id: "opportunity", title: "Opportunity and concept", tools: [
    ["product-purpose", "Product Purpose Framework"],
    ["pugh-concept-selector", "Pugh Concept Selector"],
    ["hardware-business-case-builder", "Hardware Business Case Builder"]
  ] },
  { id: "development", title: "Development and prototyping", tools: [
    ["product-design-process-map", "Product Design Process Map"],
    ["timeline-planner", "Product Development Timeline Planner"],
    ["prototype-strategy-tool", "Prototype Strategy Tool"],
    ["test-plan-builder", "Product Test Plan Builder"],
    ["assembly-time", "Assembly Time Estimator"],
    ["dfm-checker", "Injection Moulding DFM Checker"],
    ["tolerance-stack-up", "Tolerance Stack-up Calculator"],
    ["snap-fit-calculator", "Snap-fit Calculator"],
    ["bracket-deflection-calculator", "Bracket Deflection Calculator"],
    ["temperature-rise-estimator", "Enclosure Temperature Rise Estimator"],
    ["material-selector", "Plastic Material Selector"]
  ] },
  { id: "manufacturing", title: "Manufacturing and cost", tools: [
    ["manufacturing-payoff", "Manufacturing Payoff Visualiser"],
    ["bom-builder", "Bill of Materials Cost Builder"],
    ["product-cost-estimator", "Product Cost Estimator"],
    ["landed-cost-calculator", "Landed Cost Calculator"],
    ["production-strategy-planner", "Production Strategy Planner"],
    ["ready-for-tooling", "Ready to Commit to Tooling?"],
    ["change-request-builder", "Change Request Builder"]
  ] },
  { id: "sustainability", title: "Sustainability and product life", tools: [
    ["carbon-footprint", "Carbon Footprint Estimator"],
    ["product-lifecycle-explorer", "Product Lifecycle Explorer"]
  ] },
  { id: "market", title: "Route to market and margins", tools: [
    ["route-to-market-simulator", "Target COGS by Route to Market"],
    ["revenue-margin-simulator", "Launch Margin Planner"],
    ["pricing-ladder", "Pricing Ladder"],
    ["break-even-calculator", "Break-even Calculator"]
  ] },
  { id: "funding", title: "Funding and cash", tools: [
    ["startup-cost-planner", "Startup Cost Planner"],
    ["cashflow-projection", "Cashflow Projection Tool"],
    ["crowdfunding-planner", "Crowdfunding Planner"],
    ["investor-metrics-kpis", "Investor Metrics and KPIs"]
  ] },
  { id: "ip", title: "IP, partners and compliance", tools: [
    ["ready-for-manufacturer", "Ready to Talk to a Manufacturer?"],
    ["certification-readiness", "Certification Readiness Checklist"],
    ["nda-generator", "NDA Generator"],
    ["rfq-pack-builder", "RFQ Pack Builder"]
  ] }
];
window.OrionJourney = OrionJourney;

const journeyToolPage = document.querySelector(".tool-layout");
const journeySteps = OrionJourney.flatMap((section, sectionIndex) =>
  section.tools.map(([id, name]) => ({ id, name, section, sectionIndex }))
);
const journeyCurrentId = window.location.pathname.split("/").pop().replace(/\.html$/, "");
const journeyIndex = journeySteps.findIndex((step) => step.id === journeyCurrentId);

if (journeyToolPage && journeyIndex !== -1) {
  const step = journeySteps[journeyIndex];
  const prev = journeySteps[journeyIndex - 1];
  const next = journeySteps[journeyIndex + 1];
  const strip = document.createElement("section");
  strip.className = "journey-strip";
  strip.setAttribute("aria-label", "Where this tool fits in your product plan");
  const dots = OrionJourney.map((section, i) => {
    const state = i < step.sectionIndex ? "is-past" : i === step.sectionIndex ? "is-current" : "";
    return `<a class="journey-dot ${state}" href="${section.tools[0][0]}.html" title="${i + 1}. ${section.title}"><span class="visually-hidden">${i + 1}. ${section.title}</span></a>`;
  }).join("");
  strip.innerHTML = `
    <div class="container journey-shell">
      <div class="journey-where">
        <p class="journey-label">Where this fits · Section ${step.sectionIndex + 1} of ${OrionJourney.length}</p>
        <p class="journey-title">${step.section.title}</p>
        <div class="journey-dots">${dots}</div>
      </div>
      <div class="journey-links">
        ${prev ? `<a class="journey-link journey-prev" href="${prev.id}.html"><small>Previous</small>${prev.name}</a>` : ""}
        ${next ? `<a class="journey-link journey-next" href="${next.id}.html"><small>Next step</small>${next.name}</a>` : `<a class="journey-link journey-next" href="product-plan-builder.html"><small>Final step</small>Review your product plan</a>`}
      </div>
    </div>`;
  const hostSection = journeyToolPage.closest("section");
  hostSection?.after(strip);
  strip.querySelectorAll("a").forEach((link) =>
    link.addEventListener("click", () =>
      trackAnalyticsEvent("journey_nav_click", { from: journeyCurrentId, to: link.getAttribute("href") })
    )
  );
}

// ---------------------------------------------------------------------------
// "What this means for you": a plain-English reading of the current result.
// Tool scripts call window.OrionInsight.show({...}) after each recalculation.
//   level: "good" | "borderline" | "worrying" | "info"
//   headline: one sentence; points: short explanations; next: { href, label }
// The headline is also appended to the copy/save summary so it lands in the plan
// (pass appendToCopy: false where the copy text is a document, e.g. the NDA draft).
// ---------------------------------------------------------------------------
const OrionInsight = (() => {
  const labels = {
    good: "Looks healthy",
    borderline: "Worth a closer look",
    worrying: "Needs attention",
    info: "What this means"
  };
  let lastTracked = "";

  const host = () => {
    let panel = document.querySelector("[data-insight]");
    if (panel) return panel;
    const anchor = document.querySelector(".tool-card .copy-shell");
    if (!anchor) return null;
    panel = document.createElement("section");
    panel.className = "insight-panel";
    panel.setAttribute("data-insight", "");
    panel.setAttribute("aria-live", "polite");
    panel.setAttribute("aria-label", "What this result means for you");
    anchor.before(panel);
    return panel;
  };

  const show = ({ level = "info", headline = "", points = [], next, appendToCopy = true } = {}) => {
    const panel = host();
    if (!panel || !headline) return;
    const safeLevel = labels[level] ? level : "info";
    panel.className = `insight-panel is-${safeLevel}`;
    panel.replaceChildren();

    const label = document.createElement("p");
    label.className = "insight-label";
    label.textContent = `What this means for you · ${labels[safeLevel]}`;
    const title = document.createElement("p");
    title.className = "insight-headline";
    title.textContent = headline;
    panel.append(label, title);

    if (points.length) {
      const list = document.createElement("ul");
      list.className = "insight-points";
      points.filter(Boolean).forEach((text) => {
        const item = document.createElement("li");
        item.textContent = text;
        list.append(item);
      });
      panel.append(list);
    }

    if (next?.href && next?.label) {
      const link = document.createElement("a");
      link.className = "text-link";
      link.href = next.href;
      link.textContent = `${next.label} →`;
      panel.append(link);
    }

    const copy = document.querySelector(".copy-output");
    if (appendToCopy && copy && copy.value && !copy.value.includes("What this means:")) {
      copy.value = `${copy.value}\nWhat this means: ${headline}`;
    }

    const signature = `${safeLevel}:${headline}`;
    if (signature !== lastTracked) {
      lastTracked = signature;
      trackAnalyticsEvent("tool_insight_shown", { level: safeLevel, page_path: window.location.pathname });
    }
  };

  return { show };
})();
window.OrionInsight = OrionInsight;

// ---------------------------------------------------------------------------
// Shareable result links: "Copy link to this result" encodes the inputs that differ
// from the tool's defaults in the URL hash (#r&id=value...). Opening the link restores
// them before the tool calculates. The hash is never sent to the server, so search
// engines see no duplicate URLs.
// ---------------------------------------------------------------------------
const shareForm = document.querySelector(".tool-form");
const shareFields = shareForm
  ? [...shareForm.querySelectorAll("input, select, textarea")].filter(
      (field) => fieldKey(field) && !["submit", "button", "hidden", "file"].includes(field.type)
    )
  : [];
const fieldDefault = (field) => {
  if (field.type === "checkbox" || field.type === "radio") return field.defaultChecked;
  if (field.tagName === "SELECT") return [...field.options].find((o) => o.defaultSelected)?.value ?? field.options[0]?.value ?? "";
  return field.defaultValue;
};
const fieldCurrent = (field) => (field.type === "checkbox" || field.type === "radio" ? field.checked : field.value);

const readSharedInputs = () => {
  const raw = window.location.hash.slice(1);
  if (!raw.startsWith("r&")) return null;
  const params = new URLSearchParams(raw.slice(2));
  const values = {};
  params.forEach((value, key) => {
    values[key] = value === "true" ? true : value === "false" ? false : value;
  });
  return values;
};

const applySharedInputs = (notify) => {
  const values = readSharedInputs();
  if (!shareForm || !values) return false;
  shareFields.forEach((field) => {
    const key = fieldKey(field);
    const value = key in values ? values[key] : fieldDefault(field);
    if (field.type === "checkbox" || field.type === "radio") field.checked = Boolean(value);
    else field.value = value;
    if (notify) {
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  return true;
};

// After applying a #r& link, rewrite the address so it holds only the current values
// (the older query-string mirroring above), with no stale hash that could override later edits.
const normaliseSharedAddress = () => {
  const url = new URL(window.location.href);
  shareFields
    .filter((field) => field.id && (field.type === "number" || field.type === "range" || field.tagName === "SELECT"))
    .forEach((field) => {
      if (field.value === "") url.searchParams.delete(field.id);
      else url.searchParams.set(field.id, field.value);
    });
  url.hash = "";
  window.history.replaceState({}, "", `${url.pathname}${url.search}`);
};

if (shareForm && applySharedInputs(false)) {
  normaliseSharedAddress();
  trackAnalyticsEvent("shared_result_opened", { page_path: window.location.pathname });
}
window.addEventListener("hashchange", () => {
  if (applySharedInputs(true)) normaliseSharedAddress();
});

const shareRow = document.querySelector(".copy-shell .button-row");
if (shareForm && shareRow) {
  const shareButton = document.createElement("button");
  shareButton.type = "button";
  shareButton.className = "button button-tertiary button-share";
  shareButton.textContent = "Copy link to this result";
  const shareStatus = document.createElement("p");
  shareStatus.className = "share-status";
  shareStatus.setAttribute("aria-live", "polite");
  shareRow.append(shareButton);
  shareRow.after(shareStatus);

  shareButton.addEventListener("click", async () => {
    const params = new URLSearchParams();
    shareFields.forEach((field) => {
      const current = fieldCurrent(field);
      if (String(current) !== String(fieldDefault(field))) params.set(fieldKey(field), String(current));
    });
    const query = params.toString();
    const url = `${window.location.origin}${window.location.pathname}${query ? `#r&${query}` : ""}`;
    let copied = false;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch (error) {
      copied = false;
    }
    shareStatus.replaceChildren();
    if (copied) {
      shareStatus.textContent = query
        ? "Link copied. Anyone who opens it sees this result with your numbers; nothing is stored on a server."
        : "Link copied. You are using the default example, so the link opens the tool as it is.";
    } else {
      shareStatus.textContent = "Copy this link: ";
      const input = document.createElement("input");
      input.type = "text";
      input.readOnly = true;
      input.value = url;
      input.className = "share-link-field";
      input.setAttribute("aria-label", "Link to this result");
      shareStatus.append(input);
      input.select();
    }
    trackAnalyticsEvent("result_link_copied", { page_path: window.location.pathname, changed_inputs: params.size ?? [...params].length });
  });
}

// ---------------------------------------------------------------------------
// Glossary hovers on guide pages: the first mention of up to eight glossary terms in the
// article text links to its definition on /knowledge/glossary.html and shows the definition
// on hover or keyboard focus. Data: /knowledge/glossary.json (built with the glossary page).
// ---------------------------------------------------------------------------
(() => {
  const article = document.querySelector(".article-content");
  if (!article || !/\/guides\/[^/]+\.html$/.test(window.location.pathname)) return;
  // The published site has these links baked in at build time (scripts/build/build-site.js).
  if (article.querySelector(".glossary-term")) return;
  const MAX_TERMS = 8;
  const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  fetch("../knowledge/glossary.json")
    .then((response) => (response.ok ? response.json() : []))
    .then((terms) => {
      const entries = terms
        .flatMap((term) => term.m.map((match) => ({ match, term })))
        .sort((a, b) => b.match.length - a.match.length);
      const used = new Set();
      const blocks = article.querySelectorAll("p, li");
      let added = 0;

      for (const block of blocks) {
        if (added >= MAX_TERMS) break;
        if (block.closest(".summary-card, .faq-card, .related-path-grid, .article-action-card, figure, a, h1, h2, h3")) continue;
        const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
          acceptNode: (node) => (node.parentElement.closest("a, strong, code, .glossary-term") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
        });
        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);

        for (const node of textNodes) {
          if (added >= MAX_TERMS) break;
          for (const { match, term } of entries) {
            if (used.has(term.id)) continue;
            const caseSensitive = match === match.toUpperCase();
            const re = new RegExp(`(^|[^\\w-])(${escapeRe(match)})(?=$|[^\\w-])`, caseSensitive ? "" : "i");
            const found = re.exec(node.nodeValue);
            if (!found) continue;
            const start = found.index + found[1].length;
            const after = node.splitText(start);
            after.splitText(found[2].length);
            const link = document.createElement("a");
            link.className = "glossary-term";
            link.href = `../knowledge/glossary.html#${term.id}`;
            link.setAttribute("data-definition", term.d);
            link.setAttribute("aria-label", `${found[2]}: ${term.d} (glossary)`);
            link.textContent = after.nodeValue;
            after.replaceWith(link);
            used.add(term.id);
            added += 1;
            break;
          }
        }
      }
    })
    .catch(() => {});
})();

// ---------------------------------------------------------------------------
// "Which input matters most?": a one-at-a-time sensitivity view for calculator tools.
// Each input is moved 10% down and up while the others stay put, and the change in
// the headline result is shown, largest effect first. Tools call:
//   window.OrionSensitivity.render({ after, id, title, inputs: [{ id, label }], compute(values), format, better })
// compute() receives { inputId: number } and must return the headline number.
// ---------------------------------------------------------------------------
window.OrionSensitivity = {
  render({ after, id = "sensitivityPanel", title = "Which input matters most?", inputs, compute, format = (v) => String(Math.round(v)), better = "lower", note = "" }) {
    if (!after || !inputs?.length || typeof compute !== "function") return;
    let panel = document.getElementById(id);
    if (!panel) {
      panel = document.createElement("section");
      panel.id = id;
      panel.className = "sensitivity-panel";
      after.after(panel);
    }
    const base = Object.fromEntries(inputs.map(({ id: fid }) => [fid, Number(document.getElementById(fid)?.value) || 0]));
    const baseResult = compute(base);
    if (!Number.isFinite(baseResult)) {
      panel.innerHTML = `<h2>${title}</h2><p class="helper-text">The sensitivity view needs a finite result to compare against.</p>`;
      return;
    }
    const rows = inputs
      .filter(({ id: fid }) => base[fid] !== 0)
      .map(({ id: fid, label }) => {
        const down = compute({ ...base, [fid]: base[fid] * 0.9 });
        const up = compute({ ...base, [fid]: base[fid] * 1.1 });
        const swing = Math.max(Math.abs(down - baseResult), Math.abs(up - baseResult));
        return { label, down, up, swing };
      })
      .filter((r) => Number.isFinite(r.down) && Number.isFinite(r.up))
      .sort((a, b) => b.swing - a.swing);
    const maxSwing = rows[0]?.swing || 1;
    const describe = (value) => {
      const diff = value - baseResult;
      if (Math.abs(diff) < 1e-9) return "no change";
      const good = better === "lower" ? diff < 0 : diff > 0;
      return `<span class="${good ? "sens-good" : "sens-bad"}">${diff > 0 ? "+" : "−"}${format(Math.abs(diff))}</span>`;
    };
    panel.innerHTML = `
      <h2>${title}</h2>
      <p class="helper-text">Each input moved 10% down and up, one at a time, from your current figures. Largest effect first.${note ? ` ${note}` : ""}</p>
      <div class="sens-rows">
        ${rows
          .map(
            (r) => `
          <div class="sens-row">
            <span class="sens-label">${r.label}</span>
            <span class="sens-bar"><span style="width:${Math.max(4, (r.swing / maxSwing) * 100)}%"></span></span>
            <span class="sens-values">−10%: ${describe(r.down)} · +10%: ${describe(r.up)}</span>
          </div>`
          )
          .join("")}
      </div>
      ${rows[0] ? `<p class="sens-summary">Most sensitive to <strong>${rows[0].label.replace(/^[A-Z](?![A-Z])/, (c) => c.toLowerCase())}</strong>: firm this figure up first.</p>` : ""}`;
  }
};


// "New since your last visit": on the homepage and guides index, list guides and tools
// published since this browser's previous visit. The visit date stays in localStorage;
// whats-new.json is a static file generated at build time. Nothing is sent anywhere.
const OrionNewSince = (() => {
  const box = document.querySelector("[data-new-since]");
  if (!box || !window.fetch) return null;
  const lastKey = "orion-last-visit-v1";
  const sessionKey = "orion-previous-visit-v1";
  let previous = null;
  try {
    // The first page view in a browser session moves the stored visit date forward,
    // and remembers the old one for the rest of the session so the note does not vanish on reload.
    if (sessionStorage.getItem(sessionKey) === null) {
      sessionStorage.setItem(sessionKey, localStorage.getItem(lastKey) || "");
      localStorage.setItem(lastKey, new Date().toISOString());
    }
    previous = sessionStorage.getItem(sessionKey) || null;
  } catch (e) {
    return null;
  }
  if (!previous) return null;

  const prefix = location.pathname.includes("/guides/") ? "../" : "";
  fetch(`${prefix}whats-new.json`, { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : []))
    .then((items) => {
      const fresh = items.filter((item) => item.added > previous);
      if (!fresh.length) return;
      const shown = fresh.slice(0, 6);
      const since = new Date(previous).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
      const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
      box.innerHTML =
        `<h2 id="new-since-title">New since your last visit (${esc(since)})</h2>` +
        `<ul>${shown
          .map((item) => `<li><a class="text-link-inline" href="${esc(prefix + item.path.replace(/^\//, ""))}">${esc(item.title)}</a> <span class="new-since-type">${esc(item.type)}</span></li>`)
          .join("")}</ul>` +
        (fresh.length > shown.length
          ? `<p class="new-since-more">And ${fresh.length - shown.length} more. <a class="text-link-inline" href="${prefix}whats-new/">See everything new</a>.</p>`
          : `<p class="new-since-more"><a class="text-link-inline" href="${prefix}whats-new/">What's new and corrections</a></p>`);
      box.hidden = false;
      trackAnalyticsEvent("new_since_shown", { count: fresh.length });
    })
    .catch(() => {});
  return true;
})();

// ---------------------------------------------------------------------------
// Chart text summaries: a Chart.js plugin that writes a plain-English summary
// under every chart after each update, so results can be read without seeing
// the chart (screen readers, print, AI assistants). Values are formatted with
// the chart's own tooltip or axis formatter where it has one.
// ---------------------------------------------------------------------------
if (window.Chart && typeof window.Chart.register === "function") {
  const plainNumber = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
  const formatterFor = (chart) => {
    const tooltipLabel = chart.options?.plugins?.tooltip?.callbacks?.label;
    const tick = chart.options?.scales?.y?.ticks?.callback || chart.options?.scales?.r?.ticks?.callback;
    return (dataset, datasetIndex, dataIndex) => {
      const raw = dataset.data[dataIndex];
      const value = typeof raw === "object" && raw !== null ? raw.y ?? raw.r ?? raw.x : raw;
      if (typeof tooltipLabel === "function") {
        try {
          const text = tooltipLabel.call({ chart }, {
            chart, dataset, datasetIndex, dataIndex, raw, label: chart.data.labels?.[dataIndex],
            parsed: ["doughnut", "pie", "polarArea"].includes(chart.config.type) ? value : { x: dataIndex, y: value, r: value },
            formattedValue: plainNumber.format(value)
          });
          const out = Array.isArray(text) ? text.join(" ") : String(text ?? "");
          // Strip a leading "Label: " so we can place the value ourselves.
          if (out) return out.replace(/^[^:]{1,60}:\s*/, "");
        } catch (error) { /* fall through */ }
      }
      if (typeof tick === "function") {
        try {
          const out = tick.call({ chart }, value, dataIndex, []);
          if (out !== undefined && out !== null && String(out) !== "") return String(out);
        } catch (error) { /* fall through */ }
      }
      return plainNumber.format(value);
    };
  };

  const summarise = (chart) => {
    const type = chart.config.type;
    const labels = (chart.data.labels || []).map(String);
    const datasets = (chart.data.datasets || []).filter((d) => !d.hidden && Array.isArray(d.data) && d.data.length);
    if (!datasets.length) return "";
    const fmt = formatterFor(chart);
    const num = (d, i) => { const v = d.data[i]; return Number(typeof v === "object" && v !== null ? v.y ?? v.r ?? v.x : v); };
    const name = (d, i) => d.label || (datasets.length > 1 ? `Series ${i + 1}` : "");
    const named = (d, i) => (name(d, i) ? `${name(d, i)}: ` : "");

    if (type === "doughnut" || type === "pie") {
      const d = datasets[0];
      const total = d.data.reduce((sum, _, i) => sum + (num(d, i) || 0), 0) || 1;
      const parts = labels.map((label, i) => ({ label, i, v: num(d, i) || 0 })).sort((a, b) => b.v - a.v);
      return `Breakdown: ${parts.map((p) => `${p.label} ${fmt(d, 0, p.i)} (${Math.round((p.v / total) * 100)}%)`).join("; ")}. Largest share: ${parts[0].label}.`;
    }
    if (type === "radar") {
      return datasets.map((d, di) => {
        const pts = labels.map((label, i) => ({ label, i, v: num(d, i) }));
        const hi = [...pts].sort((a, b) => b.v - a.v)[0];
        const lo = [...pts].sort((a, b) => a.v - b.v)[0];
        const spread = hi.v === lo.v ? " All are equal." : ` Strongest: ${hi.label}; weakest: ${lo.label}.`;
        return `${named(d, di)}${pts.map((p) => `${p.label} ${fmt(d, di, p.i)}`).join(", ")}.${spread}`;
      }).join(" ");
    }
    if (type === "bar") {
      return datasets.map((d, di) => {
        const pts = labels.map((label, i) => ({ label, i, v: num(d, i) })).filter((p) => Number.isFinite(p.v));
        const hi = [...pts].sort((a, b) => b.v - a.v)[0];
        const prefix = named(d, di);
        return `${prefix}${pts.map((p) => `${p.label} ${fmt(d, di, p.i)}`).join("; ")}.${pts.length > 1 ? ` Highest: ${hi.label}.` : ""}`;
      }).join(" ");
    }
    // Line (and anything else with an x axis): start, end, extremes and zero crossings.
    const xLabel = (i) => labels[i] ?? String(i + 1);
    const axisTitle = chart.options?.scales?.x?.title?.text;
    const at = (i) => (axisTitle ? `${axisTitle} ${xLabel(i)}` : xLabel(i));
    const lines = datasets.map((d, di) => {
      const n = d.data.length;
      const values = d.data.map((_, i) => num(d, i));
      let min = 0; let max = 0;
      values.forEach((v, i) => { if (v < values[min]) min = i; if (v > values[max]) max = i; });
      let crossing = "";
      for (let i = 1; i < n; i += 1) {
        if ((values[i - 1] < 0 && values[i] >= 0) || (values[i - 1] >= 0 && values[i] < 0)) {
          crossing = ` It ${values[i] >= 0 ? "turns positive" : "turns negative"} between ${xLabel(i - 1)} and ${xLabel(i)}.`;
          break;
        }
      }
      const extremes = min !== 0 && min !== n - 1 ? ` Lowest ${fmt(d, di, min)} at ${at(min)}.` : max !== 0 && max !== n - 1 ? ` Highest ${fmt(d, di, max)} at ${at(max)}.` : "";
      return `${named(d, di)}${fmt(d, di, 0)} at ${at(0)}, ${fmt(d, di, n - 1)} at ${at(n - 1)}.${extremes}${crossing}`;
    });
    if (datasets.length > 1) {
      const last = labels.length - 1;
      const ranked = datasets.map((d, di) => ({ d, di, v: num(d, last) })).sort((a, b) => a.v - b.v);
      lines.push(`At ${at(last)}, lowest: ${name(ranked[0].d, ranked[0].di)}.`);
    }
    return lines.join(" ");
  };

  window.Chart.register({
    id: "orionTextSummary",
    afterUpdate(chart) {
      const canvas = chart.canvas;
      if (!canvas || !canvas.id) return;
      const host = canvas.closest(".chart-shell") || canvas.parentElement;
      const summaryId = `${canvas.id}-summary`;
      let summary = document.getElementById(summaryId);
      if (!summary) {
        summary = document.createElement("p");
        summary.id = summaryId;
        summary.className = "chart-summary";
        summary.setAttribute("aria-live", "polite");
        host.after(summary);
        canvas.setAttribute("aria-describedby", summaryId);
        if (!canvas.getAttribute("role")) canvas.setAttribute("role", "img");
        if (!canvas.getAttribute("aria-label")) {
          canvas.setAttribute("aria-label", document.querySelector("h1")?.textContent.trim() ? `${document.querySelector("h1").textContent.trim()} chart` : "Result chart");
        }
      }
      let text = "";
      try {
        text = summarise(chart);
      } catch (error) {
        text = "";
      }
      summary.textContent = text ? `In words: ${text}` : "";
    }
  });
}

// ---------------------------------------------------------------------------
// Low / likely / high ranges for costing tools. A tool calls
//   window.OrionRange.attach({ formId, drivers: [{ id, label }], compute(get), format, noun })
// (drivers may also be a function returning that list, re-read on every update)
// where compute(get) returns the result using get(id) for every input it needs.
// "Likely" is the value in the tool's own form; low/high default to -15% / +30%
// (early estimates overrun more often than they undershoot) until the visitor sets them.
// ---------------------------------------------------------------------------
window.OrionRange = {
  attach({ formId, drivers, compute, format, noun = "result", after }) {
    const form = document.getElementById(formId);
    // drivers may be a function, for tools (such as the BOM builder) whose most uncertain
    // inputs depend on what has been entered; the table is rebuilt when the list changes.
    const driverList = () => (typeof drivers === "function" ? drivers() : drivers) || [];
    if (!form || !drivers || (Array.isArray(drivers) && !drivers.length)) return;
    const read = (id) => Number(document.getElementById(id)?.value) || 0;
    const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const rowsFor = (list) => list.map(({ id, label }) => `
      <tr>
        <th scope="row">${escape(label)}</th>
        <td><input type="number" min="0" step="any" inputmode="decimal" id="${id}Low" aria-label="${escape(label)}: low"></td>
        <td class="range-likely" data-likely="${id}"></td>
        <td><input type="number" min="0" step="any" inputmode="decimal" id="${id}High" aria-label="${escape(label)}: high"></td>
      </tr>`).join("");
    const panel = document.createElement("details");
    panel.className = "range-panel";
    panel.innerHTML = `
      <summary>Add a range: low / likely / high</summary>
      <p class="range-note">Early estimates are uncertain. "Likely" is the value in the form above. Enter what each figure could realistically be at best and worst; blanks default to −15% and +30% of likely, because early costs overrun more often than they come in under.</p>
      <div class="range-table-wrap">
        <table class="tool-table range-table">
          <thead><tr><th scope="col">Driver</th><th scope="col">Low</th><th scope="col">Likely</th><th scope="col">High</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="range-bar" aria-hidden="true"><span class="range-bar-fill"></span><span class="range-bar-likely"></span></div>
      <p class="range-result" aria-live="polite"></p>`;
    (after ? document.querySelector(after) : form).after(panel);

    // Typed lows and highs, kept by input id so they survive the table being rebuilt.
    const entered = {};
    let signature = "";
    const syncRows = (list) => {
      const next = JSON.stringify(list.map(({ id, label }) => [id, label]));
      if (next === signature) return;
      panel.querySelectorAll(".range-table input").forEach((input) => { entered[input.id] = input.value; });
      const focusedId = panel.contains(document.activeElement) ? document.activeElement.id : "";
      panel.querySelector(".range-table tbody").innerHTML = rowsFor(list);
      panel.querySelectorAll(".range-table input").forEach((input) => { if (entered[input.id]) input.value = entered[input.id]; });
      if (focusedId) document.getElementById(focusedId)?.focus();
      signature = next;
    };

    const value = (id, which) => {
      const likely = read(id);
      const input = document.getElementById(`${id}${which}`);
      const typed = input && input.value !== "" ? Number(input.value) : NaN;
      if (Number.isFinite(typed)) return typed;
      return which === "Low" ? likely * 0.85 : likely * 1.3;
    };
    const run = (overrides) => compute((id) => (id in overrides ? overrides[id] : read(id)));

    const update = () => {
      const drivers = driverList();
      if (!drivers.length) {
        panel.hidden = true;
        return;
      }
      panel.hidden = false;
      syncRows(drivers);
      drivers.forEach(({ id }) => {
        const cell = panel.querySelector(`[data-likely="${id}"]`);
        if (cell) cell.textContent = String(read(id));
        const low = document.getElementById(`${id}Low`);
        const high = document.getElementById(`${id}High`);
        if (low) low.placeholder = String(+(read(id) * 0.85).toFixed(2));
        if (high) high.placeholder = String(+(read(id) * 1.3).toFixed(2));
      });
      const lows = Object.fromEntries(drivers.map(({ id }) => [id, value(id, "Low")]));
      const highs = Object.fromEntries(drivers.map(({ id }) => [id, value(id, "High")]));
      const likely = run({});
      // Some drivers push the result down as they rise (conversion in a business case) and
      // others push it up (unit cost), so each end of the range takes, per driver, whichever
      // of its low or high moves the result that way. For all-cost tools this is simply all lows / all highs.
      const ends = drivers.map(({ id, label }) => ({ id, label, atLow: run({ [id]: lows[id] }), atHigh: run({ [id]: highs[id] }) }));
      const pick = (lowest) => Object.fromEntries(ends.map(({ id, atLow, atHigh }) =>
        [id, (atHigh < atLow) === lowest ? highs[id] : lows[id]]));
      const low = run(pick(true));
      const high = run(pick(false));
      const swings = ends
        .map(({ label, atLow, atHigh }) => ({ label, swing: atLow === atHigh ? 0 : Math.abs(atHigh - atLow) }))
        .sort((a, b) => (b.swing === a.swing ? 0 : b.swing > a.swing ? 1 : -1));
      const swingText = (swing) => (Number.isFinite(swing) ? format(swing) : "enough to put it out of reach");
      const inverted = drivers.some(({ id }) => lows[id] > read(id) || highs[id] < read(id));
      const span = Math.max(high - low, 1e-9);
      panel.querySelector(".range-bar-fill").style.cssText = "left:0;width:100%";
      const likelyAt = ((likely - low) / span) * 100;
      panel.querySelector(".range-bar-likely").style.left = `${Number.isFinite(likelyAt) ? Math.min(100, Math.max(0, likelyAt)) : likely === low ? 0 : 100}%`;
      const top = swings[0];
      const second = swings[1];
      panel.querySelector(".range-result").textContent =
        `With these ranges the ${noun} could be ${format(low)} to ${format(high)} (likely ${format(likely)}). ` +
        `${top.label} widens it most (${Number.isFinite(top.swing) ? "a swing of " : ""}${swingText(top.swing)})` +
        (second && second.swing > 0 ? `, then ${second.label.toLowerCase()} (${swingText(second.swing)}). ` : ". ") +
        `A firm quote or test on ${top.label.toLowerCase()} would do most to narrow the estimate.` +
        (inverted ? " Note: at least one low is above, or high below, its likely value." : "");
    };
    panel.addEventListener("input", update);
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    document.querySelectorAll("[data-tool-preset]").forEach((button) => button.addEventListener("click", () => setTimeout(update, 0)));
    panel.addEventListener("toggle", () => {
      if (panel.open) trackAnalyticsEvent("range_panel_opened", { page_path: window.location.pathname });
    });
    update();
  }
};


// Currency switcher on tools that show money: relabels the form and reloads so every
// formatter, chart and copy summary uses the chosen symbol. Inputs survive via the saved tool inputs.
// Runs after DOMContentLoaded so the tool scripts (loaded after main.js) have built their formatters.
document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector(".tool-form");
  if (!form) return;
  const labels = [...form.querySelectorAll("label, legend, .field-hint, .helper-text")];
  const moneyPattern = /\(GBP\)|\(£|GBP\b|£/;
  if (!OrionCurrency.wasUsed() && !labels.some((node) => moneyPattern.test(node.textContent))) return;

  const code = OrionCurrency.code();
  if (code !== "GBP") {
    const symbol = OrionCurrency.symbol();
    [...labels, ...document.querySelectorAll("main th")].forEach((node) => {
      node.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE && moneyPattern.test(child.textContent)) {
          child.textContent = child.textContent.replace(/GBP\b/g, code).replace(/£/g, symbol);
        }
      });
    });
  }

  const wrap = document.createElement("div");
  wrap.className = "currency-switch";
  const id = "orionCurrencySelect";
  wrap.innerHTML = `
    <label for="${id}">Currency shown</label>
    <select id="${id}">
      ${Object.entries(OrionCurrency.options).map(([value, { label }]) => `<option value="${value}"${value === code ? " selected" : ""}>${label}</option>`).join("")}
    </select>
    <span class="currency-switch-note">Display only: enter figures in the currency you choose; nothing is converted.</span>`;
  form.before(wrap);
  wrap.querySelector("select").addEventListener("change", (event) => {
    OrionCurrency.set(event.target.value);
    trackAnalyticsEvent("currency_change", { currency: event.target.value });
    location.reload();
  });
});

// "Download as CSV" on every tool: inputs and results as rows (Section, Item, Value).
// Results come from the tool's copy summary ("Label: value" lines), so every tool exports the same way.
(() => {
  const form = document.querySelector(".tool-form");
  const row = document.querySelector(".copy-shell .button-row");
  const output = document.querySelector(".copy-output");
  if (!form || !row || !output) return;
  // Tools with their own, richer CSV export (such as the timeline planner) keep that instead.
  if ([...document.querySelectorAll("main button")].some((el) => /\bCSV\b/.test(el.textContent))) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button button-tertiary button-csv";
  button.textContent = "Download as CSV";
  row.append(button);

  const cell = (value) => {
    // Neutralise spreadsheet formulas in typed text, then quote where needed.
    let text = String(value ?? "").replace(/\r?\n/g, " ").trim();
    if (/^[=+@]/.test(text)) text = `'${text}`;
    return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  button.addEventListener("click", () => {
    const { rows, toolId, date } = buildResultRows(output);
    const csv = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `orion-${toolId}-${date}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    trackAnalyticsEvent("result_csv_download", { tool_id: toolId });
  });
})();

// Print-friendly result view on every tool: a "Print this result" button next to copy/share,
// and a print stylesheet (body.tool-print-page in styles.css) that keeps the inputs, results,
// interpretation and chart and hides navigation, controls and article content.
(() => {
  const form = document.querySelector(".tool-form");
  const row = document.querySelector(".copy-shell .button-row");
  const layout = form?.closest(".tool-layout");
  if (!form || !row || !layout) return;
  document.body.classList.add("tool-print-page");
  layout.closest("section")?.classList.add("tool-print-section");

  const meta = document.createElement("p");
  meta.className = "tool-print-meta";
  const canonical = document.querySelector('link[rel="canonical"]')?.href || window.location.href;
  const setMeta = () => {
    const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    meta.textContent = `Printed ${date} from ${canonical.replace(/^https?:\/\//, "")}. Figures are estimates for planning; check them with suppliers and advisers.`;
  };
  setMeta();
  layout.before(meta);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "button button-tertiary button-print";
  button.textContent = "Print this result";
  row.append(button);
  button.addEventListener("click", () => {
    setMeta();
    trackAnalyticsEvent("result_print", { page_path: window.location.pathname });
    window.print();
  });
})();

// Rows shared by the CSV and Markdown exports: [Section, Item, Value].
// Results come from the tool's copy summary ("Label: value" lines).
function buildResultRows(output) {
    const context = buildToolLeadContext();
    const canonical = document.querySelector('link[rel="canonical"]')?.href || window.location.href;
    const toolId = canonical.split("/").pop().replace(/\.html$/, "") || "tool";
    const date = new Date().toISOString().slice(0, 10);
    const rows = [
      ["Section", "Item", "Value"],
      ["About", "Tool", context.toolTitle],
      ["About", "Page", canonical],
      ["About", "Exported", date],
      ["About", "Currency shown", window.OrionCurrency ? window.OrionCurrency.code() : "GBP"]
    ];
    context.inputs.forEach(({ label, value }) => rows.push(["Input", label, value]));
    output.value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line, index) => {
        const split = line.indexOf(": ");
        if (index === 0 && split < 0) return; // the summary's title line
        rows.push(split > 0 ? ["Result", line.slice(0, split).replace(/^[-•]\s*/, ""), line.slice(split + 2)] : ["Result", line.replace(/^[-•]\s*/, ""), ""]);
      });
    return { rows, toolId, date, title: context.toolTitle, canonical };
}

// "Copy as Markdown" next to the CSV button: the same rows as a Markdown summary for notes, tickets or docs.
(() => {
  const csvButton = document.querySelector(".button-csv");
  const output = document.querySelector(".copy-output");
  if (!csvButton || !output) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button button-tertiary button-markdown";
  button.textContent = "Copy as Markdown";
  csvButton.after(button);
  const status = document.createElement("p");
  status.className = "share-status markdown-status";
  status.setAttribute("aria-live", "polite");
  csvButton.closest(".button-row").after(status);
  const esc = (text) => String(text ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
  button.addEventListener("click", async () => {
    const { rows, toolId, date, title, canonical } = buildResultRows(output);
    const inputs = rows.filter((r) => r[0] === "Input");
    const results = rows.filter((r) => r[0] === "Result");
    const currency = rows.find((r) => r[1] === "Currency shown")?.[2] || "GBP";
    const md = [
      `## ${title}`,
      "",
      `Source: ${canonical} · Exported ${date} · Currency shown: ${currency}`,
      "",
      "### Inputs",
      "",
      "| Input | Value |",
      "| --- | --- |",
      ...inputs.map((r) => `| ${esc(r[1])} | ${esc(r[2])} |`),
      "",
      "### Results",
      "",
      ...results.map((r) => (r[2] ? `- **${esc(r[1])}:** ${esc(r[2])}` : `- ${esc(r[1])}`)),
      "",
      "_Estimates for planning; check figures with suppliers and advisers._",
      ""
    ].join("\n");
    let copied = false;
    try {
      await navigator.clipboard.writeText(md);
      copied = true;
    } catch (error) {
      copied = false;
    }
    status.replaceChildren();
    if (copied) {
      status.textContent = "Markdown copied. Paste it into notes, a document or a ticket.";
    } else {
      status.textContent = "Copy this Markdown: ";
      const area = document.createElement("textarea");
      area.readOnly = true;
      area.rows = 6;
      area.className = "copy-output";
      area.setAttribute("aria-label", "Markdown summary");
      area.value = md;
      status.append(area);
      area.select();
    }
    trackAnalyticsEvent("result_markdown_copy", { tool_id: toolId });
  });
})();

// ---------------------------------------------------------------------------
// Site search. The index is built by Pagefind at deploy time (_site/pagefind/,
// see pagefind.yml) and loaded only when someone opens search, a few KB at a time.
// Opens from the header button, any [data-search-open] element, or the "/" key.
// ---------------------------------------------------------------------------
(() => {
  const header = document.querySelector(".site-header .nav-shell");
  if (!header) return;
  // main.js sits at the site root, so the index lives next to it.
  const scriptEl = document.querySelector('script[src$="main.js"]');
  const siteRoot = new URL(".", scriptEl ? scriptEl.src : location.href);
  const rootHref = (rel) => new URL(rel, siteRoot).href;

  const types = [
    { test: /\/tools\/(?!index\.html)[^/]+\.html$/, label: "Tool", boost: 1.35 },
    { test: /glossary/, label: "Glossary", boost: 1.1 },
    { test: /\/guides\/(?!index\.html)[^/]+\.html$/, label: "Guide", boost: 1 },
    { test: /\/(knowledge|idea-to-manufacture|walkthrough|ready-to-launch)\//, label: "Guide", boost: 1 },
    { test: /\/case-studies\//, label: "Case study", boost: 0.9 },
    { test: /.*/, label: "Page", boost: 0.8 }
  ];
  const typeOf = (url) => types.find((t) => t.test.test(url));

  const icon = '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="18" height="18"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "search-toggle";
  toggle.setAttribute("aria-haspopup", "dialog");
  toggle.setAttribute("aria-keyshortcuts", "/");
  toggle.innerHTML = `${icon}<span class="visually-hidden">Search the site</span>`;
  toggle.title = "Search (press /)";
  const navToggle = header.querySelector(".nav-toggle");
  header.insertBefore(toggle, navToggle || null);

  const dialog = document.createElement("dialog");
  dialog.className = "search-dialog";
  dialog.setAttribute("aria-labelledby", "search-dialog-title");
  dialog.innerHTML = `
    <div class="search-panel">
      <div class="search-head">
        <h2 id="search-dialog-title" class="search-title">Search tools, guides and the glossary</h2>
        <button type="button" class="search-close" data-search-close>Close</button>
      </div>
      <form class="search-form" role="search" data-search-form>
        <label class="visually-hidden" for="site-search-input">Search the site</label>
        ${icon}
        <input id="site-search-input" type="search" autocomplete="off" spellcheck="false"
          placeholder="e.g. injection mould cost, break-even, CE marking" aria-describedby="search-status">
      </form>
      <p id="search-status" class="search-status" role="status" aria-live="polite"></p>
      <ol class="search-results" data-search-results></ol>
      <button type="button" class="search-more" data-search-more hidden>Show more results</button>
      <div class="search-empty" data-search-empty>
        <p class="search-empty-title">Popular starting points</p>
        <ul class="search-quick">
          <li><a href="${rootHref("tools/index.html")}">All free tools</a></li>
          <li><a href="${rootHref("guides/index.html")}">All guides</a></li>
          <li><a href="${rootHref("idea-to-manufacture/index.html")}">Idea to manufacture: the stages</a></li>
          <li><a href="${rootHref("tools/product-cost-estimator.html")}">Product Cost Estimator</a></li>
        </ul>
      </div>
    </div>`;
  document.body.appendChild(dialog);

  const input = dialog.querySelector("#site-search-input");
  const status = dialog.querySelector("#search-status");
  const list = dialog.querySelector("[data-search-results]");
  const more = dialog.querySelector("[data-search-more]");
  const empty = dialog.querySelector("[data-search-empty]");
  const escapeHtml = (v) => String(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  let pagefind = null;
  let loadFailed = false;
  const loadIndex = async () => {
    if (pagefind || loadFailed) return pagefind;
    try {
      pagefind = await import(rootHref("pagefind/pagefind.js"));
      await pagefind.options({ excerptLength: 24 });
      pagefind.init();
    } catch (e) {
      loadFailed = true;
    }
    return pagefind;
  };

  let ranked = [];
  let shown = 0;
  let searchSeq = 0;
  let lastTracked = "";
  let trackTimer = null;
  const PAGE = 8;

  // Search terms go to analytics only as text people typed into the site's own search; anything
  // that looks like an email address or phone number is not sent.
  const track = (term, count) => {
    const clean = term.trim().toLowerCase().slice(0, 80);
    if (!clean || clean === lastTracked) return;
    lastTracked = clean;
    const personal = /@|\d{6,}/.test(clean);
    trackAnalyticsEvent(count ? "search" : "search_no_results", { search_term: personal ? "[removed]" : clean, results_count: count });
  };

  const renderItems = () => {
    const slice = ranked.slice(shown, shown + PAGE);
    list.insertAdjacentHTML("beforeend", slice.map((r, i) => {
      const t = typeOf(r.url);
      const title = (r.meta && r.meta.title) || r.url;
      return `<li class="search-result"><a href="${escapeHtml(r.url)}" data-search-result="${shown + i + 1}">
        <span class="search-type search-type-${t.label.toLowerCase().replace(/\s+/g, "-")}">${t.label}</span>
        <span class="search-result-title">${escapeHtml(title)}</span>
        <span class="search-excerpt">${r.excerpt}</span></a></li>`;
    }).join(""));
    shown += slice.length;
    more.hidden = shown >= ranked.length;
  };

  const noResults = (term) => {
    list.innerHTML = `<li class="search-none">
      <p>Nothing on the site matches “${escapeHtml(term)}” yet. Try a shorter or more general word, or:</p>
      <ul class="search-quick">
        <li><a href="${rootHref("tools/index.html")}">Find a tool by the decision you are making</a></li>
        <li><a href="${rootHref("guides/index.html")}">Browse the guides</a></li>
        <li><a href="${rootHref("contact/index.html")}">Ask Andrew directly</a> (free, no obligation)</li>
      </ul></li>`;
  };

  // The site is written in UK English; map common US spellings so "injection molding" finds "moulding".
  const ukSpellings = [
    [/\bmold/g, "mould"], [/\bcolor/g, "colour"], [/\baluminum\b/g, "aluminium"], [/\bfiber/g, "fibre"],
    [/\bcenter/g, "centre"], [/\blicens(?=e\b)/g, "licenc"], [/\bdefense\b/g, "defence"], [/\banalyz/g, "analys"],
    [/\boptimiz/g, "optimis"], [/\bprioritiz/g, "prioritis"], [/\bstandardiz/g, "standardis"], [/\bminimiz/g, "minimis"],
    [/\bmodeling\b/g, "modelling"], [/\blabeling\b/g, "labelling"], [/\btraveling\b/g, "travelling"], [/\bcatalog\b/g, "catalogue"],
    [/\bprogram\b/g, "programme"], [/\bfavor/g, "favour"], [/\bbehavior/g, "behaviour"], [/\bgray\b/g, "grey"]
  ];
  const toUk = (text) => ukSpellings.reduce((t, [us, uk]) => t.replace(us, uk), text.toLowerCase());
  // Everyday words and abbreviations → the terms the site uses. The extra words are added to the
  // search, not substituted. Grow this from the GA4 "search_no_results" report (scripts/seo/search_terms.py).
  const synonyms = [
    [/\bcost of goods(?: sold)?\b/, "cogs"], [/\bkickstarter|indiegogo|pre-?orders?\b/, "crowdfunding"],
    [/\bce mark(?:ing)?\b|\bukca\b/, "certification conformity"], [/\bchina|abroad|offshore|far east|asia\b/, "overseas"],
    [/\bintellectual property\b/, "ip patent"], [/\b(?:prototype|prototyping) (?:price|cost)s?\b/, "prototype cost"],
    [/\bprice|pricing\b/, "price"], [/\bfactory|factories|supplier\b/, "manufacturer"], [/\bmold|mould tool\b/, "tooling"],
    [/\bmoq\b/, "minimum order quantity"], [/\bbom\b/, "bill of materials"], [/\bdfm\b/, "design for manufacture"],
    [/\bdfa\b/, "design for assembly"], [/\brrp|retail price\b/, "rrp retail"], [/\bgrant|investment|investor\b/, "funding"],
    [/\bnda|non-?disclosure\b/, "nda confidentiality"], [/\blca|life ?cycle assessment\b/, "carbon footprint"],
    [/\bcad\b/, "cad drawings"], [/\b3d print(?:ing|ed)?\b/, "3d printing"], [/\bcnc\b/, "cnc machining"],
    [/\becrs?\b|\bengineering change\b/, "change request"]
  ];
  // Pagefind needs every word of a query on the page, so synonyms run as their own searches and the
  // results are merged (best score per page) rather than being added to the visitor's query.
  const synonymQueries = (q) => synonyms
    .filter(([re]) => re.test(q))
    .map(([, add]) => add)
    .filter((add) => !add.split(" ").every((w) => q.includes(w)));

  const runSearch = async () => {
    const term = input.value.trim();
    const query = toUk(term);
    const extraQueries = synonymQueries(query);
    const seq = ++searchSeq;
    clearTimeout(trackTimer);
    empty.hidden = Boolean(term);
    if (!term) { list.innerHTML = ""; status.textContent = ""; more.hidden = true; list.removeAttribute("aria-busy"); return; }
    // Clear the previous answer straight away so an old "nothing matches" can't sit under a new search.
    if (list.dataset.term !== term) {
      list.dataset.term = term;
      list.setAttribute("aria-busy", "true");
      list.classList.add("is-stale");
      status.textContent = "Searching…";
    }
    const pf = await loadIndex();
    if (seq !== searchSeq) return;
    if (!pf) {
      status.textContent = `Search isn't available right now, so nothing was found for “${term}”.`;
      noResults(term);
      return;
    }
    const search = await pf.debouncedSearch(query, {}, 180);
    if (search === null || seq !== searchSeq) return; // superseded by a newer keystroke
    const LIMIT = 60;
    // Merge in synonym searches; a synonym-only match counts a little less than a direct one.
    const byId = new Map(search.results.map((r) => [r.id, { r, score: r.score }]));
    for (const extra of await Promise.all(extraQueries.map((q) => pf.search(q)))) {
      for (const r of extra.results) {
        const score = r.score * 0.85;
        if (!byId.has(r.id) || byId.get(r.id).score < score) byId.set(r.id, { r, score });
      }
    }
    if (seq !== searchSeq) return;
    const merged = [...byId.values()].sort((a, b) => b.score - a.score);
    const data = await Promise.all(merged.slice(0, LIMIT).map(({ r, score }) => r.data().then((d) => ({ ...d, score }))));
    if (seq !== searchSeq) return;
    // Pagefind falls back to the first letter or two of a word it can't find ("asdfgh" matches "as"),
    // which turns typos into pages of junk. Keep a result only if a highlighted match is a real part
    // of what was typed: at least 4 characters, or the whole word for short words like "CE".
    const words = [query, ...extraQueries].join(" ").split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}]/gu, "")).filter(Boolean);
    const longestTerm = Math.max(0, ...words.map((w) => w.length));
    const needed = Math.min(longestTerm, 4);
    // A highlighted word counts only if it shares its first letters with something typed
    // ("moulding" for "mould", "inject" for "injection"), not merely a letter or two.
    const matchesTyped = (text) => {
      const m = text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
      return words.some((w) => {
        const n = Math.min(w.length, 4);
        return m.length >= n && w.length >= needed && m.slice(0, n) === w.slice(0, n);
      });
    };
    const relevant = (d) => {
      const marks = [...String(d.excerpt).matchAll(/<mark>([^<]*)<\/mark>/g)].map((m) => m[1]);
      if (marks.length) return marks.some(matchesTyped);
      // No highlight in the snippet: keep it only if the title contains a typed word.
      const title = String((d.meta && d.meta.title) || "").toLowerCase();
      return words.some((w) => w.length >= needed && title.includes(w.slice(0, Math.max(needed, 4))));
    };
    ranked = data
      .filter(relevant)
      .map((d) => ({ ...d, rank: d.score * typeOf(d.url).boost }))
      .sort((a, b) => b.rank - a.rank);
    list.innerHTML = "";
    list.removeAttribute("aria-busy");
    list.classList.remove("is-stale");
    shown = 0;
    const total = ranked.length;
    const totalLabel = total === LIMIT && merged.length > LIMIT ? `${LIMIT}+` : String(total);
    if (!total) {
      status.textContent = `No results for “${term}”.`;
      more.hidden = true;
      noResults(term);
    } else {
      status.textContent = `${totalLabel} result${total === 1 ? "" : "s"} for “${term}”.`;
      renderItems();
    }
    trackTimer = setTimeout(() => track(term, total), 1500);
  };

  input.addEventListener("input", runSearch);
  // Escape closes search in one press (a search box would otherwise clear its text first).
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); dialog.close(); }
  });
  dialog.querySelector("[data-search-form]").addEventListener("submit", (e) => {
    e.preventDefault();
    const first = list.querySelector("a");
    if (first) first.focus();
  });
  more.addEventListener("click", () => {
    const next = shown;
    renderItems();
    const link = list.querySelectorAll("a[data-search-result]")[next];
    if (link) link.focus();
  });
  list.addEventListener("click", (e) => {
    const link = e.target.closest("a[data-search-result]");
    if (!link) return;
    clearTimeout(trackTimer);
    track(input.value, ranked.length);
    trackAnalyticsEvent("search_select", { search_term: lastTracked, result_position: Number(link.dataset.searchResult), link_url: link.pathname });
  });

  // Arrow keys move between the search box and the results.
  dialog.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = [input, ...dialog.querySelectorAll(".search-results a, .search-empty a")];
    const at = items.indexOf(document.activeElement);
    if (at === -1) return;
    e.preventDefault();
    const next = e.key === "ArrowDown" ? Math.min(at + 1, items.length - 1) : Math.max(at - 1, 0);
    items[next].focus();
  });

  let opener = null;
  const open = (prefill) => {
    opener = document.activeElement;
    if (typeof prefill === "string") input.value = prefill;
    if (!dialog.open) dialog.showModal();
    document.documentElement.classList.add("search-is-open");
    input.focus();
    input.select();
    loadIndex();
    if (input.value.trim()) runSearch();
  };
  dialog.addEventListener("close", () => {
    document.documentElement.classList.remove("search-is-open");
    clearTimeout(trackTimer);
    if (input.value.trim()) track(input.value, ranked.length);
    if (opener && typeof opener.focus === "function") opener.focus();
  });
  dialog.querySelector("[data-search-close]").addEventListener("click", () => dialog.close());
  // Clicking the dimmed backdrop (outside the panel) closes search.
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });

  toggle.addEventListener("click", () => open());
  document.querySelectorAll("[data-search-open]").forEach((el) => {
    el.addEventListener("click", (e) => { e.preventDefault(); open(); });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey || dialog.open) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    e.preventDefault();
    open();
  });
})();
