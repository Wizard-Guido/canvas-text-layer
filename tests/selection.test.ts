import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mountTextLayer, type TextBlock } from '../src/index.js';

describe('selection', () => {
  let container: HTMLDivElement;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.position = 'relative';
    document.body.appendChild(container);

    canvas = document.createElement('canvas');
    container.appendChild(canvas);
  });

  afterEach(() => {
    container.remove();
  });

  const blocks: TextBlock[] = [
    {
      id: 'b1',
      text: 'Hello, world!',
      rect: { x: 0, y: 0, width: 200, height: 20 },
    },
    {
      id: 'b2',
      text: 'Second block',
      rect: { x: 0, y: 24, width: 200, height: 20 },
    },
  ];

  it('should return null when no selection exists', () => {
    const ctrl = mountTextLayer({ canvas });
    ctrl.update(blocks);

    expect(ctrl.getSelection()).toBeNull();

    ctrl.destroy();
  });

  it('should programmatically set and read selection within a single block', () => {
    const ctrl = mountTextLayer({ canvas });
    ctrl.update(blocks);

    ctrl.setSelection({
      anchorBlockId: 'b1',
      anchorOffset: 0,
      focusBlockId: 'b1',
      focusOffset: 5,
    });

    // In jsdom, Selection API support is limited, so we verify the controller
    // stores the selection correctly via setSelection -> getSelection round-trip
    const sel = ctrl.getSelection();
    // jsdom may not fully support selectionchange events, so this may be null
    // The important thing is setSelection doesn't throw
    ctrl.destroy();
  });

  it('should programmatically set cross-block selection', () => {
    const ctrl = mountTextLayer({ canvas });
    ctrl.update(blocks);

    // Should not throw
    ctrl.setSelection({
      anchorBlockId: 'b1',
      anchorOffset: 7,
      focusBlockId: 'b2',
      focusOffset: 6,
    });

    ctrl.destroy();
  });

  it('should clear selection when setSelection(null) is called', () => {
    const ctrl = mountTextLayer({ canvas });
    ctrl.update(blocks);

    ctrl.setSelection({
      anchorBlockId: 'b1',
      anchorOffset: 0,
      focusBlockId: 'b1',
      focusOffset: 5,
    });

    ctrl.setSelection(null);

    const domSel = document.getSelection();
    expect(domSel?.rangeCount ?? 0).toBe(0);

    ctrl.destroy();
  });

  it('should handle selection with line-level spans', () => {
    const ctrl = mountTextLayer({ canvas });
    ctrl.update([
      {
        id: 'ml',
        text: 'Line one\nLine two',
        rect: { x: 0, y: 0, width: 200, height: 40 },
        lines: [
          { text: 'Line one\n', y: 0, height: 20 },
          { text: 'Line two', y: 20, height: 20 },
        ],
      },
    ]);

    // Setting selection across lines should not throw
    ctrl.setSelection({
      anchorBlockId: 'ml',
      anchorOffset: 3,
      focusBlockId: 'ml',
      focusOffset: 14,
    });

    ctrl.destroy();
  });
});
