import { describe, expect, it, vi } from "vitest";
import {
	adminMiddleware,
	authMiddleware,
	evaluateAuthMiddleware,
} from "../../src/middleware/auth";

/**
 * Note: jwtVerify / JWKS success and JWT error paths are not unit-tested here because
 * `jose` is ESM and Vitest cannot spy on its exports in @cloudflare/vitest-pool-workers.
 * Those branches are covered indirectly where possible; integration runs with ENVIRONMENT=test.
 */

/** Minimal mock context for middleware tests (typed loosely to satisfy Hono generics). */
function createCtx(options: {
	env?: Record<string, unknown>;
	headers?: Record<string, string | undefined>;
}): Parameters<ReturnType<typeof authMiddleware>>[0] {
	const vars = new Map<string, unknown>();
	const env = {
		ENVIRONMENT: "development",
		...options.env,
	};
	return {
		env,
		req: {
			header: (name: string) => options.headers?.[name],
		},
		set: (k: string, v: unknown) => {
			vars.set(k, v);
		},
		get: (k: string) => vars.get(k),
	} as Parameters<ReturnType<typeof authMiddleware>>[0];
}

describe("authMiddleware", () => {
	it("sets test user when ENVIRONMENT is test", async () => {
		const mw = authMiddleware();
		const c = createCtx({ env: { ENVIRONMENT: "test" } });
		let nextCalled = false;
		await mw(c, async () => {
			nextCalled = true;
		});
		expect(nextCalled).toBe(true);
		expect(c.get("user")).toEqual({
			id: "test-user-id",
			email: "test@example.com",
		});
		expect(c.get("tokenPayload")).toMatchObject({
			sub: "test-user-id",
			role: "admin",
		});
	});

	it("maps JWKS fetch failure to 503 (before cache is populated)", async () => {
		const getJwks = vi.fn().mockRejectedValue(new Error("network"));
		const mw = authMiddleware();
		const c = createCtx({
			env: {
				ENVIRONMENT: "prod",
				AUTH_SERVICE: { getJwks },
			},
			headers: { Authorization: "Bearer x" },
		});
		await expect(mw(c, async () => {})).rejects.toMatchObject({
			status: 503,
		});
	});

	it("throws when Authorization header is missing", async () => {
		const mw = authMiddleware();
		const c = createCtx({ env: { ENVIRONMENT: "prod" } });
		await expect(mw(c, async () => {})).rejects.toMatchObject({
			status: 401,
		});
	});

	it("throws when Authorization is not Bearer", async () => {
		const mw = authMiddleware();
		const c = createCtx({
			env: { ENVIRONMENT: "prod" },
			headers: { Authorization: "Basic x" },
		});
		await expect(mw(c, async () => {})).rejects.toMatchObject({
			status: 401,
		});
	});

	it("throws when AUTH_SERVICE is not configured", async () => {
		const mw = authMiddleware();
		const c = createCtx({
			env: { ENVIRONMENT: "prod", AUTH_SERVICE: undefined },
			headers: { Authorization: "Bearer token" },
		});
		await expect(mw(c, async () => {})).rejects.toMatchObject({
			status: 500,
		});
	});
});

describe("adminMiddleware", () => {
	it("throws 401 when tokenPayload is missing", async () => {
		const mw = adminMiddleware();
		const c = createCtx({});
		await expect(mw(c, async () => {})).rejects.toMatchObject({
			status: 401,
		});
	});

	it("throws 403 when role is not admin", async () => {
		const mw = adminMiddleware();
		const vars = new Map<string, unknown>([
			["tokenPayload", { sub: "u", role: "user" }],
		]);
		const c = {
			...createCtx({}),
			get: (k: string) => vars.get(k),
		} as Parameters<ReturnType<typeof adminMiddleware>>[0];
		await expect(mw(c, async () => {})).rejects.toMatchObject({
			status: 403,
		});
	});

	it("calls next when role is admin", async () => {
		const mw = adminMiddleware();
		const vars = new Map<string, unknown>([
			["tokenPayload", { sub: "u", role: "admin" }],
		]);
		const c = {
			...createCtx({}),
			get: (k: string) => vars.get(k),
		} as Parameters<ReturnType<typeof adminMiddleware>>[0];
		let nextCalled = false;
		await mw(c, async () => {
			nextCalled = true;
		});
		expect(nextCalled).toBe(true);
	});
});

describe("evaluateAuthMiddleware", () => {
	it("passes through in test environment", async () => {
		const mw = evaluateAuthMiddleware();
		const c = createCtx({ env: { ENVIRONMENT: "test" } });
		let nextCalled = false;
		await mw(c, async () => {
			nextCalled = true;
		});
		expect(nextCalled).toBe(true);
	});

	it("passes through when internal token matches", async () => {
		const mw = evaluateAuthMiddleware();
		const c = createCtx({
			env: {
				ENVIRONMENT: "staging",
				FLAGS_EVALUATE_INTERNAL_TOKEN: "secret",
			},
			headers: { "X-Flags-Internal-Token": "secret" },
		});
		let nextCalled = false;
		await mw(c, async () => {
			nextCalled = true;
		});
		expect(nextCalled).toBe(true);
	});
});
