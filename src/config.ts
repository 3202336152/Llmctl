import { homedir } from 'os'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import Conf from 'conf'
import type { Config, Provider, SystemInfo } from './types.js'
import { ConfigSchema, ProviderSchema, DEFAULT_CONFIG } from './types.js'

export class ConfigManager {
  private conf: Conf<Config>
  private configPath: string

  constructor(configName = 'llmctl') {
    this.configPath = join(homedir(), '.config', configName)

    if (!existsSync(this.configPath)) {
      mkdirSync(this.configPath, { recursive: true })
    }

    this.conf = new Conf<Config>({
      configName,
      cwd: this.configPath,
      schema: {
        providers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              baseUrl: { type: 'string' },
              apiKey: { type: 'string' },
              modelName: { type: 'string' },
              maxTokens: { type: 'number' },
              temperature: { type: 'number' },
              extraHeaders: { type: 'object' },
              envVars: { type: 'object' },
            },
            required: ['id', 'name', 'envVars'],
          },
        },
        activeProviderId: { type: 'string' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
      },
      defaults: {
        ...DEFAULT_CONFIG,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    })
  }

  getConfig(): Config {
    try {
      const config = this.conf.store as Config
      return ConfigSchema.parse(config)
    } catch (error) {
      console.warn('配置文件格式错误，使用默认配置')
      this.resetConfig()
      return this.getConfig()
    }
  }

  saveConfig(config: Partial<Config>): void {
    const currentConfig = this.getConfig()
    const updatedConfig: Config = {
      ...currentConfig,
      ...config,
      updatedAt: new Date().toISOString(),
    }

    const validatedConfig = ConfigSchema.parse(updatedConfig)
    this.conf.set(validatedConfig)
  }

  resetConfig(): void {
    this.conf.clear()
    const newConfig: Config = {
      ...DEFAULT_CONFIG,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.conf.set(newConfig)
  }

  addProvider(provider: Provider): void {
    const config = this.getConfig()

    if (config.providers.some(p => p.id === provider.id)) {
      throw new Error(`Provider ID "${provider.id}" 已存在`)
    }

    const validatedProvider = ProviderSchema.parse(provider)
    const updatedProviders = [...config.providers, validatedProvider]

    this.saveConfig({ providers: updatedProviders })
  }

  removeProvider(providerId: string): boolean {
    const config = this.getConfig()
    const initialLength = config.providers.length
    const updatedProviders = config.providers.filter(p => p.id !== providerId)

    if (updatedProviders.length === initialLength) {
      return false
    }

    const updateData: Partial<Config> = { providers: updatedProviders }

    // 如果删除的是当前活跃的 Provider，需要清除 activeProviderId
    if (config.activeProviderId === providerId) {
      // 不能设置为 undefined，而是从配置中删除这个字段
      const currentConfig = this.getConfig()
      const newConfig = {
        ...currentConfig,
        providers: updatedProviders,
        updatedAt: new Date().toISOString(),
      }
      // 删除 activeProviderId 字段
      delete (newConfig as any).activeProviderId

      // 直接设置整个配置
      this.conf.set(newConfig)
    } else {
      this.saveConfig(updateData)
    }

    return true
  }

  getProvider(providerId: string): Provider | undefined {
    const config = this.getConfig()
    return config.providers.find(p => p.id === providerId)
  }

  getAllProviders(): Provider[] {
    const config = this.getConfig()
    return config.providers
  }

  setActiveProvider(providerId: string): boolean {
    const config = this.getConfig()
    const provider = config.providers.find(p => p.id === providerId)

    if (!provider) {
      return false
    }

    this.saveConfig({ activeProviderId: providerId })
    return true
  }

  getActiveProvider(): Provider | undefined {
    const config = this.getConfig()
    if (!config.activeProviderId) {
      return undefined
    }
    return this.getProvider(config.activeProviderId)
  }

  updateProvider(providerId: string, updates: Partial<Provider>): boolean {
    const config = this.getConfig()
    const providerIndex = config.providers.findIndex(p => p.id === providerId)

    if (providerIndex === -1) {
      return false
    }

    const updatedProvider = { ...config.providers[providerIndex], ...updates }
    const validatedProvider = ProviderSchema.parse(updatedProvider)

    const updatedProviders = [...config.providers]
    updatedProviders[providerIndex] = validatedProvider

    this.saveConfig({ providers: updatedProviders })
    return true
  }

  validateConfig(): { isValid: boolean; errors: string[] } {
    try {
      const config = this.getConfig()
      ConfigSchema.parse(config)

      const errors: string[] = []

      if (config.activeProviderId && !config.providers.find(p => p.id === config.activeProviderId)) {
        errors.push(`活跃的 Provider ID "${config.activeProviderId}" 不存在`)
      }

      const providerIds = config.providers.map(p => p.id)
      const duplicateIds = providerIds.filter((id, index) => providerIds.indexOf(id) !== index)
      if (duplicateIds.length > 0) {
        errors.push(`重复的 Provider ID: ${duplicateIds.join(', ')}`)
      }

      return {
        isValid: errors.length === 0,
        errors,
      }
    } catch (error) {
      return {
        isValid: false,
        errors: error instanceof Error ? [error.message] : ['未知配置错误'],
      }
    }
  }

  exportConfig(): string {
    const config = this.getConfig()
    return JSON.stringify(config, null, 2)
  }

  importConfig(configJson: string): void {
    try {
      const parsedConfig = JSON.parse(configJson)
      const validatedConfig = ConfigSchema.parse(parsedConfig)
      this.conf.set(validatedConfig)
    } catch (error) {
      throw new Error(`导入配置失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  getConfigPath(): string {
    return this.conf.path
  }

  getSystemInfo(): SystemInfo {
    return {
      platform: process.platform,
      shell: process.env.SHELL || process.env.COMSPEC || 'unknown',
      homedir: homedir(),
      configPath: this.getConfigPath(),
    }
  }
}

export const configManager = new ConfigManager()