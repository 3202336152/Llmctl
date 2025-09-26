# ctl 命令操作指南

本指南详细介绍 ctl 工具的所有命令和使用方法。

## 📚 目录

- [基础命令](#基础命令)
- [Provider 管理](#provider-管理)
- [会话管理](#会话管理)
- [Token 切换](#token-切换)
- [Token 管理](#token-管理)
- [环境变量导出](#环境变量导出)
- [配置验证](#配置验证)
- [模板管理](#模板管理)
- [高级使用](#高级使用)
  - [开发和调试](#开发和调试)
- [最佳实践](#最佳实践)
- [故障排除](#故障排除)

## 基础命令

### `ctl` (无参数)
首次运行时启动引导向导，帮助您配置第一个 Provider。

```bash
ctl
```

**输出示例：**
```
🎉 欢迎使用 ctl！
🔍 检测到您还没有配置任何 LLM Provider
🚀 让我们开始配置您的第一个 Provider...
```

### `ctl --help` / `ctl -h`
显示帮助信息和所有可用命令。

```bash
ctl --help
```

### `ctl --version` / `ctl -V`
显示当前版本信息。

```bash
ctl --version
```

## Provider 管理

### `ctl add` - 添加 Provider

#### 交互式添加 (推荐)
```bash
ctl add
```

**交互流程：**
1. 选择 Provider 类型 (目前支持 Anthropic)
2. 输入 Provider 名称 (会自动生成 ID)
3. 输入描述 (可选)
4. 确认或自定义 Provider ID
5. 输入 Base URL
6. 输入 API Token
7. 输入模型名称 (ANTHROPIC_MODEL，可选)
8. 输入最大输出Token数 (CLAUDE_CODE_MAX_OUTPUT_TOKENS，可选)
9. 选择是否立即使用该 Provider (会自动设置环境变量)

**示例对话：**
```
🔧 配置 LLM API 配置:

? 请输入 Provider 名称: 我的Claude配置
? 请输入 Provider 描述 (可选): 日常开发使用
🆔 使用 Provider ID: wo-de-claude-pei-zhi
? 请输入 API URL: https://api.lycheeshare.com
? 请输入 API Token: [隐藏输入]
? 请输入模型名称 (ANTHROPIC_MODEL，可选): claude-sonnet-4-20250514
? 请输入最大输出Token数 (CLAUDE_CODE_MAX_OUTPUT_TOKENS，可选): 8000
✅ 成功添加 Provider: 我的Claude配置
? 是否立即选择此 Provider 作为当前使用的 Provider? Yes
🎯 已选择 "我的Claude配置" 作为当前 Provider
🔄 正在自动设置环境变量...
即将设置的环境变量:
  ANTHROPIC_AUTH_TOKEN=********...
  ANTHROPIC_BASE_URL=https://api.lycheeshare.com
  ANTHROPIC_MODEL=claude-sonnet-4-20250514
  CLAUDE_CODE_MAX_OUTPUT_TOKENS=8000

✅ 已自动设置 4 个环境变量
```

#### 使用特定模板
```bash
ctl add --template anthropic
```

#### 查看可用模板
```bash
ctl add --list-templates
```

**输出示例：**
```
📋 可用的 Provider 模板:

1. LLM API 配置
   ID: anthropic
   描述: 配置大语言模型 API (支持 Claude、GLM、Qwen 等)
   环境变量: ANTHROPIC_AUTH_TOKEN, ANTHROPIC_BASE_URL, ANTHROPIC_MODEL
```

### `ctl list` / `ctl ls` - 列出 Providers

#### 基本列表
```bash
ctl list
```

**输出示例：**
```
📋 已配置的 LLM Providers:

🎯 wo-de-claude-pei-zhi (我的Claude配置) - 当前使用
   类型: Anthropic Claude
   Base URL: https://api.lycheeshare.com

   gong-zuo-yong-claude (工作用Claude)
   类型: Anthropic Claude
   Base URL: https://api.anthropic.com
```

#### 详细信息
```bash
ctl list --verbose
```

#### JSON 格式输出
```bash
ctl list --json
```

### `ctl use` - 选择 Provider

#### 交互式选择
```bash
ctl use
```

**交互示例：**
```
? 请选择要使用的 Provider:
❯ wo-de-claude-pei-zhi (我的Claude配置) - 当前使用
  gong-zuo-yong-claude (工作用Claude)

✅ 已选择 "工作用Claude" 作为当前 Provider
🔄 正在自动设置环境变量...
即将设置的环境变量:
  ANTHROPIC_AUTH_TOKEN=********...
  ANTHROPIC_BASE_URL=https://api.anthropic.com
  ANTHROPIC_MODEL=

✅ 已自动设置 2 个环境变量
```

#### 直接指定 Provider
```bash
ctl use gong-zuo-yong-claude
```

**输出示例：**
```
✅ 已选择 "工作用Claude" 作为当前 Provider
🔄 正在自动设置环境变量...
即将设置的环境变量:
  ANTHROPIC_AUTH_TOKEN=********...
  ANTHROPIC_BASE_URL=https://api.anthropic.com

✅ 已自动设置 2 个环境变量
```

> **注意**: `ctl use` 会自动设置环境变量，无需手动执行 `ctl export`。

#### 显示可选择的列表
```bash
ctl use --list
```

### `ctl edit` / `ctl update` - 修改 Provider 配置

#### 交互式修改
```bash
ctl edit
```

**交互示例：**
```
? 请选择要修改的 Provider:
❯ GLM (glm) - glm4.5模型
  QWEN (qwen) - Qwen模型

🔧 修改 Provider: GLM

📋 当前配置:
   配置名称: GLM
   配置描述: glm4.5模型
   API地址: https://api.example.com
   API密钥: sk-lycheeshare-abc123def456

? 请选择要修改的字段:
❯ ✓ 配置名称 (当前: GLM)
  ✓ API地址 (当前: https://api.example.com)
  ✓ API密钥 (当前: sk-lycheeshare-abc123def456)

? 请输入新的 配置名称: GLM-4.5
? 请输入新的 API地址: https://api.newprovider.com
? 请输入新的 API密钥: [隐藏输入]
✅ 成功修改 Provider: GLM-4.5
```

#### 直接修改指定 Provider
```bash
ctl edit glm
ctl update qwen
```

#### 支持修改的字段
- **配置名称** - Provider 显示名称
- **配置描述** - Provider 描述信息
- **API地址** - API 接口地址
- **API密钥** - API 认证密钥
- **模型名称** - ANTHROPIC_MODEL 环境变量（可选）
- **最大输出Token数** - CLAUDE_CODE_MAX_OUTPUT_TOKENS 环境变量（可选）

**注意事项：**
- 修改会自动验证配置有效性
- 如果修改的是当前使用的 Provider，建议使用 `ctl use` 重新选择以自动更新环境变量
- 所有修改都会保存到配置文件中

### `ctl current` - 显示当前 Provider

#### 基本信息
```bash
ctl current
```

**输出示例：**
```
🎯 当前使用的 Provider:

ID: wo-de-claude-pei-zhi
名称: 我的Claude配置
描述: 日常开发使用
类型: Anthropic Claude
Base URL: https://api.lycheeshare.com
```

#### 详细信息
```bash
ctl current --verbose
```

#### JSON 格式
```bash
ctl current --json
```

### `ctl remove` / `ctl rm` - 删除 Provider

#### 交互式删除
```bash
ctl remove
```

**交互示例：**
```
? 请选择要删除的 Provider:
  wo-de-claude-pei-zhi (我的Claude配置) - 当前使用
❯ gong-zuo-yong-claude (工作用Claude)

⚠️  删除 Provider 将无法恢复！
? 确认删除 Provider "gong-zuo-yong-claude"? Yes
✅ 成功删除 Provider: gong-zuo-yong-claude
```

#### 直接删除指定 Provider
```bash
ctl remove gong-zuo-yong-claude
```

#### 强制删除 (无确认提示)
```bash
ctl remove gong-zuo-yong-claude --force
```

#### 删除所有 Providers (危险操作)
```bash
ctl remove --all
```

## 会话管理

llmctl 提供智能的CLI会话管理功能，自动跟踪和管理当前运行的CLI工具会话。

### `ctl sessions` - 查看活跃会话

#### 显示所有活跃会话
```bash
ctl sessions
```

**输出示例：**
```
📊 活跃的CLI会话:

🔹 Claude (claude):
   1. PID: 12345 | 运行: 25分钟 | 最后活动: 2分钟前
      目录: /home/user/project-a
      命令: ctl-use

   2. PID: 12678 | 运行: 15分钟 | 最后活动: 1分钟前
      目录: /home/user/project-b
      命令: ctl-use

🔹 GLM (glm):
   1. PID: 12890 | 运行: 5分钟 | 最后活动: 30秒前
      目录: /home/user/project-c
      命令: ctl-use
```

**会话信息说明：**
- **PID**: 进程标识符，用于唯一识别会话
- **运行时间**: 会话启动到现在的时间
- **最后活动**: 最后一次记录活动的时间
- **目录**: CLI会话的工作目录（自动保存）
- **命令**: 启动CLI的命令类型

#### 无活跃会话时的输出
```bash
ctl sessions
```

**输出示例：**
```
📭 当前没有活跃的CLI会话

💡 提示：
  - 使用 ctl use 启动CLI工具后会自动注册会话
  - 会话会在CLI进程结束时自动清理
```

### 会话自动管理

#### 会话注册
```bash
# 当您使用 ctl use 选择Provider并启动CLI时
ctl use my-claude-provider

# 系统会：
# 1. 自动注册会话信息
# 2. 保存当前工作目录
# 3. 记录Provider信息
# 4. 跟踪进程PID
```

#### 会话清理
- **自动清理**: 当CLI进程结束时，会话自动从列表中移除
- **进程检测**: 系统会定期检测进程是否仍在运行
- **非持久化**: 会话信息不会永久保存，重启系统后会自动清空

## Token 切换

llmctl 的Token切换功能专门为解决Token额度用完时的快速切换需求而设计，支持智能会话管理和无缝重启。

### `ctl switch-token` - 智能Token切换

#### 交互式切换（推荐）
```bash
ctl switch-token
```

**完整交互流程：**
```
📋 选择要切换Token的Provider (仅显示有活跃会话的):

> Claude (8个Token) - 2个活跃会话
  GLM (单Token) - 1个活跃会话
  取消

🔄 正在为 "Claude" 切换Token...
✅ Token切换成功
📍 当前Token: backup-token (sk-ant-...)

🔍 检测到 2 个活跃的 Claude CLI会话
⚠️  由于CLI工具会缓存Token，需要重启才能使用新Token

📋 请选择要重启的会话:
> 会话1: PID 12345 | 目录: /home/user/project-a | 运行: 25分钟
  会话2: PID 12678 | 目录: /home/user/project-b | 运行: 15分钟
  🔄 重启所有会话
  ❌ 取消操作

🔄 开始自动重启CLI进程...
正在终止进程 12345...
✅ 已终止进程 12345
🚀 在新窗口启动CLI，工作目录: /home/user/project-a
✅ 会话已重启，请查看新打开的CLI窗口
💡 可以手动关闭原始窗口，新Token已在新窗口中生效

🎉 Token切换完成！
💡 新Token已在新窗口中生效，可以手动关闭原始窗口
```

#### 直接指定Provider切换
```bash
ctl switch-token claude-provider
```

**输出示例：**
```
🔄 正在为 "Claude Provider" 切换Token...
✅ Token切换成功
📍 当前Token: main-token (sk-ant-...)

🔍 检测到 1 个活跃的 Claude CLI会话
⚠️  由于CLI工具会缓存Token，需要重启才能使用新Token

🔄 开始自动重启CLI进程...
正在终止进程 12345...
✅ 已终止进程 12345
🚀 在新窗口启动CLI，工作目录: /home/user/project-a
✅ 会话已重启，请查看新打开的CLI窗口
💡 可以手动关闭原始窗口，新Token已在新窗口中生效
```

### Token切换核心特性

#### 🔍 智能会话检测
- **活跃会话过滤**: 只显示有正在运行CLI会话的Provider
- **精确会话识别**: 通过PID准确识别每个CLI进程
- **实时状态检测**: 自动过滤已结束的会话

#### 📁 工作目录保护
- **自动保存**: 在启动CLI时自动保存工作目录
- **精确恢复**: 重启时在相同目录中启动新CLI
- **多项目支持**: 支持在不同目录中运行多个CLI实例

#### 🖥️ 多会话管理
- **选择性重启**: 可以选择重启特定会话或所有会话
- **并发支持**: 同时管理多个不同Provider的会话
- **独立操作**: 各个会话之间互不影响

#### 🚀 自动重启机制
- **进程终止**: 优雅终止旧的CLI进程
- **新窗口启动**: 在系统新窗口中启动CLI
- **Token生效**: 新CLI自动使用切换后的Token
- **用户友好**: 提供清晰的操作提示和状态反馈

### 使用场景详解

#### 场景1: 单会话Token切换
```bash
# 当Claude CLI遇到quota exceeded错误时
# 1. 保持Claude CLI窗口不动，新开终端
# 2. 执行Token切换
ctl switch-token

# 3. 选择Claude Provider（如果只有一个活跃会话会自动处理）
# 4. 系统自动切换Token并重启CLI
# 5. 新CLI窗口会在相同目录中启动
# 6. 旧窗口可以手动关闭
```

#### 场景2: 多会话选择性切换
```bash
# 同时运行多个项目的Claude CLI：
# - Project A: /home/user/project-a (PID: 12345)
# - Project B: /home/user/project-b (PID: 12678)

ctl switch-token

# 选择Claude Provider后会显示：
# > 会话1: PID 12345 | 目录: /home/user/project-a | 运行: 25分钟
#   会话2: PID 12678 | 目录: /home/user/project-b | 运行: 15分钟
#   🔄 重启所有会话
#   ❌ 取消操作

# 可以选择只重启Project A的会话，Project B不受影响
```

#### 场景3: 多Provider环境
```bash
# 同时使用Claude和GLM：
ctl switch-token

# 只显示有活跃会话的Provider：
# > Claude (8个Token) - 2个活跃会话
#   GLM (单Token) - 1个活跃会话

# 可以分别为不同Provider切换Token，互不影响
```

### Token切换最佳实践

#### 1. 预防性Token管理
```bash
# 定期检查Token状态，避免运行时中断
ctl token list

# 确保每个Provider都配置了多个Token
ctl token add
```

#### 2. 会话状态监控
```bash
# 定期查看活跃会话
ctl sessions

# 及时清理无用的会话（通常会自动清理）
```

#### 3. 工作流集成
```bash
# 建议的错误处理工作流：
# 1. Claude CLI报quota exceeded
# 2. Ctrl+N 或 Cmd+T 新开终端标签
# 3. ctl switch-token
# 4. 选择对应Provider和会话
# 5. 等待新窗口启动
# 6. 关闭旧窗口，继续工作
```

#### 4. 团队协作
- **统一Token管理**: 团队成员使用相同的Provider配置结构
- **会话隔离**: 不同项目使用不同工作目录，避免混淆
- **Token轮换**: 定期更新和轮换Token，保持配置同步

### 错误处理和故障排除

#### 常见问题1: 找不到活跃会话
```bash
ctl switch-token
# 输出：📭 当前没有活跃的CLI会话

# 解决方案：
# 1. 先启动CLI工具
ctl use your-provider
# 2. 选择启动CLI工具
# 3. 然后再执行Token切换
```

#### 常见问题2: 工作目录丢失
```bash
# 如果重启后目录不对，说明会话信息丢失
# 解决方案：
# 1. 使用绝对路径重新启动CLI
cd /correct/project/path
ctl use your-provider

# 2. 或者在switch-token时手动指定目录
# 系统会询问您选择正确的目录
```

#### 常见问题3: 新窗口没有启动
```bash
# 如果自动启动失败，会显示手动操作指导：
# ⚠️  启动新窗口失败，请手动执行: ctl use your-provider

# 解决方案：
# 1. 手动打开新终端
# 2. cd 到正确目录
# 3. 执行 ctl use your-provider
```

## 环境变量导出

### `ctl export` - 导出环境变量

#### 自动检测格式并导出
```bash
ctl export
```

#### 预览导出内容 (不实际设置)
```bash
ctl export --dry-run
```

**输出示例：**
```
🔍 将要导出的环境变量:

ANTHROPIC_AUTH_TOKEN=sk-lycheeshare-...
ANTHROPIC_BASE_URL=https://api.lycheeshare.com

📝 在 bash/zsh 中使用: ctl export
📝 在 PowerShell 中使用: ctl export --format powershell | Invoke-Expression
📝 在 CMD 中使用: ctl export --format cmd > env.bat && call env.bat
```

#### 指定格式导出

**Bash/Zsh 格式:**
```bash
ctl export --format bash
```

**PowerShell 格式:**
```bash
ctl export --format powershell
# 使用方式：
ctl export --format powershell | Invoke-Expression
```

**Windows CMD 格式:**
```bash
ctl export --format cmd
# 使用方式：
ctl export --format cmd > env.bat && call env.bat
```

**JSON 格式:**
```bash
ctl export --format json
```

#### 导出指定 Provider 的环境变量
```bash
ctl export --provider gong-zuo-yong-claude
```

#### 验证导出的环境变量
```bash
ctl export --validate
```

## 配置验证

### `ctl validate` - 验证配置

#### 验证当前配置和活跃 Provider
```bash
ctl validate
```

**输出示例：**
```
🔍 验证配置和 Providers...

✅ 配置文件结构正确
✅ 当前 Provider "wo-de-claude-pei-zhi" 配置有效
✅ 环境变量完整
✅ API Token 格式正确
✅ Base URL 格式正确

🎉 所有验证通过！
```

#### 仅验证配置文件
```bash
ctl validate --config
```

#### 验证指定 Provider
```bash
ctl validate --provider wo-de-claude-pei-zhi
```

#### 验证所有 Providers
```bash
ctl validate --all
```

#### JSON 格式输出
```bash
ctl validate --json
```

## 模板管理

### `ctl template` / `ctl templates` - 管理 Provider 模板

#### 列出所有模板
```bash
ctl template list
ctl templates ls
```

**输出示例：**
```
📋 可用的 Provider 模板 (1):

1. LLM API 配置
   ID: anthropic
   描述: 配置大语言模型 API描述 (支持 Claude、GLM、Qwen 等)
   环境变量: ANTHROPIC_AUTH_TOKEN, ANTHROPIC_BASE_URL, ANTHROPIC_MODEL, CLAUDE_CODE_MAX_OUTPUT_TOKENS
```

#### JSON 格式输出
```bash
ctl template list --json
```

#### 查看模板详情
```bash
ctl template show anthropic
ctl template info anthropic
```

**输出示例：**
```
📄 模板详情: LLM API 配置

ID: anthropic
名称: LLM API 配置
描述: 配置大语言模型 API描述 (支持 Claude、GLM、Qwen 等)

环境变量:
  ANTHROPIC_AUTH_TOKEN: (用户配置)
  ANTHROPIC_BASE_URL: https://api.lycheeshare.com
  ANTHROPIC_MODEL: (可选)
  CLAUDE_CODE_MAX_OUTPUT_TOKENS: (可选)

默认值:
  baseUrl: https://api.lycheeshare.com
  modelName: (空值，仅中转时需要配置)
  maxTokens: 4096
  temperature: 0.7

配置项:
  1. 请输入 API URL:
     类型: input
     必填: 否

  2. 请输入 API Token:
     类型: password
     必填: 是

  3. 请输入模型名称 (ANTHROPIC_MODEL，仅中转时需要):
     类型: input
     必填: 否
     默认值: (空值)
```

#### 创建自定义模板
```bash
ctl template create
ctl template new
```

**创建流程：**
```
🎨 创建自定义 Provider 模板

? 请输入模板 ID: openai
? 请输入模板名称: OpenAI GPT
? 请输入模板描述: OpenAI GPT 模型配置

🔧 配置环境变量:
? 请输入环境变量名称: OPENAI_API_KEY
? 请输入默认值 (留空表示用户配置):
? 是否继续添加环境变量? No

📝 配置用户输入项:
? 请选择输入类型: 密码输入
? 请输入字段名称: apiKey
? 请输入提示文本: 请输入 OpenAI API Key:
? 请输入默认值 (可选):
? 是否必填? Yes
? 是否继续添加输入项? No

✅ 模板创建完成！
```

**模板类型支持：**
- **文本输入** - 普通文本字段
- **密码输入** - 隐藏输入的敏感信息
- **确认选择** - 是/否选择
- **单选列表** - 单选选项
- **多选列表** - 多选选项

**注意事项：**
- 自定义模板会生成 JSON 配置和示例代码
- 需要通过编程方式注册到系统中
- 模板 ID 只能包含小写字母、数字、连字符和下划线
- 环境变量名称应使用大写字母、数字和下划线

## Token 管理

llmctl 支持为单个Provider配置多个API Token，实现负载均衡和故障切换。

### `ctl token` - Token 管理主命令

#### 进入交互式管理界面
```bash
ctl token                     # 选择 Provider 后进入管理界面
ctl token my-claude-provider  # 直接管理指定 Provider 的 Token
```

**交互界面包含:**
```
🔧 Token管理 - 我的Claude配置
axian ⭐ [当前使用] | 📊 4/5可用 | 🔄 轮询策略

选择操作:
> 🚫 禁用当前Token (axian)
  📋 Token列表 (4✅ 1❌)
  ➕ 添加Token
  📦 批量操作
  ⚙️ 高级设置 (3项)
  🚪 退出
```

### `ctl token add` - 添加 Token

#### 快速添加模式
```bash
ctl token add                     # 选择 Provider 后添加
ctl token my-claude-provider add  # 为指定 Provider 添加
```

**配置示例:**
```
➕ 添加新Token

? 请输入Token值: [隐藏输入]
? Token别名 (可选，方便识别): backup-token
? 权重 (1-10，用于加权轮询): 2

✅ Token添加成功 (backup-token)
💡 Token默认启用并加入轮询池
```

**配置项说明:**
- **Token值**: API Token字符串（必填，输入时会被掩码）
- **别名**: Token的友好名称（可选，建议设置便于管理）
- **权重**: 1-10的数字，用于加权轮询策略，权重越高使用频率越高，默认启用并直接加入轮询池

### `ctl token list` - 查看 Token 列表

#### 显示 Token 状态
```bash
ctl token list                     # 选择 Provider 后查看
ctl token my-claude-provider list  # 查看指定 Provider 的 Token
```

**输出示例:**
```
📋 Token列表

1. main-token ⭐ [当前使用]
   Token: sk-ant-01...
   权重: 3 | 状态: [已启用]

2. backup-token
   Token: sk-ant-02...
   权重: 2 | 状态: [已启用]

3. test-token
   Token: sk-ant-03...
   权重: 1 | 状态: [已禁用]
```

**状态说明:**
- **[已启用]** - Token处于启用状态，可用于轮询
- **[已禁用]** - 手动禁用的Token，不参与轮询

### `ctl token strategy` - 设置轮询策略

#### 配置轮询策略
```bash
ctl token strategy                     # 选择 Provider 后设置
ctl token my-claude-provider strategy  # 为指定 Provider 设置策略
```

**配置示例:**
```
? 选择轮询策略:
❯ 🔄 轮询 (Round Robin) - 依次使用每个Token
  ⚖️  加权轮询 (Weighted) - 按权重分配使用频率
  🎲 随机选择 (Random) - 随机选择Token
  📊 最少使用 (Least Used) - 优先使用最少使用的Token

? 最大重试次数 (1-10): 3

✅ 轮询策略已设置为: 加权轮询
```

#### 轮询策略详解

##### 🔄 轮询 (Round Robin)
- **工作原理**: 按顺序循环使用每个Token
- **适用场景**: 所有Token性能相同，需要均匀分配
- **示例**: Token1 → Token2 → Token3 → Token1 → ...

##### ⚖️ 加权轮询 (Weighted Round Robin)
- **工作原理**: 根据权重精确分配请求比例
- **适用场景**: Token有不同限额或性能等级
- **示例**: 权重3:2:1的三个Token，按照3:2:1的比例分配请求
- **算法**: 实现了真正的WRR算法，确保精确按比例分配

##### 🎲 随机选择 (Random)
- **工作原理**: 随机选择可用Token
- **适用场景**: 简单场景，不需要精确控制
- **特点**: 完全随机，长期使用趋于均匀

##### 📊 最少使用 (Least Used)
- **工作原理**: 优先选择最久未使用的Token
- **适用场景**: 希望Token使用更加均匀
- **特点**: 基于最后使用时间戳选择

#### 策略参数配置

**最大重试次数 (maxRetries)**
- 范围: 1-10次
- 默认: 3次
- 说明: 当Token出错时，最多重试几次后切换到下一个Token

### Token 高级管理

#### 编辑 Token
在交互界面中选择"编辑Token":
```
? 选择要编辑的Token:
❯ main-token (sk-ant-01...) - 权重:3
  backup-token (sk-ant-02...) - 权重:2
  test-token (sk-ant-03...) - 权重:1 [已禁用]

? Token别名: main-token
? 权重 (1-10): 5
? 是否启用该Token? Yes

✅ Token更新成功
```

#### 删除 Token
```
? 选择要删除的Token:
  main-token (sk-ant-01...)
❯ backup-token (sk-ant-02...)

? 确认删除Token "backup-token"? Yes

✅ Token删除成功
```

**特殊情况:**
- 删除最后一个Token时会提示回到单Token模式
- 删除前会显示确认提示防止误操作

#### 重置错误计数
```bash
# 在交互界面中选择"重置错误计数"
# 重置所有Token的错误计数为0，恢复被禁用的Token
```

#### 查看统计信息
```
📊 Token统计信息

总Token数: 3
可用Token: 2
轮询策略: 加权轮询

Token详情:
1. 🟢 main-token
   权重: 3 | 状态: [已启用] | 最后使用: 2024-01-15 14:32:10
2. 🟢 backup-token
   权重: 2 | 状态: [已启用] | 最后使用: 2024-01-15 13:45:22
3. 🔴 test-token
   权重: 1 | 状态: [已禁用] | 最后使用: 从未使用
```

**图标说明:**
- 🟢/🔴: Token启用状态（绿色启用/红色禁用）
- ⭐: 当前使用的Token

### Token 故障处理

#### 自动故障切换
```
Token main-token 请求失败，自动切换到下一个Token
正在使用 backup-token...
Token backup-token 请求失败，自动切换到下一个Token
正在使用 test-token...
```

#### 故障恢复
- 系统会自动切换到下一个可用Token
- 可以手动禁用/启用有问题的Token
- 支持批量操作管理Token状态

#### 状态监控
系统会自动跟踪每个Token的:
- 启用/禁用状态
- 最后使用时间
- 权重配置

### 多Token配置最佳实践

#### 1. Token分层管理
```bash
# 主Token - 高权重，日常使用
main-token: 权重5, 别名"主要Token"

# 备用Token - 中权重，故障切换
backup-token: 权重3, 别名"备用Token"

# 测试Token - 低权重，开发测试
test-token: 权重1, 别名"测试Token"
```

#### 2. 权重配置建议
- **生产环境**: 使用加权轮询，主Token权重较高
- **开发环境**: 使用轮询或随机，平均分配
- **测试环境**: 使用最少使用，确保所有Token都被测试

#### 3. 监控和维护
```bash
# 定期检查Token状态
ctl token list

# 查看使用统计
ctl token stats

# 重置错误计数（必要时）
ctl token reset
```

#### 4. 安全考虑
- 为不同用途的Token设置清晰的别名
- 定期轮换Token，删除旧的添加新的
- 监控Token使用情况，及时发现异常

#### 5. 故障预案
- 确保至少配置2个以上Token
- 设置合理的重试次数
- 定期验证所有Token的有效性

## 高级使用

### 开发和调试

#### TypeScript 编译检查
```bash
# 检查 TypeScript 编译错误
npx tsc --noEmit

# 检查特定文件
npx tsc --noEmit src/utils/env.ts

# 检查并生成类型声明文件
npx tsc
```

#### 代码质量检查
```bash
# ESLint 检查
npm run lint

# ESLint 自动修复
npm run lint:fix

# Prettier 格式化
npm run format

# 类型检查
npm run typecheck
```

#### 测试相关
```bash
# 运行测试
npm test

# 运行测试并显示覆盖率
npm run test:coverage

# 监听模式运行测试
npm run test:run
```

#### 构建项目
```bash
# 构建项目
npm run build

# 开发模式构建（监听文件变化）
npm run dev
```

### 查看配置文件路径
```bash
ctl --config-path
```

### 批量操作示例

#### 添加多个 Providers
```bash
# 添加开发环境 Provider
ctl add --template anthropic
# 在交互中设置名称为 "开发环境Claude"

# 添加生产环境 Provider
ctl add --template anthropic
# 在交互中设置名称为 "生产环境Claude"
```

#### 快速切换环境
```bash
# 切换到开发环境
ctl use kai-fa-huan-jing-claude
ctl export

# 切换到生产环境
ctl use sheng-chan-huan-jing-claude
ctl export
```

### 项目级配置

在项目根目录创建 `.ctlrc` 文件：

```json
{
  "provider": "kai-fa-huan-jing-claude",
  "autoExport": true
}
```

然后在项目目录中运行：

```bash
ctl use $(cat .ctlrc | jq -r .provider)
ctl export
```

### 环境变量持久化

#### 在 shell 配置文件中自动加载

**Bash/Zsh** (`~/.bashrc` 或 `~/.zshrc`):
```bash
# ctl 自动加载
if command -v ctl >/dev/null 2>&1; then
  if ctl current --json 2>/dev/null | jq -e '.activeProvider' >/dev/null; then
    eval "$(ctl export 2>/dev/null)"
  fi
fi
```

**PowerShell** (配置文件):
```powershell
# ctl 自动加载
if (Get-Command ctl -ErrorAction SilentlyContinue) {
    $currentProvider = ctl current --json 2>$null | ConvertFrom-Json
    if ($currentProvider.activeProvider) {
        ctl export --format powershell | Invoke-Expression
    }
}
```

## 最佳实践

### 1. Provider 命名规范
- 使用有意义的名称：如 "开发环境Claude", "工作用GPT"
- 避免特殊字符，系统会自动生成适合的 ID
- 添加描述说明用途

### 2. 安全考虑
- 定期更新 API Token
- 不要在脚本中硬编码 Token
- 使用 `ctl validate` 检查配置

### 3. Provider 管理
- **定期维护**: 删除不再使用的 Provider
- **配置更新**: 使用 `ctl edit` 而不是手动编辑配置文件
- **备份配置**: 重要配置修改前先导出备份
  ```bash
  # 备份当前配置
  ctl list --json > providers-backup.json

  # 修改配置
  ctl edit my-provider
  ```

### 4. 模板使用
- **查看现有模板**: 添加 Provider 前先查看可用模板
  ```bash
  ctl template list
  ctl template show anthropic
  ```
- **自定义模板**: 为团队常用的 LLM 提供商创建统一模板
- **模板命名**: 使用清晰的模板 ID 和描述

### 5. 工作流建议
```bash
# 每日工作开始
ctl current                    # 确认当前 Provider
ctl use your-provider          # 选择 Provider (自动设置环境变量)
ctl validate                   # 验证配置

# 启动 Claude Code
claude-code
```

### 4. 团队协作
- 分享配置模板，不要分享 Token
- 为不同项目创建不同的 Provider
- 使用统一的命名规范

## 故障排除

### 常见问题解决

#### 1. 命令无法找到
```bash
# 检查安装
npm list -g ctl

# 重新安装
npm install -g ctl

# 检查 PATH
echo $PATH
which ctl
```

#### 2. 环境变量未生效
```bash
# 确保使用 eval
ctl export

# 检查当前 shell
echo $SHELL

# 验证变量
echo $ANTHROPIC_AUTH_TOKEN
```

#### 3. Provider 验证失败
```bash
# 查看详细错误
ctl validate --provider your-provider --verbose

# 重新配置
ctl remove your-provider
ctl add
```

#### 4. API 连接问题
```bash
# 验证配置
ctl validate

# 测试 API 连接
curl -X POST "$ANTHROPIC_BASE_URL/v1/messages" \
  -H "Authorization: Bearer $ANTHROPIC_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model": "claude-sonnet-4-20250514", "max_tokens": 100, "messages": [{"role": "user", "content": "Hello"}]}'
```

#### 5. Provider 修改问题
```bash
# 查看当前配置
ctl current --verbose

# 修改配置
ctl edit provider-id

# 验证修改结果
ctl validate --provider provider-id

# 如果修改失败，检查输入格式
ctl template show anthropic  # 查看字段要求
```

#### 6. 模板相关问题
```bash
# 查看可用模板
ctl template list

# 查看模板详情
ctl template show template-id

# 创建模板时遇到问题
# 确保模板 ID 只包含: a-z, 0-9, -, _
# 确保环境变量名只包含: A-Z, 0-9, _
```

### 调试模式

#### 启用详细输出
```bash
DEBUG=ctl:* ctl command
```

#### 查看配置文件
```bash
# 查看配置路径
ctl --config-path

# 查看配置内容
cat "$(ctl --config-path)"

# 或使用 ctl 查看
ctl list --json
```

### 重置配置

#### 完全重置
```bash
# 删除所有 Providers
ctl remove --all

# 重新开始配置
ctl
```

#### 修复损坏的配置
```bash
# 备份当前配置
cp "$(ctl --config-path)" "$(ctl --config-path).backup"

# 删除配置文件
rm "$(ctl --config-path)"

# 重新初始化
ctl
```

## 平台特定说明

### Windows

#### CMD 中使用
```cmd
ctl export --format cmd > env.bat
call env.bat
echo %ANTHROPIC_AUTH_TOKEN%
```

#### PowerShell 中使用
```powershell
ctl export --format powershell | Invoke-Expression
Write-Host $env:ANTHROPIC_AUTH_TOKEN
```

### macOS/Linux

#### Bash 中使用
```bash
ctl export
echo $ANTHROPIC_AUTH_TOKEN
```

#### Zsh 中使用
```zsh
ctl export
echo $ANTHROPIC_AUTH_TOKEN
```

---

更多问题和建议，请访问 [GitHub Issues](https://github.com/3202336152/ctl/issues)。