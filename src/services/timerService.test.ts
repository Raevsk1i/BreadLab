import { describe, expect, it } from "vitest";
import { TimerService } from "./timerService";

describe("TimerService", () => {
  it("pauses without auto-resume and clears interval", () => {
    const svc = new TimerService();
    const bag: Record<string, ReturnType<typeof svc.ensureTimer>> = {};
    const t = svc.ensureTimer(bag, "k", "Bake", 1);
    svc.start(t);
    expect(t.running).toBe(true);
    expect(t.deadline).not.toBeNull();
    svc.pause(t);
    expect(t.running).toBe(false);
    expect(t.deadline).toBeNull();
    expect(t.remainingMs).toBeGreaterThan(0);
    svc.startInterval(
      () => undefined,
      () => undefined,
    );
    expect(svc.isRunning()).toBe(true);
    svc.stopInterval();
    expect(svc.isRunning()).toBe(false);
  });
});
