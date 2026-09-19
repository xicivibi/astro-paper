/** Basic consent mode: the Google loader is requested only after a choice. */
export type ConsentChoice = "granted" | "denied" | null;
type Page = { url: string; title: string };
type AnalyticsEffects = {
  command: (...args: unknown[]) => void;
  load: () => void;
  stop: () => void;
};

export function createAnalyticsController(
  id: string,
  effects: AnalyticsEffects
) {
  let choice: ConsentChoice = null;
  let loaded = false;
  let lastPage: string | null = null;
  let page: Page | null = null;
  const denied = {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
  };
  effects.command("consent", "default", denied);

  function view() {
    if (!page || choice !== "granted") return;
    const url = new URL(page.url);
    if (/^\/(admin|search)(\/|$)/.test(url.pathname)) {
      lastPage = null;
      return;
    }
    // No query strings, fragments or referrers in our configuration/events.
    const location = url.origin + url.pathname;
    if (!loaded) {
      loaded = true;
      effects.command("js", new Date());
      effects.command("config", id, {
        send_page_view: false,
        page_location: location,
        page_referrer: "",
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        cookie_expires: 15552000,
      });
      effects.load();
    }
    if (lastPage === location) return;
    lastPage = location;
    effects.command("event", "page_view", {
      page_location: location,
      page_title: page.title,
      page_referrer: "",
    });
  }

  return {
    navigate(next: Page) {
      page = next;
      view();
    },
    choose(next: Exclude<ConsentChoice, null>) {
      if (choice === next) return;
      const revoke = choice === "granted" && next === "denied" && loaded;
      choice = next;
      effects.command("consent", "update", {
        ...denied,
        analytics_storage: next,
      });
      if (revoke) {
        lastPage = null;
        effects.stop();
        return;
      }
      view();
    },
  };
}
