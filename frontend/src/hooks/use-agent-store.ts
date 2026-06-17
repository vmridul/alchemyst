import { create } from "zustand";
import type {
  AgentMessage,
  AgentState,
  ContextVersion,
  TimelineEvent,
  ToolCallState,
} from "../lib/types";

const initialState = {
  status: "disconnected" as AgentState["status"],
  lastSeq: 0,
  reconnectAttempt: 0,
  messages: [] as AgentMessage[],
  timelineEvents: [] as TimelineEvent[],
  timelineFilter: {},
  contextVersions: [] as ContextVersion[],
  selectedContextId: null,
  selectedContextVersionIndex: -1,
};

//to make random id for user messages
function makeId(): string {
  return Math.random().toString(36).substring(7);
}

export const useAgentStore = create<AgentState>((set, get) => ({
  ...initialState,

  setStatus: (status) => set({ status }),
  setLastSeq: (lastSeq) => set({ lastSeq }),
  setReconnectAttempt: (reconnectAttempt) => set({ reconnectAttempt }),

  addTimelineEvent: (event) =>
    set((state) => ({
      timelineEvents: [...state.timelineEvents, event],
    })),

  setTimelineFilter: (timelineFilter) => set({ timelineFilter }),

  addContextVersion: (version) =>
    set((state) => {
      const contextVersions = [...state.contextVersions, version];
      const versionsForContext = contextVersions.filter(
        (context) => context.context_id === version.context_id,
      );

      return {
        contextVersions,
        selectedContextId: version.context_id,
        selectedContextVersionIndex: versionsForContext.length - 1,
      };
    }),

  setContextSelection: (selectedContextId, selectedContextVersionIndex) =>
    set({ selectedContextId, selectedContextVersionIndex }),

  ackToolCall: (callId) =>
    set((state) => ({
      messages: state.messages.map((message) => ({
        ...message,
        toolCalls: message.toolCalls.map((toolCall) =>
          toolCall.call_id === callId
            ? { ...toolCall, status: "acked" }
            : toolCall,
        ),
      })),
    })),

  reset: () => set({ ...initialState }),

  addUserMessage: (text) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: makeId(),
          stream_id: "",
          text,
          toolCalls: [],
          status: "completed",
          startedAt: Date.now(),
          endedAt: Date.now(),
          role: "user",
        },
      ],
    })),

  processMessage: (msg) => {
    get().addTimelineEvent({
      id: makeId(),
      seq: msg.seq,
      type: msg.type,
      data: msg,
      receivedAt: Date.now(),
    });
    set({ lastSeq: msg.seq });

    switch (msg.type) {
      case "TOKEN": {
        set((state) => {
          const existingMessage = state.messages.find(
            (message) => message.stream_id === msg.stream_id,
          );

          if (!existingMessage) {
            return {
              status: "streaming",
              messages: [
                ...state.messages,
                {
                  id: msg.stream_id,
                  stream_id: msg.stream_id,
                  text: msg.text,
                  toolCalls: [],
                  status: "streaming",
                  startedAt: Date.now(),
                  endedAt: null,
                },
              ],
            };
          }

          return {
            status: "streaming",
            messages: state.messages.map((message) =>
              message.stream_id === msg.stream_id
                ? { ...message, text: message.text + msg.text }
                : message,
            ),
          };
        });
        return;
      }

      case "TOOL_CALL": {
        const toolCall: ToolCallState = {
          call_id: msg.call_id,
          tool_name: msg.tool_name,
          args: msg.args,
          stream_id: msg.stream_id,
          status: "waiting_for_ack",
          result: null,
          receivedAt: Date.now(),
        };

        set((state) => ({
          status: "tool_call_pending",
          messages: state.messages.some(
            (message) => message.stream_id === msg.stream_id,
          )
            ? state.messages.map((message) =>
                message.stream_id === msg.stream_id
                  ? { ...message, toolCalls: [...message.toolCalls, toolCall] }
                  : message,
              )
            : [
                ...state.messages,
                {
                  id: msg.stream_id,
                  stream_id: msg.stream_id,
                  text: "",
                  toolCalls: [toolCall],
                  status: "streaming",
                  startedAt: Date.now(),
                  endedAt: null,
                },
              ],
        }));
        return;
      }

      case "TOOL_RESULT": {
        set((state) => {
          const messages = state.messages.map((message) => {
            if (message.stream_id !== msg.stream_id) return message;

            return {
              ...message,
              toolCalls: message.toolCalls.map((toolCall) =>
                toolCall.call_id === msg.call_id
                  ? {
                      ...toolCall,
                      status: "result_received" as const,
                      result: msg.result,
                    }
                  : toolCall,
              ),
            };
          });
          const activeMessage = messages.find(
            (message) => message.stream_id === msg.stream_id,
          );
          const hasPendingTool = activeMessage?.toolCalls.some(
            (toolCall) => toolCall.status !== "result_received",
          );

          return {
            status: hasPendingTool ? "tool_call_pending" : "streaming",
            messages,
          };
        });
        return;
      }

      case "CONTEXT_SNAPSHOT": {
        get().addContextVersion({
          seq: msg.seq,
          context_id: msg.context_id,
          data: structuredClone(msg.data),
          receivedAt: Date.now(),
        });
        return;
      }

      case "STREAM_END": {
        set((state) => ({
          status: "connected",
          messages: state.messages.map((message) =>
            message.stream_id === msg.stream_id
              ? { ...message, status: "completed", endedAt: Date.now() }
              : message,
          ),
        }));
        return;
      }

      case "ERROR": {
        set((state) => ({
          status: "connected",
          messages: state.messages.map((message) =>
            message.status === "streaming"
              ? { ...message, status: "error", endedAt: Date.now() }
              : message,
          ),
        }));
        return;
      }

      //ping is handled in websocket client directly
      case "PING":
        return;
    }
  },
}));
