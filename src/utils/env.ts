import type { ExportOptions, EnvExportResult } from "../types.js";

// 平台指导信息常量
const PLATFORM_INSTRUCTIONS = {
  bash: {
    title: "Bash/Zsh",
    methods: [
      {
        name: "直接执行",
        command: "llmctl export | source /dev/stdin"
      },
      {
        name: "或者先生成脚本文件",
        command: "llmctl export > llmctl-env.sh\n   source llmctl-env.sh"
      }
    ],
    note: "注意：环境变量仅在当前会话中有效，如需永久设置请将命令添加到 ~/.bashrc 或 ~/.zshrc 文件中。"
  },
  powershell: {
    title: "PowerShell",
    methods: [
      {
        name: "直接执行",
        command: "llmctl export --format powershell | Invoke-Expression"
      },
      {
        name: "或者先生成脚本文件",
        command: "llmctl export --format powershell > llmctl-env.ps1\n   . ./llmctl-env.ps1"
      }
    ],
    note: "注意：环境变量仅在当前会话中有效，如需永久设置请将命令添加到 $PROFILE 文件中。"
  },
  cmd: {
    title: "CMD",
    methods: [
      {
        name: "一键执行（推荐）",
        command: "llmctl export --format cmd > env.bat && call env.bat"
      },
      {
        name: "分步执行",
        command: "llmctl export --format cmd > llmctl-env.bat\n   call llmctl-env.bat"
      }
    ],
    note: "注意：环境变量仅在当前会话中有效，如需永久设置请通过\"系统属性\"->\"环境变量\"进行设置。"
  },
  json: {
    title: "JSON 格式",
    methods: [
      {
        name: "导出到文件",
        command: "llmctl export --format json > environment.json"
      },
      {
        name: "直接输出",
        command: "llmctl export --format json"
      }
    ],
    note: "注意：JSON 格式主要用于程序处理，可被其他工具解析和使用。"
  }
} as const;

export class EnvExporter {
  static generateExportCommand(
      variables: Record<string, string>,
      options: ExportOptions = { format: "bash" },
  ): string {
    if (!variables || typeof variables !== "object") {
      throw new Error("环境变量参数必须是一个对象");
    }

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
          .map((key) => `echo "  ${key}=\$${key}"`)
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
   * 生成平台特定的指导信息
   */
  private static generatePlatformInstructions(
    format: ExportOptions["format"],
    providerName: string,
    commands: string,
    variableCount: number
  ): string {
    const platformInfo = PLATFORM_INSTRUCTIONS[format];

    // 生成方法列表
    const methodsList = platformInfo.methods
      .map((method, index) => {
        const methodCommands = method.command.split('\n')
          .map(cmd => `   ${cmd}`)
          .join('\n');
        return `${index + 1}. ${method.name}：\n${methodCommands}`;
      })
      .join('\n\n');

    // 生成手动设置命令
    const manualCommands = commands.split('\n')
      .map(cmd => `   ${cmd}`)
      .join('\n');

    return `已为 ${providerName} 生成 ${variableCount} 个环境变量的设置命令：

在 ${platformInfo.title} 中使用以下方法：

${methodsList}

${platformInfo.methods.length + 1}. 手动设置：
${manualCommands}

${platformInfo.note}`;
  }

  /**
   * 生成环境变量设置指导信息
   * 根据不同的平台提供相应的环境变量设置命令
   */
  static async autoApplyEnvironmentVariables(
      variables: Record<string, string>,
      providerName: string,
  ): Promise<EnvExportResult> {
    try {
      const format = this.detectShellFormat();
      const commands = this.generateExportCommand(variables, { format });
      const variableCount = Object.keys(variables).length;

      const instructions = this.generatePlatformInstructions(
        format,
        providerName,
        commands,
        variableCount
      );

      return {
        success: true,
        message: instructions,
        variables,
        shellCommand: commands,
      };
    } catch (error) {
      return {
        success: false,
        message: `生成环境变量设置指导失败: ${error instanceof Error ? error.message : "未知错误"}`,
        variables: {},
      };
    }
  }
}
