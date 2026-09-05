# 爱车小精灵

“爱车小精灵”是一款面向个人车主的用车费用记录与分析应用。项目当前是基于 React 的本地响应式 Web 应用，长期目标是形成可稳定发布到 TestFlight，并最终通过 Apple App Store 审核的正式 iOS 产品。

> 当前阶段说明：仓库暂未包含 Xcode、Swift 或原生 iOS 工程，因此现阶段构建产物不能直接上传 TestFlight 或 App Store。涉及 iOS 技术路线、数据迁移、环境隔离、Signing 和发布配置的改造，需先完成影响评估后再实施。

GitHub：<https://github.com/battledao/car-expense-app>

## 当前功能

- 多车辆管理，支持燃油车、纯电动车和插电式混动车。
- 停车、洗车、高速及路桥费、违章、保养、维修、保险、年检、汽车用品、其他、加油和充电等记账场景。
- 首页总览、费用日历、数据分析、详细记录、能耗统计和车辆管理。
- 加油、充电数据及油耗、电耗、能源成本统计。
- 基于浏览器 IndexedDB 的本地数据持久化。
- 完整 JSON 备份导出、校验、合并导入和覆盖恢复。
- 电脑与手机浏览器响应式布局。

详细产品范围及验收标准以 [PRD.md](./PRD.md) 为准。

## 当前技术状态

| 项目 | 当前状态 |
| --- | --- |
| 产品版本 | PRD V1.7 |
| Web 包版本 | 0.1.0 |
| 前端 | React、TypeScript、Vite |
| 路由 | React Router |
| 本地数据库 | IndexedDB、Dexie |
| 数据校验 | Zod |
| 图表 | Recharts |
| 单元与组件测试 | Vitest、Testing Library、jsdom |
| 端到端测试 | Playwright |
| iOS 原生工程 | 尚未建立 |
| Xcode / Swift 版本 | 尚未确定 |
| iOS Deployment Target | 尚未确定 |
| Bundle Identifier | 尚未确定 |
| TestFlight / App Store 配置 | 尚未建立 |
| Backend / 云数据库 | 当前没有 |

## 项目结构

```text
.
├─ src/
│  ├─ App.tsx                 # 页面框架和主要模块
│  ├─ db.ts                   # Dexie 本地数据库
│  ├─ models.ts               # 业务数据模型
│  ├─ recordForm.ts           # 记账表单逻辑
│  ├─ calculations.ts         # 费用和能耗计算
│  ├─ backup.ts               # JSON 备份与恢复
│  └─ *.test.ts(x)            # 单元及组件测试
├─ tests/e2e/                 # Playwright 端到端测试
├─ PRD.md                     # 产品需求和验收标准
├─ HANDOFF.md                 # 项目交接信息
├─ package.json               # 依赖与运行脚本
├─ vite.config.ts
├─ vitest.config.ts
└─ playwright.config.ts
```

## 开发环境

当前开发环境需要：

- Node.js 和 npm。
- Windows、macOS 或 Linux 上的现代浏览器。
- 运行端到端测试时需要 Playwright 配置可访问的 Chrome。

仓库目前尚未固定 Node.js 版本。为保证构建可复现，正式建立 CI/CD 前应确定并锁定 Node.js LTS 版本。

## 安装依赖

首次克隆后，在项目根目录执行：

```powershell
npm ci
```

`npm ci` 会严格按照 `package-lock.json` 安装依赖。不要把 `node_modules/` 提交到 Git。

## 本地运行

电脑浏览器开发：

```powershell
npm run dev
```

默认地址：

```text
http://127.0.0.1:5173
```

同一局域网内使用手机浏览器验收：

```powershell
npm run dev:mobile
```

移动服务默认监听 `0.0.0.0:5174`。手机与电脑需处于同一可信局域网，并通过电脑的局域网 IP 访问：

```text
http://<电脑局域网IP>:5174
```

移动验收完成后应停止开发服务。不要将 Vite 开发服务器直接暴露到公网，也不要把它作为 Production 服务。

Windows 用户也可使用仓库中的 `启动运行App.bat` 和 `暂停运行App.bat` 管理本地开发服务。

## 测试与构建

运行单元及组件测试：

```powershell
npm run test
```

监听模式：

```powershell
npm run test:watch
```

运行端到端测试：

```powershell
npm run test:e2e
```

生成当前 Web Release 构建：

```powershell
npm run build
```

`npm run build` 只生成 Web 静态产物，不等同于 iOS Release Build、Xcode Archive 或 TestFlight Build。

每个重要功能至少需要覆盖正常路径、异常路径、边界条件和回归影响。禁止通过删除测试、跳过测试或降低验收标准使测试通过。

## 本地数据与备份

- 车辆、费用记录和设置保存在当前浏览器的 IndexedDB 中。
- 刷新页面或重新打开同一浏览器后，数据应继续存在。
- 不同浏览器、不同浏览器配置文件和不同设备不会自动共享数据。
- 更换浏览器或设备前，应先导出完整 JSON 备份，再在目标环境导入。
- 清理浏览器网站数据可能删除本地业务数据。
- 用户真实备份、数据库文件、测试人员真实数据和包含隐私信息的日志不得提交到 GitHub。

未来转为 iOS 本地数据库时，必须先设计 Schema Version、迁移、失败恢复和现有用户数据兼容方案。

## 环境与配置

当前项目没有 Backend，也尚未建立 Development、Staging / TestFlight 和 Production 三套配置。

在接入 API、云数据库、分析、崩溃上报或 AI 服务前，必须先完成：

- 独立环境配置方案。
- Xcode Build Configuration、Scheme 或 `xcconfig` 设计。
- Development、Staging / TestFlight 和 Production 服务隔离。
- Feature Flag、日志级别和第三方服务配置隔离。
- Release 与 TestFlight 环境校验。

不得通过手工修改大量源码切换环境。

## Secret 与 GitHub 安全

本项目采用开源 GitHub 仓库，禁止向代码、配置、测试、文档、日志、截图或 Git 历史提交任何真实 Secret 或用户隐私数据，包括但不限于：

- API Key、Token、Password、Credential 和私钥。
- 数据库账号、连接字符串和生产环境凭据。
- Apple 证书私钥、`.p12`、密码和私密签名文件。
- 用户真实账号、数据库备份、Crash Log 和包含隐私的截图。

客户端应用无法安全保存真正的服务器 Secret。未来需要调用 OpenAI 或其他私密第三方 API 时，应采用：

```text
iOS App → Backend → Third-party API
```

真实配置应存储在 Keychain、CI/CD Secrets、GitHub Actions Secrets、云端 Secret Manager 或未纳入版本控制的本地私有配置中。公开配置模板只能包含字段名称、示例格式和占位符。

如果 Secret 曾进入 Git 或 GitHub，必须将其视为安全事件：立即停用并轮换凭据，检查 Git 历史、Fork、PR、Actions 和缓存，再评估历史清理方案。

## iOS 与 App Store 路线

在进入 iOS 实现前，需要先评估并确认：

1. 采用原生 SwiftUI、Web 容器或其他可上线技术路线。
2. 当前 IndexedDB 数据如何迁移并兼容后续版本。
3. Development、Staging / TestFlight 和 Production 环境设计。
4. Bundle ID、最低 iOS 版本、版本号和 Build Number 规则。
5. Signing、Entitlements、权限申请和 Privacy Manifest。
6. Release Build、Archive、TestFlight 和 Production 发布流程。
7. Crash Reporting、日志、性能、生命周期及升级兼容策略。
8. App Store Review、隐私政策和 App Privacy 信息。

在完成以上决策及对应工程建设前，不应把当前 Web 构建描述为 App Store Ready。

## Release 基线

准备上传 TestFlight 或 App Store 前，至少需要确认：

- Debug、Staging / TestFlight 和 Release / Production 构建均可复现。
- Version、Build Number、Bundle ID、环境和 API 指向正确。
- Archive、Signing 和 Entitlements 正常。
- 核心功能、数据保存、后台恢复、强制退出重启及升级迁移通过 Smoke Test。
- 无可稳定复现的 Crash。
- 权限说明、Privacy Manifest、隐私政策和 App Privacy 信息一致。
- 仓库及 Git 历史没有新增 Secret、用户隐私数据或私密签名材料。
- Release Readiness Report 中不存在未解决的 Blocker 或 Critical。

正式部署流程将在 iOS 技术方案和工程配置明确后记录到 `DEPLOYMENT.md`。

## 文档维护

以下变化发生时，应在同一轮开发中评估并同步更新本 README：

- 技术栈、目录或核心架构变化。
- 安装、启动、构建或测试命令变化。
- 数据库模型、迁移或备份方案变化。
- 新增环境变量、配置文件、第三方服务或 Backend。
- 新增权限、隐私数据采集、Analytics 或 Crash Reporting。
- 建立或修改 iOS 工程、Xcode、Swift、Deployment Target 或 Bundle ID。
- 修改 Build Configuration、Scheme、Signing 或 Entitlements。
- TestFlight、App Store、CI/CD 或 Production 发布流程变化。
- 已知问题、版本状态或上线准备度发生明显变化。

文档只能记录公开安全的信息，不得包含真实 Secret、用户数据或内部敏感配置。

## 已知问题与待办

- 当前仍是本地 Web 应用，尚不能生成可上传 App Store 的 iOS Archive。
- 尚未确定 iOS 技术路线、最低系统版本、Bundle ID、Signing 和 Entitlements。
- 尚未建立 Development、Staging / TestFlight 和 Production 环境隔离。
- 尚未建立 CI/CD、Secret Scanner、iOS Release 测试和正式部署文档。
- `.gitignore` 目前主要覆盖 Web 构建和测试产物，建立 iOS 工程及环境配置前需要补充 Xcode、证书、私有 `xcconfig`、本地数据库和日志等忽略规则。
- 前端依赖当前使用 `latest` 范围，正式建立可复现 Release 流程前需要评估版本锁定和升级策略。
- Vite 构建当前可能提示 JavaScript bundle 超过 500 kB，需要在不影响功能的前提下持续关注启动性能和资源体积。

## 协作约定

- 产品需求修改先确认，再更新 PRD 版本和验收标准。
- 重要开发先理解现有架构并完成影响分析，优先采用最小必要改动。
- 每个开发阶段添加并运行有效测试，测试失败时先定位和修复。
- 用户验收完成并明确授权后，才能创建 Git 提交及推送 GitHub。
- 可能影响数据、架构、Release、TestFlight、App Store 或 Git 历史的大规模修改，必须先说明影响、风险和回滚方案。

项目交接和历史注意事项见 [HANDOFF.md](./HANDOFF.md)。

## License

仓库尚未添加开源许可证。在正式公开推广、接受外部贡献或发布可复用代码前，应确认并添加合适的 License。
