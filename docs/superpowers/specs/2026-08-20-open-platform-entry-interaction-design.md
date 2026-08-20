# AIoT 开放平台入口层 — 交互设计规格（本仓库绑定）

> 状态：已审阅通过（2026-08-20）  
> 实现计划：`docs/superpowers/plans/2026-08-20-open-platform-entry-implementation.md`  

> 日期：2026-08-20  
> 范围：Account / Project 列表与创建 / 工作区 / 成员邀请 / API 授权 + 与物模型衔接；**不含**物模型领域字段重设计  
> 风格：保持 shadcn-dashboard-free 原框架；组件优先 `src/components/ui/*`  
> 上游：
>
> 1. 本仓库 `AGENTS.md`、`.agents/skills/shadcn-dashboard-free/SKILL.md`
> 2. `.grok/skills/interaction-design/SKILL.md`
> 3. `D:/CodeProject/Java/aiot-platform/aiot-iam/docs/AIoT-IAM用户体系与开放平台设计-最终方案.md`
> 4. `D:/CodeProject/Vue/shadcndashboard/docs/AIoT-IAM开放平台后台UI交互设计文档.md`
> 5. Tuya 仅借鉴「先 Project 再资源 / 创建后看 Key」节奏，不复制领域模型

实现优先级：本仓库约定 > IAM 正式契约字段 > 本文交互 > Tuya 借鉴。

### 硬约束

- **接口字段：** TypeScript / mock / MSW 与 IAM View、Request **一一对应**，禁止增删改名或双轨兼容。
- **无 Tenant UI：** 正式模型为 `Account → Project → ProjectMember`。
- **Project 上下文：** 只从 URL 路径 `projectId` 获取；不写可信身份头；切换不重登、不改 Account Token。
- **侧边栏（已定稿）：** 仅「AIoT 开放平台 → Project」；**物模型不单独分组**，只作为 Project 工作区页签进入。
- **单密钥对：** 一个 Project 任意时刻只有一组有效 Client ID/Secret；无「新增授权」。
- **写成功：** Boolean 或结构化返回后，以重新 GET 为准刷新 UI；禁止猜 ID。
- **实现阶段数据：** mock → MSW → SWR → context（见 AGENTS.md）。

---

## 1. 心智模型与全局壳层

### 1.1 心智

```text
Account
  └── Project
        ├── Members / Invitations
        ├── API Authorization
        └── Thing Model（产品 / 模型 / Profile / Policy）
```

### 1.2 壳层

```text
FullLayout
├── Header：Project 切换器 | 主题/通知 | Account 菜单（安全中心/退出）
├── Sidebar：AIoT 开放平台 → Project（仅此）
└── Main：BreadcrumbComp + Project 上下文条 + 标题/主操作 + Card
```

认证页继续 `BlankLayout`（login/register/forgot/2FA）。

### 1.3 路由（前端 IA）

```text
/auth/auth2/*（已有）
/project-invitations/:invitationId

/projects
/projects/new
/projects/:projectId/overview
/projects/:projectId/members
/projects/:projectId/authorization
/projects/:projectId/usage
/projects/:projectId/subscriptions

/projects/:projectId/thing-model/products...   ← 二期；本期概览提供入口
```

lazy + Loadable；不保留无 `projectId` 的物模型正式别名。

### 1.4 字段镜像（IAM）

| 对象 | 字段 |
|------|------|
| RestResult | `code`, `message`, `data` |
| CursorResult | `items`, `nextCursor`, `hasMore` |
| AccountView | `accountId`, `username`, `email`, `phone`, `status`, `securityVersion`, `createTime`, `updateTime` |
| ProjectView | `projectId`, `projectName`, `description`, `status`, `myRole`, `createTime`, `updateTime` |
| Create body | **仅** `projectName`, `description?` |
| ProjectMemberView | `projectId`, `accountId`, `username`, `email`, `role`, `membershipStatus`, `joinedAt`, `createTime`, `updateTime` |
| InvitationView | `invitationId`, `projectId`, `inviteeEmail`, `inviteeAccountId`, `role`, `status`, `expiresAt`, `invitedBy`, `acceptedAt`, `createTime` |
| AuthorizationMetadataView | `projectId`, `status`, `ipAllowlist`, `networkPolicyEnabled`, `createTime`, `lastRotatedAt`, `lastUsedAt` |
| ProjectKeyPairView | `projectId`, `clientId`, `clientSecret` |

角色展示：OWNER / ADMIN / DEVELOPER / VIEWER。  
Project 状态：ACTIVE / SUSPENDED / ARCHIVED / CLOSED。  
成员状态：ACTIVE / SUSPENDED / REMOVED。  
邀请状态：PENDING / ACCEPTED / REJECTED / EXPIRED / REVOKED。  
授权状态：ACTIVE / DISABLED / REVOKED。

---

## 2. Project 列表与创建

### 2.1 登录后分流

```text
login → me → projects 列表
  0 个：空态（创建第一个 / 等待邀请）
  ≥1 个：停留 /projects（不因仅 1 个强制跳进工作区）
```

登录 body：`identifier`, `password`, `clientType: "CONSOLE"`。  
Token 响应不重复塞 Account/Project 列表。

### 2.2 列表 `/projects`

- 说明 +「创建 Project」
- 筛选 query **仅**：`cursor`, `pageSize`, `keyword`, `status`
- 列：名称、Project ID、`myRole`、`status`、`createTime`、`updateTime`、操作
- 打开 → `/projects/:projectId/overview`
- 五态：Skeleton / 无数据 Empty / 无筛选结果 / Error+trace+重试 / load more
- 组件：`table`/`Badge`/`DropdownMenu`/`Empty`/`Skeleton`/`Alert`/`sonner`

### 2.3 创建 `/projects/new`

```text
Step1 信息 → Step2 确认 → POST → Step3 密钥引导 → 工作区
```

- Body 仅 `projectName` + `description?`
- Header：`Authorization`, `X-Request-Id`, `Idempotency-Key`
- 成功：读取返回 project / ownerMember / keyPair，再 GET 详情；创建者为 ACTIVE OWNER
- Step3：Client ID/Secret 遮罩、显示（审计提示）、分字段复制；不写「只显示一次」；不进 URL/localStorage
- 失败保留输入；不显示部分成功

---

## 3. 工作区与 Project 切换器

### 3.1 头部 + Tabs

```text
概览 | 物模型 | 成员与邀请 | API 授权 | 用量 | 订阅
```

编辑 Dialog 仅名称/描述。生命周期见下表；关闭需 **名称确认输入** + checkbox，按钮文案「关闭 Project」。

| 状态 | 新建资源 | 邀请 | API | 动作 |
|------|----------|------|-----|------|
| ACTIVE | Policy | Policy | 授权决定 | 暂停/归档/关闭 |
| SUSPENDED | 禁 | 禁新增 | 禁新调用 | 恢复/归档/关闭 |
| ARCHIVED | 禁 | 禁 | 默认禁 | 只读 |
| CLOSED | 禁 | 禁 | 禁 | 无 |

### 3.2 概览

并行卡片、局部失败可重试：基本信息、资源摘要（无接口则诚实不可用）、物模型入口、授权摘要、用量、下一步。

物模型入口：`.../thing-model/products` 与 `.../products/new`（二期落地）。

### 3.3 Header 切换器

Combobox/Command；搜索用正式 `keyword`；切换只改 URL `projectId`，尽量保留页签类型；403/404 不替换当前 Project；脏页 AlertDialog：取消 / 保存后切换 / 不保存切换。

---

## 4. 成员与邀请 · API 授权 · Mock 顺序

### 4.1 成员与邀请 `/projects/:projectId/members`

```text
[邀请成员]
Tabs：成员 | 待处理邀请 | 历史邀请
筛选：角色 | membershipStatus | 邮箱/用户名
```

**成员表列（ProjectMemberView）：** 账号、邮箱、角色、成员状态、加入时间、更新时间、操作。

| 行为 | 接口要点 |
|------|----------|
| 列表 | `GET .../members?cursor&pageSize&role&membershipStatus` |
| 改角色/状态 | `PUT .../members/{principalId}` + Dialog 说明影响 |
| 移除 | `DELETE` + AlertDialog；不能移除唯一 Owner |
| Owner 转移 | 选 ACTIVE 成员 → 高风险确认；成功后重拉 Project/成员/权限 |
| 邀请列表 | `GET .../invitations?cursor&pageSize&status&email` |
| 发起邀请 | Sheet：邮箱（默认）与 Account ID 二选一；角色不含 OWNER，默认 DEVELOPER |
| 撤销 | `POST /api/v1/project-invitations/{id}/revoke` |

邀请状态 Badge 与可执行动作按 PENDING/ACCEPTED/REJECTED/EXPIRED/REVOKED。  
同一 Project 同一目标仅一条 PENDING；冲突保留表单并链到已有邀请。

**接受邀请** `/project-invitations/:invitationId`：

- 未登录 → 引导登录/注册（invitationId/token 仅流程态，不进 localStorage）
- 已登录 → 用户明确点「接受」→ `POST .../accept` body `{ token }` → 以返回为准展示 →「进入 Project」
- 无独立预览接口时，**不猜** Project 名称/角色
- 「拒绝邀请」同页明确按钮；成功不自动跳其他 Project

### 4.2 API 授权 `/projects/:projectId/authorization`

借鉴 Tuya「在 Project 看 Key」，本系统 **单密钥对**：

```text
授权状态卡片（AuthorizationMetadataView 字段）
  [启用] [禁用] [轮换] [吊销]

密钥区（点击才 GET key-pair）
  Client ID / Client Secret 遮罩 · 显示 · 复制

网络策略
  Switch 启用 IP 限制 + IP/CIDR 可增删行
  enabled=true 且列表空 → 阻断级警告「将拒绝所有来源」后仍可确认保存

最近使用（正式 last-used；无数据 Empty，不虚构）
```

**授权状态机：**

```text
ACTIVE ⇄ DISABLED
ACTIVE/DISABLED → REVOKED
REVOKED → rotate → ACTIVE（新密钥）
```

| 状态 | 查看密钥 | 启用 | 禁用 | 轮换 | 吊销 |
|------|----------|------|------|------|------|
| ACTIVE | 按权限 | — | ✓ | ✓ | ✓ |
| DISABLED | 按权限 | ✓ | — | ✓ | ✓ |
| REVOKED | 不展示失效明文 | — | — | ✓ | — |

- 轮换：Sheet + 勾选「理解旧密钥立即失效」；成功展示新 keyPair，**不**自动写入剪贴板  
- 吊销：不可 enable 恢复，必须 rotate  
- Project `SUSPENDED` 与 Authorization `DISABLED` **分开展示**  
- 无权限用户：安全动作可不渲染，并给只读说明；403 不当空数据  
- 错误可含 trace；**错误 UI 不得回显 Secret**

### 4.3 权限可见性（UI 基线）

最终以 Policy 为准。默认：

| 角色 | 入口层能力摘要 |
|------|----------------|
| OWNER | 全开含关闭、转移 Owner、密钥高风险 |
| ADMIN | 管信息/成员/业务资源；默认不可关闭/转移 Owner |
| DEVELOPER | 物模型读写；不管成员与密钥 |
| VIEWER | 只读 |

按钮：状态条件用 disabled+Tooltip；安全敏感无权限可隐藏。

### 4.4 全局反馈（十状态 + 响应时间）

与 interaction-design 一致：0–100ms pressed；100ms–1s spinner；写操作禁重复提交；412 保留本地并提供加载最新/保留本地；401 走刷新再失败回登录。

### 4.5 实现与 Mock 顺序（通过后执行）

严格按 AGENTS.md：

1. **Types** `src/types/apps/open-platform.ts`（或 `iam.ts`）— 仅 Appendix 字段  
2. **Mock + MSW** `src/api/open-platform/*-data.ts` → 注册 `mock-handlers.ts`  
   - `/api/v1/auth/*`（若本期接登录）  
   - `/api/v1/projects` CRUD/lifecycle  
   - members / invitations / authorization / key-pair / network-policy  
3. **Context** SWR + shared fetchers；写后 revalidate  
4. **组件** `src/components/open-platform/*` 组合 ui/*  
5. **Views + Router + Sidebar + Header 切换器**  
6. 每阶段 `npm run lint`；阶段结束 `npm run build`  
7. 物模型二期：路由与 API 一律 `/projects/{projectId}/...` 前缀收口  

---

## 5. Tuya 借鉴 vs 不照搬

| 借鉴 | 不照搬 |
|------|--------|
| 先选 Cloud Project 再管资源 | Tenant / 多组同时有效授权 |
| 创建后展示 API Key | DP ID、设备面板、OTA、OAuth 终端用户授权（P2） |
| Overview 可发现授权与网络策略 | 把 clientId 当资源主键 |
| 工作区页签集中能力 | 复制 Tuya 视觉或字段 |

---

## 6. 与既有物模型规格的关系

- `docs/superpowers/specs/2026-08-20-thing-model-interaction-design.md` 中的物模型交互仍然有效。  
- **入口与路由**以本文为准：必须先有 Project；侧边栏不再单独「物模型」分组。  
- 物模型实现计划需在开工前增补：**Project-scoped 路由与 API 前缀**；禁止无 Project 双轨。

---

## 7. 审阅清单

- [x] 第 1 节心智/壳层（含侧边栏收口）  
- [x] 第 2 节列表与创建  
- [x] 第 3 节工作区与切换器  
- [x] 第 4 节成员/授权/Mock 顺序  
- [x] 实现计划已写入 `docs/superpowers/plans/2026-08-20-open-platform-entry-implementation.md`
