import { writeFileSync, readFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import chalk from "chalk";
import type { Provider } from "../types.js";

// 全局类型定义
declare const setTimeout: typeof globalThis.setTimeout;

export interface ActiveSession {
  pid: number;
  providerId: string;
  providerName: string;
  startTime: number;
  lastActivity: number;
  terminal?: string;
  command?: string; // 'claude', 'gemini' 等
  persistent?: boolean; // 是否持久化（即使进程结束也保留）
  workingDirectory?: string; // 工作目录，用于重启时恢复
}

interface SessionRegistry {
  sessions: ActiveSession[];
  lastUpdated: number;
}

export class SessionManager {
  private static sessionFile = join(tmpdir(), "llmctl-sessions.json");

  // 注册一个新的使用会话（当执行ctl use时调用）
  static registerProviderUsage(provider: Provider): void {
    try {
      const session: ActiveSession = {
        pid: process.pid,
        providerId: provider.id,
        providerName: provider.name,
        startTime: Date.now(),
        lastActivity: Date.now(),
        terminal: this.getTerminalInfo(),
        command: "ctl-use",
        persistent: false, // 非持久化，进程结束时自动清除
        workingDirectory: process.cwd(), // 保存当前工作目录
      };

      const registry = this.loadRegistry();

      // 移除已经结束的进程
      registry.sessions = registry.sessions.filter((s) =>
        this.isProcessAlive(s.pid),
      );

      // 移除同一进程的旧会话（同一进程可能多次执行ctl use）
      registry.sessions = registry.sessions.filter(
        (s) => s.pid !== process.pid,
      );

      // 添加新会话
      registry.sessions.push(session);
      registry.lastUpdated = Date.now();

      this.saveRegistry(registry);

      console.log(chalk.gray(`📝 已注册Provider使用会话: ${provider.name}`));

      // 设置进程退出时清理
      process.on("exit", () => this.unregisterSession(process.pid));
      process.on("SIGINT", () => {
        this.unregisterSession(process.pid);
        process.exit(0);
      });
    } catch {
      // 静默失败，不影响主流程
    }
  }

  // 获取终端信息
  private static getTerminalInfo(): string {
    // 尝试获取更详细的终端信息
    const term = process.env.TERM || "unknown";
    const termProgram = process.env.TERM_PROGRAM || "";
    const sessionName = process.env.SESSION_NAME || process.env.TMUX_PANE || "";

    // 使用进程PID确保唯一性，避免同一进程被识别为多个终端
    const pid = process.pid;

    if (termProgram) return `${termProgram}-${pid}`;
    if (sessionName) return `${term}-${sessionName}-${pid}`;
    return `${term}-${pid}`;
  }

  // 注册CLI启动会话（当启动claude等CLI时调用）
  static registerSession(provider: Provider, command: string = "claude"): void {
    try {
      const session: ActiveSession = {
        pid: process.pid,
        providerId: provider.id,
        providerName: provider.name,
        startTime: Date.now(),
        lastActivity: Date.now(),
        terminal: this.getTerminalInfo(),
        command,
      };

      const registry = this.loadRegistry();

      // 移除已经结束的进程
      registry.sessions = registry.sessions.filter((s) =>
        this.isProcessAlive(s.pid),
      );

      // 添加新会话
      registry.sessions.push(session);
      registry.lastUpdated = Date.now();

      this.saveRegistry(registry);

      // 设置进程退出时清理
      process.on("exit", () => this.unregisterSession(process.pid));
      process.on("SIGINT", () => {
        this.unregisterSession(process.pid);
        process.exit(0);
      });
    } catch (error) {
      console.warn("注册会话失败:", error);
    }
  }

  // 更新会话活动时间
  static updateSessionActivity(pid: number = process.pid): void {
    try {
      const registry = this.loadRegistry();
      const session = registry.sessions.find((s) => s.pid === pid);
      if (session) {
        session.lastActivity = Date.now();
        this.saveRegistry(registry);
      }
    } catch {
      // 静默失败，不影响主流程
    }
  }

  // 注销会话
  static unregisterSession(pid: number): void {
    try {
      const registry = this.loadRegistry();
      registry.sessions = registry.sessions.filter((s) => s.pid !== pid);
      registry.lastUpdated = Date.now();
      this.saveRegistry(registry);
    } catch {
      // 静默失败
    }
  }

  // 获取所有活跃会话
  static getActiveSessions(): ActiveSession[] {
    try {
      const registry = this.loadRegistry();

      // 只保留进程仍在运行的会话
      const activeSessions = registry.sessions.filter((session) =>
        this.isProcessAlive(session.pid),
      );

      // 更新注册表（清理已结束的进程）
      if (activeSessions.length !== registry.sessions.length) {
        registry.sessions = activeSessions;
        registry.lastUpdated = Date.now();
        this.saveRegistry(registry);
      }

      return activeSessions;
    } catch {
      return [];
    }
  }

  // 按Provider分组获取会话
  static getSessionsByProvider(): Map<string, ActiveSession[]> {
    const sessions = this.getActiveSessions();
    const grouped = new Map<string, ActiveSession[]>();

    for (const session of sessions) {
      if (!grouped.has(session.providerId)) {
        grouped.set(session.providerId, []);
      }
      grouped.get(session.providerId)!.push(session);
    }

    return grouped;
  }

  // 检查进程是否还活着
  static isProcessAlive(pid: number): boolean {
    try {
      // 发送0信号来检查进程是否存在，不会实际发送信号
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  // 扫描并注册当前运行的CLI进程
  static scanAndRegisterRunningCLIs(): void {
    try {
      // 这个方法需要使用系统命令来扫描进程
      // 由于跨平台兼容性问题，我们采用更简单的方式
      console.log(chalk.gray("扫描运行中的CLI进程..."));

      // 注意：这个功能需要额外的进程扫描能力
      // 当前实现为占位符
    } catch {
      // 静默失败
    }
  }

  // 加载会话注册表
  private static loadRegistry(): SessionRegistry {
    try {
      if (!existsSync(this.sessionFile)) {
        return { sessions: [], lastUpdated: Date.now() };
      }

      const data = readFileSync(this.sessionFile, "utf-8");
      return JSON.parse(data);
    } catch {
      return { sessions: [], lastUpdated: Date.now() };
    }
  }

  // 保存会话注册表
  private static saveRegistry(registry: SessionRegistry): void {
    try {
      writeFileSync(this.sessionFile, JSON.stringify(registry, null, 2));
    } catch {
      // 静默失败，不影响主流程
    }
  }

  // 显示活跃会话
  static displayActiveSessions(): void {
    const sessionsByProvider = this.getSessionsByProvider();

    if (sessionsByProvider.size === 0) {
      console.log(chalk.yellow("📭 当前没有活跃的CLI会话"));
      return;
    }

    console.log(chalk.bold.blue("📊 活跃的CLI会话:\n"));

    for (const [providerId, sessions] of sessionsByProvider) {
      console.log(
        chalk.cyan(`🔹 ${sessions[0].providerName} (${providerId}):`),
      );

      sessions.forEach((session, index) => {
        const uptime = Math.floor((Date.now() - session.startTime) / 1000 / 60); // 分钟
        const lastActive = Math.floor(
          (Date.now() - session.lastActivity) / 1000 / 60,
        ); // 分钟前

        console.log(
          `   ${index + 1}. PID: ${session.pid} | 运行: ${uptime}分钟 | 最后活动: ${lastActive}分钟前`,
        );
        if (session.command) {
          console.log(`      命令: ${session.command}`);
        }
      });
      console.log();
    }
  }

  // 清理所有会话记录
  static clearAllSessions(): void {
    try {
      if (existsSync(this.sessionFile)) {
        unlinkSync(this.sessionFile);
      }
      console.log(chalk.green("✅ 已清理所有会话记录"));
    } catch (error) {
      console.error(chalk.red("❌ 清理会话记录失败:"), error);
    }
  }

  // 手动结束指定Provider的会话
  static endProviderSession(providerId: string, terminal?: string): boolean {
    try {
      const registry = this.loadRegistry();
      const originalLength = registry.sessions.length;

      // 如果指定了终端，只删除该终端的会话；否则删除该Provider的所有会话
      registry.sessions = registry.sessions.filter((session) => {
        if (session.providerId !== providerId) return true;
        if (terminal && session.terminal !== terminal) return true;
        return false;
      });

      const removed = originalLength - registry.sessions.length;
      if (removed > 0) {
        registry.lastUpdated = Date.now();
        this.saveRegistry(registry);
        console.log(chalk.green(`✅ 已结束 ${removed} 个会话`));
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  // 通知指定Provider的活跃会话重新加载环境变量
  static notifyTokenSwitch(
    providerId: string,
    newToken: string,
  ): {
    success: boolean;
    notifiedSessions: number;
    message: string;
  } {
    try {
      const sessions = this.getActiveSessions().filter(
        (s) => s.providerId === providerId,
      );

      if (sessions.length === 0) {
        return {
          success: false,
          notifiedSessions: 0,
          message: `没有找到 ${providerId} 的活跃会话`,
        };
      }

      let notifiedCount = 0;
      const signalFile = join(
        tmpdir(),
        `llmctl-token-update-${providerId}.json`,
      );

      // 创建信号文件，包含新的token信息
      const updateSignal = {
        providerId,
        newToken: newToken.slice(0, 8) + "...", // 只保存前8位用于确认
        timestamp: Date.now(),
        fullTokenHash: this.hashToken(newToken), // 使用hash确保安全
      };

      writeFileSync(signalFile, JSON.stringify(updateSignal, null, 2));

      // 向所有活跃的会话进程发送SIGUSR2信号（如果支持的话）
      for (const session of sessions) {
        try {
          // 检查进程是否仍然存活
          if (this.isProcessAlive(session.pid)) {
            // 在Windows上无法发送信号，所以我们依赖文件监控
            // 在Unix系统上，可以发送信号通知进程
            if (process.platform !== "win32") {
              try {
                process.kill(session.pid, "SIGUSR2");
              } catch {
                // 如果信号发送失败，继续依赖文件监控
              }
            }
            notifiedCount++;
          }
        } catch {
          // 跳过无法通知的进程
        }
      }

      // 设置自动清理信号文件（30秒后）
      setTimeout(() => {
        try {
          if (existsSync(signalFile)) {
            unlinkSync(signalFile);
          }
        } catch {
          // 静默清理失败
        }
      }, 30000);

      return {
        success: true,
        notifiedSessions: notifiedCount,
        message: `已通知 ${notifiedCount} 个活跃会话重新加载Token`,
      };
    } catch (error) {
      return {
        success: false,
        notifiedSessions: 0,
        message: `通知会话时发生错误: ${error}`,
      };
    }
  }

  // 检查是否有Token更新信号
  static checkTokenUpdateSignal(providerId: string): {
    hasUpdate: boolean;
    newTokenHash?: string;
    timestamp?: number;
  } {
    try {
      const signalFile = join(
        tmpdir(),
        `llmctl-token-update-${providerId}.json`,
      );

      if (!existsSync(signalFile)) {
        return { hasUpdate: false };
      }

      const signalData = JSON.parse(readFileSync(signalFile, "utf-8"));

      // 检查信号是否是给当前Provider的
      if (signalData.providerId === providerId) {
        return {
          hasUpdate: true,
          newTokenHash: signalData.fullTokenHash,
          timestamp: signalData.timestamp,
        };
      }

      return { hasUpdate: false };
    } catch {
      return { hasUpdate: false };
    }
  }

  // 清理Token更新信号
  static clearTokenUpdateSignal(providerId: string): void {
    try {
      const signalFile = join(
        tmpdir(),
        `llmctl-token-update-${providerId}.json`,
      );
      if (existsSync(signalFile)) {
        unlinkSync(signalFile);
      }
    } catch {
      // 静默清理失败
    }
  }

  // 简单的token哈希函数（用于安全比较）
  private static hashToken(token: string): string {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      const char = token.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }
}
