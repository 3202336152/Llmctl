import type { Provider, ProviderTemplate, PromptConfig } from "../types.js";
import { SupportedProviders } from "../types.js";

export abstract class BaseProvider {
  abstract getTemplate(): ProviderTemplate;
  abstract validateConfig(provider: Provider): {
    isValid: boolean;
    errors: string[];
  };
  abstract getEnvVars(provider: Provider): Record<string, string>;

  protected createPrompt(config: Partial<PromptConfig>): PromptConfig {
    return {
      type: "input",
      required: true,
      ...config,
    } as PromptConfig;
  }
}

export class AnthropicProvider extends BaseProvider {
  getTemplate(): ProviderTemplate {
    return {
      id: SupportedProviders.ANTHROPIC,
      name: "LLM API 配置名称",
      description: "配置大语言模型 API描述 (支持 Claude、GLM、Qwen 等)",
      envVars: {
        ANTHROPIC_AUTH_TOKEN: "",
        ANTHROPIC_BASE_URL: "https://api.lycheeshare.com",
        ANTHROPIC_MODEL: "",
      },
      defaultValues: {
        baseUrl: "https://api.lycheeshare.com",
        modelName: "",
        maxTokens: 4096,
        temperature: 0.7,
      },
      setupPrompts: [
        this.createPrompt({
          name: "baseUrl",
          message: "请输入 API URL:",
          required: false,
          validate: (input: string) => {
            if (input && !input.startsWith("http")) {
              return "API URL 必须以 http:// 或 https:// 开头";
            }
            return true;
          },
        }),
        this.createPrompt({
          name: "apiKey",
          type: "password",
          message: "请输入 API Token:",
          mask: "*",
          required: true,
          validate: (input: string) => {
            if (!input || input.length < 10) {
              return "API Token 不能为空且长度至少为 10 个字符";
            }
            return true;
          },
        }),
        this.createPrompt({
          name: "modelName",
          message: "请输入模型名称 (ANTHROPIC_MODEL，仅中转时需要):",
          default: "",
          required: false,
          validate: (_input: string) => {
            // 允许空值，因为不是必需的
            return true;
          },
        }),
      ],
    };
  }

  validateConfig(provider: Provider): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!provider.envVars?.ANTHROPIC_AUTH_TOKEN) {
      errors.push("缺少 API Token");
    }

    if (provider.baseUrl && !provider.baseUrl.startsWith("http")) {
      errors.push("API URL 必须以 http:// 或 https:// 开头");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  getEnvVars(provider: Provider): Record<string, string> {
    const envVars: Record<string, string> = {};

    if (provider.envVars?.ANTHROPIC_AUTH_TOKEN) {
      envVars.ANTHROPIC_AUTH_TOKEN = provider.envVars.ANTHROPIC_AUTH_TOKEN;
    }

    if (provider.baseUrl) {
      envVars.ANTHROPIC_BASE_URL = provider.baseUrl;
    }

    // 只有当模型名称不为空时才导出 ANTHROPIC_MODEL
    if (provider.modelName && provider.modelName.trim() !== "") {
      envVars.ANTHROPIC_MODEL = provider.modelName;
    }

    return envVars;
  }
}

export class ProviderRegistry {
  private providers: Map<string, BaseProvider> = new Map();

  constructor() {
    this.registerProvider(new AnthropicProvider());
  }

  registerProvider(provider: BaseProvider): void {
    const template = provider.getTemplate();
    this.providers.set(template.id, provider);
  }

  getProvider(id: string): BaseProvider | undefined {
    return this.providers.get(id);
  }

  getAllProviders(): BaseProvider[] {
    return Array.from(this.providers.values());
  }

  getProviderTemplates(): ProviderTemplate[] {
    return this.getAllProviders().map((p) => p.getTemplate());
  }

  validateProvider(provider: Provider): { isValid: boolean; errors: string[] } {
    const providerInstance = this.getProvider(provider.type);
    if (!providerInstance) {
      return {
        isValid: false,
        errors: [`不支持的 Provider 类型: ${provider.type}`],
      };
    }

    return providerInstance.validateConfig(provider);
  }

  getProviderEnvVars(provider: Provider): Record<string, string> {
    const providerInstance = this.getProvider(provider.type);
    if (!providerInstance) {
      throw new Error(`不支持的 Provider 类型: ${provider.type}`);
    }

    return providerInstance.getEnvVars(provider);
  }
}

export const providerRegistry = new ProviderRegistry();
