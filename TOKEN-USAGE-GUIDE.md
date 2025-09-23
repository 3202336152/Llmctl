# Token错误检测使用指南

## 📋 总结

Token错误检测系统有**自动**和**手动**两个部分：

### 🔄 自动执行的功能
- ✅ Token健康检查和选择
- ✅ 错误Token的自动跳过
- ✅ 状态持久化到配置文件
- ✅ 错误Token的冷却恢复

### 🔧 需要手动集成的功能
- ❌ API调用失败时的错误标记
- ❌ API调用成功时的状态重置

## 🚀 两种使用方式

### 方式一：使用 AutoTokenApiClient（推荐，全自动）

```typescript
import { AutoTokenApiClient } from 'llmctl';

// 基本用法 - 完全自动的Token轮询和错误检测
try {
  const response = await AutoTokenApiClient.call('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    body: {
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1000,
      messages: [{ role: 'user', content: 'Hello!' }]
    }
  });

  const result = await response.json();
  console.log('API调用成功:', result);
} catch (error) {
  console.error('所有Token都失败了:', error);
}

// Anthropic专用方法 - 更简洁
try {
  const result = await AutoTokenApiClient.callAnthropic([
    { role: 'user', content: 'Hello, Claude!' }
  ], {
    model: 'claude-3-sonnet-20240229',
    max_tokens: 1000,
    temperature: 0.7
  });

  console.log('Claude回复:', result.content);
} catch (error) {
  console.error('调用失败:', error);
}
```

**优点：**
- 🎯 零配置，完全自动
- 🔄 自动重试和Token切换
- 📊 智能错误处理
- 🛡️ 内置速率限制处理

### 方式二：手动集成 TokenRotationManager

```typescript
import { TokenRotationManager, configManager } from 'llmctl';

async function myApiCall(message: string) {
  const provider = configManager.getActiveProvider();
  let lastError: Error | null = null;

  // 手动重试循环
  for (let attempt = 0; attempt < 3; attempt++) {
    const token = TokenRotationManager.getNextToken(provider); // 自动选择健康Token

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Authorization': \`Bearer \${token}\`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 1000,
          messages: [{ role: 'user', content: message }]
        })
      });

      if (response.ok) {
        // ✅ 手动标记成功
        TokenRotationManager.markTokenSuccess(provider, token);
        return await response.json();
      } else {
        // ❌ 手动标记错误
        if (response.status === 401 || response.status === 429) {
          TokenRotationManager.markTokenError(provider, token);
        }
        lastError = new Error(\`API失败: \${response.status}\`);
      }
    } catch (error) {
      // ❌ 手动标记网络错误
      TokenRotationManager.markTokenError(provider, token);
      lastError = error as Error;
    }

    if (attempt < 2) {
      console.log(\`重试 \${attempt + 1}/3...\`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  throw lastError || new Error('API调用失败');
}

// 使用
try {
  const result = await myApiCall('Hello, Claude!');
  console.log('成功:', result);
} catch (error) {
  console.error('失败:', error);
}
```

**优点：**
- 🎛️ 完全控制错误处理逻辑
- 🔧 可以自定义重试策略
- 📝 可以记录详细的错误日志

## 🎯 推荐使用场景

### 使用 AutoTokenApiClient 当：
- ✅ 你想要简单快速的解决方案
- ✅ 标准的API调用模式
- ✅ 不需要特殊的错误处理逻辑

### 使用手动集成当：
- 🔧 你需要自定义错误处理逻辑
- 📊 你需要详细的错误日志和监控
- 🎛️ 你需要特殊的重试策略
- 🔌 你要集成到现有的API客户端中

## 📊 监控Token状态

无论使用哪种方式，你都可以通过CLI监控Token状态：

\`\`\`bash
# 查看Token状态
ctl tokens

# 查看详细统计
ctl tokens stats

# 重置错误计数
ctl tokens reset
\`\`\`

现在你的Token轮询系统既有自动化的便捷性，也有手动控制的灵活性！