import assert from 'node:assert/strict'
import { compact, truncateLines } from '../index.js'

const dump = `App: io.github.jackwener.dsh · read #3 · user's screen 720x1592 px
[e1] View {click} @62,154
  [e2] View desc="打开侧边栏" @62,154
[e3] TextView "读一下 ~/handoff.md 继续" @312,153
[e4] View {click} @552,154
  [e5] View desc="轨迹" @562,154
[e8] View {scroll} @360,691
  [e9] TextView "模型提前停下但待办还没做完" @376,222
  [e10] View {click} @360,286
    [e11] TextView "正在运行命令" @386,280
[e39] EditText {click,long,edit} @367,1381
  [e40] TextView "发消息或创建任务" @367,1381
-- system UI (status bar / notification shade) --
[e52] FrameLayout #cap_left {click} @280,41
[e59] LinearLayout desc="电池电量为百分之 90。" #battery @646,45

-- text recognized from the screenshot (tap with node "t<n>") --
[t1] "22:23" @99,40
`

const out = compact(dump)
console.log(out)
console.log('\n--- 原长', dump.length, '→ 压缩后', out.length, '（', Math.round((1 - out.length / dump.length) * 100), '% 省）')

// 1. 头行保留
assert.match(out, /^App: io\.github/)
// 2. 有文字的保留，且带 id 和坐标
assert.match(out, /\[e3\] "读一下 ~\/handoff\.md 继续" @312,153/)
// 3. desc 保留
assert.match(out, /\[e2\] desc="打开侧边栏" @62,154/)
// 4. 纯 scroll 壳层被压掉
assert.doesNotMatch(out, /\[e8\]/)
// 5. 可编辑元素保留（edit 标记）
assert.match(out, /\[e39\] EditText \{click,long,edit\} @367,1381/)
// 6. OCR 文本行保留
assert.match(out, /\[t1\] "22:23" @99,40/)
// 7. 明显变短
assert.ok(out.length < dump.length * 0.75, '应至少省 25%')
// 8. 关掉开关时原样返回（apply 层判断，这里只验纯函数对齐）
assert.equal(compact(''), '')

// 9. 0.1.1：超长时保头保尾，中间省略（旧版是砍尾巴，会把输入框砍掉）
const long = Array.from({ length: 200 }, (_, i) => '[e' + i + '] TextView "x' + i + '" @10,' + i)
const cut = compact(long.join('\n'), { maxLines: 10 })
console.log('\n--- 截断样例 ---\n' + cut)
const cutLines = cut.split('\n')
assert.ok(cutLines.length <= 11, '预算内（10 行 + 1 行压壳层注）')
assert.match(cut, /\[e0\]/, '头部保留')
assert.match(cut, /\[e199\]/, '尾部保留（输入框/发送键在这边）')
assert.match(cut, /中间省略 \d+ 行/)
assert.doesNotMatch(cut, /\[e100\]/, '中间确实被省略')

// 10. 尾部行数真的够（默认 headRatio 0.6 → 10 行预算里尾 3 行）
assert.match(cut, /\[e197\]/)
assert.match(cut, /\[e198\]/)

// 11. 预算够时不截断
assert.equal(truncateLines(['a', 'b'], { maxLines: 10 }).length, 2)
// 12. 极小预算不炸
assert.ok(truncateLines(['a', 'b', 'c', 'd'], { maxLines: 1 }).length <= 4)

console.log('\nall tests passed')
