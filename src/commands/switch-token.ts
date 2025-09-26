import { Command } from "commander";
import chalk from "chalk";
import { exec } from "child_process";
import { spawn } from "child_process";
import { readlinkSync, existsSync, statSync } from "fs";
import { dirname } from "path";
import { configManager } from "../config.js";
import { TokenRotationManager } from "../utils/token-rotation.js";
import { EnvExporter } from "../utils/env.js";
import { providerRegistry } from "../providers/index.js";
import {
  SessionManager,
  type ActiveSession,
} from "../utils/session-manager.js";
import { prompt } from "../utils/inquirer.js";
import type { Provider } from "../types.js";

// 全局类型定义
declare const setTimeout: typeof globalThis.setTimeout;

export function createSwitchTokenCommand(): Command {
  return new Command("switch-token")
    .description("快速切换到下一个可用Token（用于Token额度用完时紧急切换）")
    .argument(
      "[provider-id]",
      "Provider ID (如果不提供则交互式选择有活跃会话的Provider)",
    )
    .option("-l, --list", "显示切换后的Token信息")
    .action(async (providerId, options) => {
      try {
        // 获取要操作的Provider
        let targetProvider: Provider | undefined;

        if (providerId) {
          targetProvider = configManager.getProvider(providerId);
          if (!targetProvider) {
            console.error(chalk.red(`❌ Provider "${providerId}" 不存在`));
            process.exit(1);
          }
        } else {
          // 交互式选择有活跃会话的Provider
          targetProvider = await selectProviderInteractively();
          if (!targetProvider) {
            console.log(chalk.yellow("🚫 未选择任何Provider"));
            process.exit(0);
          }
        }

        const provider = targetProvider;
        console.log(chalk.blue(`🔄 正在为 "${provider.name}" 切换Token...`));

        // 检查是否有可切换的Token
        if (!TokenRotationManager.hasAvailableTokens(provider)) {
          console.error(chalk.red("❌ 没有可用的Token进行切换"));
          console.log(
            chalk.blue("💡 使用") +
              chalk.cyan(" ctl token add") +
              chalk.blue(" 添加更多Token"),
          );
          process.exit(1);
        }

        // 获取当前使用的Token
        const currentToken = getCurrentTokenValue(provider);

        if (!currentToken) {
          console.error(chalk.red("❌ 无法确定当前使用的Token"));
          process.exit(1);
        }

        // 显示当前Token信息
        const currentTokenInfo = getTokenInfo(provider, currentToken);
        console.log(
          chalk.cyan(
            `📍 当前Token: ${currentTokenInfo.alias} (${currentToken.slice(0, 8)}...)`,
          ),
        );

        // 询问用户是否要禁用当前Token
        const { shouldDisableCurrent } = await prompt([
          {
            type: "confirm",
            name: "shouldDisableCurrent",
            message: "是否要禁用当前Token？(通常在Token用完或有问题时选择禁用)",
            default: false,
          },
        ]);

        // 如果用户选择禁用，则禁用当前Token
        if (shouldDisableCurrent) {
          const disableResult = TokenRotationManager.disableToken(
            provider,
            currentToken,
          );
          if (disableResult) {
            // 保存Provider配置
            configManager.updateProvider(provider.id, provider);
            console.log(
              chalk.yellow(`⚠️  已禁用Token: ${currentTokenInfo.alias}`),
            );
          } else {
            console.log(
              chalk.red(`❌ 禁用Token失败: ${currentTokenInfo.alias}`),
            );
          }
        }

        // 获取下一个可用Token（排除当前Token）
        const nextToken = TokenRotationManager.getNextToken(
          provider,
          currentToken,
        );

        if (!nextToken) {
          console.error(chalk.red("❌ 没有其他可用Token进行切换"));
          console.log(chalk.yellow("💡 当前Token可能是唯一可用的Token"));
          process.exit(1);
        }

        if (nextToken === currentToken) {
          console.log(chalk.yellow("⚠️ 只有一个可用Token，无需切换"));
          process.exit(0);
        }

        // 更新环境变量
        const result = await updateEnvironmentVariable(provider, nextToken);

        if (result.success) {
          // 获取切换后的Token信息用于显示
          const nextTokenInfo = getTokenInfo(provider, nextToken);

          console.log(chalk.green("✅ Token切换成功"));
          console.log(
            chalk.blue(
              `📍 当前Token: ${nextTokenInfo.alias} (${nextToken.slice(0, 8)}...)`,
            ),
          );

          // 检查是否有活跃会话
          const activeSessions = SessionManager.getActiveSessions().filter(
            (s) => s.providerId === provider.id,
          );

          if (activeSessions.length > 0) {
            console.log(
              chalk.blue(
                `🔍 检测到 ${activeSessions.length} 个活跃的 ${provider.name} CLI会话`,
              ),
            );
            console.log(
              chalk.yellow(
                "⚠️  由于CLI工具会缓存Token，需要重启才能使用新Token",
              ),
            );

            let sessionsToRestart: typeof activeSessions = [];

            // 如果只有一个会话，直接重启
            if (activeSessions.length === 1) {
              sessionsToRestart = activeSessions;
            } else {
              // 多个会话时让用户选择
              console.log(chalk.cyan("\n📋 请选择要重启的会话:"));

              const sessionChoices: Array<{
                name: string;
                value: ActiveSession | string;
              }> = activeSessions.map((session, index) => {
                const uptime = Math.floor(
                  (Date.now() - session.startTime) / 1000 / 60,
                ); // 分钟
                const workDir = session.workingDirectory || "未知目录";
                return {
                  name: `会话${index + 1}: PID ${session.pid} | 目录: ${workDir} | 运行: ${uptime}分钟`,
                  value: session,
                };
              });

              sessionChoices.push({
                name: "🔄 重启所有会话",
                value: "all",
              });

              sessionChoices.push({
                name: "❌ 取消操作",
                value: "cancel",
              });

              const { selectedSessions } = await prompt([
                {
                  type: "list",
                  name: "selectedSessions",
                  message: "选择要重启的会话:",
                  choices: sessionChoices,
                },
              ]);

              if (selectedSessions === "cancel") {
                console.log(chalk.yellow("已取消操作"));
                return;
              } else if (selectedSessions === "all") {
                sessionsToRestart = activeSessions;
              } else {
                sessionsToRestart = [selectedSessions];
              }
            }

            // 直接开始自动重启
            await handleAutomaticRestart(provider, sessionsToRestart);
          } else {
            console.log(
              chalk.gray("💡 当前没有活跃会话，新Token将在下次启动CLI时生效"),
            );
          }

          if (options.list) {
            showTokenSwitchInfo(provider, currentToken, nextToken);
          }

          console.log(chalk.gray("💡 Token切换已完成，新Token现已生效"));
        } else {
          console.error(chalk.red("❌ Token切换失败"));
          console.log(chalk.yellow(`原因: ${result.message}`));

          if (result.shellCommand) {
            console.log(
              chalk.blue("💡 您可以手动执行: ") +
                chalk.cyan(result.shellCommand),
            );
          }
          process.exit(1);
        }
      } catch (error) {
        console.error(
          chalk.red("❌ Token切换过程中发生错误:"),
          error instanceof Error ? error.message : "未知错误",
        );
        process.exit(1);
      }
    });
}

// 处理自动重启
async function handleAutomaticRestart(
  provider: Provider,
  sessions: ActiveSession[],
): Promise<void> {
  console.log(chalk.blue("🔄 开始自动重启CLI进程..."));

  for (const session of sessions) {
    try {
      if (SessionManager.isProcessAlive(session.pid)) {
        console.log(
          chalk.gray(`正在处理会话 ${session.pid} (${session.terminal})...`),
        );

        // 优先使用会话中保存的工作目录，否则尝试检测
        let finalWorkingDir = session.workingDirectory;

        if (!finalWorkingDir) {
          console.log(chalk.yellow(`⚠️  会话中没有保存工作目录信息`));

          // 尝试通过进程检测获取工作目录
          const detectedDir = await getCliProcessWorkingDirectory(session.pid);
          finalWorkingDir = detectedDir ?? undefined;

          if (!finalWorkingDir) {
            console.log(
              chalk.yellow(`⚠️  无法自动检测会话 ${session.pid} 的工作目录`),
            );

            const { directoryChoice } = await prompt([
              {
                type: "list",
                name: "directoryChoice",
                message: "请选择启动新CLI的目录:",
                choices: [
                  {
                    name: `使用当前目录: ${process.cwd()}`,
                    value: "current",
                  },
                  {
                    name: "手动输入目录路径",
                    value: "manual",
                  },
                  {
                    name: "取消重启这个会话",
                    value: "skip",
                  },
                ],
              },
            ]);

            if (directoryChoice === "skip") {
              console.log(chalk.yellow(`⏭️  跳过会话 ${session.pid} 的重启`));
              continue;
            } else if (directoryChoice === "manual") {
              const { manualDir } = await prompt([
                {
                  type: "input",
                  name: "manualDir",
                  message: "请输入目录路径:",
                  default: process.cwd(),
                  validate: (input: string) => {
                    try {
                      if (existsSync(input) && statSync(input).isDirectory()) {
                        return true;
                      }
                      return "目录不存在，请输入有效的目录路径";
                    } catch {
                      return "无效的目录路径";
                    }
                  },
                },
              ]);
              finalWorkingDir = manualDir;
            } else {
              finalWorkingDir = process.cwd();
            }
          }
        }

        console.log(chalk.gray(`使用工作目录: ${finalWorkingDir}`));

        // 友好终止进程
        await gracefulTerminateProcess(session.pid);

        // 在新窗口中启动CLI，保持工作目录
        await launchNewCliWindow(provider.id, finalWorkingDir);

        console.log(chalk.green(`✅ 会话已重启，请查看新打开的CLI窗口`));
        console.log(
          chalk.blue(`💡 可以手动关闭原始窗口，新Token已在新窗口中生效`),
        );
      }
    } catch (error) {
      console.log(chalk.yellow(`⚠️  处理会话 ${session.pid} 时出错: ${error}`));
    }
  }

  console.log(chalk.green("🎉 Token切换完成！"));
  console.log(chalk.blue("💡 新Token已在新窗口中生效，可以手动关闭原始窗口"));
}

// 获取Claude CLI进程的实际工作目录
async function getCliProcessWorkingDirectory(
  pid: number,
): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      if (process.platform === "win32") {
        // Windows: 使用wmic获取进程的工作目录 (更准确的方法)
        const wmicCommand = `wmic process where ProcessId=${pid} get CommandLine,ExecutablePath /format:csv`;
        exec(wmicCommand, (error: Error | null, stdout: string) => {
          if (error || !stdout.trim()) {
            // fallback方法1：尝试使用PowerShell Handle库方法
            exec(
              `powershell -Command "try { (Get-CimInstance -ClassName Win32_Process -Filter \\"ProcessId = ${pid}\\").CommandLine } catch { \\"NotFound\\" }"`,
              (psError: Error | null, psStdout: string) => {
                if (
                  psError ||
                  !psStdout.trim() ||
                  psStdout.includes("NotFound")
                ) {
                  console.log(
                    chalk.yellow(
                      `⚠️  无法获取进程${pid}的工作目录，这可能是由于权限限制`,
                    ),
                  );
                  resolve(null);
                } else {
                  // 从命令行中提取可能的工作目录
                  const cmdLine = psStdout.trim();
                  // 尝试从命令行参数中推断工作目录
                  const workingDirMatch = cmdLine.match(
                    /--?(?:cwd|dir|path)[=\s]+"?([^"]+)"?/i,
                  );
                  if (workingDirMatch) {
                    resolve(workingDirMatch[1]);
                  } else {
                    resolve(null);
                  }
                }
              },
            );
          } else {
            // 解析wmic输出
            const lines = stdout
              .split("\n")
              .filter((line) => line.includes(","));
            if (lines.length > 1) {
              const dataLine = lines[1];
              const columns = dataLine.split(",");
              if (columns.length >= 2) {
                const commandLine = columns[0] || "";
                const executablePath = columns[1] || "";

                // 尝试从命令行推断工作目录
                if (
                  commandLine.includes("claude") ||
                  commandLine.includes("ctl use")
                ) {
                  // 从可执行文件路径推断（通常Claude CLI在执行时会保持在调用目录）
                  const execDir = executablePath
                    ? dirname(executablePath)
                    : null;
                  if (
                    execDir &&
                    !execDir.includes("nodejs") &&
                    !execDir.includes("Program Files")
                  ) {
                    resolve(execDir);
                  } else {
                    resolve(null);
                  }
                } else {
                  resolve(null);
                }
              } else {
                resolve(null);
              }
            } else {
              resolve(null);
            }
          }
        });
      } else {
        // Unix/Linux/macOS: 读取 /proc/PID/cwd 符号链接
        try {
          const cwd = readlinkSync(`/proc/${pid}/cwd`);
          resolve(cwd);
        } catch {
          // fallback: 尝试通过lsof或pwdx命令获取
          exec(
            `lsof -p ${pid} | grep cwd`,
            (lsofError: Error | null, lsofStdout: string) => {
              if (lsofError || !lsofStdout.trim()) {
                exec(
                  `pwdx ${pid}`,
                  (pwdxError: Error | null, pwdxStdout: string) => {
                    if (pwdxError || !pwdxStdout.trim()) {
                      resolve(null);
                    } else {
                      // pwdx输出格式: "PID: /path/to/directory"
                      const match = pwdxStdout.match(/^\d+:\s*(.+)$/);
                      resolve(match ? match[1].trim() : null);
                    }
                  },
                );
              } else {
                // lsof输出中提取工作目录
                const lines = lsofStdout.split("\n");
                for (const line of lines) {
                  if (line.includes("cwd")) {
                    const parts = line.trim().split(/\s+/);
                    const dir = parts[parts.length - 1];
                    if (dir && dir !== "/") {
                      resolve(dir);
                      return;
                    }
                  }
                }
                resolve(null);
              }
            },
          );
        }
      }
    } catch {
      resolve(null); // 无法获取时返回null
    }
  });
}

// 友好地终止进程
async function gracefulTerminateProcess(pid: number): Promise<void> {
  return new Promise((resolve) => {
    try {
      console.log(chalk.gray(`正在终止进程 ${pid}...`));

      if (process.platform === "win32") {
        // Windows: 直接终止进程，不尝试关闭窗口
        exec(`taskkill /PID ${pid} /F`, (error) => {
          if (error) {
            console.log(chalk.yellow(`⚠️  进程 ${pid} 可能已经结束`));
          } else {
            console.log(chalk.gray(`✅ 已终止进程 ${pid}`));
          }
          resolve();
        });
      } else {
        // Unix: 终止进程
        try {
          process.kill(pid, "SIGTERM");
          setTimeout(() => {
            try {
              process.kill(pid, "SIGKILL");
              console.log(chalk.gray(`✅ 已终止进程 ${pid}`));
            } catch {
              // 进程已经结束
              console.log(chalk.gray(`✅ 进程 ${pid} 已结束`));
            }
            resolve();
          }, 2000);
        } catch {
          console.log(chalk.yellow(`⚠️  进程 ${pid} 可能已经结束`));
          resolve();
        }
      }
    } catch {
      resolve();
    }
  });
}

// 在新窗口启动CLI
async function launchNewCliWindow(
  providerId: string,
  workingDir?: string | null,
): Promise<void> {
  try {
    const cwd = workingDir || process.cwd();
    console.log(chalk.blue(`🚀 在新窗口启动CLI，工作目录: ${cwd}`));

    if (process.platform === "win32") {
      // Windows: 在新的cmd窗口中启动，自动执行ctl use
      const command = `cd /d "${cwd}" && echo 🚀 正在启动${providerId} CLI... && echo 新Token已切换完成，请选择要启动的CLI： && ctl use ${providerId} --cli`;

      // 使用start命令打开新窗口，并在其中执行命令
      spawn(
        "cmd",
        ["/c", `start "Claude CLI - ${providerId}" cmd /k "${command}"`],
        {
          detached: true,
          stdio: "ignore",
          shell: true,
        },
      );
      console.log(chalk.gray(`将在新窗口执行: ${command}`));

      // 等待一下让窗口完全启动
      setTimeout(() => {
        console.log(
          chalk.green(
            `✅ 新窗口已启动，请查看标题为 "Claude CLI - ${providerId}" 的窗口`,
          ),
        );
      }, 1000);
    } else {
      // Unix: 尝试多种终端
      const terminals = [
        {
          command: "gnome-terminal",
          args: ["--working-directory", cwd, "--", "bash", "-c"],
        },
        {
          command: "xterm",
          args: ["-e", "bash", "-c"],
        },
        {
          command: "Terminal", // macOS
          args: ["-e", "bash", "-c"],
        },
      ];

      let launched = false;
      for (const terminal of terminals) {
        try {
          const shellCommand = `cd "${cwd}" && echo "🚀 正在启动${providerId} CLI..." && echo "新Token已切换完成，请选择要启动的CLI：" && ctl use ${providerId} --cli; exec bash`;

          let args: string[];
          if (terminal.command === "gnome-terminal") {
            args = [...terminal.args, shellCommand];
          } else {
            args = [...terminal.args, shellCommand];
          }

          spawn(terminal.command, args, {
            detached: true,
            stdio: "ignore",
          });
          console.log(
            chalk.gray(`将在${terminal.command}中执行: ${shellCommand}`),
          );
          launched = true;
          break;
        } catch {
          // 尝试下一个终端
        }
      }

      if (!launched) {
        console.log(chalk.yellow("⚠️  无法自动打开新终端，请手动操作:"));
        console.log(chalk.cyan(`  cd "${cwd}"`));
        console.log(chalk.cyan(`  ctl use ${providerId}`));
      }
    }
  } catch (error) {
    console.log(
      chalk.yellow(
        `⚠️  启动新窗口失败: ${error}，请手动执行: ctl use ${providerId}`,
      ),
    );
  }
}

// 交互式选择Provider
async function selectProviderInteractively(): Promise<Provider | undefined> {
  // 获取所有活跃会话
  const activeSessions = SessionManager.getActiveSessions();

  if (activeSessions.length === 0) {
    console.log(chalk.yellow("📭 当前没有活跃的CLI会话"));
    console.log(
      chalk.blue("💡 先使用") +
        chalk.cyan(" ctl use") +
        chalk.blue(" 启动CLI，然后再切换Token"),
    );
    return undefined;
  }

  // 获取有活跃会话的Provider
  const sessionsByProvider = new Map<string, typeof activeSessions>();
  activeSessions.forEach((session) => {
    if (!sessionsByProvider.has(session.providerId)) {
      sessionsByProvider.set(session.providerId, []);
    }
    sessionsByProvider.get(session.providerId)!.push(session);
  });

  const providersWithSessions: Provider[] = [];
  for (const [providerId] of sessionsByProvider) {
    const provider = configManager.getProvider(providerId);
    if (provider) {
      providersWithSessions.push(provider);
    }
  }

  if (providersWithSessions.length === 0) {
    console.log(chalk.yellow("📭 没有找到活跃会话对应的Provider"));
    return undefined;
  }

  const choices = providersWithSessions.map((provider) => {
    // 检查是否有多个token
    const tokenCount =
      provider.tokens?.length ||
      (provider.apiKey || provider.envVars?.ANTHROPIC_AUTH_TOKEN ? 1 : 0);
    const tokenInfo =
      tokenCount > 1
        ? chalk.green(`(${tokenCount}个Token)`)
        : chalk.gray("(单Token)");

    // 获取这个Provider的活跃会话数量
    const sessions = sessionsByProvider.get(provider.id) || [];
    const sessionInfo = chalk.blue(`- ${sessions.length}个活跃会话`);

    return {
      name: `${chalk.cyan(provider.name)} ${tokenInfo} ${sessionInfo}`,
      value: provider.id,
      short: provider.name,
    };
  });

  // 添加取消选项
  choices.push({
    name: chalk.red("取消"),
    value: "__cancel__",
    short: "取消",
  });

  const { selectedProviderId } = await prompt([
    {
      type: "list",
      name: "selectedProviderId",
      message: "选择要切换Token的Provider:",
      choices,
      pageSize: Math.min(choices.length, 10),
      loop: true,
    },
  ]);

  if (selectedProviderId === "__cancel__") {
    return undefined;
  }

  return configManager.getProvider(selectedProviderId);
}

// 获取当前环境变量中的Token值
function getCurrentTokenValue(provider: Provider): string | null {
  return provider.envVars?.ANTHROPIC_AUTH_TOKEN || provider.apiKey || null;
}

// 获取Token信息（别名等）
function getTokenInfo(
  provider: Provider,
  tokenValue: string,
): { alias: string; weight: number } {
  if (provider.tokens && provider.tokens.length > 0) {
    const tokenConfig = provider.tokens.find((t) => t.value === tokenValue);
    if (tokenConfig) {
      return {
        alias: tokenConfig.alias || "Token",
        weight: tokenConfig.weight || 1,
      };
    }
  }

  return { alias: "单Token配置", weight: 1 };
}

// 更新环境变量
async function updateEnvironmentVariable(
  provider: Provider,
  tokenValue: string,
): Promise<{ success: boolean; message?: string; shellCommand?: string }> {
  try {
    // 更新provider配置中的token
    if (provider.envVars?.ANTHROPIC_AUTH_TOKEN) {
      provider.envVars.ANTHROPIC_AUTH_TOKEN = tokenValue;
    } else if (provider.apiKey) {
      provider.apiKey = tokenValue;
    }

    // 保存配置
    configManager.updateProvider(provider.id, provider);

    // 获取环境变量
    const envVars = providerRegistry.getProviderEnvVars(provider);

    // 导出环境变量
    const result = await EnvExporter.autoApplyEnvironmentVariables(
      envVars,
      provider.name,
    );

    return {
      success: result.success,
      message: result.message,
      shellCommand: result.shellCommand,
    };
  } catch (error) {
    return {
      success: false,
      message: `更新环境变量时发生错误: ${error}`,
    };
  }
}

// 显示Token切换详细信息
function showTokenSwitchInfo(
  provider: Provider,
  fromToken: string,
  toToken: string,
): void {
  console.log(chalk.bold.blue("\n📋 Token切换详情"));

  const fromTokenInfo = getTokenInfo(provider, fromToken);
  const toTokenInfo = getTokenInfo(provider, toToken);

  console.log(
    chalk.gray("切换前:"),
    `${fromTokenInfo.alias} (${fromToken.slice(0, 8)}...)`,
  );
  console.log(
    chalk.gray("切换后:"),
    chalk.green(`${toTokenInfo.alias} (${toToken.slice(0, 8)}...)`),
  );

  // 显示轮询策略信息
  if (provider.tokens && provider.tokens.length > 1) {
    const strategy = provider.tokenStrategy?.type || "round-robin";
    const strategyNames = {
      "round-robin": "轮询",
      weighted: "加权轮询",
      random: "随机选择",
      "least-used": "最少使用",
    };
    const strategyName =
      strategyNames[strategy as keyof typeof strategyNames] || strategy;
    console.log(chalk.gray("轮询策略:"), strategyName);
  }

  console.log();
}
