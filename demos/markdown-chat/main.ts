/**
 * Markdown Chat Demo for canvas-text-layer
 *
 * This demo renders chat messages on a <canvas> and uses canvas-text-layer
 * to overlay an invisible but accessible DOM mirror. This enables:
 * - Screen reader access to all chat content
 * - Ctrl+F / Cmd+F browser find-in-page
 * - Native text selection and copy
 */
import { mountTextLayer, type TextBlock } from '../../src/index.js';

// --- Chat data ---
interface ChatMessage {
  role: 'user' | 'assistant';
  blocks: Array<{
    text: string;
    semantics?: TextBlock['semantics'];
  }>;
}

const MESSAGES: ChatMessage[] = [
  {
    role: 'user',
    blocks: [
      {
        text: 'Can we treat the rich-text inline flow helper as a real primitive, or is it only good for one tiny demo?',
        semantics: 'paragraph',
      },
    ],
  },
  {
    role: 'assistant',
    blocks: [
      {
        text: 'Short answer: yes, inside a bounded corridor.',
        semantics: 'paragraph',
      },
      {
        text: 'It already handles rich-text inline flow, code, and links while keeping pills and badges atomic. The real pressure starts once a chat bubble stops being one paragraph.',
        semantics: 'paragraph',
      },
    ],
  },
  {
    role: 'user',
    blocks: [
      {
        text: 'My side is usually short, but your side has the weird stuff: Beijing 北京, Arabic مرحبا, emoji 👩‍🚀, and long URLs.',
        semantics: 'paragraph',
      },
    ],
  },
  {
    role: 'assistant',
    blocks: [
      {
        text: 'What a chat renderer actually needs',
        semantics: 'heading-2',
      },
      {
        text: '1. Parse markdown somewhere else.\n2. Normalize it into blocks and inline runs.\n3. Use the rich-text inline flow helper for paragraph content.\n4. Use the pre-wrap path for fenced code.',
        semantics: 'list-item',
      },
    ],
  },
  {
    role: 'user',
    blocks: [
      {
        text: "Let's stress it with real markdown: nested emphasis, deletions, inline code, links, and richer AI-side messages.",
        semantics: 'paragraph',
      },
    ],
  },
  {
    role: 'assistant',
    blocks: [
      {
        text: 'If we know the exact height in advance, then virtualization is no longer guesswork. It becomes geometry.',
        semantics: 'quote',
      },
      {
        text: 'That is the whole reason to keep the primitive low-level and composable.',
        semantics: 'paragraph',
      },
    ],
  },
  {
    role: 'assistant',
    blocks: [
      {
        text: 'const frame = buildConversationFrame(templates, width)\nconst visible = findVisibleRange(frame, scrollTop, viewportHeight)\nrenderMessages(frame, visible.start, visible.end)',
        semantics: 'code',
      },
    ],
  },
  {
    role: 'user',
    blocks: [
      {
        text: 'I also want code fences, quotes, and lists to show up often enough that the 10k-thread run actually teaches us something.',
        semantics: 'paragraph',
      },
    ],
  },
  {
    role: 'assistant',
    blocks: [
      {
        text: 'Mixed-script sample: English for the framing, 日本語 for compact line breaks, العربية for punctuation clusters, and emoji like 🧪📐 to keep the grapheme path honest.',
        semantics: 'paragraph',
      },
    ],
  },
];

// --- Canvas rendering ---
// Split font declarations so we can pass fontSize/fontFamily separately to the a11y mirror
const FONT_FAMILY_BODY = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const FONT_FAMILY_CODE = '"SF Mono", ui-monospace, Menlo, monospace';
const FONT_SIZE_BODY = 14;
const FONT_SIZE_HEADING = 18;
const FONT_SIZE_CODE = 12;
const FONT_BODY = `${FONT_SIZE_BODY}px ${FONT_FAMILY_BODY}`;
const FONT_HEADING = `bold ${FONT_SIZE_HEADING}px ${FONT_FAMILY_BODY}`;
const FONT_CODE = `${FONT_SIZE_CODE}px ${FONT_FAMILY_CODE}`;
const LINE_HEIGHT = 20;
const HEADING_LINE_HEIGHT = 26;
const CODE_LINE_HEIGHT = 18;
const PADDING_X = 20;
const MESSAGE_GAP = 16;
const BLOCK_GAP = 6;
const CONTENT_WIDTH = 660;

const INK = '#d5d9e1';
const MUTED = '#9ea6b2';
const USER_BG = '#394048';
const CODE_BG = '#313840';
const ACCENT = '#b7c0cf';

function getFontForSemantics(semantics?: string): string {
  if (semantics === 'heading-2' || semantics === 'heading-1' || semantics === 'heading-3') return FONT_HEADING;
  if (semantics === 'code') return FONT_CODE;
  return FONT_BODY;
}

function getFontSizeForSemantics(semantics?: string): number {
  if (semantics === 'heading-2' || semantics === 'heading-1' || semantics === 'heading-3') return FONT_SIZE_HEADING;
  if (semantics === 'code') return FONT_SIZE_CODE;
  return FONT_SIZE_BODY;
}

function getFontFamilyForSemantics(semantics?: string): string {
  if (semantics === 'code') return FONT_FAMILY_CODE;
  return FONT_FAMILY_BODY;
}

function getFontWeightForSemantics(semantics?: string): string | undefined {
  if (semantics === 'heading-1' || semantics === 'heading-2' || semantics === 'heading-3') return 'bold';
  return undefined;
}

function getLineHeightForSemantics(semantics?: string): number {
  if (semantics === 'heading-2' || semantics === 'heading-1' || semantics === 'heading-3') return HEADING_LINE_HEIGHT;
  if (semantics === 'code') return CODE_LINE_HEIGHT;
  return LINE_HEIGHT;
}

function getColorForSemantics(semantics?: string): string {
  if (semantics === 'quote') return MUTED;
  if (semantics === 'heading-2' || semantics === 'heading-1') return ACCENT;
  return INK;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  // Split on explicit newlines first
  const paragraphs = text.split('\n');
  for (const para of paragraphs) {
    const words = para.split(' ');
    let current = '';
    for (const word of words) {
      const test = current ? current + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    lines.push(current);
  }
  return lines;
}

interface LayoutBlock {
  a11yBlock: TextBlock;
  lines: string[];
  font: string;
  color: string;
  lineHeight: number;
  role: 'user' | 'assistant';
  isCode: boolean;
  isQuote: boolean;
}

function layoutMessages(ctx: CanvasRenderingContext2D): LayoutBlock[] {
  const result: LayoutBlock[] = [];
  let y = PADDING_X;
  let blockIndex = 0;

  for (const msg of MESSAGES) {
    const speaker = msg.role === 'user' ? 'You' : 'Assistant';

    for (const block of msg.blocks) {
      const font = getFontForSemantics(block.semantics);
      const lineHeight = getLineHeightForSemantics(block.semantics);
      const color = getColorForSemantics(block.semantics);
      const isCode = block.semantics === 'code';
      const isQuote = block.semantics === 'quote';

      ctx.font = font;
      const maxW = CONTENT_WIDTH - PADDING_X * 2 - (isQuote ? 16 : 0) - (isCode ? 20 : 0);
      const wrappedLines = wrapText(ctx, block.text, maxW);
      const blockHeight = wrappedLines.length * lineHeight;

      const x = PADDING_X + (isQuote ? 16 : 0) + (isCode ? 10 : 0);

      const a11yLines = wrappedLines.map((text, i) => ({
        text: i < wrappedLines.length - 1 ? text + '\n' : text,
        y: y + i * lineHeight,
        height: lineHeight,
      }));

      const a11yBlock: TextBlock = {
        id: `block-${blockIndex}`,
        text: block.text,
        // rect.x matches where text is actually drawn on canvas (indented for quote/code)
        rect: { x, y, width: maxW, height: blockHeight },
        lines: a11yLines,
        fontSize: getFontSizeForSemantics(block.semantics),
        fontFamily: getFontFamilyForSemantics(block.semantics),
        fontWeight: getFontWeightForSemantics(block.semantics),
        semantics: block.semantics,
        speaker,
      };

      result.push({
        a11yBlock,
        lines: wrappedLines,
        font,
        color,
        lineHeight,
        role: msg.role,
        isCode,
        isQuote,
      });

      y += blockHeight + BLOCK_GAP;
      blockIndex++;
    }

    y += MESSAGE_GAP;
  }

  return result;
}

function render(ctx: CanvasRenderingContext2D, layouts: LayoutBlock[]) {
  const canvas = ctx.canvas;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const layout of layouts) {
    const { a11yBlock, lines, font, color, lineHeight, role, isCode, isQuote } = layout;
    const { rect } = a11yBlock;

    // Draw user bubble background
    if (role === 'user') {
      ctx.fillStyle = USER_BG;
      roundRect(ctx, rect.x - 8, rect.y - 6, rect.width + 16, rect.height + 12, 12);
      ctx.fill();
    }

    // Draw code block background
    if (isCode) {
      ctx.fillStyle = CODE_BG;
      roundRect(ctx, rect.x - 4, rect.y - 6, rect.width + 8, rect.height + 12, 8);
      ctx.fill();
    }

    // Draw quote rail
    if (isQuote) {
      ctx.fillStyle = 'rgba(158, 166, 178, 0.18)';
      roundRect(ctx, PADDING_X, rect.y, 3, rect.height, 2);
      ctx.fill();
    }

    // Draw text lines
    ctx.font = font;
    ctx.fillStyle = color;
    const textX = rect.x + (isQuote ? 16 : 0) + (isCode ? 10 : 0);
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], textX, rect.y + i * lineHeight + lineHeight * 0.75);
    }
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// --- Init ---
function init() {
  const container = document.getElementById('chat-container')!;
  const canvas = document.getElementById('chat-canvas') as HTMLCanvasElement;
  const status = document.getElementById('status')!;

  // Set canvas size to match container
  const dpr = window.devicePixelRatio || 1;
  const rect = container.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;

  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  // Layout and render on canvas
  const layouts = layoutMessages(ctx);
  render(ctx, layouts);

  // Mount a11y mirror
  const mirror = mountTextLayer({
    canvas,
    container,
    role: 'log',
    label: 'Chat conversation',
    live: 'polite',
    selectable: true,
  });

  // Feed blocks to mirror
  const a11yBlocks = layouts.map((l) => l.a11yBlock);
  mirror.update(a11yBlocks);

  // Status
  status.innerHTML = `
    <span>${a11yBlocks.length}</span> blocks mirrored &middot;
    <span>${MESSAGES.length}</span> messages &middot;
    DOM mirror active
  `;

  // Handle resize
  window.addEventListener('resize', () => {
    const newRect = container.getBoundingClientRect();
    canvas.width = newRect.width * dpr;
    canvas.height = newRect.height * dpr;
    canvas.style.width = `${newRect.width}px`;
    canvas.style.height = `${newRect.height}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    const newLayouts = layoutMessages(ctx);
    render(ctx, newLayouts);
    mirror.update(newLayouts.map((l) => l.a11yBlock));
  });
}

init();
