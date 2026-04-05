import { describe, expect, it } from "vitest";
import { FlagCache } from "../../src/domain/flags/cache";
import type { FlagDefinition } from "../../src/domain/flags/types";

const sampleFlag = (): FlagDefinition => ({
	key: "a",
	name: "A",
	type: "boolean",
	defaultValue: true,
	enabled: true,
	createdAt: "",
	updatedAt: "",
});

describe("FlagCache", () => {
	it("invalidateAll deletes keys", async () => {
		const kv = {
			get: async () => null,
			put: async () => {},
			delete: async () => {},
		} as unknown as KVNamespace;
		const cache = new FlagCache(kv);
		await expect(cache.invalidateAll()).resolves.toBeUndefined();
	});

	it("serializes flag in setOneCached", async () => {
		let stored = "";
		const kv = {
			get: async () => null,
			put: async (_k: string, v: string) => {
				stored = v;
			},
			delete: async () => {},
		} as unknown as KVNamespace;
		const cache = new FlagCache(kv);
		await cache.setOneCached(sampleFlag());
		expect(JSON.parse(stored).key).toBe("a");
	});

	it("getAllCached returns array when JSON is valid array", async () => {
		const flags = [sampleFlag()];
		const kv = {
			get: async () => JSON.stringify(flags),
			put: async () => {},
			delete: async () => {},
		} as unknown as KVNamespace;
		const cache = new FlagCache(kv);
		await expect(cache.getAllCached()).resolves.toEqual(flags);
	});

	it("getAllCached returns null when raw is null", async () => {
		const kv = {
			get: async () => null,
			put: async () => {},
			delete: async () => {},
		} as unknown as KVNamespace;
		await expect(new FlagCache(kv).getAllCached()).resolves.toBeNull();
	});

	it("getAllCached returns null when JSON is not an array", async () => {
		const kv = {
			get: async () => "{}",
			put: async () => {},
			delete: async () => {},
		} as unknown as KVNamespace;
		await expect(new FlagCache(kv).getAllCached()).resolves.toBeNull();
	});

	it("getAllCached returns null on invalid JSON", async () => {
		const kv = {
			get: async () => "{",
			put: async () => {},
			delete: async () => {},
		} as unknown as KVNamespace;
		await expect(new FlagCache(kv).getAllCached()).resolves.toBeNull();
	});

	it("setAllCached puts JSON with TTL", async () => {
		let keyUsed = "";
		let valueUsed = "";
		const kv = {
			get: async () => null,
			put: async (k: string, v: string, opts?: { expirationTtl?: number }) => {
				keyUsed = k;
				valueUsed = v;
				expect(opts?.expirationTtl).toBe(3600);
			},
			delete: async () => {},
		} as unknown as KVNamespace;
		const flags = [sampleFlag()];
		await new FlagCache(kv).setAllCached(flags);
		expect(keyUsed).toBe("flags:all");
		expect(JSON.parse(valueUsed)).toEqual(flags);
	});

	it("getOneCached returns parsed flag when valid", async () => {
		const f = sampleFlag();
		const kv = {
			get: async () => JSON.stringify(f),
			put: async () => {},
			delete: async () => {},
		} as unknown as KVNamespace;
		await expect(new FlagCache(kv).getOneCached("a")).resolves.toEqual(f);
	});

	it("getOneCached returns null when missing", async () => {
		const kv = {
			get: async () => null,
			put: async () => {},
			delete: async () => {},
		} as unknown as KVNamespace;
		await expect(new FlagCache(kv).getOneCached("x")).resolves.toBeNull();
	});

	it("getOneCached returns null on invalid JSON", async () => {
		const kv = {
			get: async () => "not-json",
			put: async () => {},
			delete: async () => {},
		} as unknown as KVNamespace;
		await expect(new FlagCache(kv).getOneCached("a")).resolves.toBeNull();
	});

	it("invalidateKey deletes flags:all and flag key", async () => {
		const deleted: string[] = [];
		const kv = {
			get: async () => null,
			put: async () => {},
			delete: async (k: string) => {
				deleted.push(k);
			},
		} as unknown as KVNamespace;
		await new FlagCache(kv).invalidateKey("my-key");
		expect(deleted).toContain("flags:all");
		expect(deleted).toContain("flag:my-key");
		expect(deleted).toHaveLength(2);
	});
});
