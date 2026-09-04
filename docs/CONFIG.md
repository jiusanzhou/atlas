# 配置字段参考

Atlas 的一切渲染都来自一份配置。格式支持 **YAML / JSON / TOML**，三者字段完全等价，Atlas 会自动识别用的是哪一种（也可以在调 API 时显式指定）。

顶层结构：

```yaml
meta:      # 可选，标题与描述
theme:     # 可选，默认 hearthstone
domains:   # 必填，至少一个顶层领域
people:    # 必填，可以是空数组
```

> 约定：下表中「必填」指该字段缺失会导致校验失败；标注默认值的字段可以省略。

- [顶层：Config](#顶层config)
- [meta](#meta)
- [Domain（领域）](#domain领域)
- [Person（人）](#person人)
- [Gap（缺口）](#gap缺口)
- [Loan（借调）](#loan借调)
- [枚举取值](#枚举取值)
- [按能力查用法](#按能力查用法)
- [校验规则与报错](#校验规则与报错)

---

## 顶层：Config

| 字段 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `meta` | object | 否 | — | 标题与描述，见 [meta](#meta)。也决定导出文件名 |
| `theme` | enum | 否 | `hearthstone` | `hearthstone` 或 `minimal`，见[枚举取值](#枚举取值) |
| `domains` | Domain[] | **是** | — | 至少一个。每个**顶层**领域在 Web 上是一个 tab、导出时是一页 |
| `people` | Person[] | **是** | — | 全量人员名册。可以为 `[]`，但字段本身必须存在 |

最小可用配置：

```yaml
domains:
  - name: infra
    lead: torvalds

people:
  - id: torvalds
    name: Linus Torvalds
```

## meta

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `title` | string | 否 | 显示在页面顶部；也用作导出文件名（`{title}.drawio` / `{title}.zip`） |
| `description` | string | 否 | 备注用途，当前不参与渲染 |
| `version` | string | 否 | 自己的配置版本号，建议写成字符串（`"1.0.0"`，不加引号会被 YAML 读成数字） |

```yaml
meta:
  title: 技术中台组织架构
  description: 基础设施、应用平台与数据三大方向
  version: "1.5.0"
```

## Domain（领域）

领域可以无限层嵌套（`subdomains`）。**顶层领域**比较特殊：它决定 tab 数量、drawio 的 page 数量、PNG 的图片数量。

| 字段 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `name` | string | **是** | — | 唯一标识，被 `lead` / `members` / `homeDomain` / `lendTo.domain` 引用。非空 |
| `displayName` | string | 否 | 回落到 `name` | 界面上显示的名字，适合写中文 |
| `lead` | string | 否 | — | 负责人的 person `id`。**与 `leadGap` 互斥** |
| `leadGap` | Gap | 否 | — | 负责人**空缺**（等招）。**与 `lead` 互斥** |
| `members` | string[] | 否 | `[]` | 核心成员的 person `id` 列表 |
| `gaps` | Gap[] | 否 | `[]` | 成员缺口列表 |
| `subdomains` | Domain[] | 否 | `[]` | 子领域，结构与本表相同，可继续嵌套 |
| `color` | string | 否 | 主题色 | 领域框与标题条颜色，任意 CSS 颜色（如 `"#4a3113"`） |
| `description` | string | 否 | — | 领域说明 |

```yaml
domains:
  - name: infra
    displayName: 基础设施
    lead: torvalds
    members: [pcarrier]
    color: "#4a3113"
    description: 内核、网络、计算与存储底座
    subdomains:
      - name: compute
        displayName: 计算与调度
        lead: gvanrossum
```

### 卡片排列顺序

一个领域内的卡片顺序是固定的，便于快速扫读：

**负责人（真人或缺口）→ 成员真人 → 借调进来的人 → 成员缺口**

## Person（人）

| 字段 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | string | **是** | — | 唯一标识，被领域的 `lead` / `members` 引用。非空 |
| `name` | string | **是** | — | 显示名。非空 |
| `title` | string | 否 | — | 职位/头衔，显示在名字下方 |
| `homeDomain` | string | 否 | — | 主属地领域的 `name`。**决定借调徽章的方向**，见下方说明 |
| `avatar` | string | 否 | 首字母头像 | 头像来源，见[头像来源](#头像来源) |
| `tags` | string[] | 否 | `[]` | 技能标签，卡面最多显示 3 个 |
| `rarity` | enum | 否 | 自动推断 | 卡框稀有度，见[枚举取值](#枚举取值) |
| `lendTo` | Loan[] | 否 | `[]` | 借调去向，见 [Loan](#loan借调) |
| `comment` | string | 否 | — | **Markdown** 备注。有备注的卡会带小圆点，点击翻卡（minimal 主题下走 hover 浮层） |

```yaml
people:
  - id: torvalds
    name: Linus Torvalds
    title: 首席架构师
    homeDomain: infra
    avatar: github:torvalds
    tags: [Kernel, C, 分布式]
    rarity: legendary
    comment: |
      **强项**：内核方向的定海神针。

      - RISC-V 生态跟进
      - 内核可观测性建设
```

### homeDomain 决定借调方向

`homeDomain` 不只是备注，它决定借调怎么画：

- 在 `homeDomain` 这个领域里，此人的卡显示**橙色借出徽章** `→ 目标领域 40%`
- 在被借调到的领域里，同一个人**再出现一次**，显示**蓝色借入徽章** `← 主属地 40%`
- **不写 `homeDomain`**：只会在被借调的领域出现，徽章写成 `← 外部`

一个人在多个领域重复出现是**设计如此**（主属地 + 借调领域各一张），不是 bug。

### rarity 自动推断

不写 `rarity` 时按顺序判断：`lead` → `legendary`；有 `lendTo` → `epic`；`tags` ≥ 3 个 → `rare`；其余 → `common`。

## Gap（缺口）

同一个结构用在两处：领域的 `gaps[]`（成员缺口）和 `leadGap`（负责人缺口）。

| 字段 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| `role` | string | **是** | — | 缺的是什么角色，如 `SRE 工程师`。非空 |
| `count` | int | 否 | `1` | 缺几个人。必须是正整数；`> 1` 时卡面显示 `×N` |
| `priority` | enum | **是** | — | 优先级，决定角标颜色，见[枚举取值](#枚举取值) |
| `note` | string | 否 | — | 一句话说明，纯文本 |
| `comment` | string | 否 | — | **Markdown** 招聘要求，翻卡可见 |

缺口卡长得像"一个空位的人"：虚线框 + 虚线人形剪影 + 优先级色点。

```yaml
gaps:
  - role: SRE 工程师
    count: 2
    priority: high
    note: 支撑多活容灾演练
    comment: |
      **岗位要求**

      - 3+ 年大规模集群 SRE 经验
      - 熟悉 Kubernetes / Prometheus
```

> 页面顶部和 tab 上的「缺 N」统计的是 `count` 之和（含 `leadGap` 与所有子领域）。

## Loan（借调）

写在 person 的 `lendTo[]` 下，表示这个人被借调到别的领域。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `domain` | string | **是** | 借调目标领域的 `name`。非空 |
| `ratio` | number | **是** | 投入比例，`0`–`1`（`0.3` 即 30%） |
| `role` | string | 否 | 在目标领域做什么 |

```yaml
people:
  - id: antirez
    name: Salvatore Sanfilippo
    homeDomain: storage
    lendTo:
      - domain: streaming
        ratio: 0.3
        role: 实时存储选型
```

### 什么时候画虚线箭头

- **同一张图内**（借出方和借入方都在当前这棵树里）：画虚线箭头，带比例标注
- **跨图**（目标领域属于另一个顶层领域）：**不画**跨 tab / 跨 page 的箭头，只在卡片角上留徽章

这是刻意的：跨图连线在 drawio 里没法表达，视觉上也只会变成一团乱麻。

## 枚举取值

### theme

| 值 | 说明 |
| --- | --- |
| `hearthstone` | 默认。炉石风格重卡片：头像环、稀有度卡框、标签、翻卡看备注 |
| `minimal` | 极简：只有头像 + 名字，细节走 hover 浮层。卡片小 2.4 倍，适合人多的大图 |

早期版本里的 `business` / `blueprint` 是未完成的配色 stub，v1.6 已从可选列表移除。**旧配置写了这两个值不会报错**，会自动回落到 `hearthstone`。写错成 `hearthston` 这类拼写错误仍然会报错。

### priority（缺口优先级）

| 值 | 显示 | 颜色 |
| --- | --- | --- |
| `critical` | 紧急 | 红 |
| `high` | 高 | 橙 |
| `medium` | 中 | 黄 |
| `low` | 低 | 灰 |

### rarity（卡框稀有度）

| 值 | 显示 | 卡框 |
| --- | --- | --- |
| `legendary` | 传说 | 橙金 |
| `epic` | 史诗 | 紫 |
| `rare` | 稀有 | 蓝 |
| `common` | 普通 | 灰 |

## 头像来源

`avatar` 字段支持这些写法，都不需要配置图片域名白名单：

| 写法 | 示例 | 说明 |
| --- | --- | --- |
| `github:用户名` | `github:torvalds` | 取 GitHub 头像 |
| `gravatar:邮箱` | `gravatar:a@example.com` | 按邮箱 MD5 取 Gravatar，无图时用 identicon |
| `dicebear:风格` | `dicebear:bottts` | DiceBear 生成头像，以 person `id` 为种子 |
| `https://` / `http://` | `https://example.com/a.png` | 直接给 URL |
| `data:` | `data:image/png;base64,...` | 内联图片 |
| `file://相对路径` | `file://avatars/zoe.png` | 相对 `examples/` 目录读取。**仅服务端**，且不允许 `../` 越出该目录 |
| `initials` 或省略 | — | 用名字首字母生成 SVG 头像（中文取一个字），颜色由名字哈希决定 |

任何一种来源取不到图，都会退回首字母头像 —— 卡片不会出现破图。

## 校验规则与报错

### 会导致校验失败的（红色，图不渲染）

- 缺必填字段：`domains[0].name`、`people[0].id`、`gaps[0].role`、`gaps[0].priority` 等
- 必填字符串写成空串
- `domains` 是空数组
- 同一个领域同时写了 `lead` 和 `leadGap` → `domains[0].leadGap: lead 与 leadGap 只能填一个`
- `count` 不是正整数、`ratio` 超出 `0`–`1`、枚举值拼错
- YAML / JSON / TOML 语法错误 —— 会报**具体行号**，如 `YAML 语法错误（第 4 行）`

报错按 `字段路径: 原因` 列出，数组下标用方括号（`domains[1].gaps[0].priority`），一次最多显示 5 条。

### 只是告警的（黄色，图照常渲染）

引用对不上时给告警，不阻塞渲染，方便边写边看：

- `lead` / `members` 里的 id 不在 `people` 里
- `homeDomain` / `lendTo.domain` 指向不存在的领域
- person `id` 重复、领域 `name` 重复

## 按能力查用法

### 标注负责人缺口（这个领域还没人 lead）

把 `lead` 换成 `leadGap`。两者互斥，不能同时写。

```yaml
- name: mobile
  displayName: 移动端
  leadGap:
    role: 移动端负责人
    priority: critical
    note: 缺 5+ 年 iOS 深度经验
    comment: |
      **岗位要求**

      - 5+ 年 iOS/Android 一线开发
      - 熟悉热更新 / 灰度发布

      > 目前由 dhh 代管，最迟 Q3 需到位。
  members: [jeresig]
```

负责人缺口会占据负责人的位置，带虚线王冠。

### 标注成员缺口

```yaml
- name: compute
  lead: gvanrossum
  gaps:
    - role: SRE 工程师
      count: 2
      priority: high
```

### 写借调

在**被借出的人**身上写 `lendTo`，同时给他 `homeDomain`，方向才完整。

```yaml
people:
  - id: yyx990803
    name: Evan You
    homeDomain: web          # 主属地
    lendTo:
      - domain: devex        # 借到哪
        ratio: 0.2           # 20%
        role: 构建工具链
```

### 加 Markdown 备注

`comment` 支持 GFM：粗体、列表、表格、删除线、行内代码、引用块。YAML 里用 `|` 保留换行。

```yaml
comment: |
  **必须具备**

  | 方向 | 要求 |
  | --- | --- |
  | 纠删码 | Reed-Solomon 工程经验 |
  | 一致性 | Raft / Paxos 实现级理解 |

  ~~可接受纯理论背景~~ —— 需要能直接下场写引擎。
```

人和缺口都能写 `comment`。hearthstone 主题下点卡片翻面看，minimal 主题下 hover 出浮层（点一下可以钉住，Esc 关闭）。

### 深层嵌套领域

`subdomains` 可以一直套下去：

```yaml
- name: infra
  subdomains:
    - name: storage
      lead: antirez
      subdomains:
        - name: objectstore
          lead: bcantrill
        - name: blockstore
          lead: kelseyhightower
```

### 换主题

配置里写 `theme`，或者直接用界面右上角的切换器（会记在 localStorage，优先级高于配置里的值）。

```yaml
theme: minimal
```

---

完整可运行的示例见仓库里的 [`examples/demo.yaml`](../examples/demo.yaml)。
