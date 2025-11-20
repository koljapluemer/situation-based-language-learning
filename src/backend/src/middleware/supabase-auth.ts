import { FastifyRequest, FastifyReply } from "fastify";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env.js";
import { UnauthorizedError } from "../utils/http-error.js";

// Extend FastifyRequest to include user property
declare module "fastify" {
  interface FastifyRequest {
    user?: {
      id: string;
      email?: string;
      [key: string]: any;
    };
  }
}

// Singleton Supabase client for backend (using service role key)
let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase is not configured");
  }

  if (!supabaseAdmin) {
    supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return supabaseAdmin;
}

/**
 * Fastify middleware to verify Supabase JWT tokens
 * Extracts the token from the Authorization header and verifies it
 * Attaches the decoded user info to request.user
 */
export async function authenticateRequest(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Check if Supabase is configured
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    request.log.warn("Supabase is not configured, skipping authentication");
    return;
  }

  // Extract token from Authorization header
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or invalid authorization header");
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  // Verify token using Supabase
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      request.log.warn({ err: error }, "Token verification failed");
      throw new UnauthorizedError("Invalid or expired token");
    }

    // Attach user info to request
    request.user = {
      id: data.user.id,
      email: data.user.email,
      ...data.user.user_metadata,
    };

    request.log.info({ userId: data.user.id, email: data.user.email }, "Authenticated user");
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    request.log.error({ err: error }, "Authentication error");
    throw new UnauthorizedError("Authentication failed");
  }
}
