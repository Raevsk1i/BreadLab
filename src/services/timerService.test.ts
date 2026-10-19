import { afterEach, describe, expect, it } from "vitest";
import { TimerService } from "./timerService";

describe("timer", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("pauses on close and does not resume by itself", () => {
    let now = 1_000;
    const timer = new TimerService(() => now);
    timer.ensure("session::cycle", "Цикл", 4);
    timer.start();
    expect(timer.hasInterval()).toBe(true);
    now += 1_500;
    timer.pauseActive();
    const snap = timer.snapshot();
    expect(snap.running).toBe(false);
    expect(snap.remainingMs).toBeLessThan(4 * 60 * 1000);
    timer.setRemaining(90_000);
    expect(timer.snapshot()).toEqual({ remainingMs: 90_000, running: false });
    timer.start();
    timer.pauseAll();
    expect(timer.hasInterval()).toBe(false);
    expect(timer.active()?.running).toBe(false);
  });
});
