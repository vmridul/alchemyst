import type { ServerMessage } from "./types";

// safely parse a json with an unknown message shape
// used in use-agent-ws.ts
export function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// the server can send any random message type (especially in chaos mode) so we need to check each field and type before processing it
// used in use-agent-ws.ts
export function isServerMessage(obj: unknown): obj is ServerMessage {
  if (!obj || typeof obj !== "object") {
    return false;
  }

  const candidate = obj as Record<string, unknown>;
  const { type, seq } = candidate;
  if (typeof type !== "string" || typeof seq !== "number") {
    return false;
  }

  switch (type) {
    case "TOKEN":
      return typeof candidate.text === "string" && typeof candidate.stream_id === "string";

    case "TOOL_CALL":
      return (
        typeof candidate.call_id === "string" &&
        typeof candidate.tool_name === "string" &&
        candidate.args !== null &&
        typeof candidate.args === "object" &&
        typeof candidate.stream_id === "string"
      );

    case "TOOL_RESULT":
      return (
        typeof candidate.call_id === "string" &&
        candidate.result !== null &&
        typeof candidate.result === "object" &&
        typeof candidate.stream_id === "string"
      );

    case "CONTEXT_SNAPSHOT":
      return (
        typeof candidate.context_id === "string" &&
        candidate.data !== null &&
        typeof candidate.data === "object"
      );

    case "PING":
      //D: not checking the challenge field becuz in chaos mode, it might not be there regardless we still send a ping
      return true;

    case "STREAM_END":
      return typeof candidate.stream_id === "string";

    case "ERROR":
      return typeof candidate.code === "string" && typeof candidate.message === "string";

    default:
      return false;
  }
}
