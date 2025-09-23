import { Command } from "commander";
import chalk from "chalk";
import { configManager } from "../config.js";
import { TokenRotationManager } from "../utils/token-rotation.js";
import { prompt } from "../utils/inquirer.js";
import type { Provider, TokenConfig } from "../types.js";

export function createTokensCommand(): Command {
  return new Command("tokens")
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

  const choices = providers.map((p) => ({
    name: `${p.name} (${p.id})`,
    value: p.id,
  }));

  const { providerId } = await prompt([
    {
      type: "list",
      name: "providerId",
      message: "选择要管理Token的Provider:",
      choices,
      pageSize: choices.length, // 显示所有选项，避免分页
      loop: false,
      prefix: "", // 移除前缀减少闪烁
    },
  ]);

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

    const menuChoices = [
      { name: "📋 查看Token详情", value: "list" },
      { name: "➕ 添加Token", value: "add" },
      { name: "✏️  编辑Token", value: "edit" },
      { name: "🗑️  删除Token", value: "delete" },
      { name: "⚙️  设置轮询策略", value: "strategy" },
      { name: "🔄 快速切换Token状态", value: "quick-toggle" },
      { name: "🚪 退出", value: "exit" },
    ];

    const { action } = await prompt([
      {
        type: "list",
        name: "action",
        message: "选择操作:",
        choices: menuChoices,
        default: menuChoices[lastSelectedIndex]?.value, // 保持上次选择的位置
        pageSize: menuChoices.length, // 显示所有选项，避免分页
        loop: false, // 禁用循环选择
        prefix: "", // 移除前缀减少闪烁
      },
    ]);

    // 找到当前选择的索引位置，用于下次保持位置
    lastSelectedIndex = menuChoices.findIndex(
      (choice) => choice.value === action,
    );
    if (lastSelectedIndex === -1) lastSelectedIndex = 0;

    switch (action) {
      case "list":
        showTokenList(provider);
        await prompt([
          { type: "input", name: "continue", message: "按回车继续..." },
        ]);
        break;
      case "add":
        await addTokenInteractive(provider);
        break;
      case "edit":
        await editTokenInteractive(provider);
        break;
      case "delete":
        await deleteTokenInteractive(provider);
        break;
      case "strategy":
        await setStrategyInteractive(provider);
        break;
      case "quick-toggle":
        await quickToggleTokenStatus(provider);
        break;
      case "exit":
        return;
    }
  }
}

// 显示Token摘要 - 统一显示方式
function showTokenSummary(provider: Provider): void {
  const allTokens = getAllTokensForDisplay(provider);

  if (allTokens.length === 0) {
    console.log(chalk.red("❌ 当前没有任何Token配置"));
    console.log(chalk.gray("💡 请添加Token以开始使用\n"));
  } else {
    const enabled = allTokens.filter((t) => t.enabled !== false).length;
    const healthy = allTokens.filter((t) => t.healthy !== false).length;
    console.log(chalk.green("🔄 Token管理"));
    console.log(
      chalk.blue(
        `📊 Token数量: ${enabled}/${allTokens.length} 可用, ${healthy}/${allTokens.length} 健康`,
      ),
    );

    if (allTokens.length > 1) {
      const strategy = provider.tokenStrategy?.type || "round-robin";
      console.log(chalk.blue(`🔄 轮询策略: ${getStrategyName(strategy)}`));
    }
    console.log();
  }
}

// 添加Token
async function addTokenInteractive(provider: Provider): Promise<void> {
  console.log(chalk.blue("\n➕ 添加新Token\n"));

  const { tokenValue, alias, weight, healthy } = await prompt([
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
    {
      type: "confirm",
      name: "healthy",
      message: "是否为健康状态?",
      default: true,
    },
  ]);

  const newToken = {
    value: tokenValue,
    alias: alias || undefined,
    weight: parseInt(weight) as number,
    enabled: true, // 默认启用，直接加入轮询池
    healthy: healthy as boolean,
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
        healthy: true as boolean,
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
    name: `${token.alias || `Token-${index + 1}`} (${token.value.slice(0, 8)}...) - 权重:${token.weight || 1} ${token.enabled === false ? "[已禁用]" : ""} ${token.healthy === false ? "[不健康]" : ""}`,
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
      loop: false,
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
  const { alias, weight, enabled, healthy } = await prompt([
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
    {
      type: "confirm",
      name: "healthy",
      message: "是否为健康状态?",
      default: token.healthy !== false,
    },
  ]);

  // 更新Token - 现在所有token都在tokens数组中
  if (provider.tokens && provider.tokens[tokenIndex]) {
    const actualToken = provider.tokens[tokenIndex];
    actualToken.alias = alias || undefined;
    actualToken.weight = parseInt(weight);
    actualToken.enabled = enabled;
    actualToken.healthy = healthy;
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
      loop: false,
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
      loop: false,
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
async function quickToggleTokenStatus(provider: Provider): Promise<void> {
  const allTokens = getAllTokensForDisplay(provider);

  if (allTokens.length === 0) {
    console.log(chalk.yellow("❌ 没有可操作的Token"));
    return;
  }

  if (allTokens.length === 1) {
    console.log(chalk.yellow("⚠️  只有一个Token，无需切换"));
    return;
  }

  console.log(chalk.cyan("\n🔄 快速切换Token状态\n"));

  // 获取当前正在使用的token - 使用统一函数
  const currentToken = getCurrentTokenForDisplay(provider);

  // 显示当前token状态
  console.log(chalk.bold("当前Token状态:"));
  allTokens.forEach((token, index) => {
    const statusIcon = token.enabled === false ? "❌" : "✅";
    const statusText =
      token.enabled === false ? chalk.red("[已禁用]") : chalk.green("[已启用]");

    // 检查是否为当前使用的token
    const isCurrent = token.value === currentToken;
    const currentMarker = isCurrent ? chalk.yellow(" ⭐") : "";

    console.log(
      `${index + 1}. ${statusIcon} ${chalk.cyan(token.alias || `Token-${index + 1}`)}${currentMarker} ${statusText}`,
    );
  });

  // 动态生成菜单选项
  const menuChoices = [];

  // 1. 禁用当前Token选项 (第一个)
  if (currentToken) {
    const currentTokenInfo = allTokens.find((t) => t.value === currentToken);
    if (currentTokenInfo && currentTokenInfo.enabled !== false) {
      menuChoices.push({
        name: `🚫 禁用当前Token (${currentTokenInfo.alias || "Token"})`,
        value: "disable-current",
      });
    }
  }

  // 2. 其他操作选项
  menuChoices.push(
    { name: "📦 批量禁用Token", value: "batch-disable" },
    { name: "📦 批量启用Token", value: "batch-enable" },
  );

  menuChoices.push({ name: "🔙 返回", value: "back" });

  const { action } = await prompt([
    {
      type: "list",
      name: "action",
      message: "\n选择操作:",
      choices: menuChoices,
      pageSize: menuChoices.length, // 动态设置页面大小
      loop: false,
    },
  ]);

  if (action === "back") return;

  // 处理快捷禁用当前Token
  if (action === "disable-current") {
    const currentTokenInfo = allTokens.find((t) => t.value === currentToken);
    if (currentTokenInfo) {
      await disableCurrentTokenQuickly(provider, currentTokenInfo, allTokens);
    }
    return;
  }

  // 处理批量操作
  if (action === "batch-disable" || action === "batch-enable") {
    await handleBatchTokenOperation(provider, allTokens, action);
    return;
  }
}

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
      token.enabled === false
        ? chalk.red("[已禁用]")
        : token.healthy === false
          ? chalk.yellow("[不健康]")
          : chalk.green("[健康]");

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
        healthy: true,
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
      if (
        tokenConfig &&
        tokenConfig.enabled !== false &&
        tokenConfig.healthy !== false
      ) {
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
async function disableCurrentTokenQuickly(
  provider: Provider,
  targetToken: TokenConfig,
  allTokens: TokenConfig[],
): Promise<void> {
  console.log(
    chalk.yellow(
      `⚠️  即将禁用当前使用的Token: ${targetToken.alias || "Token"}`,
    ),
  );

  // 先获取下一个可用Token（在禁用当前Token之前，排除当前要禁用的token）
  const nextToken = TokenRotationManager.getNextToken(
    provider,
    targetToken.value,
  );

  if (nextToken && nextToken !== targetToken.value) {
    // 先切换到下一个Token
    const result = await updateEnvironmentVariable(provider, nextToken);

    if (result.success) {
      // 切换成功后再禁用原Token
      targetToken.enabled = false;
      await saveProvider(provider);

      const nextTokenInfo = allTokens.find((t) => t.value === nextToken);
      console.log(
        chalk.green(
          `✅ 已自动切换到: ${nextTokenInfo?.alias || "Token"} (${nextToken.slice(0, 8)}...)`,
        ),
      );
      console.log(chalk.blue("🔄 环境变量已在当前进程中生效"));

      // 验证环境变量是否真的已经设置
      const currentEnvToken = process.env.ANTHROPIC_AUTH_TOKEN;
      if (currentEnvToken === nextToken) {
        console.log(chalk.green("✓ 验证通过：环境变量已更新"));
      } else {
        console.log(
          chalk.yellow("⚠️  注意：环境变量可能需要重启终端才能完全生效"),
        );
      }

      console.log(
        chalk.green(`✅ 已禁用Token "${targetToken.alias || "Token"}"`),
      );
    } else {
      console.log(chalk.red(`❌ 切换失败: ${result.message}`));
      console.log(chalk.yellow("取消禁用操作"));
    }
  } else {
    console.log(chalk.red("❌ 没有其他可用Token，无法禁用当前Token"));
    console.log(chalk.yellow("请先添加或启用其他Token"));
  }

  // 等待用户确认后继续
  await prompt([{ type: "input", name: "continue", message: "按回车继续..." }]);
}

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
      loop: false,
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
  let errorCount = 0;

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
              errorCount++;
            }
          } else {
            console.log(
              chalk.red(
                `❌ 无其他可用Token，跳过禁用: ${token.alias || "Token"}`,
              ),
            );
            errorCount++;
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
      errorCount++;
    }
  }

  // 保存更改
  await saveProvider(provider);

  // 显示结果
  console.log(chalk.cyan("\n操作结果:"));
  console.log(chalk.green(`✅ 成功${actionText}: ${successCount} 个Token`));
  if (errorCount > 0) {
    console.log(chalk.red(`❌ 失败: ${errorCount} 个Token`));
  }

  await prompt([{ type: "input", name: "continue", message: "按回车继续..." }]);
}
