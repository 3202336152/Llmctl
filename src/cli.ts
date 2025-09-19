import { Command } from 'commander'
import chalk from 'chalk'
import inquirer from 'inquirer'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

import { configManager } from './config.js'
import { providerRegistry } from './providers/index.js'
import {
  createListCommand,
  createAddCommand,
  createEditCommand,
  createTemplateCommand,
  createUseCommand,
  createCurrentCommand,
  createExportCommand,
  createRemoveCommand,
  createValidateCommand,
} from './commands/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 读取 package.json 获取版本号
let version = '1.0.0'
try {
  const packagePath = join(__dirname, '..', 'package.json')
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'))
  version = packageJson.version
} catch {
  // 如果读取失败，使用默认版本
}

async function checkFirstTimeSetup(): Promise<boolean> {
  const providers = configManager.getAllProviders()
  return providers.length === 0
}

async function runFirstTimeSetup(): Promise<void> {
  console.log(chalk.bold.blue('🎉 欢迎使用 llmctl!'))
  console.log(chalk.gray('这似乎是您第一次使用 llmctl，让我们来配置第一个 LLM Provider。\n'))

  const templates = providerRegistry.getProviderTemplates()

  if (templates.length === 0) {
    console.log(chalk.yellow('⚠️  没有可用的 Provider 模板'))
    console.log(chalk.blue('💡 您可以稍后使用 ') + chalk.cyan('llmctl add') + chalk.blue(' 添加 Provider'))
    return
  }

  const { shouldSetup } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'shouldSetup',
      message: '是否现在设置您的第一个 LLM Provider?',
      default: true,
    },
  ])

  if (!shouldSetup) {
    console.log(chalk.blue('💡 您可以稍后使用 ') + chalk.cyan('llmctl add') + chalk.blue(' 添加 Provider'))
    console.log(chalk.blue('   使用 ') + chalk.cyan('llmctl --help') + chalk.blue(' 查看所有可用命令'))
    return
  }

  try {
    // 选择模板
    let selectedTemplate = templates[0]

    if (templates.length > 1) {
      const { templateId } = await inquirer.prompt([
        {
          type: 'list',
          name: 'templateId',
          message: '请选择 Provider 类型:',
          choices: templates.map(template => ({
            name: `${template.name} - ${template.description || template.id}`,
            value: template.id,
          })),
        },
      ])
      selectedTemplate = templates.find(t => t.id === templateId)!
    }

    console.log(chalk.blue(`\n🔧 配置 ${selectedTemplate.name}:\n`))

    // 这里我们重用 add 命令的逻辑，但是简化流程
    // 为了简化，我们直接创建一个基础的 Provider
    const answers: Record<string, any> = {}

    // 基础信息
    const basicInfo = await inquirer.prompt([
      {
        type: 'input',
        name: 'id',
        message: '请输入 Provider ID:',
        default: selectedTemplate.id,
        validate: (input: string) => {
          if (!input || input.trim().length === 0) {
            return 'Provider ID 不能为空'
          }
          return true
        },
      },
      {
        type: 'input',
        name: 'name',
        message: '请输入显示名称:',
        default: selectedTemplate.name,
        validate: (input: string) => {
          if (!input || input.trim().length === 0) {
            return '显示名称不能为空'
          }
          return true
        },
      },
    ])

    Object.assign(answers, basicInfo)

    // 执行模板的设置提示
    for (const prompt of selectedTemplate.setupPrompts) {
      const result = await inquirer.prompt([prompt as any])
      Object.assign(answers, result)
    }

    // 构建 Provider
    const provider = {
      id: answers.id,
      name: answers.name,
      description: selectedTemplate.description,
      type: selectedTemplate.id, // 添加必需的 type 字段
      ...selectedTemplate.defaultValues,
      envVars: { ...selectedTemplate.envVars },
    }

    // 应用用户输入
    if (answers.apiKey) {
      const envVarKeys = Object.keys(selectedTemplate.envVars)
      const apiKeyVar = envVarKeys.find(key =>
        key.toLowerCase().includes('api_key') || key.toLowerCase().includes('token')
      )
      if (apiKeyVar) {
        provider.envVars[apiKeyVar] = answers.apiKey
      }
    }

    if (answers.baseUrl) provider.baseUrl = answers.baseUrl
    if (answers.modelName) provider.modelName = answers.modelName
    if (answers.maxTokens) provider.maxTokens = parseInt(answers.maxTokens)
    if (answers.temperature !== undefined) provider.temperature = parseFloat(answers.temperature)

    // 保存 Provider
    configManager.addProvider(provider)
    configManager.setActiveProvider(provider.id)

    console.log(chalk.green(`\n✅ 成功配置 Provider: ${provider.name}`))
    console.log(chalk.green(`🎯 已自动选择为当前使用的 Provider`))

    console.log(chalk.blue('\n💡 接下来您可以:'))
    console.log(chalk.cyan('   llmctl export') + chalk.blue(' - 导出环境变量到当前 shell'))
    console.log(chalk.cyan('   llmctl current') + chalk.blue(' - 查看当前 Provider 信息'))
    console.log(chalk.cyan('   llmctl --help') + chalk.blue(' - 查看所有可用命令'))

  } catch (error) {
    console.error(chalk.red('\n❌ 初始设置失败:'), error instanceof Error ? error.message : '未知错误')
    console.log(chalk.blue('💡 您可以稍后使用 ') + chalk.cyan('llmctl add') + chalk.blue(' 重新设置'))
  }
}

async function main() {
  const program = new Command()

  program
    .name('llmctl')
    .description('🤖 Claude Code 的 LLM Provider 配置管理工具')
    .version(version, '-v, --version', '显示版本号')
    .helpOption('-h, --help', '显示帮助信息')

  // 注册所有命令
  program.addCommand(createListCommand())
  program.addCommand(createAddCommand())
  program.addCommand(createEditCommand())
  program.addCommand(createTemplateCommand())
  program.addCommand(createUseCommand())
  program.addCommand(createCurrentCommand())
  program.addCommand(createExportCommand())
  program.addCommand(createRemoveCommand())
  program.addCommand(createValidateCommand())

  // 添加全局选项
  program
    .option('--no-colors', '禁用颜色输出')
    .option('--config-path', '显示配置文件路径')

  // 处理全局选项
  program.hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts()

    // 禁用颜色
    if (opts.noColors) {
      chalk.level = 0
    }

    // 显示配置路径
    if (opts.configPath) {
      console.log(configManager.getConfigPath())
      process.exit(0)
    }
  })

  // 自定义帮助信息
  program.on('--help', () => {
    console.log('')
    console.log(chalk.bold('示例:'))
    console.log('  $ llmctl add                    # 添加新的 Provider')
    console.log('  $ llmctl use anthropic          # 选择 Provider')
    console.log('  $ llmctl export                 # 导出环境变量')
    console.log('  $ llmctl export       # 在 bash 中应用环境变量')
    console.log('')
    console.log(chalk.bold('更多信息:'))
    console.log('  文档: https://github.com/yourusername/llmctl')
    console.log('  问题: https://github.com/yourusername/llmctl/issues')
  })

  // 错误处理
  program.exitOverride()

  try {
    // 检查是否需要首次设置
    if (process.argv.length === 2) {
      // 只有命令本身，没有其他参数
      const isFirstTime = await checkFirstTimeSetup()
      if (isFirstTime) {
        await runFirstTimeSetup()
        return
      }

      // 如果不是首次使用，显示当前状态
      const activeProvider = configManager.getActiveProvider()
      if (activeProvider) {
        console.log(chalk.green(`🎯 当前使用: ${activeProvider.name}`))
        console.log(chalk.blue('💡 使用 ') + chalk.cyan('llmctl --help') + chalk.blue(' 查看所有命令'))
      } else {
        console.log(chalk.yellow('😟 当前没有选择活跃的 Provider'))
        console.log(chalk.blue('💡 使用 ') + chalk.cyan('llmctl use') + chalk.blue(' 选择 Provider'))
      }
      return
    }

    await program.parseAsync(process.argv)
  } catch (error: any) {
    if (error.code === 'commander.help') {
      // 帮助信息，正常退出
      return
    }

    if (error.code === 'commander.version') {
      // 版本信息，正常退出
      return
    }

    if (error.code === 'commander.unknownOption') {
      console.error(chalk.red(`❌ 未知选项: ${error.message}`))
      console.log(chalk.blue('💡 使用 ') + chalk.cyan('llmctl --help') + chalk.blue(' 查看可用选项'))
      process.exit(1)
    }

    if (error.code === 'commander.unknownCommand') {
      console.error(chalk.red(`❌ 未知命令: ${error.message}`))
      console.log(chalk.blue('💡 使用 ') + chalk.cyan('llmctl --help') + chalk.blue(' 查看可用命令'))
      process.exit(1)
    }

    // 其他错误
    console.error(chalk.red('❌ 执行失败:'), error.message || '未知错误')
    process.exit(1)
  }
}

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error(chalk.red('❌ 未捕获的异常:'), error.message)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('❌ 未处理的 Promise 拒绝:'), reason)
  process.exit(1)
})

// 运行主程序
main().catch((error) => {
  console.error(chalk.red('❌ 程序启动失败:'), error.message || '未知错误')
  process.exit(1)
})