# llmctl 命令操作指南

本指南详细介绍 llmctl 工具的所有命令和使用方法。

## 📖 目录

- [基础命令](#基础命令)
- [Provider 管理](#provider-管理)
- [环境变量导出](#环境变量导出)
- [配置验证](#配置验证)
- [模板管理](#模板管理)
- [高级使用](#高级使用)
- [最佳实践](#最佳实践)
- [故障排除](#故障排除)

## 基础命令

### `llmctl` (无参数)
首次运行时启动引导向导，帮助您配置第一个 Provider。

```bash
llmctl
```

**输出示例：**
```
🎉 欢迎使用 llmctl！
🔍 检测到您还没有配置任何 LLM Provider
🚀 让我们开始配置您的第一个 Provider...
```

### `llmctl --help` / `llmctl -h`
显示帮助信息和所有可用命令。

```bash
llmctl --help
```

### `llmctl --version` / `llmctl -V`
显示当前版本信息。

```bash
llmctl --version
```

## Provider 管理

### `llmctl add` - 添加 Provider

#### 交互式添加 (推荐)
```bash
llmctl add
```

**交互流程：**
1. 选择 Provider 类型 (目前支持 Anthropic)
2. 输入 Provider 名称 (会自动生成 ID)
3. 输入描述 (可选)
4. 确认或自定义 Provider ID
5. 输入 Base URL
6. 输入 API Token
7. 输入模型名称 (ANTHROPIC_MODEL，仅中转时需要)
8. 选择是否立即使用该 Provider (会自动设置环境变量)

**示例对话：**
```
🔧 配置 LLM API 配置:

? 请输入 Provider 名称: 我的Claude配置
? 请输入 Provider 描述 (可选): 日常开发使用
🆔 使用 Provider ID: wo-de-claude-pei-zhi
? 请输入 API URL: https://api.lycheeshare.com
? 请输入 API Token: [隐藏输入]
? 请输入模型名称 (ANTHROPIC_MODEL，仅中转时需要): claude-sonnet-4-20250514
✅ 成功添加 Provider: 我的Claude配置
? 是否立即选择此 Provider 作为当前使用的 Provider? Yes
🎯 已选择 "我的Claude配置" 作为当前 Provider
🔄 正在自动设置环境变量...
即将设置的环境变量:
  ANTHROPIC_AUTH_TOKEN=********...
  ANTHROPIC_BASE_URL=https://api.lycheeshare.com
  ANTHROPIC_MODEL=claude-sonnet-4-20250514

✅ 已自动设置 3 个环境变量
```

#### 使用特定模板
```bash
llmctl add --template anthropic
```

#### 查看可用模板
```bash
llmctl add --list-templates
```

**输出示例：**
```
📋 可用的 Provider 模板:

1. LLM API 配置
   ID: anthropic
   描述: 配置大语言模型 API (支持 Claude、GLM、Qwen 等)
   环境变量: ANTHROPIC_AUTH_TOKEN, ANTHROPIC_BASE_URL, ANTHROPIC_MODEL
```

### `llmctl list` / `llmctl ls` - 列出 Providers

#### 基本列表
```bash
llmctl list
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
llmctl list --verbose
```

#### JSON 格式输出
```bash
llmctl list --json
```

### `llmctl use` - 选择 Provider

#### 交互式选择
```bash
llmctl use
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
llmctl use gong-zuo-yong-claude
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

> **注意**: `llmctl use` 会自动设置环境变量，无需手动执行 `llmctl export`。

#### 显示可选择的列表
```bash
llmctl use --list
```

### `llmctl edit` / `llmctl update` - 修改 Provider 配置

#### 交互式修改
```bash
llmctl edit
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
💡 这是当前使用的 Provider，建议重新导出环境变量：
llmctl export
```

#### 直接修改指定 Provider
```bash
llmctl edit glm
llmctl update qwen
```

#### 支持修改的字段
- **配置名称** - Provider 显示名称
- **配置描述** - Provider 描述信息
- **API地址** - API 接口地址
- **API密钥** - API 认证密钥
- **模型名称** - ANTHROPIC_MODEL 环境变量，仅在使用中转服务时需要配置

**注意事项：**
- 修改会自动验证配置有效性
- 如果修改的是当前使用的 Provider，建议使用 `llmctl use` 重新选择以自动更新环境变量
- 所有修改都会保存到配置文件中

### `llmctl current` - 显示当前 Provider

#### 基本信息
```bash
llmctl current
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
llmctl current --verbose
```

#### JSON 格式
```bash
llmctl current --json
```

### `llmctl remove` / `llmctl rm` - 删除 Provider

#### 交互式删除
```bash
llmctl remove
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
llmctl remove gong-zuo-yong-claude
```

#### 强制删除 (无确认提示)
```bash
llmctl remove gong-zuo-yong-claude --force
```

#### 删除所有 Providers (危险操作)
```bash
llmctl remove --all
```

## 环境变量导出

### `llmctl export` - 导出环境变量

#### 自动检测格式并导出
```bash
llmctl export
```

#### 预览导出内容 (不实际设置)
```bash
llmctl export --dry-run
```

**输出示例：**
```
🔍 将要导出的环境变量:

ANTHROPIC_AUTH_TOKEN=sk-lycheeshare-...
ANTHROPIC_BASE_URL=https://api.lycheeshare.com

📝 在 bash/zsh 中使用: llmctl export
📝 在 PowerShell 中使用: llmctl export --format powershell | Invoke-Expression
📝 在 CMD 中使用: llmctl export --format cmd > env.bat && call env.bat
```

#### 指定格式导出

**Bash/Zsh 格式:**
```bash
llmctl export --format bash
```

**PowerShell 格式:**
```bash
llmctl export --format powershell
# 使用方式：
llmctl export --format powershell | Invoke-Expression
```

**Windows CMD 格式:**
```bash
llmctl export --format cmd
# 使用方式：
llmctl export --format cmd > env.bat && call env.bat
```

**JSON 格式:**
```bash
llmctl export --format json
```

#### 导出指定 Provider 的环境变量
```bash
llmctl export --provider gong-zuo-yong-claude
```

#### 验证导出的环境变量
```bash
llmctl export --validate
```

## 配置验证

### `llmctl validate` - 验证配置

#### 验证当前配置和活跃 Provider
```bash
llmctl validate
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
llmctl validate --config
```

#### 验证指定 Provider
```bash
llmctl validate --provider wo-de-claude-pei-zhi
```

#### 验证所有 Providers
```bash
llmctl validate --all
```

#### JSON 格式输出
```bash
llmctl validate --json
```

## 模板管理

### `llmctl template` / `llmctl templates` - 管理 Provider 模板

#### 列出所有模板
```bash
llmctl template list
llmctl templates ls
```

**输出示例：**
```
📋 可用的 Provider 模板 (1):

1. LLM API 配置
   ID: anthropic
   描述: 配置大语言模型 API描述 (支持 Claude、GLM、Qwen 等)
   环境变量: ANTHROPIC_AUTH_TOKEN, ANTHROPIC_BASE_URL
```

#### JSON 格式输出
```bash
llmctl template list --json
```

#### 查看模板详情
```bash
llmctl template show anthropic
llmctl template info anthropic
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
  ANTHROPIC_MODEL: (可选，仅中转时需要)

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
llmctl template create
llmctl template new
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

## 高级使用

### 查看配置文件路径
```bash
llmctl --config-path
```

### 批量操作示例

#### 添加多个 Providers
```bash
# 添加开发环境 Provider
llmctl add --template anthropic
# 在交互中设置名称为 "开发环境Claude"

# 添加生产环境 Provider
llmctl add --template anthropic
# 在交互中设置名称为 "生产环境Claude"
```

#### 快速切换环境
```bash
# 切换到开发环境
llmctl use kai-fa-huan-jing-claude
llmctl export

# 切换到生产环境
llmctl use sheng-chan-huan-jing-claude
llmctl export
```

### 项目级配置

在项目根目录创建 `.llmctlrc` 文件：

```json
{
  "provider": "kai-fa-huan-jing-claude",
  "autoExport": true
}
```

然后在项目目录中运行：

```bash
llmctl use $(cat .llmctlrc | jq -r .provider)
llmctl export
```

### 环境变量持久化

#### 在 shell 配置文件中自动加载

**Bash/Zsh** (`~/.bashrc` 或 `~/.zshrc`):
```bash
# llmctl 自动加载
if command -v llmctl >/dev/null 2>&1; then
  if llmctl current --json 2>/dev/null | jq -e '.activeProvider' >/dev/null; then
    eval "$(llmctl export 2>/dev/null)"
  fi
fi
```

**PowerShell** (配置文件):
```powershell
# llmctl 自动加载
if (Get-Command llmctl -ErrorAction SilentlyContinue) {
    $currentProvider = llmctl current --json 2>$null | ConvertFrom-Json
    if ($currentProvider.activeProvider) {
        llmctl export --format powershell | Invoke-Expression
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
- 使用 `llmctl validate` 检查配置

### 3. Provider 管理
- **定期维护**: 删除不再使用的 Provider
- **配置更新**: 使用 `llmctl edit` 而不是手动编辑配置文件
- **备份配置**: 重要配置修改前先导出备份
  ```bash
  # 备份当前配置
  llmctl list --json > providers-backup.json

  # 修改配置
  llmctl edit my-provider
  ```

### 4. 模板使用
- **查看现有模板**: 添加 Provider 前先查看可用模板
  ```bash
  llmctl template list
  llmctl template show anthropic
  ```
- **自定义模板**: 为团队常用的 LLM 提供商创建统一模板
- **模板命名**: 使用清晰的模板 ID 和描述

### 5. 工作流建议
```bash
# 每日工作开始
llmctl current                    # 确认当前 Provider
llmctl use your-provider          # 选择 Provider (自动设置环境变量)
llmctl validate                   # 验证配置

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
npm list -g llmctl

# 重新安装
npm install -g llmctl

# 检查 PATH
echo $PATH
which llmctl
```

#### 2. 环境变量未生效
```bash
# 确保使用 eval
llmctl export

# 检查当前 shell
echo $SHELL

# 验证变量
echo $ANTHROPIC_AUTH_TOKEN
```

#### 3. Provider 验证失败
```bash
# 查看详细错误
llmctl validate --provider your-provider --verbose

# 重新配置
llmctl remove your-provider
llmctl add
```

#### 4. API 连接问题
```bash
# 验证配置
llmctl validate

# 测试 API 连接
curl -X POST "$ANTHROPIC_BASE_URL/v1/messages" \
  -H "Authorization: Bearer $ANTHROPIC_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model": "claude-sonnet-4-20250514", "max_tokens": 100, "messages": [{"role": "user", "content": "Hello"}]}'
```

#### 5. Provider 修改问题
```bash
# 查看当前配置
llmctl current --verbose

# 修改配置
llmctl edit provider-id

# 验证修改结果
llmctl validate --provider provider-id

# 如果修改失败，检查输入格式
llmctl template show anthropic  # 查看字段要求
```

#### 6. 模板相关问题
```bash
# 查看可用模板
llmctl template list

# 查看模板详情
llmctl template show template-id

# 创建模板时遇到问题
# 确保模板 ID 只包含: a-z, 0-9, -, _
# 确保环境变量名只包含: A-Z, 0-9, _
```

### 调试模式

#### 启用详细输出
```bash
DEBUG=llmctl:* llmctl command
```

#### 查看配置文件
```bash
# 查看配置路径
llmctl --config-path

# 查看配置内容
cat "$(llmctl --config-path)"

# 或使用 llmctl 查看
llmctl list --json
```

### 重置配置

#### 完全重置
```bash
# 删除所有 Providers
llmctl remove --all

# 重新开始配置
llmctl
```

#### 修复损坏的配置
```bash
# 备份当前配置
cp "$(llmctl --config-path)" "$(llmctl --config-path).backup"

# 删除配置文件
rm "$(llmctl --config-path)"

# 重新初始化
llmctl
```

## 平台特定说明

### Windows

#### CMD 中使用
```cmd
llmctl export --format cmd > env.bat
call env.bat
echo %ANTHROPIC_AUTH_TOKEN%
```

#### PowerShell 中使用
```powershell
llmctl export --format powershell | Invoke-Expression
Write-Host $env:ANTHROPIC_AUTH_TOKEN
```

### macOS/Linux

#### Bash 中使用
```bash
llmctl export
echo $ANTHROPIC_AUTH_TOKEN
```

#### Zsh 中使用
```zsh
llmctl export
echo $ANTHROPIC_AUTH_TOKEN
```

---

更多问题和建议，请访问 [GitHub Issues](https://github.com/3202336152/llmctl/issues)。