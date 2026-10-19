import { formatClock } from "../utils/formatting";

export interface TimerSlot {
  id: string;
  label: string;
  durationMs: number;
  remainingMs: number;
  running: boolean;
  deadline: number;
}

export class TimerService {
  private slots = new Map<string, TimerSlot>();
  private activeId: string | null = null;
  private interval: number | null = null;
  onTick: (text: string) => void = () => {};
  onDone: (label: string) => void = () => {};

  constructor(private now: () => number = () => performance.now()) {}

  clearAll(): void {
    this.stopInterval();
    this.slots.clear();
    this.activeId = null;
  }

  ensure(id: string, label: string, minutes: number): TimerSlot {
    let slot = this.slots.get(id);
    if (!slot) {
      const durationMs = minutes * 60 * 1000;
      slot = { id, label, durationMs, remainingMs: durationMs, running: false, deadline: 0 };
      this.slots.set(id, slot);
    }
    this.activate(id);
    return slot;
  }

  activate(id: string): void {
    this.activeId = id;
    const slot = this.slots.get(id);
    if (slot?.running && slot.deadline) {
      slot.remainingMs = Math.max(0, slot.deadline - this.now());
      if (slot.remainingMs <= 0) {
        slot.running = false;
        slot.deadline = 0;
        slot.remainingMs = 0;
      }
    }
    if ([...this.slots.values()].some((item) => item.running)) this.ensureInterval();
    this.render();
  }

  active(): TimerSlot | null {
    return this.activeId ? this.slots.get(this.activeId) ?? null : null;
  }

  setRemaining(ms: number): void {
    const slot = this.active();
    if (!slot) return;
    slot.remainingMs = ms;
    slot.running = false;
    slot.deadline = 0;
    this.render();
  }

  start(): void {
    const slot = this.active();
    if (!slot || slot.running || slot.remainingMs <= 0) return;
    slot.deadline = this.now() + slot.remainingMs;
    slot.running = true;
    this.ensureInterval();
    this.render();
  }

  pauseActive(): void {
    const slot = this.active();
    if (!slot || !slot.running) return;
    slot.remainingMs = Math.max(0, slot.deadline - this.now());
    slot.running = false;
    slot.deadline = 0;
    this.render();
  }

  pauseAll(): void {
    const now = this.now();
    for (const slot of this.slots.values()) {
      if (slot.running) {
        slot.remainingMs = Math.max(0, slot.deadline - now);
        slot.running = false;
        slot.deadline = 0;
      }
    }
    this.stopInterval();
    this.render();
  }

  resetActive(): void {
    const slot = this.active();
    if (!slot) return;
    slot.running = false;
    slot.deadline = 0;
    slot.remainingMs = slot.durationMs;
    this.render();
  }

  snapshot(): { remainingMs: number | null; running: false } {
    const slot = this.active();
    if (!slot) return { remainingMs: null, running: false };
    const remainingMs = slot.running ? Math.max(0, slot.deadline - this.now()) : slot.remainingMs;
    return { remainingMs, running: false };
  }

  hasInterval(): boolean {
    return this.interval != null;
  }

  private ensureInterval(): void {
    if (this.interval != null) return;
    this.interval = window.setInterval(() => this.tick(), 250);
  }

  stopInterval(): void {
    if (this.interval != null) {
      window.clearInterval(this.interval);
      this.interval = null;
    }
  }

  private tick(): void {
    const slot = this.active();
    if (!slot || !slot.running) return;
    slot.remainingMs = Math.max(0, slot.deadline - this.now());
    if (slot.remainingMs <= 0) {
      slot.running = false;
      slot.deadline = 0;
      slot.remainingMs = 0;
      const label = slot.label;
      this.stopInterval();
      this.render();
      this.onDone(label);
      return;
    }
    this.render();
  }

  private render(): void {
    const slot = this.active();
    this.onTick(formatClock(slot ? slot.remainingMs : 0));
  }
}
