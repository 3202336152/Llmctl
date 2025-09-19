import { Command } from 'commander'
import chalk from 'chalk'
import { configManager } from '../config.js'
import { providerRegistry } from '../providers/index.js'

export function createValidateCommand(): Command {
  return new Command('validate')
    .description('验证配置和 Providers')
    .option('-p, --provider <id>', '验证指定的 Provider')
    .option('--all', '验证所有 Providers')
    .option('--config', '验证配置文件')
    .option('--json', '以 JSON 格式输出结果')
    .action(async (options) => {
      try {
        let results: any = {}

        if (options.config || (!options.provider && !options.all)) {
          results.config = await validateConfig()
        }

        if (options.provider) {
          results.provider = await validateSpecificProvider(options.provider)
        } else if (options.all) {
          results.providers = await validateAllProviders()
        } else if (!options.config) {
          // 默认验证当前 Provider
          const activeProvider = configManager.getActiveProvider()
          if (activeProvider) {
            results.activeProvider = await validateSpecificProvider(activeProvider.id)
          }
        }

        if (options.json) {
          console.log(JSON.stringify(results, null, 2))
        } else {
          displayValidationResults(results)
        }

        // 如果有任何验证失败，退出代码为 1
        const hasErrors = Object.values(results).some((result: any) =>
          result && typeof result === 'object' && !result.isValid
        )

        if (hasErrors) {
          process.exit(1)
        }

      } catch (error) {
        console.error(chalk.red('❌ 验证失败:'), error instanceof Error ? error.message : '未知错误')
        process.exit(1)
      }
    })
}

async function validateConfig(): Promise<any> {
  const validation = configManager.validateConfig()
  const systemInfo = configManager.getSystemInfo()

  return {
    isValid: validation.isValid,
    errors: validation.errors,
    systemInfo,
    configPath: configManager.getConfigPath(),
    totalProviders: configManager.getAllProviders().length,
    hasActiveProvider: !!configManager.getActiveProvider(),
  }
}

async function validateSpecificProvider(providerId: string): Promise<any> {
  const provider = configManager.getProvider(providerId)

  if (!provider) {
    return {
      isValid: false,
      errors: [`Provider "${providerId}" 不存在`],
      providerId,
    }
  }

  try {
    const validation = providerRegistry.validateProvider(provider)
    const envVars = providerRegistry.getProviderEnvVars(provider)

    return {
      isValid: validation.isValid,
      errors: validation.errors,
      providerId: provider.id,
      providerName: provider.name,
      envVarsCount: Object.keys(envVars).length,
      envVars: Object.keys(envVars),
    }
  } catch (error) {
    return {
      isValid: false,
      errors: [`验证 Provider 时出错: ${error instanceof Error ? error.message : '未知错误'}`],
      providerId: provider.id,
      providerName: provider.name,
    }
  }
}

async function validateAllProviders(): Promise<any> {
  const providers = configManager.getAllProviders()
  const results: any[] = []

  for (const provider of providers) {
    const result = await validateSpecificProvider(provider.id)
    results.push(result)
  }

  const validCount = results.filter(r => r.isValid).length
  const invalidCount = results.filter(r => !r.isValid).length

  return {
    total: results.length,
    valid: validCount,
    invalid: invalidCount,
    results,
  }
}

function displayValidationResults(results: any): void {
  console.log(chalk.bold('🔍 验证结果:\n'))

  // 显示配置验证结果
  if (results.config) {
    console.log(chalk.bold('📋 配置文件验证:'))

    if (results.config.isValid) {
      console.log(chalk.green('✅ 配置文件验证通过'))
    } else {
      console.log(chalk.red('❌ 配置文件验证失败:'))
      results.config.errors.forEach((error: string) =>
        console.log(chalk.red(`  - ${error}`))
      )
    }

    console.log(chalk.gray(`   配置路径: ${results.config.configPath}`))
    console.log(chalk.gray(`   总 Providers: ${results.config.totalProviders}`))
    console.log(chalk.gray(`   活跃 Provider: ${results.config.hasActiveProvider ? '是' : '否'}`))
    console.log(chalk.gray(`   系统平台: ${results.config.systemInfo.platform}`))
    console.log()
  }

  // 显示单个 Provider 验证结果
  if (results.provider) {
    displayProviderValidation(results.provider, '指定的')
  }

  // 显示当前 Provider 验证结果
  if (results.activeProvider) {
    displayProviderValidation(results.activeProvider, '当前')
  }

  // 显示所有 Providers 验证结果
  if (results.providers) {
    console.log(chalk.bold('🔧 所有 Providers 验证:'))
    console.log(chalk.gray(`总计: ${results.providers.total}, 有效: ${chalk.green(results.providers.valid)}, 无效: ${chalk.red(results.providers.invalid)}\n`))

    results.providers.results.forEach((result: any, index: number) => {
      const icon = result.isValid ? '✅' : '❌'
      const status = result.isValid ? chalk.green('有效') : chalk.red('无效')

      console.log(`${icon} ${index + 1}. ${result.providerName} (${result.providerId}) - ${status}`)

      if (!result.isValid && result.errors.length > 0) {
        result.errors.forEach((error: string) =>
          console.log(chalk.red(`     - ${error}`))
        )
      }

      if (result.isValid && result.envVarsCount > 0) {
        console.log(chalk.gray(`     环境变量: ${result.envVarsCount} 个`))
      }
    })
  }
}

function displayProviderValidation(result: any, type: string): void {
  console.log(chalk.bold(`🎯 ${type} Provider 验证:`))

  if (result.isValid) {
    console.log(chalk.green(`✅ Provider "${result.providerName}" 验证通过`))
    if (result.envVarsCount > 0) {
      console.log(chalk.gray(`   环境变量: ${result.envVarsCount} 个`))
      console.log(chalk.gray(`   变量列表: ${result.envVars.join(', ')}`))
    }
  } else {
    console.log(chalk.red(`❌ Provider "${result.providerName}" 验证失败:`))
    result.errors.forEach((error: string) =>
      console.log(chalk.red(`  - ${error}`))
    )
  }
  console.log()
}