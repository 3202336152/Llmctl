import type { Provider, ProviderTemplate, PromptConfig } from "../types.js";
import { SupportedProviders } from "../types.js";
import { TokenRotationManager } from "../utils/token-rotation.js";

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

    // 检查是否有可用的Token
    const hasApiKey = provider.apiKey || provider.envVars?.ANTHROPIC_AUTH_TOKEN;
    const hasTokens = provider.tokens && provider.tokens.length > 0;

    if (!hasApiKey && !hasTokens) {
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

    // 获取当前应该使用的Token
    const currentToken = this.getCurrentToken(provider);
    if (currentToken) {
      envVars.ANTHROPIC_AUTH_TOKEN = currentToken;
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

  // 新增：获取当前应该使用的token
  private getCurrentToken(provider: Provider): string | null {
    // 如果有多token配置，使用当前环境变量或配置中的token，保持一致性
    if (provider.tokens && provider.tokens.length > 0) {
      // 优先使用当前环境变量中的token（如果存在且有效）
      const currentEnvToken =
        provider.envVars?.ANTHROPIC_AUTH_TOKEN || provider.apiKey;
      if (currentEnvToken) {
        // 验证这个token是否在tokens列表中且已启用
        const tokenConfig = provider.tokens.find(
          (t) => t.value === currentEnvToken,
        );
        if (tokenConfig && tokenConfig.enabled !== false) {
          return currentEnvToken;
        }
      }

      // 如果当前环境变量中的token无效，则使用轮询策略获取下一个
      return TokenRotationManager.getNextToken(provider);
    }

    // 兼容单token配置
    return provider.envVars?.ANTHROPIC_AUTH_TOKEN || provider.apiKey || null;
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
