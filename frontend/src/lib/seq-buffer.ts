import type { ServerMessage } from "./types";

export class SeqBuffer {
  private expectedSeq: number = 1;
  private pending: Map<number, ServerMessage> = new Map(); //map for buffer
  private onReady: (msg: ServerMessage) => void;

  constructor(options: { onReady: (msg: ServerMessage) => void }) {
    this.onReady = options.onReady;
  }

  // we need to call reset whenever we want to resume connection
  // it will clear the buffer
  // becuz server will replay all the seqs from the last_seq that we send to it
  reset(startSeq: number = 1): void {
    this.expectedSeq = startSeq;
    this.pending.clear();
  }

  push(message: ServerMessage): void {
    const { seq } = message;

    // duplicate seq , ignore
    if (seq < this.expectedSeq || this.pending.has(seq)) {
      return;
    }

    // correct seq
    if (seq === this.expectedSeq) {
      this.processMessage(message);
      return;
    }

    // some future seq, store in buffer
    this.pending.set(seq, message);
  }

  skipGap(): void {
    if (this.pending.size === 0) return;

    const minPending = Math.min(...this.pending.keys());
    if (minPending > this.expectedSeq) {
      const nextMessage = this.pending.get(minPending)!;
      this.pending.delete(minPending);
      this.processMessage(nextMessage);
    }
  }

  private processMessage(message: ServerMessage): void {
    this.expectedSeq = message.seq + 1;
    this.onReady(message);

    while (this.pending.has(this.expectedSeq)) {
      const next = this.pending.get(this.expectedSeq)!;
      this.pending.delete(this.expectedSeq);
      this.expectedSeq = next.seq + 1;
      this.onReady(next);
    }
  }

  getExpectedSeq(): number {
    return this.expectedSeq;
  }

  getHighestProcessedSeq(): number {
    return this.expectedSeq - 1;
  }

  getPendingCount(): number {
    return this.pending.size;
  }
}
