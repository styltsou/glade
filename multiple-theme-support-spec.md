# Glade — Theme Support Spec (shadcn-compatible)

## Overview

Glade supports multiple visual themes, each with a light and dark mode variant. Themes are implemented as CSS custom properties using **shadcn's HSL variable naming convention**, so all shadcn components inherit the active theme automatically. Custom Glade components reference the same variables — one single source of truth, no bridging layer needed.

---

## Theme Architecture

shadcn expects CSS variables defined as space-separated HSL values (no `hsl()` wrapper):

```css
--background: 0 0% 100%;   /* used as: hsl(var(--background)) */
```

Themes are applied by setting `data-theme` and `data-mode` on the `<html>` element:

```ts
document.documentElement.setAttribute('data-theme', 'claude')
document.documentElement.setAttribute('data-mode', 'dark')
```

All variable definitions are scoped to `[data-theme="x"][data-mode="y"]` selectors, overriding shadcn's default `:root` values.

### Full Variable Reference

```css
--background          /* main app background */
--foreground          /* primary text */

--card                /* card / surface background */
--card-foreground     /* text on cards */

--popover             /* popover / dropdown background */
--popover-foreground  /* text on popovers */

--primary             /* accent color */
--primary-foreground  /* text on accent backgrounds */

--secondary           /* secondary button / surface */
--secondary-foreground

--muted               /* de-emphasized backgrounds (sidebar, code blocks) */
--muted-foreground    /* de-emphasized text (labels, timestamps) */

--accent              /* hover highlight backgrounds */
--accent-foreground

--destructive         /* delete / error actions */
--destructive-foreground

--border              /* default border color */
--input               /* input field border */
--ring                /* focus ring color */

--radius              /* global border radius */

/* Glade-specific extras (not used by shadcn) */
--editor-bg           /* editor area background */
--editor-text         /* editor body text */
--syntax-keyword
--syntax-string
--syntax-comment
--syntax-number
```

---

## Themes

### 1. Monochrome

Stark and distraction-free. Pure blacks, whites, and grays. No color accent — the UI gets out of the way entirely. The primary/accent is the text color itself.

#### Light Mode

```css
[data-theme="monochrome"][data-mode="light"] {
  --background:             0 0% 100%;
  --foreground:             0 0% 7%;

  --card:                   0 0% 96%;
  --card-foreground:        0 0% 7%;

  --popover:                0 0% 100%;
  --popover-foreground:     0 0% 7%;

  --primary:                0 0% 7%;
  --primary-foreground:     0 0% 100%;

  --secondary:              0 0% 94%;
  --secondary-foreground:   0 0% 7%;

  --muted:                  0 0% 94%;
  --muted-foreground:       0 0% 53%;

  --accent:                 0 0% 91%;
  --accent-foreground:      0 0% 7%;

  --destructive:            0 72% 51%;
  --destructive-foreground: 0 0% 100%;

  --border:                 0 0% 88%;
  --input:                  0 0% 88%;
  --ring:                   0 0% 7%;

  --radius:                 0.375rem;

  --editor-bg:              0 0% 100%;
  --editor-text:            0 0% 7%;
  --syntax-keyword:         0 0% 7%;
  --syntax-string:          0 0% 27%;
  --syntax-comment:         0 0% 53%;
  --syntax-number:          0 0% 20%;
}
```

#### Dark Mode

```css
[data-theme="monochrome"][data-mode="dark"] {
  --background:             0 0% 10%;
  --foreground:             0 0% 93%;

  --card:                   0 0% 13%;
  --card-foreground:        0 0% 93%;

  --popover:                0 0% 13%;
  --popover-foreground:     0 0% 93%;

  --primary:                0 0% 93%;
  --primary-foreground:     0 0% 7%;

  --secondary:              0 0% 16%;
  --secondary-foreground:   0 0% 93%;

  --muted:                  0 0% 16%;
  --muted-foreground:       0 0% 40%;

  --accent:                 0 0% 20%;
  --accent-foreground:      0 0% 93%;

  --destructive:            0 62% 48%;
  --destructive-foreground: 0 0% 100%;

  --border:                 0 0% 17%;
  --input:                  0 0% 17%;
  --ring:                   0 0% 93%;

  --radius:                 0.375rem;

  --editor-bg:              0 0% 10%;
  --editor-text:            0 0% 93%;
  --syntax-keyword:         0 0% 93%;
  --syntax-string:          0 0% 67%;
  --syntax-comment:         0 0% 40%;
  --syntax-number:          0 0% 80%;
}
```

---

### 2. Claude

Inspired by the Claude desktop app. Warm off-whites and creams on light mode, deep warm charcoal on dark mode, with a terracotta/rust accent.

#### Light Mode

```css
[data-theme="claude"][data-mode="light"] {
  --background:             35 33% 97%;
  --foreground:             28 14% 11%;

  --card:                   34 25% 93%;
  --card-foreground:        28 14% 11%;

  --popover:                35 33% 97%;
  --popover-foreground:     28 14% 11%;

  --primary:                18 55% 52%;
  --primary-foreground:     0 0% 100%;

  --secondary:              33 20% 90%;
  --secondary-foreground:   28 14% 11%;

  --muted:                  33 20% 90%;
  --muted-foreground:       25 10% 44%;

  --accent:                 32 22% 87%;
  --accent-foreground:      28 14% 11%;

  --destructive:            0 72% 51%;
  --destructive-foreground: 0 0% 100%;

  --border:                 32 20% 85%;
  --input:                  32 20% 85%;
  --ring:                   18 55% 52%;

  --radius:                 0.5rem;

  --editor-bg:              35 40% 98%;
  --editor-text:            28 14% 11%;
  --syntax-keyword:         18 55% 52%;
  --syntax-string:          100 24% 50%;
  --syntax-comment:         25 10% 57%;
  --syntax-number:          210 35% 55%;
}
```

#### Dark Mode

```css
[data-theme="claude"][data-mode="dark"] {
  --background:             28 10% 11%;
  --foreground:             35 18% 92%;

  --card:                   28 9% 14%;
  --card-foreground:        35 18% 92%;

  --popover:                28 9% 14%;
  --popover-foreground:     35 18% 92%;

  --primary:                18 55% 52%;
  --primary-foreground:     0 0% 100%;

  --secondary:              28 10% 18%;
  --secondary-foreground:   35 18% 92%;

  --muted:                  28 10% 18%;
  --muted-foreground:       25 12% 54%;

  --accent:                 28 10% 20%;
  --accent-foreground:      35 18% 92%;

  --destructive:            0 62% 48%;
  --destructive-foreground: 0 0% 100%;

  --border:                 28 10% 18%;
  --input:                  28 10% 18%;
  --ring:                   18 55% 52%;

  --radius:                 0.5rem;

  --editor-bg:              28 10% 11%;
  --editor-text:            35 18% 92%;
  --syntax-keyword:         18 55% 52%;
  --syntax-string:          100 24% 50%;
  --syntax-comment:         25 10% 40%;
  --syntax-number:          210 35% 55%;
}
```

---

## Mode Detection

On startup, Glade reads the saved theme and mode from local config. If no mode is saved, it defaults to the OS preference:

```ts
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
const defaultMode = prefersDark ? 'dark' : 'light'
```

The user can override this in Settings → Appearance at any time.

---

## Applying Themes in React

A `ThemeProvider` component handles reading from config and applying attributes to `<html>`:

```tsx
function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState('claude')
  const [mode, setMode] = useState<'light' | 'dark'>('dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.setAttribute('data-mode', mode)
  }, [theme, mode])

  return (
    <ThemeContext.Provider value={{ theme, mode, setTheme, setMode }}>
      {children}
    </ThemeContext.Provider>
  )
}
```

Wrap the app root with `ThemeProvider`. Switching is instant — no reload required.

---

## Storage

Theme preference is stored in the same local config file as sidebar state and recents:

```json
{
  "theme": "claude",
  "mode": "dark",
  "recents": [...],
  "sidebar": { ... }
}
```

---

## Settings UI

Theme selection lives in **Settings → Appearance**:

- A row of theme cards, one per theme, each showing a small color swatch preview
- Below the theme cards, a **Light / Dark / System** segmented control for mode
- Active theme card is highlighted with `--primary` border

---

## Adding New Themes (Future)

1. Add two CSS blocks (`light` and `dark`) following the variable structure above
2. Register theme metadata in `themes.ts`:

```ts
export const themes = [
  { id: 'monochrome', label: 'Monochrome', previewColors: ['#ffffff', '#111111'] },
  { id: 'claude', label: 'Claude', previewColors: ['#f9f6f2', '#c96442', '#1e1c19'] },
]
```

3. It will automatically appear in the settings UI — no other changes needed.

---

## Out of Scope for v1

- User-created custom themes
- Per-vault theme override
- High contrast accessibility theme
- Theme import / export
