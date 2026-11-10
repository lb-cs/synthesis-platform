/**
 * Finds a cited passage inside the text of its page or file, so the viewer can highlight
 * it. Only letters and digits are compared: the stored chunk and the viewer's text differ
 * in spacing, line breaks, and hyphenation, but not in the words. Pure and client-safe.
 */

/** A span of a string: `start` is included, `end` is not. */
export type TextRange = { start: number; end: number };

// When the whole passage isn't found, its first and last characters are matched alone.
const ANCHOR_LENGTH = 40;

// A tail match only counts when the span it makes is about the passage's own length.
const MIN_SPAN_RATIO = 0.5;
const MAX_SPAN_RATIO = 1.5;

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

type FoldedText = {
  /** The text lowercased, ligatures expanded, with everything but letters and digits dropped. */
  folded: string;
  /** For each code unit of `folded`, where it came from in the original text. */
  origins: number[];
};

function foldText(text: string): FoldedText {
  let folded = '';
  const origins: number[] = [];
  let index = 0;

  for (const character of text) {
    // NFKC turns a ligature like "ﬁ" into "fi", which is how the chunk spells it.
    const normalized = character.normalize('NFKC').toLowerCase();

    for (const part of normalized) {
      if (LETTER_OR_DIGIT.test(part)) {
        folded += part;

        for (let unit = 0; unit < part.length; unit += 1) {
          origins.push(index);
        }
      }
    }

    index += character.length;
  }

  return { folded, origins };
}

function toOriginalRange(text: FoldedText, start: number, end: number): TextRange {
  return { start: text.origins[start], end: text.origins[end - 1] + 1 };
}

/** Where `passage` sits in `text`, or null when it can't be found. */
export function findPassageRange(text: string, passage: string): TextRange | null {
  const haystack = foldText(text);
  const needle = foldText(passage).folded;

  if (needle === '') {
    return null;
  }

  const wholeAt = haystack.folded.indexOf(needle);

  if (wholeAt !== -1) {
    return toOriginalRange(haystack, wholeAt, wholeAt + needle.length);
  }

  // A few characters can differ (a symbol, a footnote mark), so match by the two ends.
  const head = needle.slice(0, ANCHOR_LENGTH);
  const headAt = haystack.folded.indexOf(head);

  if (headAt === -1) {
    return null;
  }

  const expectedEnd = Math.min(headAt + needle.length, haystack.folded.length);
  const tail = needle.slice(-ANCHOR_LENGTH);
  const tailAt = haystack.folded.indexOf(tail, headAt);
  const tailEnd = tailAt + tail.length;
  const span = tailEnd - headAt;
  const isTailUsable =
    tailAt !== -1 &&
    span >= needle.length * MIN_SPAN_RATIO &&
    span <= needle.length * MAX_SPAN_RATIO;

  return toOriginalRange(haystack, headAt, isTailUsable ? tailEnd : expectedEnd);
}

/**
 * The part of each text item that lies inside `passage`, by item index. Joins the items
 * the way a PDF page reads, so a passage that runs across several lines still matches.
 * Null when the passage isn't on the page.
 */
export function findPassageInItems(
  items: string[],
  passage: string,
): Map<number, TextRange> | null {
  const range = findPassageRange(items.join(''), passage);

  if (!range) {
    return null;
  }

  const highlights = new Map<number, TextRange>();
  let itemStart = 0;

  items.forEach((item, index) => {
    const itemEnd = itemStart + item.length;
    const start = Math.max(range.start, itemStart) - itemStart;
    const end = Math.min(range.end, itemEnd) - itemStart;

    if (start < end) {
      highlights.set(index, { start, end });
    }

    itemStart = itemEnd;
  });

  return highlights;
}
