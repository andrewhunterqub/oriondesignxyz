(function () {
  const defaultConfig = {
    measurementId: "",
    ahrefsKey: "",
    requireConsent: true,
    anonymizeIp: true,
    debug: false,
    // "advanced": GA4 loads with Google Consent Mode v2, all storage denied,
    // so visitors who have not chosen yet send cookieless, anonymous pings.
    // Accept turns analytics cookies on; Decline stops GA entirely.
    // "basic": nothing loads until Accept (previous behaviour).
    consentMode: "advanced",
    storageKey: "orion_analytics_consent"
  };

  const config = Object.assign({}, defaultConfig, window.ORION_ANALYTICS_CONFIG || {});
  const hasMeasurementId =
    typeof config.measurementId === "string" &&
    config.measurementId.trim() !== "" &&
    !config.measurementId.includes("XXXXXXXXXX");
  const hasAhrefsKey = typeof config.ahrefsKey === "string" && config.ahrefsKey.trim() !== "";
  const hasAnalyticsProvider = hasMeasurementId || hasAhrefsKey;
  const advancedConsent = config.consentMode === "advanced";
  const providerLabel = [hasMeasurementId ? "Google Analytics 4" : "", hasAhrefsKey ? "Ahrefs Web Analytics" : ""]
    .filter(Boolean)
    .join(" and ");

  const state = {
    gaLoaded: false,
    ahrefsLoaded: false,
    queue: [],
    consent: null
  };

  const cleanParams = (params) => {
    return Object.fromEntries(
      Object.entries(params || {}).filter((entry) => entry[1] !== undefined && entry[1] !== null && entry[1] !== "")
    );
  };

  const trackEvent = (name, params) => {
    if (!hasMeasurementId) {
      return;
    }

    if (state.consent === "denied") {
      return;
    }

    if (!state.gaLoaded || typeof window.gtag !== "function") {
      state.queue.push([name, cleanParams(params)]);
      return;
    }

    window.gtag("event", name, cleanParams(params));
  };

  const flushQueue = () => {
    if (!state.gaLoaded || typeof window.gtag !== "function") {
      return;
    }

    state.queue.forEach((event) => {
      window.gtag("event", event[0], event[1]);
    });

    state.queue = [];
  };

  // Tool inputs are mirrored into the page address (query string and #r& share links).
  // Report only the path plus campaign parameters, so no tool input ever reaches analytics.
  const cleanLocation = () => {
    const url = new URL(window.location.href);
    const kept = new URLSearchParams();
    url.searchParams.forEach((value, key) => {
      if (/^utm_/i.test(key) || key === "source") kept.set(key, value);
    });
    const query = kept.toString();
    return `${url.origin}${url.pathname}${query ? `?${query}` : ""}`;
  };

  const sendPageView = () => {
    trackEvent("page_view", {
      page_title: document.title,
      page_location: cleanLocation(),
      page_path: window.location.pathname,
      page_referrer: document.referrer || undefined
    });
  };

  const whenIdle = (run) => {
    const go = () => (window.requestIdleCallback ? window.requestIdleCallback(run, { timeout: 2500 }) : setTimeout(run, 1200));
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go, { once: true });
  };

  const loadGoogleAnalytics = () => {
    if (!hasMeasurementId || state.gaLoaded) {
      return;
    }

    if (state.gaRequested || document.querySelector("script[data-orion-ga='true']")) {
      return;
    }
    state.gaRequested = true; // the tag is added later (whenIdle), so guard against a second call meanwhile

    window.dataLayer = window.dataLayer || [];
    window.gtag =
      window.gtag ||
      function gtag() {
        window.dataLayer.push(arguments);
      };

    const granted = state.consent === "granted" || !config.requireConsent;
    window.gtag("consent", "default", {
      analytics_storage: granted ? "granted" : "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied"
    });
    window.gtag("set", "ads_data_redaction", true);
    window.gtag("js", new Date());
    window.gtag("config", config.measurementId, {
      send_page_view: false,
      page_location: cleanLocation(),
      anonymize_ip: config.anonymizeIp,
      debug_mode: config.debug
    });

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(config.measurementId)}`;
    script.setAttribute("data-orion-ga", "true");
    script.onload = () => {
      state.gaLoaded = true;
      sendPageView();
      flushQueue();
    };
    script.onerror = () => {
      state.gaLoaded = false;
    };

    // Fetch Google's tag after the page has loaded and the browser is idle, so its ~0.4 s of
    // script work doesn't compete with the page becoming usable. Events wait in dataLayer and
    // the queue above, and are sent once it loads.
    whenIdle(() => document.head.appendChild(script));
  };

  const loadAhrefsAnalytics = () => {
    if (!hasAhrefsKey || state.ahrefsLoaded) {
      return;
    }

    if (document.querySelector("script[data-orion-ahrefs='true']")) {
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://analytics.ahrefs.com/analytics.js";
    script.setAttribute("data-key", config.ahrefsKey.trim());
    script.setAttribute("data-orion-ahrefs", "true");
    script.onload = () => {
      state.ahrefsLoaded = true;
    };
    script.onerror = () => {
      state.ahrefsLoaded = false;
    };

    document.head.appendChild(script);
  };

  const loadAnalytics = () => {
    loadGoogleAnalytics();
    loadAhrefsAnalytics();
  };

  const closeBanner = () => {
    const banner = document.querySelector("[data-analytics-banner]");
    if (banner) {
      banner.remove();
    }
  };

  const setConsent = (value) => {
    state.consent = value;
    try {
      window.localStorage.setItem(config.storageKey, value);
    } catch {}

    closeBanner();

    if (value === "granted") {
      if (state.gaLoaded && typeof window.gtag === "function") {
        window.gtag("consent", "update", { analytics_storage: "granted" });
      }
      loadAnalytics();
    } else {
      state.queue = [];
      if (typeof window.gtag === "function") {
        window.gtag("consent", "update", { analytics_storage: "denied" });
      }
      // Stop any further cookieless pings for this page view.
      window["ga-disable-" + config.measurementId] = true;
    }
  };

  const resetConsent = () => {
    try {
      window.localStorage.removeItem(config.storageKey);
    } catch {}

    state.consent = null;
    closeBanner();
    renderBanner();
  };

  const renderBanner = () => {
    if (!hasAnalyticsProvider || !config.requireConsent || state.consent) {
      return;
    }

    if (document.querySelector("[data-analytics-banner]")) {
      return;
    }

    const banner = document.createElement("div");
    banner.className = "consent-banner";
    banner.setAttribute("data-analytics-banner", "true");
    banner.innerHTML = `
      <div class="consent-banner__inner">
        <div>
          <strong>Analytics preference</strong>
          <p>
            Orion Design uses ${providerLabel} to understand tool usage and content engagement.
            ${advancedConsent && hasMeasurementId
              ? "Until you choose, Google Analytics counts visits anonymously without cookies. Accept to allow analytics cookies; Decline to switch analytics off."
              : "Analytics loads only after consent."}
          </p>
        </div>
        <div class="consent-banner__actions">
          <button class="button button-secondary" type="button" data-analytics-deny>Decline</button>
          <button class="button button-primary" type="button" data-analytics-accept>Accept</button>
        </div>
      </div>
    `;

    document.body.appendChild(banner);

    banner.querySelector("[data-analytics-accept]").addEventListener("click", () => {
      setConsent("granted");
    });

    banner.querySelector("[data-analytics-deny]").addEventListener("click", () => {
      setConsent("denied");
    });
  };

  const initConsent = () => {
    if (!hasAnalyticsProvider) {
      return;
    }

    try {
      state.consent = window.localStorage.getItem(config.storageKey);
    } catch {
      state.consent = null;
    }

    if (!config.requireConsent || state.consent === "granted") {
      loadAnalytics();
      return;
    }

    if (state.consent === "denied") {
      return;
    }

    if (advancedConsent) {
      loadGoogleAnalytics();
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", renderBanner, { once: true });
    } else {
      renderBanner();
    }
  };

  window.OrionAnalytics = {
    hasMeasurementId,
    hasAhrefsKey,
    hasAnalyticsProvider,
    trackEvent,
    setConsent,
    resetConsent,
    isEnabled() {
      return hasAnalyticsProvider && state.consent === "granted";
    }
  };

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-analytics-reset]");
    if (!target) {
      return;
    }

    resetConsent();
  });

  initConsent();
})();
