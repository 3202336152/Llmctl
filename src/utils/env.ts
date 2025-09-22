import type { ExportOptions, EnvExportResult } from "../types.js";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";

export class EnvExporter {
  static generateExportCommand(
    variables: Record<string, string>,
    options: ExportOptions = { format: "bash" },
  ): string {
    const entries = Object.entries(variables);

    switch (options.format) {
      case "bash":
        return entries
          .map(([key, value]) => `export ${key}="${value}"`)
          .join("\n");

      case "powershell":
        return entries
          .map(([key, value]) => `$env:${key}="${value}"`)
          .join("\n");

      case "cmd":
        return entries.map(([key, value]) => `set ${key}=${value}`).join("\n");

      case "json":
        return JSON.stringify(variables, null, 2);

      default:
        throw new Error(`不支持的导出格式: ${options.format}`);
    }
  }

  static detectShellFormat(): ExportOptions["format"] {
    const shell = process.env.SHELL || process.env.COMSPEC || "";
    const platform = process.platform;

    if (platform === "win32") {
      if (
        shell.toLowerCase().includes("powershell") ||
        shell.toLowerCase().includes("pwsh")
      ) {
        return "powershell";
      }
      return "cmd";
    }

    return "bash";
  }

  static async exportToCurrentShell(
    variables: Record<string, string>,
  ): Promise<EnvExportResult> {
    try {
      const format = this.detectShellFormat();
      const command = this.generateExportCommand(variables, { format });

      Object.entries(variables).forEach(([key, value]) => {
        process.env[key] = value;
      });

      return {
        success: true,
        message: `已在当前进程中设置 ${Object.keys(variables).length} 个环境变量`,
        variables,
        shellCommand: command,
      };
    } catch (error) {
      return {
        success: false,
        message: `导出环境变量失败: ${error instanceof Error ? error.message : "未知错误"}`,
        variables: {},
      };
    }
  }

  static generateShellScript(
    variables: Record<string, string>,
    options: ExportOptions = { format: "bash" },
  ): string {
    const commands = this.generateExportCommand(variables, options);
    const format = options.format;

    if (format === "bash") {
      return `#!/bin/bash
# llmctl 生成的环境变量配置
# 使用方法: source llmctl-env.sh

${commands}

echo "已加载 llmctl 环境变量:"
${Object.keys(variables)
  .map((key) => `echo "  ${key}=$${key}"`)
  .join("\n")}
`;
    }

    if (format === "powershell") {
      return `# llmctl 生成的环境变量配置
# 使用方法: . .\\llmctl-env.ps1

${commands}

Write-Host "已加载 llmctl 环境变量:"
${Object.keys(variables)
  .map((key) => `Write-Host "  ${key}=$env:${key}"`)
  .join("\n")}
`;
    }

    if (format === "cmd") {
      return `@echo off
REM llmctl 生成的环境变量配置
REM 使用方法: call llmctl-env.bat

${commands}

echo 已加载 llmctl 环境变量:
${Object.keys(variables)
  .map((key) => `echo   ${key}=%${key}%`)
  .join("\n")}
`;
    }

    return commands;
  }

  static getScriptExtension(format: ExportOptions["format"]): string {
    switch (format) {
      case "bash":
        return ".sh";
      case "powershell":
        return ".ps1";
      case "cmd":
        return ".bat";
      case "json":
        return ".json";
      default:
        return ".txt";
    }
  }

  static printExportInstructions(
    variables: Record<string, string>,
    format: ExportOptions["format"],
  ): void {
    const keys = Object.keys(variables);
    console.log(`\n已生成 ${keys.length} 个环境变量的导出命令:\n`);

    switch (format) {
      case "bash":
        console.log("在 Bash/Zsh 中使用:");
        console.log("  llmctl export | source /dev/stdin");
        console.log("或者:");
        console.log("  llmctl export");
        break;

      case "powershell":
        console.log("在 PowerShell 中使用:");
        console.log("  llmctl export --format powershell | Invoke-Expression");
        break;

      case "cmd":
        console.log("在 CMD 中使用:");
        console.log("  将输出保存到 .bat 文件并执行");
        break;

      case "json":
        console.log("JSON 格式，可用于其他工具处理");
        break;
    }

    console.log(`\n环境变量列表: ${keys.join(", ")}`);
  }

  static validateEnvironmentVariables(variables: Record<string, string>): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    Object.entries(variables).forEach(([key, value]) => {
      if (!key) {
        errors.push("环境变量名不能为空");
      }

      if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
        warnings.push(
          `环境变量名 "${key}" 不符合常见命名规范 (建议使用大写字母和下划线)`,
        );
      }

      if (!value) {
        warnings.push(`环境变量 "${key}" 的值为空`);
      }

      if (value.includes("\n") || value.includes("\r")) {
        errors.push(`环境变量 "${key}" 的值包含换行符`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 自动执行环境变量设置
   * 生成临时脚本文件并执行，适用于 Windows cmd 环境
   */
  static async autoApplyEnvironmentVariables(
    variables: Record<string, string>,
    _providerName: string,
  ): Promise<EnvExportResult> {
    try {
      const format = this.detectShellFormat();
      const tempDir = process.env.TEMP || process.env.TMP || ".";
      const timestamp = Date.now();

      if (format === "cmd") {
        // Windows CMD - 生成批处理文件并执行
        const batFile = join(tempDir, `llmctl-env-${timestamp}.bat`);
        const commands = this.generateExportCommand(variables, {
          format: "cmd",
        });

        // 生成批处理文件内容（只包含 set 命令，不包含中文）
        const batContent = `@echo off
REM llmctl auto-generated environment variables
${commands}
`;

        writeFileSync(batFile, batContent, "ascii");

        return new Promise((resolve) => {
          const child = spawn("cmd", ["/c", `call "${batFile}"`], {
            stdio: "pipe", // 改为 pipe 模式，避免输出乱码
            shell: true,
            env: { ...process.env, ...variables },
          });

          child.on("close", (code) => {
            try {
              unlinkSync(batFile); // 清理临时文件
            } catch {
              // 忽略清理错误
            }

            if (code === 0) {
              // 更新当前进程的环境变量
              Object.entries(variables).forEach(([key, value]) => {
                process.env[key] = value;
              });

              resolve({
                success: true,
                message: `已自动设置 ${Object.keys(variables).length} 个环境变量`,
                variables,
              });
            } else {
              resolve({
                success: false,
                message: `环境变量设置失败，退出代码: ${code}`,
                variables: {},
              });
            }
          });

          child.on("error", (error) => {
            resolve({
              success: false,
              message: `执行批处理文件失败: ${error.message}`,
              variables: {},
            });
          });
        });
      } else {
        // 对于其他平台，只在当前进程中设置
        Object.entries(variables).forEach(([key, value]) => {
          process.env[key] = value;
        });

        return {
          success: true,
          message: `已在当前进程中设置 ${Object.keys(variables).length} 个环境变量`,
          variables,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `自动设置环境变量失败: ${error instanceof Error ? error.message : "未知错误"}`,
        variables: {},
      };
    }
  }
}
