import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import axe from 'axe-core';
import { mountTextLayer, type TextBlock } from '../src/index.js';

describe('axe-core a11y audit', () => {
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

  const sampleBlocks: TextBlock[] = [
    {
      id: 'h1',
      text: 'Welcome to the Chat',
      rect: { x: 10, y: 10, width: 400, height: 32 },
      semantics: 'heading-1',
    },
    {
      id: 'p1',
      text: 'This is a paragraph of text rendered on canvas.',
      rect: { x: 10, y: 50, width: 400, height: 20 },
      semantics: 'paragraph',
    },
    {
      id: 'p2',
      text: 'Another paragraph with some content.',
      rect: { x: 10, y: 80, width: 400, height: 20 },
      semantics: 'paragraph',
      speaker: 'Assistant',
    },
    {
      id: 'code1',
      text: 'const x = 42;',
      rect: { x: 10, y: 110, width: 400, height: 20 },
      semantics: 'code',
    },
  ];

  it('should have zero axe-core violations with document role', async () => {
    const ctrl = mountTextLayer({
      canvas,
      role: 'document',
      label: 'Chat transcript',
    });
    ctrl.update(sampleBlocks);

    const mirrorRoot = container.querySelector('[role="document"]')!;
    const results = await axe.run(mirrorRoot as HTMLElement);

    if (results.violations.length > 0) {
      const summary = results.violations
        .map((v) => `${v.id}: ${v.description} (${v.nodes.length} nodes)`)
        .join('\n');
      console.error('axe violations:\n' + summary);
    }

    expect(results.violations.length).toBe(0);

    ctrl.destroy();
  });

  it('should have zero violations with log role and aria-live', async () => {
    const ctrl = mountTextLayer({
      canvas,
      role: 'log',
      label: 'Chat messages',
      live: 'polite',
    });
    ctrl.update(sampleBlocks);

    const mirrorRoot = container.querySelector('[role="log"]')!;
    const results = await axe.run(mirrorRoot as HTMLElement);

    if (results.violations.length > 0) {
      const summary = results.violations
        .map((v) => `${v.id}: ${v.description} (${v.nodes.length} nodes)`)
        .join('\n');
      console.error('axe violations:\n' + summary);
    }

    expect(results.violations.length).toBe(0);

    ctrl.destroy();
  });

  it('should have zero violations with empty mirror', async () => {
    const ctrl = mountTextLayer({
      canvas,
      label: 'Empty document',
    });
    ctrl.update([]);

    const mirrorRoot = container.querySelector('[role="document"]')!;
    const results = await axe.run(mirrorRoot as HTMLElement);

    expect(results.violations.length).toBe(0);

    ctrl.destroy();
  });
});
