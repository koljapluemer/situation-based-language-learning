// Single, standardized API base URL resolution for the CMS.
// Fail fast if it is not provided to avoid accidental localhost usage in production.
const apiBaseUrl = import.meta.env.VITE_API_URL;

if (!apiBaseUrl) {
  throw new Error(
    "VITE_API_URL is required but was not provided. Set it to the backend origin in your .env (e.g. VITE_API_URL=https://api.example.com)."
  );
}

export const API_BASE_URL = apiBaseUrl;
