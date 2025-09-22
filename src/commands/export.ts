import { Command } from "commander";
import chalk from "chalk";
import { configManager } from "../config.js";
import { providerRegistry } from "../providers/index.js";
import { EnvExporter } from "../utils/env.js";
import type { ExportOptions } from "../types.js";

export function createExportCommand(): Command {
  return new Command("export")
    .description("导出当前 Provider 的环境变量")
    .option(
      "-f, --format <format>",
      "导出格式 (bash|powershell|cmd|json)",
      "auto",
    )
    .option("-p, --provider <id>", "指定 Provider ID (默认使用当前活跃的)")
    .option("--validate", "验证环境变量")
    .option("--dry-run", "只显示将要导出的环境变量，不实际导出")
    .action(async (options) => {
      try {
        let provider;

        if (options.provider) {
          provider = configManager.getProvider(options.provider);
          if (!provider) {
            console.error(
              chalk.red(`❌ Provider "${options.provider}" 不存在`),
            );
            process.exit(1);
          }
        } else {
          provider = configManager.getActiveProvider();
          if (!provider) {
            console.error(chalk.yellow("😟 当前没有选择活跃的 Provider"));
            console.log(
              chalk.blue("💡 使用 ") +
                chalk.cyan("ctl use <provider-id>") +
                chalk.blue(" 选择一个 Provider"),
            );
            console.log(
              chalk.blue("   或使用 ") +
                chalk.cyan("ctl export -p <provider-id>") +
                chalk.blue(" 指定特定的 Provider"),
            );
            process.exit(1);
          }
        }

        // 获取环境变量
        const envVars = providerRegistry.getProviderEnvVars(provider);

        if (Object.keys(envVars).length === 0) {
          console.log(chalk.yellow("⚠️  此 Provider 没有环境变量需要导出"));
          return;
        }

        // 验证环境变量
        if (options.validate) {
          const validation = EnvExporter.validateEnvironmentVariables(envVars);

          if (validation.warnings.length > 0) {
            console.log(chalk.yellow("⚠️  警告:"));
            validation.warnings.forEach((warning) =>
              console.log(chalk.yellow(`  - ${warning}`)),
            );
            console.log();
          }

          if (!validation.isValid) {
            console.error(chalk.red("❌ 环境变量验证失败:"));
            validation.errors.forEach((error) =>
              console.error(chalk.red(`  - ${error}`)),
            );
            process.exit(1);
          }

          console.log(chalk.green("✅ 环境变量验证通过"));
          if (!options.dryRun) {
            console.log();
          }
        }

        // 确定导出格式
        let format: ExportOptions["format"];
        if (options.format === "auto") {
          format = EnvExporter.detectShellFormat();
        } else {
          format = options.format as ExportOptions["format"];
          if (!["bash", "powershell", "cmd", "json"].includes(format)) {
            console.error(chalk.red(`❌ 不支持的导出格式: ${format}`));
            console.log(chalk.blue("支持的格式: bash, powershell, cmd, json"));
            process.exit(1);
          }
        }

        if (options.dryRun) {
          console.log(
            chalk.blue(
              `🔍 预览 ${provider.name} 的环境变量 (${format} 格式):\n`,
            ),
          );

          Object.entries(envVars).forEach(([key, value]) => {
            const maskedValue =
              key.toLowerCase().includes("key") ||
              key.toLowerCase().includes("token")
                ? value.replace(/./g, "*").slice(0, 8) + "..."
                : value;
            console.log(
              chalk.cyan(`${key}`) +
                chalk.gray("=") +
                chalk.yellow(maskedValue),
            );
          });

          console.log(
            chalk.gray(`\n将导出 ${Object.keys(envVars).length} 个环境变量`),
          );
          return;
        }

        // 生成导出命令
        const exportCommand = EnvExporter.generateExportCommand(envVars, {
          format,
        });

        if (format === "json") {
          console.log(exportCommand);
        } else {
          // 输出导出命令到标准输出
          console.log(exportCommand);

          // 在标准错误输出中显示使用说明（不会被管道捕获）
          if (process.stderr.isTTY) {
            console.error(chalk.gray("\n# 使用方法:"));

            switch (format) {
              case "bash":
                console.error(chalk.gray("# ctl export"));
                console.error(
                  chalk.gray("# 或: ctl export | source /dev/stdin"),
                );
                break;
              case "powershell":
                console.error(
                  chalk.gray(
                    "# ctl export --format powershell | Invoke-Expression",
                  ),
                );
                break;
              case "cmd":
                console.error(
                  chalk.gray(
                    "# ctl export --format cmd > env.bat && call env.bat",
                  ),
                );
                break;
            }

            console.error(
              chalk.gray(
                `# 导出了 ${Object.keys(envVars).length} 个环境变量来自 ${provider.name}`,
              ),
            );
          }
        }
      } catch (error) {
        console.error(
          chalk.red("❌ 导出环境变量失败:"),
          error instanceof Error ? error.message : "未知错误",
        );
        process.exit(1);
      }
    });
}
