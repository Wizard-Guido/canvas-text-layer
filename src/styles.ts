/**
 * Styles that make DOM elements invisible to sighted users
 * but fully visible to assistive technology and browser find-in-page.
 *
 * Key constraints:
 * - `display: none` / `visibility: hidden` hide from AT too — never use them.
 * - `color: transparent` + `-webkit-text-fill-color: transparent` hides text visually.
 * - `user-select: text` + `pointer-events: auto` allow native selection & copy.
 * - Font size and line height must match canvas rendering for correct Ctrl+F highlight positioning.
 */
export const INVISIBLE_BUT_READABLE_STYLE = {
  color: 'transparent',
  caretColor: 'transparent',
  background: 'transparent',
  webkitTextFillColor: 'transparent',
  userSelect: 'text',
  pointerEvents: 'auto',
  border: 'none',
  outline: 'none',
  padding: '0',
  margin: '0',
  overflow: 'hidden',
  whiteSpace: 'pre-wrap' as const,
  wordBreak: 'break-word' as const,
  lineHeight: 'normal',
} as const;

export const MIRROR_ROOT_STYLE = {
  position: 'absolute' as const,
  inset: '0',
  overflow: 'hidden',
  pointerEvents: 'none',
  zIndex: '1',
} as const;

export const BLOCK_STYLE = {
  position: 'absolute' as const,
  ...INVISIBLE_BUT_READABLE_STYLE,
} as const;
