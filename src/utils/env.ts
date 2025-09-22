import type { ExportOptions, EnvExportResult } from "../types.js";

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
   * 自动应用环境变量到当前进程
   */
  static applyToCurrentProcess(variables: Record<string, string>): void {
    Object.entries(variables).forEach(([key, value]) => {
      process.env[key] = value;
    });
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
      // 自动应用到当前进程
      this.applyToCurrentProcess(variables);

      const format = this.detectShellFormat();
      const commands = this.generateExportCommand(variables, { format });
      const variableCount = Object.keys(variables).length;

      return {
        success: true,
        message: `已为 ${providerName} 自动设置 ${variableCount} 个环境变量到当前进程`,
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
