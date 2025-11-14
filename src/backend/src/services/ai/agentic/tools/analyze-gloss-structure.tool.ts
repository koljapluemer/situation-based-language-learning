import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { GlossService } from "../../../gloss-service";
import { AI_CONFIG } from "../../../../config/ai-config";
import { env } from "../../../../env";
import { LanguageCode } from "@sbl/shared";
import { languageCodeSchema } from "../../../../schemas/common";

const analyzeSchema = z.object({
  glossId: z.string().describe("Existing gloss ID to analyze").optional(),
  language: languageCodeSchema.describe("Language code of the gloss content"),
  content: z.string().min(1).describe("Gloss content to analyze"),
  situationSummary: z
    .string()
    .optional()
    .describe("Optional short situation summary or hints for additional context"),
});

interface AnalyzeInput extends z.infer<typeof analyzeSchema> {}

interface StructureResult {
  split: boolean;
  parts?: Array<{ content: string; reason?: string }>;
}

export function createAnalyzeGlossStructureTool(glossService: GlossService) {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY required to analyze gloss structure");
  }

  const llm = new ChatOpenAI({
    model: AI_CONFIG.models.openai.agentic,
    temperature: 0.2,
    apiKey: env.OPENAI_API_KEY,
  });

  return tool(
    async (args: AnalyzeInput) => {
      try {
        const { glossId, language, content, situationSummary } = args;

        // 1. Reuse existing contains if present
        const existing = await fetchExistingGloss(
          glossService,
          glossId,
          language as LanguageCode,
          content
        );
        if (existing?.contains?.length) {
          return JSON.stringify({
            success: true,
            reusedStructure: true,
            split: true,
            parts: existing.contains.map(child => ({
              id: child.id,
              content: child.content,
            })),
          });
        }

        // 2. Ask the LLM whether to split
        const analysis = await analyzeWithLLM(llm, {
          gloss: content,
          language,
          situationSummary,
        });

        return JSON.stringify({
          success: true,
          reusedStructure: false,
          split: analysis.split,
          parts: analysis.parts ?? [],
        });
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    {
      name: "analyzeGlossStructure",
      description:
        "Decide whether a gloss should be split into smaller contains entries. " +
        "Always call this before splitting multi-token glosses. " +
        "Will reuse existing data if the gloss already has contains; otherwise uses context-aware analysis " +
        "that works across languages/scripts.",
      schema: analyzeSchema,
    }
  );
}

async function fetchExistingGloss(
  glossService: GlossService,
  glossId: string | undefined,
  language: LanguageCode,
  content: string
) {
  if (glossId) {
    try {
      return await glossService.findById(glossId);
    } catch {
      // ignore and fallback to search
    }
  }
  const matches = await glossService.list(language, content);
  return matches.length > 0 ? matches[0] : null;
}

async function analyzeWithLLM(
  llm: ChatOpenAI,
  params: { gloss: string; language: string; situationSummary?: string }
): Promise<StructureResult> {
  const systemPrompt = `You help language teachers decide whether a gloss should be split into sub-parts for comprehension practice.
Consider the semantics even if the language lacks spaces or punctuation. Only call something splittable when the learner genuinely benefits.`;

  const userPrompt = `Gloss language: ${params.language}
Gloss content: ${params.gloss}
Situation summary: ${params.situationSummary ?? "(not provided)"}

Return JSON with:
{
  "split": boolean,
  "parts": [
    { "content": "child gloss", "reason": "why this part matters" }
  ]
}

Rules:
- If the gloss is atomic (single word/short fixed expression), set split=false.
- Provide at most 3 parts. Use concise text straight from the gloss (no translations).
- Only include parts when they meaningfully help the learner understand the parent gloss.`;

  const response = await llm.invoke([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  const parsed = parseStructureResponse(response.content);
  return parsed;
}

function parseStructureResponse(content: unknown): StructureResult {
  if (typeof content !== "string") {
    return { split: false };
  }

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { split: false };
    }
    const parsed = JSON.parse(jsonMatch[0]);
    const split = Boolean(parsed.split);
    const parts = Array.isArray(parsed.parts)
      ? parsed.parts
          .filter(
            (part: any) => typeof part?.content === "string" && part.content.trim().length > 0
          )
          .map((part: any) => ({
            content: part.content,
            reason: typeof part.reason === "string" ? part.reason : undefined,
          }))
      : undefined;
    return { split, parts };
  } catch {
    return { split: false };
  }
}
