import { z } from 'zod'

export const ProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: z.string(), // 添加类型字段，表示基于哪个模板
  baseUrl: z.string().url().optional(),
  apiKey: z.string().optional(),
  modelName: z.string().optional(),
  maxTokens: z.number().min(1).optional(),
  temperature: z.number().min(0).max(2).optional(),
  extraHeaders: z.record(z.string()).optional(),
  envVars: z.record(z.string()),
})

export const ConfigSchema = z.object({
  providers: z.array(ProviderSchema),
  activeProviderId: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Provider = z.infer<typeof ProviderSchema>
export type Config = z.infer<typeof ConfigSchema>

export interface ProviderTemplate {
  id: string
  name: string
  description: string
  envVars: Record<string, string>
  defaultValues?: Partial<Provider>
  setupPrompts: PromptConfig[]
}

export interface PromptConfig {
  type: 'input' | 'password' | 'confirm' | 'list' | 'checkbox'
  name: string
  message: string
  choices?: string[] | { name: string; value: string }[]
  default?: string | boolean
  required?: boolean
  mask?: string
  validate?(input: string): boolean | string | Promise<boolean | string>
}

export interface CliCommand {
  name: string
  description: string
  alias?: string
  action: (options: Record<string, unknown>) => Promise<void>
}

export interface EnvExportResult {
  success: boolean
  message: string
  variables: Record<string, string>
  shellCommand?: string
}

export interface ProviderValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface ExportOptions {
  format: 'bash' | 'powershell' | 'cmd' | 'json'
  persistent?: boolean
  global?: boolean
}

export const SupportedProviders = {
  ANTHROPIC: 'anthropic',
  OPENAI: 'openai',
  CUSTOM: 'custom',
} as const

export type SupportedProvider = (typeof SupportedProviders)[keyof typeof SupportedProviders]

export interface SystemInfo {
  platform: NodeJS.Platform
  shell: string
  homedir: string
  configPath: string
}

export const DEFAULT_CONFIG: Omit<Config, 'createdAt' | 'updatedAt'> = {
  providers: [],
  activeProviderId: undefined,
}

export const CLI_COMMANDS = {
  LIST: 'list',
  ADD: 'add',
  REMOVE: 'remove',
  USE: 'use',
  CURRENT: 'current',
  EXPORT: 'export',
  VALIDATE: 'validate',
  RESET: 'reset',
} as const

export type CliCommandName = (typeof CLI_COMMANDS)[keyof typeof CLI_COMMANDS]

export interface ErrorContext {
  command?: string
  providerId?: string
  configPath?: string
  originalError?: Error
}