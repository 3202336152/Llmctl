// 主要 API 导出
export { ConfigManager, configManager } from "./config.js";
export {
  BaseProvider,
  AnthropicProvider,
  ProviderRegistry,
  providerRegistry,
} from "./providers/index.js";
export { EnvExporter } from "./utils/env.js";
export { TokenRotationManager } from "./utils/token-rotation.js";

// 类型导出
export type {
  Provider,
  Config,
  ProviderTemplate,
  PromptConfig,
  CliCommand,
  EnvExportResult,
  ProviderValidationResult,
  ExportOptions,
  SupportedProvider,
  SystemInfo,
  ErrorContext,
  CliCommandName,
  TokenConfig,
  TokenStrategy,
} from "./types.js";

// 常量导出
export {
  SupportedProviders,
  DEFAULT_CONFIG,
  CLI_COMMANDS,
  ProviderSchema,
  ConfigSchema,
} from "./types.js";

// 版本信息
export const VERSION = "1.0.0";
