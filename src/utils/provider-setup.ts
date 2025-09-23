import chalk from "chalk";
import { spawn } from "child_process";
import { providerRegistry } from "../providers/index.js";
import { EnvExporter } from "./env.js";
import { prompt } from "./inquirer.js";
import type { Provider } from "../types.js";

// 平台指导信息常量
const PLATFORM_INSTRUCTIONS = {
  bash: {
    title: "Bash/Zsh",
    methods: [
      {
        name: "直接执行",
        command: "llmctl export | source /dev/stdin",
      },
      {
        name: "或者先生成脚本文件",
        command: "llmctl export > llmctl-env.sh\n   source llmctl-env.sh",
      },
    ],
    note: "注意：环境变量仅在当前会话中有效，如需永久设置请将命令添加到 ~/.bashrc 或 ~/.zshrc 文件中。",
  },
  powershell: {
    title: "PowerShell",
    methods: [
      {
        name: "直接执行",
        command: "llmctl export --format powershell | Invoke-Expression",
      },
      {
        name: "或者先生成脚本文件",
        command:
          "llmctl export --format powershell > llmctl-env.ps1\n   . ./llmctl-env.ps1",
      },
    ],
    note: "注意：环境变量仅在当前会话中有效，如需永久设置请将命令添加到 $PROFILE 文件中。",
  },
  cmd: {
    title: "CMD",
    methods: [
      {
        name: "一键执行（推荐）",
        command: "llmctl export --format cmd > env.bat && call env.bat",
      },
      {
        name: "分步执行",
        command:
          "llmctl export --format cmd > llmctl-env.bat\n   call llmctl-env.bat",
      },
    ],
    note: '注意：环境变量仅在当前会话中有效，如需永久设置请通过"系统属性"->"环境变量"进行设置。',
  },
  json: {
    title: "JSON 格式",
    methods: [
      {
        name: "导出到文件",
        command: "llmctl export --format json > environment.json",
      },
      {
        name: "直接输出",
        command: "llmctl export --format json",
      },
    ],
    note: "注意：JSON 格式主要用于程序处理，可被其他工具解析和使用。",
  },
} as const;

interface ProviderSetupOptions {
  askForCliTool?: boolean;
  autoLaunchCli?: boolean;
}

/**
 * 显示即将设置的环境变量（带掩码处理）
 */
function displayEnvironmentVariables(envVars: Record<string, string>): void {
  console.log(chalk.gray("即将设置的环境变量:"));
  Object.entries(envVars).forEach(([key, value]) => {
    const maskedValue =
      key.toLowerCase().includes("key") || key.toLowerCase().includes("token")
        ? value.replace(/./g, "*").slice(0, 8) + "..."
        : value;
    console.log(chalk.gray(`  ${key}=${maskedValue}`));
  });
  console.log();
}

/**
 * 应用环境变量并处理结果
 */
async function applyEnvironmentVariables(
  envVars: Record<string, string>,
  providerName: string,
): Promise<boolean> {
  try {
    const result = await EnvExporter.autoApplyEnvironmentVariables(
      envVars,
      providerName,
    );
    if (result.success) {
      console.log(chalk.green(`✅ ${result.message}`));
      return true;
    } else {
      console.log(chalk.yellow(`⚠️  ${result.message}`));
      console.log(
        chalk.blue("💡 您可以手动执行: ") +
          chalk.cyan("llmctl export --format cmd > env.bat && call env.bat"),
      );
      return false;
    }
  } catch (error) {
    console.log(
      chalk.red("❌ 自动应用环境变量失败:"),
      error instanceof Error ? error.message : "未知错误",
    );
    console.log(
      chalk.blue("💡 您可以手动执行: ") +
        chalk.cyan("llmctl export --format cmd > env.bat && call env.bat"),
    );
    return false;
  }
}

/**
 * 显示手动设置指导
 */
async function showManualSetupInstructions(
  provider: Provider,
  envVars: Record<string, string>,
): Promise<void> {
  const format = EnvExporter.detectShellFormat();
  const commands = EnvExporter.generateExportCommand(envVars, { format });
  const variableCount = Object.keys(envVars).length;
  const platformInfo = PLATFORM_INSTRUCTIONS[format];

  console.log(
    chalk.blue(
      `\n📋 已为 ${provider.name} 生成 ${variableCount} 个环境变量的设置命令：`,
    ),
  );

  console.log(chalk.bold(`\n在 ${platformInfo.title} 中使用以下方法：\n`));

  // 生成方法列表
  platformInfo.methods.forEach((method, index) => {
    const methodCommands = method.command
      .split("\n")
      .map((cmd) => `   ${chalk.cyan(cmd)}`)
      .join("\n");
    console.log(`${index + 1}. ${chalk.yellow(method.name)}：`);
    console.log(methodCommands);
    console.log();
  });

  // 生成手动设置命令
  const manualCommands = commands
    .split("\n")
    .map((cmd) => `   ${chalk.cyan(cmd)}`)
    .join("\n");

  console.log(
    `${platformInfo.methods.length + 1}. ${chalk.yellow("手动设置")}：`,
  );
  console.log(manualCommands);
  console.log();

  console.log(chalk.gray(platformInfo.note));
}

/**
 * 启动CLI工具
 */
async function launchCliTool(provider: Provider): Promise<void> {
  // 定义可用的CLI工具
  const cliTools = [
    {
      name: "claude",
      description: "Claude CLI 工具",
      recommended: provider.type === "claude",
    },
    {
      name: "gemini",
      description: "Gemini CLI 工具",
      recommended: provider.type === "gemini",
    },
    {
      name: "qwen",
      description: "通义千问 CLI 工具",
      recommended: provider.type === "qwen",
    },
    {
      name: "chatgpt",
      description: "ChatGPT CLI 工具",
      recommended: provider.type === "openai",
    },
    {
      name: "copilot",
      description: "GitHub Copilot CLI 工具",
      recommended: false,
    },
  ];

  // 创建选择列表，推荐的工具显示在前面
  const choices = cliTools
    .sort((a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0))
    .map((tool) => {
      const name = tool.recommended
        ? `${tool.name} - ${tool.description} ${chalk.green("(推荐)")}`
        : `${tool.name} - ${tool.description}`;

      return {
        name,
        value: tool.name,
      };
    });

  // 询问用户要启动哪个CLI工具
  const { selectedCli } = await prompt([
    {
      type: "list",
      name: "selectedCli",
      message: "请选择要启动的CLI工具:",
      choices,
      pageSize: 8,
    },
  ]);

  await launchCliByName(selectedCli);
}

/**
 * 按名称启动CLI工具
 */
async function launchCliByName(cliName: string): Promise<void> {
  console.log(chalk.blue(`🚀 正在启动 ${cliName} CLI...`));

  const child = spawn(cliName, [], {
    stdio: "inherit",
    shell: true,
    env: { ...process.env },
  });

  child.on("close", (code) => {
    if (code === 0) {
      console.log(chalk.green(`✅ ${cliName} CLI 已正常退出`));
    } else {
      console.log(chalk.yellow(`⚠️  ${cliName} CLI 退出，代码: ${code}`));
    }
  });

  child.on("error", (error) => {
    console.error(chalk.red(`❌ 启动 ${cliName} CLI 失败:`), error.message);
    console.log(
      chalk.blue(`💡 请确保 ${cliName} CLI 已正确安装并在 PATH 中可用`),
    );
  });
}

/**
 * 完整的Provider设置流程
 * 包括环境变量设置和可选的CLI工具启动
 */
export async function setupProviderEnvironment(
  provider: Provider,
  options: ProviderSetupOptions = {},
): Promise<void> {
  const { askForCliTool = true, autoLaunchCli = false } = options;

  // 获取环境变量
  const envVars = providerRegistry.getProviderEnvVars(provider);

  if (Object.keys(envVars).length === 0) {
    console.log(chalk.yellow("⚠️  该 Provider 没有需要设置的环境变量"));
    return;
  }

  // 显示即将设置的环境变量
  displayEnvironmentVariables(envVars);

  // 应用环境变量
  await applyEnvironmentVariables(envVars, provider.name);

  if (!askForCliTool) {
    return;
  }

  // 直接启动CLI工具，不再询问
  console.log(); // 添加空行
  await launchCliTool(provider);
}
