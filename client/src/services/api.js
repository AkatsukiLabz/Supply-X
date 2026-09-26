import { authHeaders } from "../auth.js";
import { staticDemoApi } from "./staticDemo.js";

export function createApiClient(session, onUnauthorized) {
  return async function api(path, body) {
    if (session?.staticDemo) return staticDemoApi(path, body, session);

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
  };
}
