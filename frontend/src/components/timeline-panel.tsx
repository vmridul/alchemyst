"use client";

import {
  CaretDownIcon,
  CaretRightIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TimelineEvent } from "../lib/types";

const filterOptions = [
  "ALL",
  "TOKEN",
  "TOOL_CALL",
  "TOOL_RESULT",
  "CONTEXT_SNAPSHOT",
  "PING",
  "PONG",
  "ERROR",
] as const;

type TimelineFilter = (typeof filterOptions)[number];

type TimelineItem =
  | { kind: "tokens"; events: TimelineEvent[] }
  | { kind: "event"; event: TimelineEvent };

interface TimelinePanelProps {
  events: TimelineEvent[];
  activeId: string | null;
  onHighlight: (id: string) => void;
}

export function TimelinePanel({
  events,
  activeId,
  onHighlight,
}: TimelinePanelProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TimelineFilter>("ALL");
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const items = useMemo(
    () => filterItems(groupTokens(events), filter, query),
    [events, filter, query],
  );

  //for auto scroll when new event comes
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items]);

  return (
    <aside className="flex h-full w-[320px] flex-col border-r border-zinc-200 bg-white">
      <div className="flex h-[88px] flex-col justify-between border-b border-zinc-200 p-3">
        <span className="font-bold text-zinc-700">TIMELINE</span>

        <div className="flex gap-1.5">
          <label className="flex min-w-0 flex-1 items-center gap-1 rounded border border-zinc-300 px-2 py-1 text-zinc-500">
            <MagnifyingGlassIcon size={12} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              className="min-w-0 flex-1 bg-transparent text-[10px] text-zinc-800 outline-none placeholder:text-zinc-400"
            />
          </label>

          <select
            value={filter}
            onChange={(event) =>
              setFilter(event.target.value as TimelineFilter)
            }
            className="w-[110px] rounded border border-zinc-300 bg-white px-2 py-1 text-[10px]"
          >
            {filterOptions.map((option) => (
              <option key={option} value={option}>
                {option === "CONTEXT_SNAPSHOT" ? "CONTEXT" : option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2">
        {items.length === 0 ? (
          <div className="flex h-full items-center justify-center text-zinc-400">
            No events
          </div>
        ) : (
          items.map((item) => {
            if (item.kind === "tokens") {
              const groupId = item.events[0]?.id || "tokens";

              return (
                <TokenItem
                  key={groupId}
                  events={item.events}
                  activeId={activeId}
                  open={expandedGroupId === groupId}
                  onHighlight={onHighlight}
                  onToggle={() => {
                    setExpandedGroupId((current) =>
                      current === groupId ? null : groupId,
                    );
                  }}
                />
              );
            }

            return (
              <EventItem
                key={item.event.id}
                event={item.event}
                activeId={activeId}
                onHighlight={onHighlight}
              />
            );
          })
        )}
      </div>
    </aside>
  );
}

function groupTokens(events: TimelineEvent[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  let tokenBatch: TimelineEvent[] = [];

  function saveTokenBatch() {
    if (tokenBatch.length > 0) {
      items.push({ kind: "tokens", events: tokenBatch });
      tokenBatch = [];
    }
  }

  for (const event of events) {
    if (event.type === "TOKEN") {
      tokenBatch.push(event);
    } else {
      saveTokenBatch();
      items.push({ kind: "event", event });
    }
  }

  saveTokenBatch();
  return items;
}

function filterItems(
  items: TimelineItem[],
  filter: TimelineFilter,
  query: string,
): TimelineItem[] {
  const text = query.trim().toLowerCase();

  return items.filter((item) => {
    const type = item.kind === "tokens" ? "TOKEN" : item.event.type;
    const data =
      item.kind === "tokens"
        ? item.events.map((event) => event.data)
        : item.event.data;

    if (filter !== "ALL" && type !== filter) return false;
    if (!text) return true;
    return JSON.stringify(data).toLowerCase().includes(text);
  });
}

function TokenItem({
  events,
  activeId,
  open,
  onHighlight,
  onToggle,
}: {
  events: TimelineEvent[];
  activeId: string | null;
  open: boolean;
  onHighlight: (id: string) => void;
  onToggle: () => void;
}) {
  const firstEvent = events[0];
  const streamId =
    firstEvent?.data.type === "TOKEN" ? firstEvent.data.stream_id : "";
  const timelineId = `token-${streamId || firstEvent?.seq || "tokens"}`;
  const firstReceivedAt = firstEvent?.receivedAt || 0;
  const lastReceivedAt = events.at(-1)?.receivedAt || firstReceivedAt;

  return (
    <div
      id={timelineId}
      onClick={() => streamId && onHighlight(`msg-${streamId}`)}
      className={`mb-1 cursor-pointer rounded border border-zinc-100 p-2 hover:bg-zinc-50 ${
        activeId === timelineId ? "bg-amber-50" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="rounded bg-zinc-100 px-1 py-0.5 text-[8px] font-bold text-zinc-700">
          TOKEN
        </span>
        <span className="text-[9px] text-zinc-400">
          {timeLabel(firstEvent?.receivedAt)}
        </span>
      </div>
      <div className="mt-1 truncate text-[10px] text-zinc-500">
        Streamed {events.length} tokens (
        {Math.max(0, lastReceivedAt - firstReceivedAt)}ms)
      </div>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        className="mt-1 flex cursor-pointer items-center gap-1 text-[9px] font-bold text-zinc-400 hover:text-zinc-700"
      >
        {open ? (
          <CaretDownIcon size={10} weight="bold" />
        ) : (
          <CaretRightIcon size={10} weight="bold" />
        )}
        {open ? "Hide text" : "Show text"}
      </button>

      {open && <TokenList events={events} />}
    </div>
  );
}

function EventItem({
  event,
  activeId,
  onHighlight,
}: {
  event: TimelineEvent;
  activeId: string | null;
  onHighlight: (id: string) => void;
}) {
  const data = event.data;

  //ids for timeline and chat highlighting
  const timelineId =
    data.type === "TOOL_CALL"
      ? `tool-call-${data.call_id}`
      : data.type === "TOOL_RESULT"
        ? `tool-result-${data.call_id}`
        : `event-${event.seq}`;
  const chatId =
    data.type === "TOOL_CALL" || data.type === "TOOL_RESULT"
      ? `tool-${data.call_id}`
      : data.type === "STREAM_END"
        ? `msg-${data.stream_id}`
        : null;

  return (
    <div
      id={timelineId}
      onClick={() => chatId && onHighlight(chatId)}
      className={`mb-1 cursor-pointer rounded border border-zinc-100 p-2 hover:bg-zinc-50 ${
        activeId === timelineId ? "bg-amber-50" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="rounded bg-zinc-100 px-1 py-0.5 text-[8px] font-bold text-zinc-700">
          {event.type}
        </span>
        <span className="text-[9px] text-zinc-400">
          {timeLabel(event.receivedAt)}
        </span>
      </div>
      <div className="mt-1 truncate text-[10px] text-zinc-500">
        {getDescription(event)}
      </div>
    </div>
  );
}

function TokenList({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="mt-1 max-h-40 overflow-auto rounded bg-zinc-50 p-2">
      {events.map((event, index) => (
        <div
          key={event.id}
          className="flex gap-2 border-b border-zinc-100 py-1 text-[10px] last:border-b-0"
        >
          <span className="w-6 flex-shrink-0 text-right text-zinc-400">
            {index + 1}
          </span>
          <span className="w-16 flex-shrink-0 text-zinc-400">
            {timeLabel(event.receivedAt)}
          </span>
          <code className="whitespace-pre-wrap text-zinc-700">
            {JSON.stringify(event.data.type === "TOKEN" ? event.data.text : "")}
          </code>
        </div>
      ))}
    </div>
  );
}

function getDescription(event: TimelineEvent): string {
  const data = event.data;

  if (data.type === "TOOL_CALL" || data.type === "TOOL_RESULT") {
    return `call_id: ${data.call_id}`;
  }
  if (data.type === "CONTEXT_SNAPSHOT") {
    return `context_id: ${data.context_id}`;
  }
  if (data.type === "STREAM_END") {
    return `stream_id: ${data.stream_id}`;
  }
  if (data.type === "PING") {
    return `challenge: ${data.challenge}`;
  }
  if (data.type === "PONG") {
    return `echo: ${data.echo}`;
  }
  if (data.type === "ERROR") {
    return data.message;
  }
  return "event";
}

function timeLabel(timestamp?: number): string {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
