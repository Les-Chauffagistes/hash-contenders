import {beforeEach, describe, expect, it, vi} from "vitest";
import {UserAPIClient} from "@chauffagistes/cmn";

const client = new UserAPIClient("http://auth-service.test");

describe("getUsersByIds", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("fetch", vi.fn());
    });

    it("posts the identifiers as JSON strings", async () => {
        vi.mocked(fetch).mockResolvedValue(
            new Response(JSON.stringify([{id: 3, pseudo: "Testuser"}]), {status: 200}),
        );

        // Des BigInt, comme ceux que porte `Bet.userId` : `JSON.stringify` lève dessus.
        await expect(client.getUsersByIds([BigInt(3), BigInt(7)])).resolves.toEqual([
            {id: 3, pseudo: "Testuser"},
        ]);

        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining("/users/by-ids"),
            expect.objectContaining({
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({ids: ["3", "7"]}),
            }),
        );
    });

    it("does not call the directory for an empty list", async () => {
        await expect(client.getUsersByIds([])).resolves.toEqual([]);
        expect(fetch).not.toHaveBeenCalled();
    });

    it("throws when the directory answers an error", async () => {
        vi.mocked(fetch).mockResolvedValue(new Response("nope", {status: 500}));

        await expect(client.getUsersByIds([3])).rejects.toThrow("Unable to fetch users: 500");
    });
});

describe("getPseudosByUserId", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("fetch", vi.fn());
    });

    it("asks each identifier once, whatever its shape, and skips the ones the directory ignored", async () => {
        vi.mocked(fetch).mockResolvedValue(
            new Response(JSON.stringify([{id: 3, pseudo: "Testuser"}]), {status: 200}),
        );

        const pseudos = await client.getPseudosByUserId([BigInt(3), 3, "3", 7]);

        expect(pseudos).toEqual(new Map([["3", "Testuser"]]));
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({
            body: JSON.stringify({ids: ["3", "7"]}),
        });
    });

    it("degrades to nameless players when the directory is unreachable", async () => {
        // `UserAPIClient` logge via le logger de `@chauffagistes/cmn`
        // (`process.stdout.write`), pas `console.error` : on le fait taire
        // le temps du test plutôt que de laisser le JSON du log polluer la
        // sortie des tests.
        const stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
        vi.mocked(fetch).mockRejectedValue(new Error("connection refused"));

        await expect(client.getPseudosByUserId([3])).resolves.toEqual(new Map());

        stdoutWrite.mockRestore();
    });
});
