import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { z } from "zod";

const envFiles = [
  path.resolve(process.cwd(), "src/backend/.env"),
  path.resolve(process.cwd(), ".env"),
];

envFiles.forEach((filePath) => {
  if (fs.existsSync(filePath)) {
    config({ path: filePath, override: false });
  }
});

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3333),
  DATABASE_URL: z.string().url(),
  CORS_ORIGIN: z.string().default("*"),
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
});

export const env = envSchema.parse(process.env);
