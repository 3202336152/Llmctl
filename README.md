# llmctl

**llmctl** 是一个通用的 LLM Provider 配置管理工具，帮助您轻松管理和切换不同大模型的配置，支持各种 CLI 平台和工具。

- 🎯 **简单易用** - 通过 CLI 命令轻松管理多个 LLM Provider 配置
- 🔄 **智能切换** - 一键切换不同的模型配置，自动设置环境变量
- 🌍 **跨平台支持** - 完美支持 macOS、Linux 和 Windows
- 🚀 **CLI 工具集成** - 智能推荐并启动对应的 CLI 工具（Claude、Qwen、ChatGPT 等）
- ⚡ **多格式导出** - 支持 Bash、PowerShell、CMD、JSON 等多种环境变量导出格式
- 🛡️ **类型安全** - 基于 TypeScript 构建，提供完整的类型定义
- 🔧 **灵活配置** - 支持多种 LLM Provider（Claude、OpenAI、Qwen、Gemini 等）

## 📦 安装

```bash
# 全局安装
npm install -g llmctl

# 本地安装
npm install llmctl
npx ctl --help
```

## 🚀 快速开始

### 1. 添加 Provider

```bash
# 添加新的 Provider（支持交互式配置）
ctl add

# 系统会引导您：
# 1. 选择 Provider 类型（Claude、OpenAI、Qwen 等）
# 2. 输入配置信息（名称、API Key 等）
# 3. 询问是否立即使用（会自动设置环境变量）
# 4. 可选择启动 CLI 工具（claude、qwen 等）
```

### 2. 选择 Provider

```bash
# 交互式选择 Provider
ctl use

# 系统会：
# 1. 显示可用的 Providers 列表
# 2. 自动设置环境变量到当前进程
# 3. 询问是否启动 CLI 工具
# 4. 根据 Provider 类型智能推荐对应工具

# 或直接指定 Provider ID
ctl use my-claude-provider
```

### 3. 启动 CLI 工具

选择 Provider 后，系统会询问是否启动 CLI 工具：

- **Claude Provider**: 推荐启动 `claude` CLI
- **Qwen Provider**: 推荐启动 `qwen` CLI
- **OpenAI Provider**: 推荐启动 `chatgpt` CLI
- **Gemini Provider**: 推荐启动 `gemini` CLI

```bash
# 环境变量已自动设置，可直接使用
claude
# 或
qwen
```

## 📚 常用命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `ctl add` | 交互式添加 Provider，可选择立即使用并启动CLI工具 | `ctl add` |
| `ctl use <id>` | 选择 Provider，自动设置环境变量，可选择启动CLI工具 | `ctl use my-claude` |
| `ctl list` | 列出所有 Providers | `ctl list` |
| `ctl edit <id>` | 修改 Provider 配置 | `ctl edit my-claude` |
| `ctl current` | 显示当前 Provider | `ctl current` |
| `ctl export` | 手动导出环境变量（通常不需要，use/add会自动设置） | `ctl export` |
| `ctl remove <id>` | 删除 Provider | `ctl remove my-claude` |
| `ctl template list` | 查看可用模板 | `ctl template list` |
| `ctl validate` | 验证配置 | `ctl validate` |

更多详细命令说明请查看 [命令操作指南](COMMANDS.md)。

## 🔧 与 CLI 工具集成

### 智能集成流程

1. **配置 Provider**: `ctl add` - 选择模型类型和配置
2. **选择 Provider**: `ctl use my-provider` - 自动设置环境变量
3. **启动 CLI 工具**: 根据推荐选择对应工具（claude、qwen、gemini等）

> **🎯 智能特性**:
> - `ctl use` 和 `ctl add` 会自动设置环境变量到当前进程
> - 根据 Provider 类型智能推荐对应的 CLI 工具
> - 支持选择不启动 CLI 工具，并提供手动设置指导

### 完整使用示例

```bash
# 1. 添加 Qwen Provider
ctl add
# -> 选择 "Qwen" 类型
# -> 输入配置信息
# -> 选择 "是" 立即使用
# -> 自动设置环境变量
# -> 选择启动 "qwen" CLI 工具

# 2. 切换到 Claude Provider
ctl use claude-provider 或者 ctl use
# -> 自动设置环境变量
# -> 询问是否启动 CLI 工具
# -> 推荐启动 "claude" CLI（已标注推荐）

# 3. 如果选择不启动 CLI，会显示手动设置指导：
# 在 CMD 中使用以下方法：
# 1. 一键执行（推荐）：
#    ctl export --format cmd > env.bat && call env.bat
# 2. 分步执行：
#    ctl export --format cmd > llmctl-env.bat
#    call llmctl-env.bat
```

### 自动化脚本

#### Bash/Zsh

在 `~/.bashrc` 或 `~/.zshrc` 中添加：

```bash
# llmctl 自动加载
if command -v llmctl >/dev/null 2>&1; then
  if ctl current --json 2>/dev/null | jq -e '.activeProvider' >/dev/null; then
    eval "$(ctl export 2>/dev/null)"
  fi
fi
```

#### PowerShell

在 PowerShell 配置文件中添加：

```powershell
# llmctl 自动加载
if (Get-Command llmctl -ErrorAction SilentlyContinue) {
    $currentProvider = ctl current --json 2>$null | ConvertFrom-Json
    if ($currentProvider.activeProvider) {
        ctl export --format powershell | Invoke-Expression
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
ctl current

# 验证配置
ctl validate

# 重新选择 Provider（会自动设置环境变量并询问启动CLI工具）
ctl use your-provider

# 如果不想启动CLI工具，选择"否"后会显示手动设置指导
```

**命令无法找到**
```bash
# 确保全局安装
npm install -g llmctl

# 检查是否在 PATH 中
which ctl
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

**Happy Coding with ctl! 🚀**