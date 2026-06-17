"use client";

import { CaretDownIcon, CaretRightIcon } from "@phosphor-icons/react";
import { useState } from "react";

interface JsonTreeProps {
  label: string;
  value: unknown;
  depth?: number;
}

export function JsonTree({ label, value, depth = 0 }: JsonTreeProps) {
  const [expanded, setExpanded] = useState(depth === 0);
  const children = getChildren(value);
  const canExpand = children.length > 0;

  //limit of 200 children entries
  const visibleChildren = expanded ? children.slice(0, 200) : [];

  return (
    <div>
      <div
        className="flex min-w-max items-center gap-1 rounded px-1 py-0.5 font-mono text-[10px] leading-relaxed text-zinc-700"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {canExpand ? (
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="flex w-4 cursor-pointer items-center justify-center text-zinc-500 hover:text-zinc-800"
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? (
              <CaretDownIcon size={11} weight="bold" />
            ) : (
              <CaretRightIcon size={11} weight="bold" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}

        <span className="font-semibold text-zinc-500">{label}</span>
        <span className="text-zinc-400">:</span>
        <span className="text-zinc-600">
          {canExpand
            ? getGroupLabel(value, children.length)
            : formatValue(value)}
        </span>
      </div>

      {visibleChildren.map((child) => (
        <JsonTree
          key={`${depth}-${child.key}`}
          label={child.key}
          value={child.value}
          depth={depth + 1}
        />
      ))}

      {children.length > visibleChildren.length && (
        <div
          className="px-1 py-0.5 font-mono text-[10px] text-zinc-400"
          style={{ paddingLeft: `${(depth + 1) * 12 + 4}px` }}
        >
          {children.length - visibleChildren.length} more entries hidden
        </div>
      )}
    </div>
  );
}

function getChildren(value: unknown): { key: string; value: unknown }[] {
  if (Array.isArray(value)) {
    return value.map((item, index) => ({
      key: String(index),
      value: item,
    }));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).map(([key, childValue]) => ({
      key,
      value: childValue,
    }));
  }

  return [];
}

function getGroupLabel(value: unknown, count: number): string {
  return Array.isArray(value) ? `Array(${count})` : `Object(${count})`;
}

function formatValue(value: unknown): string {
  if (value === undefined) return "undefined";
  return JSON.stringify(value);
}
