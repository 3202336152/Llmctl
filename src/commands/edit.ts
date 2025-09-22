import { Command } from "commander";
import chalk from "chalk";
import { configManager } from "../config.js";
import { providerRegistry } from "../providers/index.js";
import { prompt } from "../utils/inquirer.js";
import type { Provider } from "../types.js";

export function createEditCommand(): Command {
  return new Command("edit")
    .alias("update")
    .description("修改已有的 LLM Provider 配置")
    .argument("[provider-id]", "要修改的 Provider ID")
    .option("-i, --interactive", "使用交互式模式 (默认)")
    .action(async (providerId: string | undefined, _options) => {
      try {
        const allProviders = configManager.getAllProviders();

        if (allProviders.length === 0) {
          console.log(chalk.yellow("📭 没有已配置的 Provider"));
          console.log(
            chalk.blue("💡 使用 ") +
              chalk.cyan("ctl add") +
              chalk.blue(" 添加新的 Provider"),
          );
          return;
        }

        let targetProvider: Provider;

        if (providerId) {
          const provider = configManager.getProvider(providerId);
          if (!provider) {
            console.error(chalk.red(`❌ Provider "${providerId}" 不存在`));
            console.log(
              chalk.blue("💡 使用 ") +
                chalk.cyan("ctl list") +
                chalk.blue(" 查看所有 Provider"),
            );
            process.exit(1);
          }
          targetProvider = provider;
        } else {
          targetProvider = await selectProviderToEdit(allProviders);
        }

        console.log(chalk.blue(`\n🔧 修改 Provider: ${targetProvider.name}\n`));

        const updatedProvider = await editProvider(targetProvider);

        configManager.updateProvider(targetProvider.id, updatedProvider);

        console.log(
          chalk.green(
            `✅ 成功修改 Provider: ${updatedProvider.name || targetProvider.name}`,
          ),
        );

        // 如果修改的是当前活跃的 Provider，提示用户手动更新环境变量
        const currentProvider = configManager.getActiveProvider();
        if (currentProvider && currentProvider.id === targetProvider.id) {
          console.log(
            chalk.blue("💡 这是当前使用的 Provider，建议重新导出环境变量："),
          );
          console.log(chalk.cyan("ctl export"));
        }
      } catch (error) {
        console.error(
          chalk.red("❌ 修改 Provider 失败:"),
          error instanceof Error ? error.message : "未知错误",
        );
        process.exit(1);
      }
    });
}

async function selectProviderToEdit(providers: Provider[]): Promise<Provider> {
  const { selectedProviderId } = await prompt([
    {
      type: "list",
      name: "selectedProviderId",
      message: "请选择要修改的 Provider:",
      choices: providers.map((provider) => ({
        name: `${provider.name} (${provider.id})${provider.description ? ` - ${provider.description}` : ""}`,
        value: provider.id,
      })),
    },
  ]);

  return providers.find((p) => p.id === selectedProviderId)!;
}

async function editProvider(provider: Provider): Promise<Partial<Provider>> {
  // 获取当前的API Token值
  const currentApiKey = provider.envVars?.ANTHROPIC_AUTH_TOKEN || "";
  const currentModel =
    provider.envVars?.ANTHROPIC_MODEL || provider.modelName || "";

  const editableFields = [
    { name: "配置名称", key: "name", value: provider.name },
    { name: "配置描述", key: "description", value: provider.description || "" },
    { name: "API地址", key: "baseUrl", value: provider.baseUrl || "" },
    { name: "API密钥", key: "apiKey", value: currentApiKey, sensitive: true },
    { name: "模型名称", key: "modelName", value: currentModel },
  ];

  // 显示当前配置
  console.log(chalk.blue("📋 当前配置:"));
  editableFields.forEach((field) => {
    if (field.value) {
      console.log(`   ${chalk.cyan(field.name)}: ${field.value}`);
    }
  });
  console.log();

  const { fieldsToEdit } = await prompt([
    {
      type: "checkbox",
      name: "fieldsToEdit",
      message: "请选择要修改的字段:",
      choices: editableFields.map((field) => ({
        name: `${field.name} (当前: ${field.value || "(未设置)"})`,
        value: field.key,
        checked: false,
      })),
      validate: (choices: string[]) => {
        if (choices.length === 0) {
          return "请至少选择一个要修改的字段";
        }
        return true;
      },
    },
  ]);

  const updates: Partial<Provider> = {};

  for (const fieldKey of fieldsToEdit) {
    const field = editableFields.find((f) => f.key === fieldKey)!;

    if (fieldKey === "apiKey") {
      const { newApiKey } = await prompt([
        {
          type: "password",
          name: "newApiKey",
          message: "请输入新的 API密钥:",
          mask: "*",
          validate: (input: string) => {
            if (!input || input.length < 10) {
              return "API密钥不能为空且长度至少为 10 个字符";
            }
            return true;
          },
        },
      ]);

      // 更新环境变量中的 token
      const envVarKeys = Object.keys(provider.envVars || {});
      const tokenKey = envVarKeys.find(
        (key) =>
          key.toLowerCase().includes("token") ||
          key.toLowerCase().includes("api_key"),
      );

      if (tokenKey) {
        updates.envVars = {
          ...provider.envVars,
          [tokenKey]: newApiKey,
        };
      }
    } else if (fieldKey === "modelName") {
      const { newModelName } = await prompt([
        {
          type: "input",
          name: "newModelName",
          message: "请输入新的模型名称 (ANTHROPIC_MODEL，仅中转时需要):",
          default: field.value || "",
          validate: (_input: string) => {
            // 允许空值，因为不是必需的
            return true;
          },
        },
      ]);

      // 更新模型名称到 Provider 和环境变量
      updates.modelName = newModelName;
      // 只有当模型名称不为空时才设置 ANTHROPIC_MODEL 环境变量
      if (newModelName && newModelName.trim() !== "") {
        updates.envVars = {
          ...provider.envVars,
          ANTHROPIC_MODEL: newModelName,
        };
      } else {
        // 如果清空模型名称，从环境变量中移除 ANTHROPIC_MODEL
        const updatedEnvVars = { ...provider.envVars };
        delete updatedEnvVars.ANTHROPIC_MODEL;
        updates.envVars = updatedEnvVars;
      }
    } else {
      const { newValue } = await prompt([
        {
          type: "input",
          name: "newValue",
          message: `请输入新的 ${field.name}:`,
          default:
            fieldKey === "description" ? field.value : field.value || undefined,
          validate: (input: string) => {
            if (fieldKey === "name" && (!input || input.trim().length === 0)) {
              return "配置名称不能为空";
            }
            if (fieldKey === "baseUrl" && input && !input.startsWith("http")) {
              return "API地址必须以 http:// 或 https:// 开头";
            }
            return true;
          },
        },
      ]);

      if (fieldKey === "description") {
        (updates as any)[fieldKey] = newValue || undefined;
      } else {
        (updates as any)[fieldKey] = newValue;
      }
    }
  }

  // 验证更新后的配置
  const updatedProvider = { ...provider, ...updates };
  const validation = providerRegistry.validateProvider(updatedProvider);
  if (!validation.isValid) {
    console.error(chalk.red("❌ 修改后的配置验证失败:"));
    validation.errors.forEach((error) =>
      console.error(chalk.red(`  - ${error}`)),
    );
    throw new Error("Provider 配置无效");
  }

  return updates;
}
