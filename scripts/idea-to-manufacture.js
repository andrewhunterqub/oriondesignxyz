/*
 * Idea to manufacture explainer: turns the seven stage sections into a stepper.
 * Without JavaScript every stage stays visible as a normal article.
 * Each stage has a shareable URL (#stage-<id>) and the last stage viewed is remembered.
 */
(() => {
  const stages = [...document.querySelectorAll("[data-stage]")];
  const stepper = document.querySelector("[data-i2m-stepper]");
  const pager = document.querySelector("[data-i2m-pager]");
  const finder = document.querySelector("[data-i2m-finder]");
  const select = document.getElementById("i2mWhere");
  if (!stages.length || !stepper || !pager || !finder || !select) return;

  const storageKey = "orion-i2m-stage";
  const track = (name, params) => window.OrionAnalytics?.trackEvent?.(name, params);
  const remember = (id) => {
    try {
      localStorage.setItem(storageKey, id);
    } catch (error) {
      /* storage unavailable */
    }
  };
  const recall = () => {
    try {
      return localStorage.getItem(storageKey);
    } catch (error) {
      return null;
    }
  };

  const buttons = stages.map((stage, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "i2m-step";
    button.innerHTML = `<span class="i2m-step-num">${index + 1}</span><span class="i2m-step-name"></span>`;
    button.querySelector(".i2m-step-name").textContent = stage.dataset.stageName;
    button.addEventListener("click", () => show(index, true));
    stepper.append(button);
    return button;
  });

  const prevButton = document.createElement("button");
  const nextButton = document.createElement("button");
  prevButton.type = nextButton.type = "button";
  prevButton.className = "button button-secondary i2m-prev";
  nextButton.className = "button button-primary i2m-next";
  pager.append(prevButton, nextButton);

  let current = 0;
  function show(index, userAction) {
    current = Math.max(0, Math.min(stages.length - 1, index));
    stages.forEach((stage, i) => stage.classList.toggle("is-hidden", i !== current));
    buttons.forEach((button, i) => {
      button.classList.toggle("is-past", i < current);
      button.classList.toggle("is-current", i === current);
      if (i === current) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
    const prev = stages[current - 1];
    const next = stages[current + 1];
    prevButton.hidden = !prev;
    nextButton.hidden = !next;
    if (prev) prevButton.textContent = `← ${current}. ${prev.dataset.stageName}`;
    if (next) nextButton.textContent = `${current + 2}. ${next.dataset.stageName} →`;
    select.value = stages[current].dataset.stage;
    const id = stages[current].id;
    if (window.location.hash !== `#${id}`) history.replaceState(null, "", `#${id}`);
    remember(stages[current].dataset.stage);
    if (userAction) {
      stepper.scrollIntoView({ behavior: "smooth", block: "start" });
      stages[current].querySelector("h2")?.focus({ preventScroll: true });
      track("i2m_stage_view", { stage: stages[current].dataset.stage });
    }
  }

  stages.forEach((stage) => stage.querySelector("h2")?.setAttribute("tabindex", "-1"));
  prevButton.addEventListener("click", () => show(current - 1, true));
  nextButton.addEventListener("click", () => show(current + 1, true));
  select.addEventListener("change", () => {
    show(stages.findIndex((stage) => stage.dataset.stage === select.value), true);
    track("i2m_where_selected", { stage: select.value });
  });
  window.addEventListener("hashchange", () => {
    const index = stages.findIndex((stage) => `#${stage.id}` === window.location.hash);
    if (index !== -1 && index !== current) show(index, false);
  });

  finder.hidden = false;
  stepper.hidden = false;
  pager.hidden = false;
  document.querySelector("[data-i2m-stages]")?.classList.add("is-enhanced");

  const fromHash = stages.findIndex((stage) => `#${stage.id}` === window.location.hash);
  const fromMemory = stages.findIndex((stage) => stage.dataset.stage === recall());
  show(fromHash !== -1 ? fromHash : fromMemory !== -1 ? fromMemory : 0, false);
})();
