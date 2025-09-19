import { Command } from 'commander'
import chalk from 'chalk'
import { configManager } from '../config.js'
import { providerRegistry } from '../providers/index.js'

export function createCurrentCommand(): Command {
  return new Command('current')
    .description('显示当前使用的 LLM Provider')
    .option('--json', '以 JSON 格式输出')
    .option('-v, --verbose', '显示详细信息')
    .action(async (options) => {
      try {
        const activeProvider = configManager.getActiveProvider()

        if (!activeProvider) {
          if (options.json) {
            console.log(JSON.stringify({ activeProvider: null, message: 'No active provider' }))
          } else {
            console.log(chalk.yellow('😟 当前没有选择活跃的 Provider'))
            console.log(chalk.blue('💡 使用 ') + chalk.cyan('llmctl use <provider-id>') + chalk.blue(' 选择一个 Provider'))
          }
          return
        }

        if (options.json) {
          const output = {
            activeProvider,
            envVarsCount: Object.keys(activeProvider.envVars || {}).length,
            isValid: true
          }

          try {
            const validation = providerRegistry.validateProvider(activeProvider)
            output.isValid = validation.isValid
          } catch {
            output.isValid = false
          }

          console.log(JSON.stringify(output, null, 2))
          return
        }

        console.log(chalk.bold('🎯 当前使用的 Provider:\n'))
        console.log(`${chalk.green('●')} ${chalk.bold(activeProvider.name)}`)
        console.log(`   ID: ${chalk.cyan(activeProvider.id)}`)

        if (activeProvider.description) {
          console.log(`   描述: ${chalk.gray(activeProvider.description)}`)
        }

        if (options.verbose || activeProvider.baseUrl || activeProvider.modelName) {
          console.log()

          if (activeProvider.baseUrl) {
            console.log(`   Base URL: ${chalk.blue(activeProvider.baseUrl)}`)
          }

          if (activeProvider.modelName) {
            console.log(`   模型: ${chalk.yellow(activeProvider.modelName)}`)
          }

          if (activeProvider.maxTokens) {
            console.log(`   最大 Tokens: ${chalk.magenta(activeProvider.maxTokens)}`)
          }

          if (activeProvider.temperature !== undefined) {
            console.log(`   温度: ${chalk.magenta(activeProvider.temperature)}`)
          }
        }

        // 显示环境变量信息
        const envVarCount = Object.keys(activeProvider.envVars || {}).length
        if (envVarCount > 0) {
          console.log()
          console.log(`   环境变量: ${chalk.gray(`${envVarCount} 个`)}`)

          if (options.verbose) {
            Object.keys(activeProvider.envVars).forEach(key => {
              const value = activeProvider.envVars[key]
              const maskedValue = key.toLowerCase().includes('key') || key.toLowerCase().includes('token')
                ? value ? value.replace(/./g, '*').slice(0, 8) + '...' : '(未设置)'
                : value || '(未设置)'

              console.log(`     ${chalk.cyan(key)}: ${chalk.yellow(maskedValue)}`)
            })
          }

          console.log(chalk.blue('   💡 使用 ') + chalk.cyan('llmctl export') + chalk.blue(' 导出环境变量'))
        }

        // 验证配置
        try {
          const validation = providerRegistry.validateProvider(activeProvider)
          if (!validation.isValid) {
            console.log()
            console.log(chalk.red('⚠️  配置验证失败:'))
            validation.errors.forEach(error => console.log(chalk.red(`     - ${error}`)))
          } else {
            console.log()
            console.log(chalk.green('✅ 配置验证通过'))
          }
        } catch (error) {
          console.log()
          console.log(chalk.red(`⚠️  无法验证配置: ${error instanceof Error ? error.message : '未知错误'}`))
        }

      } catch (error) {
        console.error(chalk.red('❌ 获取当前 Provider 失败:'), error instanceof Error ? error.message : '未知错误')
        process.exit(1)
      }
    })
}