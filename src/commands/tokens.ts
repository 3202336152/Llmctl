import { Command } from "commander";
import chalk from "chalk";
import { configManager } from "../config.js";
import { TokenRotationManager } from "../utils/token-rotation.js";
import { prompt } from "../utils/inquirer.js";
import type { Provider, TokenConfig } from "../types.js";

export function createTokensCommand(): Command {
  return new Command("token")
    .description("Token管理 - 支持多Token轮询")
    .argument("[provider-id]", "Provider ID (可选)")
    .argument("[action]", "操作类型: add, list, strategy (可选)")
    .action(async (providerId, action, _options) => {
      try {
        // 如果没有指定provider，让用户选择
        if (!providerId) {
          providerId = await selectProvider();
          if (!providerId) return;
        }

        const provider = configManager.getProvider(providerId);
        if (!provider) {
          console.error(chalk.red(`❌ Provider "${providerId}" 不存在`));
          return;
        }

        // 根据action执行对应操作
        switch (action) {
          case "add":
            await addTokenInteractive(provider);
            break;
          case "list":
            showTokenList(provider);
            break;
          case "strategy":
            await setStrategyInteractive(provider);
            break;
          default:
            // 默认进入交互式管理界面
            await tokenManagementMenu(provider);
        }
      } catch (error) {
        console.error(chalk.red("❌ Token管理失败:"), error);
      }
    });
}

// 选择Provider
async function selectProvider(): Promise<string | null> {
  const providers = configManager.getAllProviders();

  if (providers.length === 0) {
    console.log(chalk.yellow("😟 当前没有配置任何 Provider"));
    return null;
  }

  const activeProvider = configManager.getActiveProvider();

  // 对Provider列表进行排序：当前使用的优先显示，其他按名称排序
  const sortedProviders = [...providers].sort((a, b) => {
    const aIsActive = activeProvider?.id === a.id;
    const bIsActive = activeProvider?.id === b.id;

    // 当前使用的Provider排在最前面
    if (aIsActive && !bIsActive) return -1;
    if (!aIsActive && bIsActive) return 1;

    // 其他Provider按名称排序
    return a.name.localeCompare(b.name, 'zh-CN');
  });

  const choices = sortedProviders.map((p) => {
    const isActive = activeProvider?.id === p.id;
    const name = isActive ? chalk.green.bold(p.name) : p.name;
    const status = isActive ? chalk.cyan(" (当前使用)") : "";
    const description = p.description ? ` - ${chalk.gray(p.description)}` : "";

    return {
      name: `${name}${status}${description}`,
      value: p.id,
    };
  });

  // 添加取消选项
  choices.push({
    name: chalk.red("返回"),
    value: "__cancel__",
  });

  const { providerId } = await prompt([
    {
      type: "list",
      name: "providerId",
      message: "选择要管理Token的Provider:",
      choices,
      pageSize: Math.min(choices.length, 10),
      loop: true,
      prefix: "",
      default: activeProvider?.id, // 默认选中当前使用的Provider
    },
  ]);

  // 检查是否选择了取消选项
  if (providerId === "__cancel__") {
    console.log(chalk.yellow("🚫 已取消操作"));
    return null;
  }

  return providerId;
}

// 交互式Token管理主菜单
async function tokenManagementMenu(provider: Provider): Promise<void> {
  let lastSelectedIndex = 0; // 跟踪上次选择的菜单位置

  while (true) {
    // 使用更温和的清屏方式，减少闪烁
    console.clear();
    console.log(chalk.bold.blue(`🔧 Token管理 - ${provider.name}\n`));

    // 显示当前Token状态
    showTokenSummary(provider);

    // 动态构建菜单选项 - 方案3实现
    const allTokens = getAllTokensForDisplay(provider);
    const currentToken = getCurrentTokenForDisplay(provider);
    const hasMultipleTokens = allTokens.length > 1;
    const hasAvailableTokens = allTokens.some(
      (t) => t.enabled !== false && t.value !== currentToken,
    );

    const menuChoices = [];

    // 1. 禁用当前Token选项（最常用，放在首位）
    if (currentToken && hasAvailableTokens) {
      const currentTokenConfig = allTokens.find(
        (t) => t.value === currentToken,
      );
      const currentAlias = currentTokenConfig?.alias || "当前Token";
      menuChoices.push({
        name: `🚫 禁用当前Token (${currentAlias})`,
        value: "disable-current",
      });
    }

    // 2. Token列表（合并查看功能）
    const enabled = allTokens.filter((t) => t.enabled !== false).length;
    const disabled = allTokens.length - enabled;
    menuChoices.push({
      name: `📋 Token列表 (${enabled}✅ ${disabled}❌)`,
      value: "list",
    });

    // 3. 常用操作
    menuChoices.push({ name: "➕ 添加Token", value: "add" });

    // 4. 批量操作（合并批量功能）
    if (hasMultipleTokens) {
      menuChoices.push({ name: "📦 批量操作", value: "batch-operations" });
    }

    // 5. 高级设置（合并不常用功能）
    const advancedOptions = [];
    advancedOptions.push("✏️ 编辑Token");
    advancedOptions.push("🗑️ 删除Token");
    if (hasMultipleTokens) {
      advancedOptions.push("⚙️ 轮询策略");
    }
    menuChoices.push({
      name: `⚙️ 高级设置 (${advancedOptions.length}项)`,
      value: "advanced",
    });

    // 6. 退出
    menuChoices.push({ name: "🚪 退出", value: "exit" });

    const { action } = await prompt([
      {
        type: "list",
        name: "action",
        message: "选择操作:",
        choices: menuChoices,
        default: menuChoices[lastSelectedIndex]?.value, // 保持上次选择的位置
        pageSize: menuChoices.length, // 显示所有选项，避免分页
        loop: true, // 启用循环选择
        prefix: "", // 移除前缀减少闪烁
      },
    ]);

    // 找到当前选择的索引位置，用于下次保持位置
    lastSelectedIndex = menuChoices.findIndex(
      (choice) => choice.value === action,
    );
    if (lastSelectedIndex === -1) lastSelectedIndex = 0;

    switch (action) {
      case "disable-current":
        await disableCurrentToken(provider);
        break;
      case "list":
        showTokenList(provider);
        await prompt([
          { type: "input", name: "continue", message: "按回车继续..." },
        ]);
        break;
      case "add":
        await addTokenInteractive(provider);
        break;
      case "batch-operations":
        await batchOperationsMenu(provider);
        break;
      case "advanced":
        await advancedSettingsMenu(provider);
        break;
      case "exit":
        return;
    }
  }
}

// 显示Token摘要 - 统一显示方式
function showTokenSummary(provider: Provider): void {
  const allTokens = getAllTokensForDisplay(provider);
  const currentToken = getCurrentTokenForDisplay(provider);

  if (allTokens.length === 0) {
    console.log(chalk.red("❌ 当前没有任何Token配置"));
    console.log(chalk.gray("💡 请添加Token以开始使用\n"));
  } else {
    const enabled = allTokens.filter((t) => t.enabled !== false).length;

    // 构建一行显示信息
    let displayInfo = "";

    // 当前Token信息
    if (currentToken) {
      const currentTokenConfig = allTokens.find(
        (t) => t.value === currentToken,
      );
      const currentAlias = currentTokenConfig?.alias || "当前Token";
      displayInfo += `✅ ${currentAlias} ⭐ [当前使用]`;
    }

    // 统计信息
    const statsInfo = `📊 ${enabled}/${allTokens.length}可用`;
    displayInfo += displayInfo ? ` | ${statsInfo}` : statsInfo;

    // 策略信息
    if (allTokens.length > 1) {
      const strategy = provider.tokenStrategy?.type || "round-robin";
      displayInfo += ` | 🔄 ${getStrategyName(strategy)}策略`;
    }

    // 使用默认白色显示
    console.log(displayInfo);
    console.log();
  }
}

// 添加Token
async function addTokenInteractive(provider: Provider): Promise<void> {
  console.log(chalk.blue("\n➕ 添加新Token\n"));

  const { tokenValue, alias, weight } = await prompt([
    {
      type: "password",
      name: "tokenValue",
      message: "请输入Token值:",
      mask: "*",
      validate: (input: string) => {
        if (!input || input.length < 10) {
          return "Token长度至少为10个字符";
        }
        // 检查是否已存在于tokens数组中
        if (provider.tokens?.some((t) => t.value === input)) {
          return "该Token已存在";
        }
        // 检查是否与单Token配置重复
        const singleToken =
          provider.apiKey || provider.envVars?.ANTHROPIC_AUTH_TOKEN;
        if (singleToken && singleToken === input) {
          return "该Token与现有配置重复";
        }
        return true;
      },
    },
    {
      type: "input",
      name: "alias",
      message: "Token别名 (可选，方便识别):",
      default: "",
    },
    {
      type: "input",
      name: "weight",
      message: "权重 (1-10，用于加权轮询):",
      default: "1",
      validate: (input: string) => {
        const num = parseInt(input);
        return (num >= 1 && num <= 10) || "权重必须是1-10之间的整数";
      },
    },
  ]);

  const newToken = {
    value: tokenValue,
    alias: alias || undefined,
    weight: parseInt(weight) as number,
    enabled: true, // 默认启用，直接加入轮询池
  };

  // 初始化tokens数组（如果不存在）
  if (!provider.tokens) {
    provider.tokens = [];
  }

  // 检查是否需要迁移现有的单Token配置
  // 即使tokens数组已经存在，也要检查envVars中是否有未迁移的Token
  const existingToken =
    provider.apiKey || provider.envVars?.ANTHROPIC_AUTH_TOKEN;
  if (existingToken) {
    // 检查这个Token是否已经在tokens数组中
    const alreadyMigrated = provider.tokens.some(
      (t) => t.value === existingToken,
    );
    if (!alreadyMigrated) {
      const existingTokenConfig = {
        value: existingToken,
        alias: "原始Token" as string,
        weight: 1 as number,
        enabled: true as boolean,
      };
      provider.tokens.unshift(existingTokenConfig); // 使用unshift让原始Token排在第一个
      console.log(chalk.blue("🔄 已将现有的envVars Token迁移到多Token配置中"));
    }
  }

  provider.tokens.push(newToken);
  await saveProvider(provider);

  const totalTokens = provider.tokens.length;
  console.log(chalk.green(`✅ Token添加成功${alias ? ` (${alias})` : ""}`));
  console.log(
    chalk.blue(`📊 现在共有 ${totalTokens} 个Token，新Token已自动加入轮询池`),
  );
}

// 编辑Token - 统一处理所有token为列表模式
async function editTokenInteractive(provider: Provider): Promise<void> {
  // 获取所有可编辑的token
  const allTokens = getAllTokensForDisplay(provider);

  if (allTokens.length === 0) {
    console.log(chalk.yellow("❌ 没有可编辑的Token"));
    return;
  }

  // 统一的token选择编辑（不区分单token和多token）
  const choices = allTokens.map((token, index) => ({
    name: `${token.alias || `Token-${index + 1}`} (${token.value.slice(0, 8)}...) - 权重:${token.weight || 1} ${token.enabled === false ? "[已禁用]" : ""}`,
    value: index,
  }));

  // 添加返回选项
  choices.push({ name: "🔙 返回", value: -1 });

  const { tokenIndex } = await prompt([
    {
      type: "list",
      name: "tokenIndex",
      message: "选择要编辑的Token:",
      choices,
      pageSize: Math.min(choices.length, 8), // 动态设置页面大小
      loop: true,
    },
  ]);

  // 处理返回操作
  if (tokenIndex === -1) {
    return;
  }

  const token = allTokens[tokenIndex];

  // 如果是单token配置，需要先将其转换为多token管理
  const isSingleTokenConfig = !provider.tokens || provider.tokens.length === 0;
  if (isSingleTokenConfig) {
    await convertSingleTokenToMultiAutomatically(provider, token);
  }

  // 编辑token属性
  const { alias, weight, enabled } = await prompt([
    {
      type: "input",
      name: "alias",
      message: "Token别名:",
      default: token.alias || "",
    },
    {
      type: "input",
      name: "weight",
      message: "权重 (1-10):",
      default: String(token.weight || 1),
      validate: (input: string) => {
        const num = parseInt(input);
        return (num >= 1 && num <= 10) || "权重必须是1-10之间的整数";
      },
    },
    {
      type: "confirm",
      name: "enabled",
      message: "是否启用该Token?",
      default: token.enabled !== false,
    },
  ]);

  // 更新Token - 现在所有token都在tokens数组中
  if (provider.tokens && provider.tokens[tokenIndex]) {
    const actualToken = provider.tokens[tokenIndex];
    actualToken.alias = alias || undefined;
    actualToken.weight = parseInt(weight);
    actualToken.enabled = enabled;
  }

  await saveProvider(provider);
  console.log(chalk.green("✅ Token更新成功"));
}

// 自动将单token转换为多token管理（无用户交互）
async function convertSingleTokenToMultiAutomatically(
  provider: Provider,
  token: TokenConfig,
): Promise<void> {
  // 初始化tokens数组
  if (!provider.tokens) {
    provider.tokens = [];
  }

  const tokenConfig = {
    value: token.value,
    alias: token.alias || "Token-1",
    weight: token.weight || 1,
    enabled: token.enabled !== false,
    healthy: token.healthy !== false,
  };

  provider.tokens.push(tokenConfig);

  // 清除原有的单token配置
  if (provider.apiKey) {
    delete provider.apiKey;
  }
  if (provider.envVars?.ANTHROPIC_AUTH_TOKEN) {
    delete provider.envVars.ANTHROPIC_AUTH_TOKEN;
  }
}

// 删除Token
async function deleteTokenInteractive(provider: Provider): Promise<void> {
  if (!provider.tokens || provider.tokens.length === 0) {
    console.log(chalk.yellow("❌ 没有可删除的Token"));
    return;
  }

  if (provider.tokens.length === 1) {
    const { confirmDelete } = await prompt([
      {
        type: "confirm",
        name: "confirmDelete",
        message: "这是最后一个Token，删除后将没有任何Token配置，确认删除?",
        default: false,
      },
    ]);

    if (confirmDelete) {
      provider.tokens = [];
      await saveProvider(provider);
      console.log(chalk.green("✅ 已删除Token，现在没有任何Token配置"));
    }
    return;
  }

  const choices = provider.tokens.map((token, index) => ({
    name: `${token.alias || `Token-${index + 1}`} (${token.value.slice(0, 8)}...)`,
    value: index,
  }));

  // 添加返回选项
  choices.push({ name: "🔙 返回", value: -1 });

  const { tokenIndex } = await prompt([
    {
      type: "list",
      name: "tokenIndex",
      message: "选择要删除的Token:",
      choices,
      pageSize: Math.min(choices.length, 8), // 动态设置页面大小
      loop: true,
    },
  ]);

  // 处理返回操作
  if (tokenIndex === -1) {
    return;
  }

  const { confirmDelete } = await prompt([
    {
      type: "confirm",
      name: "confirmDelete",
      message: `确认删除Token "${provider.tokens[tokenIndex].alias || "Token-" + (tokenIndex + 1)}"?`,
      default: false,
    },
  ]);

  if (confirmDelete) {
    provider.tokens.splice(tokenIndex, 1);
    await saveProvider(provider);
    console.log(chalk.green("✅ Token删除成功"));
  }
}

// 设置轮询策略
async function setStrategyInteractive(provider: Provider): Promise<void> {
  const { strategy } = await prompt([
    {
      type: "list",
      name: "strategy",
      message: "选择轮询策略:",
      choices: [
        {
          name: "🔄 轮询 (Round Robin) - 依次使用每个Token",
          value: "round-robin",
        },
        {
          name: "⚖️  加权轮询 (Weighted) - 按权重分配使用频率",
          value: "weighted",
        },
        { name: "🎲 随机选择 (Random) - 随机选择Token", value: "random" },
        {
          name: "📊 最少使用 (Least Used) - 优先使用最少使用的Token",
          value: "least-used",
        },
        { name: "🔙 返回", value: "back" },
      ],
      default: provider.tokenStrategy?.type || "round-robin",
      pageSize: 5, // 更新页面大小（5个选项）
      loop: true,
    },
  ]);

  // 处理返回操作
  if (strategy === "back") {
    return;
  }

  if (!provider.tokenStrategy) {
    provider.tokenStrategy = {
      type: strategy,
      fallbackOnError: true,
    };
  } else {
    provider.tokenStrategy.type = strategy;
  }

  await saveProvider(provider);
  console.log(chalk.green(`✅ 轮询策略已设置为: ${getStrategyName(strategy)}`));
}

// 快速切换Token状态
// 更新环境变量
async function updateEnvironmentVariable(
  provider: Provider,
  tokenValue: string,
): Promise<{ success: boolean; message?: string; shellCommand?: string }> {
  try {
    // 动态导入EnvExporter
    const { EnvExporter } = await import("../utils/env.js");
    const { providerRegistry } = await import("../providers/index.js");

    // 更新provider配置中的token
    if (provider.envVars?.ANTHROPIC_AUTH_TOKEN) {
      provider.envVars.ANTHROPIC_AUTH_TOKEN = tokenValue;
    } else if (provider.apiKey) {
      provider.apiKey = tokenValue;
    }

    await saveProvider(provider);

    // 获取环境变量
    const envVars = providerRegistry.getProviderEnvVars(provider);

    // 导出环境变量
    const result = await EnvExporter.autoApplyEnvironmentVariables(
      envVars,
      provider.name,
    );

    return {
      success: result.success,
      message: result.message,
      shellCommand: result.shellCommand,
    };
  } catch (error) {
    return {
      success: false,
      message: `更新环境变量时发生错误: ${error}`,
    };
  }
}

// 显示Token列表 - 统一列表形式显示所有token
function showTokenList(provider: Provider): void {
  console.log(chalk.bold.blue("\n📋 Token列表\n"));

  // 获取所有token（包括单token和多token）
  const allTokens = getAllTokensForDisplay(provider);

  if (allTokens.length === 0) {
    console.log(chalk.red("❌ 当前没有任何Token配置"));
    console.log(chalk.gray("💡 请添加Token以开始使用"));
    return;
  }

  // 获取当前正在使用的token - 使用统一函数
  const currentToken = getCurrentTokenForDisplay(provider);

  // 显示所有token
  allTokens.forEach((token, index) => {
    const status =
      token.enabled === false ? chalk.red("[已禁用]") : chalk.green("[已启用]");

    // 检查是否为当前使用的token
    const isCurrent = token.value === currentToken;
    const currentMarker = isCurrent ? chalk.yellow(" ⭐ [当前使用]") : "";

    console.log(
      `${index + 1}. ${chalk.cyan(token.alias || `Token-${index + 1}`)}${currentMarker}`,
    );
    console.log(`   Token: ${token.value.slice(0, 8)}...`);
    console.log(`   权重: ${token.weight || 1} | 状态: ${status}`);
    console.log();
  });
}

// 获取所有token用于显示（包括单token转换）
function getAllTokensForDisplay(provider: Provider): TokenConfig[] {
  // 如果有多token配置，直接返回
  if (provider.tokens && provider.tokens.length > 0) {
    return provider.tokens;
  }

  // 如果有单token配置，转换为token列表格式
  const singleToken = provider.apiKey || provider.envVars?.ANTHROPIC_AUTH_TOKEN;
  if (singleToken) {
    return [
      {
        value: singleToken,
        alias: "单Token配置",
        weight: 1,
        enabled: true,
      },
    ];
  }

  return [];
}

// 辅助函数
function getStrategyName(strategy: string): string {
  const names = {
    "round-robin": "轮询",
    weighted: "加权轮询",
    random: "随机选择",
    "least-used": "最少使用",
  };
  return names[strategy as keyof typeof names] || strategy;
}

// 获取当前正在使用的Token（与ctl use保持一致）
function getCurrentTokenForDisplay(provider: Provider): string | null {
  // 如果有多token配置，使用当前环境变量或配置中的token
  if (provider.tokens && provider.tokens.length > 0) {
    // 优先使用当前环境变量中的token（如果存在且有效）
    const currentEnvToken =
      provider.envVars?.ANTHROPIC_AUTH_TOKEN || provider.apiKey;
    if (currentEnvToken) {
      // 验证这个token是否在tokens列表中且已启用
      const tokenConfig = provider.tokens.find(
        (t) => t.value === currentEnvToken,
      );
      if (tokenConfig && tokenConfig.enabled !== false) {
        return currentEnvToken;
      }
    }

    // 如果当前环境变量中的token无效，返回null（显示没有当前Token）
    return null;
  }

  // 兼容单token配置
  return provider.envVars?.ANTHROPIC_AUTH_TOKEN || provider.apiKey || null;
}

async function saveProvider(provider: Provider): Promise<void> {
  configManager.updateProvider(provider.id, provider);
}

// 快捷禁用当前Token
// 处理批量Token操作
async function handleBatchTokenOperation(
  provider: Provider,
  allTokens: TokenConfig[],
  action: string,
): Promise<void> {
  const isDisable = action === "batch-disable";
  const actionText = isDisable ? "禁用" : "启用";
  const targetTokens = isDisable
    ? allTokens.filter((token) => token.enabled !== false)
    : allTokens.filter((token) => token.enabled === false);

  if (targetTokens.length === 0) {
    console.log(chalk.yellow(`❌ 没有可${actionText}的Token`));
    await prompt([
      { type: "input", name: "continue", message: "按回车继续..." },
    ]);
    return;
  }

  console.log(chalk.cyan(`\n📦 批量${actionText}Token\n`));
  console.log(`可${actionText}的Token:`);

  // 创建选择列表
  const choices: Array<{
    name: string;
    value: number | string;
    checked: boolean;
  }> = targetTokens.map((token, index) => ({
    name: `${token.alias || `Token-${index + 1}`} (${token.value.slice(0, 8)}...)`,
    value: index,
    checked: false, // 默认不选中
  }));

  choices.push({ name: "全选", value: "select-all", checked: false });
  choices.push({ name: "全不选", value: "select-none", checked: false });

  const { selectedIndices } = await prompt([
    {
      type: "checkbox",
      name: "selectedIndices",
      message: `选择要${actionText}的Token (空格选择，回车确认):`,
      choices,
      pageSize: Math.min(choices.length, 10),
      loop: true,
    },
  ]);

  if (selectedIndices.length === 0) {
    console.log(chalk.yellow("未选择任何Token"));
    return;
  }

  // 处理特殊选项
  let actualSelectedIndices = selectedIndices.filter(
    (index: number | string): index is number => typeof index === "number",
  );

  if (selectedIndices.includes("select-all")) {
    actualSelectedIndices = targetTokens.map((_, index) => index);
  }

  if (selectedIndices.includes("select-none")) {
    actualSelectedIndices = [];
  }

  if (actualSelectedIndices.length === 0) {
    console.log(chalk.yellow("未选择任何Token"));
    return;
  }

  // 直接执行操作
  const selectedTokens = actualSelectedIndices.map(
    (index: number) => targetTokens[index],
  );
  console.log(chalk.cyan(`\n即将${actionText}以下Token:`));
  selectedTokens.forEach((token: TokenConfig, index: number) => {
    console.log(
      `${index + 1}. ${token.alias || `Token-${index + 1}`} (${token.value.slice(0, 8)}...)`,
    );
  });

  // 执行批量操作
  let successCount = 0;

  for (const token of selectedTokens) {
    try {
      if (isDisable) {
        // 检查是否是当前正在使用的Token
        const currentToken = getCurrentTokenForDisplay(provider);
        if (token.value === currentToken) {
          // 需要先切换到其他Token
          const nextToken = TokenRotationManager.getNextToken(
            provider,
            token.value,
          );
          if (nextToken && nextToken !== token.value) {
            const result = await updateEnvironmentVariable(provider, nextToken);
            if (result.success) {
              token.enabled = false;
              successCount++;
              console.log(
                chalk.green(`✅ 已禁用并自动切换: ${token.alias || "Token"}`),
              );
            } else {
              console.log(
                chalk.red(`❌ 切换失败，跳过禁用: ${token.alias || "Token"}`),
              );
            }
          } else {
            console.log(
              chalk.red(
                `❌ 无其他可用Token，跳过禁用: ${token.alias || "Token"}`,
              ),
            );
          }
        } else {
          token.enabled = false;
          successCount++;
        }
      } else {
        token.enabled = true;
        successCount++;
      }
    } catch {
      console.log(chalk.red(`❌ ${actionText}失败: ${token.alias || "Token"}`));
    }
  }

  // 保存更改
  await saveProvider(provider);

  // 显示结果
  console.log(chalk.cyan("\n操作结果:"));
  console.log(chalk.green(`✅ 成功${actionText}: ${successCount} 个Token`));
  await prompt([{ type: "input", name: "continue", message: "按回车继续..." }]);
}

// 禁用当前Token的快捷函数
async function disableCurrentToken(provider: Provider): Promise<void> {
  const allTokens = getAllTokensForDisplay(provider);
  const currentToken = getCurrentTokenForDisplay(provider);

  if (!currentToken) {
    console.log(chalk.yellow("❌ 当前没有使用任何Token"));
    await prompt([
      { type: "input", name: "continue", message: "按回车继续..." },
    ]);
    return;
  }

  const currentTokenConfig = allTokens.find((t) => t.value === currentToken);
  if (!currentTokenConfig) {
    console.log(chalk.yellow("❌ 找不到当前Token配置"));
    await prompt([
      { type: "input", name: "continue", message: "按回车继续..." },
    ]);
    return;
  }

  // 检查是否有其他可用Token
  const otherAvailableTokens = allTokens.filter(
    (t) => t.enabled !== false && t.value !== currentToken,
  );

  if (otherAvailableTokens.length === 0) {
    console.log(chalk.yellow(`❌ 没有其他可用Token，无法禁用当前Token`));
    console.log(chalk.gray("请先添加或启用其他Token"));
    await prompt([
      { type: "input", name: "continue", message: "按回车继续..." },
    ]);
    return;
  }

  console.log(
    chalk.yellow(
      `⚠️ 即将禁用当前使用的Token: ${currentTokenConfig.alias || "Token"}`,
    ),
  );

  // 禁用当前Token
  currentTokenConfig.enabled = false;

  // 自动切换到下一个可用Token
  const nextToken = otherAvailableTokens[0];
  const result = await updateEnvironmentVariable(provider, nextToken.value);

  await saveProvider(provider);

  if (result.success) {
    console.log(
      chalk.green(`✅ 已禁用Token: ${currentTokenConfig.alias || "Token"}`),
    );
    console.log(chalk.blue(`🔄 已自动切换到: ${nextToken.alias || "Token"}`));
  } else {
    console.log(
      chalk.yellow(`⚠️ 已禁用Token: ${currentTokenConfig.alias || "Token"}`),
    );
    console.log(chalk.yellow("🔄 环境变量更新失败，请手动切换"));
  }

  await prompt([{ type: "input", name: "continue", message: "按回车继续..." }]);
}

// 批量操作菜单
async function batchOperationsMenu(provider: Provider): Promise<void> {
  const allTokens = getAllTokensForDisplay(provider);

  if (allTokens.length < 2) {
    console.log(chalk.yellow("❌ 至少需要2个Token才能进行批量操作"));
    await prompt([
      { type: "input", name: "continue", message: "按回车继续..." },
    ]);
    return;
  }

  const menuChoices = [
    { name: "📦 批量禁用Token", value: "batch-disable" },
    { name: "📦 批量启用Token", value: "batch-enable" },
    { name: "🔙 返回", value: "back" },
  ];

  const { action } = await prompt([
    {
      type: "list",
      name: "action",
      message: "选择批量操作:",
      choices: menuChoices,
      pageSize: menuChoices.length,
      loop: true,
      prefix: "",
    },
  ]);

  if (action === "back") return;

  await handleBatchTokenOperation(provider, allTokens, action);
}

// 高级设置菜单
async function advancedSettingsMenu(provider: Provider): Promise<void> {
  const allTokens = getAllTokensForDisplay(provider);
  const hasMultipleTokens = allTokens.length > 1;

  const menuChoices = [
    { name: "✏️ 编辑Token", value: "edit" },
    { name: "🗑️ 删除Token", value: "delete" },
  ];

  if (hasMultipleTokens) {
    menuChoices.push({ name: "⚙️ 轮询策略", value: "strategy" });
  }

  menuChoices.push({ name: "🔙 返回", value: "back" });

  const { action } = await prompt([
    {
      type: "list",
      name: "action",
      message: "选择高级设置:",
      choices: menuChoices,
      pageSize: menuChoices.length,
      loop: true,
      prefix: "",
    },
  ]);

  if (action === "back") return;

  switch (action) {
    case "edit":
      await editTokenInteractive(provider);
      break;
    case "delete":
      await deleteTokenInteractive(provider);
      break;
    case "strategy":
      await setStrategyInteractive(provider);
      break;
  }
}
