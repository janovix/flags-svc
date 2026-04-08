import { WorkerEntrypoint } from "cloudflare:workers";

import { app } from "./app";
import { FlagService } from "./domain/flags/service";
import type { EvaluationContext, FlagValue } from "./domain/flags/types";
import type { Bindings } from "./types";

/**
 * RPC entrypoint for service bindings (`FLAGS_SERVICE` → `FlagsSvcEntrypoint`).
 */
export class FlagsSvcEntrypoint extends WorkerEntrypoint<Bindings> {
	async fetch(request: Request): Promise<Response> {
		return app.fetch(request, this.env, this.ctx);
	}

	private svc(): FlagService {
		return FlagService.fromEnv(this.env);
	}

	async evaluateFlag(
		key: string,
		context: EvaluationContext,
	): Promise<FlagValue | null> {
		return this.svc().evaluateFlag(key, context);
	}

	async evaluateFlags(
		keys: string[],
		context: EvaluationContext,
	): Promise<Record<string, FlagValue>> {
		return this.svc().evaluateFlags(keys, context);
	}

	async evaluateAllFlags(
		context: EvaluationContext,
	): Promise<Record<string, FlagValue>> {
		return this.svc().evaluateAllFlags(context);
	}

	async isFlagEnabled(
		key: string,
		context: EvaluationContext,
	): Promise<boolean> {
		return this.svc().isFlagEnabled(key, context);
	}
}
