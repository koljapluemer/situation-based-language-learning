import { ChatOpenAI } from "@langchain/openai";
import { LanguageCode, SituationDTO } from "@sbl/shared";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { GlossPayload } from "../../../schemas/ai-schema";
import { AI_CONFIG } from "../../../config/ai-config";
import { env } from "../../../env";
import { GlossService } from "../../gloss-service";
import { SituationService } from "../../situation-service";
import { GlossCreationHelper } from "../../ai/gloss-creation-helper";
import { createSearchExistingGlossesTool } from "./tools/search-existing-glosses.tool";
import { createGetRelatedGlossesTool } from "./tools/get-related-glosses.tool";
import { createCheckGlossExistsTool } from "./tools/check-gloss-exists.tool";
import { createAnalyzeSituationTool } from "./tools/analyze-situation.tool";
import { createAnalyzeGlossStructureTool } from "./tools/analyze-gloss-structure.tool";
import { createValidateGlossStructureTool } from "./tools/validate-gloss-structure.tool";
import { createEnsureTranslationsTool } from "./tools/ensure-translations.tool";

/**
 * Context for agentic generation
 */
export interface AgenticGenerationContext {
  situationId: string;
  targetLanguage: LanguageCode;
  nativeLanguage: LanguageCode;
  userHints?: string;
}

/**
 * Result from agentic generation
 */
export type AgenticLogType = "info" | "tool" | "error" | "result";

export interface AgenticGenerationLogEntry {
  timestamp: string;
  type: AgenticLogType;
  message: string;
  details?: unknown;
}

export interface AgenticGenerationResult {
  glosses: GlossPayload[];
  iterations: number;
  toolCalls: number;
  errors: string[];
  logs: AgenticGenerationLogEntry[];
}

interface StructureAnalysis {
  split: boolean;
  parts: Array<{ content: string }>;
}

/**
 * Simplified Agentic Generator
 *
 * Uses OpenAI's function calling with tools to generate understanding challenges.
 * The agent can query the database, check for duplicates, and build relationships
 * autonomously.
 *
 * Note: This is a simplified implementation using OpenAI's function calling.
 * A full LangGraph implementation would provide more control over the workflow
 * but adds significant complexity.
 */
export class AgenticGenerator {
  private readonly model: ChatOpenAI;
  private readonly agentRunner: ReturnType<ChatOpenAI["bindTools"]>;
  private readonly glossService: GlossService;
  private readonly situationService: SituationService;
  private readonly glossCreationHelper: GlossCreationHelper;
  private readonly tools: Map<string, StructuredToolInterface>;
  private readonly structureCache: Map<string, StructureAnalysis>;

  constructor(
    glossService?: GlossService,
    situationService?: SituationService
  ) {
    // Validate API key
    if (!env.OPENAI_API_KEY) {
      throw new Error(
        "OPENAI_API_KEY is required for agentic mode (currently only supports OpenAI)"
      );
    }

    // Initialize services
    this.glossService = glossService || new GlossService();
    this.situationService = situationService || new SituationService();
    this.glossCreationHelper = new GlossCreationHelper(this.glossService);
    this.structureCache = new Map();

    // Create tools
    const tools = [
      createSearchExistingGlossesTool(this.glossService),
      createGetRelatedGlossesTool(this.glossService),
      createCheckGlossExistsTool(this.glossService),
      createAnalyzeSituationTool(this.situationService),
      createAnalyzeGlossStructureTool(this.glossService),
      createValidateGlossStructureTool(this.glossService),
      createEnsureTranslationsTool(this.glossService, this.glossCreationHelper),
    ];
    this.tools = new Map(tools.map(tool => [tool.name, tool]));

    // Initialize model with tools
    this.model = new ChatOpenAI({
      model: AI_CONFIG.models.openai.agentic,
      temperature: 0.7,
      apiKey: env.OPENAI_API_KEY,
    });
    this.agentRunner = this.model.bindTools(tools);
  }

  /**
   * Generate understanding challenges using agentic approach
   *
   * The agent will:
   * 1. Analyze the situation context
   * 2. Search for existing glosses to avoid duplicates
   * 3. Generate new glosses with proper relationships
   * 4. Validate the generated glosses
   * 5. Return comprehensive results
   *
   * @param context - Generation context
   * @returns Generated glosses and metadata
   */
  async generateUnderstandingChallenges(
    context: AgenticGenerationContext
  ): Promise<AgenticGenerationResult> {
    const systemPrompt = this.buildSystemPrompt(context);
    const userPrompt = this.buildUserPrompt(context);

    let iterations = 0;
    let toolCalls = 0;
    const errors: string[] = [];
    const logs: AgenticGenerationLogEntry[] = [];
    let searchFailures = 0;
    let generationPhase = false;
    this.recordLog(logs, "info", "Starting agentic generation run", {
      situationId: context.situationId,
      targetLanguage: context.targetLanguage,
      nativeLanguage: context.nativeLanguage,
      hasHints: Boolean(context.userHints),
    });
    const messages: any[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    // ReAct loop: agent calls tools, processes results, decides when done
    while (iterations < AI_CONFIG.agentic.maxIterations) {
      iterations++;
      this.recordLog(logs, "info", `Iteration ${iterations} started`);

      try {
        if (!generationPhase && searchFailures >= 3) {
          generationPhase = true;
          const nudge = "You've already looked for existing glosses several times without results. Switch to generating new glosses now.";
          messages.push({ role: "system", content: nudge });
          this.recordLog(logs, "info", "Switching to generation phase after repeated empty searches");
        }

        const response = await this.agentRunner.invoke(messages);
        messages.push(response);
        const responseSummary = this.summarizeResponse(response.content);
        this.recordLog(logs, "info", `Iteration ${iterations} model response`, {
          toolCalls: response.tool_calls?.map((call) => call.name) ?? [],
          responseSummary,
        });

        // Check if agent called tools
        if (response.tool_calls && response.tool_calls.length > 0) {
          toolCalls += response.tool_calls.length;

          // Execute tool calls
          for (const toolCall of response.tool_calls) {
            const tool = this.tools.get(toolCall.name);
            if (tool) {
              this.recordLog(logs, "tool", `Calling tool ${toolCall.name}`, {
                args: toolCall.args,
              });
              try {
                const result = await tool.invoke(toolCall.args);
                messages.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  content: result,
                });
                this.recordLog(logs, "tool", `Tool ${toolCall.name} completed`, {
                  result: this.formatForLog(result),
                });
                this.captureToolSideEffects(toolCall.name, toolCall.args, result);
                if (toolCall.name === "searchExistingGlosses") {
                  const parsed = this.safeParseJSON(result);
                  const count = typeof parsed?.count === "number" ? parsed.count : 0;
                  if (count === 0) {
                    searchFailures++;
                  } else {
                    searchFailures = 0;
                  }
                }
              } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                errors.push(`Tool ${toolCall.name} failed: ${errorMsg}`);
                this.recordLog(logs, "error", `Tool ${toolCall.name} failed`, {
                  error: errorMsg,
                });
                messages.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  content: JSON.stringify({ error: errorMsg }),
                });
              }
            }
          }

          // Continue loop to let agent process tool results
          continue;
        }

        // No tool calls - agent is done, extract final answer
        const content = response.content;
        if (typeof content === "string") {
          // Try to parse JSON from the response
          const glosses = this.extractGlossesFromResponse(content);
          const validation = this.validateGlosses(glosses, context);
          if (validation.valid) {
            this.recordLog(logs, "result", "Agent returned final response", {
              glossCount: glosses.length,
            });
            return {
              glosses,
              iterations,
              toolCalls,
              errors,
              logs,
            };
          }
          messages.push({
            role: "user",
            content: validation.feedback,
          });
          this.recordLog(
            logs,
            "info",
            "Gloss validation failed, requesting fixes",
            { issues: validation.issues }
          );
          continue;
        }

        // If we got here without glosses, ask agent to provide final answer
        messages.push({
          role: "user",
          content:
            "Please provide your final answer as a JSON object with a 'glosses' array containing the generated understanding challenges.",
        });
        this.recordLog(logs, "info", "Requested agent to return final answer in JSON format");
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`Iteration ${iterations} failed: ${errorMsg}`);
        this.recordLog(logs, "error", `Iteration ${iterations} failed`, {
          error: errorMsg,
        });

        // If too many errors, abort
        if (errors.length >= AI_CONFIG.agentic.maxErrors) {
          this.recordLog(logs, "error", "Maximum error threshold reached, aborting run");
          break;
        }
      }
    }

    // Max iterations reached, try to extract any glosses from messages
    const lastMessage = messages[messages.length - 1];
    const glosses =
      typeof lastMessage.content === "string"
        ? this.extractGlossesFromResponse(lastMessage.content)
        : [];
    this.recordLog(logs, "result", "Finished after reaching iteration limit", {
      glossCount: glosses.length,
      iterations,
      toolCalls,
    });

    return {
      glosses,
      iterations,
      toolCalls,
      errors,
      logs,
    };
  }

  private buildSystemPrompt(context: AgenticGenerationContext): string {
    return `You are an expert language learning content creator with access to a database of glosses.

Your task is to generate comprehensive understanding text challenges for a language learning situation.

**Understanding Challenges**: Text/phrases in ${context.targetLanguage} that learners must UNDERSTAND when others say them (not text learners need to express).

**Guidelines**:
1. Use the analyzeSituationContext tool to understand the situation
2. Use searchExistingGlosses and checkGlossExists to avoid duplicates
3. Generate both direct vocabulary (isParaphrased: false) and descriptive glosses (isParaphrased: true)
4. Before splitting any gloss, call analyzeGlossStructure with the gloss content (and glossId when known). Reuse the provided structure or keep the gloss atomic based on the tool result.
5. When a gloss should be split, build a 'contains' tree (usually 1 level deep) and reuse existing gloss IDs for each part when possible.
6. Use getRelatedGlosses to build rich relationships beyond contains.
7. Every gloss must have at least one translation in ${context.nativeLanguage}. When generating brand new glosses, include the translation text directly in your final JSON. Only call ensureGlossTranslations when you have the real database ID of an existing gloss and need to attach missing translations—never call it with placeholder IDs.
8. Aim for comprehensive coverage: basic vocabulary, idioms, variations, related concepts. No strict limit on count—generate until the situation is well-covered (typically 10-20 glosses).

**Output Format**:
When done, return a JSON object:
{
  "glosses": [
    {
      "content": "string (the text in target language)",
      "isParaphrased": boolean,
      "translation": "string (translation in ${context.nativeLanguage})",
      "transcriptions": ["phonetic"],
      "notes": [{ "noteType": "usage", "content": "...", "showBeforeSolution": false }],
      "contains": [
        {
          "content": "sub-part",
          "isParaphrased": boolean,
          "contains": []
        }
      ]
    }
  ]
}`;
  }

  private buildUserPrompt(context: AgenticGenerationContext): string {
    const hints = context.userHints ? `\n\nUser hints: ${context.userHints}` : "";

    return `Generate comprehensive understanding text challenges for situation: ${context.situationId}

Target language: ${context.targetLanguage}
Native language: ${context.nativeLanguage}${hints}

Start by analyzing the situation context, then generate appropriate challenges.`;
  }

  private extractGlossesFromResponse(content: string): GlossPayload[] {
    try {
      // Try to find JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*"glosses"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.glosses && Array.isArray(parsed.glosses)) {
          return parsed.glosses;
        }
      }

      // Try parsing the entire content as JSON
      const parsed = JSON.parse(content);
      if (parsed.glosses && Array.isArray(parsed.glosses)) {
        return parsed.glosses;
      }

      return [];
    } catch (error) {
      // Could not extract glosses
      return [];
    }
  }

  private recordLog(
    logs: AgenticGenerationLogEntry[],
    type: AgenticLogType,
    message: string,
    details?: unknown
  ) {
    logs.push({
      timestamp: new Date().toISOString(),
      type,
      message,
      details,
    });
  }

  private summarizeResponse(content: unknown): string {
    if (!content) return "";
    if (typeof content === "string") {
      return this.truncate(content);
    }
    try {
      return this.truncate(JSON.stringify(content));
    } catch {
      return "[unserializable response]";
    }
  }

  private formatForLog(value: unknown): string {
    if (typeof value === "string") {
      return this.truncate(value);
    }
    try {
      return this.truncate(JSON.stringify(value));
    } catch {
      return "[unserializable value]";
    }
  }

  private truncate(value: string, limit = 600): string {
    if (value.length <= limit) {
      return value;
    }
    return `${value.slice(0, limit)}…`;
  }

  private safeParseJSON(value: unknown): any {
    if (typeof value !== "string") return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  private captureToolSideEffects(
    toolName: string,
    args: any,
    rawResult: string
  ) {
    if (toolName !== "analyzeGlossStructure") {
      return;
    }

    const parsed = this.safeParseJSON(rawResult);
    if (!parsed || parsed.success === false) {
      return;
    }

    const key = this.getStructureKey(args?.language, args?.content);
    if (!key) return;

    const parts = Array.isArray(parsed.parts)
      ? parsed.parts
          .filter((part: any) => typeof part?.content === "string" && part.content.trim().length > 0)
          .map((part: any) => ({ content: part.content.trim() }))
      : [];

    this.structureCache.set(key, {
      split: Boolean(parsed.split),
      parts,
    });
  }

  private getStructureKey(language: string | undefined, content: string | undefined) {
    if (!language || !content) return null;
    return `${language}:${content.trim()}`;
  }

  private validateGlosses(
    glosses: GlossPayload[],
    context: AgenticGenerationContext
  ): { valid: true } | { valid: false; feedback: string; issues: string[] } {
    const issues: string[] = [];

    for (const gloss of glosses) {
      if (!gloss.translation || gloss.translation.trim().length === 0) {
        issues.push(`Provide a translation for "${gloss.content}" in ${context.nativeLanguage}.`);
      }

      const key = this.getStructureKey(context.targetLanguage, gloss.content);
      if (!key) continue;
      const structure = this.structureCache.get(key);
      if (!structure) {
        issues.push(
          `Call analyzeGlossStructure for "${gloss.content}" and incorporate its result before finalizing.`
        );
        continue;
      }

      if (structure.split) {
        if (!gloss.contains || gloss.contains.length === 0) {
          issues.push(
            `Add contains entries for "${gloss.content}" based on analyzeGlossStructure suggestions.`
          );
        }
      }
    }

    if (issues.length === 0) {
      return { valid: true };
    }

    const feedback =
      "Some glosses failed validation:\n- " + issues.map(issue => issue.trim()).join("\n- ");
    return { valid: false, feedback, issues };
  }
}
