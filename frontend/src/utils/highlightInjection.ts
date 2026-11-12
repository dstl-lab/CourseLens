import type { CourseChange } from "../types/changes";
import { getStableChangeId } from "./changeIdentity";

const HIGHLIGHT_COLORS: Record<string, { bg: string; border: string }> = {
  rename:      { bg: "rgba(245,158,11,0.22)",  border: "rgba(245,158,11,0.85)"  },
  reword:      { bg: "rgba(99,102,241,0.22)",  border: "rgba(99,102,241,0.85)"  },
  restructure: { bg: "rgba(236,72,153,0.22)",  border: "rgba(236,72,153,0.85)"  },
  add:         { bg: "rgba(34,197,94,0.22)",   border: "rgba(34,197,94,0.85)"   },
  remove:      { bg: "rgba(239,68,68,0.22)",   border: "rgba(239,68,68,0.85)"   },
  clarify:     { bg: "rgba(6,182,212,0.22)",   border: "rgba(6,182,212,0.85)"   },
};

const FALLBACK_COLOR = { bg: "rgba(148,163,184,0.22)", border: "rgba(148,163,184,0.85)" };

const HIGHLIGHT_CSS = `
  .cl-hl {
    border-radius: 3px;
    padding: 0 2px;
    cursor: pointer;
    position: relative;
    outline-offset: 1px;
  }
  .cl-hl::after, .cl-section-hl::after {
    content: attr(data-cl-tip);
    display: none;
    position: fixed;
    background: #1e293b;
    color: #f1f5f9;
    font-size: 11px;
    font-family: ui-sans-serif, system-ui, sans-serif;
    padding: 4px 8px;
    border-radius: 5px;
    white-space: nowrap;
    max-width: 380px;
    overflow: hidden;
    text-overflow: ellipsis;
    z-index: 99999;
    pointer-events: none;
    box-shadow: 0 2px 10px rgba(0,0,0,0.5);
  }
  .cl-hl:hover::after, .cl-section-hl:hover::after { display: block; }
  .cl-section-hl { position: relative; }
`;

const LOCATION_BLOCK_TAGS = new Set([
  "P",
  "LI",
  "TD",
  "TH",
  "PRE",
  "BLOCKQUOTE",
  "FIGURE",
  "SECTION",
  "ARTICLE",
  "DIV",
]);

function buildFlatText(body: HTMLElement): { flat: string; nodes: { node: Text; start: number }[] } {
  const nodes: { node: Text; start: number }[] = [];
  let flat = "";
  const doc = body.ownerDocument!;
  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const p = (n as Text).parentElement;
      if (!p) return NodeFilter.FILTER_SKIP;
      const tag = p.tagName.toUpperCase();
      return tag === "SCRIPT" || tag === "STYLE" ? NodeFilter.FILTER_SKIP : NodeFilter.FILTER_ACCEPT;
    },
  });
  let n: Text | null;
  while ((n = walker.nextNode() as Text | null)) {
    nodes.push({ node: n, start: flat.length });
    flat += n.textContent ?? "";
  }
  return { flat, nodes };
}

function normToRawIndex(raw: string, normIdx: number): number {
  let ri = 0, ni = 0;
  while (ni < normIdx && ri < raw.length) {
    if (/\s/.test(raw[ri])) {
      while (ri < raw.length && /\s/.test(raw[ri])) ri++;
      ni++;
    } else { ri++; ni++; }
  }
  return ri;
}

function clearHighlights(doc: Document) {
  doc.querySelectorAll<HTMLElement>(".cl-hl[data-cl-badge='true'], .cl-hl:not([data-change-id])").forEach((el) => {
    el.remove();
  });
  doc.querySelectorAll<HTMLElement>(".cl-hl").forEach((el) => {
    const parent = el.parentNode;
    if (!parent) return;
    parent.replaceChild(doc.createTextNode(el.textContent ?? ""), el);
    parent.normalize();
  });
  doc.querySelectorAll<HTMLElement>(".cl-section-hl").forEach((el) => {
    el.classList.remove("cl-section-hl");
    el.style.removeProperty("border-left");
    el.style.removeProperty("padding-left");
    el.style.removeProperty("background");
    el.style.removeProperty("border-radius");
    el.removeAttribute("data-cl-tip");
    el.removeAttribute("data-change-id");
  });
}

function expandPreviewDisclosures(doc: Document) {
  doc.querySelectorAll<HTMLDetailsElement>("details").forEach((el) => {
    el.open = true;
  });

  doc.querySelectorAll<HTMLElement>("[aria-expanded='false']").forEach((el) => {
    el.setAttribute("aria-expanded", "true");
  });

  doc.querySelectorAll<HTMLElement>(".collapse").forEach((el) => {
    el.classList.add("show");
    el.removeAttribute("hidden");
  });

  doc.querySelectorAll<HTMLElement>(".jp-mod-collapsed").forEach((el) => {
    el.classList.remove("jp-mod-collapsed");
  });
}

function attachChangeClick(el: HTMLElement, changeId: string) {
  el.setAttribute("data-change-id", changeId);
  el.addEventListener("click", () => {
    el.ownerDocument.defaultView?.parent?.postMessage(
      { type: "courselens-preview-change-click", changeId },
      "*",
    );
  });
}

function nearestLocationBlock(el: HTMLElement): HTMLElement {
  let current: HTMLElement | null = el;
  while (current && current.ownerDocument.body !== current) {
    if (LOCATION_BLOCK_TAGS.has(current.tagName.toUpperCase())) return current;
    current = current.parentElement;
  }
  return el;
}

function highlightLocationBlock(el: HTMLElement, changeType: string, tip: string, changeId: string): HTMLElement {
  const colors = HIGHLIGHT_COLORS[changeType] ?? FALLBACK_COLOR;
  const block = nearestLocationBlock(el);
  block.classList.add("cl-section-hl");
  block.style.cssText += `background:${colors.bg};border-left:4px solid ${colors.border};padding-left:8px;border-radius:0 4px 4px 0;`;
  block.setAttribute("data-cl-tip", tip);
  attachChangeClick(block, changeId);
  return block;
}

function findNormalizedMatches(normFlat: string, normNeedle: string): number[] {
  const matches: number[] = [];
  let from = 0;
  while (from < normFlat.length) {
    const idx = normFlat.indexOf(normNeedle, from);
    if (idx === -1) break;
    matches.push(idx);
    from = idx + Math.max(normNeedle.length, 1);
  }
  return matches;
}

function decodeHtmlFragmentText(doc: Document, text: string): string | null {
  if (!/<[a-z][\s\S]*>/i.test(text) && !/&(?:#\d+|#x[\da-f]+|[a-z]+);/i.test(text)) {
    return null;
  }

  const fragmentDoc = doc.implementation.createHTMLDocument("");
  fragmentDoc.body.innerHTML = text;
  const decoded = fragmentDoc.body.textContent?.trim();
  return decoded && decoded !== text ? decoded : null;
}

function searchNeedles(doc: Document, needle: string): string[] {
  const candidates = [needle];
  const decoded = decodeHtmlFragmentText(doc, needle);
  if (decoded) candidates.push(decoded);

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const normalized = candidate.replace(/\s+/g, " ").trim().toLowerCase();
    if (normalized.length < 3 || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function normalizeContext(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function scoreContext(raw: string, rawStart: number, rawEnd: number, before?: string | null, after?: string | null): number {
  let score = 0;
  if (before) {
    const preceding = normalizeContext(raw.slice(Math.max(0, rawStart - before.length - 240), rawStart));
    const expected = normalizeContext(before);
    if (expected && preceding.endsWith(expected)) score += expected.length + 1000;
  }
  if (after) {
    const following = normalizeContext(raw.slice(rawEnd, rawEnd + after.length + 240));
    const expected = normalizeContext(after);
    if (expected && following.startsWith(expected)) score += expected.length + 1000;
  }
  return score;
}

function findAndWrapText(
  body: HTMLElement,
  needle: string,
  changeType: string,
  tip: string,
  changeId: string,
  context?: { before?: string | null; after?: string | null }
): HTMLElement | null {
  const doc = body.ownerDocument!;
  const colors = HIGHLIGHT_COLORS[changeType] ?? FALLBACK_COLOR;
  const { flat, nodes } = buildFlatText(body);
  if (!nodes.length) return null;

  const normFlat = flat.replace(/\s+/g, " ").toLowerCase();
  const needles = searchNeedles(doc, needle);
  if (!needles.length) return null;

  let normNeedle = "";
  let normMatches: number[] = [];
  for (const candidate of needles) {
    const candidateNorm = candidate.replace(/\s+/g, " ").trim().toLowerCase();
    const candidateMatches = findNormalizedMatches(normFlat, candidateNorm);
    if (candidateMatches.length === 0) continue;
    normNeedle = candidateNorm;
    normMatches = candidateMatches;
    break;
  }

  if (normMatches.length === 0) return null;

  let normIdx = normMatches[0];
  if (normMatches.length > 1 && context && (context.before || context.after)) {
    let bestScore = -1;
    for (const candidate of normMatches) {
      const candidateStart = normToRawIndex(flat, candidate);
      const candidateEnd = normToRawIndex(flat, candidate + normNeedle.length);
      const candidateScore = scoreContext(flat, candidateStart, candidateEnd, context.before, context.after);
      if (candidateScore > bestScore) {
        bestScore = candidateScore;
        normIdx = candidate;
      }
    }
  }

  const rawStart = normToRawIndex(flat, normIdx);
  const rawEnd   = normToRawIndex(flat, normIdx + normNeedle.length);

  let ni = nodes.length - 1;
  while (ni > 0 && nodes[ni].start > rawStart) ni--;
  const { node, start } = nodes[ni];

  const localStart = rawStart - start;
  const localEnd   = Math.min(rawEnd - start, (node.textContent ?? "").length);
  if (localStart >= localEnd) return null;

  const raw    = node.textContent ?? "";
  const before = raw.slice(0, localStart);
  const match  = raw.slice(localStart, localEnd);
  const after  = raw.slice(localEnd);

  const span = doc.createElement("span");
  span.className = "cl-hl";
  span.style.cssText = `background:${colors.bg};outline:2px solid ${colors.border};border-radius:3px;padding:0 2px;`;
  span.setAttribute("data-cl-tip", tip);
  attachChangeClick(span, changeId);
  span.textContent = match;

  const parent = node.parentNode!;
  if (before) parent.insertBefore(doc.createTextNode(before), node);
  parent.insertBefore(span, node);
  if (after)  parent.insertBefore(doc.createTextNode(after), node);
  parent.removeChild(node);
  return highlightLocationBlock(span, changeType, tip, changeId);
}

function extractQuotedTerms(text: string): string[] {
  const results: string[] = [];
  for (const m of text.matchAll(/["'`""]([^"'`""]{3,80})["'`""]/g)) results.push(m[1]);
  return results;
}

const STOP_WORDS = new Set([
  "the","a","an","to","of","in","and","or","is","it","on","at","for","be",
  "this","that","will","from","with","by","we","our","are","was","its","as",
  "into","also","which","should","would","could","been","has","have","had",
]);

function scoredHeadingSearch(doc: Document, summary: string, sectionLabel: string | null): HTMLElement | null {
  const headings = doc.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6");
  if (!headings.length) return null;

  const candidates: string[] = [];
  if (sectionLabel) candidates.push(sectionLabel.toLowerCase());
  for (const q of extractQuotedTerms(summary)) candidates.push(q.toLowerCase());

  const summaryWords = summary.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !STOP_WORDS.has(w));

  let best: HTMLElement | null = null;
  let bestScore = 0;

  for (const h of headings) {
    const hText = (h.textContent ?? "").toLowerCase();
    let score = 0;
    for (const c of candidates) if (hText.includes(c)) score += 10;
    for (const w of summaryWords)  if (hText.includes(w)) score += 1;
    if (score > bestScore) { bestScore = score; best = h; }
  }

  return bestScore > 0 ? best : null;
}

function highlightSection(heading: HTMLElement, changeType: string, tip: string, changeId: string): HTMLElement {
  const doc = heading.ownerDocument!;
  const colors = HIGHLIGHT_COLORS[changeType] ?? FALLBACK_COLOR;
  const headingLevel = parseInt(heading.tagName[1], 10);
  const BLOCK_TAGS = new Set(["P","DIV","UL","OL","TABLE","BLOCKQUOTE","PRE","DL","SECTION"]);
  const HEADING_TAGS = new Set(["H1","H2","H3","H4","H5","H6"]);

  heading.classList.add("cl-section-hl");
  heading.style.cssText += `border-left:4px solid ${colors.border};padding-left:8px;background:${colors.bg};border-radius:0 4px 4px 0;`;
  heading.setAttribute("data-cl-tip", tip);
  attachChangeClick(heading, changeId);

  let sibling = heading.nextElementSibling as HTMLElement | null;
  let highlighted = 0;
  while (sibling && highlighted < 3) {
    const tag = sibling.tagName.toUpperCase();
    if (HEADING_TAGS.has(tag) && parseInt(tag[1], 10) <= headingLevel) break;
    if (BLOCK_TAGS.has(tag)) {
      sibling.classList.add("cl-section-hl");
      sibling.style.cssText += `background:${colors.bg};border-left:4px solid ${colors.border};padding-left:8px;border-radius:0 4px 4px 0;`;
      sibling.setAttribute("data-cl-tip", tip);
      attachChangeClick(sibling, changeId);

      if (highlighted === 0) {
        const badge = doc.createElement("span");
        badge.className = "cl-hl";
        badge.setAttribute("data-cl-badge", "true");
        badge.style.cssText = `
          position:absolute;top:4px;right:4px;
          font-size:10px;font-family:ui-sans-serif,system-ui,sans-serif;
          background:${colors.border};color:#fff;
          padding:1px 6px;border-radius:3px;pointer-events:none;
          font-weight:600;letter-spacing:0.04em;
        `;
        badge.textContent = changeType;
        badge.setAttribute("data-cl-tip", tip);
        const prev = sibling.style.position;
        if (!prev || prev === "static") sibling.style.position = "relative";
        sibling.appendChild(badge);
      }
      highlighted++;
    }
    sibling = sibling.nextElementSibling as HTMLElement | null;
  }

  return heading;
}

export function injectHighlights(doc: Document, changes: CourseChange[]): HTMLElement | null {
  try {
    if (!doc.body || doc.readyState === "loading") return null;

    expandPreviewDisclosures(doc);
    clearHighlights(doc);

    let styleEl = doc.getElementById("cl-hl-style") as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = doc.createElement("style");
      styleEl.id = "cl-hl-style";
      (doc.head ?? doc.body).appendChild(styleEl);
    }
    styleEl.textContent = HIGHLIGHT_CSS;

    let first: HTMLElement | null = null;

    for (const change of changes) {
      const tip = `[${change.changeType}] ${change.summary}`;
      const changeId = getStableChangeId(change);
      let el: HTMLElement | null = null;

      if (change.target?.text) {
        el = findAndWrapText(doc.body, change.target.text, change.changeType, tip, changeId, {
          before: change.target.before,
          after: change.target.after,
        });
      }
      if (!el && change.originalSnippet) {
        el = findAndWrapText(doc.body, change.originalSnippet, change.changeType, tip, changeId);
      }
      if (!el) {
        for (const term of extractQuotedTerms(change.summary)) {
          el = findAndWrapText(doc.body, term, change.changeType, tip, changeId);
          if (el) break;
        }
      }
      if (!el) {
        const heading = scoredHeadingSearch(doc, change.summary, change.location.sectionLabel);
        if (heading) el = highlightSection(heading, change.changeType, tip, changeId);
      }

      if (el && !first) first = el;
    }

    return first;
  } catch {
    return null;
  }
}
