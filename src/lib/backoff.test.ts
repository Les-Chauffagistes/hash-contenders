import {describe, expect, it, vi} from "vitest";
import {nextReconnectDelayMs} from "@/lib/backoff";

describe("nextReconnectDelayMs", () => {
    it("doubles the base delay with each attempt", () => {
        vi.spyOn(Math, "random").mockReturnValue(0);
        expect(nextReconnectDelayMs(0)).toBe(1_000);
        expect(nextReconnectDelayMs(1)).toBe(2_000);
        expect(nextReconnectDelayMs(2)).toBe(4_000);
        vi.restoreAllMocks();
    });

    it("caps the base delay at maxDelayMs", () => {
        vi.spyOn(Math, "random").mockReturnValue(0);
        expect(nextReconnectDelayMs(10, 30_000)).toBe(30_000);
        vi.restoreAllMocks();
    });

    it("adds up to 20% jitter on top of the base delay", () => {
        vi.spyOn(Math, "random").mockReturnValue(1);
        expect(nextReconnectDelayMs(0)).toBe(1_200);
        vi.restoreAllMocks();
    });
});
