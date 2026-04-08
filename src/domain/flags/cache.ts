import type { FlagDefinition } from "./types";

const FLAGS_ALL_KEY = "flags:all";
const FLAG_PREFIX = "flag:";

const CACHE_TTL_SECONDS = 3600;

/**
 * KV read-through cache with invalidate-on-write.
 * Source of truth is D1; KV is an optimization layer only.
 */
export class FlagCache {
	constructor(private kv: KVNamespace) {}

	private flagKey(key: string): string {
		return `${FLAG_PREFIX}${key}`;
	}

	async getAllCached(): Promise<FlagDefinition[] | null> {
		const raw = await this.kv.get(FLAGS_ALL_KEY, "text");
		if (raw == null) return null;
		try {
			const parsed = JSON.parse(raw) as unknown;
			if (!Array.isArray(parsed)) return null;
			return parsed as FlagDefinition[];
		} catch {
			return null;
		}
	}

	async setAllCached(flags: FlagDefinition[]): Promise<void> {
		await this.kv.put(FLAGS_ALL_KEY, JSON.stringify(flags), {
			expirationTtl: CACHE_TTL_SECONDS,
		});
	}

	async getOneCached(key: string): Promise<FlagDefinition | null> {
		const raw = await this.kv.get(this.flagKey(key), "text");
		if (raw == null) return null;
		try {
			return JSON.parse(raw) as FlagDefinition;
		} catch {
			return null;
		}
	}

	async setOneCached(flag: FlagDefinition): Promise<void> {
		await this.kv.put(this.flagKey(flag.key), JSON.stringify(flag), {
			expirationTtl: CACHE_TTL_SECONDS,
		});
	}

	/** After any D1 write, delete cached entries so the next read loads from D1. */
	async invalidateAll(): Promise<void> {
		await this.kv.delete(FLAGS_ALL_KEY);
	}

	async invalidateKey(key: string): Promise<void> {
		await Promise.all([
			this.kv.delete(FLAGS_ALL_KEY),
			this.kv.delete(this.flagKey(key)),
		]);
	}
}
