import fs from "fs";
import path from "path";
import type { Provider } from "../types.js";
import { SupportedProviders } from "../types.js";

export interface ImportProviderConfig {
  name: string;
  token?: string;
  apiKey?: string;
  baseUrl?: string;
  modelName?: string;
  maxTokens?: number;
  maxOutputTokens?: number;
  temperature?: number;
  description?: string;
  type?: string;
}

export interface ImportResult {
  success: boolean;
  providers: Provider[];
  errors: string[];
  warnings: string[];
}

export class ProviderImporter {
  /**
   * 从文件导入provider配置
   */
  static async importFromFile(filePath: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      providers: [],
      errors: [],
      warnings: [],
    };

    try {
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        result.errors.push(`文件不存在: ${filePath}`);
        return result;
      }

      // 获取文件扩展名
      const ext = path.extname(filePath).toLowerCase();
      const fileContent = fs.readFileSync(filePath, "utf8");

      // 根据文件类型解析
      let configs: ImportProviderConfig[] = [];

      if (ext === ".json") {
        configs = await this.parseJsonFile(fileContent, result);
      } else if (ext === ".env" || path.basename(filePath).startsWith(".env")) {
        configs = await this.parseEnvFile(fileContent, result);
      } else {
        result.errors.push(`不支持的文件格式: ${ext}。支持的格式: .json, .env`);
        return result;
      }

      // 转换为Provider对象
      for (const config of configs) {
        try {
          const provider = this.convertToProvider(config);
          result.providers.push(provider);
        } catch (error) {
          result.errors.push(
            `转换配置失败 "${config.name}": ${error instanceof Error ? error.message : "未知错误"}`,
          );
        }
      }

      result.success = result.providers.length > 0;
      return result;
    } catch (error) {
      result.errors.push(
        `读取文件失败: ${error instanceof Error ? error.message : "未知错误"}`,
      );
      return result;
    }
  }

  /**
   * 解析JSON格式的配置文件
   */
  private static async parseJsonFile(
    content: string,
    result: ImportResult,
  ): Promise<ImportProviderConfig[]> {
    try {
      const data = JSON.parse(content);

      // 支持多种JSON格式
      if (data.providers && Array.isArray(data.providers)) {
        // 格式1: { "providers": [...] }
        return data.providers;
      } else if (Array.isArray(data)) {
        // 格式2: [...]
        return data;
      } else if (data.name || data.token || data.apiKey) {
        // 格式3: 单个配置对象
        return [data];
      } else {
        result.errors.push(
          "JSON文件格式不正确，应包含 providers 数组或直接为配置数组",
        );
        return [];
      }
    } catch (error) {
      result.errors.push(
        `JSON解析失败: ${error instanceof Error ? error.message : "格式错误"}`,
      );
      return [];
    }
  }

  /**
   * 解析.env格式的配置文件
   */
  private static async parseEnvFile(
    content: string,
    result: ImportResult,
  ): Promise<ImportProviderConfig[]> {
    const lines = content.split("\n");
    const envVars: Record<string, string> = {};

    // 解析环境变量
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const equalIndex = trimmed.indexOf("=");
        if (equalIndex > 0) {
          const key = trimmed.substring(0, equalIndex).trim();
          let value = trimmed.substring(equalIndex + 1).trim();

          // 移除引号
          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.slice(1, -1);
          }

          envVars[key] = value;
        }
      }
    }

    // 检测常见的API配置模式
    const detectedConfigs = this.detectEnvConfigs(envVars);

    if (detectedConfigs.length === 0) {
      result.warnings.push(
        "未检测到有效的API配置，请确保包含TOKEN或API_KEY相关的环境变量",
      );
    }

    return detectedConfigs;
  }

  /**
   * 从环境变量中检测API配置
   */
  private static detectEnvConfigs(
    envVars: Record<string, string>,
  ): ImportProviderConfig[] {
    const configs: ImportProviderConfig[] = [];

    // 检测Anthropic/Claude配置
    const anthropicToken =
      envVars.ANTHROPIC_API_KEY ||
      envVars.ANTHROPIC_AUTH_TOKEN ||
      envVars.CLAUDE_API_KEY;
    if (anthropicToken) {
      configs.push({
        name: "Claude API",
        token: anthropicToken,
        baseUrl: envVars.ANTHROPIC_BASE_URL || "",
        modelName: envVars.ANTHROPIC_MODEL || "",
        maxOutputTokens: envVars.CLAUDE_CODE_MAX_OUTPUT_TOKENS
          ? parseInt(envVars.CLAUDE_CODE_MAX_OUTPUT_TOKENS)
          : undefined,
        type: SupportedProviders.ANTHROPIC,
      });
    }

    // 检测OpenAI配置
    const openaiToken = envVars.OPENAI_API_KEY;
    if (openaiToken) {
      configs.push({
        name: "OpenAI API",
        token: openaiToken,
        baseUrl: envVars.OPENAI_BASE_URL || "https://api.openai.com/v1",
        modelName: envVars.OPENAI_MODEL || "gpt-3.5-turbo",
        type: SupportedProviders.ANTHROPIC, // 使用anthropic类型以保证兼容性
      });
    }

    // 检测其他自定义API配置 (通过TOKEN或API_KEY结尾的变量)
    for (const [key, value] of Object.entries(envVars)) {
      if (
        (key.endsWith("_API_KEY") || key.endsWith("_TOKEN")) &&
        !key.startsWith("ANTHROPIC") &&
        !key.startsWith("OPENAI") &&
        !key.startsWith("CLAUDE")
      ) {
        const baseName = key.replace(/_API_KEY$|_TOKEN$/, "");
        const baseUrlKey = `${baseName}_BASE_URL`;
        const modelKey = `${baseName}_MODEL`;

        configs.push({
          name: `${baseName} API`,
          token: value,
          baseUrl: envVars[baseUrlKey] || "",
          modelName: envVars[modelKey] || "",
          type: SupportedProviders.ANTHROPIC, // 使用anthropic类型以保证兼容性
        });
      }
    }

    return configs;
  }

  /**
   * 将配置转换为Provider对象
   */
  private static convertToProvider(config: ImportProviderConfig): Provider {
    // 验证必需字段
    if (!config.name) {
      throw new Error("缺少必需字段: name");
    }

    const token = config.token || config.apiKey;
    if (!token) {
      throw new Error("缺少必需字段: token 或 apiKey");
    }

    // 自动生成ID
    const generateId = (name: string): string => {
      return name
        .toLowerCase()
        .replace(/[^a-z0-9\s-_]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    };

    const provider: Provider = {
      id: generateId(config.name),
      name: config.name,
      description: config.description || `从文件导入的 ${config.name}`,
      type: config.type || SupportedProviders.ANTHROPIC, // 默认使用anthropic类型
      baseUrl: config.baseUrl || "",
      modelName: config.modelName || "",
      maxTokens: config.maxTokens || 4096,
      maxOutputTokens: config.maxOutputTokens,
      temperature: config.temperature || 0.7,
      envVars: {
        ANTHROPIC_AUTH_TOKEN: token,
        ANTHROPIC_BASE_URL: config.baseUrl || "",
        ANTHROPIC_MODEL: config.modelName || "",
        CLAUDE_CODE_MAX_OUTPUT_TOKENS: config.maxOutputTokens
          ? config.maxOutputTokens.toString()
          : "",
      },
    };

    return provider;
  }

  /**
   * 获取配置文件格式模板和使用说明
   */
  static getConfigTemplates(): {
    json: string;
    env: string;
    usage: string[];
  } {
    const jsonTemplate = {
      providers: [
        {
          name: "Claude API",
          token: "sk-xxx-your-token-here",
          baseUrl: "https://api.test.com",
          modelName: "",
          description: "",
          maxOutputTokens: "",
        },
      ],
    };

    const envTemplate = `# Claude API 配置
ANTHROPIC_API_KEY=sk-xxx-your-token-here
ANTHROPIC_BASE_URL=https://api.test.com
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
CLAUDE_CODE_MAX_OUTPUT_TOKENS=8192

# OpenAI API 配置 (可选)
OPENAI_API_KEY=sk-xxx-openai-token
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4

# 自定义API配置 (可选)
CUSTOM_API_KEY=your-custom-token
CUSTOM_BASE_URL=https://your-api.com
CUSTOM_MODEL=your-model`;

    const usage = [
      "📁 支持的文件格式:",
      "  • JSON 格式 (.json)",
      "  • 环境变量格式 (.env)",
      "",
      "🚀 使用方法:",
      "  ctl add import my-providers.json",
      "  ctl add import .env.local",
      "  ctl add import ~/configs/api-keys.json",
      "",
      "📋 配置字段说明:",
      "  • name: Provider名称 (必需)",
      "  • token/apiKey: API密钥 (必需)",
      "  • baseUrl: API地址 (必需)",
      "  • modelName: 模型名称 (可选，为空即可)",
      "  • description: 描述信息 (可选，为空即可)",
      "  • maxOutputTokens: 最大输出token数 (可选，为空即可)",
      "",
      "💡 提示:",
      "  • 字段与 ctl add 交互式添加完全一致",
      "  • 可同时导入多个Provider配置",
      "  • 会自动处理ID冲突",
      "  • 支持相对路径和绝对路径",
    ];

    return {
      json: JSON.stringify(jsonTemplate, null, 2),
      env: envTemplate,
      usage,
    };
  }
}
