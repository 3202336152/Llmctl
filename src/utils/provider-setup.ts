import chalk from "chalk";
import { spawn } from "child_process";
import { providerRegistry } from "../providers/index.js";
import { EnvExporter } from "./env.js";
import { prompt } from "./inquirer.js";
import type { Provider } from "../types.js";

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
  const { askForCliTool = true } = options;

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
