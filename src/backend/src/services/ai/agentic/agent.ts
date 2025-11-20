import { ChatOpenAI } from "@langchain/openai";
import { GoogleGenerativeAI, SchemaType, type ObjectSchema } from "@google/generative-ai";
import { randomUUID } from "node:crypto";
import { LanguageCode, SituationDTO } from "@sbl/shared";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { GlossPayload } from "../../../schemas/ai-schema.js";
import { AIProvider, AI_CONFIG } from "../../../config/ai-config.js";
import { env } from "../../../env.js";
import { GlossService } from "../../gloss-service.js";
import { SituationService } from "../../situation-service.js";
import { GlossCreationHelper } from "../../ai/gloss-creation-helper.js";
import { emitRunCompletion, emitRunLog } from "../run-log-stream.js";
import { createSearchExistingGlossesTool } from "./tools/search-existing-glosses.tool.js";
import { createGetRelatedGlossesTool } from "./tools/get-related-glosses.tool.js";
import { createCheckGlossExistsTool } from "./tools/check-gloss-exists.tool.js";
import { createAnalyzeSituationTool } from "./tools/analyze-situation.tool.js";
import { createAnalyzeGlossStructureTool } from "./tools/analyze-gloss-structure.tool.js";
import { createValidateGlossStructureTool } from "./tools/validate-gloss-structure.tool.js";
import { createEnsureTranslationsTool } from "./tools/ensure-translations.tool.js";

/**
 * Context for agentic generation
 */
export interface AgenticGenerationContext {
  situationId: string;
  targetLanguage: LanguageCode;
  nativeLanguage: LanguageCode;
  userHints?: string;
  provider?: AIProvider;
  runId?: string;
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
  runId: string;
}

interface StructureAnalysis {
  split: boolean;
  parts: Array<{ content: string }>;
}

function buildStructuredNoteSchema(): ObjectSchema & { additionalProperties?: boolean } {
  const noteSchema: ObjectSchema & { additionalProperties?: boolean } = {
    type: SchemaType.OBJECT,
    properties: {
      noteType: { type: SchemaType.STRING },
      content: { type: SchemaType.STRING },
      showBeforeSolution: { type: SchemaType.BOOLEAN },
    },
    required: ["noteType", "content", "showBeforeSolution"],
  };
  noteSchema.additionalProperties = false;
  return noteSchema;
}

function buildStructuredGlossSchema(depth = 2): ObjectSchema {
  const schema: ObjectSchema & { additionalProperties?: boolean } = {
    type: SchemaType.OBJECT,
    properties: {
      id: { type: SchemaType.STRING },
      content: { type: SchemaType.STRING },
      isParaphrased: { type: SchemaType.BOOLEAN },
      translation: { type: SchemaType.STRING },
      transcriptions: {
        type: SchemaType.ARRAY,
        items: { type: SchemaType.STRING },
      },
      notes: {
        type: SchemaType.ARRAY,
        items: buildStructuredNoteSchema(),
      },
    },
    required: ["content", "isParaphrased", "translation", "transcriptions", "notes"],
  };
  schema.additionalProperties = false;

  const leaf: ObjectSchema & { additionalProperties?: boolean } = {
    type: SchemaType.OBJECT,
    properties: {},
    required: [],
  };
  leaf.additionalProperties = false;

  schema.properties.contains = depth > 0
    ? {
        type: SchemaType.ARRAY,
        items: buildStructuredGlossSchema(depth - 1),
      }
    : {
        type: SchemaType.ARRAY,
        items: leaf,
      };

  schema.required = [...(schema.required ?? []), "contains"];
  return schema;
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
  private readonly glossService: GlossService;
  private readonly situationService: SituationService;
  private readonly glossCreationHelper: GlossCreationHelper;
  private readonly toolList: StructuredToolInterface[];
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
    this.toolList = tools;
    this.tools = new Map(tools.map(tool => [tool.name, tool]));

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
    const provider = context.provider ?? AI_CONFIG.provider;
    const runId = context.runId ?? randomUUID();
    context.runId = runId;
    const agentRunner = this.createAgentRunner(provider);

    const systemPrompt = this.buildSystemPrompt(context);
    const userPrompt = this.buildUserPrompt(context);

    let iterations = 0;
    let toolCalls = 0;
    const errors: string[] = [];
    const logs: AgenticGenerationLogEntry[] = [];
    let searchFailures = 0;
    let generationPhase = false;
    this.recordLog(runId, logs, "info", "Starting agentic generation run", {
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
    try {
      while (iterations < AI_CONFIG.agentic.maxIterations) {
        iterations++;
        this.recordLog(runId, logs, "info", `Iteration ${iterations} started`);

        try {
          if (!generationPhase && searchFailures >= 3) {
            generationPhase = true;
            const nudge = "You've already looked for existing glosses several times without results. Switch to generating new glosses now.";
            messages.push({ role: "system", content: nudge });
            this.recordLog(
              runId,
              logs,
              "info",
              "Switching to generation phase after repeated empty searches"
            );
          }

          const response = await agentRunner.invoke(messages);
          messages.push(response);
          const responseSummary = this.summarizeResponse(response.content);
          this.recordLog(runId, logs, "info", `Iteration ${iterations} model response`, {
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
                this.recordLog(runId, logs, "tool", `Calling tool ${toolCall.name}`, {
                  args: toolCall.args,
                });
                try {
                  const result = await tool.invoke(toolCall.args);
                  messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    name: toolCall.name,
                    content: result,
                  });
                  this.recordLog(runId, logs, "tool", `Tool ${toolCall.name} completed`, {
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
                  this.recordLog(runId, logs, "error", `Tool ${toolCall.name} failed`, {
                    error: errorMsg,
                  });
                  messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    name: toolCall.name,
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
          let glosses = this.extractGlossesFromResponse(content);
          glosses = await this.ensureStructuredOutput(glosses, provider);
          glosses = this.normalizeGlosses(glosses);
          const validation = this.validateGlosses(glosses, context);
            if (validation.valid) {
              this.recordLog(runId, logs, "result", "Agent returned final response", {
                glossCount: glosses.length,
              });
              return {
                glosses,
                iterations,
                toolCalls,
                errors,
                logs,
                runId,
              };
            }
            messages.push({
              role: "user",
              content: validation.feedback,
            });
            this.recordLog(
              runId,
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
          this.recordLog(runId, logs, "info", "Requested agent to return final answer in JSON format");
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Iteration ${iterations} failed: ${errorMsg}`);
          this.recordLog(runId, logs, "error", `Iteration ${iterations} failed`, {
            error: errorMsg,
          });

          // If too many errors, abort
          if (errors.length >= AI_CONFIG.agentic.maxErrors) {
            this.recordLog(runId, logs, "error", "Maximum error threshold reached, aborting run");
            break;
          }
        }
      }
      // Max iterations reached, try to extract any glosses from messages
      const lastMessage = messages[messages.length - 1];
      let glosses =
        typeof lastMessage.content === "string"
          ? this.extractGlossesFromResponse(lastMessage.content)
          : [];
      glosses = await this.ensureStructuredOutput(glosses, provider);
      glosses = this.normalizeGlosses(glosses);
      this.recordLog(runId, logs, "result", "Finished after reaching iteration limit", {
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
        runId,
      };
    } finally {
      emitRunCompletion(runId);
    }
  }

  /**
   * Generate expression challenges using agentic approach
   *
   * The agent will:
   * 1. Analyze the situation context
   * 2. Search for existing glosses to avoid duplicates
   * 3. Generate high-level native language glosses (communicative functions)
   * 4. Provide target language translations
   * 5. Create recursive contains structures for both glosses AND translations
   *
   * @param context - Generation context
   * @returns Generated glosses and metadata
   */
  async generateExpressionChallenges(
    context: AgenticGenerationContext
  ): Promise<AgenticGenerationResult> {
    const provider = context.provider ?? AI_CONFIG.provider;
    const runId = context.runId ?? randomUUID();
    context.runId = runId;
    const agentRunner = this.createAgentRunner(provider);

    const systemPrompt = this.buildExpressionSystemPrompt(context);
    const userPrompt = this.buildExpressionUserPrompt(context);

    let iterations = 0;
    let toolCalls = 0;
    const errors: string[] = [];
    const logs: AgenticGenerationLogEntry[] = [];
    let searchFailures = 0;
    let generationPhase = false;
    this.recordLog(runId, logs, "info", "Starting agentic expression generation run", {
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
    try {
      while (iterations < AI_CONFIG.agentic.maxIterations) {
        iterations++;
        this.recordLog(runId, logs, "info", `Iteration ${iterations} started`);

        try {
          if (!generationPhase && searchFailures >= 3) {
            generationPhase = true;
            const nudge = "You've already looked for existing glosses several times without results. Switch to generating new glosses now.";
            messages.push({ role: "system", content: nudge });
            this.recordLog(
              runId,
              logs,
              "info",
              "Switching to generation phase after repeated empty searches"
            );
          }

          const response = await agentRunner.invoke(messages);
          messages.push(response);
          const responseSummary = this.summarizeResponse(response.content);
          this.recordLog(runId, logs, "info", `Iteration ${iterations} model response`, {
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
                this.recordLog(runId, logs, "tool", `Calling tool ${toolCall.name}`, {
                  args: toolCall.args,
                });
                try {
                  const result = await tool.invoke(toolCall.args);
                  messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    name: toolCall.name,
                    content: result,
                  });
                  this.recordLog(runId, logs, "tool", `Tool ${toolCall.name} completed`, {
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
                  this.recordLog(runId, logs, "error", `Tool ${toolCall.name} failed`, {
                    error: errorMsg,
                  });
                  messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    name: toolCall.name,
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
          let glosses = this.extractGlossesFromResponse(content);
          glosses = await this.ensureStructuredOutput(glosses, provider);
          glosses = this.normalizeGlosses(glosses);
          const validation = this.validateExpressionGlosses(glosses, context);
            if (validation.valid) {
              this.recordLog(runId, logs, "result", "Agent returned final response", {
                glossCount: glosses.length,
              });
              return {
                glosses,
                iterations,
                toolCalls,
                errors,
                logs,
                runId,
              };
            }
            messages.push({
              role: "user",
              content: validation.feedback,
            });
            this.recordLog(
              runId,
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
              "Please provide your final answer as a JSON object with a 'glosses' array containing the generated expression challenges.",
          });
          this.recordLog(runId, logs, "info", "Requested agent to return final answer in JSON format");
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Iteration ${iterations} failed: ${errorMsg}`);
          this.recordLog(runId, logs, "error", `Iteration ${iterations} failed`, {
            error: errorMsg,
          });

          // If too many errors, abort
          if (errors.length >= AI_CONFIG.agentic.maxErrors) {
            this.recordLog(runId, logs, "error", "Maximum error threshold reached, aborting run");
            break;
          }
        }
      }
      // Max iterations reached, try to extract any glosses from messages
      const lastMessage = messages[messages.length - 1];
      let glosses =
        typeof lastMessage.content === "string"
          ? this.extractGlossesFromResponse(lastMessage.content)
          : [];
      glosses = await this.ensureStructuredOutput(glosses, provider);
      glosses = this.normalizeGlosses(glosses);
      this.recordLog(runId, logs, "result", "Finished after reaching iteration limit", {
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
        runId,
      };
    } finally {
      emitRunCompletion(runId);
    }
  }

  private buildSystemPrompt(context: AgenticGenerationContext): string {
    return `You are an expert language learning content creator with access to a database of glosses.

Your task is to generate comprehensive understanding text challenges for a language learning situation.

**Understanding Challenges**: Text/phrases in ${context.targetLanguage} that learners must UNDERSTAND when others say them (not text learners need to express).

**Guidelines**:
1. Use the analyzeSituationContext tool to understand the situation
2. Use searchExistingGlosses and checkGlossExists to avoid duplicates
3. Generate both direct vocabulary (isParaphrased: false) and descriptive glosses (isParaphrased: true)
4. EFFICIENT WORKFLOW: After searching, decide which glosses to create, then analyze ALL of them in ONE iteration by calling analyzeGlossStructure multiple times in a single response. Then immediately return your final JSON in the NEXT iteration. Don't analyze one gloss per iteration.
5. Before splitting any gloss, call analyzeGlossStructure with the gloss content. Reuse the provided structure or keep the gloss atomic based on the tool result.
6. When a gloss should be split, build a 'contains' tree (usually 1 level deep) and reuse existing gloss IDs for each part when possible.
7. Use getRelatedGlosses to build rich relationships beyond contains.
8. CRITICAL: Every NEW gloss must have translation in ${context.nativeLanguage}. Include translation text directly in your final JSON output as the "translation" field. DO NOT call ensureGlossTranslations for new glosses - only call it when you have a real database ID of an existing gloss that needs translations added.
9. For new glosses in your final output: Provide the translation text directly in the "translation" field. The backend will create the translation gloss automatically.
10. Whenever you reuse an existing gloss (parent or contains), include its database ID in the final JSON under the field \`id\`. If you are creating a new gloss, omit \`id\` but provide the translation so it can be persisted.
11. Aim for comprehensive coverage: basic vocabulary, idioms, variations, related concepts. No strict limit on count—generate until the situation is well-covered (typically 10-20 glosses).

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

  private buildExpressionSystemPrompt(context: AgenticGenerationContext): string {
    return `You are an expert language learning content creator with access to a database of glosses.

Your task is to generate comprehensive expression challenges for a language learning situation.

**Expression Challenges**: High-level communicative functions in ${context.nativeLanguage} that learners need to EXPRESS/SAY in ${context.targetLanguage} (what learners want to say, not what they need to understand).

**Key Difference from Understanding**: Expression challenges are in the NATIVE language (${context.nativeLanguage}), and learners must translate TO the target language (${context.targetLanguage}).

**CRITICAL - Translation Strategy**:
- Native glosses are often PARAPHRASED (e.g., "apologize for being late")
- Translations must be ACTUAL NATURAL EXPRESSIONS in ${context.targetLanguage}, NOT literal translations of the paraphrase
- Examples:
  * "apologize for being late" → "Tut mir leid, ich bin zu spät" (NOT "entschuldige dafür, zu spät zu sein")
  * "ask where the bathroom is" → "Wo ist die Toilette?" (NOT "frage wo das Badezimmer ist")
  * "express confusion" → "Ich verstehe nicht" or "Was?" (NOT "Verwirrung ausdrücken")
- The translation should be what a NATIVE SPEAKER would actually say in that situation

**Guidelines**:
1. Use the analyzeSituationContext tool to understand the situation
2. Use searchExistingGlosses extensively to find reusable glosses in ${context.nativeLanguage} for common concepts like "to understand", "to ask", "negation", etc.
3. Focus on HIGH-LEVEL communicative functions (mostly isParaphrased: true):
   - Examples: "express that you don't understand", "ask how much X costs", "apologize politely", "request directions to X"
   - NOT single words like "hello" (unless part of a larger expression)
4. EFFICIENT WORKFLOW: After searching, decide which glosses to create, then analyze ALL of them in ONE iteration by calling analyzeGlossStructure multiple times in a single response. Then immediately return your final JSON in the NEXT iteration. Don't analyze one gloss per iteration.
5. Before splitting any gloss, call analyzeGlossStructure with the gloss content in ${context.nativeLanguage}. Reuse the provided structure or keep the gloss atomic based on the tool result.
6. When a gloss should be split, build a 'contains' tree AND ensure the translation ALSO has a mirrored contains structure:
   - Parent: "express you don't understand" (${context.nativeLanguage}) → translation: ACTUAL natural expression like "Ich verstehe nicht" (${context.targetLanguage})
   - Parent contains: ["to understand", "negating a verb"] (${context.nativeLanguage})
   - Each child also needs NATURAL translations: "to understand" → "verstehen", "negating a verb" → "nicht" (the actual negation particle)
   - The translation's contains should mirror the structure but use NATURAL target language forms
7. Use getRelatedGlosses to explore existing gloss trees and reuse entire subtrees when possible
8. CRITICAL: Every NEW gloss must have translation in ${context.targetLanguage}. Include translation text directly in your final JSON output as the "translation" field. DO NOT call ensureGlossTranslations for new glosses - only call it when you have a real database ID of an existing gloss that needs translations added.
9. For new glosses in your final output: Provide the translation text directly in the "translation" field. The backend will create the translation gloss automatically.
10. Reuse aggressively: Common glosses like "to understand", "to ask", "yes/no", "negation" likely exist. Include their database IDs when reusing.
11. Aim for 10-20 high-level expression challenges that cover typical communicative needs in this situation.

**Translation Mirroring Example** (German):
{
  "content": "express you don't understand",
  "language": "eng",
  "isParaphrased": true,
  "translation": "Ich verstehe nicht",  // ACTUAL natural German, NOT literal translation
  "contains": [
    {
      "content": "to understand",
      "isParaphrased": false,
      "translation": "verstehen"  // Natural German verb
    },
    {
      "content": "negating a verb",
      "isParaphrased": true,
      "translation": "nicht"  // The actual German negation particle, NOT a description
    }
  ]
}

**Translation Mirroring Example** (Arabic):
{
  "content": "ask for the train schedule",
  "language": "eng",
  "isParaphrased": true,
  "translation": "متى القطار؟",  // ACTUAL natural Arabic question, NOT literal translation
  "contains": [
    {
      "content": "ask for",
      "isParaphrased": true,
      "translation": "متى"  // Natural Arabic question word (when)
    },
    {
      "content": "train",
      "isParaphrased": false,
      "translation": "القطار"  // Natural Arabic noun
    }
  ]
}

**Output Format**:
When done, return a JSON object:
{
  "glosses": [
    {
      "content": "string (high-level expression in ${context.nativeLanguage})",
      "isParaphrased": boolean,
      "translation": "NATURAL expression native speakers actually say in ${context.targetLanguage} - NOT a literal translation!",
      "transcriptions": ["phonetic for translation"],
      "notes": [{ "noteType": "usage", "content": "...", "showBeforeSolution": false }],
      "contains": [
        {
          "content": "sub-part in ${context.nativeLanguage}",
          "isParaphrased": boolean,
          "translation": "NATURAL ${context.targetLanguage} word/phrase - NOT literal translation!",
          "contains": []
        }
      ]
    }
  ]
}

REMEMBER: Translations must be what native speakers ACTUALLY SAY, not literal translations of paraphrased descriptions!`;
  }

  private buildExpressionUserPrompt(context: AgenticGenerationContext): string {
    const hints = context.userHints ? `\n\nUser hints: ${context.userHints}` : "";

    return `Generate comprehensive expression challenges for situation: ${context.situationId}

Target language: ${context.targetLanguage}
Native language: ${context.nativeLanguage}${hints}

Remember: Generate HIGH-LEVEL communicative functions in ${context.nativeLanguage} that learners need to express in ${context.targetLanguage}.
Focus on practical expressions like "ask how to get to X", "express confusion", "request help", etc.

Start by analyzing the situation context, then search for reusable glosses, then generate appropriate challenges.`;
  }

  private validateExpressionGlosses(
    glosses: GlossPayload[],
    context: AgenticGenerationContext
  ): { valid: true } | { valid: false; feedback: string; issues: string[] } {
    const issues: string[] = [];

    for (const gloss of glosses) {
      this.validateExpressionGlossPayload(gloss, context, issues, []);
    }

    if (issues.length === 0) {
      return { valid: true };
    }

    const feedback =
      "Some expression glosses failed validation:\n- " + issues.map(issue => issue.trim()).join("\n- ");
    return { valid: false, feedback, issues };
  }

  private validateExpressionGlossPayload(
    gloss: GlossPayload,
    context: AgenticGenerationContext,
    issues: string[],
    lineage: string[]
  ) {
    const label = [...lineage, gloss.content].filter(Boolean).join(" > ") || gloss.content;

    // For expression challenges, translation should be in TARGET language
    if (!gloss.translation || gloss.translation.trim().length === 0) {
      issues.push(`Provide a translation for "${label}" in ${context.targetLanguage}.`);
    }

    // Check structure cache (uses native language for expression challenges)
    const key = this.getStructureKey(context.nativeLanguage, gloss.content);
    const structure = key ? this.structureCache.get(key) : undefined;

    if (!structure && gloss.contains && gloss.contains.length > 0) {
      issues.push(`Call analyzeGlossStructure before splitting "${label}" into contains entries.`);
    }

    if (structure?.split) {
      if (!gloss.contains || gloss.contains.length === 0) {
        issues.push(
          `Add contains entries for "${label}" based on analyzeGlossStructure suggestions.`
        );
      } else {
        const childContents = new Set(
          gloss.contains.map(child => child.content.trim())
        );
        for (const part of structure.parts) {
          if (!childContents.has(part.content.trim())) {
            issues.push(
              `The contains list for "${label}" must include "${part.content}" as suggested by analyzeGlossStructure.`
            );
          }
        }
      }
    }

    if (gloss.contains && gloss.contains.length > 0) {
      for (const child of gloss.contains) {
        if (!child.id && (!child.translation || child.translation.trim().length === 0)) {
          issues.push(
            `Either reference an existing gloss ID or provide a translation so "${child.content}" can be created.`
          );
        }
        this.validateExpressionGlossPayload(child, context, issues, [...lineage, gloss.content]);
      }
    }
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
    runId: string,
    logs: AgenticGenerationLogEntry[],
    type: AgenticLogType,
    message: string,
    details?: unknown
  ) {
    const entry = {
      timestamp: new Date().toISOString(),
      type,
      message,
      details,
    };
    logs.push(entry);
    emitRunLog(runId, entry);
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

  private createAgentRunner(provider: AIProvider) {
    if (provider === "gemini") {
      return new GeminiAgentRunner(this.toolList);
    }

    if (!env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required to use the OpenAI provider");
    }

    const model = new ChatOpenAI({
      model: AI_CONFIG.models.openai.agentic,
      temperature: 0.7,
      apiKey: env.OPENAI_API_KEY,
    });

    return model.bindTools(this.toolList, {
      strict: true,
      response_format: this.buildOpenAIResponseFormat(),
    });
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
      this.validateGlossPayload(gloss, context, issues, []);
    }

    if (issues.length === 0) {
      return { valid: true };
    }

    const feedback =
      "Some glosses failed validation:\n- " + issues.map(issue => issue.trim()).join("\n- ");
    return { valid: false, feedback, issues };
  }

  private validateGlossPayload(
    gloss: GlossPayload,
    context: AgenticGenerationContext,
    issues: string[],
    lineage: string[]
  ) {
    const label = [...lineage, gloss.content].filter(Boolean).join(" > ") || gloss.content;
    if (!gloss.translation || gloss.translation.trim().length === 0) {
      issues.push(`Provide a translation for "${label}" in ${context.nativeLanguage}.`);
    }

    const key = this.getStructureKey(context.targetLanguage, gloss.content);
    const structure = key ? this.structureCache.get(key) : undefined;

    if (!structure && gloss.contains && gloss.contains.length > 0) {
      issues.push(`Call analyzeGlossStructure before splitting "${label}" into contains entries.`);
    }

    if (structure?.split) {
      if (!gloss.contains || gloss.contains.length === 0) {
        issues.push(
          `Add contains entries for "${label}" based on analyzeGlossStructure suggestions.`
        );
      } else {
        const childContents = new Set(
          gloss.contains.map(child => child.content.trim())
        );
        for (const part of structure.parts) {
          if (!childContents.has(part.content.trim())) {
            issues.push(
              `The contains list for "${label}" must include "${part.content}" as suggested by analyzeGlossStructure.`
            );
          }
        }
      }
    }

    if (gloss.contains && gloss.contains.length > 0) {
      for (const child of gloss.contains) {
        if (!child.id && (!child.translation || child.translation.trim().length === 0)) {
          issues.push(
            `Either reference an existing gloss ID or provide a translation so "${child.content}" can be created.`
          );
        }
        this.validateGlossPayload(child, context, issues, [...lineage, gloss.content]);
      }
    }
  }

  private normalizeGlosses(glosses: GlossPayload[]): GlossPayload[] {
    return glosses.map(gloss => this.normalizeGloss(gloss));
  }

  private normalizeGloss(gloss: GlossPayload): GlossPayload {
    const normalizedContains = this.normalizeGlosses(gloss.contains ?? []);
    return {
      ...gloss,
      transcriptions: Array.isArray(gloss.transcriptions)
        ? gloss.transcriptions
            .map(value => (typeof value === "string" ? value.trim() : ""))
            .filter(value => value.length > 0)
        : [],
      notes: Array.isArray(gloss.notes)
        ? gloss.notes.map(note => ({
            noteType: typeof note.noteType === "string" && note.noteType.trim().length > 0
              ? note.noteType
              : "usage",
            content: typeof note.content === "string" ? note.content : "",
            showBeforeSolution: Boolean(note.showBeforeSolution),
          }))
        : [],
      contains: normalizedContains,
    };
  }

  private async ensureStructuredOutput(
    glosses: GlossPayload[],
    provider: AIProvider
  ): Promise<GlossPayload[]> {
    if (provider !== "gemini" || glosses.length === 0) {
      return glosses;
    }

    if (!env.GEMINI_API_KEY) {
      return glosses;
    }

    try {
      const client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
      const formatter = client.getGenerativeModel({
        model: AI_CONFIG.models.gemini.agentic,
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              glosses: {
                type: SchemaType.ARRAY,
                items: buildStructuredGlossSchema(),
              },
            },
            required: ["glosses"],
          },
        },
      });

      const response = await formatter.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: [
                  "Format the following JSON to match the expected schema exactly.",
                  "Only return the structured JSON with no commentary.",
                  JSON.stringify({ glosses }),
                ].join("\n\n"),
              },
            ],
          },
        ],
      });

      const text =
        response.response?.candidates
          ?.flatMap(candidate => candidate.content?.parts ?? [])
          .map(part => part.text ?? "")
          .join("") ?? "";
      const parsed = this.safeParseJSON(text);
      if (parsed?.glosses && Array.isArray(parsed.glosses)) {
        return parsed.glosses;
      }
      return glosses;
    } catch {
      return glosses;
    }
  }

  private buildOpenAIResponseFormat() {
    return {
      type: "json_schema" as const,
      json_schema: {
        name: "gloss_response",
        strict: true,
        schema: {
          type: "object",
          properties: {
            glosses: {
              type: "array",
              items: this.buildOpenAIGlossSchema(),
            },
          },
          additionalProperties: false,
          required: ["glosses"],
        },
      },
    };
  }

  private buildOpenAIGlossSchema(depth = 2): any {
    const noteSchema = {
      type: "object",
      properties: {
        noteType: { type: "string" },
        content: { type: "string" },
        showBeforeSolution: { type: "boolean" },
      },
      additionalProperties: false,
      required: ["noteType", "content", "showBeforeSolution"],
    };

    const baseProperties = {
      content: { type: "string" },
      isParaphrased: { type: "boolean" },
      translation: { type: "string" },
      transcriptions: {
        type: "array",
        items: { type: "string" },
      },
      notes: {
        type: "array",
        items: noteSchema,
      },
    };
    const requiredKeys = Object.keys(baseProperties);

    const containsProperty =
      depth > 0
        ? {
            type: "array",
            items: this.buildOpenAIGlossSchema(depth - 1),
          }
        : {
            type: "array",
            items: {
              type: "object",
              properties: {},
              additionalProperties: false,
              required: [],
            },
          };

    const buildVariant = (includeId: boolean) => ({
      type: "object",
      properties: {
        ...(includeId ? { id: { type: "string" } } : {}),
        ...baseProperties,
        contains: containsProperty,
      },
      additionalProperties: false,
      required: [
        ...(includeId ? ["id"] : []),
        ...requiredKeys,
        "contains",
      ],
    });

    return {
      anyOf: [buildVariant(true), buildVariant(false)],
    };
  }
}

class GeminiAgentRunner {
  private readonly model;

  constructor(private readonly tools: StructuredToolInterface[]) {
    if (!env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is required to use the Gemini provider");
    }

    const client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    this.model = client.getGenerativeModel({
      model: AI_CONFIG.models.gemini.agentic,
      tools: [
        {
          functionDeclarations: this.tools.map(tool => ({
            name: tool.name,
            description: tool.description ?? "",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {},
            },
          })),
        },
      ],
      generationConfig: {
        temperature: 0.7,
      },
    });
  }

  async invoke(messages: any[]) {
    const { systemInstruction, contents } = this.convertMessages(messages);
    const response = await this.model.generateContent({
      contents,
      systemInstruction: systemInstruction
        ? { role: "system", parts: [{ text: systemInstruction }] }
        : undefined,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            glosses: {
              type: SchemaType.ARRAY,
              items: buildStructuredGlossSchema(),
            },
          },
          required: ["glosses"],
        },
      },
    });

    const candidate = response.response?.candidates?.[0];
    if (!candidate || !candidate.content) {
      throw new Error("Gemini returned no usable response");
    }

    let text = "";
    const tool_calls: Array<{ id: string; name: string; args: any }> = [];

    for (const part of candidate.content.parts ?? []) {
      if (part.text) {
        text += part.text;
      } else if (part.functionCall) {
        tool_calls.push({
          id: randomUUID(),
          name: part.functionCall.name,
          args: this.normalizeArgs(part.functionCall.args),
        });
      }
    }

    return {
      role: "assistant",
      content: text,
      tool_calls: tool_calls.length ? tool_calls : undefined,
    };
  }

  private convertMessages(messages: any[]) {
    let systemInstruction: string | undefined;
    const contents: Array<{ role: string; parts: Array<any> }> = [];

    for (const message of messages) {
      if (message.role === "system") {
        systemInstruction = this.normalizeContent(message.content);
        continue;
      }

      if (message.role === "user") {
        contents.push({
          role: "user",
          parts: [{ text: this.normalizeContent(message.content) }],
        });
        continue;
      }

      if (message.role === "assistant") {
        const parts: any[] = [];
        if (message.content && typeof message.content === "string" && message.content.trim()) {
          parts.push({ text: message.content });
        }
        if (Array.isArray(message.tool_calls)) {
          for (const call of message.tool_calls) {
            parts.push({
              functionCall: {
                name: call.name,
                args: call.args ?? {},
              },
            });
          }
        }
        contents.push({
          role: "model",
          parts: parts.length ? parts : [{ text: "" }],
        });
        continue;
      }

      if (message.role === "tool") {
        const parsed =
          typeof message.content === "string"
            ? this.safeParse(message.content)
            : message.content;
        contents.push({
          role: "user",
          parts: [
            {
              functionResponse: {
                name: message.name ?? "tool",
                response: parsed ?? message.content,
              },
            },
          ],
        });
      }
    }

    return { systemInstruction, contents };
  }

  private normalizeContent(content: unknown): string {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content.map(part => String(part)).join("\n");
    }
    if (content && typeof content === "object") {
      return JSON.stringify(content);
    }
    return "";
  }

  private safeParse(value: string) {
    try {
      return JSON.parse(value);
    } catch {
      return { result: value };
    }
  }

  private normalizeArgs(args: unknown) {
    if (!args) return {};
    if (typeof args === "string") {
      try {
        return JSON.parse(args);
      } catch {
        return {};
      }
    }
    return args ?? {};
  }

}
