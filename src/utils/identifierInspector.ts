export type IdentifierInspection = {
  value: string;
  length: number;
  numeric: boolean;
  leadingZeroRisk: boolean;
  precisionRisk: boolean;
};

export function inspectIdentifiers(input: string): IdentifierInspection[] {
  return input
    .split(/\r?\n/)
    .map(value => value.trim())
    .filter(Boolean)
    .slice(0, 200)
    .map(value => {
      const numeric = /^\d+$/.test(value);
      return {
        value,
        length: value.length,
        numeric,
        leadingZeroRisk: numeric && value.length > 1 && value.startsWith("0"),
        precisionRisk: numeric && value.length > 15,
      };
    });
}
