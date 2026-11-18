// dsh-plugin-screen-map — 把 screen_read 的冗长 UI 树压成紧凑「屏幕地图」，保留 element id 与坐标
//
// 做法：tools/post-execute 拦 screen_read 的结果，只替换模型看到的内容（value 不动）。
// 保留：读屏头行、有文字/描述的元素、可点/可输入/可勾选/长按的元素、叶子节点（无名但可点）
// 丢掉：纯布局壳层（无文字、无 desc、不可交互、也不是叶子）、scroll 标记
//
// 0.1.1：超长时不再「从尾巴砍」。屏幕底部通常放输入框/发送键，砍尾巴等于砍掉最需要点的东西；
//        改成「保头 + 保尾 + 中间省略」，并在省略处写清缺了多少行。
export const name = 'screen-map'

const DEFAULTS = { enabled: true, maxLines: 60, headRatio: 0.6 }

const ELEM = /^(\s*)\[(e\d+|t\d+)\]\s+(.*)$/
const QUOTED = /"((?:[^"\\]|\\.)*)"/
const DESC = /desc="((?:[^"\\]|\\.)*)"/
const FLAGS = /\{([^}]*)\}/
const COORD = /@(\d+),(\d+)\s*$/
const TYPE = /^([A-Za-z][A-Za-z0-9_.]*)/
const KEEP_FLAGS = new Set(['click', 'long', 'edit', 'checked', 'focused', 'wheel'])

function parse(line) {
  const m = ELEM.exec(line)
  if (!m) return undefined
  const [, indent, id, rest] = m
  const coord = COORD.exec(rest)
  const quoted = QUOTED.exec(rest.replace(DESC, ''))
  const desc = DESC.exec(rest)
  const flags = FLAGS.exec(rest)
  const type = TYPE.exec(rest.replace(FLAGS, '').replace(DESC, '').replace(QUOTED, '').trim())?.[1]
  return {
    indent: indent.length,
    id,
    text: quoted?.[1],
    desc: desc?.[1],
    type,
    flags: flags ? flags[1].split(',').map((s) => s.trim()).filter(Boolean) : [],
    coord: coord ? { x: Number(coord[1]), y: Number(coord[2]) } : undefined,
  }
}

/** 行数超预算时保头保尾，中间写明省略了多少行。纯函数，便于测试。 */
export function truncateLines(lines, opts = {}) {
  const opt = { ...DEFAULTS, ...(opts ?? {}) }
  const budget = Math.max(3, Math.floor(Number(opt.maxLines) || DEFAULTS.maxLines))
  if (lines.length <= budget) return lines
  const ratio = Math.min(0.9, Math.max(0.1, Number(opt.headRatio) || DEFAULTS.headRatio))
  const head = Math.max(1, Math.ceil((budget - 1) * ratio))
  const tail = Math.max(1, budget - 1 - head)
  const omitted = lines.length - head - tail
  if (omitted <= 0) return lines
  const marker = '…（中间省略 ' + omitted + ' 行；底部 input/发送键已保留尾 ' + tail + ' 行，' +
    '需要中间部分请调高 maxLines 或整屏滚动后重读）'
  return lines.slice(0, head).concat([marker], lines.slice(lines.length - tail))
}

/** 纯函数：输入 screen_read 的文本，输出紧凑地图。便于测试。 */
export function compact(text, cfg = {}) {
  const opt = { ...DEFAULTS, ...(cfg ?? {}) }
  const lines = String(text ?? '').split('\n')
  const parsed = lines.map(parse)

  const isLeaf = (i) => {
    const cur = parsed[i]
    if (!cur) return false
    for (let j = i + 1; j < parsed.length; j++) {
      if (!parsed[j]) continue
      return parsed[j].indent <= cur.indent
    }
    return true
  }

  const out = []
  let dropped = 0
  for (let i = 0; i < lines.length; i++) {
    const p = parsed[i]
    if (!p) { out.push(lines[i]); continue }        // 头行 / 分段说明
    const flags = p.flags.filter((f) => KEEP_FLAGS.has(f))
    // 有文字/描述的必留；输入类（edit/wheel/focused/checked）无论是否容器都留；
    // 普通容器（只有 click）交给子元素坐标去点；叶子只要可交互就留
    const inputLike = p.flags.some((f) => f === 'edit' || f === 'wheel' || f === 'focused' || f === 'checked')
    const keep = Boolean(p.text || p.desc) || inputLike || (isLeaf(i) && flags.length > 0)
    if (!keep) { dropped++; continue }
    const bits = ['[' + p.id + ']']
    if (p.type && !p.text && !p.desc) bits.push(p.type)
    if (p.text) bits.push('"' + p.text + '"')
    if (p.desc) bits.push('desc="' + p.desc + '"')
    if (flags.length) bits.push('{' + flags.join(',') + '}')
    if (p.coord) bits.push('@' + p.coord.x + ',' + p.coord.y)
    out.push(' '.repeat(Math.min(p.indent, 6)) + bits.join(' '))
  }

  // 先在预算内截断，再附注；这样「已压掉 N 行」不会自己占掉一行预算
  const body = truncateLines(out, opt)
  const notes = []
  if (dropped > 0) notes.push('（已压掉 ' + dropped + ' 行布局壳层）')
  return body.concat(notes).join('\n')
}

export function apply(ctx, config) {
  const cfg = { ...DEFAULTS, ...(config ?? {}) }
  if (cfg.enabled === false) return

  ctx.on('tools/post-execute', async (exec, result, next) => {
    try {
      if (exec?.name !== 'screen_read' || !result || result.isError) return next()
      const blocks = Array.isArray(result.content) ? result.content : []
      const idx = blocks.findIndex((b) => b?.type === 'text' && typeof b.text === 'string')
      if (idx < 0) return next()
      const before = blocks[idx].text
      const after = compact(before, cfg)
      if (after === before || after.length >= before.length) return next()
      const content = blocks.slice()
      content[idx] = { ...blocks[idx], text: after }
      return { kind: 'accept', content }
    } catch {
      return next()
    }
  })
}
