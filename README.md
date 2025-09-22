# llmctl

🤖 **llmctl** 是一个专为 [Claude Code](https://claude.ai/code) 设计的 LLM Provider 配置管理工具，帮助您轻松切换不同的大模型配置。

## ✨ 特性

- 🎯 **简单易用** - 通过 CLI 命令轻松管理多个 LLM Provider 配置
- 🔄 **快速切换** - 一键切换不同的模型配置
- 🌍 **跨平台支持** - 完美支持 macOS、Linux 和 Windows
- ⚡ **环境变量导出** - 支持多种 shell 格式的环境变量导出
- 🛡️ **类型安全** - 基于 TypeScript 构建，提供完整的类型定义

## 📦 安装

```bash
# 全局安装
npm install -g llmctl

# 本地安装
npm install llmctl
npx llmctl --help
```

## 🚀 快速开始

### 1. 添加 Provider

```bash
# 首次运行会启动引导向导
llmctl

# 或直接添加 Anthropic Provider
llmctl add
```

### 2. 选择 Provider

```bash
# 交互式选择（会自动设置环境变量）
llmctl use

# 或直接指定（会自动设置环境变量）
llmctl use my-provider
```

### 3. 启动 Claude Code

```bash
# 环境变量已自动设置，直接启动
claude
```

## 📚 常用命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `llmctl add` | 添加新的 Provider | `llmctl add` |
| `llmctl list` | 列出所有 Providers | `llmctl list` |
| `llmctl edit <id>` | 修改 Provider 配置 | `llmctl edit my-claude` |
| `llmctl use <id>` | 选择 Provider | `llmctl use my-claude` |
| `llmctl current` | 显示当前 Provider | `llmctl current` |
| `llmctl export` | 导出环境变量 | `llmctl export` |
| `llmctl remove <id>` | 删除 Provider | `llmctl remove my-claude` |
| `llmctl template list` | 查看可用模板 | `llmctl template list` |
| `llmctl validate` | 验证配置 | `llmctl validate` |

更多详细命令说明请查看 [命令操作指南](COMMANDS.md)。

## 🔧 与 Claude Code 集成

### 基本集成流程

1. **配置 Provider**: `llmctl add`
2. **选择 Provider**: `llmctl use my-provider` (自动设置环境变量)
3. **启动 Claude Code**: `claude-code`

> **注意**: `llmctl use` 和 `llmctl add`（选择立即使用时）会自动设置环境变量，无需手动执行 `llmctl export`。

### 自动化脚本

#### Bash/Zsh

在 `~/.bashrc` 或 `~/.zshrc` 中添加：

```bash
# llmctl 自动加载
if command -v llmctl >/dev/null 2>&1; then
  if llmctl current --json 2>/dev/null | jq -e '.activeProvider' >/dev/null; then
    eval "$(llmctl export 2>/dev/null)"
  fi
fi
```

#### PowerShell

在 PowerShell 配置文件中添加：

```powershell
# llmctl 自动加载
if (Get-Command llmctl -ErrorAction SilentlyContinue) {
    $currentProvider = llmctl current --json 2>$null | ConvertFrom-Json
    if ($currentProvider.activeProvider) {
        llmctl export --format powershell | Invoke-Expression
    }
}
```

## 📁 配置文件

配置文件位置：
- **macOS/Linux**: `~/.config/llmctl/config.json`
- **Windows**: `%APPDATA%\llmctl\config.json`

## 🔍 故障排除

**环境变量未生效**
```bash
# 检查当前 Provider
llmctl current

# 验证配置
llmctl validate

# 重新选择 Provider（会自动设置环境变量）
llmctl use your-provider

# 或手动导出环境变量
llmctl export
```

**命令无法找到**
```bash
# 确保全局安装
npm install -g llmctl

# 检查是否在 PATH 中
which llmctl
```

## 🛠️ 开发

```bash
# 克隆项目
git clone https://github.com/3202336152/llmctl.git
cd llmctl

# 安装依赖
npm install

# 构建项目
npm run build

# 创建本地链接
npm link

# 运行测试
npm test
```

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE)。

---

**Happy Coding with llmctl! 🚀**