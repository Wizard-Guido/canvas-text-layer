export interface TextLayerOptions {
  /** The canvas element text is being drawn on. The mirror will be positioned over it. */
  canvas: HTMLCanvasElement;
  /** Container to mount the hidden DOM mirror into. Defaults to canvas.parentElement. */
  container?: HTMLElement;
  /** ARIA role for the mirror root. Default: 'document'. */
  role?: 'document' | 'log' | 'article' | 'textbox';
  /** Accessible label announced by screen readers. */
  label?: string;
  /** For streaming content (e.g. AI chat), use 'polite' live region. Default: 'off'. */
  live?: 'off' | 'polite' | 'assertive';
  /** Whether users can select text via the mirror. Default: true. */
  selectable?: boolean;
  /**
   * If true (default), the mirror measures each line's rendered DOM width and
   * applies `transform: scaleX(...)` to force it to exactly match what
   * `ctx.measureText()` reports for the same text + font on canvas. This is
   * the PDF.js TextLayer technique — it makes browser Ctrl+F highlights land
   * pixel-perfectly on the canvas text, even when DOM and canvas layout
   * engines disagree by a few sub-pixels per character.
   *
   * Set to false if you've verified your fonts align natively and want to
   * skip the extra measurement work.
   */
  pixelAlignWidths?: boolean;
}

export interface TextLayerController {
  /** Update the mirror to match new prepared+layout state. Call after re-layout. */
  update(blocks: TextBlock[]): void;
  /** Append a new block (optimized for streaming append-only use cases). */
  append(block: TextBlock): void;
  /** Get current DOM Selection mapped back to block + character offset. */
  getSelection(): TextSelection | null;
  /** Programmatically set selection. */
  setSelection(sel: TextSelection | null): void;
  /** Tear down: remove DOM, detach listeners. */
  destroy(): void;
}

export interface TextBlock {
  /** Stable id — required for efficient diffing on update(). */
  id: string;
  /** The text content. Must match what's drawn on canvas character-for-character. */
  text: string;
  /** Pixel rect of this block in canvas coordinates. */
  rect: { x: number; y: number; width: number; height: number };
  /** Per-line breakpoints from the caller's layout, used for correct vertical positioning. */
  lines?: Array<{ text: string; y: number; height: number }>;
  /**
   * Font size in pixels. MUST match the canvas font size for Ctrl+F highlights
   * to align with the rendered text. If omitted, derived from lines[0].height
   * (a poor heuristic — explicit value is strongly recommended).
   */
  fontSize?: number;
  /**
   * CSS font-family string. MUST match the canvas font-family for character
   * widths (and thus search highlights) to align. If omitted, defaults to
   * the browser's root font.
   */
  fontFamily?: string;
  /**
   * CSS font-weight (e.g. 'bold', 400, 700). Used for both DOM styling
   * and canvas-width measurement. Match your canvas font weight to keep
   * Ctrl+F highlights aligned on bold text like headings.
   */
  fontWeight?: string | number;
  /**
   * CSS font-style ('normal' | 'italic' | 'oblique'). Defaults to 'normal'.
   */
  fontStyle?: 'normal' | 'italic' | 'oblique';
  /** Semantic hint: heading level, list item, code block, etc. */
  semantics?:
    | 'paragraph'
    | 'heading-1'
    | 'heading-2'
    | 'heading-3'
    | 'code'
    | 'list-item'
    | 'quote';
  /** For chat-like uses: who said this. Becomes aria-label prefix. */
  speaker?: string;
}

export interface TextSelection {
  anchorBlockId: string;
  anchorOffset: number;
  focusBlockId: string;
  focusOffset: number;
}
