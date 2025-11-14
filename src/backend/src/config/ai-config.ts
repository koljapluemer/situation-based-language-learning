/**
 * AI Service Configuration
 *
 * Centralized configuration for AI providers and agentic workflow settings.
 * Change the `provider` field to switch between OpenAI and Gemini.
 */

export type AIProvider = "openai" | "gemini";

export const AI_CONFIG = {
  /**
   * Active AI provider: 'openai' | 'gemini'
   * Change this value to switch providers globally
   */
  provider: 'gemini' as AIProvider,

  /**
   * Model configurations for each provider
   */
  models: {
    openai: {
      agentic: 'gpt-4o',        // Better reasoning for agentic workflows
    },
    gemini: {
      agentic: 'gemini-2.5-pro',     // Better reasoning for agentic workflows
    },
  },

  /**
   * Agentic workflow settings
   */
  agentic: {
    /**
     * Maximum number of agent iterations before terminating
     * Each iteration can include multiple LLM calls (agent + tools)
     */
    maxIterations: 5,

    /**
     * Target number of glosses to generate
     * Agent will stop when this count is reached
     */
    targetGlossCount: 15,

    /**
     * LangGraph recursion limit
     * Maximum number of graph steps before forcing termination
     */
    recursionLimit: 50,

    /**
     * Maximum number of errors before aborting
     * Prevents infinite loops with failing tool calls
     */
    maxErrors: 10,
  },
} as const;
