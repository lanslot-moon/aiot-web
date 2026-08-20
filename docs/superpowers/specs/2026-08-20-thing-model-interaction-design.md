# AIoT 物模型管理 — 交互设计规格（绑定本仓库）

> 状态：已审阅通过（2026-08-20）  
> 日期：2026-08-20  
> 范围：交互规格 only（不写业务代码）  
> 风格原则：保持 shadcn-dashboard-free 原框架风格不变  
> 上游依据：
>
> 1. `AGENTS.md` / `.agents/skills/shadcn-dashboard-free/SKILL.md`
> 2. `D:/CodeProject/Vue/shadcndashboard/docs/AIoT物模型管理后台UI交互文档.md`
> 3. `.grok/skills/interaction-design/SKILL.md`

本文件是源交互文档的**组件绑定层 + IxD 细化**，不替代 Java 正式接口契约。实现优先级与源文档一致：本仓库约定 > Java 正式接口 > 源交互文档 > Tuya 仅作模式借鉴。

### 接口字段硬约束（审阅追加）

- TypeScript 类型、mock data、MSW 请求/响应体必须与**当前 Java 正式接口**的 DTO/VO/Schema **字段一一对应**。
- **禁止**：前端自行新增字段、删减字段、改名、改类型、或为“好用”拼出后端没有的结构。
- **禁止**：为旧接口或猜测字段做双轨兼容。
- UI 仅展示/编辑正式契约已有字段；缺展示文案用标签映射，不改字段名。
- 写操作 body 只提交契约要求的字段；成功多为 Boolean 时，以重新 GET 的正式 VO 为准刷新 UI。

---

## 0. 设计决策摘要

| 决策 | 选择 | 理由 |
|------|------|------|
| 方案 | 源文档 IA + 组件绑定（方案 A） | 不偏离交接稿，也不另起视觉体系 |
| 页面壳 | `BreadcrumbComp` + 标题区 + `Card` | 对齐 Tickets / Tables |
| 表格 | TanStack 包装（`src/components/tables/` 模式） | AGENTS 约定 |
| 轻反馈 | `sonner` toast | 已有 ui/sonner |
| 危险确认 | `AlertDialog` | 禁止 `window.confirm` |
| 发布预检确认 | `Sheet`（右侧） | 摘要较长，适合抽屉 |
| 创建产品 | 整页 4 步向导 | 品类树 + 多步，Dialog 过挤 |
| 数据 | mock → MSW → SWR → context | 纯客户端 SPA |
| 表单库 | 不加 | 除非用户另行确认 |
| 视觉 | 不新造 token / 不引入 Tuya 视觉 | 沿用现有 Tailwind + shadcn |

**本期不做**：设备实例、遥测、命令运行时、OTA、规则引擎、租户侧品类 CRUD、Parser 失败样本管理页、`/internal/v1/**`。

---

## 1. 全局壳层与风格锚点

### 1.1 页面骨架

```text
BreadcrumbComp（物模型管理 / …）
标题行：标题 + 一句话说明 + 主操作 Button
筛选行：Input / Select / 刷新 Button（可选）
Card
  └── 表格 | 向导 | 工作区（Tabs）
```

### 1.2 组件绑定（优先用 `src/components/ui/` 现成 shadcn）

**原则**：物模型所有界面优先组合本仓库已有的 shadcn 原语；不新造平行 UI 库、不引入额外组件包。业务封装放在 `src/components/thing-model/`，内部只组装 `ui/*`。

仓库现有可用原语（按需取用，不限下列场景）：  
`accordion` · `alert` · `alert-dialog` · `badge` · `breadcrumb` · `button` · `button-group` · `card` · `checkbox` · `collapsible` · `combobox` · `command` · `dialog` · `drawer` · `dropdown-menu` · `empty` · `field` · `hover-card` · `input` · `input-group` · `label` · `pagination` · `popover` · `progress` · `radio-group` · `resizable` · `scroll-area` · `select` · `separator` · `sheet` · `skeleton` · `sonner` · `spinner` · `switch` · `table` · `tabs` · `textarea` · `toggle` · `toggle-group` · `tooltip` 等。

| 场景 | 使用的 shadcn / 现有封装 |
|------|--------------------------|
| 轻量成功/失败 | `sonner` toast（文案含对象名） |
| 危险确认（删/停用/废弃/丢弃草稿） | `alert-dialog` |
| 发布预检与较长摘要 | `sheet`（右侧）；摘要短也可用 `dialog` |
| 短表单编辑（元数据等） | `dialog` |
| 创建产品四步 | 整页向导；步骤内用 `card` + `field`/`input`/`select`/`radio-group`/`checkbox`/`textarea` |
| 品类树搜索 | `scroll-area` + `input`；可选 `command` 做快速过滤 |
| 按钮进行中 | `button` loading + `spinner`，禁重复点 |
| 首屏/表加载 | `skeleton`（列布局稳定） |
| 空态 | `empty` + 主操作 `button` |
| 页级/块级错误 | `alert`（错误码 + trace + 重试） |
| 生命周期/草稿状态 | `badge` + 文字（+ lucide 图标），不只靠颜色 |
| 行内更多操作 | `dropdown-menu` |
| 工作区 / 能力分组切换 | `tabs` |
| 禁用原因、ID 复制提示 | `tooltip` |
| 筛选区 | `input` + `select`/`combobox` + `button` |
| 表格 | `table`  primitives，或 `src/components/tables/` 的 TanStack 包装 |
| 左右分栏编辑器 | `resizable` + `scroll-area`（物模型表 | Schema） |
| 校验/测试进度 | `progress` 或按钮内 `spinner` |
| 开关类（rawMessage、失败样本等） | `switch` / `checkbox` |
| Profile 映射行折叠 codec | `collapsible` / `accordion` |
| 面包屑 | 页面级继续用现有 `BreadcrumbComp`；需要细粒度时可用 `ui/breadcrumb` |

扩展方式：缺交互时**先查 `ui/` 是否已有**，用组合解决；只有全局能力缺口时才改 `ui/` 原语。

### 1.3 全局可见性

- 生命周期始终可见：`DRAFT` / `PUBLISHED` / `DISABLED` / `DEPRECATED`
- 不可用动作：`disabled` + Tooltip 原因，或按策略隐藏（见 §3）
- Product ID / Profile ID / Policy ID / Category Code 支持复制
- 密钥、secret、租户内部标识：不展示、不进 URL、不进 localStorage

### 1.4 Motion

| 类型 | 时长 |
|------|------|
| 按钮状态 | 100–150ms |
| 下拉 / Tooltip / 小面板 | 150–200ms |
| Dialog / Drawer / Sheet | 200–300ms |
| 页面导航 | 250–400ms |

尊重 `prefers-reduced-motion`。动画只表达状态与层级，不拖慢操作。

### 1.5 响应时间

| 时长 | UI |
|------|-----|
| 0–100ms | pressed/active |
| 100ms–1s | spinner / 局部 loading |
| 1–10s | 明确等待态 |
| >10s | 避免阻塞；可提示稍后刷新 |

### 1.6 落点（与 AGENTS 对齐）

| 用途 | 路径 |
|------|------|
| 页面 | `src/views/apps/thing-model/`（或 `src/views/thing-model/`，实现时与 sibling 一致） |
| 组件 | `src/components/thing-model/` |
| mock | `src/api/thing-model/` |
| MSW | `src/api/mocks/handlers/mock-handlers.ts` |
| context | `src/context/thing-model-context/` |
| 类型 | `src/types/apps/thing-model.ts` |
| 路由 | `src/routes/Router.tsx`（lazy + Loadable） |
| 侧边栏 | `src/layouts/full/vertical/sidebar/sidebaritems.ts` |

### 1.7 建议路由（前端 IA，非后端路径）

```text
物模型管理
├── 产品                         /thing-model/products
│   ├── 创建                     /thing-model/products/new
│   └── 工作区                   /thing-model/products/:productId
│       ├── 概览                 /overview
│       ├── 物模型               /model
│       ├── 连接配置             /connection
│       └── 版本历史             /versions
├── Parser/Encoder Profile       /thing-model/parser-profiles
│   └── 工作区                   /thing-model/parser-profiles/:profileId
└── Data Policy                  /thing-model/data-policies
    └── 详情                     /thing-model/data-policies/:policyId
```

不注册：`/thing-model/categories`、`/admin/categories`、`/parser-failure-samples`。  
品类仅在创建向导 / 品类升级中以内嵌选择器出现。

---

## 2. 产品列表 + 创建向导

### 2.1 产品列表

**入口**：侧边栏「物模型管理 / 产品」→ `/thing-model/products`

**结构**

| 区域 | 内容 |
|------|------|
| 标题 | 「产品」+「管理产品连接契约、物模型版本和生命周期。」 |
| 主操作 | 「创建产品」→ `/products/new` |
| 筛选 | 搜索名称/型号、生命周期、刷新 |
| 列 | 产品、Product ID、品类、数据模式、连接方式、当前模型、生命周期、更新时间、操作 |

**行级交互**

```text
点产品名称 → /products/:id/overview
点 Product ID 旁复制 → toast「已复制 Product ID」
操作列 DropdownMenu → 按生命周期过滤动作
```

**操作菜单**

| 状态 | 菜单项 |
|------|--------|
| DRAFT | 详情、编辑、发布、删除 |
| PUBLISHED | 详情、物模型、停用、废弃 |
| DISABLED | 详情、物模型、恢复、废弃 |
| DEPRECATED | 详情、版本历史 |

**列表五态**

| 状态 | UI | 恢复 |
|------|-----|------|
| Skeleton | 稳定列骨架 | — |
| 无产品 | Empty +「创建产品」 | 创建 |
| 无筛选结果 | Empty +「清除筛选」 | 清筛选 |
| 错误 | Alert：错误码 + trace ID | 重试 |
| 加载更多 | 底部 Spinner，不重置已加载 | cursor 透传 |

**Cursor**：首页无 cursor；筛选变化清空 cursor；默认 `pageSize=20`。

### 2.2 创建产品向导（整页）

路由：`/thing-model/products/new`

```text
① 选择品类 → ② 产品信息 → ③ 连接配置 → ④ 确认创建
```

- 可回退，不丢数据；不可跳过未完成步骤
- 每步「下一步」前前端预检

#### Step 1 品类

- 左：树 + 搜索；右：名称、父路径、是否叶子、模板版本、能力摘要
- 仅叶子可选；非叶子只能展开
- 无品类 CRUD
- 平铺 list 按 `parentCode` 建树
- 明示：「品类和目录版本创建后不可更改」

#### Step 2 产品信息

| 字段 | 规则 |
|------|------|
| productName | 必填 |
| categoryCode | 只读（来自 Step 1） |
| productModel / manufacturer | 可选，max 128 |
| description | 可选，max 2048 |
| iconUrl | 可选，URL/OSS/相对路径 |

校验：blur + 下一步。

#### Step 3 连接配置

渐进披露：

| 条件 | 显示 |
|------|------|
| authModes 含 CUSTOM | customAuthProviderId |
| dataMode = CUSTOM_PAYLOAD | Profile 选择器（仅已发布） |
| 无已发布 Profile | 阻断 CUSTOM_PAYLOAD 预检 |
| topicTemplates | 可增删键值行 |
| secret | 永不展示 |

#### Step 4 确认 + 提交

```text
点「创建产品」→ 立即 Loading，禁重复提交
  → POST /api/v1/products
  → 成功 Boolean：重新 GET 列表；toast「产品已提交成功」
  → 无结构化 productId 前：不猜 ID、不强制进工作区
  → 若正式返回 productId/ProductVO：可提供「进入工作区」
  → 失败：保留四步数据 + 错误映射
```

离开保护：Step 2–4 有改动时拦截刷新/路由离开。

---

## 3. 产品工作区与生命周期

### 3.1 壳层

```text
Breadcrumb：物模型管理 / 产品 / {名称}

头部 Card：
  名称 · 型号 · Product ID [复制]
  品类 · 数据模式 · modelRevision · Profile
  生命周期 Badge
  [编辑产品] [发布产品] [更多 ▼]

Tabs：概览 | 物模型 | 连接配置 | 版本历史
```

- 整页首次：头部 + tabs skeleton
- 切页签：仅内容区 loading，头部保持
- 404：Alert + 回列表
- 跳转 Profile/Policy：独立路由，不虚构嵌套 REST

### 3.2 动作矩阵

| 状态 | 基本信息/连接 | 物模型草稿 | 发布 | 停用 | 恢复 | 废弃 | 删除 |
|------|---------------|------------|------|------|------|------|------|
| DRAFT | 可编辑 | 可编辑 | ✓ | — | — | — | ✓ |
| PUBLISHED | 只读 | 可编辑 | — | ✓ | — | ✓ | — |
| DISABLED | 只读 | 可编辑 | — | — | ✓ | ✓ | — |
| DEPRECATED | 只读 | 只读 | — | — | — | — | — |

**禁用策略（定稿）**  
主按钮区只放当前主路径；「更多」按状态过滤。对「差一步即可用」的动作可保留 disabled + Tooltip；终态无关动作隐藏。

### 3.3 产品发布

```text
点「发布产品」（仅 DRAFT）
  → POST /publish/validate
  → Sheet 展示摘要（不伪造完整绿勾清单）
  → 确认 → POST /publish（带 version）
  → 重新 GET ProductVO → Badge 更新 → toast
```

Sheet 必须包含：模型 revision 情况、连接完整性、品类模板、CUSTOM_PAYLOAD Profile、**「发布后连接配置将锁定」**、脚注「最终以服务端为准」。

### 3.4 危险动作（AlertDialog）

| 动作 | 文案要点 |
|------|----------|
| 删除 | 点名产品；仅 DRAFT；不再出现在列表 |
| 停用 | 停新注册/凭证；可恢复 |
| 恢复 | 回到已发布 |
| 废弃 | 终态不可恢复；历史只读保留 |

确认钮：destructive + 立即 Loading；成功后重新 GET。

### 3.5 编辑与连接

- DRAFT：概览/连接可编辑；PUT + version；成功后 GET
- PUBLISHED/DISABLED：连接只读，文案说明已锁定
- 412：保留本地；「加载最新」/「保留本地再提交」
- 脏数据离开拦截

### 3.6 概览页签

只读摘要 + 快捷链到物模型 / Profile / Policy；不做第二套编辑器。

---

## 4. 物模型编辑器

### 4.1 布局

```text
工具条：草稿 Badge [DRAFT|VALIDATED] · version
  [保存草稿] [校验] [发布新版本] [丢弃草稿] [版本历史] [品类升级]

Tabs：Property | Action | Event

左能力表 | 右详情 + Schema（基础构建器 | JSON）+ 校验结果
```

DEPRECATED 产品或历史快照：全页只读。

### 4.2 能力表

| Tab | 关键列 |
|-----|--------|
| Property | code、名称、access、schema 类型、required、状态 |
| Action | code、名称、invokeMode、输入/输出 Schema、状态 |
| Event | code、名称、eventType、输出 Schema、状态 |

规则：

- code：`^[A-Za-z][A-Za-z0-9_]*$`；已有 code 不可改
- 新增先进本地草稿；未保存标记「未保存」
- 不显示未提供的「标准/自定义」来源
- 禁止 dpId/厂商号当 code
- 删行：AlertDialog 点名 code → 改本地定义，需保存草稿落库

左右联动：切换行前若右侧脏 → 提示先应用或放弃。

### 4.3 Schema 双视图

- 构建器 ↔ JSON 同一数据源
- JSON → 构建器：先 parse；失败不切换、定位错误、保留文本
- 不把 IoT 元数据伪装成 JSON Schema 关键字
- 校验错误树可点击定位；失败不清空编辑

### 4.4 草稿动作

**保存**

```text
PUT /model { version, definition 完整替换 }
  → GET 草稿 → Badge DRAFT → 校验结果标记过期 → toast
```

**校验**

```text
POST /model/validate
  → true：VALIDATED，启用发布
  → false：错误树，保留编辑
```

**发布新版本**

```text
仅 VALIDATED → 二次确认（Sheet 或 AlertDialog）
  → POST /model/publish { version }
  → GET 草稿/已发布/版本列表 → 展示新 modelRevision
```

**丢弃草稿**

```text
AlertDialog「当前草稿内容将被丢弃」→ DELETE /model → 重新 GET
```

### 4.5 品类升级

```text
选目标已发布模板版本
  → GET category-diff
  → 必选锁定勾选；可选用户勾选
  → POST category-merge（正式 version 契约，无兼容双轨）
  → GET 草稿 → DRAFT → toast「请重新校验后再发布」
```

语义：只追加本产品草稿；不改平台品类/其他产品；不覆盖已有自定义能力。  
若 Java 参数错误未修：可进入 UI，提交前显示阻塞，不写兼容层。

### 4.6 版本历史 / 差异 / 回滚

| 操作 | 行为 |
|------|------|
| 查看 | 只读快照 |
| 比较 | POST /diff → added/removed/modified |
| 回滚 | 确认「历史不被覆盖，生成新草稿」→ POST /rollback → 须再校验发布 |
| 废弃 revision | 仅产品已废弃后 |

**回滚 ≠ 重新上线。**

### 4.7 关键控件状态

| 控件 | Disabled 条件 | Success |
|------|---------------|---------|
| 保存草稿 | 无脏数据 / DEPRECATED | toast + 清脏 |
| 校验 | 无草稿 | VALIDATED |
| 发布新版本 | 非 VALIDATED | 新 revision |
| 丢弃草稿 | 无服务端草稿 | 清空编辑器 |
| JSON→构建器 | JSON 非法 | 切换成功 |

脏数据：Tab 间不丢；路由离开拦截；失败不清空。

---

## 5. Parser Profile + Data Policy + 全局规则

### 5.1 Parser / Encoder Profile

**列表**：名称、Profile ID、协议、当前版本、更新时间、状态、操作  
主操作：创建、进工作区、编辑元数据、删除

**版本状态**

| 状态 | 行为 |
|------|------|
| DRAFT | 可编辑、校验、发布 |
| PUBLISHED | 只读；可测试、查看 |
| DEPRECATED | 只读历史 |

**映射编辑器**：行内 vendor field、platform capability code、type、sourcePath、direction、scale、offset；codec JSON 在侧栏/折叠区。  
行级新增/复制/删除；code 选择器优先当前产品能力；保存为版本 mapping 整体替换。

**模拟测试**

```text
左：方向、Payload JSON、保存失败样本开关、[运行测试]
右：success / mapped / issues / unparsedFields / failureSampleId
```

文案必须标明：**无副作用模拟，不是真实设备消息已发送**。  
只展示 `failureSampleId`，不建失败样本管理页。

### 5.2 Data Policy

**列表列**：作用域、产品、遥测留存、原始报文、规则、更新时间、操作  
筛选：scopeType、productId

**表单**

| 条件 | 行为 |
|------|------|
| scopeType = PRODUCT | 显示产品选择器，productId 必填 |
| rawMessage.enabled = false | retentionDays / maxSizeBytes 隐藏或 disabled |
| rawMessage.enabled = true | 显示并校验正整数 |

删除产品策略确认文案：「删除后该产品将回退到租户默认策略。」  
scopeType 使用正式契约，不依赖空值回退猜测。

### 5.3 统一错误映射

文案三问：**发生了什么 / 为什么 / 下一步做什么**

| 状态 | 处理 |
|------|------|
| 400 | 保留输入，定位字段/Schema |
| 401 | 提示登录/权限，不清空表单 |
| 404 | 关详情或刷父列表 |
| 409 | 重新 GET，解释冲突 |
| 412 | 保留本地；「加载最新」/「保留本地」 |
| 500 | trace ID + 重试 |

Trace：优先响应头 `X-Requested-Id`。

### 5.4 乐观锁

每个可写资源持有服务端 `version`。412 时不自动覆盖、不静默丢输入。

### 5.5 写成功后刷新

多数写接口返回 Boolean → **必须重新 GET** 再更新 UI；禁止猜 ID、禁止双轨兼容。

### 5.6 实现顺序（交互验收对应）

1. Phase 1：类型 / mock / MSW / context / 共享 Badge·错误面板·复制  
2. Phase 2：产品列表、创建向导、工作区壳、状态动作  
3. Phase 3：物模型表、Schema、校验发布、历史差异回滚、品类升级  
4. Phase 4：Profile 映射与模拟测试  
5. Phase 5：Data Policy  
6. Phase 6：`npm run build` + `npm run lint`；深链刷新、主题、窄屏表、键盘 focus、reduced-motion  

---

## 6. 微交互速查（Trigger → Rules → Feedback）

| 场景 | Trigger | Rules | Feedback |
|------|---------|-------|----------|
| 复制 ID | 点复制 | clipboard.write | toast 已复制 |
| 创建产品 | 点创建 | POST + 禁重复 | Loading → 列表刷新 / 错误保留向导 |
| 发布产品 | 点发布 | validate → Sheet → publish | Badge 变 PUBLISHED |
| 保存模型草稿 | 点保存 | PUT 整表替换 | DRAFT + 校验过期 |
| 校验模型 | 点校验 | POST validate | 成功启发布 / 失败错误树 |
| 发布模型 | 点发布新版本 | 需 VALIDATED | 新 revision |
| 回滚 | 点回滚 | 确认后 POST | 新 DRAFT，提示再校验 |
| 模拟测试 | 点运行测试 | 无副作用 POST | 右侧结果面板 |

---

## 7. 与源文档的差异（明确记录）

| 点 | 本规格选择 |
|----|------------|
| 发布确认容器 | 统一倾向 `Sheet`（产品发布）；模型发布可用 Sheet 或 AlertDialog（摘要短时 Dialog 亦可） |
| 创建成功跳转 | 无 productId 时留在列表；有则可选进工作区 |
| 禁用菜单策略 | 主路径精简 + 更多按状态过滤；差一步项可 disabled+原因 |
| validate 清单 | 不伪造；有结构化才展示 |
| 页面目录名 | 实现时与 `views/apps/*` sibling 对齐，推荐 `views/apps/thing-model/` |

其余 IA、生命周期、API 动作与源文档保持一致。

---

## 8. 开放阻塞（实现前需确认，前端不写兼容）

摘自源文档 §8，交互侧对待方式：

| 级别 | 问题 | UI 态度 |
|------|------|---------|
| P0 | 无草稿 200+null vs 404 | 选定一种后实现单一分支 |
| P0 | categoryMerge version 传参错误 | 修复前可展示阻塞，不双轨 |
| P1 | 写接口 Boolean | 成功后一律重新 GET |
| P1 | 创建幂等不透明 | toast 中性文案，不猜新 ID |
| P1 | publish validate 非结构化 | Sheet 诚实展示，不造清单 |

---

## 9. 审阅清单

- [x] 全局组件绑定与风格锚点可接受  
- [x] 产品列表 / 向导 / 工作区 / 物模型编辑器交互可接受  
- [x] Profile / Policy / 错误与 412 规则可接受  
- [x] 接口字段必须与当前 Java 正式契约一一对应（不增不减）  
- [x] 已进入实现计划：`docs/superpowers/plans/2026-08-20-thing-model-implementation.md`
