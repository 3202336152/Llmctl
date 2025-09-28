import { Command } from "commander";
import chalk from "chalk";
import { configManager } from "../config.js";
import { providerRegistry } from "../providers/index.js";
import { setupProviderEnvironment } from "../utils/provider-setup.js";
import { prompt } from "../utils/inquirer.js";
import { ProviderImporter } from "../utils/provider-import.js";
import type { Provider, ProviderTemplate } from "../types.js";

export function createAddCommand(): Command {
  const addCommand = new Command("add")
    .description("添加新的 LLM Provider")
    .option("-i, --interactive", "使用交互式向导 (默认)")
    .option("-t, --template <type>", "使用指定的 Provider 模板")
    .option("--list-templates", "列出所有可用的 Provider 模板")
    .action(async (options) => {
      try {
        if (options.listTemplates) {
          await listProviderTemplates();
          return;
        }

        const templates = providerRegistry.getProviderTemplates();
        let selectedTemplate: ProviderTemplate;

        if (options.template) {
          const template = templates.find((t) => t.id === options.template);
          if (!template) {
            console.error(chalk.red(`❌ 模板 "${options.template}" 不存在`));
            console.log(
              chalk.blue("💡 使用 ") +
                chalk.cyan("ctl add --list-templates") +
                chalk.blue(" 查看可用模板"),
            );
            process.exit(1);
          }
          selectedTemplate = template;
        } else {
          selectedTemplate = await selectProviderTemplate(templates);
        }

        const provider = await createProviderFromTemplate(selectedTemplate);

        configManager.addProvider(provider);

        console.log(chalk.green(`✅ 成功添加 Provider: ${provider.name}`));
        console.log(
          chalk.blue("💡 使用 ") +
            chalk.cyan(`ctl use ${provider.id}`) +
            chalk.blue(" 选择此 Provider"),
        );

        // 询问是否立即选择此 Provider
        const { useNow } = await prompt([
          {
            type: "confirm",
            name: "useNow",
            message: "是否立即选择此 Provider 作为当前使用的 Provider?",
            default: true,
          },
        ]);

        if (useNow) {
          configManager.setActiveProvider(provider.id);
          console.log(
            chalk.green(`🎯 已选择 "${provider.name}" 作为当前 Provider`),
          );

          // 使用公共的 Provider 设置流程
          await setupProviderEnvironment(provider);
        }
      } catch (error) {
        console.error(
          chalk.red("❌ 添加 Provider 失败:"),
          error instanceof Error ? error.message : "未知错误",
        );
        process.exit(1);
      }
    });

  // 添加 import 子命令
  addCommand
    .command("import [file]")
    .description("从文件导入 Provider 配置 (支持 .json 和 .env 格式)")
    .action(async (file?: string) => {
      try {
        if (!file) {
          // 如果没有提供文件参数，显示帮助和模板
          await showImportHelp();
          return;
        }
        await importProvidersFromFile(file);
      } catch (error) {
        console.error(
          chalk.red("❌ 导入 Provider 失败:"),
          error instanceof Error ? error.message : "未知错误",
        );
        process.exit(1);
      }
    });

  return addCommand;
}

/**
 * 显示import命令的帮助信息和配置模板
 */
async function showImportHelp(): Promise<void> {
  const templates = ProviderImporter.getConfigTemplates();

  console.log(chalk.bold.blue("📖 Provider 配置文件导入指南\n"));

  // 显示使用说明
  templates.usage.forEach((line) => {
    if (
      line.startsWith("📁") ||
      line.startsWith("🚀") ||
      line.startsWith("📋") ||
      line.startsWith("💡")
    ) {
      console.log(chalk.bold(line));
    } else if (line.trim() === "") {
      console.log();
    } else if (line.startsWith("  ctl ")) {
      console.log(chalk.cyan(line));
    } else {
      console.log(line);
    }
  });

  console.log();

  // 直接选择模板格式，不询问是否查看
  const { templateFormat } = await prompt([
    {
      type: "list",
      name: "templateFormat",
      message: "选择要查看的模板格式:",
      choices: [
        { name: "JSON 格式 (.json)", value: "json" },
        { name: "环境变量格式 (.env)", value: "env" },
        { name: "两种格式都显示", value: "both" },
      ],
      default: "json",
    },
  ]);

  console.log();

  if (templateFormat === "json" || templateFormat === "both") {
    console.log(chalk.bold.green("📄 JSON 格式模板:"));
    console.log(chalk.gray("─".repeat(50)));
    console.log(templates.json);
    console.log(chalk.gray("─".repeat(50)));
    console.log(chalk.blue("💾 保存为: providers.json"));
    console.log();
  }

  if (templateFormat === "env" || templateFormat === "both") {
    console.log(chalk.bold.green("📄 ENV 格式模板:"));
    console.log(chalk.gray("─".repeat(50)));
    console.log(templates.env);
    console.log(chalk.gray("─".repeat(50)));
    console.log(chalk.blue("💾 保存为: .env 或 .env.local"));
    console.log();
  }

  // 询问是否生成示例文件
  const { generateFile } = await prompt([
    {
      type: "confirm",
      name: "generateFile",
      message: "是否生成示例配置文件到当前目录?",
      default: false,
    },
  ]);

  if (generateFile) {
    try {
      const fs = await import("fs");

      if (templateFormat === "json" || templateFormat === "both") {
        fs.writeFileSync("providers-example.json", templates.json);
        console.log(chalk.green("✅ 生成示例文件: providers-example.json"));
      }

      if (templateFormat === "env" || templateFormat === "both") {
        fs.writeFileSync(".env.example", templates.env);
        console.log(chalk.green("✅ 生成示例文件: .env.example"));
      }

      console.log(chalk.yellow("\n⚠️  请记得修改示例文件中的API Token!"));
      console.log(chalk.blue("💡 修改完成后运行:"));

      if (templateFormat === "json" || templateFormat === "both") {
        console.log(chalk.cyan("   ctl add import providers-example.json"));
      }
      if (templateFormat === "env" || templateFormat === "both") {
        console.log(chalk.cyan("   ctl add import .env.example"));
      }
    } catch (error) {
      console.error(
        chalk.red(
          `❌ 生成文件失败: ${error instanceof Error ? error.message : "未知错误"}`,
        ),
      );
    }
  }
}

async function listProviderTemplates(): Promise<void> {
  const templates = providerRegistry.getProviderTemplates();

  console.log(chalk.bold("📋 可用的 Provider 模板:\n"));

  templates.forEach((template, index) => {
    console.log(`${index + 1}. ${chalk.cyan(template.id)}`);
    console.log(`   名称: ${template.name}`);
    if (template.description) {
      console.log(`   描述: ${chalk.gray(template.description)}`);
    }
    console.log(
      `   环境变量: ${chalk.yellow(Object.keys(template.envVars).join(", "))}`,
    );
    console.log();
  });
}

async function selectProviderTemplate(
  templates: ProviderTemplate[],
): Promise<ProviderTemplate> {
  if (templates.length === 0) {
    throw new Error("没有可用的 Provider 模板");
  }

  if (templates.length === 1) {
    console.log(chalk.blue(`🎯 自动选择唯一可用的模板: ${templates[0].name}`));
    return templates[0];
  }

  const { selectedTemplateId } = await prompt([
    {
      type: "list",
      name: "selectedTemplateId",
      message: "请选择 Provider 类型:",
      choices: templates.map((template) => ({
        name: `${template.name} - ${template.description || template.id}`,
        value: template.id,
      })),
    },
  ]);

  return templates.find((t) => t.id === selectedTemplateId)!;
}

async function createProviderFromTemplate(
  template: ProviderTemplate,
): Promise<Provider> {
  console.log(chalk.blue(`\n🔧 配置 ${template.name}:\n`));

  const answers: Record<string, any> = {};

  // 首先询问 Provider 名称，自动生成ID
  const basicInfo = await prompt([
    {
      type: "input",
      name: "name",
      message: "请输入 Provider 名称:",
      default: template.name,
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return "Provider 名称不能为空";
        }
        return true;
      },
    },
    {
      type: "input",
      name: "description",
      message: "请输入 Provider 描述 (可选):",
      default: template.description,
    },
  ]);

  // 自动生成唯一的 Provider ID
  const generateId = (name: string): string => {
    const baseId = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-_]/g, "") // 移除特殊字符
      .replace(/\s+/g, "-") // 空格转为连字符
      .replace(/-+/g, "-") // 多个连字符合并为一个
      .replace(/^-|-$/g, ""); // 移除首尾连字符

    let counter = 0;
    let candidateId = baseId;

    // 如果ID已存在，添加数字后缀
    while (configManager.getProvider(candidateId)) {
      counter++;
      candidateId = `${baseId}-${counter}`;
    }

    return candidateId;
  };

  const generatedId = generateId(basicInfo.name);

  // 检查生成的ID是否冲突
  let finalId = generatedId;
  let needsCustomId = false;

  if (configManager.getProvider(generatedId)) {
    needsCustomId = true;
    console.log(chalk.yellow(`⚠️  ID "${generatedId}" 已存在`));
  } else {
    console.log(chalk.blue(`🆔 使用 Provider ID: ${chalk.cyan(generatedId)}`));
  }

  // 只有在ID冲突时才询问自定义ID
  if (needsCustomId) {
    const { customId } = await prompt([
      {
        type: "input",
        name: "customId",
        message: "请输入自定义 Provider ID:",
        default: `${generatedId}-2`,
        validate: (input: string) => {
          if (!input || input.trim().length === 0) {
            return "Provider ID 不能为空";
          }
          if (!/^[a-z0-9-_]+$/.test(input)) {
            return "Provider ID 只能包含小写字母、数字、连字符和下划线";
          }
          const existingProvider = configManager.getProvider(input);
          if (existingProvider) {
            return `Provider ID "${input}" 已存在`;
          }
          return true;
        },
      },
    ]);
    finalId = customId;
  }

  Object.assign(answers, { id: finalId, ...basicInfo });

  // 然后执行模板的设置提示
  for (const promptConfig of template.setupPrompts) {
    const result = await prompt([promptConfig as any]);
    Object.assign(answers, result);
  }

  // 构建 Provider 对象
  const provider: Provider = {
    id: answers.id,
    name: answers.name,
    description: answers.description || template.description,
    type: template.id, // 设置模板类型
    ...template.defaultValues,
    envVars: { ...template.envVars },
  };

  // 应用用户输入的值
  if (answers.apiKey) {
    const envVarKeys = Object.keys(template.envVars);
    const apiKeyVar = envVarKeys.find(
      (key) =>
        key.toLowerCase().includes("api_key") ||
        key.toLowerCase().includes("token"),
    );
    if (apiKeyVar) {
      provider.envVars[apiKeyVar] = answers.apiKey;
    }
  }

  if (answers.baseUrl) {
    provider.baseUrl = answers.baseUrl;
  }

  if (answers.modelName) {
    provider.modelName = answers.modelName;
  }

  if (answers.maxTokens) {
    provider.maxTokens = parseInt(answers.maxTokens);
  }

  if (answers.maxOutputTokens) {
    provider.maxOutputTokens = parseInt(answers.maxOutputTokens);
  }

  if (answers.temperature !== undefined) {
    provider.temperature = parseFloat(answers.temperature);
  }

  // 验证 Provider 配置
  const validation = providerRegistry.validateProvider(provider);
  if (!validation.isValid) {
    console.error(chalk.red("❌ Provider 配置验证失败:"));
    validation.errors.forEach((error) =>
      console.error(chalk.red(`  - ${error}`)),
    );
    throw new Error("Provider 配置无效");
  }

  return provider;
}

/**
 * 从文件导入Provider配置
 */
async function importProvidersFromFile(filePath: string): Promise<void> {
  console.log(chalk.blue(`📁 正在导入配置文件: ${filePath}`));

  const result = await ProviderImporter.importFromFile(filePath);

  // 显示错误信息
  if (result.errors.length > 0) {
    console.error(chalk.red("\n❌ 导入过程中出现错误:"));
    result.errors.forEach((error) => console.error(chalk.red(`  - ${error}`)));
  }

  // 显示警告信息
  if (result.warnings.length > 0) {
    console.warn(chalk.yellow("\n⚠️  警告:"));
    result.warnings.forEach((warning) =>
      console.warn(chalk.yellow(`  - ${warning}`)),
    );
  }

  if (!result.success || result.providers.length === 0) {
    console.error(chalk.red("\n❌ 未能导入任何有效的Provider配置"));
    process.exit(1);
  }

  console.log(
    chalk.green(`\n✅ 成功解析 ${result.providers.length} 个Provider配置:\n`),
  );

  // 显示解析的配置并让用户确认
  const providersToImport: Provider[] = [];

  for (const [index, provider] of result.providers.entries()) {
    console.log(`${index + 1}. ${chalk.cyan(provider.name)}`);
    console.log(`   ID: ${provider.id}`);
    console.log(`   类型: ${provider.type}`);
    console.log(`   Base URL: ${provider.baseUrl}`);
    if (provider.modelName) {
      console.log(`   模型: ${provider.modelName}`);
    }

    // 检查ID是否已存在
    const existingProvider = configManager.getProvider(provider.id);
    if (existingProvider) {
      console.log(
        chalk.yellow(`   ⚠️  ID "${provider.id}" 已存在，将生成新的ID`),
      );

      // 生成新的唯一ID
      let counter = 1;
      let newId = `${provider.id}-${counter}`;
      while (configManager.getProvider(newId)) {
        counter++;
        newId = `${provider.id}-${counter}`;
      }
      provider.id = newId;
      console.log(chalk.blue(`   🆔 新ID: ${provider.id}`));
    }

    // 验证Provider配置
    const validation = providerRegistry.validateProvider(provider);
    if (!validation.isValid) {
      console.log(chalk.red(`   ❌ 配置验证失败:`));
      validation.errors.forEach((error) =>
        console.log(chalk.red(`      - ${error}`)),
      );
      console.log(chalk.yellow(`   ⏭️  跳过此配置`));
    } else {
      console.log(chalk.green(`   ✅ 配置验证通过`));
      providersToImport.push(provider);
    }
    console.log();
  }

  if (providersToImport.length === 0) {
    console.error(chalk.red("❌ 没有有效的Provider配置可以导入"));
    process.exit(1);
  }

  // 询问用户是否确认导入
  const { confirmImport } = await prompt([
    {
      type: "confirm",
      name: "confirmImport",
      message: `确认导入 ${providersToImport.length} 个Provider配置吗?`,
      default: true,
    },
  ]);

  if (!confirmImport) {
    console.log(chalk.yellow("🚫 取消导入"));
    return;
  }

  // 批量添加Provider
  let successCount = 0;
  for (const provider of providersToImport) {
    try {
      configManager.addProvider(provider);
      console.log(
        chalk.green(`✅ 成功添加: ${provider.name} (${provider.id})`),
      );
      successCount++;
    } catch (error) {
      console.error(
        chalk.red(
          `❌ 添加失败 "${provider.name}": ${error instanceof Error ? error.message : "未知错误"}`,
        ),
      );
    }
  }

  console.log(
    chalk.green(
      `\n🎉 成功导入 ${successCount}/${providersToImport.length} 个Provider配置`,
    ),
  );

  // 询问是否选择其中一个作为当前Provider
  if (successCount > 0) {
    const choices = providersToImport.map((p) => ({
      name: `${p.name} (${p.id})`,
      value: p.id,
    }));
    choices.unshift({ name: "不选择，保持当前配置", value: "" });

    const { selectedProvider } = await prompt([
      {
        type: "list",
        name: "selectedProvider",
        message: "选择一个Provider作为当前使用的Provider:",
        choices,
      },
    ]);

    if (selectedProvider) {
      configManager.setActiveProvider(selectedProvider);
      const provider = configManager.getProvider(selectedProvider)!;
      console.log(chalk.green(`🎯 已选择 "${provider.name}" 作为当前Provider`));

      // 设置Provider环境
      await setupProviderEnvironment(provider);
    }
  }
}
