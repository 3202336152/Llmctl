import { Command } from "commander";
import chalk from "chalk";
import { configManager } from "../config.js";

export function createListCommand(): Command {
  return new Command("list")
    .alias("ls")
    .description("列出所有已配置的 LLM Provider")
    .option("-v, --verbose", "显示详细信息")
    .option("--json", "以 JSON 格式输出")
    .action(async (options) => {
      try {
        const providers = configManager.getAllProviders();
        const activeProvider = configManager.getActiveProvider();

        if (options.json) {
          console.log(
            JSON.stringify(
              {
                providers,
                activeProviderId: activeProvider?.id,
                total: providers.length,
              },
              null,
              2,
            ),
          );
          return;
        }

        if (providers.length === 0) {
          console.log(chalk.yellow("😟 当前没有配置任何 LLM Provider"));
          console.log(
            chalk.blue("💡 使用 ") +
              chalk.cyan("ctl add") +
              chalk.blue(" 添加一个新的 Provider"),
          );
          return;
        }

        console.log(
          chalk.bold(`📋 已配置的 LLM Providers (${providers.length}):\n`),
        );

        providers.forEach((provider, index) => {
          const isActive = activeProvider?.id === provider.id;
          const icon = isActive ? "🟢" : "⚪";
          const name = isActive
            ? chalk.green.bold(provider.name)
            : provider.name;
          const status = isActive ? chalk.green(" (当前使用)") : "";

          console.log(`${icon} ${index + 1}. ${name}${status}`);
          console.log(`   ID: ${chalk.cyan(provider.id)}`);

          if (provider.description) {
            console.log(`   描述: ${chalk.gray(provider.description)}`);
          }

          if (options.verbose) {
            if (provider.baseUrl) {
              console.log(`   Base URL: ${chalk.blue(provider.baseUrl)}`);
            }
            if (provider.modelName) {
              console.log(`   模型: ${chalk.yellow(provider.modelName)}`);
            }
            if (provider.maxTokens) {
              console.log(
                `   最大 Tokens: ${chalk.magenta(provider.maxTokens)}`,
              );
            }
            if (provider.temperature !== undefined) {
              console.log(`   温度: ${chalk.magenta(provider.temperature)}`);
            }

            const envVarCount = Object.keys(provider.envVars || {}).length;
            console.log(`   环境变量: ${chalk.gray(`${envVarCount} 个`)}`);
          }

          console.log();
        });

        if (!activeProvider) {
          console.log(chalk.yellow("⚠️  当前没有选择活跃的 Provider"));
          console.log(
            chalk.blue("💡 使用 ") +
              chalk.cyan("ctl use <provider-id>") +
              chalk.blue(" 选择一个 Provider"),
          );
        }
      } catch (error) {
        console.error(
          chalk.red("❌ 列出 Providers 失败:"),
          error instanceof Error ? error.message : "未知错误",
        );
        process.exit(1);
      }
    });
}
