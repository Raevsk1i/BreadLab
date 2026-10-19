import type { TimerState } from "../types/state";
import { formatTimer } from "../utils/formatting";

export interface CookRuntime {
  ckKey: string;
  steps: { id: string; text: string; timerMin: number | null }[];
  timers: { id: string; label: string; minutes: number }[];
  recipeTitle: string;
  machineName: string;
}

export class TimerService {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onTick: (() => void) | null = null;
  private onComplete: ((label: string) => void) | null = null;

  startInterval(onTick: () => void, onComplete: (label: string) => void): void {
    this.stopInterval();
    this.onTick = onTick;
    this.onComplete = onComplete;
    this.intervalId = setInterval(() => this.tick(), 250);
  }

  stopInterval(): void {
    if (this.intervalId != null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  isRunning(): boolean {
    return this.intervalId != null;
  }

  ensureTimer(
    bag: Record<string, TimerState>,
    key: string,
    label: string,
    minutes: number,
  ): TimerState {
    if (!bag[key]) {
      bag[key] = {
        durationMs: minutes * 60_000,
        remainingMs: minutes * 60_000,
        running: false,
        deadline: null,
        label,
      };
    }
    return bag[key];
  }

  start(timer: TimerState): void {
    if (timer.remainingMs <= 0) timer.remainingMs = timer.durationMs;
    timer.running = true;
    timer.deadline = performance.now() + timer.remainingMs;
  }

  pause(timer: TimerState): void {
    if (timer.running && timer.deadline != null) {
      timer.remainingMs = Math.max(0, timer.deadline - performance.now());
    }
    timer.running = false;
    timer.deadline = null;
  }

  reset(timer: TimerState): void {
    timer.running = false;
    timer.deadline = null;
    timer.remainingMs = timer.durationMs;
  }

  display(timer: TimerState | null | undefined): string {
    if (!timer) return "00:00";
    const ms =
      timer.running && timer.deadline != null
        ? Math.max(0, timer.deadline - performance.now())
        : timer.remainingMs;
    return formatTimer(ms);
  }

  private tick(): void {
    this.onTick?.();
  }

  /** Call from UI tick with the active timer; may fire completion. */
  syncRunning(timer: TimerState | null): boolean {
    if (!timer || !timer.running || timer.deadline == null) return false;
    const left = timer.deadline - performance.now();
    if (left <= 0) {
      timer.remainingMs = 0;
      timer.running = false;
      timer.deadline = null;
      this.onComplete?.(timer.label);
      return true;
    }
    timer.remainingMs = left;
    return false;
  }
}

export const timerService = new TimerService();
