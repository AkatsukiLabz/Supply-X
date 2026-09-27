import { authHeaders } from "../auth.js";

export function createApiClient(session, onUnauthorized) {
  async function api(path, body) {
    const response = await fetch("/api" + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(session),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    if (response.status === 401) {
      onUnauthorized?.();
      throw Error("Your session has ended. Please sign in again.");
    }

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const details = Array.isArray(result.details)
        ? " - " + result.details.map((x) => x.message).join(", ")
        : "";
      throw Error((result.error || "Unexpected server error") + details);
    }

    return result;
  }

  // For a non-JSON response (a file). Carries the same auth header as api()
  // and surfaces the server's real error message instead of a generic one.
  api.download = async function download(path) {
    const response = await fetch("/api" + path, {
      headers: authHeaders(session),
    });

    if (response.status === 401) {
      onUnauthorized?.();
      throw Error("Your session has ended. Please sign in again.");
    }

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw Error(result.error || "Could not open this document.");
    }

    return response.blob();
  };

  return api;
}