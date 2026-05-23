/**
 * Google Gemini OAuth Configuration
 * These are the public credentials used by the official Gemini CLI
 */
export interface GeminiConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  tokenEndpoint: string;
  authEndpoint: string;
  userinfoEndpoint: string;
}

export const GEMINI_CONFIG: GeminiConfig = {
  clientId: "681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com",
  clientSecret: "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",
  redirectUri: "http://localhost:8085/oauth2callback",
  scopes: [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ],
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  authEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  userinfoEndpoint: "https://www.googleapis.com/oauth2/v1/userinfo",
};
