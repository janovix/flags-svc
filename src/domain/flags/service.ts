import { createPrismaClient } from "../../lib/prisma";
import type { Bindings } from "../../types";
import { FlagCache } from "./cache";
import { evaluateFlagDefinition } from "./evaluator";
import { FlagRepository, type ListFlagsQuery } from "./repository";
import type {
	EvaluationContext,
	FlagDefinition,
	FlagValue,
	CreateFlagInput,
	UpdateFlagInput,
} from "./types";

export class FlagService {
	constructor(
		private repo: FlagRepository,
		private cache: FlagCache,
	) {}

	static fromEnv(env: Pick<Bindings, "DB" | "KV">): FlagService {
		const prisma = createPrismaClient(env.DB);
		return new FlagService(new FlagRepository(prisma), new FlagCache(env.KV));
	}

	async listDefinitions(query?: ListFlagsQuery): Promise<{
		items: FlagDefinition[];
		total: number;
	}> {
		return this.repo.listFiltered(query ?? {});
	}

	async getDefinition(key: string): Promise<FlagDefinition | null> {
		const cached = await this.cache.getOneCached(key);
		if (cached) return cached;

		const def = await this.repo.findByKey(key);
		if (def) await this.cache.setOneCached(def);
		return def;
	}

	async getAllDefinitionsForEval(): Promise<FlagDefinition[]> {
		const cached = await this.cache.getAllCached();
		if (cached) return cached;

		const all = await this.repo.listAll();
		await this.cache.setAllCached(all);
		return all;
	}

	async create(input: CreateFlagInput): Promise<FlagDefinition> {
		const created = await this.repo.create(input);
		await this.cache.invalidateKey(input.key);
		return created;
	}

	async update(
		key: string,
		input: UpdateFlagInput,
	): Promise<FlagDefinition | null> {
		const updated = await this.repo.update(key, input);
		if (updated) await this.cache.invalidateKey(key);
		return updated;
	}

	async remove(key: string): Promise<boolean> {
		const ok = await this.repo.delete(key);
		if (ok) await this.cache.invalidateKey(key);
		return ok;
	}

	async toggle(key: string): Promise<FlagDefinition | null> {
		const updated = await this.repo.toggleEnabled(key);
		if (updated) await this.cache.invalidateKey(key);
		return updated;
	}

	async evaluateFlag(
		key: string,
		ctx: EvaluationContext,
	): Promise<FlagValue | null> {
		const defs = await this.getAllDefinitionsForEval();
		const def = defs.find((d) => d.key === key);
		if (!def) return null;
		return evaluateFlagDefinition(def, ctx);
	}

	async evaluateFlags(
		keys: string[],
		ctx: EvaluationContext,
	): Promise<Record<string, FlagValue>> {
		const defs = await this.getAllDefinitionsForEval();
		const set = new Set(keys);
		const out: Record<string, FlagValue> = {};
		for (const def of defs) {
			if (!set.has(def.key)) continue;
			out[def.key] = await evaluateFlagDefinition(def, ctx);
		}
		return out;
	}

	async evaluateAllFlags(
		ctx: EvaluationContext,
	): Promise<Record<string, FlagValue>> {
		const defs = await this.getAllDefinitionsForEval();
		const out: Record<string, FlagValue> = {};
		for (const def of defs) {
			out[def.key] = await evaluateFlagDefinition(def, ctx);
		}
		return out;
	}

	async isFlagEnabled(key: string, ctx: EvaluationContext): Promise<boolean> {
		const v = await this.evaluateFlag(key, ctx);
		return Boolean(v);
	}
}
