# Decisions

## Seq ordering and deduplication

Used a `SeqBuffer` class with:

- `expectedSeq`: the next sequence number we are waiting for
- `pending`: map of messages that arrived early (for buffer)

Flow:

- If `seq < expectedSeq`, ignore it because it was already processed.
- If `seq === expectedSeq`, process it and then drain any pending next messages.
- If `seq > expectedSeq`, store it in `pending`.
- If `pending` already has that `seq`, ignore the duplicate.

Used a `Map` here because we look up messages by exact sequence number.

If the expectedSeq never arrives, the inactivity timer calls `skipGap()` which first process any seqs in buffer and then stops the stream.

Also if in future any seq do arrive (after the timeout), it does not get processed because we do a check during `ws.onmessage` event in `use-agent-ws`

## Tool call layout

Tool calls render as cards under the agent message. The agent text stays in its own block and tool calls are siblings inside the same message group.

## Reconnection

The store tracks `lastSeq`, which means the latest server message the client has processed.

On reconnect:

1. The client reads `lastSeq` from the store.
2. The `SeqBuffer` resets to `lastSeq + 1`.
3. The client sends `RESUME` with `last_seq: lastSeq`.
4. The server replays messages after that sequence.
5. Replayed messages go through the same `SeqBuffer`, so duplicates are dropped.

When the user sends a new message, we reset `lastSeq` to `0`.

## For handling multiple agent streams

For this case, instead of keeping single messages array, we need to keep for each stream_id.
Show a summary of all streams in the dashboard and only show complete details when we open it. And we can use mutliplexed websocket stream.

## Longer responses

For longer responses, it might be better to store content in chunks instead of a single giant string like we are doing right now.
And we can use virtualization as well to tackle performance issues.

## Diff Engine

Haven't implemented JSON diff due to time constraints. Right now we simply show all versions of contexts without any diff.
Rendering the JSON tree is done using a recursive function.

## Relationship of tool call and tool result

I have not shown the relation between tool call and tool result in the timeline for now. If we show a line or indent to join them, there could be a edge case where some other event (say PING) arrives after TOOL_CALL and before TOOL_RESULT, which will ruin the visual look. So I have avoided it for now. We may show a line on side of the row to avoid this as a workaround but that isn't nice visually.
