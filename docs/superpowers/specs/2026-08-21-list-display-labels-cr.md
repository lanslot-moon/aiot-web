# 列表中文展示 — 字段 CR

> 日期：2026-08-21  
> 策略：枚举由前端映射中文；品类等业务名由后端返回显示字段。  
> 前端可先落类型/mock；后端接口由你补齐。

## 1. 前端映射即可（后端无需新字段）

| 场景 | 现有字段（code） | 前端展示 |
|------|------------------|----------|
| 项目状态 | `ProjectView.status` | 启用 / 已暂停 / 已归档 / 已关闭 |
| 我的角色 | `ProjectView.myRole` / `ProjectMemberView.role` | 所有者 / 管理员 / 开发者 / 只读成员 |
| 成员状态 | `membershipStatus` | 正常 / 已暂停 / 已移除 |
| 邀请状态 | `InvitationView.status` | 待接受 / 已接受 / 已拒绝 / 已过期 / 已撤销 |
| 授权状态 | `AuthorizationMetadataView.status` | 启用 / 已禁用 / 已吊销 |
| 产品生命周期 | `lifecycleStatus`（产品 VO） | 草稿 / 已发布 / 已停用 / 已废弃 |

筛选下拉：value 仍传英文 code，label 显示中文。

## 2. 后端需要新增的字段（品类等）

当前产品列表只有 `categoryCode`（如 `hvac.thermostat`），**无法稳定得到中文品类名**（品类树 `CategoryVO.names` 在另一资源上，列表不宜前端临时拼）。

### 建议：产品列表/详情 VO 增加

| 字段 | 类型 | 说明 |
|------|------|------|
| `categoryName` | `string` | 当前 UI 语言下的品类显示名（建议默认 `zh-CN`） |
| `categoryNames` | `Record<string, string>`（可选） | 多语言全量，如 `{ "zh-CN": "温控器", "en-US": "Thermostat" }` |

二选一即可；**最少只要 `categoryName`**。

若产品列表将来还要展示「节点类型 / 传输方式 / 数据模式」等枚举 code：

| 字段 | 说明 |
|------|------|
| 仍用现有 enum code | 前端映射即可，**不必**再加 `*Label` 字段 |

### 不建议

- 为每个枚举都加 `statusLabel` / `lifecycleStatusLabel`（易与多端文案漂移）  
- 前端只拿 `categoryCode` 写死一张大映射表（品类会增删）

## 3. 前端本次会做的

1. 增加统一的 label 映射工具（项目/角色/成员/邀请/授权/产品生命周期）。  
2. 列表、筛选、Badge、概览全部改中文。  
3. 类型与 mock **预留** `categoryName`（及可选 `categoryNames`），UI 优先显示 `categoryName`，没有则暂时回退「未命名品类」或 code（便于你 CR）。

你确认本 CR 后，后端按上表补字段即可。
