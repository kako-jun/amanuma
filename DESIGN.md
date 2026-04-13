# DESIGN.md — amanuma (Puyo-Style Puzzle Game)

## 1. Visual Theme

A Phaser-based web puzzle game in the Puyo Puyo tradition with a modern dark aesthetic. Deep navy backgrounds, violet and cyan neon accents, glass-effect UI buttons, and colorful game blocks with high contrast. The interface balances a polished, glowing game feel with functional touch controls for mobile play. Built with Tailwind CSS 4 for the HTML UI layer.

## 2. Color Palette

### UI Colors

| Token | Value | Usage |
|---|---|---|
| `bg` | `#0f0f1a` | Dark navy — page and game background |
| `primary` | `#7c3aed` | Violet — primary accent, borders, glow |
| `secondary` | `#06b6d4` | Cyan — secondary accent, highlights |
| `text-primary` | `#ffffff` | Headings, scores |
| `text-secondary` | `rgba(255,255,255,0.7)` | Labels, descriptions |
| `p1-color` | `#10b981` | Player 1 indicator (green) |
| `p2-color` | `#f59e0b` | Player 2 indicator (amber) |

### Block Colors

| Name | Value |
|---|---|
| Rose | `#ff6b9d` |
| Coral | `#ffa06b` |
| Gold | `#ffd93d` |
| Mint | `#6bffb8` |
| Sky | `#6bb3ff` |
| Purple | `#a06bff` |
| Magenta | `#ff6bff` |

Block colors are chosen for maximum mutual distinguishability on the dark background. Each must remain identifiable at small sizes and under the violet glow border.

## 3. Typography

| Role | Font | Size | Weight |
|---|---|---|---|
| Headings | `Inter` (Google Fonts) | 20–28px | 700 |
| Body / labels | `Inter` | 14–16px | 400 |
| Scores | `Inter` | 24px | 700 |
| Button labels | `Inter` | 14–16px | 600 |

Inter is used throughout for its clean legibility at both large and small sizes, critical for score displays and mobile touch labels.

## 4. Component Stylings

### Glass Buttons
- Background: linear gradient with semi-transparent violet
- `backdrop-filter: blur(8px)`
- Border: 1px solid `rgba(124,58,237,0.3)`
- Border-radius: 8px
- Transition: `0.15s ease`
- Hover: brighter gradient, stronger border

### Touch Control Buttons
- Desktop: `64px` square
- Mobile: `52px` square
- Background: glass gradient (same as above)
- Touch-action: manipulation (prevent double-tap zoom)
- Minimum tap target maintained at 48px

### Game Canvas
- Size: `800px` wide x `650px` tall
- Border: 2px solid `#7c3aed`
- Glow: `box-shadow: 0 0 20px rgba(124,58,237,0.4)`
- Centered on page

### Player Indicators
- P1: `#10b981` (green) border accent
- P2: `#f59e0b` (amber) border accent
- Applied to score panels and side indicators

### Score Panels
- Glass morphism background
- Player color accent border on top or left edge
- Large numeric score in Inter 700

## 5. Layout Principles

- Game canvas is the centerpiece, all UI radiates outward
- Score panels flank the canvas on desktop (left P1, right P2)
- Touch controls positioned below the canvas on mobile
- Tailwind CSS 4 utility classes for the HTML shell
- Phaser handles all in-canvas rendering
- Gap: 16px between UI sections

## 6. Depth & Elevation

| Level | Treatment | Usage |
|---|---|---|
| Background | Flat `#0f0f1a` | Page body |
| Canvas | Violet glow border | Game area — the visual focus |
| UI panels | Glass blur + subtle shadow | Scores, controls |
| Buttons | Glass gradient + border | Interactive elements |
| Overlays | Dark semi-transparent bg | Pause screen, game over |

Glow effects (box-shadow with color) are the primary depth cue. Shadows use violet or cyan tints, never pure black.

## 7. Do's and Don'ts

**Do:**
- Use `#0f0f1a` as the only background color
- Apply violet glow (`#7c3aed`) to the game canvas border
- Keep all transitions at `0.15s`
- Use glass morphism for buttons and panels
- Ensure touch buttons meet minimum 48px tap targets
- Distinguish P1 (green) and P2 (amber) consistently

**Don't:**
- Use white or light backgrounds anywhere
- Apply block game colors to UI elements (they are for gameplay only)
- Make touch buttons smaller than 52px on mobile
- Use drop shadows with pure black — always tinted
- Add competing glow colors to non-canvas elements
- Use fonts other than Inter

## 8. Responsive Behavior

| Orientation / Size | Behavior |
|---|---|
| Desktop landscape | Canvas centered, P1/P2 panels on sides, controls below or keyboard |
| Portrait mobile | Canvas scaled to fit width, controls stacked below |
| Landscape mobile | Canvas on one side, controls on the other side |

- Canvas maintains aspect ratio (800:650) and scales down via CSS `max-width: 100%`
- Touch buttons shrink from 64px to 52px on mobile
- Score panels move from beside the canvas to above it on portrait mobile
- Tailwind CSS 4 responsive utilities handle breakpoints

## 9. Agent Prompt Guide

When building new UI elements for amanuma:

- **Background**: Always `#0f0f1a`
- **Primary accent**: `#7c3aed` (violet) for borders, glows, active states
- **Secondary accent**: `#06b6d4` (cyan) for highlights, secondary indicators
- **Glass buttons**: Semi-transparent gradient bg, blur(8px), violet border, 8px radius
- **Canvas border**: 2px solid `#7c3aed` with `0 0 20px rgba(124,58,237,0.4)` glow
- **Touch targets**: 64px desktop / 52px mobile, never below 48px
- **Player colors**: P1 = `#10b981`, P2 = `#f59e0b` — use consistently
- **Block colors**: Rose, coral, gold, mint, sky, purple, magenta — gameplay only
- **Transitions**: `0.15s ease` on all interactive elements
- **Font**: Inter everywhere, loaded from Google Fonts
- **Framework**: Tailwind CSS 4 for HTML UI; Phaser for canvas rendering
