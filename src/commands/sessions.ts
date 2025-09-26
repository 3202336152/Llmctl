import { Command } from "commander";
import chalk from "chalk";
import { configManager } from "../config.js";
import { providerRegistry } from "../providers/index.js";
import { SessionManager } from "../utils/session-manager.js";
import type { Provider } from "../types.js";

export function createSessionsCommand(): Command {
  return new Command("sessions")
    .description("显示所有Provider及其Token状态")
    .option("-c, --clear", "清理所有会话记录")
    .action(async (options) => {
      try {
        if (options.clear) {
          SessionManager.clearAllSessions();
          return;
        }

        const allProviders = configManager.getAllProviders();

        if (allProviders.length === 0) {
          console.log(chalk.yellow("📭 当前没有配置任何Provider"));
          console.log(
            chalk.blue("💡 使用") +
              chalk.cyan(" ctl add") +
              chalk.blue(" 添加Provider"),
          );
          return;
        }

        console.log(chalk.bold.blue("📋 Provider状态与活跃会话:\n"));

        // 按Provider分组显示
        const sessionsByProvider = SessionManager.getSessionsByProvider();

        allProviders.forEach((provider) => {
          // 获取该Provider的活跃会话
          const providerSessions = sessionsByProvider.get(provider.id) || [];
          const isInCurrentEnv = isProviderInCurrentEnvironment(provider);

          let statusIcon = "⚪";
          let name = provider.name;
          let status = "";

          // 优先级：有活跃会话 > 当前环境使用
          if (providerSessions.length > 0) {
            statusIcon = "🟢";
            name = chalk.green.bold(provider.name);
            status = chalk.green(` (${providerSessions.length}个活跃会话)`);
          } else if (isInCurrentEnv) {
            statusIcon = "🔵";
            name = chalk.blue.bold(provider.name);
            status = chalk.blue(" (当前终端使用)");
          }

          console.log(`${statusIcon} ${name}${status}`);
          console.log(`   ID: ${chalk.cyan(provider.id)}`);

          // 显示活跃会话详情
          if (providerSessions.length > 0) {
            providerSessions.forEach((session, idx) => {
              const uptime = Math.floor(
                (Date.now() - session.startTime) / 1000 / 60,
              );
              const terminal =
                session.terminal && !session.terminal.startsWith("unknown")
                  ? session.terminal
                  : `PID-${session.pid}`;
              console.log(
                `   📱 会话${idx + 1}: ${terminal} (PID:${session.pid}, 运行${uptime}分钟)`,
              );
            });
          }

          // Token状态
          const tokenCount =
            provider.tokens?.length ||
            (provider.apiKey || provider.envVars?.ANTHROPIC_AUTH_TOKEN ? 1 : 0);
          if (tokenCount > 1) {
            const enabledCount =
              provider.tokens?.filter((t) => t.enabled !== false).length || 0;
            console.log(
              `   🎫 Token: ${chalk.green(`${enabledCount}/${tokenCount}可用`)} ${chalk.gray("(多Token轮询)")}`,
            );
          } else if (tokenCount === 1) {
            console.log(`   🎫 Token: ${chalk.gray("单Token配置")}`);
          } else {
            console.log(`   🎫 Token: ${chalk.red("未配置")}`);
          }

          if (provider.description) {
            console.log(`   📝 描述: ${chalk.gray(provider.description)}`);
          }
          console.log();
        });

        console.log(chalk.blue("📖 状态说明:"));
        console.log(
          chalk.gray(
            "  🟢 (X个活跃会话) - 有正在运行的ctl use进程，可切换Token",
          ),
        );
        console.log(
          chalk.gray("  🔵 (当前终端使用) - 环境变量已设置，可直接使用"),
        );
        console.log(
          chalk.gray("  ⚪ (未激活) - 需要先执行 ctl use [provider-id] 激活"),
        );
        console.log();
        console.log(chalk.blue("💡 使用提示:"));
        console.log(
          chalk.gray("  • 使用") +
            chalk.cyan(" ctl switch-token") +
            chalk.gray(" 交互式选择Provider切换Token"),
        );
        console.log(
          chalk.gray("  • 使用") +
            chalk.cyan(" ctl switch-token [provider-id]") +
            chalk.gray(" 直接切换指定Provider的Token"),
        );
        console.log(
          chalk.gray("  • 使用") +
            chalk.cyan(" ctl token") +
            chalk.gray(" 管理Provider的Token"),
        );
      } catch (error) {
        console.error(
          chalk.red("❌ 显示Provider状态失败:"),
          error instanceof Error ? error.message : "未知错误",
        );
        process.exit(1);
      }
    });
}

// 检查Provider是否在当前环境中使用
function isProviderInCurrentEnvironment(provider: Provider): boolean {
  try {
    const envVars = providerRegistry.getProviderEnvVars(provider);

    for (const [envKey, expectedValue] of Object.entries(envVars)) {
      const currentValue = process.env[envKey];

      // 如果环境变量存在且匹配，说明这个Provider在当前环境中使用
      if (currentValue && currentValue === expectedValue) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}
