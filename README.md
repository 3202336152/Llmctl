# llmctl

**llmctl** 是一个通用的 LLM Provider 配置管理工具，帮助您轻松管理和切换不同大模型的配置，支持各种 CLI 平台和工具。

- 🎯 **简单易用** - 通过 CLI 命令轻松管理多个 LLM Provider 配置
- 🔄 **智能切换** - 一键切换不同的模型配置，自动设置环境变量
- 🔁 **多Token轮询** - 支持多Token负载均衡，提供4种轮询策略，自动故障切换
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
| `ctl token` | Token管理 - 支持多Token轮询配置 | `ctl token` |
| `ctl token add` | 快速添加Token到指定Provider | `ctl token add` |
| `ctl token list` | 查看Token列表和状态 | `ctl token list` |
| `ctl token strategy` | 设置Token轮询策略 | `ctl token strategy` |
| `ctl list` | 列出所有 Providers | `ctl list` |
| `ctl edit <id>` | 修改 Provider 配置 | `ctl edit my-claude` |
| `ctl current` | 显示当前 Provider | `ctl current` |
| `ctl export` | 手动导出环境变量（通常不需要，use/add会自动设置） | `ctl export` |
| `ctl remove <id>` | 删除 Provider | `ctl remove my-claude` |
| `ctl template list` | 查看可用模板 | `ctl template list` |
| `ctl validate` | 验证配置 | `ctl validate` |

更多详细命令说明请查看 [命令操作指南](COMMANDS.md)。

## 🔁 多Token轮询功能

llmctl 支持为单个Provider配置多个API Token，实现负载均衡和故障切换，提高API调用的稳定性和并发能力。

### ✨ 核心特性

- **🔄 四种轮询策略** - 支持轮询、加权轮询、随机选择、最少使用策略
- **🛡️ 故障自动切换** - 自动检测错误Token并切换到可用Token
- **📊 使用统计监控** - 实时监控Token使用情况和状态
- **⚙️ 简单易用管理** - 交互式界面轻松管理Token增删改查
- **🔧 向后兼容** - 完全兼容现有单Token配置

### 🚀 快速开始

```bash
# 进入Token管理界面
ctl token

# 或者指定Provider进行管理
ctl token my-claude-provider

# 快速添加Token
ctl token add

# 查看Token状态
ctl token list

# 设置轮询策略
ctl token strategy
```

### 📈 轮询策略说明

| 策略 | 描述 | 适用场景 |
|------|------|----------|
| **轮询 (Round Robin)** | 依次使用每个Token，循环轮换 | 所有Token性能相同时使用 |
| **加权轮询 (Weighted)** | 按权重比例分配请求，实现精确的负载分配 | 不同Token有不同限额或性能 |
| **随机选择 (Random)** | 随机选择可用Token | 简单场景，不需要精确控制 |
| **最少使用 (Least Used)** | 优先选择最久未使用的Token | 希望Token使用更均匀时使用 |

### 🔧 配置示例

```bash
# 1. 为现有Provider添加多个Token
ctl token my-claude-provider
# 选择 "添加Token" -> 输入Token和配置

# 2. 设置加权轮询策略
# Token1: 权重3 (高性能)
# Token2: 权重2 (中等性能)
# Token3: 权重1 (备用)
# 按3:2:1比例分配请求

# 3. 故障自动切换
# Token错误3次后自动禁用60秒
# 自动切换到健康Token继续服务
```

### 📊 监控和管理

```bash
# 查看详细统计信息
ctl token stats

# 重置错误计数
ctl token reset

# 编辑Token配置
ctl token edit
```

### 🎯 使用场景

- **提高可用性**: 单个Token故障时自动切换
- **负载均衡**: 多个Token分担API请求压力
- **成本优化**: 不同等级Token按需分配
- **开发测试**: 不同环境使用不同Token

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

## 📦 发布

如需发布新版本，请参考 [发布指南](PUBLISH.md)。

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE)。

---

**Happy Coding with ctl! 🚀**