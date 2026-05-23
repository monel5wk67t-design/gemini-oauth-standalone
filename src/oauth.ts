import { generatePKCE } from "@openauthjs/openauth/pkce";
import { randomBytes } from "node:crypto";
import { GEMINI_CONFIG } from "./config";

interface PkcePair {
  challenge: string;
  verifier: string;
}

/**
 * Authorization URL and PKCE verifier for OAuth flow
 */
export interface GeminiAuthorization {
  url: string;
  verifier: string;
  state: string;
}

/**
 * Successful token exchange result
 */
export interface GeminiTokenSuccess {
  type: "success";
  refresh: string;
  access: string;
  expires: number;
  email?: string;
}

/**
 * Failed token exchange result
 */
export interface GeminiTokenFailure {
  type: "failed";
  error: string;
}

/**
 * Token exchange result (success or failure)
 */
export type GeminiTokenExchangeResult = GeminiTokenSuccess | GeminiTokenFailure;

/**
 * Build the OAuth authorization URL with PKCE
 * @returns Authorization URL, PKCE verifier, and state for CSRF protection
 */
export async function authorizeGemini(): Promise<GeminiAuthorization> {
  const pkce = (await generatePKCE()) as PkcePair;
  const state = randomBytes(32).toString("hex");

  const url = new URL(GEMINI_CONFIG.authEndpoint);
  url.searchParams.set("client_id", GEMINI_CONFIG.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", GEMINI_CONFIG.redirectUri);
  url.searchParams.set("scope", GEMINI_CONFIG.scopes.join(" "));
  url.searchParams.set("code_challenge", pkce.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.hash = "opencode";

  return {
    url: url.toString(),
    verifier: pkce.verifier,
    state,
  };
}

/**
 * Exchange authorization code for tokens
 * @param code - Authorization code from OAuth callback
 * @param verifier - PKCE verifier from authorizeGemini()
 * @returns Token exchange result with access/refresh tokens
 */
export async function exchangeGeminiWithVerifier(
  code: string,
  verifier: string,
): Promise<GeminiTokenExchangeResult> {
  try {
    const tokenResponse = await fetch(GEMINI_CONFIG.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: GEMINI_CONFIG.clientId,
        client_secret: GEMINI_CONFIG.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: GEMINI_CONFIG.redirectUri,
        code_verifier: verifier,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      return {
        type: "failed",
        error: `Token exchange failed: ${tokenResponse.status} - ${errorText}`,
      };
    }

    const tokenPayload = (await tokenResponse.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token: string;
    };

    if (!tokenPayload.refresh_token) {
      return {
        type: "failed",
        error: "Missing refresh token in response",
      };
    }

    // Fetch user info
    let email: string | undefined;
    try {
      const userInfoResponse = await fetch(
        `${GEMINI_CONFIG.userinfoEndpoint}?alt=json`,
        {
          headers: {
            Authorization: `Bearer ${tokenPayload.access_token}`,
          },
        },
      );

      if (userInfoResponse.ok) {
        const userInfo = (await userInfoResponse.json()) as { email?: string };
        email = userInfo.email;
      }
    } catch {
      // User info is optional, continue without it
    }

    return {
      type: "success",
      refresh: tokenPayload.refresh_token,
      access: tokenPayload.access_token,
      expires: Date.now() + tokenPayload.expires_in * 1000,
      email,
    };
  } catch (error) {
    return {
      type: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Refresh an access token using a refresh token
 * @param refreshToken - Refresh token from previous authentication
 * @returns Token refresh result with new access token
 */
export async function refreshGeminiAccessToken(
  refreshToken: string,
): Promise<GeminiTokenExchangeResult> {
  try {
    const response = await fetch(GEMINI_CONFIG.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: GEMINI_CONFIG.clientId,
        client_secret: GEMINI_CONFIG.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }).toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        type: "failed",
        error: `Token refresh failed: ${response.status} - ${errorText}`,
      };
    }

    const payload = (await response.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
    };

    return {
      type: "success",
      refresh: payload.refresh_token ?? refreshToken,
      access: payload.access_token,
      expires: Date.now() + payload.expires_in * 1000,
    };
  } catch (error) {
    return {
      type: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
