# Brand Design System: The Second Summer of Love

Wedding invite design system for Sophie & Cobie Cope.

## Color Palette

### Primary Colors
| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Sunset Orange | `#E58632` | rgb(229, 134, 50) | Main headline text, gradient bottom |
| Deep Magenta | `#9B2B5A` | rgb(155, 43, 90) | Names text, disco ball accent |
| Vaporwave Blue | `#3A5B8C` | rgb(58, 91, 140) | Grid lines, gradient top |
| Hot Pink | `#C94B7C` | rgb(201, 75, 124) | Gradient middle |

### Secondary Colors
| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Pure White | `#FFFFFF` | rgb(255, 255, 255) | Body text, details |
| Deep Black | `#1A1A1A` | rgb(26, 26, 26) | Frame/border |

### Gradient Stops
```css
background: linear-gradient(
  180deg,
  #3A5B8C 0%,      /* Vaporwave Blue */
  #6B4B7C 25%,     /* Purple transition */
  #C94B7C 45%,     /* Hot Pink */
  #D67050 65%,     /* Coral */
  #E58632 85%,     /* Sunset Orange */
  #F5A030 100%    /* Golden Orange */
);
```

## Typography

### Font Stack

1. **Names (COBIE COPE & SOPHIE COPE)**
   - Font: Anton (Google Fonts) or Bebas Neue
   - Weight: 400 (Bold by design)
   - Style: Normal
   - Letter-spacing: 2px
   - Color: Deep Magenta (#9B2B5A)

2. **Subtitle (INVITE YOU TO)**
   - Font: Playfair Display
   - Weight: 400
   - Style: Italic
   - Letter-spacing: 4px
   - Color: White (#FFFFFF)

3. **Main Headline (THE SECOND SUMMER OF LOVE)**
   - Font: Rye (Google Fonts) or custom display font
   - Weight: 400
   - Style: Normal
   - Letter-spacing: 0
   - Color: Sunset Orange (#E58632)

4. **Event Details (SATURDAY 13 SEPTEMBER...)**
   - Font: Anton or Bebas Neue
   - Weight: 400
   - Style: Normal
   - Letter-spacing: 1px
   - Color: White (#FFFFFF)

5. **CTA (SPIN THE GLOBE TO RSVP)**
   - Font: Anton
   - Weight: 700
   - Style: Normal
   - Letter-spacing: 1px
   - Color: Deep Black (#1A1A1A)

## Visual Elements

### 1. Disco Ball
- Style: Wireframe/outline with mirror facets
- Color: Deep Magenta with pink highlights
- Effect: Saturn-like ring around equator
- Animation: Optional slow rotation

### 2. Perspective Grid
- Style: Curved/warped grid creating 3D depth
- Color: Vaporwave Blue (#3A5B8C) with low opacity
- Position: Upper corners, creating vaporwave aesthetic
- Line weight: 1px

### 3. Noise/Grain Texture
- Opacity: 15-25%
- Blend mode: Overlay
- Coverage: Full poster
- Purpose: Retro/analog feel

### 4. Small Decorative Elements
- Stars/sparkles near disco ball
- Squiggly lines for playfulness
- Color: White or matching gradient colors

## Layout Structure

```
┌─────────────────────────────────┐
│         COBIE COPE              │
│              &                  │
│         SOPHIE COPE             │
│                                 │
│         INVITE YOU TO           │
│                                 │
│       THE SECOND                │
│       SUMMER OF                 │
│          LOVE                   │
│                                 │
│       [DISCO BALL]              │
│                                 │
│    SATURDAY 13 SEPTEMBER        │
│     FAITH IN STRANGERS          │
│          MARGATE                │
│          17:30PM                │
│                                 │
│   SPIN THE GLOBE TO RSVP        │
└─────────────────────────────────┘
```

### Spacing Guidelines
- Poster aspect ratio: Portrait (similar to A3/poster format)
- Names: Top 10% of poster
- Main headline: Upper-middle 30%
- Disco ball: Center 25%
- Event details: Lower 20%
- CTA: Bottom 10%

## CSS Variables

```css
:root {
  /* Primary Colors */
  --color-sunset-orange: #E58632;
  --color-deep-magenta: #9B2B5A;
  --color-vaporwave-blue: #3A5B8C;
  --color-hot-pink: #C94B7C;

  /* Secondary Colors */
  --color-white: #FFFFFF;
  --color-black: #1A1A1A;

  /* Gradient */
  --gradient-poster: linear-gradient(
    180deg,
    #3A5B8C 0%,
    #6B4B7C 25%,
    #C94B7C 45%,
    #D67050 65%,
    #E58632 85%,
    #F5A030 100%
  );

  /* Typography */
  --font-names: 'Anton', sans-serif;
  --font-subtitle: 'Playfair Display', serif;
  --font-headline: 'Rye', cursive;
  --font-details: 'Anton', sans-serif;

  /* Effects */
  --noise-opacity: 0.2;
  --grid-opacity: 0.4;
}
```

## Animation Guidelines

### Disco Ball Spin
```css
@keyframes disco-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

### Text Glow (optional)
```css
text-shadow: 0 0 20px rgba(229, 134, 50, 0.5);
```

## Responsive Breakpoints

- Mobile: 320px - 480px (single column, reduced spacing)
- Tablet: 481px - 768px (standard layout)
- Desktop: 769px+ (full effect with animations)

## Implementation Notes

1. Use Google Fonts for Anton, Playfair Display, and Rye
2. Create SVG for disco ball with rings
3. Generate noise texture using CSS or SVG filter
4. Grid can be created with SVG path or CSS gradients
5. Consider reduced motion preferences for accessibility
