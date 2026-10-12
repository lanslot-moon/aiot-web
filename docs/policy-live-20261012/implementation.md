# Policy 前端真实接入与交互记录

日期：2026-10-12。后端拉取 origin/main，基线 adfc7e74a（由 f0e203317 快进）。未修改后端。

## 交互定位

沿用项目工作区、全局主题、表格与弹窗组件。默认进入自定义策略列表，普通标准接入不需要操作。取消产品默认策略创建/确认、预配自动绑定的旧原型流程。

自定义策略：设备通信与资源操作分开筛选。创建 → 编辑规则 → 保存草稿 → 服务端校验 → 发布 → 绑定。可视化编辑支持允许/禁止、MQTT 通道、管理资源范围；高级 JSON 保留条件和约束。已发布规则、草稿与绑定分开展示，避免把保存当成生效。版本支持定时发布、取消及从历史版本发布。维护操作包括元数据、归档和未发布草稿删除。

权限排查：MQTT 快照预览、有效策略来源、草稿/历史版本/当前实际权限模拟。明确区分“授权允许”与设备认证、在线状态或 Broker 已执行结果。

标准通信：只读协议说明，由后端 StandardMqttChannel 的 23 项定义同步展示。它不是实时授权结果，也不是持久化策略列表。实际权限通过预览接口获取。

## 接口和隔离

所有业务操作经已有 request 客户端访问 /api/v1 网关，复用登录与刷新；X-Project-Id 指定项目，由网关解析 tenantId。页面不伪造租户头、不调用内部接口。

使用最新契约：policy-actions 返回数组；分页参数 pageSize 最大 100，页面每页 20；createTime/updateTime；模拟结果不依赖已移除的 requestId。策略、草稿和绑定 revision 各自使用，删除采用查询参数，定时操作使用 epoch milliseconds。

SWR 缓存按登录会话及项目隔离，列表按条件和游标重新获取。读取失败显示重试，不回退示例数据。删除旧 preview-data、authorization-overview，不再用 sessionStorage 存储策略或浏览器内模拟判断。

产品选择读取真实产品列表；设备、静态组、账号等授权对象以明确类型及真实 ID 填写，由后端校验范围。尚未扩展成所有领域的综合对象搜索器。

## 验证

- Ran：npm run build，TypeScript 和生产构建通过。现有全应用大包警告仍存在。
- Ran：npm run lint，零警告。
- Ran：真实网关列表读取；创建联调草稿；保存规则后 revision 从 1 到 2；服务端校验通过。
- Ran：真实动作目录读取；仅草稿授权模拟 device:Read 返回 POLICY_ALLOWED，device:Delete 返回 POLICY_DEFAULT_DENY。模拟使用假设主体 ux-simulation-only 和假设资源 ux-simulation-resource，不创建这些实体。
- Ran：真实产品列表读取并选择智能灯光产品；未提交第二份草稿。375px 视口下页面内容宽度为 375px，无整页横向溢出，验证后已恢复默认视口。
- Manual：检查加载、空列表、按钮提交禁用、校验结果、详情/绑定/版本入口与发布确认弹窗。
- Ran：skill 状态扫描脚本。关键词扫描未识别 empty/selected/submitting；人工确认对应实现为中文空状态、aria-pressed、busy 禁用，不将关键词报告当成功能验收。
- Skipped：skill 自带 Playwright 烟测脚本，改用当前环境指定的 cua_repl 浏览器验证。
- Skipped：真实发布、绑定、撤销、删除、归档及版本切换写入；已接入对应接口，但本次未改变真实对象权限。
- Skipped：真实设备 MQTT/Broker 联调。
- Skill 的 ../../shared 文档在本地未找到。遵循已读技能的本地优先原则，未上传源码或截图到外部设计服务。

## 联调留存

当前项目保留未发布、未绑定的资源操作策略 UX联调草稿-20261012：
06GJYC6A99Y84RYHRWEHA4V7P4。
只包含 device:Read 对 aiot:device/* 的草稿规则；校验通过不意味着已生效。未删除用户既有记录。

## 边界

预览、模拟只展示 Policy 返回的授权判断，不宣称认证、设备状态投影恢复或 EMQX 在线 ACL 更新已经完成。

最终页面截图：policy-list.jpg；已校验草稿：draft-validated.jpg；允许模拟：simulation-allowed.jpg。
