# Branding the Web UI

Everything visual is driven by one file: **`src/styles/brand.css`**. Components never hardcode a
colour; they use Tailwind classes (`bg-primary`, `text-muted-foreground`, `border-border`, …) that are
bound to the tokens in that file. Change a token, and every button, badge, sidebar row, focus ring and
link follows.

## Change the accent colour

The default theme is black on white. To use a brand colour instead, edit these lines in the `:root`
block (light scheme) and the `.dark` block:

```css
--primary: #0a0a0a;             /* buttons, active items, focus ring */
--primary-foreground: #fafafa;  /* text on top of --primary */
--ring: #0a0a0a;                /* focus outline, usually = --primary */
--sidebar-primary: #0a0a0a;     /* active sidebar item, usually = --primary */
--link: #0a0a0a;                /* links inside rendered markdown */
```

Example, a blue brand:

```css
--primary: #2563eb;
--primary-foreground: #ffffff;
--ring: #2563eb;
--sidebar-primary: #2563eb;
--link: #1d4ed8;
```

## Other common edits

| Want to change | Token(s) |
|---|---|
| Page background / text | `--background`, `--foreground` |
| Sidebar background / text | `--sidebar`, `--sidebar-foreground` |
| Hover highlight | `--accent`, `--sidebar-accent` |
| Borders and input outlines | `--border`, `--input`, `--sidebar-border` |
| Muted helper text | `--muted-foreground` |
| Danger (delete) colour | `--destructive` |
| Search highlight | `--mark` |
| Inline / block code background | `--code-bg` |
| Corner radius everywhere | `--radius` (e.g. `0` for square, `0.75rem` for soft) |
| Fonts | `--font-sans`, `--font-mono` |

Keep the `:root` and `.dark` blocks in sync: every token exists in both.

## App name and tagline

`src/components/app-sidebar.tsx` exports two constants at the top:

```ts
export const APP_NAME = 'Wiki';
export const APP_TAGLINE = 'Knowledge base';
```

The browser tab title is in `index.html`.

## Adding a new token

1. Add it to both `:root` and `.dark` in `brand.css`.
2. Expose it to Tailwind in `src/styles/index.css` inside `@theme inline`:
   `--color-your-token: var(--your-token);`
3. Use it as `bg-your-token`, `text-your-token`, `border-your-token`.

## Light / dark

The toggle in the sidebar footer adds or removes the `dark` class on `<html>` and remembers the choice
in `localStorage` under `wiki-theme`. The dark scheme is simply the `.dark` block in `brand.css`.
