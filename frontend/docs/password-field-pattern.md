# Password fields — show/hide (eye) toggle

This project has a **built-in show/hide toggle** for password inputs. Use it any
time you add a password field anywhere on the website so users can reveal what
they typed.

There are two ways to add a password field, depending on whether you're using
the shared `Input` component or a raw `<input>`.

---

## 1. The easy way — shared `Input` (recommended)

The shared `Input` component (`src/components/ui/index.tsx`) **automatically**
renders an eye toggle whenever `type="password"`. You don't have to do anything
extra:

```tsx
import { Input } from '@/components/ui';

<Input
  label="New Password"
  type="password"            // ← this alone adds the show/hide eye
  value={pw}
  onChange={e => setPw(e.target.value)}
  placeholder="Min 8 characters"
/>
```

- The toggle, icon, padding, and state are all handled inside `Input`.
- Works for every `Input` in the app (login is the one exception — see below —
  because it uses a custom-styled raw input).
- The toggle button is `tabIndex={-1}` so it never interrupts tab → submit.

**Examples already using this:** the "Add User" modal password field and the
"Set Password" (super-admin) modal in `src/app/dashboard/users/page.tsx`.

---

## 2. Raw `<input>` (custom styling, e.g. the login page)

If a screen uses its own `<input>` styling instead of the shared `Input`
(like `src/app/login/page.tsx`), wrap it and drop in the shared icons:

```tsx
import { useState } from 'react';
import { EyeIcon, EyeOffIcon } from '@/components/ui';

const [showPw, setShowPw] = useState(false);

<div className="relative">
  <input
    type={showPw ? 'text' : 'password'}
    value={pw}
    onChange={e => setPw(e.target.value)}
    className="w-full px-3.5 py-2.5 pr-11 border border-slate-200 rounded-xl text-sm ..."
    placeholder="••••••••"
  />
  <button
    type="button"
    tabIndex={-1}
    onClick={() => setShowPw(s => !s)}
    aria-label={showPw ? 'Hide password' : 'Show password'}
    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
  >
    {showPw ? <EyeOffIcon /> : <EyeIcon />}
  </button>
</div>
```

Key points:
- Add right padding (`pr-11` here) so the typed text doesn't run under the icon.
- The wrapper must be `relative` so the button positions over the input.
- Toggle `type` between `'password'` and `'text'` — never store the value as
  plain text in a separate state.

---

## Shared icons

`EyeIcon` and `EyeOffIcon` are exported from `src/components/ui/index.tsx`:

```tsx
import { EyeIcon, EyeOffIcon } from '@/components/ui';

<EyeIcon />            // default 18px
<EyeOffIcon size={20} />
```

They inherit color via `currentColor`, so set the color on the parent/button.

---

## Rules of thumb

- **Prefer the shared `Input`** — it gives you the toggle for free and keeps
  every password field consistent.
- Always set `type="password"` (not `text`) as the default state so browsers
  still treat it as a password (autofill, managers, masking).
- Keep the toggle button `type="button"` and `tabIndex={-1}` so it doesn't
  submit the form or steal tab focus.
- Add an `aria-label` that reflects the current state for accessibility.
