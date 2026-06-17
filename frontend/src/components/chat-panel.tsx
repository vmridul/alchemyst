"use client";

import { PaperPlaneRightIcon } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import type { AgentMessage } from "../lib/types";

interface ChatPanelProps {
  messages: AgentMessage[];
  activeId: string | null;
  status: string;
  inputText: string;
  onInputChange: (text: string) => void;
  onSend: () => void;
  onHighlight: (id: string) => void;
}

export function ChatPanel({
  messages,
  activeId,
  status,
  inputText,
  onInputChange,
  onSend,
  onHighlight,
}: ChatPanelProps) {
  const busy = status === "streaming" || status === "tool_call_pending";
  const scrollRef = useRef<HTMLDivElement>(null);

  //for auto scroll when new msg comes
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <main className="flex h-full flex-1 flex-col bg-white">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-zinc-400">
            Send a message
          </div>
        ) : (
          messages.map((message) =>
            message.role === "user" ? (
              <UserMessageCard key={message.id} text={message.text} />
            ) : (
              <AgentMessageCard
                key={message.id}
                message={message}
                activeId={activeId}
                onHighlight={onHighlight}
              />
            ),
          )
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
        className="flex border-t border-zinc-200 p-4"
      >
        <input
          value={inputText}
          onChange={(event) => onInputChange(event.target.value)}
          disabled={busy}
          placeholder="Send a message"
          className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-600 disabled:bg-zinc-50 disabled:text-zinc-400"
        />
        <button
          type="submit"
          disabled={busy || !inputText.trim()}
          className="ml-2 flex h-10 w-10 items-center justify-center rounded bg-zinc-800 text-white hover:bg-zinc-700 disabled:bg-zinc-200 disabled:text-zinc-400"
        >
          <PaperPlaneRightIcon size={17} weight="bold" />
        </button>
      </form>
    </main>
  );
}

function UserMessageCard({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded border border-zinc-800 bg-zinc-800 p-3 text-[11px] leading-relaxed text-white">
        {text}
      </div>
    </div>
  );
}

function AgentMessageCard({
  message,
  activeId,
  onHighlight,
}: {
  message: AgentMessage;
  activeId: string | null;
  onHighlight: (id: string) => void;
}) {
  const messageId = `msg-${message.stream_id}`;

  return (
    <div className="space-y-3">
      <div
        id={messageId}
        onClick={() => onHighlight(`token-${message.stream_id}`)}
        className={`cursor-pointer rounded border p-3 ${
          activeId === messageId
            ? "border-amber-300 bg-amber-50"
            : "border-zinc-200 hover:bg-zinc-50"
        }`}
      >
        <div className="mb-1 text-[10px] font-bold text-zinc-400">AGENT</div>
        <div className="whitespace-pre-wrap leading-relaxed text-zinc-900">
          {message.text || "Streaming"}
        </div>
      </div>

      {message.toolCalls.map((toolCall) => (
        <ToolCallCard
          key={toolCall.call_id}
          toolCall={toolCall}
          activeId={activeId}
          onHighlight={onHighlight}
        />
      ))}
    </div>
  );
}

function ToolCallCard({
  toolCall,
  activeId,
  onHighlight,
}: {
  toolCall: AgentMessage["toolCalls"][number];
  activeId: string | null;
  onHighlight: (id: string) => void;
}) {
  const toolId = `tool-${toolCall.call_id}`;
  const isDone = toolCall.status === "result_received";
  const className =
    activeId === toolId
      ? "border-amber-300 bg-amber-50"
      : isDone
        ? "border-zinc-200 hover:bg-zinc-50"
        : "border-amber-200 bg-amber-50/40";

  return (
    <div
      id={toolId}
      onClick={() => onHighlight(`tool-call-${toolCall.call_id}`)}
      className={`ml-6 cursor-pointer space-y-2 rounded border p-3 ${className}`}
    >
      <div className="flex items-center justify-between gap-3 text-[10px] font-bold">
        <span className="text-zinc-600">TOOL CALL: {toolCall.tool_name}</span>
        <span className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[8px] uppercase text-zinc-500">
          {toolCall.status}
        </span>
      </div>

      <JsonBlock label="ARGS" value={toolCall.args} />
      {toolCall.result && (
        <div
          onClick={(event) => {
            event.stopPropagation();
            onHighlight(`tool-result-${toolCall.call_id}`);
          }}
        >
          <JsonBlock label="RESULT" value={toolCall.result} />
        </div>
      )}
    </div>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded border border-zinc-200 p-2 text-[10px]">
      <div className="mb-1 font-bold text-zinc-400">{label}</div>
      <pre className="overflow-x-auto">{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}
