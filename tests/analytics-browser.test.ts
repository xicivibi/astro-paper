import assert from "node:assert/strict";
import test from "node:test";
import { installAnalytics } from "../src/scripts/analytics-browser.ts";

const KEY = "xici.analytics-consent.v1";
function harness(options: { url?: string; stored?: string; storageFails?: boolean } = {}) {
  const callbacks = { document: new Map<string, ((event: any) => void)[]>(), window: new Map<string, ((event: any) => void)[]>() };
  function add(kind: "document" | "window", name: string, callback: (event: any) => void) {
    callbacks[kind].set(name, [...(callbacks[kind].get(name) || []), callback]);
  }
  const order: string[] = [];
  const scripts: any[] = [];
  const replacements: string[] = [];
  const storage = new Map<string,string>();
  if (options.stored) storage.set(KEY, options.stored);
  const panel = { dataset: { measurementId: "G-A9B8C7D6E5", productionOrigin: "https://example.test" }, hidden: true,
    querySelector: () => ({ focus() {} }) };
  const document = { title: "Article", querySelector: () => panel,
    createElement: () => ({}), head: { appendChild: (script: any) => scripts.push(script) },
    addEventListener: (name: string, cb: (event: any) => void) => add("document", name, cb) };
  const location = { href: options.url || "https://example.test/posts/a", get origin() { return new URL(this.href).origin; },
    replace(url: string) { order.push("replace"); replacements.push(url); } };
  const layer: IArguments[] = [];
  layer.push = (...items) => {
    for (const item of items) if (item[0] === "consent" && item[1] === "update" && item[2].analytics_storage === "denied") order.push("denied");
    return Array.prototype.push.apply(layer, items);
  };
  const win = new Proxy({ location, history: { state: null, replaceState(_a: unknown, _b: string, url: string) { location.href = url; } }, dataLayer: layer,
    localStorage: { getItem: (key: string) => storage.get(key) || null, setItem(key: string, value: string) { if (options.storageFails) throw new Error("storage blocked"); storage.set(key,value); } },
    addEventListener: (name: string, cb: (event: any) => void) => add("window", name, cb),
  }, { set(target, key, value) { if (String(key).startsWith("ga-disable-") && value === true) order.push("disable"); Reflect.set(target,key,value); return true; } });
  function emit(kind: "document" | "window", name: string, event: any = {}) { for (const cb of callbacks[kind].get(name) || []) cb(event); }
  return { install: () => installAnalytics(win as unknown as Window, document as unknown as Document), scripts, order, replacements, panel, callbacks, storage, layer, emit,
    click(choice: string) { emit("document", "click", { target: { closest: () => ({ dataset: { analyticsChoice: choice }, hasAttribute: () => false }) } }); } };
}
const saved = (choice: string, at = Date.now()) => JSON.stringify({ choice, at });

test("preview origin refuses initialization and repeat installation has one owner", () => {
  const preview = harness({ url:"https://preview.example.test/posts/a", stored:saved("granted") });
  preview.install();
  assert.equal(preview.scripts.length,0);
  assert.equal(preview.callbacks.document.size,0);
  const f = harness({ stored:saved("granted") });
  f.install(); f.install(); f.emit("document","astro:page-load");
  assert.equal(f.scripts.length,1);
  assert.equal(f.callbacks.document.get("astro:page-load")?.length,1);
  assert.equal(f.callbacks.document.get("click")?.length,1);
  assert.equal(f.callbacks.window.get("storage")?.length,1);
  assert.equal(f.layer.filter(c=>c[0]==="event").length,1);
});

test("expired, future and malformed saved choices never load Google", () => {
  for (const stored of [saved("granted",Date.now()-181*86400000), saved("granted",Date.now()+86400000), "invalid", saved("unexpected")]) {
    const f=harness({stored}); f.install();
    assert.equal(f.scripts.length,0);
    assert.equal(f.panel.hidden,false);
  }
});

test("withdrawal orders denied then disable then replace, despite storage failure", () => {
  const f=harness({stored:saved("granted"),storageFails:true}); f.install(); f.click("denied");
  assert.deepEqual(f.order,["denied","disable","replace"]);
  const replaced=harness({url:f.replacements[0],stored:f.storage.get(KEY)}); replaced.install();
  assert.equal(replaced.scripts.length,0);
  assert.equal(replaced.panel.hidden,true);
  replaced.click("granted");
  assert.equal(replaced.scripts.length,1);
});

test("cross-tab denial, deletion and storage clear withdraw; cross-tab grant does not grant", () => {
  for (const event of [{key:KEY,newValue:saved("denied")},{key:KEY,newValue:null},{key:null,newValue:null}]) {
    const f=harness({stored:saved("granted")}); f.install(); f.emit("window","storage",event);
    assert.deepEqual(f.order,["denied","disable","replace"]);
  }
  const f=harness();f.install();f.emit("window","storage",{key:KEY,newValue:saved("granted")});
  assert.equal(f.scripts.length,0);
});
