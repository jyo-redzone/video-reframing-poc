---
name: design-system-extractor
description: >
  Extract a framework-agnostic UI design system from any codebase and convert it into structured,
  machine-transformable JSON containing design tokens, component styles, and design rules.
  Use this skill whenever the user asks to extract styling, theming, design tokens, or a design system
  from a repository or codebase. Also trigger when the user wants to convert UI styles into a
  cross-framework format, reuse styling from one stack in another (e.g., moving from MudBlazor to
  Tailwind, or React to Vue), generate a universal design token file, or audit/document the visual
  language of an existing project. Even if the user doesn't say "design system" explicitly — if they're
  asking about pulling colors, typography, spacing, or component styles out of code — this skill applies.
---

# Design System Extractor

Extract a platform-agnostic design system JSON from any web codebase. The output is a single structured
JSON file that captures design tokens, component styles, and design rules — with no framework-specific
values, ready to be consumed by any target stack.

## Supported Frameworks

This skill handles any web UI codebase, including but not limited to:

- **CSS / SCSS / SASS / Less** — raw stylesheets, custom properties, variables
- **Tailwind CSS** — `tailwind.config.js`, theme extensions, utility classes
- **React** — styled-components, CSS modules, theme providers, inline styles
- **Vue** — scoped styles, Vuetify themes, Quasar variables
- **Angular** — Angular Material theming, component styles
- **.NET / Blazor** — MudBlazor `MudTheme`, Radzen themes, CSS isolation files
- **Design token files** — existing `tokens.json`, Style Dictionary configs

The extraction logic adapts based on what's found in the codebase. You don't need to know the
framework in advance — discover it from the file structure.

---

## Workflow

### Step 1: Scan the codebase

The user provides a directory path. Start by understanding the project structure:

1. List the top-level directory to identify the framework and tech stack
2. Look for theme/styling entry points — these vary by framework:
   - `tailwind.config.js` / `tailwind.config.ts`
   - `theme.ts` / `theme.js` / `ThemeProvider` files
   - `_variables.scss` / `_tokens.scss` / `variables.less`
   - `MudTheme` definitions in `.razor` or `.cs` files
   - `styles/` or `assets/css/` directories
   - `tokens.json` or Style Dictionary config files
   - Global CSS files with `:root` custom properties
3. Scan component directories for component-level styling

Prioritize centralized theme definitions over scattered component styles. The goal is to find
the **source of truth** for each design decision.

### Step 2: Extract tokens

Read the identified theme/style files and extract design tokens into these categories:

#### Token Categories

- **color** — brand, neutral, semantic (success, warning, error, info), surface, text, border
- **typography** — font families, sizes, weights, line heights, letter spacing
- **spacing** — consistent spacing scale values
- **radius** — border radius values
- **elevation** — box shadows / elevation levels

For each token, record the **raw resolved value** (e.g., `"#1976D2"`, `"16px"`, `"1.5"`).
Do not include framework variables like `var(--mud-palette-primary)` or `theme('colors.blue.500')`.
Resolve them to their actual values.

If a value genuinely cannot be determined from the code, use `null`. Never invent values.

### Step 3: Extract component styles

For each UI component found in the codebase, extract its styling properties as a structured object.
Components should **reference tokens** wherever possible rather than containing raw values.

Token references use dot-notation paths into the tokens object, e.g., `"color.brand.primary"`.
Only fall back to a raw value if no matching token exists.

Common components to look for (extract whatever is present — don't force components that aren't there):

- Button, Input, Select, Checkbox, Radio
- Card, Dialog/Modal, Drawer, AppBar/Navbar
- Table, List, Tabs, Chip/Badge
- Alert, Tooltip, Snackbar/Toast
- Typography variants (h1–h6, body, caption)

For each component, capture relevant properties such as: background, color, border, padding, margin,
font, border-radius, shadow, hover/focus/disabled states.

### Step 4: Extract design rules

Design rules are conventions or constraints observed in the codebase that aren't captured by tokens
or component styles alone. Examples:

- "All interactive elements use a 2px focus ring with color.brand.primary"
- "Spacing follows a 4px base grid"
- "Typography scale uses a 1.25 ratio"
- "Border radius is consistent at radius.md for all containers"

Express these as an array of short, descriptive strings. Only include rules you can actually
observe in the code — don't invent conventions.

### Step 5: Assemble and validate

Combine everything into the output schema (below), then validate:

1. No `"undefined"` string values anywhere — use `null` for missing data
2. No framework-specific variable references (e.g., `var(--*)`, `theme()`, `@apply`)
3. No CSS shorthand — expand all shorthand properties:
   - `"1px solid red"` → `{ "width": "1px", "style": "solid", "color": "#FF0000" }`
   - `"8px 16px"` (padding) → `{ "top": "8px", "right": "16px", "bottom": "8px", "left": "16px" }`
   - `"0 2px 4px rgba(0,0,0,0.1)"` (shadow) → `{ "offsetX": "0", "offsetY": "2px", "blur": "4px", "spread": "0", "color": "rgba(0,0,0,0.1)" }`
4. Components reference tokens by path (e.g., `"color.brand.primary"`) — not raw values — wherever a matching token exists
5. Consistent types: all values are strings, objects, or `null` — no bare numbers

### Step 6: Save the output

Save the final JSON to the output directory as `design-system.json`.
Give the user a brief summary of what was extracted: how many tokens per category,
how many components, and how many rules. Keep it concise — the file is the deliverable.

---

## Output Schema

```json
{
  "tokens": {
    "color": {
      "brand": {
        "primary": "#1976D2",
        "secondary": "#424242"
      },
      "neutral": {},
      "semantic": {
        "success": "#2E7D32",
        "warning": "#ED6C02",
        "error": "#D32F2F",
        "info": "#0288D1"
      },
      "surface": {},
      "text": {},
      "border": {}
    },
    "typography": {
      "fontFamily": {
        "base": "\"Roboto\", sans-serif",
        "heading": null,
        "mono": "\"Roboto Mono\", monospace"
      },
      "fontSize": {},
      "fontWeight": {},
      "lineHeight": {},
      "letterSpacing": {}
    },
    "spacing": {},
    "radius": {},
    "elevation": {}
  },
  "components": {
    "button": {
      "base": {
        "padding": { "top": "6px", "right": "16px", "bottom": "6px", "left": "16px" },
        "borderRadius": "radius.md",
        "fontWeight": "typography.fontWeight.medium",
        "fontSize": "typography.fontSize.sm"
      },
      "variants": {
        "primary": {
          "background": "color.brand.primary",
          "color": "#FFFFFF"
        }
      },
      "states": {
        "hover": {},
        "disabled": {}
      }
    }
  },
  "rules": [
    "Spacing follows a 4px base grid",
    "All interactive elements use focus ring with color.brand.primary"
  ]
}
```

This schema is illustrative — the actual keys and nesting depend on what exists in the codebase.
The top-level structure (`tokens`, `components`, `rules`) is fixed. Everything inside adapts to
what's actually found.

---

## Important Principles

- **Extract, don't invent.** Every value in the output must trace back to something in the source code. If you can't find a value, use `null`.
- **Resolve all variables.** Follow the chain from variable reference to final value. The output should contain no framework-specific syntax.
- **Prefer tokens over raw values.** When a component uses a value that matches a token, reference the token path instead of duplicating the raw value.
- **Expand shorthand.** CSS shorthand properties are ambiguous for machines. Always decompose them into explicit sub-properties.
- **Be honest about gaps.** It's better to have `null` values and a clear picture of what's missing than to guess and produce incorrect tokens.
