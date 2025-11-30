import { describe, expect, it } from "bun:test";

const BASE_URL = "http://localhost:3000";

describe("SSO API", () => {
    it("should store a UUID and retrieve it", async () => {
        const testUuid = crypto.randomUUID();

        // 1. Login (Store UUID)
        const loginResponse = await fetch(`${BASE_URL}/sso/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uuid: testUuid }),
        });
        expect(loginResponse.status).toBe(200);

        // 2. Fetch UUIDs
        const uuidsResponse = await fetch(`${BASE_URL}/sso/uuids`);
        expect(uuidsResponse.status).toBe(200);
        const uuids = await uuidsResponse.json();

        expect(Array.isArray(uuids)).toBe(true);
        expect(uuids).toContain(testUuid);
    });
});
