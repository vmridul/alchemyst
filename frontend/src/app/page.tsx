"use client";

import {
  ArrowClockwiseIcon,
  SidebarIcon,
  FileCodeIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { ChatPanel } from "../components/chat-panel";
import { ContextInspector } from "../components/context-inspector";
import { TimelinePanel } from "../components/timeline-panel";
import { useAgentStore } from "../hooks/use-agent-store";
import { useAgentWs } from "../hooks/use-agent-ws";
import type { ConnectionStatus } from "../lib/types";

function statusColor(status: ConnectionStatus): string {
  if (status === "connected" || status === "streaming") return "bg-green-500";
  if (
    status === "connecting" ||
    status === "reconnecting" ||
    status === "resuming" ||
    status === "tool_call_pending"
  ) {
    return "bg-amber-500";
  }
  return "bg-red-500";
}

export default function Home() {
  const store = useAgentStore();
  const { sendUserMessage, reconnect } = useAgentWs();
  const [inputText, setInputText] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showTimeline, setShowTimeline] = useState(true);
  const [showContext, setShowContext] = useState(true);

  const highlight = (id: string) => {
    setActiveId(id);
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => setActiveId(null), 1400);
  };

  const send = () => {
    const text = inputText.trim();
    if (!text) return;

    sendUserMessage(text);
    setInputText("");
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-zinc-50 font-mono text-xs text-zinc-800">
      <header className="flex h-10 items-center justify-between border-b border-zinc-200 bg-white px-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowTimeline(!showTimeline)}
            className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
            title={showTimeline ? "Hide timeline" : "Show timeline"}
          >
            <SidebarIcon size={15} />
          </button>
          <span className="font-bold text-zinc-700">AGENT CONSOLE</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${statusColor(store.status)}`}
            />
            <span className="font-semibold uppercase tracking-wider text-zinc-600">
              {store.status}
              {store.reconnectAttempt > 0 ? ` #${store.reconnectAttempt}` : ""}
            </span>
          </div>

          {store.status === "disconnected" && (
            <button
              type="button"
              onClick={reconnect}
              className="flex items-center gap-1 rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-[10px] hover:bg-zinc-100"
            >
              <ArrowClockwiseIcon size={12} />
              Reconnect
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowContext(!showContext)}
            className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
            title={showContext ? "Hide context" : "Show context"}
          >
            <FileCodeIcon size={15} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {showTimeline && (
          <TimelinePanel
            events={store.timelineEvents}
            activeId={activeId}
            onHighlight={highlight}
          />
        )}

        <ChatPanel
          messages={store.messages}
          activeId={activeId}
          status={store.status}
          inputText={inputText}
          onInputChange={setInputText}
          onSend={send}
          onHighlight={highlight}
        />

        {showContext && (
          <ContextInspector
            versions={store.contextVersions}
            selectedContextId={store.selectedContextId}
            selectedVersionIndex={store.selectedContextVersionIndex}
            onSelectVersion={store.setContextSelection}
          />
        )}
      </div>
    </div>
  );
}
