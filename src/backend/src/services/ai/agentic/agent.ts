import { ChatOpenAI } from "@langchain/openai";
import { LanguageCode, SituationDTO } from "@sbl/shared";
import { GlossPayload } from "../../../schemas/ai-schema";
import { AI_CONFIG } from "../../../config/ai-config";
import { env } from "../../../env";
import { GlossService } from "../../gloss-service";
import { SituationService } from "../../situation-service";
import { createSearchExistingGlossesTool } from "./tools/search-existing-glosses.tool";
import { createGetRelatedGlossesTool } from "./tools/get-related-glosses.tool";
import { createCheckGlossExistsTool } from "./tools/check-gloss-exists.tool";
import { createAnalyzeSituationTool } from "./tools/analyze-situation.tool";
import { createValidateGlossStructureTool } from "./tools/validate-gloss-structure.tool";

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
export interface AgenticGenerationResult {
  glosses: GlossPayload[];
  iterations: number;
  toolCalls: number;
  errors: string[];
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
  private readonly glossService: GlossService;
  private readonly situationService: SituationService;

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

    // Create tools
    const tools = [
      createSearchExistingGlossesTool(this.glossService),
      createGetRelatedGlossesTool(this.glossService),
      createCheckGlossExistsTool(this.glossService),
      createAnalyzeSituationTool(this.situationService),
      createValidateGlossStructureTool(this.glossService),
    ];

    // Initialize model with tools
    this.model = new ChatOpenAI({
      model: AI_CONFIG.models.openai.agentic,
      temperature: 0.7,
      apiKey: env.OPENAI_API_KEY,
    }).bindTools(tools);
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
    const messages: any[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    // ReAct loop: agent calls tools, processes results, decides when done
    while (iterations < AI_CONFIG.agentic.maxIterations) {
      iterations++;

      try {
        const response = await this.model.invoke(messages);
        messages.push(response);

        // Check if agent called tools
        if (response.tool_calls && response.tool_calls.length > 0) {
          toolCalls += response.tool_calls.length;

          // Execute tool calls
          for (const toolCall of response.tool_calls) {
            const tool = this.model.boundTools?.find(t => t.name === toolCall.name);
            if (tool) {
              try {
                const result = await tool.invoke(toolCall.args);
                messages.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  content: result,
                });
              } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                errors.push(`Tool ${toolCall.name} failed: ${errorMsg}`);
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
          return {
            glosses,
            iterations,
            toolCalls,
            errors,
          };
        }

        // If we got here without glosses, ask agent to provide final answer
        messages.push({
          role: "user",
          content:
            "Please provide your final answer as a JSON object with a 'glosses' array containing the generated understanding challenges.",
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`Iteration ${iterations} failed: ${errorMsg}`);

        // If too many errors, abort
        if (errors.length >= AI_CONFIG.agentic.maxErrors) {
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

    return {
      glosses,
      iterations,
      toolCalls,
      errors,
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
4. Split sentences into constituent parts using 'contains' (usually 1 level, deeper for complex structures)
5. Use getRelatedGlosses to build rich relationships
6. Aim for comprehensive coverage: basic vocabulary, idioms, variations, related concepts
7. No strict limit on count - generate until the situation is well-covered (typically 10-20 glosses)

**Output Format**:
When done, return a JSON object:
{
  "glosses": [
    {
      "content": "string (the text in target language)",
      "isParaphrased": boolean,
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
}
