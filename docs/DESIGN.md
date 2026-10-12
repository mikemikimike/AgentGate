# AgentGate: Dashboard Design Specification

Version 0.2 · Replaces the earlier DESIGN.md · Matches the published dashboard preview exactly.

The look is a thin, dense, production-style operations console, in the family of Linear, Vercel and Stripe dashboards. It is calm: hairline borders, small type, few colors, and no side panels.

## 1. Principles

1. **Thin, not heavy.** 1px hairlines instead of shadows or fills. Surfaces differ by a few percent of lightness.
2. **Probabilities are the data.** Every verdict is shown next to the numbers behind it.
3. **One thing at a time.** Details open as full pages, not drawers. Approvals show one call at a time.
4. **Color means something.** Green, amber and red are verdicts only. The rust accent is brand and primary action only.
5. **Never color alone.** Every verdict has a dot and a text label.
6. **Honest by default.** Sample data and the stub model are always labeled. No invented metrics.

## 2. Hard rules (what this design does NOT do)

- No side panels, drawers, split detail panes or slide-over sheets. A row opens a page.
- No modals for reading content. (Confirm dialogs for destructive actions only, if added later.)
- No gradients or glows in the dashboard. (Those belong to the promo video.)
- No filled pill badges for verdicts. Use dot + label.
- No `min-width` on the app. It must fit any window width.
- No decorative illustration or empty chrome.

## 3. Design tokens

Dark is the default theme (`<html data-theme="dark">`). Light is a full alternative. Both are defined as CSS variables on `:root`.

### 3.1 Color

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg` | `#09090b` | `#fbfbfc` | App background, code blocks, head cards |
| `--pn` | `#0c0c0f` | `#ffffff` | Sidebar, top bar, blocks, table header |
| `--rs` | `#111114` | `#f6f6f8` | Buttons, segmented control |
| `--hv` | `#141418` | `#f1f1f4` | Hover |
| `--sl` | `#17171c` | `#ececf0` | Selected, active nav, bar track, badges |
| `--ln` | `#1d1d22` | `#e6e6ea` | Hairline borders and dividers |
| `--l2` | `#2a2a31` | `#d4d4da` | Control borders, timeline line |
| `--tx` | `#ececf0` | `#17171a` | Primary text |
| `--t2` | `#a1a1aa` | `#52525b` | Secondary text |
| `--t3` | `#71717a` | `#8a8a94` | Labels, muted text |
| `--ac` | `#ce422b` | `#c43a24` | Brand mark, primary button, focus ring |
| `--at` | `#ee6a50` | `#c43a24` | Accent for small text or icons |
| `--ok` | `#4cb782` | `#1f8a5b` | Allow |
| `--wn` | `#e5a93d` | `#b7791f` | Ask, stub-model tag, untrusted spans |
| `--bad` | `#ef5b57` | `#d1423e` | Deny, danger |
| `--nf` | `#6aa5f8` | `#2f6fe0` | YAML keys only |
| `--okb` `--wnb` `--badb` | status color at 9% alpha | 8% alpha | Tinted backgrounds |

Rules:
- Accent is never a verdict color. Use `--at` for small orange text, not `--ac` (contrast).
- Status colors are used only for verdict dots/labels, probability bars that represent risk, and the stub tag.

### 3.2 Typography

| Role | Font | Size / line | Weight |
|---|---|---|---|
| Base UI text | Inter | 13px / 20px | 400 |
| Page title | Inter | 15px / 22px | 600 |
| Detail and approval heading | Inter | 20px / 28px, tracking -0.01em | 600 |
| Section label (block header) | Inter | 12px | 400, `--t3` |
| Table header | Inter | 11.5px | 500, `--t3` |
| Head-card value | Inter | 17px | 600 |
| Code, IDs, numbers | JetBrains Mono | 12px | 400 to 500, tabular figures |
| Numeric value in a head card | JetBrains Mono | 14px | 500 |

All numbers use tabular figures. Never uppercase body text. Fonts load from Google Fonts; fall back to `system-ui` and `ui-monospace`.

### 3.3 Spacing, radius, borders

- Spacing steps: 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28.
- Radius: 4 (tags, kbd), 5 to 6 (buttons, inputs), 8 (blocks, cards), 15 to 22 (pills only).
- Borders: always 1px, `--ln` for structure, `--l2` for controls.
- Shadows: only the toast (`0 8px 30px #0008`). Nothing else.
- Scrollbars: 8px thin, thumb `--l2`.

## 4. Layout

```
┌──────────┬───────────────────────────────────────────────────────┐
│ Sidebar  │ Top bar (44px): breadcrumb ......... tags, theme      │
│ 224px    ├───────────────────────────────────────────────────────┤
│          │ Page (scrolls)                                        │
└──────────┴───────────────────────────────────────────────────────┘
```

- App grid: `224px 1fr`, full height, no minimum width.
- **Sidebar** (`--pn`, right border): padding 10px 8px.
  - Workspace row: 18px brand mark (1.5px accent outline, 6px accent dot), "AgentGate", `production` tag at the right.
  - Search field: 28px, placeholder "Search", `/` kbd.
  - Nav items: 28px tall, 9px gap between icon and label, 15px stroke icons (1.6px). Active: `--sl` background, icon in `--at`. Approvals shows a pending count badge.
  - Footer: "Sample data. Not from a real model." and a `v0.1 design preview` tag.
- **Top bar** (44px, `--pn`, bottom border): breadcrumb `production / Page`, then right-aligned: stub tag, `model stub-0`, `policy v1`, theme toggle (28px square button).
- **Page content** has two widths:
  - Full width: the Decisions table.
  - Centered column: detail and policy pages (`max-width: 980px`), approvals (`max-width: 760px`). Padding `18px 28px 48px`.

## 5. Components

### 5.1 Controls

| Component | Spec |
|---|---|
| Button | 28px tall, padding 0 10px, 12.5px text, 1px `--l2` border, `--rs` fill, radius 6. Hover `--hv`. |
| Primary button | `--ac` fill and border, white text, brightness 1.08 on hover. One per view. |
| Ghost button | No fill, no border, `--t2` text. For secondary navigation (Back, Replay). |
| Danger button | `--bad` text, 40% `--bad` border. |
| Segmented control | 28px, joined buttons, selected `--sl`. Used for the time range (1h, 24h, 7d). |
| Input | 28px, `--bg` fill, 1px `--l2`, radius 6, placeholder `--t3`. |
| Icon button | 28px square, 1px `--ln`, `--t2` icon. |
| Tag | 22px, 12px text, 1px `--ln`, radius 5. |
| Stub tag | Amber text, 45% amber border, amber 9% fill. Text: "Stub model: simulated probabilities". |
| Sample tag | 11px, dashed `--l2` border, `--t3`. Text: "Sample data". |
| Keyboard hint (kbd) | 11px mono, 1px `--l2`, radius 4, `--t3`. |
| Focus | 2px `--ac` outline, 1px offset, on every interactive element. |

### 5.2 Verdict

A 7px dot plus a text label in the same color, weight 500: `Allow` (`--ok`), `Ask` (`--wn`), `Deny` (`--bad`). Never a filled pill.

### 5.3 Probability bar

- Track 4px (5px in head cards), radius 2, `--sl` fill.
- Fill is neutral `--t2` by default; `--bad` when the bar shows a risky answer; `--wn` for an uncertain answer.
- Policy threshold: a 1px `--tx` tick at 70% opacity, 3px taller than the track on each side.
- The number is always shown beside the bar in mono.

### 5.4 Block

The standard container for page content: 1px `--ln` border, radius 8, `--pn` fill, 16px bottom margin.
- Header: min-height 36px, padding 9px 14px, bottom hairline, 12px `--t3` label. An optional text button sits at the far right (for example "All options").
- Body: padding 14px.

### 5.5 Head card

Used for the four signals. 1px `--ln` border, radius 8, `--bg` fill, padding 12px 14px.
- Name: mono, `--t3`.
- Value row: top answer (17px, 600; `--bad` if it is a risky answer at or above 0.50) on the left, probability (mono 14px) on the right.
- Bar below (5px), then optional line "Policy threshold 0.30" (11.5px, `--t3`).
- "All options" mode replaces the value row and bar with one row per option: label, bar, value.
- Grid: two columns, 12px gap.

### 5.6 Code block

`--bg` fill, 1px `--ln`, radius 6, padding 8px 10px, mono 12px, `--t2` text, bold `--tx` for the tool name and measured values. Wraps at spaces first, then anywhere.

### 5.7 Timeline (recent steps)

A 1px `--l2` vertical line with 7px dots. The proposed call has a `--wn` dot. Untrusted text is highlighted with `--wnb` background and `--wn` text, followed by a muted "untrusted" label.

### 5.8 Table

- Header row 28px, sticky, `--pn`, 11.5px `--t3`.
- Body rows 34px, bottom hairline, hover `--hv`. A chevron appears at the right on hover.
- Columns (wide): Time 76 | Tool 120 | Session 70 | Verdict 82 | Top signal `minmax(280px, 1fr)` | Rule 170 | chevron 20.
- Below 1280px window width: the Session column is hidden and columns become 76 | 120 | 82 | `minmax(330px, 1fr)` | 150 | 20.
- Top signal cell: head name (mono, `--t3`, 150px, truncated), a 64px bar, then `option value` in mono.
  - Deny rows: `untrusted_influence likely 0.88` in red.
  - Allow rows: the top `untrusted_influence` answer, neutral.
  - Ask rows: the head with the least confident answer, in amber.
- Row padding: 20px horizontally.

### 5.9 Queue pills (approvals)

30px tall, radius 15, 1px `--ln` border, amber dot, mono tool name, amber mono countdown. Selected: `--sl` fill and `--l2` border.

### 5.10 Toast

Fixed, bottom center, `--sl` fill, `--l2` border, radius 8, shadow, 1.8s. Text: "`tool` approved. Logged as a training label after review."

## 6. Pages

### 6.1 Decisions (list)

Header (padding 14px 20px 10px): title "Decisions", counts with verdict dots ("7 allowed", "3 asked", "2 denied"), sample tag. Filter bar: segmented time range, three dropdown-style buttons (Tool, Verdict, Session), a text filter (220px), and a "Live" indicator (green dot with 3px halo) at the far right. Then the table.

### 6.2 Decision detail (full page)

Reached by clicking a row. Breadcrumb becomes `production / Decisions / d_8f2a`.

1. Toolbar row: ghost "Decisions" back button, then at the right "1 of 12", up and down icon buttons.
2. Meta line: `id · time · session` in mono, muted.
3. Heading: tool name (mono) and the verdict.
4. Block "Why this verdict": a sentence, plus (for rule matches) a code block with each condition and its measured value.
5. Block "Action": code block with the redacted call, then "User goal".
6. Block "Signals": four head cards in a 2 x 2 grid; "All options" toggles the full distributions.
7. Footer row: "Open session" button, ghost "Replay under draft policy", and `policy v1 · stub-0` at the right.

Keys: `J` next, `K` previous, `Esc` back to the list.

### 6.3 Approvals

- Queue strip (padding 10px 28px, bottom hairline): one pill per pending call, then "3 pending" and the sample tag at the right.
- One centered review card (760px): meta line, heading "Approve `tool`?", one explanatory sentence, then blocks "Proposed action" (code + user goal), "Recent steps" (timeline), "Signals" (two head cards).
- Fixed action bar at the bottom: note input (flexible), Deny (danger, `D`), Approve (primary, `A`).
- After a decision the next call is selected. When empty: "All clear".

Keys: `A` approve, `D` deny, `J`/`K` next and previous.

### 6.4 Policy

Centered column. Header: title, `policy.yaml` (mono), "v1 active" tag, sample tag.
- Editor block: toolbar (Validate, Replay on sample decisions, primary "Activate v2" at the right) above a code area with line numbers (44px gutter, mono 12.5px / 21px line height). Syntax colors: keys `--nf`, strings `--ok`, numbers `--wn`.
- "Replay results" section below the editor, with the line "Draft v2 vs active v1, on 12 stored decisions. No model calls were made."
- Two blocks side by side: "Verdict changes" (from/to table; changed cells in amber) and "Changed decisions" (id, tool, `allow → ask`, and the rule responsible).
- A primary "Activate v2" at the bottom right.

## 7. Behavior

- Theme toggle switches dark and light by setting `data-theme` on `<html>`.
- Only one page is visible at a time. Navigating keeps no hidden panels.
- The approval countdowns tick once per second.
- Layout never scrolls the whole app; pages scroll inside the main area.
- Window width: no minimum. Below 1280px the table drops Session. Content columns shrink to fit.

## 8. Content and voice

- Plain, technical, neutral. No hype.
- Explain verdicts with the rule and the numbers: "Rule `deny-injected-exfil` matched, and the strictest action wins."
- Abstain sentence: "No rule matched. The top probability was below the abstain threshold (0.55), so a person decides."
- Every screen with illustrative data carries the "Sample data" tag. The stub tag is always visible in the top bar while the stub model is active.

## 9. Accessibility

- Verdicts: dot + label, never color alone.
- Focus ring on every control; keyboard shortcuts for list navigation and approvals.
- Body text contrast meets AA in both themes. Small orange text uses `--at`.
- Row and pill targets are at least 28px tall.
- Respect reduced motion: there are no animations beyond the 0.2s toast fade.

## 10. Implementation notes

- Single file or React app; the tokens above are the only source of color.
- Icons are inline SVG, 24px viewBox, 1.6px stroke, rounded joins, rendered at 15px.
- Keep the probability bar and head card as shared components. All four head names are fixed: `untrusted_influence`, `goal_alignment`, `reversibility`, `external_send`.
- API data feeds: decisions list, a decision by ID, pending approvals, the active policy, a replay result.

## 11. Acceptance checklist

- [ ] No panel, drawer or split pane anywhere
- [ ] All colors come from the token table
- [ ] Verdicts use dot + label, never filled pills
- [ ] Probabilities are visible on the list (top signal), detail and approvals
- [ ] Sample tag on every illustrative screen; stub tag in the top bar
- [ ] Works at 1000px wide with no clipped content
- [ ] Dark and light themes both pass a visual check
- [ ] Keyboard: J, K, Esc on detail; A, D, J, K on approvals
- [ ] Table rows are 34px; header 28px; controls 28px
- [ ] One primary button per view
