// Server Messages
export interface Token {
  type: "TOKEN";
  seq: number;
  text: string;
  stream_id: string;
}

export interface ToolCall {
  type: "TOOL_CALL";
  seq: number;
  call_id: string;
  tool_name: string;
  args: Record<string, unknown>;
  stream_id: string;
}

export interface ToolResult {
  type: "TOOL_RESULT";
  seq: number;
  call_id: string;
  result: Record<string, unknown>;
  stream_id: string;
}

export interface ContextSnapshot {
  type: "CONTEXT_SNAPSHOT";
  seq: number;
  context_id: string;
  data: Record<string, unknown>;
}

export interface Ping {
  type: "PING";
  seq: number;
  challenge: string;
}

export interface StreamEnd {
  type: "STREAM_END";
  seq: number;
  stream_id: string;
}

export interface ErrorMessage {
  type: "ERROR";
  seq: number;
  code: string;
  message: string;
}

export type ServerMessage =
  | Token
  | ToolCall
  | ToolResult
  | ContextSnapshot
  | Ping
  | StreamEnd
  | ErrorMessage;

// Client Messages
export interface UserMessage {
  type: "USER_MESSAGE";
  content: string;
}

export interface Pong {
  type: "PONG";
  echo: string;
}

export interface Resume {
  type: "RESUME";
  last_seq: number;
}

export interface ToolAck {
  type: "TOOL_ACK";
  call_id: string;
}

export type ClientMessage = UserMessage | Pong | Resume | ToolAck;

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "streaming"
  | "tool_call_pending"
  | "reconnecting"
  | "resuming";

export interface ToolCallState {
  call_id: string;
  tool_name: string;
  args: Record<string, unknown>;
  stream_id: string;
  status: "waiting_for_ack" | "acked" | "result_received";
  result: Record<string, unknown> | null;
  receivedAt: number;
}

export interface StreamState {
  stream_id: string;
  active: boolean;
  frozenText: string;
  currentText: string;
  toolCalls: ToolCallState[];
  startedAt: number;
  endedAt: number | null;
}

export interface AgentMessage {
  id: string;
  stream_id: string;
  text: string;
  toolCalls: ToolCallState[];
  status: "streaming" | "completed" | "error";
  startedAt: number;
  endedAt: number | null;
  role?: "user" | "assistant";
}

export interface ContextVersion {
  seq: number;
  context_id: string;
  data: Record<string, unknown>;
  receivedAt: number;
}

export interface TimelineEvent {
  id: string;
  seq: number;
  type: ServerMessage["type"] | ClientMessage["type"];
  data: ServerMessage | ClientMessage;
  receivedAt: number;
}

export interface AgentState {
  status: ConnectionStatus;
  lastSeq: number;
  reconnectAttempt: number;
  messages: AgentMessage[];
  timelineEvents: TimelineEvent[];
  timelineFilter: { type?: string; query?: string };
  contextVersions: ContextVersion[];
  selectedContextId: string | null;
  selectedContextVersionIndex: number;

  setStatus: (status: ConnectionStatus) => void;
  setLastSeq: (seq: number) => void;
  setReconnectAttempt: (attempt: number) => void;
  addTimelineEvent: (event: TimelineEvent) => void;
  setTimelineFilter: (filter: { type?: string; query?: string }) => void;
  addContextVersion: (version: ContextVersion) => void;
  setContextSelection: (contextId: string, versionIndex: number) => void;
  ackToolCall: (callId: string) => void;
  reset: () => void;
  processMessage: (msg: ServerMessage) => void;
  addUserMessage: (text: string) => void;
}
