import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mountTextLayer, type TextBlock } from '../src/index.js';

describe('live-region', () => {
  let container: HTMLDivElement;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    container.style.position = 'relative';
    document.body.appendChild(container);

    canvas = document.createElement('canvas');
    container.appendChild(canvas);
  });

  afterEach(() => {
    vi.useRealTimers();
    container.remove();
  });

  function makeBlock(id: string, text: string): TextBlock {
    return {
      id,
      text,
      rect: { x: 0, y: 0, width: 200, height: 20 },
    };
  }

  it('should create an aria-live container when live mode is enabled', () => {
    const ctrl = mountTextLayer({ canvas, live: 'polite' });

    const mirrorRoot = container.querySelector('[role="document"]')!;
    const liveRegion = mirrorRoot.querySelector('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
    expect(liveRegion?.getAttribute('aria-atomic')).toBe('false');
    expect(liveRegion?.getAttribute('aria-relevant')).toBe('additions');

    ctrl.destroy();
  });

  it('should support assertive live mode', () => {
    const ctrl = mountTextLayer({ canvas, live: 'assertive' });

    const mirrorRoot = container.querySelector('[role="document"]')!;
    const liveRegion = mirrorRoot.querySelector('[aria-live="assertive"]');
    expect(liveRegion).not.toBeNull();

    ctrl.destroy();
  });

  it('should debounce appended blocks and flush after 500ms', () => {
    const ctrl = mountTextLayer({ canvas, live: 'polite' });

    // Rapidly append blocks (simulating streaming tokens)
    ctrl.append(makeBlock('t1', 'Hello'));
    ctrl.append(makeBlock('t2', 'world'));
    ctrl.append(makeBlock('t3', '!'));

    // Before debounce timeout, blocks should not be in DOM yet
    const mirrorRoot = container.querySelector('[role="document"]')!;
    const liveRegion = mirrorRoot.querySelector('[aria-live="polite"]')!;
    expect(liveRegion.querySelectorAll('[data-block-id]').length).toBe(0);

    // Advance past the 500ms debounce
    vi.advanceTimersByTime(500);

    // Now blocks should be flushed into the live region
    expect(liveRegion.querySelectorAll('[data-block-id]').length).toBe(3);
    expect(liveRegion.querySelector('[data-block-id="t1"]')?.textContent).toBe('Hello');
    expect(liveRegion.querySelector('[data-block-id="t2"]')?.textContent).toBe('world');
    expect(liveRegion.querySelector('[data-block-id="t3"]')?.textContent).toBe('!');

    ctrl.destroy();
  });

  it('should not create a live region when live is off', () => {
    const ctrl = mountTextLayer({ canvas, live: 'off' });

    const mirrorRoot = container.querySelector('[role="document"]')!;
    expect(mirrorRoot.querySelector('[aria-live]')).toBeNull();

    ctrl.destroy();
  });

  it('should clean up live region on destroy', () => {
    const ctrl = mountTextLayer({ canvas, live: 'polite' });
    ctrl.append(makeBlock('x', 'test'));

    ctrl.destroy();

    expect(container.querySelector('[aria-live]')).toBeNull();
  });
});
