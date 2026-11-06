import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseYaml } from "../scripts/lib/mini-yaml.mjs";

type YamlValue = ReturnType<typeof parseYaml>;

type Mapping = { [key: string]: YamlValue };

function readWorkflow(name: string): Mapping {
  const text = readFileSync(
    new URL(`../.github/workflows/${name}`, import.meta.url),
    "utf8"
  );
  return parseYaml(text) as Mapping;
}

test("mini YAML reader handles the workflow subset", () => {
  const parsed = parseYaml(
    'a:\n  b: "x"\n  list:\n    - one\n    - key: 1\n      other: true\n  block: |\n    line 1\n    line 2\n  flow: ["24"]\n'
  ) as Mapping;
  assert.deepEqual(parsed, {
    a: {
      b: "x",
      list: ["one", { key: 1, other: true }],
      block: "line 1\nline 2",
      flow: ["24"],
    },
  });
});

test("trend lifecycle rebuild has no schedule and stays manual only", () => {
  const workflow = readWorkflow("trend-lifecycle-rebuild.yml");
  const triggers = workflow.on as Mapping;
  assert.ok(triggers && typeof triggers === "object");
  assert.equal(Object.hasOwn(triggers, "schedule"), false);
  assert.ok(Object.hasOwn(triggers, "workflow_dispatch"));
});

function ciSteps() {
  const workflow = readWorkflow("ci.yml");
  const job = (workflow.jobs as Mapping).build as Mapping;
  return { job, steps: job.steps as Mapping[] };
}

test("CI runs the test suite before the build with enough time", () => {
  const { job, steps } = ciSteps();
  assert.equal(job["timeout-minutes"], 8);
  const runOf = (step: Mapping) => String(step.run ?? "");
  const testIndex = steps.findIndex(step =>
    /pnpm run test\b/.test(runOf(step))
  );
  const buildIndex = steps.findIndex(step =>
    /pnpm run build\b/.test(runOf(step))
  );
  assert.ok(testIndex >= 0, "CI must run pnpm run test");
  assert.ok(buildIndex >= 0, "CI must run pnpm run build");
  assert.ok(testIndex < buildIndex, "tests must run before the build");
  assert.match(
    runOf(steps[testIndex]),
    /pnpm run check:posts[\s\S]*pnpm run test/,
    "the post quality gate runs in the CI test step"
  );
});
