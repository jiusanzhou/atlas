# Atlas

配置驱动的组织架构 / 领域人力管理平台。一份 yaml / json / toml 配置，渲染出炉石风格的领域树与人物卡，突出**领域负责人**、**核心成员**、**人力缺口**和**借调交叉支撑**。

## 用途

把「谁负责哪个领域、缺多少人、谁被借调到哪里」这件事从散落的表格里搬到一张可视化地图上：

- **领域树**：领域可无限层级嵌套，父子关系用递进缩进表达
- **人物卡**：负责人加冕、稀有度边框（铜 / 银 / 紫 / 金）、技能标签、借调徽章
- **缺口卡**：灰色虚线 + 「招募中」+ 优先级红点，一眼看出招聘压力
- **借调箭头**：虚线弧线连接主属地与借调领域，标注占比

## 启动

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # 生产构建
```

首页左侧是配置编辑区（默认载入 `examples/demo.yaml`），右侧按顶层领域分 Tab 实时渲染，顶部三个按钮：切换主题 / 导出 drawio / 导出 PNG (zip)。

PNG 导出需要 Chrome。若 `pnpm install` 阶段浏览器下载失败：

```bash
pnpm exec puppeteer browsers install chrome
```

也可以用本机已装的 Chrome：

```bash
export PUPPETEER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

## 配置样例

三种格式自动识别（按首个有效行的 `=` / `:` / `{` 判断），字段完全一致。

```yaml
meta:
  title: 技术中台组织架构
  version: "1.0.0"

theme: hearthstone          # hearthstone | business | blueprint

domains:
  - name: infra             # 唯一 key
    displayName: 基础设施
    lead: torvalds          # person id
    color: "#4a3113"        # 可选，覆盖主题色
    description: 内核、网络与存储底座
    subdomains:             # 递归嵌套
      - name: storage
        displayName: 存储
        lead: antirez
        members: [pcarrier]
        gaps:
          - role: 分布式存储专家
            count: 1
            priority: critical      # low | medium | high | critical
            note: 自研 KV 引擎缺主力

people:
  - id: antirez
    name: Salvatore Sanfilippo
    title: 存储负责人
    homeDomain: storage             # 主属地领域
    avatar: github:antirez
    tags: [Redis, C, 存储引擎]      # 卡面最多展示 3 个
    rarity: epic                    # 可选，默认按角色推断
    lendTo:
      - domain: data                # 借调到哪个领域
        ratio: 0.3                  # 0-1
        role: 实时存储选型
```

`rarity` 省略时按角色推断：领域负责人 → legendary，有借调 → epic，标签 ≥3 → rare，其余 common。

除 zod schema 校验外，还会做交叉引用检查（id 唯一性、`lead` / `members` / `lendTo.domain` / `homeDomain` 是否存在），不合法的引用以告警形式提示，不阻塞渲染。

### 头像 fallback 链

`avatar` 字段支持前缀协议，任何一环失败都会退化为首字母 SVG，卡片永远能渲染：

| 写法 | 行为 |
| --- | --- |
| `https://…` / `http://…` | 直接使用 |
| `file://path` | 相对 config 目录读取，转 data URI（限制在目录内，防止 `../` 越界） |
| `gravatar:a@b.com` | `gravatar.com/avatar/{md5}?d=identicon` |
| `github:username` | `github.com/{user}.png` |
| `dicebear:style` | `api.dicebear.com/7.x/{style}/svg?seed={id}` |
| `initials` 或留空 | 生成首字母 SVG，背景色按 name hash |

## 导出方式

| 方式 | 说明 |
| --- | --- |
| **drawio** | `POST /api/drawio` → 合法 mxGraph XML，**一个顶层领域一个 `<diagram>` page**，同一个 `<mxfile>` 内。领域节点为 container，人物卡为组合 mxCell，领域→子领域为实线连线，借调以卡片角标文本呈现（不跨 page 画箭头）。头像默认内嵌 base64（离线可打开），全部保留可编辑性，不栅格化 |
| **PNG** | `POST /api/export` → puppeteer 无头截图 `/render` 页面，**每个顶层领域一张 PNG，打包成 zip 返回**（`application/zip`，条目名 `atlas-{领域名}.png`）。支持 `scale`（默认 2，Retina）与 `width` |
| **解析** | `POST /api/parse` → 三格式统一解析为 Config，返回 stats 与引用告警 |

```bash
# drawio
curl -X POST localhost:3000/api/drawio \
  -H 'Content-Type: application/json' \
  -d "{\"source\": $(python3 -c 'import json;print(json.dumps(open("examples/demo.yaml").read()))')}" \
  -o atlas.drawio

# PNG @2x（zip，每个顶层领域一张）
curl -X POST localhost:3000/api/export \
  -H 'Content-Type: application/json' \
  -d '{"config": {...}, "scale": 2}' -o atlas.zip
```

zip 条目名用 UTF-8（general purpose bit 11），Finder / `ditto` / Windows / Linux 均可正确解压；macOS 自带的 `unzip` 会忽略该标志位而报 `Illegal byte sequence`，用 `ditto -x -k` 代替。

`/render?config=<urlencoded json>&domain=<顶层领域名>&theme=hearthstone` 是无编辑器 chrome 的纯净渲染页，一次渲染一个顶层领域的树，PNG 导出逐个访问它；`domain` 省略或不匹配时回退到第一个顶层领域。

## 主题扩展

主题是一组 token（`lib/themes/types.ts` 的 `ThemeTokens`），web 渲染与 drawio 导出共用同一份，因此加主题不需要碰组件：

1. 新建 `lib/themes/yours.ts`，导出满足 `ThemeTokens` 的对象（可 `...hearthstone` 继承几何再覆盖配色）
2. 在 `lib/themes/index.ts` 的 `themes` 里注册
3. 在 `lib/schema.ts` 的 `THEMES` 数组加上名字

`hearthstone` 是完整实现；`business`（扁平商务）与 `blueprint`（青蓝图纸）目前是继承 hearthstone 几何的配色 stub，可直接切换查看。

## 架构

```
lib/schema.ts      zod schema + 类型（Domain 递归通过 z.lazy）
lib/parser.ts      三格式识别与解析 + 交叉引用校验
lib/layout.ts      单个顶层领域 → 自上而下树布局（d3-hierarchy tree），输出画布绝对坐标
lib/avatar.ts      头像 fallback 链（sync 版给渲染，async 版给 file:// 与 base64 内联）
lib/md5.ts         gravatar 需要 MD5，WebCrypto 不提供，同构实现
lib/drawio.ts      mxGraph XML 生成（多 page）
lib/themes/        主题 token
components/Canvas  可拖拽缩放的画布容器（手写，无 pan/zoom 依赖）
components/        DomainTree → DomainCard → PersonCard / GapCard + LoanBadge
```

**画布容器**：树渲染在 `Canvas` 的世界坐标里，页面自身永不滚动（`AtlasEditor` 用 `fixed inset-0`，不给 `/render` 加 `overflow: hidden`，否则 puppeteer 元素截图会被视口裁切）。空白处拖拽平移、滚轮以光标为锚点缩放（0.2×~3×）、双击或右下角工具条 fit。卡片子树标记 `data-canvas-no-pan` 以保留自身的 hover / 点击；按住空格可无视该标记强制平移。Radix 会卸载非激活 tab，所以切 tab 天然重新挂载并重新 fit。

**一个顶层领域一张图**：`computeDomainTreeLayout(config, domain)` 只处理一个顶层领域，把它和递归的子领域排成自上而下的树，Web 端用 Tabs 切换，drawio 一个领域一个 page，PNG 一个领域一张。人员卡不进入树结构，作为领域节点的"内容附件"挂在节点内部的 grid 里。

布局产出画布绝对坐标，web 与 drawio 共用同一份几何，所以两种输出的排版一致。树节点在两端都是**平铺**的兄弟（不做空间嵌套），只有节点自身的卡片需要换算到节点局部坐标系——drawio 侧因为 mxGraph container 坐标本就相对，减去节点原点即可。

节点宽度随人员数变化，所以 d3 `tree()` 用 `nodeSize([1, 1])` 把 x 单位当像素，真实间距全部由 `separation` 表达（相邻兄弟 `nodeGapX`，堂兄弟 ×1.6）；每层 y 单独按该层最高节点累加，避免层高被最深的分支拉齐。

借调是跨图信号，所以不画跨 tab / 跨 page 箭头，改在人物卡右上角叠加徽章：橙色 `→ 目标领域 N%`（借出）、蓝色 `← 主属地 N%`（借入），领域名统一解析成 `displayName`。虚线样式因此空出来，领域→子领域连线用实线。

## 技术栈

Next.js 16（App Router，Turbopack 默认）· React 19 · TypeScript 严格模式 · Tailwind CSS 4 · shadcn/ui（New York）· framer-motion · zod 4 · js-yaml · @iarna/toml · puppeteer · d3-hierarchy · pnpm
