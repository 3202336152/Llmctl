import { Command } from "commander";
import chalk from "chalk";
import { configManager } from "../config.js";
import { setupProviderEnvironment } from "../utils/provider-setup.js";
import { prompt } from "../utils/inquirer.js";

export function createUseCommand(): Command {
  return new Command("use")
    .description("选择 LLM Provider 并可选择启动相应的 CLI 工具")
    .argument("[provider-id]", "Provider ID (如果不提供则显示选择菜单)")
    .option("-l, --list", "显示可选择的 Providers 列表")
    .option("-c, --cli", "选择 Provider 后自动询问启动CLI工具")
    .action(async (providerId, options) => {
      try {
        const providers = configManager.getAllProviders();

        if (providers.length === 0) {
          console.log(chalk.yellow("😟 当前没有配置任何 LLM Provider"));
          console.log(
            chalk.blue("💡 使用 ") +
              chalk.cyan("ctl add") +
              chalk.blue(" 添加一个新的 Provider"),
          );
          return;
        }

        if (options.list) {
          listAvailableProviders();
          return;
        }

        let selectedProviderId: string;

        if (providerId) {
          // 验证提供的 Provider ID 是否存在
          const provider = configManager.getProvider(providerId);
          if (!provider) {
            console.error(chalk.red(`❌ Provider "${providerId}" 不存在`));
            console.log(
              chalk.blue("💡 使用 ") +
                chalk.cyan("ctl list") +
                chalk.blue(" 查看可用的 Providers"),
            );
            process.exit(1);
          }
          selectedProviderId = providerId;
        } else {
          // 显示交互式选择菜单
          selectedProviderId = await selectProviderInteractively(providers);
        }

        const success = configManager.setActiveProvider(selectedProviderId);
        if (!success) {
          console.error(chalk.red(`❌ 设置活跃 Provider 失败`));
          process.exit(1);
        }

        const selectedProvider = configManager.getProvider(selectedProviderId)!;
        console.log(
          chalk.green(`✅ 已选择 "${selectedProvider.name}" 作为当前 Provider`),
        );

        // 使用公共的 Provider 设置流程
        await setupProviderEnvironment(selectedProvider);
      } catch (error) {
        console.error(
          chalk.red("❌ 选择 Provider 失败:"),
          error instanceof Error ? error.message : "未知错误",
        );
        process.exit(1);
      }
    });
}

function listAvailableProviders(): void {
  const providers = configManager.getAllProviders();
  const activeProvider = configManager.getActiveProvider();

  console.log(chalk.bold("📋 可选择的 Providers:\n"));

  providers.forEach((provider, index) => {
    const isActive = activeProvider?.id === provider.id;
    const icon = isActive ? "🟢" : "⚪";
    const name = isActive ? chalk.green.bold(provider.name) : provider.name;
    const status = isActive ? chalk.green(" (当前使用)") : "";

    console.log(`${icon} ${index + 1}. ${name}${status}`);
    console.log(`   ID: ${chalk.cyan(provider.id)}`);
    if (provider.description) {
      console.log(`   描述: ${chalk.gray(provider.description)}`);
    }
    console.log();
  });
}

async function selectProviderInteractively(providers: any[]): Promise<string> {
  const activeProvider = configManager.getActiveProvider();

  // 创建Provider选择列表
  const choices = providers.map((provider) => {
    const isActive = activeProvider?.id === provider.id;
    const name = isActive ? chalk.green(provider.name) : provider.name;
    const status = isActive ? chalk.gray(" (当前使用)") : "";
    const description = provider.description
      ? ` - ${provider.description}`
      : "";

    return {
      name: `${name}${status}${description}`,
      value: provider.id,
    };
  });

  const { selectedProviderId } = await prompt([
    {
      type: "list",
      name: "selectedProviderId",
      message: "请选择要使用的 LLM Provider:",
      choices,
      pageSize: 10,
    },
  ]);

  return selectedProviderId;
}
