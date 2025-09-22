import { Command } from "commander";
import chalk from "chalk";
import { providerRegistry } from "../providers/index.js";
import { prompt as askUser } from "../utils/inquirer.js";
import type { PromptConfig, ProviderTemplate } from "../types.js";

export function createTemplateCommand(): Command {
  const templateCommand = new Command("template")
    .alias("templates")
    .description("管理 Provider 模板");

  // 子命令：列出模板
  templateCommand
    .command("list")
    .alias("ls")
    .description("列出所有可用的 Provider 模板")
    .option("--json", "以 JSON 格式输出")
    .action(async (_options) => {
      const templates = providerRegistry.getProviderTemplates();

      if (_options.json) {
        console.log(JSON.stringify(templates, null, 2));
        return;
      }

      if (templates.length === 0) {
        console.log(chalk.yellow("📭 没有可用的 Provider 模板"));
        return;
      }

      console.log(
        chalk.bold(`📋 可用的 Provider 模板 (${templates.length}):\n`),
      );

      templates.forEach((template, index) => {
        console.log(
          `${chalk.cyan(`${index + 1}.`)} ${chalk.bold(template.name)}`,
        );
        console.log(`   ID: ${chalk.gray(template.id)}`);
        if (template.description) {
          console.log(`   描述: ${template.description}`);
        }
        console.log(
          `   环境变量: ${chalk.yellow(Object.keys(template.envVars).join(", "))}`,
        );
        console.log();
      });
    });

  // 子命令：显示模板详情
  templateCommand
    .command("show")
    .alias("info")
    .description("显示指定模板的详细信息")
    .argument("<template-id>", "模板 ID")
    .option("--json", "以 JSON 格式输出")
    .action(async (templateId: string, _options) => {
      const templates = providerRegistry.getProviderTemplates();
      const template = templates.find((t) => t.id === templateId);

      if (!template) {
        console.error(chalk.red(`❌ 模板 "${templateId}" 不存在`));
        console.log(
          chalk.blue("💡 使用 ") +
            chalk.cyan("ctl template list") +
            chalk.blue(" 查看所有模板"),
        );
        process.exit(1);
      }

      if (_options.json) {
        console.log(JSON.stringify(template, null, 2));
        return;
      }

      console.log(chalk.bold(`📄 模板详情: ${template.name}\n`));
      console.log(`${chalk.cyan("ID:")} ${template.id}`);
      console.log(`${chalk.cyan("名称:")} ${template.name}`);
      if (template.description) {
        console.log(`${chalk.cyan("描述:")} ${template.description}`);
      }

      console.log(`\n${chalk.cyan("环境变量:")}`);
      Object.entries(template.envVars).forEach(([key, value]) => {
        console.log(`  ${chalk.yellow(key)}: ${value || "(用户配置)"}`);
      });

      if (template.defaultValues) {
        console.log(`\n${chalk.cyan("默认值:")}`);
        Object.entries(template.defaultValues).forEach(([key, value]) => {
          console.log(`  ${chalk.yellow(key)}: ${value}`);
        });
      }

      console.log(`\n${chalk.cyan("配置项:")}`);
      template.setupPrompts.forEach((askUser, index) => {
        console.log(`  ${index + 1}. ${askUser.message}`);
        console.log(`     类型: ${askUser.type || "input"}`);
        if (askUser.required !== false) {
          console.log(`     必填: ${askUser.required === true ? "是" : "否"}`);
        }
        if (askUser.default) {
          console.log(`     默认值: ${askUser.default}`);
        }
        console.log();
      });
    });

  // 子命令：创建自定义模板
  templateCommand
    .command("create")
    .alias("new")
    .description("创建自定义 Provider 模板")
    .option("-i, --interactive", "使用交互式模式 (默认)")
    .action(async (_options) => {
      console.log(chalk.bold.blue("🎨 创建自定义 Provider 模板\n"));

      const template = await createCustomTemplate();

      // 这里我们只显示创建的模板，实际注册需要重启应用
      console.log(chalk.green("✅ 模板创建完成！\n"));
      console.log(chalk.blue("📋 模板内容:"));
      console.log(JSON.stringify(template, null, 2));

      console.log(chalk.yellow("\n⚠️  注意："));
      console.log("自定义模板需要通过编程方式注册到系统中。");
      console.log("您可以将上述 JSON 内容保存为文件，然后在代码中导入并注册。");
      console.log("\n示例代码:");
      console.log(
        chalk.gray(`
import { BaseProvider, providerRegistry } from 'llmctl'

class CustomProvider extends BaseProvider {
  getTemplate() {
    return ${JSON.stringify(template, null, 4)}
  }

  validateConfig(provider) {
    // 添加验证逻辑
    return { isValid: true, errors: [] }
  }

  getEnvVars(provider) {
    // 返回环境变量
    return provider.envVars || {}
  }
}

providerRegistry.registerProvider(new CustomProvider())
      `),
      );
    });

  return templateCommand;
}

async function createCustomTemplate(): Promise<ProviderTemplate> {
  // 基本信息
  const basicInfo = await askUser([
    {
      type: "input",
      name: "id",
      message: "请输入模板 ID:",
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return "模板 ID 不能为空";
        }
        if (!/^[a-z0-9-_]+$/.test(input)) {
          return "模板 ID 只能包含小写字母、数字、连字符和下划线";
        }
        return true;
      },
    },
    {
      type: "input",
      name: "name",
      message: "请输入模板名称:",
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return "模板名称不能为空";
        }
        return true;
      },
    },
    {
      type: "input",
      name: "description",
      message: "请输入模板描述:",
    },
  ]);

  // 环境变量配置
  console.log(chalk.blue("\n🔧 配置环境变量:"));
  const envVars: Record<string, string> = {};
  let addMore = true;

  while (addMore) {
    const {
      envKey,
      envValue,
      continue: shouldContinue,
    } = await askUser([
      {
        type: "input",
        name: "envKey",
        message: "请输入环境变量名称:",
        validate: (input: string) => {
          if (!input || input.trim().length === 0) {
            return "环境变量名称不能为空";
          }
          if (!/^[A-Z][A-Z0-9_]*$/.test(input)) {
            return "环境变量名称应该使用大写字母、数字和下划线";
          }
          return true;
        },
      },
      {
        type: "input",
        name: "envValue",
        message: "请输入默认值 (留空表示用户配置):",
      },
      {
        type: "confirm",
        name: "continue",
        message: "是否继续添加环境变量?",
        default: false,
      },
    ]);

    envVars[envKey] = envValue || "";
    addMore = shouldContinue;
  }

  // 配置提示项
  console.log(chalk.blue("\n📝 配置用户输入项:"));
  const setupPrompts: PromptConfig[] = [];
  addMore = true;

  while (addMore) {
    const promptConfig = await createPromptConfig();
    setupPrompts.push(promptConfig);

    const { continue: shouldContinue } = await askUser([
      {
        type: "confirm",
        name: "continue",
        message: "是否继续添加输入项?",
        default: false,
      },
    ]);

    addMore = shouldContinue;
  }

  return {
    id: basicInfo.id,
    name: basicInfo.name,
    description: basicInfo.description,
    envVars,
    setupPrompts,
  };
}

async function createPromptConfig(): Promise<PromptConfig> {
  const promptInfo = await askUser([
    {
      type: "list",
      name: "type",
      message: "请选择输入类型:",
      choices: [
        { name: "文本输入", value: "input" },
        { name: "密码输入", value: "password" },
        { name: "确认选择", value: "confirm" },
        { name: "单选列表", value: "list" },
        { name: "多选列表", value: "checkbox" },
      ],
    },
    {
      type: "input",
      name: "name",
      message: "请输入字段名称:",
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return "字段名称不能为空";
        }
        return true;
      },
    },
    {
      type: "input",
      name: "message",
      message: "请输入提示文本:",
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return "提示文本不能为空";
        }
        return true;
      },
    },
    {
      type: "input",
      name: "default",
      message: "请输入默认值 (可选):",
    },
    {
      type: "confirm",
      name: "required",
      message: "是否必填?",
      default: true,
    },
  ]);

  const promptConfig: PromptConfig = {
    type: promptInfo.type,
    name: promptInfo.name,
    message: promptInfo.message,
    required: promptInfo.required,
  };

  if (promptInfo.default) {
    promptConfig.default = promptInfo.default;
  }

  if (promptInfo.type === "password") {
    promptConfig.mask = "*";
  }

  // 如果是选择类型，添加选项
  if (promptInfo.type === "list" || promptInfo.type === "checkbox") {
    console.log(chalk.blue("请添加选项:"));
    const choices: string[] = [];
    let addMore = true;

    while (addMore) {
      const { choice, continue: shouldContinue } = await askUser([
        {
          type: "input",
          name: "choice",
          message: "请输入选项:",
          validate: (input: string) => {
            if (!input || input.trim().length === 0) {
              return "选项不能为空";
            }
            return true;
          },
        },
        {
          type: "confirm",
          name: "continue",
          message: "是否继续添加选项?",
          default: false,
        },
      ]);

      choices.push(choice);
      addMore = shouldContinue;
    }

    promptConfig.choices = choices;
  }

  return promptConfig;
}
