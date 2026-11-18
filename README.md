# dsh-plugin-screen-map 🗺️

Compacts `screen_read` output into a tight "screen map" and keeps **element ids and coordinates**,
so tapping by id still works.

## Why it pays

A single screen read is usually 200–400 lines, and most of it is layout shells with no text at all:

```
[e8] View {scroll} @360,691
  [e10] View {click} @360,286
    [e11] TextView "正在运行命令" @386,280
```

After compaction only "has text / editable / tappable leaf" lines remain:

```
  [e11] "正在运行命令" @386,280
```

Measured on the test device: one real `screen_read` dropped 22 shell lines; the bundled sample goes
682 → 507 chars (26 %).

## Rules

- **kept**: elements with text or `desc`, input-like elements (`edit` / `wheel` / `focused` /
  `checked`), interactive leaves
- **dropped**: containers with no text, no `desc`, no interaction; the `scroll` flag
- **untouched**: header line, section notes (`-- system UI --`), OCR lines (`[t1] …`)

## Truncation (changed in 0.1.1)

The old version cut from the tail — but on a phone the **input box, send button and permission
buttons live at the bottom**, so cutting the tail removed exactly the things you want to tap. It now
keeps **head + tail** and omits the middle:

```
[e0] "…" @10,0
…（middle 191 lines omitted; the bottom input/send keys are kept in the last 3 lines…）
[e199] "…" @10,199
```

The omission line says how many lines are missing, so the model knows to scroll or re-read instead of
assuming that is the whole screen.

## How it works

Applied through `tools/post-execute`: only the **text the model sees** is replaced — `value` is
untouched, so programmatic consumers are unaffected. If parsing fails or the result would be longer,
the original text passes through unchanged.

## Config

| field | default | meaning |
|---|---|---|
| `enabled` | `true` | master switch |
| `maxLines` | `60` | total output line budget (head + tail + omission line) |
| `headRatio` | `0.6` | share of the budget for the head when truncating (the rest goes to the tail) |

MIT, no dependencies, `node test/unit.mjs` runs directly.

## 30-second self-check

1. Ask the model to look at the screen ("what is on screen right now?").
2. The output should end with "（已压掉 N 行布局壳层）" and, when over budget, "…（中间省略 N 行…）".
3. Nothing of the sort → check that `dsh-plugin-screen-map` is listed in the profile's
   `dsh.profile.bundles`.

Note: it saves **tokens**, not time — reading the screen is still slow (~30 s per read on the test
device).
