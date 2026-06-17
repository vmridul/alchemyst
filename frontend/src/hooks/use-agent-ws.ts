import { useEffect, useRef } from "react";
import { useAgentStore } from "./use-agent-store";
import { SeqBuffer } from "../lib/seq-buffer";
import { safeJsonParse, isServerMessage } from "../lib/escape-hatch";
import type {
  ClientMessage,
  ConnectionStatus,
  ServerMessage,
} from "../lib/types";

class AgentWebSocket {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private streamInactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt: number = 0;
  private seqBuffer: SeqBuffer;
  private url: string;
  private currentStreamId: string | null = null;
  private getLastSeq: () => number;
  private onMessage: (msg: ServerMessage) => void;
  private onStatusChange: (status: ConnectionStatus, attempt: number) => void;
  private isDestroyed: boolean = false;
  private static STREAM_INACTIVITY_MS = 8000;

  constructor(options: {
    url: string;
    getLastSeq: () => number;
    onMessage: (msg: ServerMessage) => void;
    onStatusChange: (status: ConnectionStatus, attempt: number) => void;
  }) {
    this.url = options.url;
    this.getLastSeq = options.getLastSeq;
    this.onMessage = options.onMessage;
    this.onStatusChange = options.onStatusChange;

    this.seqBuffer = new SeqBuffer({
      onReady: (msg) => {
        if (msg.type === "TOOL_CALL") {
          this.sendMessage({ type: "TOOL_ACK", call_id: msg.call_id });
        }

        this.onMessage(msg);
        if (msg.type === "PING") {
          useAgentStore.getState().addTimelineEvent({
            id: Math.random().toString(36).substring(7),
            seq: msg.seq,
            type: "PONG",
            data: {
              type: "PONG",
              echo: msg.challenge || "",
            },
            receivedAt: Date.now(),
          });
        }
        if (msg.type === "STREAM_END" || msg.type === "ERROR") {
          this.clearStreamInactivityTimer();
        } else {
          this.resetStreamInactivityTimer();
        }
      },
    });
  }

  connect() {
    if (this.isDestroyed) return;
    this.clearReconnectTimer();

    const isReconnecting = this.reconnectAttempt > 0;
    this.onStatusChange(
      isReconnecting ? "reconnecting" : "connecting",
      this.reconnectAttempt,
    );

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      if (this.isDestroyed) return;

      if (this.reconnectAttempt > 0) {
        const lastSeq = this.getLastSeq();
        this.onStatusChange("resuming", this.reconnectAttempt);
        this.seqBuffer.reset(lastSeq + 1);
        this.sendMessage({ type: "RESUME", last_seq: lastSeq });
      }

      this.onStatusChange("connected", 0);
      this.reconnectAttempt = 0;
    };

    this.ws.onmessage = (event) => {
      if (this.isDestroyed) return;

      const raw = safeJsonParse(event.data);
      if (!raw || !isServerMessage(raw)) return;

      //ping is handled here becuz we need to respond within 3 seconds no matter what
      if (raw.type === "PING") {
        this.sendMessage({ type: "PONG", echo: raw.challenge || "" });
      }

      // check if arrived seq have same stream_id as currentStreamId
      const streamId =
        raw.type === "TOKEN" ||
        raw.type === "TOOL_CALL" ||
        raw.type === "TOOL_RESULT" ||
        raw.type === "STREAM_END"
          ? raw.stream_id
          : null;

      if (
        this.currentStreamId &&
        streamId &&
        streamId !== this.currentStreamId
      ) {
        return;
      }
      if (!this.currentStreamId && streamId) {
        this.currentStreamId = streamId;
      }

      this.seqBuffer.push(raw);
    };

    this.ws.onclose = () => {
      if (this.isDestroyed) return;
      this.onStatusChange("disconnected", this.reconnectAttempt);
      this.scheduleReconnect();
    };

    this.ws.onerror = (err) => {
      console.error(err);
    };
  }

  sendMessage(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  sendUserMessage(content: string) {
    const state = useAgentStore.getState();
    this.currentStreamId = null;
    state.addUserMessage(content);
    state.setLastSeq(0);
    this.seqBuffer.reset(1);
    this.clearStreamInactivityTimer();
    this.sendMessage({ type: "USER_MESSAGE", content });
  }

  disconnect() {
    this.isDestroyed = true;
    this.clearReconnectTimer();
    this.clearStreamInactivityTimer();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private scheduleReconnect() {
    if (this.isDestroyed || this.reconnectTimer) return;

    this.reconnectAttempt++;
    this.onStatusChange("reconnecting", this.reconnectAttempt);

    //exponential increase with limit of 10 secs
    const delay = Math.min(500 * Math.pow(2, this.reconnectAttempt - 1), 10000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // used to detect if the server has stopped sending data for a long time
  // when the timer expires, we will skip the gap and mark the connection as connected
  // this is important because we cant forever wait for the server to send data
  private resetStreamInactivityTimer() {
    this.clearStreamInactivityTimer();
    this.streamInactivityTimer = setTimeout(() => {
      this.streamInactivityTimer = null;
      this.seqBuffer.skipGap();
      const status = useAgentStore.getState().status;
      if (status === "streaming" || status === "tool_call_pending") {
        useAgentStore.getState().addTimelineEvent({
          id: Math.random().toString(36).substring(7),
          seq: useAgentStore.getState().lastSeq,
          type: "ERROR",
          data: {
            type: "ERROR",
            seq: useAgentStore.getState().lastSeq,
            code: "STREAM_TIMEOUT",
            message: "Stream timeout - no data received",
          },
          receivedAt: Date.now(),
        });
        this.onStatusChange("connected", 0);
      }
    }, AgentWebSocket.STREAM_INACTIVITY_MS);
  }

  private clearStreamInactivityTimer() {
    if (this.streamInactivityTimer) {
      clearTimeout(this.streamInactivityTimer);
      this.streamInactivityTimer = null;
    }
  }
}

export function useAgentWs(url: string = "ws://localhost:4747/ws") {
  const clientRef = useRef<AgentWebSocket | null>(null);

  useEffect(() => {
    const client = new AgentWebSocket({
      url,
      getLastSeq: () => useAgentStore.getState().lastSeq,
      onMessage: (msg) => {
        const state = useAgentStore.getState();
        state.processMessage(msg);
        if (msg.type === "TOOL_CALL") {
          state.ackToolCall(msg.call_id);
        }
      },
      onStatusChange: (status, attempt) => {
        const state = useAgentStore.getState();
        state.setStatus(status);
        state.setReconnectAttempt(attempt);
      },
    });

    clientRef.current = client;
    client.connect();

    return () => {
      client.disconnect();
    };
  }, [url]);

  return {
    sendUserMessage: (content: string) =>
      clientRef.current?.sendUserMessage(content),
    reconnect: () => clientRef.current?.connect(),
    disconnect: () => clientRef.current?.disconnect(),
  };
}
