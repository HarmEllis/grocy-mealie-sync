# Shopping design reference

Snapshot of the Open Design prototype the Shopping page is built from.

- `src/` the prototype (open `src/shopping.html` in a browser). CSS and JS are copied unchanged.
- `screenshots/` reference renders per tab, state (busy, all-clear, no-plugins) and width.
- `parity.md` acceptance checklist; every row must end up `done`, `adapted` or `n/a`.

The prototype CSS is ported into the app by `node scripts/port-shop-design-css.mjs`, which writes
`src/components/shop/shop-design.css` (scoped under `.shop-v2`, variables renamed to `--shop-*`).
Rerun it after changing anything in `src/*.css`; do not edit the generated file by hand.
