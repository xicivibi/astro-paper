/** Minimal shapes so the logic can run against fakes in tests. */
export type AdSlotElement = { dataset: Record<string, string | undefined> };
export type AdSlotRoot = {
  querySelectorAll: (selector: string) => Iterable<AdSlotElement>;
};
export type AdQueue = { push: (value: object) => unknown };

/**
 * Requests an ad for every slot on the current page exactly once. With the
 * ClientRouter, `astro:page-load` fires on the first load and after each
 * navigation; already-pushed slots are marked so they are never pushed again.
 */
export function pushNewSlots(root: AdSlotRoot, queue: AdQueue): number {
  let pushed = 0;
  for (const slot of root.querySelectorAll("ins.adsbygoogle")) {
    if (slot.dataset.xiciPushed === "true") continue;
    slot.dataset.xiciPushed = "true";
    queue.push({});
    pushed += 1;
  }
  return pushed;
}

type AdWindow = { adsbygoogle?: AdQueue; __xiciAdSlots?: boolean };

export function installAdSlots(
  win: AdWindow,
  doc: AdSlotRoot & {
    addEventListener: (type: string, listener: () => void) => void;
  }
) {
  if (win.__xiciAdSlots) return;
  win.__xiciAdSlots = true;
  const run = () => {
    let found = false;
    for (const _slot of doc.querySelectorAll("ins.adsbygoogle")) {
      found = true;
      break;
    }
    if (!found) return;
    win.adsbygoogle = win.adsbygoogle || ([] as unknown as AdQueue);
    pushNewSlots(doc, win.adsbygoogle);
  };
  // The module may run after the first page-load event; marking makes the
  // extra immediate run harmless.
  run();
  doc.addEventListener("astro:page-load", run);
}
