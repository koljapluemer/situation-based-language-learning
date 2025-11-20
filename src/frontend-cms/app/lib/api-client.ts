import { supabase } from './supabase';

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333';

/**
 * Authenticated fetch wrapper
 * Automatically adds Authorization header with Supabase JWT token
 */
export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  // Get access token from Supabase
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  // Add auth token if available
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Make request
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  return response;
}

/**
 * Public fetch wrapper (no auth required)
 * Use for GET requests that don't require authentication
 */
export async function apiPublicFetch(endpoint: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  return response;
}
