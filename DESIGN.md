---
version: alpha
name: "AIoT Open Platform Console"
description: "A restrained shadcn dashboard for managing Project-scoped products, members, and API authorization."
colors:
  primary: "oklch(0.205 0 0)"
  primary-foreground: "oklch(0.985 0 0)"
  background: "oklch(1 0 0)"
  foreground: "oklch(0.145 0 0)"
  card: "oklch(1 0 0)"
  card-foreground: "oklch(0.145 0 0)"
  muted: "oklch(0.97 0 0)"
  muted-foreground: "oklch(0.556 0 0)"
  border: "oklch(0.922 0 0)"
  destructive: "oklch(0.577 0.245 27.325)"
typography:
  sans:
    fontFamily: "Geist, system-ui, sans-serif"
  mono:
    fontFamily: "Geist Mono, ui-monospace, monospace"
rounded:
  DEFAULT: "8px"
  sm: "6px"
  md: "8px"
  lg: "12px"
spacing:
  card-padding: "1rem"
  surface-gap: "1rem"
  page-max: "1410px"
components:
  button:
    backgroundColor: primary
    textColor: primary-foreground
    rounded: DEFAULT
    height: "28px"
  card:
    backgroundColor: card
    textColor: card-foreground
    rounded: lg
    padding: "1rem"
  navigation:
    backgroundColor: muted
    textColor: muted-foreground
    rounded: sm
  status:
    backgroundColor: background
    textColor: foreground
    rounded: sm
  separator:
    backgroundColor: border
---

# AIoT Open Platform Console Design System

## Overview

### Creative North Star

The console should feel like a calm developer workbench: the visual language is the quiet, information-dense surface of a cloud control plane, with hierarchy coming from spacing, tonal layers, and short labels rather than decorative panels.

### Product context and register

- **Audience and primary job:** Developers and project administrators manage products, Project members, and API access with low ambiguity.
- **Target market(s) and evidence:** The current repository documents a Project-scoped AIoT open platform and uses Chinese UI copy for the target workflow.
- **Locale(s) and language policy:** The current open-platform surface is Simplified Chinese; domain labels remain consistent with the IAM interaction document.
- **Usage scene:** Desktop-first administration with responsive reflow for smaller screens; users scan status and move into a focused management route.
- **Register:** Product UI, not marketing. Familiar shadcn dashboard patterns take priority over visual novelty.
- **Memorable signature:** A compact Project workspace shell with navigation scoped to the current Project in the sidebar and stacked summary cards that keep the primary task visible.
- **Restraint:** Keep security and membership actions text-led, use icons as alignment cues, and avoid decorative gradients or extra metrics that compete with the current task.
- **Anti-references:** Do not resemble a marketing landing page, a dashboard full of unrelated KPI tiles, or a settings page that repeats Project identity fields already visible in the workspace header.
- **Token ownership/runtime mapping:** Runtime CSS in `src/css/globals.css` and the shared `src/components/ui/*` primitives remain canonical. This file mirrors their accepted values; feature work should use semantic Tailwind utilities and shared primitives rather than adding screen-local tokens.

## Colors

The light theme uses near-black primary text/actions on a white canvas, with muted gray surfaces for navigation and secondary information. `primary`, `background`, `foreground`, `muted`, `muted-foreground`, and `border` mirror the CSS variables in `src/css/globals.css`. Destructive actions use the existing red semantic token and are reserved for irreversible lifecycle operations. Dark mode remaps the same semantic roles without changing hierarchy.

## Typography

Geist is the body and control face, with Geist Mono for IDs, keys, and technical values. Body copy stays compact and readable; labels are short and sentence-like in Chinese. Numeric counts use tabular figures where comparison matters. The font stack retains system fallbacks so mixed Chinese and Latin labels do not shift layout unexpectedly.

## Layout

The application uses the existing dashboard shell and a 1410px content measure. IAM Project pages reuse the original ProjectWorkspaceShell header in sidebar mode; the shared sidebar owns project destinations with permission filtering. The header Project switcher and account sheet remain available in both contexts. IAM settings uses the same sidebar without a second horizontal navigation strip. Detail summaries use natural content height and compact label/value rows. At narrow widths, the existing sidebar becomes an overlay drawer and the Project switcher remains visible. Legacy product screens retain their existing horizontal navigation until their business service is integrated.

## Elevation & Depth

Cards use the shared low-contrast foreground ring and tonal surfaces rather than large shadows. The active navigation item is distinguished by a background surface and text weight. Overlays and dialogs use the shared primitives. Static content should not gain a bespoke shadow merely to fill whitespace.

## Shapes

Cards use the shared 12px rounded container; buttons use the shared 8px control radius with smaller maintained variants. Dividers remain thin and neutral. Icons are compact stroke icons aligned to the text baseline, never the only carrier of meaning.

## Components

### Foundational visual states

Use the shared Button, Card, Badge, Skeleton, Alert, Dialog, and Sheet primitives. Enabled actions have hover, active, and visible focus states from the shared recipes; loading keeps the control footprint stable; errors remain scoped to the card or action that failed; empty states explain the next action.

### Buttons and actions

Use solid buttons for the primary safe action and outline/secondary buttons for navigation or utility actions. Navigation uses a real Link rendered through the shared Button primitive. Labels name the result, such as “管理成员”, and permission-sensitive operations must still be enforced by the server.

### Navigation and data display

The original ProjectWorkspaceShell owns project identity headers; IAM pages compose it in sidebar navigation mode. The sidebar owns IAM project destinations; do not repeat these links as overview tiles or horizontal tabs. The horizontal cloud-development navigation MUST retain categories, products, parser profiles and devices on IAM screens; thing-model management remains accessible through products. Removing duplicated IAM links must never hide distinct business capabilities. The overview retains project description, update time and the current membership from ProjectDetailVO in a compact summary. Project ID, status and creation time remain in the shared header. Editing and lifecycle actions belong to settings, while API authorization stays on its dedicated route. Legacy product screens retain their existing tab mode.
Category detail headers keep the category name and code as the primary identity fields; node type and hierarchy stay out of the primary metadata surface, while version and capability information remains in the capability sections below.
The category catalog only shows “返回产品” when the user entered from the product workflow; direct entry from the Project navigation stays within the category context without a misleading return action.

### Forms and overlays

Use the existing Base UI-backed primitives and Sonner notification provider. Sensitive key values are masked until an explicit action; destructive lifecycle operations use the shared AlertDialog. Error copy gives a reason and a recovery action without exposing raw response bodies.

### Iconography

Use lucide-react stroke icons at the existing `size-3.5`/`size-4` scale. Every icon-only control has an accessible name; text actions keep visible labels.

### Motion

Keep motion subtle and state-led. Shared transition styles are preferred; reduced-motion users receive the same state change without transform-heavy animation.

### Content and data visualization

Use plain, direct Chinese labels and stable domain vocabulary. Counts are displayed as values with an explicit unit. Do not show placeholder timestamps or infer counts from a partial cursor page; read the Project summary contract for aggregate values.

## Do's and Don'ts

- **Do:** Reuse the dashboard's Card and Button primitives for new Project workspace summaries.
- **Do:** Keep member management discoverable through the persistent project sidebar, including while viewing the overview.
- **Don't:** Repeat Project ID, creation/update timestamps, or owner metadata inside a summary card when the workspace header already owns that context.
- **Don't:** Alter an adjacent API authorization card when the requested change is limited to the overview's left summary column.

## IAM screen bindings (2026-10-01)

- Follow `.agents/skills/shadcn-dashboard-free/SKILL.md`. Use existing Lyra tokens, Geist, BreadcrumbComp, StyleDivider, Card, Base UI controls, Sonner, and the existing TanStack table module. No new component or form dependency.
- Authentication uses the referenced auth1 layout: rotating cube panel on desktop, centered form, full-width primary action; mobile keeps the form. The decorative cube respects reduced motion and has no visible playback controls.
- Account screens follow the referenced account-settings/profile structure with shared local navigation, live identity, editable contact information, and dedicated security/session panels. API credentials follow the referenced API-key table pattern with explicit key reveal, rotation confirmation, and network-policy editing.
- Canonical Select owner is `src/components/ui/select.tsx`; IAM screens do not use native select. Canonical table owner remains `src/components/tables/data-table/DataTable.tsx`, including its gateway cursor variant.
- Keep real authorization, loading, failure, empty, and unsaved states consistent across all IAM screens. `UX-CONTRACT.md` records behavior.

## IAM navigation scope (2026-10-01)

- `src/components/iam/menu-navigation.ts` owns platform/project destinations, permissions, route context, and project-switch targets. The sidebar, menu search, account sheet, and project switcher reuse its registered destinations. The sidebar replaces template demonstration menus; example source remains available for development.
- Project workspace: overview, members/invitations, access-request review, API credentials/network policy, lifecycle settings. Account workspace: profile, security, sessions, my requests, reusable roles/grants, owner menu catalog. No fictional project-specific role binding is introduced.
- IAM project pages reuse the original ProjectWorkspaceShell identity header, project navigation and settings strip. The sidebar adds scoped IAM destinations. Settings destinations are permission-filtered, while original product/category/parser/device pages keep their established project routes; those pages are not presented as newly integrated IAM APIs. Breadcrumbs show platform → actual Project → current screen.

## 原有风格优先（2026-10-01 用户裁决）

以当前仓库 HEAD 的 Shadcn Dashboard 外观为基线。新增 IAM 能力通过组合原有组件、增加内容和绑定真实接口实现，禁止以接入接口为由替换整页结构、公共外壳、配色或设计语言。顶部栏保留原 Logo、圆形菜单按钮、分隔线、项目切换和菜单搜索；账号抽屉保持居中头像与身份、图标菜单和底部操作。项目卡片沿用原有 CardHeader 边界、CardContent 间距和 lg 三列布局。登录和注册均保留用户认可的侧边分栏布局（Auth1 与 Auth2 路由共享），本次风格修正只针对登录后的页面。权限过滤、项目作用域、真实身份和真实接口属于行为绑定，不作为改变视觉基线的理由。

修改已有页面时先比较原文件与同类组件，优先调整新增功能以适应原布局，不改全局 UI primitives 或主题 tokens。不能提供真实数据的模板统计和营销内容不冒充业务事实。

## 通用上传能力（用户再次明确）

文件上传接口是共用基础能力，不属于独立菜单或文件管理产品。不得暴露上传链接、目录或文件 ID 的技术工具页；上传组件由头像、附件等已支持的业务场景组合使用。场景通过 storageType、directory、accept、maxSize 和 onUploaded 指定用途及接收确认后的文件事实。头像的持久化须以真实账号资料契约为准；当前契约支持 displayName 和 avatarUrl，头像在文件确认后以公有 HTTPS 地址保存到账号，不做本地假保存。项目列表和创建页直接复用原 ProjectListTable 与 CreateProjectWizard；真实个人资料按原 UserProfile 的头像摘要及两栏信息结构接入数据。

## 首页设置入口（2026-10-01 交互修正）

首页以“项目空间”为第一组，只提供全部项目。第二组为“设置”，复用原 NavCollapse 折叠交互：“权限与菜单”包含角色权限和菜单目录，按真实权限隐藏无权访问的叶子及空目录。进入权限与菜单子页时展开所属分组；个人中心各页保持单个入口选中。右上账号抽屉仅提供个人资料、安全、设备和退出，不重复整套首页导航。菜单搜索仍检索全部有权限的叶子。项目切换器独立查询、独立搜索与分页，不修改首页列表的状态或关键词。视觉 tokens、认证布局和项目页面结构不变。

首页和账号页面的侧栏不额外增加“平台控制台”说明行或占位分隔区，菜单直接接在原 Logo 栏下方（2026-10-01 用户明确要求）。

个人中心固定在平台与项目侧栏的最下方，使用单个入口，在页面内切换资料、安全和登录设备，不放入设置分组，不添加额外说明标题。项目列表直接使用 IAM ProjectVO，只展示返回的名称、ID、描述、状态及创建／更新时间；不展示或推断角色。

项目描述作为项目列表中的独立列，显示后端 description 原文，长描述自动换行，未提供描述时显示“—”，不添加默认业务描述。

认证侧栏使用本地 CSS 三阶魔方动画：整体缓慢旋转，顶层独立转动。用户要求移除播放／暂停按钮，保留原分栏与表单；系统减少动态效果时显示静态魔方。

认证页保持简约：左侧仅保留魔方与 Logo，不添加宣传标语；登录和注册标题下不显示用途说明。找回密码的身份验证说明属于操作指引，按需保留。

“我的加入申请”属于个人中心，在个人中心页面的本地导航中访问，不重复注册为独立侧栏入口；申请页选中侧栏底部的个人中心。项目内的申请审批仍属于项目协作。

账号安全沿用云控制台的逐项设置布局：名称、当前联系方式、对应操作分列，密码／邮箱／手机号分别操作。避免默认展开通用验证码表单或添加未返回的安全评分、验证状态；复用 Panel、Button 和 Dialog，表单仅按需打开。

个人资料保持官方 UserProfile 的头像摘要和两栏信息结构，按完整 AccountVO 展示显示名称、用户名、邮箱、手机号、账号状态、安全版本、账号 ID 与时间，avatarUrl 以头像图像呈现。资料编辑只提交 displayName；头像上传后独立保存 avatarUrl，联系方式由账号安全的验证流程维护。

头像裁剪：先检索 shadcndashboard 官方组件网站与 MCP 免费目录；当前目录没有图片裁剪组件，采用 react-easy-crop，组合现有 Dialog、Avatar 及 Base UI 滑块的主题样式，不更换个人资料布局。选图后圆形裁剪，确认选区后才可上传和保存。

设置入口层级：参考 GitHub 将组织角色管理置于 Settings → Access 的方式，将本项目账号名下的角色与菜单管理收进顶部控制台设置入口（齿轮），进入后用页内导航切换。业务侧栏不再常驻权限与菜单或设置分组；个人中心仍位于侧栏底部。复用现有 Button、Tooltip 与 Navigation，不更换外壳。参考：https://docs.github.com/en/organizations/managing-peoples-access-to-your-organization-with-roles/using-organization-roles 。

个人资料密度修订（2026-10-01 用户明确要求）：在原 Card、Avatar 和 Action 基础上整合为单个 max-w-3xl 资料卡，使用紧凑的标签／值行；取消并列个人信息与账号信息区域，隐藏安全版本，辅助权限默认收起。此修订取代此前两栏资料布局约定。


项目工作台修订（2026-10-02）：项目下的开发管理与 IAM 协作统一由左侧分组导航承载，取消项目级云开发横向重复入口；产品详情内部仍使用局部标签页。项目创建改为紧凑对话框，完成进入概览。邀请与角色创建在同一对话框中切换，使用现有主题、权限树和角色能力预览；此修订优先于旧项目导航约定。
