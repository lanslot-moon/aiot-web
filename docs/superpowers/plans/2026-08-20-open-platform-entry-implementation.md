# Open Platform Entry (IAM Project) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在本仓库实现 AIoT 开放平台入口层：认证对接（按最终方案契约）、Project 列表/创建/工作区、成员与邀请、API 授权（单密钥对），数据走 mock + MSW + SWR，UI 复用 `src/components/ui`。

**Architecture:** 对齐 blog/notes/ticket：`types` → `api/open-platform/*-data.ts` + MSW → `context/open-platform-context` → `components/open-platform/*` → `views/apps/open-platform/*` → `Router.tsx` + sidebar + Header Project 切换器。业务页 URL 必含 `projectId`。物模型本计划只留工作区「物模型」页签入口占位，不实现产品领域。

**Tech Stack:** Vite 8、React 19、TypeScript、react-router、SWR、MSW、Tailwind v4、shadcn `ui/*`、TanStack Table、lucide-react、sonner。

**Specs:**
- `docs/superpowers/specs/2026-08-20-open-platform-entry-interaction-design.md`
- `D:/CodeProject/Java/aiot-platform/aiot-iam/docs/AIoT-IAM用户体系与开放平台设计-最终方案.md`
- `D:/CodeProject/Vue/shadcndashboard/docs/AIoT-IAM开放平台后台UI交互设计文档.md`

## Global Constraints

- **契约真相源：** Mock/类型以 **IAM 最终方案** 的 Request/View 字段为准（camelCase）。当前 Java `AuthApiService` 仍含 `switch-space`/Tenant 遗留——**前端禁止实现** `switch-space`、`tenantId`、`X-Tenant-Id`；禁止兼容旧 Space 语义。
- **字段硬约束：** 不增删改名字段；时间用 Unix ms；Token `expiresIn` 为秒。
- **AGENTS.md：** mock data 文件 → MSW → SWR context → views；npm only；`cn()`；lint `--max-warnings 0`；`tsc` 过 build。
- **UI：** 只用 `src/components/ui/*`；业务在 `src/components/open-platform/`。
- **侧边栏：** 仅「AIoT 开放平台 → Project」；无独立物模型分组。
- **单密钥对：** 无「新增授权」按钮。
- **写后刷新：** 成功后重新 GET；创建 Project 用返回的 `project.projectId`，不猜 ID。
- **RestResult：** `{ code, message, data }`，成功 `code === "200"`。
- **列表：** `items` / `nextCursor` / `hasMore`；query 仅契约允许字段。
- **不做本期：** OAuth/终端用户授权、Organization、物模型产品 CRUD、设备/OTA。

---

## File Map

| Path | Responsibility |
|------|----------------|
| `src/types/apps/open-platform.ts` | RestResult、CursorResult、Auth/Project/Member/Invitation/Authorization Views |
| `src/api/open-platform/open-platform-data.ts` | 内存 store + MSW handlers |
| `src/api/mocks/handlers/mock-handlers.ts` | 注册 OpenPlatformHandlers |
| `src/context/open-platform-context/index.tsx` | SWR + mutations + 可选 token 会话态 |
| `src/components/open-platform/*` | Badge、复制、错误、切换器、列表、向导、工作区壳、成员、授权 |
| `src/views/apps/open-platform/**` | 路由页 |
| `src/views/apps/open-platform/invitations/accept.tsx` | 邀请落地（Blank 或 Full） |
| `src/routes/Router.tsx` | lazy + Loadable |
| `src/layouts/full/vertical/sidebar/sidebaritems.ts` | 仅开放平台入口 |
| `src/layouts/full/vertical/header/*` | 嵌入 ProjectSwitcher |

---

## Appendix A — 最终方案字段（Mock 原样）

### A.0 信封

```ts
RestResult<T> = { code: string; message: string; data: T }
CursorResult<T> = { items: T[]; nextCursor: string | null; hasMore: boolean }
TokenResponse = { accessToken: string; refreshToken: string; tokenType: "Bearer"; expiresIn: number }
```

### A.1 Auth（最终方案，非旧 Java 行为）

| Method | Path | Request | data |
|--------|------|---------|------|
| POST | `/api/v1/auth/register` | `username`, `email?`, `phone?`, `password` | `{ registered: true, accountId, status }` **无 Token** |
| POST | `/api/v1/auth/login` | `identifier`, `password`, `clientType` | `TokenResponse` |
| POST | `/api/v1/auth/token/refresh` | `refreshToken` | `TokenResponse` |
| POST | `/api/v1/auth/logout` | `refreshToken?` | `boolean` |
| GET | `/api/v1/auth/me` | — | **AccountView**（非 TokenResponse） |

**AccountView:** `accountId`, `username`, `email`, `phone`, `status`, `securityVersion`, `createTime`, `updateTime`

### A.2 Project

| Method | Path | Request/Query | data |
|--------|------|---------------|------|
| POST | `/api/v1/projects` | `{ projectName, description? }` | `{ project, ownerMember, keyPair }` |
| GET | `/api/v1/projects` | `cursor?`, `pageSize?`, `keyword?`, `status?` | `CursorResult<ProjectView>` |
| GET | `/api/v1/projects/{projectId}` | — | Project 详情（含成员关系上下文；**无** Secret） |
| PUT | `/api/v1/projects/{projectId}` | 非状态字段（名称/描述） | 按契约（Boolean 或 View——以最终方案该节为准；成功后一律再 GET） |
| POST | `.../activate` | 确认体若有 | boolean/View |
| POST | `.../suspend` | | |
| POST | `.../archive` | | |
| POST | `.../close` | Owner 确认 | |
| GET | `.../summary` | | 摘要 View（字段跟最终方案 5.x） |
| GET | `.../usage` | | |
| GET | `.../subscriptions` | | |

**ProjectView:** `projectId`, `projectName`, `description`, `status`, `myRole`, `createTime`, `updateTime`  
**ProjectKeyPairView:** `projectId`, `clientId`, `clientSecret`

### A.3 Members / Invitations / Authorization

按最终方案 §5 路径表实现；View 字段见交互规格 §1.4。邀请 accept body：`{ token }`。  
Authorization：metadata GET 无 Secret；key-pair 专用 GET；rotate/enable/disable/revoke；network-policy PUT。

---

## Task 1: Types

**Files:** Create `src/types/apps/open-platform.ts`

- [ ] **Step 1: Add envelope + AccountView + TokenResponse + register/login request types** exactly as Appendix A.1

```ts
export interface RestResult<T> {
  code: string;
  message: string;
  data: T;
}
export const REST_SUCCESS_CODE = "200";

export interface CursorResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
}

export interface AccountView {
  accountId: string;
  username: string;
  email: string | null;
  phone: string | null;
  status: string;
  securityVersion: number;
  createTime: number;
  updateTime: number;
}

export interface RegisterRequest {
  username: string;
  email?: string;
  phone?: string;
  password: string;
}

export interface RegisterResult {
  registered: boolean;
  accountId: string;
  status: string;
}

export interface LoginRequest {
  identifier: string;
  password: string;
  clientType: "CONSOLE";
}
```

- [ ] **Step 2: Add ProjectView, CreateProjectRequest, CreateProjectResult, Member/Invitation/Authorization/KeyPair views** — only fields from最终方案 / 交互规格 Appendix。

- [ ] **Step 3:** `npx tsc --noEmit`

- [ ] **Step 4: Commit** `feat(open-platform): add IAM final-scheme TypeScript types`

---

## Task 2: Mock store + MSW (Auth + Projects core)

**Files:**
- Create `src/api/open-platform/open-platform-data.ts`
- Modify `src/api/mocks/handlers/mock-handlers.ts`

- [ ] **Step 1: Seed** one Account、2–3 Projects（含不同 status/myRole）、members、one PENDING invitation、authorization metadata + key pair in memory.

- [ ] **Step 2: Handlers** returning RestResult；paths:

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/token/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me
POST /api/v1/projects
GET  /api/v1/projects
GET  /api/v1/projects/:projectId
PUT  /api/v1/projects/:projectId
POST /api/v1/projects/:projectId/activate|suspend|archive|close
```

Rules:

- register → `{ registered, accountId, status }` only  
- login → TokenResponse only；me → AccountView  
- create project → `{ project, ownerMember, keyPair }`；status ACTIVE；myRole OWNER  
- list filters only `cursor|pageSize|keyword|status`  
- **no** `/auth/switch-space` handler  

- [ ] **Step 3: Register** `...OpenPlatformHandlers` in `mock-handlers.ts`

- [ ] **Step 4: Smoke** `GET /api/v1/projects` via browser/dev after `npm run dev`

- [ ] **Step 5: Commit** `feat(open-platform): MSW mocks for auth and projects`

---

## Task 3: Shared widgets + context

**Files:**
- `src/components/open-platform/project-status-badge.tsx`
- `src/components/open-platform/role-badge.tsx`
- `src/components/open-platform/copy-id-button.tsx`
- `src/components/open-platform/api-error-alert.tsx`
- `src/context/open-platform-context/index.tsx`
- Wire provider next to existing contexts in App/layout

- [ ] Badges use `Badge` + text + icon  
- [ ] Copy + sonner toast  
- [ ] Context: SWR keys for projects list/detail；`createProject`；lifecycle posts；after write `mutate`  
- [ ] Optional: hold accessToken in memory/sessionStorage for Authorization header on fetchers（mock 可忽略校验，但请求形状保留）  
- [ ] Commit `feat(open-platform): shared widgets and SWR context`

---

## Task 4: Routes, sidebar, Header switcher shell

**Files:** Router、sidebaritems、Header、placeholder views

- [ ] Routes:

```text
/projects
/projects/new
/projects/:projectId/overview
/projects/:projectId/members
/projects/:projectId/authorization
/projects/:projectId/usage
/projects/:projectId/subscriptions
/projects/:projectId/thing-model/products   (placeholder page: “物模型将在此 Project 下提供”)
/project-invitations/:invitationId
```

- [ ] Sidebar **only** 开放平台 → Project → `/projects`  
- [ ] Header: `ProjectSwitcher` combobox placeholder calling list API  
- [ ] `npm run lint`  
- [ ] Commit `feat(open-platform): routes, sidebar, header switcher shell`

---

## Task 5: Project list page

**Files:** `views/apps/open-platform/projects/index.tsx`, `components/open-platform/project-list-table.tsx`

- [ ] BreadcrumbComp + 创建按钮 + filters（keyword/status）+ table + Empty/Skeleton/Error + load more  
- [ ] Columns from ProjectView only  
- [ ] Browser verify desktop + narrow  
- [ ] Commit `feat(open-platform): project list page`

---

## Task 6: Create Project wizard + key guide

**Files:** `projects/new/index.tsx`, `create-project-wizard.tsx`

- [ ] Steps 1–2–3；body only `projectName`/`description`  
- [ ] POST create → show keyPair sheet/page → navigate overview with returned `projectId`  
- [ ] Secret masked；copy；no localStorage  
- [ ] Browser verify  
- [ ] Commit `feat(open-platform): create project wizard with key guide`

---

## Task 7: Workspace shell + overview + lifecycle

**Files:** workspace layout/header、overview cards、AlertDialogs for suspend/activate/archive/close

- [ ] Header + Tabs；close requires name confirm + checkbox；button label「关闭 Project」  
- [ ] Overview cards with partial failure  
- [ ] Thing Model tab → placeholder route  
- [ ] Switcher: change `projectId` in URL；dirty guard stub ok if no editor yet  
- [ ] `npm run build` && lint  
- [ ] Commit `feat(open-platform): project workspace and lifecycle`

---

## Task 8: Members + invitations

**Files:** members view、invite Sheet、accept invitation page；extend MSW

- [ ] Member table ProjectMemberView fields；invite Sheet email XOR accountId；role no OWNER  
- [ ] Accept/reject flows；token not logged  
- [ ] Browser verify  
- [ ] Commit `feat(open-platform): members and invitations`

---

## Task 9: API Authorization

**Files:** authorization view；extend MSW for metadata/key-pair/rotate/enable/disable/revoke/network-policy/last-used

- [ ] No「新增授权」  
- [ ] Reveal secret only via key-pair GET；rotate confirm checkbox  
- [ ] IP policy empty+enabled warning  
- [ ] Browser verify；lint + build  
- [ ] Commit `feat(open-platform): project API authorization UI`

---

## Task 10: Auth pages alignment (optional but recommended)

- [ ] Adjust existing login/register forms to最终方案字段（`identifier`/`clientType`；register no auto-login）  
- [ ] Mock-backed submit → me → projects  
- [ ] Commit `feat(open-platform): align auth forms to IAM final scheme`

---

## Self-Review

| Spec area | Tasks |
|-----------|-------|
| No Tenant / no switch-space | Global + Task 2 |
| Sidebar Project-only | Task 4 |
| List/create/key guide | Tasks 5–6 |
| Workspace/lifecycle/switcher | Task 7 |
| Members/authz | Tasks 8–9 |
| Field fidelity | Appendix A + Task 1–2 |
| Mock per AGENTS | Task 2 |

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-20-open-platform-entry-implementation.md`.

**Two execution options:**

1. **Subagent-Driven（推荐）** — 每 Task 子代理 + 任务间复查  
2. **Inline Execution** — 本会话按 Task 推进并设检查点  

Also note: 物模型实现计划需在开工前改为 **Project-scoped** 路由；本入口层完成后物模型不再割裂。
