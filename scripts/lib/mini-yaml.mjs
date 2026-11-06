/**
 * Minimal YAML reader for the block-style subset used by workflow files and post
 * frontmatter.
 * It supports mappings, sequences (including sequences of mappings), quoted
 * and plain scalars, flow arrays and literal/folded block scalars. It exists
 * so workflow tests and the post quality gate need no extra dependency.
 */
/** @typedef {{ indent: number, content: string }} Line */
/** @typedef {string | number | boolean | null | object} YamlValue */

/** @param {string} raw @returns {any} */
function scalar(raw) {
  const value = raw.trim();
  if (value === "" || value === "~" || value === "null") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replaceAll("''", "'");
  }
  if (value.startsWith("{") && value.endsWith("}")) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    try {
      return JSON.parse(value);
    } catch {
      // Fall back to a simple comma split for unquoted flow items.
    }
    const inner = value.slice(1, -1).trim();
    return inner ? inner.split(",").map(item => scalar(item)) : [];
  }
  return value;
}

const keyPattern = /^("[^"]+"|'[^']+'|[^:#"'][^:]*?):(?:\s+(.*))?$/;

/** @param {string} text @returns {any} */
export function parseYaml(text) {
  /** @type {Line[]} */
  const lines = [];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || /^\s*#/.test(raw)) {
      lines.push({ indent: -1, content: "" });
      continue;
    }
    const indent = raw.length - raw.trimStart().length;
    lines.push({ indent, content: raw.trim() });
  }
  let index = 0;

  const skipBlank = () => {
    while (index < lines.length && lines[index].indent < 0) index += 1;
  };
  const peek = () => {
    skipBlank();
    return lines[index];
  };

  /** @param {number} parentIndent @param {boolean} folded */
  function blockScalar(parentIndent, folded) {
    /** @type {string[]} */
    const collected = [];
    while (index < lines.length) {
      const line = lines[index];
      if (line.indent >= 0 && line.indent <= parentIndent) break;
      collected.push(line.indent < 0 ? "" : line.content);
      index += 1;
    }
    while (collected.length && collected.at(-1) === "") collected.pop();
    return collected.join(folded ? " " : "\n");
  }

  /** @param {number} indent @returns {any} */
  function parseBlock(indent) {
    const line = peek();
    if (!line || line.indent < indent) return null;
    return line.content === "-" || line.content.startsWith("- ")
      ? parseSequence(line.indent)
      : parseMapping(line.indent);
  }

  /** @param {string | undefined} rest @param {number} indent @returns {any} */
  function valueAfterKey(rest, indent) {
    if (rest === undefined || rest === "") {
      const next = peek();
      if (!next) return null;
      const isCollection =
        next.content === "-" ||
        next.content.startsWith("- ") ||
        keyPattern.test(next.content);
      if (next.indent > indent && !isCollection) {
        const parts = [];
        while (peek() && peek().indent > indent) {
          parts.push(peek().content);
          index += 1;
        }
        return scalar(parts.join(" "));
      }
      if (next.indent > indent) return parseBlock(next.indent);
      if (
        next.indent === indent &&
        (next.content === "-" || next.content.startsWith("- "))
      ) {
        return parseSequence(indent);
      }
      return null;
    }
    if (/^[|>][+-]?$/.test(rest)) return blockScalar(indent, rest[0] === ">");
    // Multi-line plain or quoted scalars continue on deeper-indented lines.
    const parts = [rest];
    for (;;) {
      const next = peek();
      if (!next || next.indent <= indent) break;
      parts.push(next.content);
      index += 1;
    }
    return scalar(parts.join(" "));
  }

  /** @param {number} indent @returns {any} */
  function parseMapping(indent) {
    /** @type {Record<string, any>} */
    const result = {};
    for (;;) {
      const line = peek();
      if (!line || line.indent !== indent) break;
      if (line.content === "-" || line.content.startsWith("- ")) break;
      const match = keyPattern.exec(line.content);
      if (!match) throw new Error(`Unsupported YAML line: ${line.content}`);
      index += 1;
      const key = String(scalar(match[1]));
      result[key] = valueAfterKey(match[2], indent);
    }
    return result;
  }

  /** @param {number} indent @returns {any} */
  function parseSequence(indent) {
    /** @type {any[]} */
    const result = [];
    for (;;) {
      const line = peek();
      if (!line || line.indent !== indent) break;
      if (!(line.content === "-" || line.content.startsWith("- "))) break;
      const itemContent = line.content === "-" ? "" : line.content.slice(2);
      if (!itemContent.trim()) {
        index += 1;
        result.push(parseBlock(indent + 1));
      } else if (keyPattern.test(itemContent)) {
        // Re-read the item's first key as a mapping line at the item indent.
        lines[index] = { indent: indent + 2, content: itemContent };
        result.push(parseMapping(indent + 2));
      } else {
        index += 1;
        result.push(scalar(itemContent));
      }
    }
    return result;
  }

  return parseBlock(0);
}
