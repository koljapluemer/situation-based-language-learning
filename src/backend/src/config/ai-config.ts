/**
 * AI Service Configuration
 *
 * Centralized configuration for AI providers and agentic workflow settings.
 * Change the `provider` field to switch between OpenAI and Gemini.
 */

export const AI_CONFIG = {
  /**
   * Active AI provider: 'openai' | 'gemini'
   * Change this value to switch providers globally
   */
  provider: 'gemini' as 'openai' | 'gemini',

  /**
   * Model configurations for each provider and mode
   */
  models: {
    openai: {
      classic: 'gpt-4o-mini',  // Fast, cheap for single-shot generation
      agentic: 'gpt-4o',        // Better reasoning for agentic workflows
    },
    gemini: {
      classic: 'gemini-2.5-flash',  // Fast, cheap for single-shot generation
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

  /**
   * Classic mode settings
   */
  classic: {
    /**
     * Default temperature for generation
     * Higher = more creative, Lower = more deterministic
     */
    temperature: 0.7,

    /**
     * Maximum number of glosses that can be requested per call
     */
    maxCount: 10,
  },
} as const;
