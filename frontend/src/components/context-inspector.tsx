"use client";

import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import type { ContextVersion } from "../lib/types";
import { JsonTree } from "./json-tree";

interface ContextInspectorProps {
  versions: ContextVersion[];
  selectedContextId: string | null;
  selectedVersionIndex: number;
  onSelectVersion: (contextId: string, versionIndex: number) => void;
}

export function ContextInspector({
  versions,
  selectedContextId,
  selectedVersionIndex,
  onSelectVersion,
}: ContextInspectorProps) {
  const contextIds = Array.from(new Set(versions.map((version) => version.context_id)));
  const activeContextId = selectedContextId || contextIds.at(-1) || null;
  const history = activeContextId
    ? versions.filter((version) => version.context_id === activeContextId)
    : [];
  const safeIndex = getSafeIndex(selectedVersionIndex, history.length);
  const selected = safeIndex >= 0 ? history[safeIndex] : null;

  return (
    <aside className="flex h-full w-[440px] flex-col border-l border-zinc-200 bg-zinc-50">
      <div className="flex h-10 flex-shrink-0 items-center border-b border-zinc-200 bg-white px-3">
        <span className="font-bold text-zinc-700">CONTEXT INSPECTOR</span>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2 border-b border-zinc-200 bg-white px-3 py-1.5">
        {contextIds.length > 1 ? (
          <select
            value={activeContextId || ""}
            onChange={(event) => onSelectVersion(event.target.value, 0)}
            className="max-w-[150px] rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-[10px]"
          >
            {contextIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        ) : activeContextId ? (
          <span className="font-mono text-[10px] text-zinc-500">
            {activeContextId}
          </span>
        ) : null}

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            disabled={safeIndex <= 0}
            onClick={() =>
              activeContextId && onSelectVersion(activeContextId, safeIndex - 1)
            }
            className="rounded border border-zinc-300 bg-white p-0.5 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
            title="Previous context version"
          >
            <CaretLeftIcon size={12} weight="bold" />
          </button>
          <span className="text-[10px] font-bold">
            {safeIndex >= 0 ? `${safeIndex + 1}/${history.length}` : "0/0"}
          </span>
          <button
            type="button"
            disabled={safeIndex < 0 || safeIndex >= history.length - 1}
            onClick={() =>
              activeContextId && onSelectVersion(activeContextId, safeIndex + 1)
            }
            className="rounded border border-zinc-300 bg-white p-0.5 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
            title="Next context version"
          >
            <CaretRightIcon size={12} weight="bold" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {!selected ? (
          <div className="flex h-full items-center justify-center text-zinc-400">
            No context snapshot received
          </div>
        ) : (
          <div className="overflow-hidden rounded border border-zinc-200 bg-white p-2">
            <JsonTree
              label={selected.context_id}
              value={selected.data}
            />
          </div>
        )}
      </div>
    </aside>
  );
}

function getSafeIndex(index: number, length: number): number {
  if (length === 0) return -1;
  return Math.min(Math.max(index, 0), length - 1);
}
