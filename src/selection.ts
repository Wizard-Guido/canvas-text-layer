import type { TextSelection } from './types.js';

/**
 * Find the block element ancestor of a given DOM node within the mirror root.
 * Returns the element with data-block-id, or null if not found.
 */
function findBlockElement(node: Node, mirrorRoot: HTMLElement): HTMLElement | null {
  let current: Node | null = node;
  while (current && current !== mirrorRoot) {
    if (current instanceof HTMLElement && current.dataset.blockId) {
      return current;
    }
    current = current.parentNode;
  }
  return null;
}

/**
 * Calculate the character offset within a block element for a given
 * DOM node + offset pair. Walks text nodes in DOM order to sum up
 * preceding character counts.
 */
function computeBlockOffset(blockEl: HTMLElement, node: Node, offset: number): number {
  let charCount = 0;
  const walker = blockEl.ownerDocument.createTreeWalker(blockEl, NodeFilter.SHOW_TEXT);
  let textNode: Text | null;
  while ((textNode = walker.nextNode() as Text | null)) {
    if (textNode === node) {
      return charCount + offset;
    }
    charCount += textNode.textContent?.length ?? 0;
  }
  // If we didn't find the exact text node (node might be an element),
  // try to use the offset as a child index
  return charCount;
}

/**
 * Convert the current DOM Selection to a TextSelection relative to
 * the mirror's block structure.
 */
export function domSelectionToTextLayer(
  mirrorRoot: HTMLElement,
): TextSelection | null {
  const sel = mirrorRoot.ownerDocument.getSelection();
  if (!sel || sel.isCollapsed || !sel.anchorNode || !sel.focusNode) {
    return null;
  }

  const anchorBlock = findBlockElement(sel.anchorNode, mirrorRoot);
  const focusBlock = findBlockElement(sel.focusNode, mirrorRoot);

  if (!anchorBlock || !focusBlock) {
    return null;
  }

  const anchorBlockId = anchorBlock.dataset.blockId!;
  const focusBlockId = focusBlock.dataset.blockId!;

  const anchorOffset = computeBlockOffset(anchorBlock, sel.anchorNode, sel.anchorOffset);
  const focusOffset = computeBlockOffset(focusBlock, sel.focusNode, sel.focusOffset);

  return { anchorBlockId, anchorOffset, focusBlockId, focusOffset };
}

function findBlockById(mirrorRoot: HTMLElement, blockId: string): HTMLElement | null {
  for (const child of Array.from(mirrorRoot.querySelectorAll<HTMLElement>('[data-block-id]'))) {
    if (child.dataset.blockId === blockId) return child;
  }
  return null;
}

/**
 * Programmatically set a DOM selection from an TextSelection.
 */
export function textLayerSelectionToDom(
  mirrorRoot: HTMLElement,
  sel: TextSelection | null,
): void {
  const domSel = mirrorRoot.ownerDocument.getSelection();
  if (!domSel) return;

  if (!sel) {
    domSel.removeAllRanges();
    return;
  }

  const anchorBlock = findBlockById(mirrorRoot, sel.anchorBlockId);
  const focusBlock = findBlockById(mirrorRoot, sel.focusBlockId);

  if (!anchorBlock || !focusBlock) return;

  const anchorPos = findTextPosition(anchorBlock, sel.anchorOffset);
  const focusPos = findTextPosition(focusBlock, sel.focusOffset);

  if (!anchorPos || !focusPos) return;

  domSel.removeAllRanges();
  const range = mirrorRoot.ownerDocument.createRange();
  range.setStart(anchorPos.node, anchorPos.offset);
  range.setEnd(focusPos.node, focusPos.offset);
  domSel.addRange(range);
}

/**
 * Find the text node and local offset for a given character offset
 * within a block element.
 */
function findTextPosition(
  blockEl: HTMLElement,
  charOffset: number,
): { node: Text; offset: number } | null {
  const walker = blockEl.ownerDocument.createTreeWalker(blockEl, NodeFilter.SHOW_TEXT);
  let remaining = charOffset;
  let textNode: Text | null;

  while ((textNode = walker.nextNode() as Text | null)) {
    const len = textNode.textContent?.length ?? 0;
    if (remaining <= len) {
      return { node: textNode, offset: remaining };
    }
    remaining -= len;
  }

  // If offset exceeds content, clamp to end of last text node
  let lastSeen: Text | null = null;
  const walker2 = blockEl.ownerDocument.createTreeWalker(blockEl, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker2.nextNode())) {
    lastSeen = n as Text;
  }
  if (lastSeen) {
    return { node: lastSeen, offset: lastSeen.textContent?.length ?? 0 };
  }

  return null;
}
