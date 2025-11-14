import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { LanguageCode, SituationDTO, GlossDTO } from "@sbl/shared";
import { GlossPayload } from "../../schemas/ai-schema";
import { AI_CONFIG } from "../../config/ai-config";
import { env } from "../../env";

/**
 * Context for generating understanding challenges
 */
export interface GenerationContext {
  situation: SituationDTO;
  targetLanguage: LanguageCode;
  nativeLanguage: LanguageCode;
  existingGlosses: GlossDTO[];
  userHints?: string;
}

/**
 * Abstract interface for AI providers
 */
interface ClassicAIProvider {
  generateUnderstandingChallenges(
    context: GenerationContext,
    count: number
  ): Promise<GlossPayload[]>;
}

/**
 * OpenAI Provider Implementation
 */
class OpenAIProvider implements ClassicAIProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor() {
    if (!env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required for OpenAI provider");
    }
    this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    this.model = AI_CONFIG.models.openai.classic;
  }

  async generateUnderstandingChallenges(
    context: GenerationContext,
    count: number
  ): Promise<GlossPayload[]> {
    const systemPrompt = this.buildSystemPrompt(context);
    const userPrompt = this.buildUserPrompt(context, count);

    try {
      // Use structured output with response_format
      const response = await this.client.chat.completions.create({
        model: this.model,
        temperature: AI_CONFIG.classic.temperature,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "understanding_challenges",
            strict: true,
            schema: {
              type: "object",
              properties: {
                glosses: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      content: { type: "string" },
                      isParaphrased: { type: "boolean" },
                      translation: { type: "string" },
                      transcriptions: { type: "array", items: { type: "string" } },
                      notes: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            noteType: { type: "string" },
                            content: { type: "string" },
                            showBeforeSolution: { type: "boolean" },
                          },
                          required: ["noteType", "content", "showBeforeSolution"],
                          additionalProperties: false,
                        },
                      },
                      contains: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            content: { type: "string" },
                            isParaphrased: { type: "boolean" },
                            translation: { type: "string" },
                            transcriptions: { type: "array", items: { type: "string" } },
                            contains: { type: "array", items: {} }, // Allow nested
                          },
                          required: ["content", "isParaphrased", "translation"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["content", "isParaphrased", "translation"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["glosses"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("No content in OpenAI response");
      }

      const parsed = JSON.parse(content);
      return parsed.glosses as GlossPayload[];
    } catch (error) {
      // If structured output fails, try with simpler JSON mode
      console.error("Structured output failed, trying JSON mode:", error);

      const response = await this.client.chat.completions.create({
        model: this.model,
        temperature: AI_CONFIG.classic.temperature,
        messages: [
          { role: "system", content: systemPrompt + "\n\nIMPORTANT: Return valid JSON only." },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("No content in OpenAI response (JSON mode)");
      }

      const parsed = JSON.parse(content);
      return parsed.glosses as GlossPayload[];
    }
  }

  private buildSystemPrompt(context: GenerationContext): string {
    return `You are an expert language learning content creator specialized in generating understanding text challenges.

Your task is to generate text/phrases in ${context.targetLanguage} that a learner must UNDERSTAND when listening to or reading them (not text they need to express themselves).

Key guidelines:
1. **Understanding, not expression**: Generate text that native speakers would say/write that learners need to comprehend
2. **Direct vocabulary (isParaphrased: false)**: Exact words, phrases, sentences as they appear in the language
   - Example: "¿Cómo estás?" (not a description)
3. **Descriptive glosses (isParaphrased: true)**: Concepts or usage patterns described in meta-language
   - Example: "[express surprise]", "[negate a sentence]"
4. **Recursive splitting**: Break sentences into their constituent parts using the 'contains' field
   - Usually 1 level deep (sentence → words)
   - Can go deeper for complex structures (word → root/stem)
   - Example: "¿Cómo estás?" contains ["cómo", "estás" which contains ["estar (root)"]]
5. **Translations**: REQUIRED - Provide a translation in ${context.nativeLanguage} for EVERY gloss (including all glosses in the contains tree)
   - Use the "translation" field for each gloss
   - The translation should be natural and contextually appropriate
   - For paraphrased glosses, translate the descriptive text
   - Example: { content: "¿Cómo estás?", translation: "How are you?", contains: [{ content: "cómo", translation: "how" }, { content: "estás", translation: "are" }]}
6. **Avoid duplicates**: Do not generate glosses that are identical to existing ones
7. **Transcriptions**: Provide IPA or phonetic transcriptions where helpful
8. **Notes**: Add helpful notes about usage, formality, context, etc.

Situation context:
- Situation ID: ${context.situation.id}
- Descriptions: ${context.situation.descriptions.map(d => `${d.language}: ${d.content}`).join(", ")}
- Target language: ${context.targetLanguage}
- Native language: ${context.nativeLanguage}`;
  }

  private buildUserPrompt(context: GenerationContext, count: number): string {
    const existingList = context.existingGlosses
      .map(g => `"${g.content}"`)
      .join(", ");

    const hints = context.userHints
      ? `\n\nUser hints: ${context.userHints}`
      : "";

    return `Generate ${count} understanding text challenges for this situation.

Existing glosses to avoid duplicating: ${existingList || "none"}${hints}

Return a JSON object with a "glosses" array containing ${count} gloss objects.`;
  }
}

/**
 * Gemini Provider Implementation
 */
class GeminiProvider implements ClassicAIProvider {
  private readonly client: GoogleGenerativeAI;
  private readonly model: string;

  constructor() {
    if (!env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is required for Gemini provider");
    }
    this.client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    this.model = AI_CONFIG.models.gemini.classic;
  }

  async generateUnderstandingChallenges(
    context: GenerationContext,
    count: number
  ): Promise<GlossPayload[]> {
    const systemPrompt = this.buildSystemPrompt(context);
    const userPrompt = this.buildUserPrompt(context, count);

    const model = this.client.getGenerativeModel({
      model: this.model,
      generationConfig: {
        temperature: AI_CONFIG.classic.temperature,
        responseMimeType: "application/json",
      },
    });

    const result = await model.generateContent([
      systemPrompt,
      userPrompt,
    ]);

    const response = result.response;
    const text = response.text();

    if (!text) {
      throw new Error("No content in Gemini response");
    }

    const parsed = JSON.parse(text);
    return parsed.glosses as GlossPayload[];
  }

  private buildSystemPrompt(context: GenerationContext): string {
    return `You are an expert language learning content creator specialized in generating understanding text challenges.

Your task is to generate text/phrases in ${context.targetLanguage} that a learner must UNDERSTAND when listening to or reading them (not text they need to express themselves).

Key guidelines:
1. **Understanding, not expression**: Generate text that native speakers would say/write that learners need to comprehend
2. **Direct vocabulary (isParaphrased: false)**: Exact words, phrases, sentences as they appear in the language
   - Example: "¿Cómo estás?" (not a description)
3. **Descriptive glosses (isParaphrased: true)**: Concepts or usage patterns described in meta-language
   - Example: "[express surprise]", "[negate a sentence]"
4. **Recursive splitting**: Break sentences into their constituent parts using the 'contains' field
   - Usually 1 level deep (sentence → words)
   - Can go deeper for complex structures (word → root/stem)
   - Example: "¿Cómo estás?" contains ["cómo", "estás" which contains ["estar (root)"]]
5. **Translations**: REQUIRED - Provide a translation in ${context.nativeLanguage} for EVERY gloss (including all glosses in the contains tree)
   - Use the "translation" field for each gloss
   - The translation should be natural and contextually appropriate
   - For paraphrased glosses, translate the descriptive text
   - Example: { content: "¿Cómo estás?", translation: "How are you?", contains: [{ content: "cómo", translation: "how" }, { content: "estás", translation: "are" }]}
6. **Avoid duplicates**: Do not generate glosses that are identical to existing ones
7. **Transcriptions**: Provide IPA or phonetic transcriptions where helpful
8. **Notes**: Add helpful notes about usage, formality, context, etc.

Situation context:
- Situation ID: ${context.situation.id}
- Descriptions: ${context.situation.descriptions.map(d => `${d.language}: ${d.content}`).join(", ")}
- Target language: ${context.targetLanguage}
- Native language: ${context.nativeLanguage}

Return a JSON object with this structure:
{
  "glosses": [
    {
      "content": "string",
      "isParaphrased": boolean,
      "translation": "string",
      "transcriptions": ["string"],
      "notes": [{ "noteType": "string", "content": "string", "showBeforeSolution": boolean }],
      "contains": [
        {
          "content": "string",
          "isParaphrased": boolean,
          "translation": "string",
          "transcriptions": ["string"],
          "contains": []
        }
      ]
    }
  ]
}`;
  }

  private buildUserPrompt(context: GenerationContext, count: number): string {
    const existingList = context.existingGlosses
      .map(g => `"${g.content}"`)
      .join(", ");

    const hints = context.userHints
      ? `\n\nUser hints: ${context.userHints}`
      : "";

    return `Generate ${count} understanding text challenges for this situation.

Existing glosses to avoid duplicating: ${existingList || "none"}${hints}`;
  }
}

/**
 * Classic Generator Service
 * Single LLM call with structured output
 */
export class ClassicGenerator {
  private readonly provider: ClassicAIProvider;

  constructor() {
    // Select provider based on config
    if (AI_CONFIG.provider === "openai") {
      this.provider = new OpenAIProvider();
    } else if (AI_CONFIG.provider === "gemini") {
      this.provider = new GeminiProvider();
    } else {
      throw new Error(`Unknown AI provider: ${AI_CONFIG.provider}`);
    }
  }

  /**
   * Generate understanding challenges using the configured provider
   */
  async generateUnderstandingChallenges(
    context: GenerationContext,
    count: number
  ): Promise<GlossPayload[]> {
    // Validate count
    if (count < 1 || count > AI_CONFIG.classic.maxCount) {
      throw new Error(`Count must be between 1 and ${AI_CONFIG.classic.maxCount}`);
    }

    return this.provider.generateUnderstandingChallenges(context, count);
  }
}
