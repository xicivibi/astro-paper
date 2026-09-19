export type HeaderComparison = {
  onlyLeft: string[];
  onlyRight: string[];
  common: string[];
  sameSet: boolean;
  sameOrder: boolean;
};

const headers = (value: string) =>
  value
    .split(/\r?\n/)
    .map(header => header.trim())
    .filter(Boolean)
    .slice(0, 200);

export function compareHeaders(left: string, right: string): HeaderComparison {
  const leftHeaders = headers(left);
  const rightHeaders = headers(right);
  const leftSet = new Set(leftHeaders);
  const rightSet = new Set(rightHeaders);
  const onlyLeft = leftHeaders.filter(header => !rightSet.has(header));
  const onlyRight = rightHeaders.filter(header => !leftSet.has(header));
  return {
    onlyLeft,
    onlyRight,
    common: leftHeaders.filter(header => rightSet.has(header)),
    sameSet: onlyLeft.length === 0 && onlyRight.length === 0,
    sameOrder:
      leftHeaders.length === rightHeaders.length &&
      leftHeaders.every((header, index) => header === rightHeaders[index]),
  };
}
