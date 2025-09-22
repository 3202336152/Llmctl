import { Command } from "commander";
import chalk from "chalk";
import { configManager } from "../config.js";
import { prompt } from "../utils/inquirer.js";

export function createRemoveCommand(): Command {
  return new Command("remove")
    .alias("rm")
    .description("删除指定的 LLM Provider")
    .argument("[provider-id]", "Provider ID (如果不提供则显示选择菜单)")
    .option("-f, --force", "强制删除，不显示确认提示")
    .option("--all", "删除所有 Providers (谨慎使用)")
    .action(async (providerId, options) => {
      try {
        const providers = configManager.getAllProviders();

        if (providers.length === 0) {
          console.log(chalk.yellow("😟 当前没有配置任何 LLM Provider"));
          return;
        }

        if (options.all) {
          await removeAllProviders(options.force);
          return;
        }

        let targetProviderId: string;

        if (providerId) {
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
          targetProviderId = providerId;
        } else {
          targetProviderId = await selectProviderToRemove(providers);
        }

        const provider = configManager.getProvider(targetProviderId)!;
        const isActive =
          configManager.getActiveProvider()?.id === targetProviderId;

        // 确认删除
        if (!options.force) {
          console.log(chalk.yellow(`\n⚠️  将要删除 Provider:`));
          console.log(`   名称: ${chalk.cyan(provider.name)}`);
          console.log(`   ID: ${chalk.gray(provider.id)}`);
          if (provider.description) {
            console.log(`   描述: ${chalk.gray(provider.description)}`);
          }
          if (isActive) {
            console.log(chalk.red("   这是当前使用的 Provider!"));
          }

          const { confirmDelete } = await prompt([
            {
              type: "confirm",
              name: "confirmDelete",
              message: `确定要删除 Provider "${provider.name}" 吗?`,
              default: false,
            },
          ]);

          if (!confirmDelete) {
            console.log(chalk.blue("📄 删除操作已取消"));
            return;
          }
        }

        // 执行删除
        const success = configManager.removeProvider(targetProviderId);
        if (!success) {
          console.error(chalk.red("❌ 删除 Provider 失败"));
          process.exit(1);
        }

        console.log(chalk.green(`✅ 已删除 Provider: ${provider.name}`));

        if (isActive) {
          console.log(
            chalk.yellow(
              "⚠️  已删除的 Provider 是当前使用的，请选择新的 Provider",
            ),
          );
          console.log(
            chalk.blue("💡 使用 ") +
              chalk.cyan("ctl use") +
              chalk.blue(" 选择新的 Provider"),
          );
        }

        // 如果还有其他 Providers，询问是否立即选择一个
        const remainingProviders = configManager.getAllProviders();
        if (remainingProviders.length > 0 && isActive) {
          const { selectNew } = await prompt([
            {
              type: "confirm",
              name: "selectNew",
              message: "是否现在选择一个新的 Provider?",
              default: true,
            },
          ]);

          if (selectNew) {
            const { newProviderId } = await prompt([
              {
                type: "list",
                name: "newProviderId",
                message: "请选择新的 Provider:",
                choices: remainingProviders.map((p) => ({
                  name: `${p.name} - ${p.description || p.id}`,
                  value: p.id,
                })),
              },
            ]);

            configManager.setActiveProvider(newProviderId);
            const newProvider = configManager.getProvider(newProviderId)!;
            console.log(
              chalk.green(`🎯 已选择 "${newProvider.name}" 作为当前 Provider`),
            );
          }
        }
      } catch (error) {
        console.error(
          chalk.red("❌ 删除 Provider 失败:"),
          error instanceof Error ? error.message : "未知错误",
        );
        process.exit(1);
      }
    });
}

async function selectProviderToRemove(providers: any[]): Promise<string> {
  const activeProvider = configManager.getActiveProvider();

  const choices = providers.map((provider) => {
    const isActive = activeProvider?.id === provider.id;
    const name = isActive ? `${provider.name} (当前使用)` : provider.name;
    const description = provider.description
      ? ` - ${provider.description}`
      : "";

    return {
      name: `${name}${description}`,
      value: provider.id,
    };
  });

  const { selectedProviderId } = await prompt([
    {
      type: "list",
      name: "selectedProviderId",
      message: "请选择要删除的 Provider:",
      choices,
      pageSize: 10,
    },
  ]);

  return selectedProviderId;
}

async function removeAllProviders(force: boolean): Promise<void> {
  const providers = configManager.getAllProviders();

  if (!force) {
    console.log(
      chalk.red(
        `\n⚠️  危险操作: 将要删除所有 ${providers.length} 个 Providers!`,
      ),
    );
    console.log(chalk.gray("这将清除所有配置的 LLM Providers"));

    const { confirmDeleteAll } = await prompt([
      {
        type: "input",
        name: "confirmDeleteAll",
        message: '请输入 "DELETE ALL" 确认删除所有 Providers:',
        validate: (input: string) => {
          if (input === "DELETE ALL") {
            return true;
          }
          return '请输入 "DELETE ALL" 确认删除';
        },
      },
    ]);

    if (confirmDeleteAll !== "DELETE ALL") {
      console.log(chalk.blue("📄 删除操作已取消"));
      return;
    }
  }

  // 删除所有 Providers
  let deleteCount = 0;
  for (const provider of providers) {
    const success = configManager.removeProvider(provider.id);
    if (success) {
      deleteCount++;
    }
  }

  console.log(chalk.green(`✅ 已删除 ${deleteCount} 个 Providers`));

  if (deleteCount > 0) {
    console.log(
      chalk.blue("💡 使用 ") +
        chalk.cyan("ctl add") +
        chalk.blue(" 添加新的 Provider"),
    );
  }
}
