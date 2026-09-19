type CompareOptions = {
  trim?: boolean;
  caseSensitive?: boolean;
};

export type ListComparison = {
  leftOnly: string[];
  rightOnly: string[];
  common: string[];
  duplicateLeft: string[];
  duplicateRight: string[];
};

const lines = (value: string) =>
  value
    .split(/\r?\n/)
    .filter(line => line.trim().length > 0)
    .slice(0, 1000);

export function compareLists(
  left: string,
  right: string,
  options: CompareOptions = {}
): ListComparison {
  const trim = options.trim ?? true;
  const caseSensitive = options.caseSensitive ?? false;
  const normalize = (value: string) => {
    const prepared = trim ? value.trim() : value;
    return caseSensitive ? prepared : prepared.toLocaleLowerCase("ko-KR");
  };
  const analyze = (value: string) => {
    const originals = new Map<string, string>();
    const counts = new Map<string, number>();
    for (const item of lines(value)) {
      const prepared = trim ? item.trim() : item;
      const key = normalize(item);
      originals.set(key, originals.get(key) ?? prepared);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return { originals, counts };
  };
  const leftList = analyze(left);
  const rightList = analyze(right);
  const leftKeys = [...leftList.originals.keys()];
  const rightKeys = [...rightList.originals.keys()];
  return {
    leftOnly: leftKeys
      .filter(key => !rightList.originals.has(key))
      .map(key => leftList.originals.get(key)!),
    rightOnly: rightKeys
      .filter(key => !leftList.originals.has(key))
      .map(key => rightList.originals.get(key)!),
    common: leftKeys
      .filter(key => rightList.originals.has(key))
      .map(key => leftList.originals.get(key)!),
    duplicateLeft: leftKeys
      .filter(key => (leftList.counts.get(key) ?? 0) > 1)
      .map(key => leftList.originals.get(key)!),
    duplicateRight: rightKeys
      .filter(key => (rightList.counts.get(key) ?? 0) > 1)
      .map(key => rightList.originals.get(key)!),
  };
}
