# canvas-text-layer

> The DOM text-mirror technique from Mozilla PDF.js — extracted as a 13 KB, framework-agnostic library for any canvas.

[![npm version](https://img.shields.io/npm/v/canvas-text-layer.svg?label=npm&color=cb3837)](https://www.npmjs.com/package/canvas-text-layer)
[![size](https://img.shields.io/badge/size-13%20KB-blue.svg)](./dist)
[![zero deps](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](./package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](./src/types.ts)
[![tests](https://img.shields.io/badge/tests-32%20passing-brightgreen.svg)](./tests)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

`<canvas>` text is pixels. Screen readers can't read it. Browsers can't search it. Users can't select it. Most canvas apps just ship a broken accessibility story and hope nobody notices.

`canvas-text-layer` fixes that with **one API call**.

```ts
import { mountTextLayer } from 'canvas-text-layer';

mountTextLayer({ canvas, label: 'Chat transcript' }).update([
  { id: 'm1', text: 'Hello, world!',
    rect: { x: 10, y: 10, width: 200, height: 20 },
    fontSize: 14, fontFamily: 'sans-serif' },
]);
```

That's it. Ctrl+F now finds your text. VoiceOver reads it. Users can select and copy. [Try the live demo →](https://Wizard-Guido.github.io/canvas-text-layer/)

---

## Why this exists

If you render text on `<canvas>` — in a chat UI, whiteboard, PDF viewer, data visualization, diagramming tool, or game menu — you've deleted four basic capabilities users expect from the web:

| Feature | `<canvas>` alone | With `canvas-text-layer` |
|---|---|---|
| Screen readers announce text | ❌ | ✅ |
| Ctrl+F / Cmd+F finds text | ❌ | ✅ |
| Users can select & copy text | ❌ | ✅ |
| Meets WCAG 1.1.1, 1.4.5, 4.1.2 | ❌ | ✅ |
| `aria-live` for streaming content | ❌ | ✅ |
| SEO / indexability | ❌ | ✅ |

Google Docs, Figma, and Quip all solve this with a private, in-house DOM mirror overlay. Mozilla PDF.js has done the same for a decade inside its `TextLayer` module. Until now, no one extracted it as a reusable primitive.

---

## Install

```bash
npm install canvas-text-layer
# or
pnpm add canvas-text-layer
# or
bun add canvas-text-layer
```

- **Zero runtime dependencies.**
- **13 KB minified** (`dist/index.js`).
- **Full TypeScript types** shipped.
- **ESM + CJS** both in the box.
- **Browser-only** (uses DOM APIs — not a Node library).

---

## How it works

`canvas-text-layer` mounts an invisible, absolutely-positioned `<div>` over your canvas. For every text block you render, it adds a DOM element at the same coordinates with `color: transparent`. The result: sighted users see the canvas pixels, but the browser, accessibility tree, and find-in-page see real DOM text.

```
   ┌──────────────────────────────────────────────┐
   │  Your container (position: relative)         │
   │                                              │
   │   ┌─────────────────────────────────────┐    │
   │   │  <canvas>     (visible to humans)   │    │
   │   │   ┌────────────────┐                │    │
   │   │   │  "Hello world" │  <- pixels     │    │
   │   │   └────────────────┘                │    │
   │   └─────────────────────────────────────┘    │
   │                                              │
   │   ┌─────────────────────────────────────┐    │
   │   │  <div role="document">              │    │
   │   │     (overlay, color: transparent)   │    │
   │   │   <p data-block-id="p1">            │    │
   │   │      "Hello world"  <- real DOM     │    │
   │   │   </p>      (visible to AT, Ctrl+F, │    │
   │   │              selection)             │    │
   │   └─────────────────────────────────────┘    │
   └──────────────────────────────────────────────┘
```

### Pixel-perfect width alignment (the PDF.js trick)

Even with identical `font-size` and `font-family`, browser DOM text rendering can diverge from canvas rendering by sub-pixel fractions per character. Left uncorrected, that accumulates to 1–3 px drift across long lines, and Ctrl+F highlights visibly miss the canvas glyphs.

For every line, the library measures the canvas width with `ctx.measureText()`, measures the DOM width with `Range.getBoundingClientRect()`, and applies `transform: scaleX(ratio)` to the DOM line. This is the same technique [Mozilla PDF.js](https://github.com/mozilla/pdf.js/blob/master/src/display/text_layer.js) uses in its `TextLayer` to keep PDF text selectable. Opt out with `pixelAlignWidths: false` if you've verified your setup aligns natively.

---

## Quick start

### 1. Canvas-only renderer

```ts
import { mountTextLayer, type TextBlock } from 'canvas-text-layer';

const canvas = document.querySelector('canvas')!;
const ctx = canvas.getContext('2d')!;

// Draw text as usual
ctx.font = '14px sans-serif';
ctx.fillStyle = '#111';
ctx.fillText('Hello, world!', 10, 24);

// Mount once
const layer = mountTextLayer({
  canvas,
  role: 'document',      // or 'log' for chat, 'article' for docs
  label: 'My document',  // what screen readers announce
});

// Tell it what you drew (and where)
layer.update([
  {
    id: 'msg-1',
    text: 'Hello, world!',
    rect: { x: 10, y: 10, width: 200, height: 20 },
    fontSize: 14,
    fontFamily: 'sans-serif',
  },
]);
```

Try Ctrl+F. Try selecting. Open VoiceOver.

### 2. Streaming AI chat

```ts
const layer = mountTextLayer({
  canvas,
  role: 'log',
  label: 'Conversation',
  live: 'polite',   // Screen reader announces new messages as they arrive
});

layer.append({
  id: 'reply-42',
  text: 'Sure! Here's how to handle that edge case…',
  rect: { x: 20, y: 380, width: 600, height: 120 },
  fontSize: 14,
  fontFamily: '-apple-system, sans-serif',
  lines: wrappedLines.map((t, i) => ({
    text: t, y: 380 + i * 20, height: 20,
  })),
  speaker: 'Assistant',
});
```

`live: 'polite'` debounces streaming token updates so VoiceOver doesn't stutter.

### 3. Full re-layout (scroll, resize, virtualization)

```ts
function onLayoutChange() {
  const blocks = layoutVisibleMessages();   // your layout code
  renderToCanvas(blocks);
  layer.update(blocks);                     // diffs by block.id
}
```

`update()` adds new blocks, removes stale ones, and re-positions existing ones — all keyed by `block.id`.

---

## API

### `mountTextLayer(options)`

```ts
function mountTextLayer(options: TextLayerOptions): TextLayerController;
```

| Option | Type | Default | Description |
|---|---|---|---|
| `canvas` | `HTMLCanvasElement` | **required** | The canvas you're drawing on. |
| `container` | `HTMLElement` | `canvas.parentElement` | Where the mirror DOM mounts. Made `position: relative` if static. |
| `role` | `'document' \| 'log' \| 'article' \| 'textbox'` | `'document'` | ARIA role for the mirror root. |
| `label` | `string` | — | `aria-label` for the mirror. **Strongly recommended.** |
| `live` | `'off' \| 'polite' \| 'assertive'` | `'off'` | Wraps content in an `aria-live` region (with 500ms debounce). Use `'polite'` for streaming chat. |
| `selectable` | `boolean` | `true` | Whether users can select text via the mirror. |
| `pixelAlignWidths` | `boolean` | `true` | PDF.js-style `scaleX` per-line width correction. |

### `TextLayerController`

| Method | Description |
|---|---|
| `update(blocks)` | Full sync. Diffs by `block.id` — adds, removes, updates. Call after layout changes. |
| `append(block)` | Optimized streaming append. Fires `aria-live` announcement if enabled. |
| `getSelection()` | Current selection mapped to `{ anchorBlockId, anchorOffset, focusBlockId, focusOffset }`. |
| `setSelection(sel)` | Programmatically select text. Pass `null` to clear. |
| `destroy()` | Tear down. Removes DOM, detaches listeners. |

### `TextBlock`

```ts
interface TextBlock {
  id: string;               // stable — used for diffing
  text: string;             // must match canvas text character-for-character
  rect: { x: number; y: number; width: number; height: number };
  lines?: Array<{ text: string; y: number; height: number }>;
  fontSize?: number;        // MUST match canvas for Ctrl+F alignment
  fontFamily?: string;      // MUST match canvas for Ctrl+F alignment
  fontWeight?: string | number;
  fontStyle?: 'normal' | 'italic' | 'oblique';
  semantics?: 'paragraph' | 'heading-1' | 'heading-2' | 'heading-3'
            | 'code' | 'list-item' | 'quote';
  speaker?: string;         // chat UIs: "Alice" → "Alice: <text>" as aria-label
}
```

---

## Integrations

`canvas-text-layer` is framework-agnostic — it only cares about a `<canvas>` element and block rects.

<details>
<summary><b>Konva</b></summary>

```ts
import Konva from 'konva';
import { mountTextLayer } from 'canvas-text-layer';

const stage = new Konva.Stage({ container: 'app', width: 800, height: 600 });
const layer = new Konva.Layer();
stage.add(layer);

const text = new Konva.Text({ x: 20, y: 40, text: 'Konva text', fontSize: 18 });
layer.add(text);
stage.draw();

// Konva renders to multiple canvases; target the content one
const canvas = stage.findOne('Layer').getCanvas()._canvas as HTMLCanvasElement;
const a11y = mountTextLayer({ canvas, label: 'Diagram' });

a11y.update([{
  id: 'text-1',
  text: text.text(),
  rect: { x: text.x(), y: text.y(), width: text.width(), height: text.height() },
  fontSize: text.fontSize(),
  fontFamily: text.fontFamily(),
}]);
```
</details>

<details>
<summary><b>Fabric.js</b></summary>

```ts
import { fabric } from 'fabric';
import { mountTextLayer } from 'canvas-text-layer';

const canvas = new fabric.Canvas('c');
const text = new fabric.Text('Fabric text', { left: 20, top: 40, fontSize: 18 });
canvas.add(text);

const a11y = mountTextLayer({
  canvas: canvas.getElement(),
  label: 'Canvas content',
});

function syncAccessibility() {
  a11y.update(canvas.getObjects().filter(o => o.type === 'text').map((o, i) => ({
    id: `obj-${i}`,
    text: (o as fabric.Text).text || '',
    rect: { x: o.left!, y: o.top!, width: o.width!, height: o.height! },
    fontSize: (o as fabric.Text).fontSize,
    fontFamily: (o as fabric.Text).fontFamily,
  })));
}

canvas.on('object:modified', syncAccessibility);
canvas.on('object:added', syncAccessibility);
syncAccessibility();
```
</details>

<details>
<summary><b>React</b></summary>

```tsx
import { useEffect, useRef } from 'react';
import { mountTextLayer, type TextBlock } from 'canvas-text-layer';

export function AccessibleCanvas({ blocks }: { blocks: TextBlock[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerRef = useRef<ReturnType<typeof mountTextLayer> | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    layerRef.current = mountTextLayer({ canvas: canvasRef.current, label: 'Doc' });
    return () => layerRef.current?.destroy();
  }, []);

  useEffect(() => { layerRef.current?.update(blocks); }, [blocks]);

  return <canvas ref={canvasRef} width={800} height={600} />;
}
```
</details>

---

## Accessibility guarantees

- `role="document"` (or `log`/`article`/`textbox`) on the mirror root.
- `aria-label` set from the `label` option.
- Semantic HTML: `semantics: 'heading-2'` becomes `<h2>`, `'quote'` becomes `<blockquote>`, `'code'` becomes `<pre>`, `'list-item'` becomes `<li>`, `'paragraph'` becomes `<p>`.
- `aria-live="polite"` (or `"assertive"`) with a 500ms debounce so streaming tokens don't stutter on VoiceOver.
- Keyboard-focusable via `tabindex="0"`.
- Passes all **axe-core** a11y audits (0 violations across the test suite).
- Meets **WCAG 2.1 AA** — 1.1.1 (non-text content), 1.4.5 (images of text), 4.1.2 (name, role, value).

---

## Manual testing checklist

After integrating, verify in a real browser:

- [ ] **Ctrl+F / Cmd+F** — searching for a visible word highlights it over the canvas glyphs (not offset).
- [ ] **Mouse selection** — click-drag across canvas text creates a visible selection.
- [ ] **Cmd+C / Ctrl+C** — copying selected text produces the correct string.
- [ ] **Tab navigation** — pressing Tab focuses the mirror region and triggers a focus ring.
- [ ] **VoiceOver (macOS)** — `Cmd+F5` → `Ctrl+Option+Cmd+→` to step through text. All text is announced with speaker/semantic labels.
- [ ] **NVDA (Windows)** — insert+space, then arrow keys to read. Streaming content announced after debounce.
- [ ] **Browser zoom 200%** — text selection and find-in-page still work.

---

## Known limitations

- **Callers must keep `block.text` in sync with canvas** character-for-character. If you render `"Hi!"` on canvas but pass `"Hi"` as text, Ctrl+F won't match.
- **Mixed-script lines have sub-px residual drift.** The `scaleX` ratio corrects the *total* line width, but if you mix Latin + Arabic + CJK + emoji on one line, per-character widths don't scale uniformly, leaving ~1–3 px offset on non-Latin glyphs. Workaround: split mixed scripts into separate blocks, or accept the residual offset (screen readers and find-in-page still work correctly — only visible highlight position drifts).
- **RTL selection not mirrored.** Selecting text in Arabic/Hebrew works, but the selection direction in the DOM mirror may not match visual canvas direction. Open an issue if this bites you.
- **No per-run inline styling.** Each block has one `fontSize`/`fontFamily`. For a paragraph with bold/italic runs, split into multiple adjacent blocks.

These are all tracked for upcoming releases — see [Roadmap](#roadmap).

---

## Prior art & comparison

| | canvas-text-layer | PDF.js TextLayer | Google Docs | Raw `<canvas>` |
|---|---|---|---|---|
| Framework-agnostic | ✅ | ❌ (PDF-only) | ❌ (private) | — |
| Bundle size | 13 KB | ~500 KB (whole PDF.js) | — | 0 |
| Selection + Ctrl+F | ✅ | ✅ | ✅ | ❌ |
| Screen readers | ✅ | ✅ | ✅ | ❌ |
| `aria-live` streaming | ✅ | ❌ | ✅ | ❌ |
| Pixel-perfect alignment | ✅ (PDF.js trick) | ✅ (original) | ✅ | — |
| MIT licensed | ✅ | ✅ (Apache 2.0) | ❌ | — |

The DOM-mirror pattern has existed for a decade inside Mozilla PDF.js. `canvas-text-layer` extracts it as a reusable primitive so you don't have to ship a PDF renderer to get accessible canvas text.

---

## FAQ

<details>
<summary><b>Why <code>color: transparent</code> and not <code>display: none</code> / <code>visibility: hidden</code> / <code>opacity: 0</code>?</b></summary>

All of those also hide content from assistive tech. `color: transparent` + `-webkit-text-fill-color: transparent` makes text invisible to eyes but fully queryable by screen readers, Ctrl+F, and the Selection API.
</details>

<details>
<summary><b>Does this work with WebGL canvases?</b></summary>

Yes — but you need a 2D context on *a different* canvas for text measurement (the library creates one internally). The library doesn't care how your main canvas renders pixels; it only needs rects + text from you.
</details>

<details>
<summary><b>Will screen readers announce every streaming token as it arrives?</b></summary>

No. With `live: 'polite'`, tokens are debounced for 500 ms, so VoiceOver/NVDA announce coherent chunks instead of stuttering character-by-character. PDF.js doesn't solve this because PDFs don't stream.
</details>

<details>
<summary><b>How does this compare to ARIA-only labels (e.g. <code>aria-label</code> on a canvas)?</b></summary>

`aria-label="Chart showing Q4 revenue"` gives screen readers a one-line summary but loses: Ctrl+F, selection/copy, per-element semantics (headings vs paragraphs), and the ability to inspect individual pieces. `canvas-text-layer` preserves all of those.
</details>

<details>
<summary><b>Isn't this just a polyfill for a bad canvas choice? Shouldn't I use HTML for text?</b></summary>

Yes, absolutely — if you can. HTML text is always more accessible than canvas text. But canvas is the right choice for: virtualized lists with complex layout (chat, docs), precise typographic control, high-density data visualization, drawing/whiteboarding apps, and games. For those, this library restores the accessibility you sacrificed.
</details>

<details>
<summary><b>Does <code>pixelAlignWidths: true</code> cost performance?</b></summary>

One extra layout read + one write per line per `update()`. For typical chat/doc sizes (<500 blocks) it's imperceptible. For 10k-block documents, benchmark and consider `pixelAlignWidths: false` if your fonts align natively.
</details>

---

## Roadmap

The public API is stable as of **v1.0**. Future work follows semver — breaking changes only in a v2.

- **v1.1** — React / Vue / Svelte thin wrappers. Manual VoiceOver + NVDA testing report.
- **v1.2** — RTL selection mirroring. Per-run inline styling (bold/italic within a single block). Devtools overlay for visualizing mirror rects.
- **v1.3** — Per-glyph width alignment (not just per-line) for pixel-perfect mixed-script text. 10k-block benchmark suite. React Native Web compat.

Open an [issue](https://github.com/Wizard-Guido/canvas-text-layer/issues) to request, prioritize, or sponsor.

---

## Contributing

PRs welcome. Dev setup:

```bash
git clone https://github.com/Wizard-Guido/canvas-text-layer
cd canvas-text-layer
bun install
bun run test        # 32 tests, jsdom + axe-core
bun run build       # ESM + CJS + .d.ts
bunx --bun vite demos/markdown-chat   # interactive demo
```

Bug reports with a reproducible case get triaged first. See [`HANDOFF.md`](./HANDOFF.md) (if present) for architecture history.

---

## License

[MIT](./LICENSE) © 2026 Wen ([@Wizard-Guido](https://github.com/Wizard-Guido))

Inspired by [Mozilla PDF.js](https://github.com/mozilla/pdf.js)'s `TextLayer` module, which has been doing this trick inside PDF readers for a decade. Also inspired by [Cheng Lou's Pretext](https://github.com/chenglou/pretext), which demonstrated a similar pattern for minimal canvas UIs.
