import { Command } from "commander";
import chalk from "chalk";
import { configManager } from "../config.js";
import { providerRegistry } from "../providers/index.js";
import { setupProviderEnvironment } from "../utils/provider-setup.js";
import { prompt } from "../utils/inquirer.js";
import type { Provider, ProviderTemplate } from "../types.js";

export function createAddCommand(): Command {
  return new Command("add")
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
