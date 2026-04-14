import type { TextBlock } from './types.js';
import { BLOCK_STYLE, MIRROR_ROOT_STYLE } from './styles.js';

const SEMANTICS_TO_TAG: Record<string, string> = {
  'paragraph': 'p',
  'heading-1': 'h1',
  'heading-2': 'h2',
  'heading-3': 'h3',
  'code': 'pre',
  'list-item': 'li',
  'quote': 'blockquote',
};

function applyStyles(el: HTMLElement, styles: Record<string, string>): void {
  for (const [key, value] of Object.entries(styles)) {
    (el.style as unknown as Record<string, string>)[key] = value;
  }
}

/**
 * Resolve the font size to use for a block. Priority:
 *   1. Explicit block.fontSize (strongly recommended for correct alignment)
 *   2. Derived from rect.height / lines.length (a rough approximation)
 *   3. Fall back to rect.height for single-line blocks
 */
function resolveFontSize(block: TextBlock): number {
  if (typeof block.fontSize === 'number') return block.fontSize;
  if (block.lines && block.lines.length > 0) {
    return block.rect.height / block.lines.length;
  }
  return block.rect.height;
}

/**
 * Build a CSS font shorthand from block fields, matching the format
 * accepted by both `ctx.font` and `element.style.font`.
 */
export function buildFontString(block: TextBlock): string {
  const fontSize = resolveFontSize(block);
  const parts: string[] = [];
  if (block.fontStyle && block.fontStyle !== 'normal') parts.push(block.fontStyle);
  if (block.fontWeight !== undefined) parts.push(String(block.fontWeight));
  parts.push(`${fontSize}px`);
  parts.push(block.fontFamily ?? 'sans-serif');
  return parts.join(' ');
}

function applyBlockContent(el: HTMLElement, block: TextBlock, doc: Document): void {
  // Position to match canvas coordinates
  el.style.left = `${block.rect.x}px`;
  el.style.top = `${block.rect.y}px`;
  el.style.width = `${block.rect.width}px`;
  el.style.height = `${block.rect.height}px`;

  // Font settings — must match canvas exactly for Ctrl+F highlight alignment
  const fontSize = resolveFontSize(block);
  el.style.fontSize = `${fontSize}px`;
  if (block.fontFamily) {
    el.style.fontFamily = block.fontFamily;
  }
  if (block.fontWeight !== undefined) {
    el.style.fontWeight = String(block.fontWeight);
  }
  if (block.fontStyle) {
    el.style.fontStyle = block.fontStyle;
  }

  // Clear prior content
  el.textContent = '';

  if (block.lines && block.lines.length > 0) {
    // Use line heights for precise vertical positioning
    el.style.lineHeight = `${block.lines[0].height}px`;

    for (const line of block.lines) {
      const lineSpan = doc.createElement('span');
      lineSpan.style.display = 'block';
      lineSpan.style.height = `${line.height}px`;
      lineSpan.style.lineHeight = `${line.height}px`;
      // Reset any prior scaleX from a previous sync, so re-measurement starts fresh
      lineSpan.style.transform = 'none';
      lineSpan.style.transformOrigin = 'left top';
      lineSpan.dataset.lineText = line.text;
      lineSpan.textContent = line.text;
      el.appendChild(lineSpan);
    }
  } else {
    el.style.lineHeight = `${block.rect.height}px`;
    el.style.transform = 'none';
    el.style.transformOrigin = 'left top';
    el.dataset.lineText = block.text;
    el.textContent = block.text;
  }

  // Speaker label for chat-like UIs
  if (block.speaker) {
    el.setAttribute('aria-label', `${block.speaker}: ${block.text}`);
  } else {
    el.removeAttribute('aria-label');
  }
}

/**
 * PDF.js TextLayer technique: after DOM layout, measure each line's rendered
 * DOM width, compare with ctx.measureText on the same text/font, and apply
 * `transform: scaleX(ratio)` to force the DOM width to match the canvas pixel
 * width exactly. This is what makes browser Ctrl+F highlights land on top of
 * the canvas glyphs even when DOM and canvas layout engines disagree by
 * sub-pixel fractions per character.
 *
 * All reads are batched before all writes to cause at most one layout thrash.
 */
export function pixelAlignBlockWidths(
  mirrorRoot: HTMLElement,
  blocks: TextBlock[],
  measureCtx: CanvasRenderingContext2D | null,
): void {
  if (!measureCtx) return;

  type Plan = { el: HTMLElement; canvasWidth: number; text: string };
  const plans: Plan[] = [];

  // --- READ PHASE ---
  for (const block of blocks) {
    // Skip blocks without enough font info to do accurate canvas measurement
    if (!block.fontFamily || typeof block.fontSize !== 'number') continue;

    measureCtx.font = buildFontString(block);

    const blockEl = mirrorRoot.querySelector<HTMLElement>(
      `[data-block-id="${cssEscape(block.id)}"]`,
    );
    if (!blockEl) continue;

    const lineEls = blockEl.querySelectorAll<HTMLElement>('[data-line-text]');
    const targets: HTMLElement[] =
      lineEls.length > 0 ? Array.from(lineEls) : [blockEl];

    for (const el of targets) {
      const rawText = el.dataset.lineText ?? el.textContent ?? '';
      // Strip newline/CR characters before measurement. In canvas, `\n` has a
      // font-dependent advance width (often ~4–5px), but in the DOM — with
      // `white-space: pre-wrap` — `\n` produces a line break with zero
      // horizontal advance. Including `\n` in the canvas measurement inflates
      // canvasWidth relative to domWidth, producing a spurious ratio > 1 that
      // over-stretches the line and shifts individual characters mid-line.
      const text = rawText.replace(/[\r\n]/g, '');
      if (!text) continue;
      const canvasWidth = measureCtx.measureText(text).width;
      plans.push({ el, canvasWidth, text });
    }
  }

  // Measure all DOM widths in one pass (forces layout once)
  const withDomWidth = plans.map((p) => {
    const range = p.el.ownerDocument.createRange();
    range.selectNodeContents(p.el);
    const rect = range.getBoundingClientRect();
    range.detach?.();
    return { ...p, domWidth: rect.width };
  });

  // --- WRITE PHASE ---
  for (const { el, canvasWidth, domWidth } of withDomWidth) {
    if (domWidth <= 0 || canvasWidth <= 0) continue;
    const ratio = canvasWidth / domWidth;
    // Skip near-identity scales to avoid triggering compositor layers for nothing
    if (Math.abs(ratio - 1) < 0.001) {
      el.style.transform = 'none';
    } else {
      el.style.transform = `scaleX(${ratio.toFixed(5)})`;
    }
  }
}

/**
 * Minimal CSS.escape polyfill for use in contexts where it isn't available
 * (like jsdom). Escapes characters that would break an attribute selector.
 */
function cssEscape(value: string): string {
  // Use native if available
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, '\\$&');
}

function createBlockElement(block: TextBlock, doc: Document): HTMLElement {
  const tag = block.semantics ? SEMANTICS_TO_TAG[block.semantics] ?? 'div' : 'div';
  const el = doc.createElement(tag);
  el.dataset.blockId = block.id;
  applyStyles(el, BLOCK_STYLE as unknown as Record<string, string>);
  applyBlockContent(el, block, doc);
  return el;
}

function updateBlockElement(el: HTMLElement, block: TextBlock, doc: Document): void {
  applyBlockContent(el, block, doc);
}

export function createMirrorRoot(doc: Document): HTMLElement {
  const root = doc.createElement('div');
  applyStyles(root, MIRROR_ROOT_STYLE as unknown as Record<string, string>);
  return root;
}

export function syncBlocks(
  mirrorRoot: HTMLElement,
  blocks: TextBlock[],
  liveContainer: HTMLElement | null,
): void {
  const doc = mirrorRoot.ownerDocument;
  const target = liveContainer ?? mirrorRoot;

  // Build a map of existing block elements by id
  const existingMap = new Map<string, HTMLElement>();
  for (const child of Array.from(target.children)) {
    const el = child as HTMLElement;
    const id = el.dataset.blockId;
    if (id) existingMap.set(id, el);
  }

  const newIds = new Set(blocks.map((b) => b.id));

  // Remove blocks that no longer exist
  for (const [id, el] of existingMap) {
    if (!newIds.has(id)) {
      el.remove();
      existingMap.delete(id);
    }
  }

  // Update or insert blocks in order
  let prevEl: HTMLElement | null = null;
  for (const block of blocks) {
    let el = existingMap.get(block.id);
    if (el) {
      updateBlockElement(el, block, doc);
    } else {
      el = createBlockElement(block, doc);
    }

    // Ensure correct DOM order
    const expectedNext: Element | null = prevEl ? prevEl.nextElementSibling : target.firstElementChild;
    if (el !== expectedNext) {
      if (prevEl) {
        prevEl.after(el);
      } else {
        target.prepend(el);
      }
    }

    prevEl = el;
  }
}

export function appendBlock(
  mirrorRoot: HTMLElement,
  block: TextBlock,
  liveContainer: HTMLElement | null,
): void {
  const doc = mirrorRoot.ownerDocument;
  const target = liveContainer ?? mirrorRoot;
  const el = createBlockElement(block, doc);
  target.appendChild(el);
}
