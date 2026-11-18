# Changelog

## 0.1.1

- **Truncation fixed.** Over-budget output used to be cut from the tail — and on a phone the input
  box, send button and permission buttons are at the bottom, so the cut removed exactly the things
  that need tapping. It now keeps **head + tail** and omits the middle, with an explicit
  "…（中间省略 N 行…）" line that says how many lines are missing and suggests raising `maxLines` or
  scrolling the screen.
- New `headRatio` (default 0.6) sets the head/tail split.
- `maxLines` is now a total budget (head + tail + omission line); the "dropped shells" note no longer
  eats one of those lines.
- `truncateLines` is exported and unit-tested: in-budget passthrough, tail preservation, tiny budgets.

## 0.1.0 — first release

- Compacts `screen_read` output into a tight "screen map" and keeps **element ids and coordinates**,
  so `screen_tap` / `screen_set_wheel` by id still work.
- What is **kept**: header line, section notes (`-- system UI --`), OCR lines (`[t1] …`), anything
  with text or `desc`, input-like elements (`edit` / `wheel` / `focused` / `checked`), and
  interactive leaves.
- What is **dropped**: layout shells with no text, no `desc`, no interaction, and not a leaf; the
  `scroll` flag.
- `maxLines` (default 60) truncates long trees and says so; when parsing fails or the result would
  be longer, the original text is passed through untouched.
- Applied through `tools/post-execute`: only the **text the model sees** is replaced — `value` is
  untouched, so programmatic consumers are unaffected.
- No dependencies, pure host side → works on phone and desktop DSH.
  Measured on a vivo V2617A (Android 16), DSH-Android 0.3.11 / engine 0.2.1-rc.5: one real
  `screen_read` dropped 22 shell lines; the bundled test sample goes 682 → 507 chars (26 %).
