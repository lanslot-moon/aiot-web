---
version: alpha
name: "AIoT Open Platform Console"
description: "A restrained shadcn dashboard for managing Project-scoped products, members, and API authorization."
colors:
  primary: "oklch(0.205 0 0)"
  primary-foreground: "oklch(0.985 0 0)"
  background: "oklch(1 0 0)"
  foreground: "oklch(0.145 0 0)"
  card: "oklch(1 0 0)"
  card-foreground: "oklch(0.145 0 0)"
  muted: "oklch(0.97 0 0)"
  muted-foreground: "oklch(0.556 0 0)"
  border: "oklch(0.922 0 0)"
  destructive: "oklch(0.577 0.245 27.325)"
typography:
  sans:
    fontFamily: "Geist, system-ui, sans-serif"
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
rounded:
  DEFAULT: "8px"
  sm: "6px"
  md: "8px"
  lg: "12px"
spacing:
  card-padding: "1rem"
  surface-gap: "1rem"
  page-max: "1410px"
components:
  button:
    backgroundColor: primary
    textColor: primary-foreground
    rounded: DEFAULT
    height: "28px"
  card:
    backgroundColor: card
    textColor: card-foreground
    rounded: lg
    padding: "1rem"
  navigation:
    backgroundColor: muted
    textColor: muted-foreground
    rounded: sm
  status:
    backgroundColor: background
    textColor: foreground
    rounded: sm
  separator:
    backgroundColor: border
---

# AIoT Open Platform Console Design System

## Overview

### Creative North Star

The console should feel like a calm developer workbench: the visual language is the quiet, information-dense surface of a cloud control plane, with hierarchy coming from spacing, tonal layers, and short labels rather than decorative panels.

### Product context and register

- **Audience and primary job:** Developers and project administrators manage products, Project members, and API access with low ambiguity.
- **Target market(s) and evidence:** The current repository documents a Project-scoped AIoT open platform and uses Chinese UI copy for the target workflow.
- **Locale(s) and language policy:** The current open-platform surface is Simplified Chinese; domain labels remain consistent with the IAM interaction document.
- **Usage scene:** Desktop-first administration with responsive reflow for smaller screens; users scan status and move into a focused management route.
- **Register:** Product UI, not marketing. Familiar shadcn dashboard patterns take priority over visual novelty.
- **Memorable signature:** A compact Project workspace shell with a quiet horizontal project navigation bar and stacked summary cards that keep the primary task visible.
- **Restraint:** Keep security and membership actions text-led, use icons as alignment cues, and avoid decorative gradients or extra metrics that compete with the current task.
- **Anti-references:** Do not resemble a marketing landing page, a dashboard full of unrelated KPI tiles, or a settings page that repeats Project identity fields already visible in the workspace header.
- **Token ownership/runtime mapping:** Runtime CSS in `src/css/globals.css` and the shared `src/components/ui/*` primitives remain canonical. This file mirrors their accepted values; feature work should use semantic Tailwind utilities and shared primitives rather than adding screen-local tokens.

## Colors

The light theme uses near-black primary text/actions on a white canvas, with muted gray surfaces for navigation and secondary information. `primary`, `background`, `foreground`, `muted`, `muted-foreground`, and `border` mirror the CSS variables in `src/css/globals.css`. Destructive actions use the existing red semantic token and are reserved for irreversible lifecycle operations. Dark mode remaps the same semantic roles without changing hierarchy.

## Typography

Geist is the body and control face, with Geist Mono for IDs, keys, and technical values. Body copy stays compact and readable; labels are short and sentence-like in Chinese. Numeric counts use tabular figures where comparison matters. The font stack retains system fallbacks so mixed Chinese and Latin labels do not shift layout unexpectedly.

## Layout

The application uses the existing dashboard shell and a 1410px content measure. Project workspace pages use a compact header, a bordered shell, and a horizontal project navigation bar below the header; the platform sidebar remains the global navigation owner. Settings adds a compact secondary horizontal strip. Detail summaries use a 1rem gap; when a secondary column contains vertically stacked cards, it owns its natural height instead of stretching unrelated cards or creating a second scroll surface. At narrow widths, project navigation scrolls horizontally and links retain their labels.

## Elevation & Depth

Cards use the shared low-contrast foreground ring and tonal surfaces rather than large shadows. The active navigation item is distinguished by a background surface and text weight. Overlays and dialogs use the shared primitives. Static content should not gain a bespoke shadow merely to fill whitespace.

## Shapes

Cards use the shared 12px rounded container; buttons use the shared 8px control radius with smaller maintained variants. Dividers remain thin and neutral. Icons are compact stroke icons aligned to the text baseline, never the only carrier of meaning.

## Components

### Foundational visual states

Use the shared Button, Card, Badge, Skeleton, Alert, Dialog, and Sheet primitives. Enabled actions have hover, active, and visible focus states from the shared recipes; loading keeps the control footprint stable; errors remain scoped to the card or action that failed; empty states explain the next action.

### Buttons and actions

Use solid buttons for the primary safe action and outline/secondary buttons for navigation or utility actions. Navigation uses a real Link rendered through the shared Button primitive. Labels name the result, such as “管理成员”, and permission-sensitive operations must still be enforced by the server.

### Navigation and data display

The Project workspace shell is the canonical navigation owner. The overview page keeps Project ID and lifecycle context in the shared header. Its content summary uses vertically stacked cards when a taller adjacent card would otherwise create unused space; it does not repeat identity metadata. API authorization remains a separate security-focused card and route.
Category detail headers keep the category name and code as the primary identity fields; node type and hierarchy stay out of the primary metadata surface, while version and capability information remains in the capability sections below.
The category catalog only shows “返回产品” when the user entered from the product workflow; direct entry from the Project navigation stays within the category context without a misleading return action.

### Forms and overlays

Use the existing Base UI-backed primitives and Sonner notification provider. Sensitive key values are masked until an explicit action; destructive lifecycle operations use the shared AlertDialog. Error copy gives a reason and a recovery action without exposing raw response bodies.

### Iconography

Use lucide-react stroke icons at the existing `size-3.5`/`size-4` scale. Every icon-only control has an accessible name; text actions keep visible labels.

### Motion

Keep motion subtle and state-led. Shared transition styles are preferred; reduced-motion users receive the same state change without transform-heavy animation.

### Content and data visualization

Use plain, direct Chinese labels and stable domain vocabulary. Counts are displayed as values with an explicit unit. Do not show placeholder timestamps or infer counts from a partial cursor page; read the Project summary contract for aggregate values.

## Do's and Don'ts

- **Do:** Reuse the dashboard's Card and Button primitives for new Project workspace summaries.
- **Do:** Keep member management discoverable as a labeled route from the Project overview.
- **Don't:** Repeat Project ID, creation/update timestamps, or owner metadata inside a summary card when the workspace header already owns that context.
- **Don't:** Alter an adjacent API authorization card when the requested change is limited to the overview's left summary column.
