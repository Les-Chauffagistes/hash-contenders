import {describe, expect, it} from "vitest";
import {getBattleMode} from "@/lib/battleMode";

describe("getBattleMode", () => {
    it("returns pool when neither contender targets a worker", () => {
        expect(getBattleMode(undefined, undefined)).toBe("pool");
        expect(getBattleMode(null, null)).toBe("pool");
        expect(getBattleMode("", "")).toBe("pool");
    });

    it("returns miner when only one contender targets a worker", () => {
        expect(getBattleMode("rig1", undefined)).toBe("miner");
        expect(getBattleMode(undefined, "rig1")).toBe("miner");
    });

    it("returns miner when both contenders target a worker", () => {
        expect(getBattleMode("rig1", "rig2")).toBe("miner");
    });
});
