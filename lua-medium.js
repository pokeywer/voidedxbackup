const OPERATOR_TOKENS = [
  "...", "..=", "//=", "<<=", ">>=", "==", "~=", "<=", ">=", "::", "..", "//", "--",
  "+=", "-=", "*=", "/=", "%=", "^=", "&=", "|=", "<<", ">>", "->", "&&", "||", "??"
].sort((a, b) => b.length - a.length);

const OPERATOR_SET = new Set(OPERATOR_TOKENS);
const encoder = new TextEncoder();
function isWhitespace(character) {
  return character !== undefined && /\s|\uFEFF/.test(character);
}

function isIdentifierStart(character) {
  return character !== undefined && /[A-Za-z_\u0080-\uFFFF]/.test(character);
}

function isIdentifierPart(character) {
  return character !== undefined && /[A-Za-z0-9_\u0080-\uFFFF]/.test(character);
}

function longBracketAt(source, start) {
  const match = /^\[(=*)\[/.exec(source.slice(start));
  if (!match) return null;
  return { opener: match[0], closer: `]${match[1]}]` };
}

function readLongBracket(source, start, bracket) {
  const closeAt = source.indexOf(bracket.closer, start + bracket.opener.length);
  if (closeAt < 0) throw new Error("Unclosed long bracket string or comment.");
  return closeAt + bracket.closer.length;
}

function readQuotedString(source, start, quote) {
  let index = start + 1;
  while (index < source.length) {
    const character = source[index];
    if (character === "\\") {
      index += 1;
      if (source[index] === "\r" && source[index + 1] === "\n") index += 2;
      else if (index < source.length) index += 1;
      continue;
    }
    if (character === quote) return index + 1;
    index += 1;
  }
  throw new Error("Unclosed quoted string.");
}

function appendUtf8(bytes, character) {
  bytes.push(...encoder.encode(character));
}

function decodeQuotedBytes(raw) {
  const body = raw.slice(1, -1);
  const bytes = [];
  const escapes = { a: 7, b: 8, f: 12, n: 10, r: 13, t: 9, v: 11, "\\": 92, "\"": 34, "'": 39 };

  for (let index = 0; index < body.length;) {
    const character = body[index];
    if (character !== "\\") {
      const codePoint = body.codePointAt(index);
      const value = String.fromCodePoint(codePoint);
      appendUtf8(bytes, value);
      index += value.length;
      continue;
    }

    index += 1;
    if (index >= body.length) return null;
    const escaped = body[index];

    if (/[0-9]/.test(escaped)) {
      let digits = escaped;
      index += 1;
      while (digits.length < 3 && /[0-9]/.test(body[index] || "")) digits += body[index++];
      const byte = Number(digits);
      if (byte > 255) return null;
      bytes.push(byte);
      continue;
    }

    if (escaped === "x") {
      const hex = body.slice(index + 1, index + 3);
      if (!/^[\da-fA-F]{2}$/.test(hex)) return null;
      bytes.push(parseInt(hex, 16));
      index += 3;
      continue;
    }

    if (escaped === "u" && body[index + 1] === "{") {
      const end = body.indexOf("}", index + 2);
      if (end < 0) return null;
      const digits = body.slice(index + 2, end);
      if (!/^[\da-fA-F]{1,8}$/.test(digits)) return null;
      const codePoint = parseInt(digits, 16);
      if (codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) return null;
      appendUtf8(bytes, String.fromCodePoint(codePoint));
      index = end + 1;
      continue;
    }

    if (escaped === "z") {
      index += 1;
      while (index < body.length && isWhitespace(body[index])) index += 1;
      continue;
    }

    if (escaped === "\n" || escaped === "\r") {
      bytes.push(10);
      index += 1;
      if (escaped === "\r" && body[index] === "\n") index += 1;
      continue;
    }

    if (Object.hasOwn(escapes, escaped)) {
      bytes.push(escapes[escaped]);
      index += 1;
      continue;
    }

    // Leave uncommon or dialect-specific escapes unchanged instead of guessing.
    return null;
  }

  return bytes;
}

function escapeQuotedString(raw) {
  const bytes = decodeQuotedBytes(raw);
  if (!bytes) return raw;
  return `"${bytes.map((byte) => `\\${String(byte).padStart(3, "0")}`).join("")}"`;
}

function readNumber(source, start) {
  const rest = source.slice(start);
  const match = /^(?:0[xX][\da-fA-F](?:_?[\da-fA-F])*(?:\.(?!\.)[\da-fA-F]*(?:_?[\da-fA-F])*)?(?:[pP][+-]?\d(?:_?\d)*)?|\d(?:_?\d)*(?:(?:\.(?!\.)\d(?:_?\d)*|\.(?!\.))?(?:[eE][+-]?\d(?:_?\d)*)?|\.\d(?:_?\d)*(?:[eE][+-]?\d(?:_?\d)*)?))/.exec(rest);
  return match ? match[0] : source[start];
}

function tokenize(source, escapeStrings) {
  const tokens = [];
  let index = 0;
  let preservedPrefix = "";

  if (source.startsWith("\uFEFF")) {
    preservedPrefix = "\uFEFF";
    index = 1;
  }
  if (source.startsWith("#!", index)) {
    const lineEnd = source.indexOf("\n", index);
    if (lineEnd < 0) return { tokens, preservedPrefix: source };
    preservedPrefix += source.slice(index, lineEnd + 1);
    index = lineEnd + 1;
  }

  while (index < source.length) {
    const character = source[index];
    if (isWhitespace(character)) {
      index += 1;
      continue;
    }

    if (source.startsWith("--", index)) {
      const bracket = longBracketAt(source, index + 2);
      if (bracket) index = readLongBracket(source, index + 2, bracket);
      else {
        index += 2;
        while (index < source.length && source[index] !== "\n" && source[index] !== "\r") index += 1;
      }
      continue;
    }

    const longBracket = longBracketAt(source, index);
    if (longBracket) {
      const end = readLongBracket(source, index, longBracket);
      tokens.push({ type: "string", raw: source.slice(index, end) });
      index = end;
      continue;
    }

    if (character === "\"" || character === "'") {
      const end = readQuotedString(source, index, character);
      const original = source.slice(index, end);
      tokens.push({ type: "string", raw: escapeStrings ? escapeQuotedString(original) : original });
      index = end;
      continue;
    }

    if (character === "`") {
      let end = index + 1;
      let closed = false;
      while (end < source.length) {
        if (source[end] === "\\") end += 2;
        else if (source[end++] === "`") {
          closed = true;
          break;
        }
      }
      if (!closed) throw new Error("Unclosed Luau interpolated string.");
      tokens.push({ type: "string", raw: source.slice(index, end) });
      index = end;
      continue;
    }

    if (isIdentifierStart(character)) {
      let end = index + 1;
      while (end < source.length && isIdentifierPart(source[end])) end += 1;
      tokens.push({ type: "identifier", raw: source.slice(index, end) });
      index = end;
      continue;
    }

    if (/[0-9]/.test(character) || (character === "." && /[0-9]/.test(source[index + 1] || ""))) {
      const raw = readNumber(source, index);
      tokens.push({ type: "number", raw });
      index += raw.length;
      continue;
    }

    const operator = OPERATOR_TOKENS.find((candidate) => source.startsWith(candidate, index));
    if (operator) {
      tokens.push({ type: "operator", raw: operator });
      index += operator.length;
      continue;
    }

    tokens.push({ type: "punctuation", raw: character });
    index += 1;
  }

  return { tokens, preservedPrefix };
}

function createsMergedOperator(left, right) {
  for (const operator of OPERATOR_SET) {
    for (let split = 1; split < operator.length; split += 1) {
      if (left.endsWith(operator.slice(0, split)) && right.startsWith(operator.slice(split))) return true;
    }
  }
  return false;
}

function needsSeparator(previous, current) {
  const left = previous.raw.at(-1) || "";
  const right = current.raw[0] || "";
  if (isIdentifierPart(left) && isIdentifierPart(right)) return true;
  if (previous.type === "number" && (isIdentifierStart(right) || right === ".")) return true;
  if (left === "." && (right === "." || /[0-9]/.test(right))) return true;
  if (left === "[" && right === "[") return true;
  return createsMergedOperator(previous.raw, current.raw);
}

function minifyLua(source, escapeStrings) {
  const { tokens, preservedPrefix } = tokenize(source, escapeStrings);
  let result = preservedPrefix;
  for (let index = 0; index < tokens.length; index += 1) {
    const current = tokens[index];
    const previous = tokens[index - 1];
    if (previous && needsSeparator(previous, current)) result += " ";

    // Keep spaces that would otherwise join a long-bracket opener such as [==[.
    if (current.raw === "[" && /\[=*$/.test(result)) result += " ";
    result += current.raw;
  }
  return result;
}

export function obfuscateLuaMedium(source) {
  return minifyLua(source, true);
}
