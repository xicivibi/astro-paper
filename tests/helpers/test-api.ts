// Keep the existing node:test command usable alongside the requested Vitest run.
export const test = process.env.VITEST
  ? // @ts-expect-error Vitest is supplied by npx, not a project dependency.
    (await import("vitest")).test
  : (await import("node:test")).default;
