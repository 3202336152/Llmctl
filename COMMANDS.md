# ctl 命令操作指南

本指南详细介绍 ctl 工具的所有命令和使用方法。

## 📖 目录

- [基础命令](#基础命令)
- [Provider 管理](#provider-管理)
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
💡 这是当前使用的 Provider，建议重新导出环境变量：
ctl export
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
- **模型名称** - ANTHROPIC_MODEL 环境变量，仅在使用中转服务时需要配置

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
   环境变量: ANTHROPIC_AUTH_TOKEN, ANTHROPIC_BASE_URL
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