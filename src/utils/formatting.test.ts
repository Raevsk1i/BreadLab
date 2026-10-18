import { describe, expect, it, vi } from "vitest";
import { debounce, formatGrams, formatTimer, roundPresent } from "./formatting";
import { isBreadLabImportPayload } from "./validation";

describe("formatting", () => {
  it("rounds fine ingredients to 0.1", () => {
    expect(roundPresent("yeast", 1.24)).toBe(1.2);
    expect(formatGrams("yeast", 1.24)).toBe("1.2");
  });

  it("rounds ordinary grams", () => {
    expect(formatGrams("water", 390.4)).toBe("390");
  });

  it("formats timer mm:ss", () => {
    expect(formatTimer(65_000)).toBe("01:05");
    expect(formatTimer(0)).toBe("00:00");
  });

  it("debounces calls", async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d();
    d();
    d();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe("import guard", () => {
  it("accepts BreadLab export and rejects junk", () => {
    expect(isBreadLabImportPayload({ app: "BreadLab" })).toBe(true);
    expect(isBreadLabImportPayload({ favorites: [] })).toBe(true);
    expect(isBreadLabImportPayload({ foo: 1 })).toBe(false);
    expect(isBreadLabImportPayload(null)).toBe(false);
  });
});
