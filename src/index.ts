export type {
  TextLayerOptions,
  TextLayerController,
  TextBlock,
  TextSelection,
} from './types.js';

import type {
  TextLayerOptions,
  TextLayerController,
  TextBlock,
  TextSelection,
} from './types.js';
import {
  createMirrorRoot,
  syncBlocks,
  appendBlock,
  pixelAlignBlockWidths,
} from './mirror.js';
import { domSelectionToTextLayer, textLayerSelectionToDom } from './selection.js';
import {
  createLiveRegion,
  queueBlockForAnnouncement,
  destroyLiveRegion,
  type LiveRegionState,
} from './live-region.js';

/**
 * Mount an invisible DOM mirror over a canvas element, making canvas-rendered
 * text searchable (Ctrl+F), selectable, copyable, and readable by screen readers.
 *
 * This is the DOM-mirror technique used inside Mozilla PDF.js's `TextLayer`,
 * extracted as a framework-agnostic primitive.
 */
export function mountTextLayer(options: TextLayerOptions): TextLayerController {
  const {
    canvas,
    container = canvas.parentElement,
    role = 'document',
    label,
    live = 'off',
    selectable = true,
    pixelAlignWidths = true,
  } = options;

  // Dedicated offscreen 2D context for text-width measurement.
  // Using a separate canvas avoids mutating the caller's ctx.font state.
  let measureCtx: CanvasRenderingContext2D | null = null;
  if (pixelAlignWidths) {
    try {
      const measureCanvas = canvas.ownerDocument.createElement('canvas');
      measureCtx = measureCanvas.getContext('2d');
    } catch {
      // Environments without canvas 2D support (e.g. jsdom) — silently skip alignment.
      measureCtx = null;
    }
  }

  if (!container) {
    throw new Error(
      'canvas-text-layer: canvas must have a parentElement, or provide a container option.',
    );
  }

  // Ensure the container is positioned so absolute children work
  const containerPosition = getComputedStyle(container).position;
  if (containerPosition === 'static') {
    container.style.position = 'relative';
  }

  const doc = container.ownerDocument;
  const mirrorRoot = createMirrorRoot(doc);

  // Set ARIA attributes on the mirror root
  mirrorRoot.setAttribute('role', role);
  if (label) {
    mirrorRoot.setAttribute('aria-label', label);
  }
  // Mark as readonly for textbox role
  if (role === 'textbox') {
    mirrorRoot.setAttribute('aria-readonly', 'true');
    mirrorRoot.setAttribute('aria-multiline', 'true');
  }

  if (!selectable) {
    mirrorRoot.style.userSelect = 'none';
    mirrorRoot.style.pointerEvents = 'none';
  }

  // Tab-focusable so keyboard users can reach it
  mirrorRoot.tabIndex = 0;

  container.appendChild(mirrorRoot);

  // Set up live region if needed
  let liveState: LiveRegionState | null = null;
  let liveContainer: HTMLElement | null = null;
  if (live !== 'off') {
    liveState = createLiveRegion(mirrorRoot, live);
    liveContainer = liveState.container;
  }

  // Track current selection
  let currentSelection: TextSelection | null = null;

  const onSelectionChange = () => {
    currentSelection = domSelectionToTextLayer(mirrorRoot);
  };

  doc.addEventListener('selectionchange', onSelectionChange);

  // Track the current set of blocks so append() can also trigger a re-align
  let currentBlocks: TextBlock[] = [];

  const controller: TextLayerController = {
    update(blocks: TextBlock[]): void {
      syncBlocks(mirrorRoot, blocks, liveContainer);
      currentBlocks = blocks;
      pixelAlignBlockWidths(mirrorRoot, blocks, measureCtx);
    },

    append(block: TextBlock): void {
      if (liveState) {
        // In live mode, debounce announcements
        queueBlockForAnnouncement(liveState, block);
      } else {
        appendBlock(mirrorRoot, block, null);
      }
      currentBlocks = [...currentBlocks, block];
      // Align only the newly appended block (pixelAlignBlockWidths handles a list)
      pixelAlignBlockWidths(mirrorRoot, [block], measureCtx);
    },

    getSelection(): TextSelection | null {
      return currentSelection;
    },

    setSelection(sel: TextSelection | null): void {
      currentSelection = sel;
      textLayerSelectionToDom(mirrorRoot, sel);
    },

    destroy(): void {
      doc.removeEventListener('selectionchange', onSelectionChange);
      if (liveState) {
        destroyLiveRegion(liveState);
      }
      mirrorRoot.remove();
    },
  };

  return controller;
}
