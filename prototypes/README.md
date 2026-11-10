# OTA 组件原型

独立的本地交互原型，直接导入项目组件与主题。没有注册到生产路由，没有请求后台、上传文件或下发设备任务；刷新会恢复示例数据。

## 预览

运行 `npm run dev`，访问开发服务的 `/prototypes/ota.html`。

## 复用组件

- `DeviceTable` / `GatewayDataTable`：固件、升级包、批次和设备任务表，沿用 TanStack Table。
- `DeviceSection`、`DetailField`、`DeviceInput`：区域标题、属性和 36px 表单控件。
- `Button`、`Badge`、`Label`、`Checkbox`、`Select`：现有 Base UI / shadcn primitives。
- `Dialog`：模块、版本、包准备、验证选择、扩大灰度和操作确认。
- `Sheet`：设备任务详情与每轮执行记录。
- `globals.css`、Lyra 样式：项目原有主题；预览 CSS 仅处理容器和减少动态效果偏好。

组件与状态代码位于 `src/prototypes/ota`。未新增依赖或修改共享组件。原型状态使用本地 React 数据，后续接入应复用项目真实请求层和服务端批量／游标接口，禁止每行请求形成 N+1。

## 生成会话预览

`node prototypes/build-ota-preview.mjs <绝对输出路径.html>`

构建会直接打包同一份 React 源码及项目 CSS，内联输出限制在 1 MB 内，并移除外部字体请求。`ota-fragment.template.html` 是片段模板。生成文件不加入生产构建入口。

## 验证

已通过 `npm run lint`、`npm run build`。构建仍有项目现有 Vite 配置弃用与大分块提示。

浏览器验证脚本：`node prototypes/verify-ota-preview.cjs <绝对输出路径.html>`。通过环境变量 `PLAYWRIGHT_MODULE` 指向已有 Playwright 模块、`CHROME_PATH` 指向浏览器，不需要增加项目依赖。

覆盖新模块／版本上下文、全量和差分包、构建失败重试、不匹配样机禁选、验证失败恢复、动态模式预约限制、灰度与递增速率校验、激活失败保留批次、确认与重试轮次、暂停时扩大灰度保持暂停、320/390 像素布局及暗色详情抽屉。沙箱下未出现运行时或 CSP 错误。

## 明确的原型边界

- 固件文件和设备为示例，文件核验与设备结果通过独立“演示场景”推进。
- 源版本与硬件选择使用示例单选；生产接入需要按数组字段扩展多选和批量加载。
- 批次列表及配置当前由内存保存，查询、刷新恢复、权限、异步结果和全量统计仍需后端契约接入。
- 原型只提供云端主动推送，不暴露尚未确认的独占设备拉取开关或批次自定义重试参数。
