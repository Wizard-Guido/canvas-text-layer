import type { TextBlock } from './types.js';
import { appendBlock } from './mirror.js';

const DEFAULT_DEBOUNCE_MS = 500;

export interface LiveRegionState {
  container: HTMLElement;
  pendingBlocks: TextBlock[];
  timer: ReturnType<typeof setTimeout> | null;
  mirrorRoot: HTMLElement;
}

export function createLiveRegion(
  mirrorRoot: HTMLElement,
  mode: 'polite' | 'assertive',
): LiveRegionState {
  const doc = mirrorRoot.ownerDocument;
  const container = doc.createElement('div');
  container.setAttribute('aria-live', mode);
  container.setAttribute('aria-atomic', 'false');
  container.setAttribute('aria-relevant', 'additions');
  container.style.position = 'absolute';
  container.style.inset = '0';
  container.style.overflow = 'hidden';
  container.style.pointerEvents = 'none';
  mirrorRoot.appendChild(container);

  return {
    container,
    pendingBlocks: [],
    timer: null,
    mirrorRoot,
  };
}

/**
 * Queue a block to be announced. Uses debouncing so that rapid
 * streaming tokens don't trigger per-character announcements.
 * Instead, waits for a ~500ms pause then flushes the batch.
 */
export function queueBlockForAnnouncement(
  state: LiveRegionState,
  block: TextBlock,
): void {
  state.pendingBlocks.push(block);

  if (state.timer !== null) {
    clearTimeout(state.timer);
  }

  state.timer = setTimeout(() => {
    flushPendingBlocks(state);
  }, DEFAULT_DEBOUNCE_MS);
}

function flushPendingBlocks(state: LiveRegionState): void {
  for (const block of state.pendingBlocks) {
    appendBlock(state.mirrorRoot, block, state.container);
  }
  state.pendingBlocks = [];
  state.timer = null;
}

export function destroyLiveRegion(state: LiveRegionState): void {
  if (state.timer !== null) {
    clearTimeout(state.timer);
    state.timer = null;
  }
  state.pendingBlocks = [];
  state.container.remove();
}
