import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mountTextLayer, type TextBlock } from '../src/index.js';
import { pixelAlignBlockWidths } from '../src/mirror.js';

describe('mirror', () => {
  let container: HTMLDivElement;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.position = 'relative';
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    container.appendChild(canvas);
  });

  afterEach(() => {
    container.remove();
  });

  function makeBlock(overrides: Partial<TextBlock> = {}): TextBlock {
    return {
      id: 'block-1',
      text: 'Hello, world!',
      rect: { x: 0, y: 0, width: 200, height: 20 },
      ...overrides,
    };
  }

  it('should mount a mirror root with correct ARIA attributes', () => {
    const ctrl = mountTextLayer({
      canvas,
      role: 'document',
      label: 'Chat transcript',
    });

    const mirrorRoot = container.querySelector('[role="document"]');
    expect(mirrorRoot).not.toBeNull();
    expect(mirrorRoot?.getAttribute('aria-label')).toBe('Chat transcript');
    expect(mirrorRoot?.getAttribute('tabindex')).toBe('0');

    ctrl.destroy();
  });

  it('should create block elements with text content on update()', () => {
    const ctrl = mountTextLayer({ canvas });

    ctrl.update([
      makeBlock({ id: 'b1', text: 'First paragraph' }),
      makeBlock({ id: 'b2', text: 'Second paragraph' }),
    ]);

    const mirrorRoot = container.querySelector('[role="document"]')!;
    const blocks = mirrorRoot.querySelectorAll('[data-block-id]');
    expect(blocks.length).toBe(2);

    expect(blocks[0].textContent).toBe('First paragraph');
    expect(blocks[1].textContent).toBe('Second paragraph');

    ctrl.destroy();
  });

  it('should position block elements according to rect', () => {
    const ctrl = mountTextLayer({ canvas });

    ctrl.update([
      makeBlock({ id: 'b1', rect: { x: 10, y: 20, width: 300, height: 24 } }),
    ]);

    const mirrorRoot = container.querySelector('[role="document"]')!;
    const blockEl = mirrorRoot.querySelector('[data-block-id="b1"]') as HTMLElement;
    expect(blockEl.style.left).toBe('10px');
    expect(blockEl.style.top).toBe('20px');
    expect(blockEl.style.width).toBe('300px');
    expect(blockEl.style.height).toBe('24px');

    ctrl.destroy();
  });

  it('should use semantic HTML tags based on semantics field', () => {
    const ctrl = mountTextLayer({ canvas });

    ctrl.update([
      makeBlock({ id: 'h1', text: 'Title', semantics: 'heading-1' }),
      makeBlock({ id: 'p1', text: 'Body text', semantics: 'paragraph' }),
      makeBlock({ id: 'c1', text: 'code()', semantics: 'code' }),
      makeBlock({ id: 'q1', text: 'A quote', semantics: 'quote' }),
    ]);

    const mirrorRoot = container.querySelector('[role="document"]')!;
    expect(mirrorRoot.querySelector('h1')?.textContent).toBe('Title');
    expect(mirrorRoot.querySelector('p')?.textContent).toBe('Body text');
    expect(mirrorRoot.querySelector('pre')?.textContent).toBe('code()');
    expect(mirrorRoot.querySelector('blockquote')?.textContent).toBe('A quote');

    ctrl.destroy();
  });

  it('should make text transparent but selectable', () => {
    const ctrl = mountTextLayer({ canvas });
    ctrl.update([makeBlock()]);

    const mirrorRoot = container.querySelector('[role="document"]')!;
    const blockEl = mirrorRoot.querySelector('[data-block-id]') as HTMLElement;
    expect(blockEl.style.color).toBe('transparent');
    expect(blockEl.style.userSelect).toBe('text');
    expect(blockEl.style.pointerEvents).toBe('auto');

    ctrl.destroy();
  });

  it('should diff blocks by id — update changed, remove stale, add new', () => {
    const ctrl = mountTextLayer({ canvas });

    // Initial state
    ctrl.update([
      makeBlock({ id: 'a', text: 'Alpha' }),
      makeBlock({ id: 'b', text: 'Beta' }),
      makeBlock({ id: 'c', text: 'Charlie' }),
    ]);

    const mirrorRoot = container.querySelector('[role="document"]')!;
    expect(mirrorRoot.querySelectorAll('[data-block-id]').length).toBe(3);

    // Update: remove 'b', change 'a', add 'd'
    ctrl.update([
      makeBlock({ id: 'a', text: 'Alpha updated' }),
      makeBlock({ id: 'c', text: 'Charlie' }),
      makeBlock({ id: 'd', text: 'Delta' }),
    ]);

    const blocks = mirrorRoot.querySelectorAll('[data-block-id]');
    expect(blocks.length).toBe(3);
    expect(blocks[0].getAttribute('data-block-id')).toBe('a');
    expect(blocks[0].textContent).toBe('Alpha updated');
    expect(blocks[1].getAttribute('data-block-id')).toBe('c');
    expect(blocks[2].getAttribute('data-block-id')).toBe('d');
    expect(mirrorRoot.querySelector('[data-block-id="b"]')).toBeNull();

    ctrl.destroy();
  });

  it('should append blocks via append()', () => {
    const ctrl = mountTextLayer({ canvas });

    ctrl.append(makeBlock({ id: 'x1', text: 'Streamed message 1' }));
    ctrl.append(makeBlock({ id: 'x2', text: 'Streamed message 2' }));

    const mirrorRoot = container.querySelector('[role="document"]')!;
    const blocks = mirrorRoot.querySelectorAll('[data-block-id]');
    expect(blocks.length).toBe(2);
    expect(blocks[0].textContent).toBe('Streamed message 1');
    expect(blocks[1].textContent).toBe('Streamed message 2');

    ctrl.destroy();
  });

  it('should set speaker as aria-label', () => {
    const ctrl = mountTextLayer({ canvas });
    ctrl.update([makeBlock({ id: 's1', text: 'Hi there', speaker: 'Alice' })]);

    const mirrorRoot = container.querySelector('[role="document"]')!;
    const blockEl = mirrorRoot.querySelector('[data-block-id="s1"]')!;
    expect(blockEl.getAttribute('aria-label')).toBe('Alice: Hi there');

    ctrl.destroy();
  });

  it('should create line-level spans when lines are provided', () => {
    const ctrl = mountTextLayer({ canvas });
    ctrl.update([
      makeBlock({
        id: 'ml',
        text: 'Line one\nLine two',
        rect: { x: 0, y: 0, width: 200, height: 40 },
        lines: [
          { text: 'Line one\n', y: 0, height: 20 },
          { text: 'Line two', y: 20, height: 20 },
        ],
      }),
    ]);

    const mirrorRoot = container.querySelector('[role="document"]')!;
    const blockEl = mirrorRoot.querySelector('[data-block-id="ml"]')!;
    const spans = blockEl.querySelectorAll('span');
    expect(spans.length).toBe(2);
    expect(spans[0].textContent).toBe('Line one\n');
    expect(spans[1].textContent).toBe('Line two');

    ctrl.destroy();
  });

  it('should clean up on destroy()', () => {
    const ctrl = mountTextLayer({ canvas });
    ctrl.update([makeBlock()]);

    expect(container.querySelector('[role="document"]')).not.toBeNull();

    ctrl.destroy();

    expect(container.querySelector('[role="document"]')).toBeNull();
  });

  it('should set container to position: relative if it is static', () => {
    const staticContainer = document.createElement('div');
    document.body.appendChild(staticContainer);
    const c = document.createElement('canvas');
    staticContainer.appendChild(c);

    const ctrl = mountTextLayer({ canvas: c });
    expect(staticContainer.style.position).toBe('relative');

    ctrl.destroy();
    staticContainer.remove();
  });

  it('should apply explicit fontSize and fontFamily for Ctrl+F alignment', () => {
    const ctrl = mountTextLayer({ canvas });
    ctrl.update([
      makeBlock({
        id: 'styled',
        text: 'Styled text',
        rect: { x: 0, y: 0, width: 200, height: 20 },
        fontSize: 14,
        fontFamily: '-apple-system, sans-serif',
        lines: [{ text: 'Styled text', y: 0, height: 20 }],
      }),
    ]);

    const mirrorRoot = container.querySelector('[role="document"]')!;
    const blockEl = mirrorRoot.querySelector('[data-block-id="styled"]') as HTMLElement;
    expect(blockEl.style.fontSize).toBe('14px');
    expect(blockEl.style.fontFamily).toContain('-apple-system');
    // Line height should still come from lines[0].height, not font size
    expect(blockEl.style.lineHeight).toBe('20px');

    ctrl.destroy();
  });

  it('should fall back to rect.height / lines.length when fontSize is omitted', () => {
    const ctrl = mountTextLayer({ canvas });
    ctrl.update([
      makeBlock({
        id: 'noFont',
        text: 'Two lines',
        rect: { x: 0, y: 0, width: 200, height: 40 },
        lines: [
          { text: 'Line one', y: 0, height: 20 },
          { text: 'Line two', y: 20, height: 20 },
        ],
      }),
    ]);

    const mirrorRoot = container.querySelector('[role="document"]')!;
    const blockEl = mirrorRoot.querySelector('[data-block-id="noFont"]') as HTMLElement;
    // 40 / 2 = 20
    expect(blockEl.style.fontSize).toBe('20px');

    ctrl.destroy();
  });

  it('should apply fontWeight and fontStyle to the block element', () => {
    const ctrl = mountTextLayer({ canvas });
    ctrl.update([
      makeBlock({
        id: 'bold',
        text: 'Bold text',
        rect: { x: 0, y: 0, width: 200, height: 24 },
        fontSize: 18,
        fontFamily: 'Georgia, serif',
        fontWeight: 'bold',
        lines: [{ text: 'Bold text', y: 0, height: 24 }],
      }),
      makeBlock({
        id: 'italic',
        text: 'Italic text',
        rect: { x: 0, y: 30, width: 200, height: 20 },
        fontSize: 14,
        fontFamily: 'Georgia, serif',
        fontStyle: 'italic',
        lines: [{ text: 'Italic text', y: 30, height: 20 }],
      }),
    ]);

    const mirrorRoot = container.querySelector('[role="document"]')!;
    const boldEl = mirrorRoot.querySelector('[data-block-id="bold"]') as HTMLElement;
    const italicEl = mirrorRoot.querySelector('[data-block-id="italic"]') as HTMLElement;

    expect(boldEl.style.fontWeight).toBe('bold');
    expect(italicEl.style.fontStyle).toBe('italic');

    ctrl.destroy();
  });

  it('should tag line spans with data-line-text for width alignment', () => {
    const ctrl = mountTextLayer({ canvas });
    ctrl.update([
      makeBlock({
        id: 'multi',
        text: 'Line one\nLine two',
        rect: { x: 0, y: 0, width: 200, height: 40 },
        lines: [
          { text: 'Line one\n', y: 0, height: 20 },
          { text: 'Line two', y: 20, height: 20 },
        ],
      }),
    ]);

    const mirrorRoot = container.querySelector('[role="document"]')!;
    const lineSpans = mirrorRoot.querySelectorAll<HTMLElement>('[data-line-text]');
    expect(lineSpans.length).toBe(2);
    expect(lineSpans[0].dataset.lineText).toBe('Line one\n');
    expect(lineSpans[1].dataset.lineText).toBe('Line two');
    // transform-origin is set so scaleX, when applied, anchors at the left
    expect(lineSpans[0].style.transformOrigin).toContain('left');

    ctrl.destroy();
  });

  it('should accept pixelAlignWidths option without throwing', () => {
    // jsdom doesn't fully implement getBoundingClientRect on ranges, so we
    // can't assert the scale ratio numerically — just that passing the flag
    // through and calling update() does not throw.
    const ctrl = mountTextLayer({ canvas, pixelAlignWidths: false });
    ctrl.update([makeBlock({ id: 'noalign', text: 'unaligned' })]);
    ctrl.destroy();

    const ctrl2 = mountTextLayer({ canvas, pixelAlignWidths: true });
    ctrl2.update([
      makeBlock({
        id: 'aligned',
        text: 'will try to align',
        fontSize: 14,
        fontFamily: 'sans-serif',
      }),
    ]);
    ctrl2.destroy();
  });

  it('should strip newlines from text before calling measureText (regression: line-end \\n caused mid-line character drift)', () => {
    // Background: when callers pass per-line text with a trailing `\n` (a common
    // pattern so that Selection.toString() produces readable multi-line copies),
    // canvas measureText and DOM rendering handle `\n` differently:
    //   - ctx.measureText("text\n") adds a glyph advance for `\n` (~4-5px)
    //   - DOM with white-space: pre-wrap renders `\n` as a zero-width line break
    // If we passed the raw text to both, canvasWidth > domWidth by a spurious
    // margin, yielding a ratio > 1 that over-stretches the line. pixelAlignBlockWidths
    // must strip `\n`/`\r` before measurement so both sides see the same string.

    // Mount a real mirror so we get a valid DOM tree with line spans.
    const ctrl = mountTextLayer({ canvas, pixelAlignWidths: false });
    ctrl.update([
      makeBlock({
        id: 'nl',
        text: 'Line one\nLine two',
        rect: { x: 0, y: 0, width: 200, height: 40 },
        fontSize: 14,
        fontFamily: 'sans-serif',
        lines: [
          { text: 'Line one\n', y: 0, height: 20 },
          { text: 'Line two', y: 20, height: 20 },
        ],
      }),
    ]);

    const mirrorRoot = container.querySelector('[role="document"]') as HTMLElement;

    // jsdom doesn't implement Range.getBoundingClientRect; stub it for this test.
    const rangeProto = Range.prototype as unknown as {
      getBoundingClientRect?: () => { width: number; height: number };
    };
    const originalGBCR = rangeProto.getBoundingClientRect;
    rangeProto.getBoundingClientRect = () => ({ width: 100, height: 20 } as DOMRect);

    // Mock a measureCtx that records every string measureText() sees
    const received: string[] = [];
    const mockCtx = {
      font: '',
      measureText: (text: string) => {
        received.push(text);
        return { width: 100 } as TextMetrics;
      },
    } as unknown as CanvasRenderingContext2D;

    pixelAlignBlockWidths(
      mirrorRoot,
      [
        {
          id: 'nl',
          text: 'Line one\nLine two',
          rect: { x: 0, y: 0, width: 200, height: 40 },
          fontSize: 14,
          fontFamily: 'sans-serif',
          lines: [
            { text: 'Line one\n', y: 0, height: 20 },
            { text: 'Line two', y: 20, height: 20 },
          ],
        },
      ],
      mockCtx,
    );

    expect(received.length).toBeGreaterThan(0);
    for (const s of received) {
      expect(s).not.toContain('\n');
      expect(s).not.toContain('\r');
    }

    // Restore jsdom's Range prototype
    if (originalGBCR) {
      rangeProto.getBoundingClientRect = originalGBCR;
    } else {
      delete rangeProto.getBoundingClientRect;
    }
    ctrl.destroy();
  });

  it('should skip pixel alignment when measureCtx is null (e.g. jsdom without canvas)', () => {
    // Guards against a crash when environments report no 2D context.
    const mirrorRoot = document.createElement('div');
    expect(() =>
      pixelAlignBlockWidths(
        mirrorRoot,
        [
          {
            id: 'x',
            text: 'anything',
            rect: { x: 0, y: 0, width: 100, height: 20 },
            fontSize: 14,
            fontFamily: 'sans-serif',
          },
        ],
        null,
      ),
    ).not.toThrow();
  });

  it('should support textbox role with readonly attributes', () => {
    const ctrl = mountTextLayer({ canvas, role: 'textbox' });

    const mirrorRoot = container.querySelector('[role="textbox"]');
    expect(mirrorRoot).not.toBeNull();
    expect(mirrorRoot?.getAttribute('aria-readonly')).toBe('true');
    expect(mirrorRoot?.getAttribute('aria-multiline')).toBe('true');

    ctrl.destroy();
  });
});
