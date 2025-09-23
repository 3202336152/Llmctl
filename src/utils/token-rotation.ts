import type { Provider, TokenConfig } from "../types.js";

interface TokenState {
  currentIndex: number;
  weightCounters: number[]; // 用于真正的加权轮询
}

export class TokenRotationManager {
  private static providerStates = new Map<string, TokenState>();

  static getNextToken(
    provider: Provider,
    excludeToken?: string,
  ): string | null {
    if (!provider.tokens || provider.tokens.length === 0) {
      return provider.apiKey || provider.envVars?.ANTHROPIC_AUTH_TOKEN || null;
    }

    const availableTokens = provider.tokens.filter(
      (t) =>
        t.enabled !== false &&
        this.isTokenHealthy(t) &&
        (!excludeToken || t.value !== excludeToken),
    );

    if (availableTokens.length === 0) {
      console.warn(`Provider ${provider.id} 没有可用的Token`);
      return null;
    }

    const strategy = provider.tokenStrategy?.type || "round-robin";
    let selectedToken: TokenConfig;

    switch (strategy) {
      case "round-robin":
        selectedToken = this.roundRobinSelection(provider.id, availableTokens);
        break;
      case "weighted":
        selectedToken = this.weightedRoundRobinSelection(
          provider.id,
          availableTokens,
        );
        break;
      case "random":
        selectedToken = this.randomSelection(availableTokens);
        break;
      case "least-used":
        selectedToken = this.leastUsedSelection(availableTokens);
        break;
      default:
        selectedToken = availableTokens[0];
    }

    // 安全检查：确保选择的Token是有效的
    if (!selectedToken) {
      console.error(`Token选择算法返回了无效值，策略: ${strategy}`);
      return null;
    }

    this.updateTokenUsage(selectedToken, provider);
    return selectedToken.value;
  }

  // 1. 轮询算法 (Round Robin)
  private static roundRobinSelection(
    providerId: string,
    tokens: TokenConfig[],
  ): TokenConfig {
    if (tokens.length === 0) {
      throw new Error("没有可用的Token进行轮询选择");
    }

    let state = this.providerStates.get(providerId);
    if (!state) {
      state = { currentIndex: 0, weightCounters: [] };
      this.providerStates.set(providerId, state);
    }

    // 确保currentIndex不超出tokens数组范围
    if (state.currentIndex >= tokens.length) {
      state.currentIndex = 0;
    }

    const selectedToken = tokens[state.currentIndex];
    state.currentIndex = (state.currentIndex + 1) % tokens.length;

    if (!selectedToken) {
      throw new Error(`轮询选择失败：索引 ${state.currentIndex - 1} 超出范围`);
    }

    return selectedToken;
  }

  // 2. 加权轮询算法 (Weighted Round Robin) - 真正的WRR实现
  private static weightedRoundRobinSelection(
    providerId: string,
    tokens: TokenConfig[],
  ): TokenConfig {
    let state = this.providerStates.get(providerId);
    if (!state || state.weightCounters.length !== tokens.length) {
      // 初始化权重计数器
      state = {
        currentIndex: 0,
        weightCounters: tokens.map((t) => t.weight || 1),
      };
      this.providerStates.set(providerId, state);
    }

    // 找到当前权重最高的token
    let maxWeight = 0;
    let selectedIndex = 0;

    for (let i = 0; i < tokens.length; i++) {
      if (state.weightCounters[i] > maxWeight) {
        maxWeight = state.weightCounters[i];
        selectedIndex = i;
      }
    }

    // 更新权重计数器
    const totalWeight = tokens.reduce(
      (sum, token) => sum + (token.weight || 1),
      0,
    );
    state.weightCounters[selectedIndex] -= totalWeight;

    // 为所有token增加原始权重
    for (let i = 0; i < tokens.length; i++) {
      state.weightCounters[i] += tokens[i].weight || 1;
    }

    return tokens[selectedIndex];
  }

  // 3. 随机算法 (Random)
  private static randomSelection(tokens: TokenConfig[]): TokenConfig {
    const randomIndex = Math.floor(Math.random() * tokens.length);
    return tokens[randomIndex];
  }

  // 4. 最少使用算法 (Least Used)
  private static leastUsedSelection(tokens: TokenConfig[]): TokenConfig {
    return tokens.reduce((least, current) =>
      (current.lastUsed || 0) < (least.lastUsed || 0) ? current : least,
    );
  }

  private static updateTokenUsage(
    token: TokenConfig,
    provider: Provider,
  ): void {
    // 安全检查：确保token是有效对象
    if (!token || typeof token !== "object") {
      console.error("updateTokenUsage: token参数无效", token);
      return;
    }

    token.lastUsed = Date.now();

    // 异步保存到配置文件，但不等待完成以避免阻塞
    this.saveProviderConfig(provider).catch((err) => {
      console.warn("保存Token使用状态失败:", err.message);
    });
  }

  // 保存Provider配置到文件
  private static async saveProviderConfig(provider: Provider): Promise<void> {
    try {
      // 动态导入configManager以避免循环依赖
      const { configManager } = await import("../config.js");
      configManager.updateProvider(provider.id, provider);
    } catch (error) {
      console.warn("更新Provider配置失败:", error);
    }
  }

  private static isTokenHealthy(token: TokenConfig): boolean {
    // 使用用户手动设置的健康状态
    return token.healthy !== false;
  }

  // 获取Token统计信息
  static getTokenStats(provider: Provider): any {
    if (!provider.tokens) return null;

    return {
      total: provider.tokens.length,
      enabled: provider.tokens.filter((t) => t.enabled !== false).length,
      healthy: provider.tokens.filter((t) => this.isTokenHealthy(t)).length,
      strategy: provider.tokenStrategy?.type || "round-robin",
      tokens: provider.tokens.map((token) => ({
        alias: token.alias || `${token.value.slice(0, 8)}...`,
        weight: token.weight || 1,
        enabled: token.enabled !== false,
        healthy: this.isTokenHealthy(token),
      })),
    };
  }

  // 带重试机制的Token获取
  static getTokenWithRetry(
    provider: Provider,
    maxRetries: number = 3,
  ): string | null {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const token = this.getNextToken(provider);
      if (token) {
        return token;
      }

      if (attempt < maxRetries - 1) {
        console.warn(
          `尝试 ${attempt + 1}/${maxRetries}: 未找到可用Token，重试中...`,
        );
      }
    }

    console.error(`所有Token都不可用，已尝试 ${maxRetries} 次`);
    return null;
  }

  // 获取当前选择的token（用于显示）
  static getCurrentToken(provider: Provider): string | null {
    return this.getNextToken(provider);
  }

  // 检查是否有可用Token
  static hasAvailableTokens(provider: Provider): boolean {
    if (!provider.tokens || provider.tokens.length === 0) {
      return !!(provider.apiKey || provider.envVars?.ANTHROPIC_AUTH_TOKEN);
    }

    return provider.tokens.some(
      (t) => t.enabled !== false && this.isTokenHealthy(t),
    );
  }
}
