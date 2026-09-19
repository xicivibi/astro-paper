export const CSV_PREVIEW_MAX_BYTES = 2 * 1024 * 1024;
export const CSV_PREVIEW_MAX_ROWS = 20;

export const CSV_DELIMITERS = [",", "\t", ";", "|"] as const;
export type CsvDelimiter = (typeof CSV_DELIMITERS)[number];

export type CsvPreview = {
  hasUtf8Bom: boolean;
  rowCount: number;
  firstRowColumnCount: number;
  delimiter: CsvDelimiter | null;
  delimiterLabel: string;
  previewRows: string[][];
  warnings: string[];
};

const delimiterNames: Record<CsvDelimiter, string> = {
  ",": "콤마 (,)",
  "\t": "탭",
  ";": "세미콜론 (;)",
  "|": "파이프 (|)",
};

/** Parse CSV with quoted fields, escaped quotes, and newlines in quoted fields. */
export function parseCsv(text: string, delimiter: CsvDelimiter): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else quoted = false;
      } else field += character;
    } else if (character === '"' && field.length === 0) quoted = true;
    else if (character === delimiter) {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      row.push(field);
      field = "";
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      if (row.some(cell => cell.length > 0)) rows.push(row);
      row = [];
    } else field += character;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some(cell => cell.length > 0)) rows.push(row);
  }
  return rows;
}

function hasUnclosedQuote(text: string): boolean {
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '"') {
      if (quoted && text[index + 1] === '"') index += 1;
      else quoted = !quoted;
    }
  }
  return quoted;
}

export function detectDelimiter(text: string): CsvDelimiter | null {
  const scored = CSV_DELIMITERS.map((delimiter, priority) => {
    const rows = parseCsv(text, delimiter).slice(0, 20);
    const columnCounts = rows.map(row => row.length).filter(count => count > 1);
    if (columnCounts.length === 0) return { delimiter, score: 0, priority };

    const frequencies = new Map<number, number>();
    for (const count of columnCounts) frequencies.set(count, (frequencies.get(count) ?? 0) + 1);
    const [columns, consistency] = [...frequencies.entries()].sort(
      ([columnsA, frequencyA], [columnsB, frequencyB]) =>
        frequencyB - frequencyA || columnsB - columnsA
    )[0];
    const coverage = consistency / rows.length;
    return {
      delimiter,
      score: coverage * 10_000 + consistency * 100 + Math.min(columns, 99),
      priority,
    };
  });
  const winner = scored.sort((a, b) => b.score - a.score || a.priority - b.priority)[0];
  return winner?.score ? winner.delimiter : null;
}

function appendFormulaPrefixWarning(rows: string[][], warnings: string[]): void {
  if (
    rows
      .slice(0, CSV_PREVIEW_MAX_ROWS)
      .some(row => row.some(cell => /^[=+\-@]/.test(cell)))
  ) {
    warnings.push(
      "일부 셀이 =, +, -, @로 시작합니다. 스프레드시트에서 숫자나 수식으로 해석될 수 있으므로 파일 출처와 값을 확인하세요."
    );
  }
}

export function inspectCsv(text: string, hasUtf8Bom = false): CsvPreview {
  const delimiter = detectDelimiter(text);
  const warnings = [
    "파일의 인코딩은 UTF-8 BOM 여부 외에는 확인하지 않습니다. 문자가 깨지면 원본 인코딩을 확인하세요.",
  ];
  if (text.includes("�")) warnings.push("UTF-8로 해석할 수 없는 문자가 있어 미리보기가 정확하지 않을 수 있습니다.");
  if (hasUnclosedQuote(text)) warnings.push("닫히지 않은 큰따옴표가 있습니다. 해당 필드 이후의 행 구분이 정확하지 않을 수 있습니다.");
  if (!delimiter) {
    warnings.push("구분자를 확정하지 못했습니다. 한 열짜리 파일이거나 지원하지 않는 형식일 수 있습니다.");
    const rows = parseCsv(text, ",");
    appendFormulaPrefixWarning(rows, warnings);
    return {
      hasUtf8Bom,
      rowCount: rows.length,
      firstRowColumnCount: rows[0]?.length ?? 0,
      delimiter: null,
      delimiterLabel: "확인 어려움",
      previewRows: rows.slice(0, CSV_PREVIEW_MAX_ROWS),
      warnings,
    };
  }
  const rows = parseCsv(text, delimiter);
  appendFormulaPrefixWarning(rows, warnings);
  return {
    hasUtf8Bom,
    rowCount: rows.length,
    firstRowColumnCount: rows[0]?.length ?? 0,
    delimiter,
    delimiterLabel: delimiterNames[delimiter],
    previewRows: rows.slice(0, CSV_PREVIEW_MAX_ROWS),
    warnings,
  };
}

export function decodeCsvBytes(bytes: Uint8Array): { text: string; hasUtf8Bom: boolean } {
  const hasUtf8Bom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  return { hasUtf8Bom, text: new TextDecoder("utf-8").decode(bytes.slice(hasUtf8Bom ? 3 : 0)) };
}
