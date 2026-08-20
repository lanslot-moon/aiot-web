# Thing Model Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在本 Vite + React 19 dashboard SPA 中，按已审阅交互规格实现物模型管理（产品 / 物模型 / Parser Profile / Data Policy），数据走 mock + MSW + SWR，UI 复用 `src/components/ui` shadcn 组件。

**Architecture:** 按现有 blog/notes/ticket 模式：`types` → `api/thing-model/*-data.ts` + MSW handlers → `context/thing-model-context` → `components/thing-model/*` → `views/apps/thing-model/*` → `Router.tsx` + sidebar。产品工作区用嵌套路由 + Tabs。所有写操作成功后重新 GET 正式 VO 刷新 UI。

**Tech Stack:** Vite 8、React 19、TypeScript、react-router、SWR、MSW、Tailwind v4、`src/components/ui/*`（shadcn/Base UI）、TanStack Table 包装、lucide-react、sonner。

**Specs:**
- `docs/superpowers/specs/2026-08-20-thing-model-interaction-design.md`
- `D:/CodeProject/Vue/shadcndashboard/docs/AIoT物模型管理后台UI交互文档.md`
- Java 正式契约：`D:/CodeProject/Java/aiot-platform/aiot-thing-model/aiot-thing-model-api`

## Global Constraints

- **接口字段硬约束：** TypeScript 类型、mock、MSW body/query/response 必须与当前 Java Request/VO **字段名、嵌套结构一一对应**；禁止新增、删减、改名、改类型或双轨兼容。
- **UI 组件：** 优先组合 `src/components/ui/*`；业务封装仅在 `src/components/thing-model/`。
- **无真实后端客户端：** 只用 mock + MSW；路径形状对齐 `/api/v1/...`。
- **包管理：** npm only。
- **表单库：** 不加 react-hook-form/zod，除非用户另行确认。
- **写成功：** 多数写接口 `RestResult<Boolean>` → 必须再 GET 资源；禁止猜 `productId`。
- **RestResult 信封：** `{ code: string, message: string, data: T }`；成功 `code === "200"`。
- **错误：** 保留输入；展示 code/message；可读响应头 `X-Requested-Id` 作 trace。
- **乐观锁：** VO 的 `version`（Product 等为 `number`/`Long`）写入 `VersionRequest.version: string` 时做 `String(version)`；禁止自创 header 传 version。
- **列表搜索：** 产品 list 正式 query **仅** `cursor`、`pageSize`、`lifecycleStatus`——**不得**发明 `keyword`/`search` query；名称筛选仅可对**已加载** `items` 做客户端过滤。
- **品类 list：** `GET /api/v1/categories` 返回 `RestResult<List<CategoryVO>>`（平铺），前端按 `parentCode` 建树；不要按 cursor 分页实现租户品类列表。
- **不做：** 设备/遥测/OTA/租户品类 CRUD/Parser 失败样本管理页/`/api/v1/admin/categories`。
- **质量门：** 每完成一大任务跑 `npm run lint`；阶段结束跑 `npm run build`。
- **风格：** 对齐 Tickets（`BreadcrumbComp` + `StyleAwareWrapper` + `Card`）。

---

## File Map

| Path | Responsibility |
|------|----------------|
| `src/types/apps/thing-model.ts` | 与 Java Request/VO 同构的 TS 类型 + `RestResult` / `CursorResult` |
| `src/api/thing-model/thing-model-data.ts` | mock 数据与 MSW handlers |
| `src/api/mocks/handlers/mock-handlers.ts` | 注册 thing-model handlers |
| `src/context/thing-model-context/index.tsx` | SWR 列表/详情与 mutation helpers |
| `src/components/thing-model/*` | 共享徽章、复制、错误面板、确认框、产品表、向导、工作区壳、模型编辑器等 |
| `src/views/apps/thing-model/**` | 路由级页面 |
| `src/routes/Router.tsx` | lazy + Loadable 路由 |
| `src/layouts/full/vertical/sidebar/sidebaritems.ts` | 侧边栏「物模型管理」 |

---

## Appendix A — Java 正式字段（实现时原样镜像，勿增删）

### A.0 信封与分页

```ts
// RestResult<T>
{ code: string; message: string; data: T }

// ICursorResult<T>
{ items: T[]; nextCursor: string | null; hasMore: boolean }

// VersionRequest (写操作 body)
{ version: string }
```

### A.1 Product

**Paths:** `/api/v1/products`

| Method | Path | Body / Query | data |
|--------|------|--------------|------|
| POST | `/` | `CreateProductRequest` | `boolean` |
| GET | `/` | `cursor?`, `pageSize?`, `lifecycleStatus?` | `ICursorResult<ProductVO>` |
| GET | `/{productId}` | — | `ProductVO` |
| PUT | `/{productId}` | `UpdateProductRequest` | `boolean` |
| POST | `/{productId}/publish/validate` | — | `boolean` |
| POST | `/{productId}/publish` | `VersionRequest` | `boolean` |
| POST | `/{productId}/disable` | `VersionRequest` | `boolean` |
| POST | `/{productId}/enable` | `VersionRequest` | `boolean` |
| POST | `/{productId}/deprecate` | `VersionRequest` | `boolean` |
| DELETE | `/{productId}` | `VersionRequest` | `boolean` |

**CreateProductRequest:**  
`productName`, `productModel?`, `description?`, `manufacturer?`, `iconUrl?`, `categoryCode`, `categoryCatalogVersion?`, `nodeType?`, `transport?`, `authModes?`, `customAuthProviderId?`, `dataMode?`, `bootstrapMode?`, `protocolProfile?` (`profileId`, `profileVersion`), `topicTemplates?`

**UpdateProductRequest:**  
`version` (string, required) + 同上可选字段（含 category* 仅校验一致性）

**ProductVO:**  
`productId`, `tenantId`, `productName`, `productModel`, `description`, `manufacturer`, `iconUrl`, `categoryCode`, `categoryCatalogVersion`, `nodeType`, `transport`, `authModes`, `customAuthProviderId`, `dataMode`, `bootstrapMode`, `protocolProfile`, `topicTemplates`, `lifecycleStatus`, `version` (**number**), `createdAt`, `updatedAt`

**Enums (string):**  
`lifecycleStatus`: DRAFT | PUBLISHED | DISABLED | DEPRECATED  
`nodeType`: DIRECT | GATEWAY | SUB_DEVICE  
`transport`: MQTT | HTTPS  
`authModes[]`: DEVICE_SECRET | PRODUCT_SECRET | CUSTOM  
`dataMode`: STANDARD_MODEL | CUSTOM_PAYLOAD | TRANSPARENT  
`bootstrapMode`: OPEN | STRICT  

### A.2 Thing Model

**Paths:** `/api/v1/products/{productId}/model`

| Method | Path | Notes | data |
|--------|------|-------|------|
| GET | `/` | 草稿 | `ModelDraftVO` |
| PUT | `/` | `ModelDraftSaveRequest` | `boolean` |
| DELETE | `/` | 丢弃草稿 | `boolean` |
| POST | `/validate` | | validation VO / boolean（以接口签名为准） |
| GET | `/validation` | 最近校验 | 以接口签名为准 |
| POST | `/publish` | body 含 version | `boolean` |
| GET | `/versions` | | list |
| GET | `/versions/{modelRevision}` | | snapshot |
| GET | `/published` | | published model |
| POST | `/diff` | | diff |
| POST | `/rollback` | | `boolean` |
| POST | `/deprecate` | | `boolean` |
| GET | `/category-diff?targetVersion=` | | diff |
| POST | `/category-merge` | | merge result |

**ModelDraftVO:** `definition` (`ThingModelDefinition`), `status` (DRAFT|VALIDATED), `version` (number)

**ThingModelDefinition / 能力字段（禁止增删）:**  
顶层：`productId`, `modelRevision`, `modelDigest`, `status`, `properties`, `actions`, `events`  
Property: `code`, `title`, `access`, `schema`, `required`  
Action: `code`, `title`, `inputSchema`, `outputSchema`, `invokeMode`  
Event: `code`, `title`, `outputSchema`, `eventType`  

**ModelDraftSaveRequest:** `version?` (string), `definition` (required)

### A.3 Category（租户只读）

| Method | Path | data |
|--------|------|------|
| GET | `/api/v1/categories` | `CategoryVO[]` |
| GET | `/api/v1/categories/{categoryCode}` | `CategoryVO` |
| GET | `/api/v1/categories/{categoryCode}/versions` | `CategoryVersionVO[]` |
| GET | `/api/v1/categories/{categoryCode}/versions/{categoryVersion}` | `CategoryVersionVO` |

**CategoryVO:** `categoryCode`, `parentCode`, `level`, `names`, `status`, `leaf`, `parentPath`, `sort`  
**CategoryVersionVO:** `categoryCode`, `categoryVersion`, `versionStatus`, `template`, `versionDigest`, `publishedAt`, `createdAt`

### A.4 Parser Profile

**Base:** `/api/v1/parser-profiles`  
**ParserProfileVO:** `profileId`, `tenantId`, `profileName`, `protocolCode`, `currentVersion`, `version`, `createdAt`, `updatedAt`  
**CreateParserProfileRequest:** `profileName`, `protocolCode`  
**ParserProfileVersionVO:** `profileId`, `profileVersion`, `versionStatus`, `mapping`, `versionDigest`, `publishedAt`  
**ParserProfileMapping:** `mappings` (map of vendorKey → `{ code, type, sourcePath, direction, conversion?: { scale, offset } }`), `codec?`  
**ParserProfileTestRequest:** `direction?`, `payload`, `saveFailureSample?`  
**ParserProfileTestVO:** `success`, `mapped`, `issues`, `unparsedFields`, `failureSampleId`

### A.5 Data Policy

**Base:** `/api/v1/data-policies`  
**DataPolicyVO:** `policyId`, `tenantId`, `scopeType`, `productId`, `telemetry`, `rawMessage`, `rulesEnabled`, `version`, `createdAt`, `updatedAt`  
**CreateDataPolicyRequest:** `scopeType`, `productId?`, `telemetry?`, `rawMessage?`, `rulesEnabled?`  
**TelemetryPolicyVO:** `retentionDays`, `sampling?`  
**RawMessagePolicyVO:** `enabled`, `retentionDays`, `maxSizeBytes`

---

## Task 1: Types — mirror Java contracts

**Files:**
- Create: `src/types/apps/thing-model.ts`

**Produces:** `RestResult`, `CursorResult`, `ProductVO`, `CreateProductRequest`, `UpdateProductRequest`, `VersionRequest`, `CategoryVO`, `CategoryVersionVO`, `ModelDraftVO`, `ThingModelDefinition`, `ParserProfileVO`, `ParserProfileVersionVO`, `ParserProfileMapping`, `ParserProfileTestRequest`, `ParserProfileTestVO`, `DataPolicyVO`, `CreateDataPolicyRequest`, enums as string unions.

- [ ] **Step 1: Create `src/types/apps/thing-model.ts` with envelope + product types exactly as Appendix A**

```ts
/** Mirrors com.aiot.thingmodel.api.entity.RestResult */
export interface RestResult<T> {
  code: string;
  message: string;
  data: T;
}

export const REST_SUCCESS_CODE = "200";

/** Mirrors com.aiot.thingmodel.common.entity.ICursorResult */
export interface CursorResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export type ProductLifecycleStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "DISABLED"
  | "DEPRECATED";

export type ProductNodeType = "DIRECT" | "GATEWAY" | "SUB_DEVICE";
export type ProductTransport = "MQTT" | "HTTPS";
export type ProductAuthMode = "DEVICE_SECRET" | "PRODUCT_SECRET" | "CUSTOM";
export type ProductDataMode =
  | "STANDARD_MODEL"
  | "CUSTOM_PAYLOAD"
  | "TRANSPARENT";
export type ProductBootstrapMode = "OPEN" | "STRICT";

/** Mirrors ProtocolProfileRefVO */
export interface ProtocolProfileRefVO {
  profileId: string;
  profileVersion: string;
}

/** Mirrors ProductVO — do not add/remove fields */
export interface ProductVO {
  productId: string;
  tenantId: string;
  productName: string;
  productModel: string | null;
  description: string | null;
  manufacturer: string | null;
  iconUrl: string | null;
  categoryCode: string;
  categoryCatalogVersion: string | null;
  nodeType: string | null;
  transport: string | null;
  authModes: string[] | null;
  customAuthProviderId: string | null;
  dataMode: ProductDataMode | null;
  bootstrapMode: ProductBootstrapMode | null;
  protocolProfile: ProtocolProfileRefVO | null;
  topicTemplates: Record<string, string> | null;
  lifecycleStatus: ProductLifecycleStatus;
  version: number;
  createdAt: number;
  updatedAt: number;
}

/** Mirrors CreateProductRequest — do not add/remove fields */
export interface CreateProductRequest {
  productName: string;
  productModel?: string;
  description?: string;
  manufacturer?: string;
  iconUrl?: string;
  categoryCode: string;
  categoryCatalogVersion?: string;
  nodeType?: string;
  transport?: string;
  authModes?: string[];
  customAuthProviderId?: string;
  dataMode?: ProductDataMode;
  bootstrapMode?: ProductBootstrapMode;
  protocolProfile?: ProtocolProfileRefVO;
  topicTemplates?: Record<string, string>;
}

/** Mirrors UpdateProductRequest */
export interface UpdateProductRequest {
  version: string;
  productName?: string;
  productModel?: string;
  description?: string;
  manufacturer?: string;
  iconUrl?: string;
  categoryCode?: string;
  categoryCatalogVersion?: string;
  nodeType?: string;
  transport?: string;
  authModes?: string[];
  customAuthProviderId?: string;
  dataMode?: ProductDataMode;
  bootstrapMode?: ProductBootstrapMode;
  protocolProfile?: ProtocolProfileRefVO;
  topicTemplates?: Record<string, string>;
}

/** Mirrors VersionRequest */
export interface VersionRequest {
  version: string;
}
```

- [ ] **Step 2: Append Category / Model / Profile / DataPolicy interfaces from Appendix A into the same file** (same rule: only Java fields). Include `ThingModelDefinition` Property/Action/Event nested types with exact keys: `code`, `title`, `access`, `schema`, `required` / `inputSchema`, `outputSchema`, `invokeMode` / `outputSchema`, `eventType`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (or only pre-existing unrelated errors)

- [ ] **Step 4: Commit**

```bash
git add src/types/apps/thing-model.ts
git commit -m "feat(thing-model): add TS types mirroring Java API contracts"
```

---

## Task 2: Mock data + MSW handlers (Product + Category first)

**Files:**
- Create: `src/api/thing-model/thing-model-data.ts`
- Modify: `src/api/mocks/handlers/mock-handlers.ts`

**Consumes:** types from Task 1  
**Produces:** MSW handlers for product + category paths used by Phase 2 UI

- [ ] **Step 1: Seed in-memory products + categories** whose objects are full `ProductVO` / `CategoryVO` shapes (every field present; use `null` where Java allows empty). Include at least one of each lifecycle.

- [ ] **Step 2: Implement handlers** using `http`/`HttpResponse` from `msw` (match existing ticket/blog handler style in repo). Envelope every response as `RestResult`.

Minimum handlers for Phase 2:

```text
GET  /api/v1/products
POST /api/v1/products
GET  /api/v1/products/:productId
PUT  /api/v1/products/:productId
POST /api/v1/products/:productId/publish/validate
POST /api/v1/products/:productId/publish
POST /api/v1/products/:productId/disable
POST /api/v1/products/:productId/enable
POST /api/v1/products/:productId/deprecate
DELETE /api/v1/products/:productId
GET  /api/v1/categories
GET  /api/v1/categories/:categoryCode
GET  /api/v1/categories/:categoryCode/versions
GET  /api/v1/categories/:categoryCode/versions/:categoryVersion
```

Rules:

- List: read `cursor`, `pageSize`, `lifecycleStatus` only; return `{ items, nextCursor, hasMore }`.
- Create/Update/lifecycle writes: return `{ code:"200", message:"success", data: true }` then mutate store so subsequent GET reflects state.
- Create: **do not** return ProductVO; on same `productName` idempotent `data: true` without inventing extra response fields.
- Version mismatch → HTTP 412 + RestResult failure (no extra body fields).
- Illegal lifecycle → HTTP 409 + failure.

- [ ] **Step 3: Register in `mock-handlers.ts`**

```ts
import { ThingModelHandlers } from "src/api/thing-model/thing-model-data";

export const mockHandlers = [
  ...Bloghandlers,
  ...NotesHandlers,
  ...TicketHandlers,
  ...ThingModelHandlers,
];
```

- [ ] **Step 4: Smoke via devtools or a tiny node fetch after `npm run dev`** — `GET /api/v1/products` returns RestResult with ProductVO fields only.

- [ ] **Step 5: Commit**

```bash
git add src/api/thing-model/thing-model-data.ts src/api/mocks/handlers/mock-handlers.ts
git commit -m "feat(thing-model): add MSW mocks for products and categories"
```

---

## Task 3: Shared UI primitives (shadcn composition)

**Files:**
- Create: `src/components/thing-model/lifecycle-badge.tsx`
- Create: `src/components/thing-model/copy-id-button.tsx`
- Create: `src/components/thing-model/api-error-alert.tsx`
- Create: `src/components/thing-model/confirm-version-action-dialog.tsx`

**Consumes:** `ProductLifecycleStatus`, shadcn `badge`, `button`, `tooltip`, `alert`, `alert-dialog`, `spinner`

- [ ] **Step 1: `LifecycleBadge`** — map status → Badge variant + text label (DRAFT/PUBLISHED/DISABLED/DEPRECATED); include lucide icon; never color-only.

- [ ] **Step 2: `CopyIdButton`** — props `{ value: string; label: string }`; clipboard + `toast.success` via sonner.

- [ ] **Step 3: `ApiErrorAlert`** — props `{ code?: string; message?: string; traceId?: string; onRetry?: () => void }` using `alert` + Retry button. Copy answers: what / why / next.

- [ ] **Step 4: `ConfirmVersionActionDialog`** — AlertDialog wrapping destructive/primary confirm; on confirm call provided `onConfirm` with loading lock; parent supplies title/description naming the object.

- [ ] **Step 5: Commit**

```bash
git add src/components/thing-model/
git commit -m "feat(thing-model): add shared badge, copy, error, confirm widgets"
```

---

## Task 4: Context + routes + sidebar shell

**Files:**
- Create: `src/context/thing-model-context/index.tsx`
- Create: `src/views/apps/thing-model/products/index.tsx` (placeholder ok until Task 5)
- Modify: `src/routes/Router.tsx`
- Modify: `src/layouts/full/vertical/sidebar/sidebaritems.ts`
- Modify: App provider tree if contexts are mounted near Blog/Notes/Ticket providers (find existing pattern in `src/App.tsx` or layout)

**Consumes:** `getFetcher` / `postFetcher` / `putFetcher` / `deleteFetcher` from `src/api/global-fetcher.ts`

- [ ] **Step 1: Context** exposing:
  - `useSWR<RestResult<CursorResult<ProductVO>>>("/api/v1/products?...")`
  - helpers: `refreshProduct(productId)`, `createProduct(body: CreateProductRequest)`, lifecycle posts with `VersionRequest`
  - After every mutating helper that returns boolean success: revalidate list and/or `GET /api/v1/products/{id}`

- [ ] **Step 2: Routes under FullLayout** (lazy + Loadable):

```text
/thing-model/products
/thing-model/products/new
/thing-model/products/:productId/overview
/thing-model/products/:productId/model
/thing-model/products/:productId/connection
/thing-model/products/:productId/versions
```

(Profile/Policy routes can be stubbed in a later task.)

- [ ] **Step 3: Sidebar** group 「物模型管理」→ 「产品」href `/thing-model/products` (lucide icon consistent with nearby items). Do **not** add Categories / Failure Samples.

- [ ] **Step 4: `npm run lint`** — fix warnings to zero.

- [ ] **Step 5: Commit**

```bash
git add src/context/thing-model-context src/routes/Router.tsx src/layouts/full/vertical/sidebar/sidebaritems.ts src/views/apps/thing-model src/App.tsx
git commit -m "feat(thing-model): wire context, routes, and sidebar for products"
```

---

## Task 5: Product list page

**Files:**
- Create: `src/components/thing-model/product-list-table.tsx`
- Modify: `src/views/apps/thing-model/products/index.tsx`

**UI:** `BreadcrumbComp` + title + 「创建产品」`Button` + filter row (`Input` client filter, `Select` lifecycle → **server** `lifecycleStatus`, refresh `Button`) + `Card` + table (`table` / TanStack) + `Empty` / `Skeleton` / `ApiErrorAlert` + row `DropdownMenu`.

- [ ] **Step 1: Implement list fetch** with query string built only from `cursor`, `pageSize`, `lifecycleStatus`.

- [ ] **Step 2: Columns** use only ProductVO fields: name, productId (+ CopyIdButton), categoryCode, dataMode, transport, /* model revision: omit until model GET wired — show "—" not a fake field */, lifecycleStatus badge, updatedAt, actions.

- [ ] **Step 3: Row actions** per lifecycle matrix in interaction spec; destructive flows use `ConfirmVersionActionDialog` + `VersionRequest { version: String(product.version) }` then refresh.

- [ ] **Step 4: Empty states** — no items vs client-filter miss vs error (with retry).

- [ ] **Step 5: Load more** — if `hasMore`, footer button uses `nextCursor` opaque; do not reset loaded items.

- [ ] **Step 6: Browser verify** — open `/thing-model/products`, filter lifecycle, copy ID, open menu. Desktop + narrow width.

- [ ] **Step 7: `npm run lint` + commit**

```bash
git commit -m "feat(thing-model): product list with lifecycle actions"
```

---

## Task 6: Create product wizard

**Files:**
- Create: `src/views/apps/thing-model/products/new/index.tsx`
- Create: `src/components/thing-model/create-product-wizard.tsx`
- Create: `src/components/thing-model/category-picker.tsx`

**UI:** full page 4 steps; shadcn `card`, `input`, `select`, `checkbox`/`toggle-group`, `radio-group`, `button`, `scroll-area`, `alert`.

- [ ] **Step 1: Category picker** — `GET /api/v1/categories` → build tree by `parentCode`; only `leaf === true` selectable; show `names`, `parentPath`, `leaf`; load versions via formal versions endpoint; **no** category CRUD controls.

- [ ] **Step 2: Steps 2–3 forms** bind **only** `CreateProductRequest` fields. Progressive disclosure: CUSTOM → `customAuthProviderId`; CUSTOM_PAYLOAD → `protocolProfile { profileId, profileVersion }` (published profiles only once Profile list exists; until then disable CUSTOM_PAYLOAD with honest message). Never render product secret fields.

- [ ] **Step 3: Step 4 submit**

```ts
// body: CreateProductRequest — exact fields only
await postFetcher("/api/v1/products", body);
// on success boolean: revalidate product list; toast neutral 「产品已提交成功」
// do NOT navigate by guessed productId
```

Button loading + disable double submit; preserve wizard state on error.

- [ ] **Step 4: Back navigation** keeps state; dirty leave guard on steps 2–4.

- [ ] **Step 5: Browser verify** — non-leaf blocked; CUSTOM_PAYLOAD without profile blocked; create succeeds and list refreshes.

- [ ] **Step 6: lint + commit**

```bash
git commit -m "feat(thing-model): create product wizard bound to CreateProductRequest"
```

---

## Task 7: Product workspace shell + lifecycle

**Files:**
- Create: `src/views/apps/thing-model/products/[productId]/layout shell` (or nested routes under `products/:productId`)
- Create: `src/components/thing-model/product-workspace-header.tsx`
- Create: overview / connection / versions placeholder views
- Wire publish Sheet (`sheet`), edit Dialog (`dialog`) using only UpdateProductRequest fields

- [ ] **Step 1: Load** `GET /api/v1/products/:productId` → header shows ProductVO fields only + LifecycleBadge + CopyIdButton.

- [ ] **Step 2: Tabs** to overview / model / connection / versions.

- [ ] **Step 3: Action matrix** from interaction spec; disabled + Tooltip reasons.

- [ ] **Step 4: Publish flow** — `POST .../publish/validate` → Sheet summary (do not invent checklist fields beyond boolean/error message) → `POST .../publish` with `VersionRequest` → GET product → update badge.

- [ ] **Step 5: disable/enable/deprecate/delete** via AlertDialog + VersionRequest + GET refresh / navigate list on delete.

- [ ] **Step 6: Connection tab** — DRAFT editable via UpdateProductRequest (include `version: String(product.version)`); PUBLISHED/DISABLED read-only. No secret fields.

- [ ] **Step 7: Browser verify** lifecycle transitions; 412 path if possible by stale version in mock.

- [ ] **Step 8: `npm run build` && `npm run lint` + commit**

```bash
git commit -m "feat(thing-model): product workspace shell and lifecycle flows"
```

---

## Task 8: Thing model editor (Phase 3)

**Files:** `src/components/thing-model/model-editor/*`, model tab view, extend MSW for `/model/**`

- [ ] Extend mock/handlers for Appendix A.2 paths only; response bodies must match ModelDraftVO / ThingModelDefinition field sets.
- [ ] Editor UI: Property/Action/Event tabs; left table / right detail; Schema builder + JSON; save PUT `ModelDraftSaveRequest`; validate/publish/discard/rollback/category-merge per interaction spec.
- [ ] **Do not** add dpId, vendor ids, or invented capability source fields.
- [ ] Browser verify save → validate → publish → versions; lint + commit.

---

## Task 9: Parser Profile (Phase 4)

- [ ] Types already in Task 1; add MSW for `/api/v1/parser-profiles` and version/test endpoints.
- [ ] List + workspace; mapping editor fields **only** from `ParserProfileMapping.MappingRule`: `code`, `type`, `sourcePath`, `direction`, `conversion.scale`, `conversion.offset` + root `codec`.
- [ ] Test panel binds `ParserProfileTestRequest` / displays `ParserProfileTestVO` fields only; show `failureSampleId` without a samples admin page.
- [ ] Browser verify; lint + commit.

---

## Task 10: Data Policy (Phase 5) + final acceptance

- [ ] MSW for `/api/v1/data-policies`; forms bind Create/Update + DataPolicyVO nested `telemetry` / `rawMessage` / `rulesEnabled` only.
- [ ] PRODUCT scope requires `productId`; rawMessage.enabled gates retention fields in UI without inventing API fields.
- [ ] Final: `npm run build`, `npm run lint`, deep-link refresh, dark/light, narrow tables, keyboard focus, reduced-motion.
- [ ] Commit.

---

## Self-Review (plan author)

| Spec area | Task coverage |
|-----------|---------------|
| API field fidelity | Global Constraints + Appendix A + Tasks 1–2, 6–10 |
| shadcn-only UI | Global + Task 3 |
| Product list / wizard / workspace | Tasks 5–7 |
| Model editor | Task 8 |
| Profile / Policy | Tasks 9–10 |
| No forbidden menus | Task 4 sidebar |
| Boolean then GET | Global + Tasks 2,5–7 |

No TBD placeholders in Tasks 1–7; Tasks 8–10 intentionally thinner but field-bound to Appendix A — expand to full step code when starting that phase if needed.
