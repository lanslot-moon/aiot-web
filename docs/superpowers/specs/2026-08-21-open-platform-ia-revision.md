# 开放平台信息架构修订（产品主路径）

> 日期：2026-08-21  
> 状态：按用户反馈落地  
> 关联：`2026-08-20-open-platform-entry-interaction-design.md`（本修订覆盖其中「工作区页签权重」与「创建后落点」）

## 问题（IxD 批判）

| 原则 | 现状问题 | 后果 |
|------|----------|------|
| Visibility / Efficiency of the User | 创建 Project 后落在「概览」，页签并列成员/授权/用量/订阅 | 主任务「管产品」被设置类入口淹没 |
| Progressive disclosure | 项目设置与业务资源同级 | 开发者路径像进了后台配置台，不像涂鸦「进 Cloud Project → 做产品」 |
| Consistency with AGENTS/shadcn | 工作区自制页签样式偏多 | 应优先 `Tabs`/`Button`/`Empty`/`Card` 等 `ui/*` |

## 修订结论（对标涂鸦节奏，不照搬领域）

```text
侧边栏（全局）
└── Project                          ← 唯一业务入口

进入某 Project 后（工作区内）
├── 产品          ← 默认主路径（创建 Project 后直达）
├── 设备          ← 未发布占位（可发现、不可用或只读说明）
└── 设置          ← 二级：基本信息 / 成员 / API 授权 / 用量 / 订阅
```

- **侧边栏不出现**独立的「产品」「设备」菜单：二者跟随当前 Project。
- **创建成功 CTA**：进入 `/projects/:projectId/products`，不再进重设置向的 overview。
- **密钥引导**仍可在创建成功步展示，但主按钮文案改为「开始管理产品」。
- UI：工作区主导航与设置二级导航均用 `src/components/ui/tabs`（或同等 `ui/*`），不手绘页签条。

## 路由

| 用途 | 路径 |
|------|------|
| Project 列表 | `/projects` |
| 创建 | `/projects/new` |
| **产品（主）** | `/projects/:projectId/products` |
| 设备占位 | `/projects/:projectId/devices` |
| 设置-基本信息 | `/projects/:projectId/settings`（原 overview 内容） |
| 设置-成员 | `/projects/:projectId/members` |
| 设置-授权 | `/projects/:projectId/authorization` |
| 设置-用量/订阅 | `/projects/:projectId/usage`、`.../subscriptions` |
| 兼容旧链 | `/projects/:projectId/overview` → redirect settings；`.../thing-model/products` → redirect products |

## 主流程

```text
登录 → Project 列表 → 创建/打开 Project
  → 产品列表（主）
      → 创建产品 / 编辑物模型（沿用既有物模型交互，Project 作用域）
  → 设备（未发布）：Empty +「即将开放」说明
  → 设置：仅在需要成员/密钥/生命周期时进入
```

## 不做

- 不把设备做成可操作正式功能（本期占位）
- 不在侧边栏挂产品/设备
- 不恢复无 `projectId` 的全局产品列表双轨
