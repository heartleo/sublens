# SubLens 实现计划

## 目标与当前基线

目标是把现有订阅追踪扩展升级为 Launcher First 的 AI Command Center，同时保留本地存储和订阅汇总。当前正式代码仍以 `src/popup/App.tsx` 的订阅卡片为主；`docs/launcher-preview.html` 仅是交互设计参考，不应成为产品数据源。

首版目录固定为 14 个工具：Chat 5、Create 3、Code 3、Platform 2、Research 1。v0、Sora、Windsurf、Adobe Firefly、Replit Agent、Poe、Elicit、Perplexity 暂不进入默认目录。

## 目标模块与 Seam

```text
Tool Catalog -> Search / Launcher -> openTool() -> chrome.tabs.create()
       |                                  -> Recent / Usage storage
       |
       +-> Subscription join <- Provider Registry <- Permission Manager
```

- `tools` 模块的 Interface 只暴露目录查询、搜索和按 ID 取工具。
- `launcher` 模块通过 `openTool(toolId)` 统一打开标签页并记录最近使用，不让 UI 直接处理副作用。
- `subscriptions` 模块按 `toolId` 与工具关联；每个 Provider 是一个 Adapter，端点、响应类型和认证细节保持局部。
- `permissions` 模块封装检查、申请和移除权限。申请必须由 Connect 按钮的用户手势触发。
- `storage` 模块使用 `chrome.storage.local` 和版本化迁移，不在正式代码中使用页面 `localStorage`。

建议的核心 Interface：

```ts
interface ToolDefinition {
  id: string;
  name: string;
  url: string;
  icon: string;
  category: "chat" | "create" | "code" | "platform" | "research";
  subcategory?: "image" | "video";
  aliases: string[];
  tags: string[];
}

interface SubscriptionProvider {
  id: string;
  toolId: string;
  permissions: { origins: string[]; named?: string[] };
  fetch(): Promise<SubscriptionInfo>;
}
```

## 分阶段交付

> 实现状态（2026-08-27）：Phase 0、v0.2、v0.4 已完成；v0.3 已完成搜索、键盘操作和
> Recent，Custom Tool 尚未实现；v0.5 仅完成使用次数与最近打开时间的数据基础；Commands、
> Omnibox、Most Used UI 和 v0.6 Prompt Router 尚未实现。

### Phase 0：基线清理

- 修复当前 `App.tsx` 的 ESLint Hook 错误，确保主分支四项检查可全绿。
- 给纯逻辑模块引入 Vitest；暂不增加重量级 UI 测试依赖。
- 记录当前订阅存储结构和迁移样本。

验收：`lint`、`format:check`、`typecheck`、`build` 全部通过。

### v0.2：Launcher Foundation

- 新增 `src/tools/types.ts`、`catalog.ts`、`search.ts`，录入 14 个默认工具。
- 新增 `src/launcher/openTool.ts`，使用 `chrome.tabs.create()` 打开工具并写入使用记录。创建新标签页本身不需要 `tabs` 权限。
- 拆分 `src/storage/`：`favorites.ts`、`recent.ts`、`usage.ts`、`subscriptions.ts`、`migration.ts`。
- 将设计稿迁移为 React：SearchBar、Favorites、CategoryGrid、ToolGrid、SubscriptionSummary。
- 支持收藏和取消收藏；首版默认收藏 ChatGPT、Claude、Cursor。

验收：14 个工具可打开；刷新扩展后收藏仍存在；320px 和 420px 无横向溢出；现有订阅信息仍可查看。

### v0.3：Fast Launcher

- 搜索覆盖名称、alias、category、subcategory 和 tags。
- popup 内支持 `Ctrl/Cmd + K` 聚焦搜索、方向键选择、Enter 打开、Esc 清空。
- 增加 Recent，最多保存 8 条，按最后打开时间排序并去重。
- 增加 Custom Tool，校验名称和 HTTPS URL；自定义工具不自动获得 Subscription Provider。

验收：`cla`、`code`、`video`、`research` 等查询结果稳定；全流程可只用键盘完成；空结果提供恢复建议。

### v0.4：Subscription-aware

- 为 Provider 增加 `toolId` 和权限声明，更新 `_template.ts`。
- 将订阅存储升级为版本 2，并从旧的 provider ID 键迁移。
- 把现有站点权限从 `host_permissions` 移到 `optional_host_permissions`；仅在 Connect 点击中调用 `chrome.permissions.request()`。
- Provider 请求统一使用目标站点 host 权限和 `credentials: include`；不读取、复制或保存会话 Cookie 值。
- popup 与 service worker 只刷新已授权 Provider；定时任务不得触发权限弹窗。
- 活跃订阅 Provider 保持为 ChatGPT、Claude、GitHub Copilot 与 Cursor；旧 Google One 快照只保留迁移兼容。

验收：未连接任何 Provider 时 Launcher 完整可用；每次连接只申请对应权限；拒绝权限后可恢复；升级后旧订阅缓存不丢失。

### v0.5：Power User

- 保存 launches 和 lastOpened，增加 Most Used 排序选项。
- 使用 Manifest `commands` 提供打开扩展的建议快捷键；popup 内的 `Ctrl/Cmd + K` 仍由页面处理。Chrome 只允许最多 4 个建议快捷键，且浏览器或系统快捷键可能优先。
- 增加 Omnibox 关键字 `ai`，在 `onInputChanged` 中返回目录建议，在 `onInputEntered` 中打开工具。

验收：快捷键可在 `chrome://extensions/shortcuts` 重映射；`ai claude` 等输入可打开正确工具；使用统计可清除。

### v0.6：Prompt Router

- Prompt 输入、目标工具选择、复制到剪贴板、打开目标工具。
- 不使用 undocumented prompt URL，不自动注入网页。
- 权限和失败状态在实现前按当前 Chrome 文档再次核对。

验收：用户手势内完成复制；目标页打开失败或剪贴板失败时给出明确恢复路径。

## 推荐 PR 顺序

1. `chore: restore green validation baseline`
2. `feat: add typed tool catalog and search`
3. `feat: add launcher storage and open-tool module`
4. `feat: ship launcher-first popup`
5. `feat: add recent custom tools and command palette`
6. `refactor: decouple subscription providers from tools`
7. `feat: request provider permissions on demand`
8. `feat: add usage ranking commands and omnibox`

每个 PR 都应保持扩展可构建、可加载，并附上受影响界面的前后截图。权限 PR 必须单独提交，便于审查安装警告和隐私文档变化。

## 验证矩阵

- 纯逻辑：catalog 唯一 ID、搜索排序、URL 校验、storage migration、权限状态机。
- UI：320/420px、深浅色、键盘焦点、空收藏、空搜索、权限拒绝、Provider 错误。
- 扩展：首次安装、版本升级、service worker 重启、定时刷新、离线缓存、卸载重装。
- 发布：检查 `dist/`、Manifest 权限、隐私文档、Chrome Web Store 截图和描述。

## 暂不实施

- 不接管 New Tab。
- 不增加大规模 AI Directory。
- 不为只有 Launcher 链接的工具申请 host 权限。
- 不在第一阶段实现 Prompt 自动填充、网页脚本注入或云端同步。

## Chrome 官方依据

- [Optional permissions](https://developer.chrome.com/docs/extensions/reference/api/permissions)：可在运行时申请声明过的可选权限，且申请必须来自用户手势。
- [Cookies API](https://developer.chrome.com/docs/extensions/reference/api/cookies)：读取 Cookie 需要 `cookies` 权限和对应 host 权限。
- [Tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs)：创建新标签页不要求 `tabs` 权限。
- [Commands API](https://developer.chrome.com/docs/extensions/reference/api/commands)：快捷键在 Manifest 中声明，建议快捷键数量和组合存在限制。
- [Omnibox API](https://developer.chrome.com/docs/extensions/reference/api/omnibox)：通过 Manifest 关键字和输入事件提供地址栏建议。
