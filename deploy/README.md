# 前端镜像部署

GitHub Actions 在 main 推送或手动触发时检查 lint、执行生产构建，并发布 AMD64/ARM64 镜像：

- `ghcr.io/lanslot-moon/aiot-web:sha-<完整提交 SHA>`：用于固定部署版本及回滚。
- `ghcr.io/lanslot-moon/aiot-web:latest`：最近成功构建。

在镜像部署面板选择以上镜像，容器端口设为 `80`，将站点域名指向该服务并配置 HTTPS。
无需挂载存储卷。环境变量 `AIOT_GATEWAY_URL` 设置为可从容器访问的 IAM 网关源地址（协议、主机、端口，不含路径且不以斜杠结尾）。未设置时沿用当前项目已有网关地址。

Nginx 启动时生成配置，`/api/v1/` 转发网关，其余路径回退到 SPA。网关须允许该入口 Host；当前配置转发网关自己的 Host。

若 GHCR 包为私有，在部署面板配置有 read:packages 权限的拉取凭证。不要把凭证填入前端环境变量。

发布后检查登录页、直接访问 SPA 子路由、登录及项目列表，并确认 API 返回 JSON。TLS、域名和集群网络由部署环境验证。本流程只发布镜像，不执行集群部署。回滚时改用上一个成功构建的 SHA 标签或镜像摘要。
