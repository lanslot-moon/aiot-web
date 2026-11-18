# OTA 版本规范与 Java 组件调查

调查日期：2026-11-18。范围：只读核对与选型，本次不修改前后端业务代码、不增加依赖。

## 建议

采用 **Semantic Versioning 2.0.0（SemVer，语义化版本）** 定义格式与顺序，Java 使用 `org.semver4j:semver4j` 解析、校验和比较。SemVer 是版本规范，库是实现；它们不等于完整的 OTA 协议，也不会替平台完成硬件兼容、源镜像匹配或降级授权。

## 标准约束

- 基本格式为 `MAJOR.MINOR.PATCH`，三段数字均不得有前导零。`1.0.0` 合法；`1.00`、`1.01`、`01.0.0` 不合法。
- 按数字段比较：`1.0.9 < 1.0.10`；不能按字符串、浮点数或创建时间比较。
- 预发布版低于对应正式版，例如 `1.1.0-rc.1 < 1.1.0`。
- `+build` 元数据不参与版本优先级；`1.1.0+100` 与 `1.1.0+101` 顺序相等。
- 标准要求已发布版本内容不可修改；变更应发布为新版本。

以上依据：[SemVer 2.0.0 第 2、3、9—11 条](https://semver.org/spec/v2.0.0.html)。

建议 OTA 默认禁止 `target <= source`，这是产品在 SemVer 顺序之上制定的业务规则，并非 SemVer 自带的 OTA 降级策略。只在同一固件模块和兼容硬件范围内比较；版本变大也不能证明固件一定兼容。

## Java 组件

官方 README 当前给出的依赖示例为 `org.semver4j:semver4j:6.0.0`，其自述为原 `vdurmont/semver4j` 的维护分支；接入时应锁定经过项目验证的版本。[官方仓库](https://github.com/semver4j/semver4j)

```java
import org.semver4j.Semver;

Semver source = Semver.parse(sourceVersion);
Semver target = Semver.parse(targetVersion);
if (source == null || target == null) {
    throw new IllegalArgumentException("固件版本须符合 SemVer 格式");
}
if (!target.isGreaterThan(source)) {
    throw new IllegalArgumentException("目标版本必须高于源版本");
}
```

`parse()` 遇到非法输入返回 `null`；构造器遇到非法版本会抛异常。`coerce()` 会尝试把非标准输入转换为合法版本，新录入时建议禁用此宽松路径。`compareTo()` 比较优先级，`equals()` 包含构建元数据，不能用两者混淆“同一版本字符串”与“同一优先级”。[官方 API 源码](https://github.com/semver4j/semver4j/blob/main/src/main/java/org/semver4j/Semver.java)

Maven 的 `ComparableVersion` 使用 Maven 自身排序规则；Maven 官方明确表示该规则不兼容 SemVer 2.0.0，包括构建元数据与大小写的处理差异。选择 SemVer 后，不宜混用此比较器。[Maven 版本顺序说明](https://maven.apache.org/pom.html#Version_Order_Specification)

## 本地后端现状

根代理对相邻 `aiot-cloud` 的只读检查发现：

- `aiot-ota-service/.../firmware/bo/req/RegisterFirmwareVersionReqBO.java` 的版本字段只有 `@NotBlank`，未限定 SemVer。
- `OtaFirmwareServiceImpl.registerVersion` 是版本录入路径，约第 122 行将 `versionScheme` 固定为 `EXACT`。
- `aiot-ota-biz/.../firmware/dto/resp/FirmwareVersionRespDTO.check` 校验模块、源版本文本与已发布状态，未比较版本先后。
- `CreateDeltaBuildReqBO` 只排除源目标 ID 相同，未比较版本高低。
- 本次对 POM 的文本搜索未找到 `semver`、`java-semver`、`maven-artifact`、`versioning`，不能据此断言所有传递依赖中都不存在相关库。
- Java 全仓文本搜索也未找到 `semver`、`ComparableVersion`、`VersionComparator`、`VersionUtil`。

接入前还需要明确旧数据迁移方式：历史 `1.00` 不应静默转成某个新编号；应先确认其真实版本含义，建立显式映射。新版本可以补录较低历史版本，但不能因录入较晚而获得更高升级顺序。
