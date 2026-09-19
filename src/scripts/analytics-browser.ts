import {
  createAnalyticsController,
  type ConsentChoice,
} from "./analytics-controller.ts";

export function installAnalytics(win: Window, document: Document): void {
  const location = win.location;
  const history = win.history;
  const settings = document.querySelector<HTMLElement>(
    "#xici-analytics-consent"
  );
  const id = settings?.dataset.measurementId;
  const owner = win as Window & {
    __xiciAnalytics?: boolean;
    dataLayer?: unknown[];
    [key: `ga-disable-${string}`]: boolean;
  };
  if (
    id &&
    settings?.dataset.productionOrigin === location.origin &&
    !owner.__xiciAnalytics
  ) {
    owner.__xiciAnalytics = true;
    const storageKey = "xici.analytics-consent.v1";
    const lifetime = 180 * 24 * 60 * 60 * 1000;
    let choice: ConsentChoice = null;
    try {
      const saved = JSON.parse(win.localStorage.getItem(storageKey) || "null");
      if (
        saved &&
        (saved.choice === "granted" || saved.choice === "denied") &&
        Number.isFinite(saved.at) &&
        saved.at <= Date.now() &&
        Date.now() - saved.at < lifetime
      )
        choice = saved.choice;
    } catch {
      /* Missing or blocked storage means no consent. */
    }
    // This override keeps a withdrawal effective even when storage writes fail.
    if (new URL(location.href).searchParams.get("xici_analytics") === "off")
      choice = "denied";
    owner.dataLayer = owner.dataLayer || [];
    // gtag's queue format is Arguments, not an array of arguments.
    function command(..._args: unknown[]) {
      owner.dataLayer!.push(arguments);
    }
    const controller = createAnalyticsController(id, {
      command,
      load() {
        const script = document.createElement("script");
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
        script.id = "xici-ga4-loader";
        document.head.appendChild(script);
      },
      stop() {
        owner[`ga-disable-${id}`] = true;
        // A fresh document removes the previously loaded third-party runtime.
        const clean = new URL(location.href);
        clean.searchParams.set("xici_analytics", "off");
        location.replace(clean.href);
      },
    });
    function render() {
      const panel = document.querySelector<HTMLElement>(
        "#xici-analytics-consent"
      );
      if (panel) panel.hidden = choice !== null;
    }
    function page() {
      controller.navigate({ url: location.href, title: document.title });
      render();
    }
    document.addEventListener("click", event => {
      const button = (
        event.target as Element | null
      )?.closest<HTMLButtonElement>(
        "[data-analytics-choice], [data-analytics-settings]"
      );
      if (!button) return;
      const panel = document.querySelector<HTMLElement>(
        "#xici-analytics-consent"
      );
      if (button.hasAttribute("data-analytics-settings")) {
        if (panel) {
          panel.hidden = false;
          panel.querySelector<HTMLButtonElement>("button")?.focus();
        }
        return;
      }
      const next = button.dataset.analyticsChoice;
      if (next !== "granted" && next !== "denied") return;
      choice = next;
      if (choice === "granted") {
        const clean = new URL(location.href);
        clean.searchParams.delete("xici_analytics");
        history.replaceState(history.state, "", clean.href);
      }
      // If persistence fails, the choice applies to this document only.
      try {
        win.localStorage.setItem(
          storageKey,
          JSON.stringify({ choice, at: Date.now() })
        );
      } catch {
        /* No persistence. */
      }
      if (choice === "granted") owner[`ga-disable-${id}`] = false;
      controller.choose(choice);
      render();
    });
    win.addEventListener("storage", event => {
      if (event.key !== null && event.key !== storageKey) return;
      let next: ConsentChoice = null;
      try {
        next = JSON.parse(event.newValue || "null")?.choice ?? null;
      } catch {
        /* Invalid means withdrawn. */
      }
      // Another tab cannot silently grant consent to this document.
      if (next !== "granted") {
        choice = "denied";
        controller.choose("denied");
        render();
      }
    });
    document.addEventListener("astro:page-load", page);
    page();
    if (choice) controller.choose(choice);
  }
}
