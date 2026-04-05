import type {
	Condition,
	EvaluationContext,
	FlagDefinition,
	FlagValue,
	TargetingRule,
} from "./types";

export async function rolloutBucket(
	flagKey: string,
	entityId: string,
): Promise<number> {
	const data = new TextEncoder().encode(`${flagKey}:${entityId}`);
	const hash = await crypto.subtle.digest("SHA-256", data);
	const view = new DataView(hash);
	return view.getUint32(0, false) % 100;
}

function getAttr(
	ctx: EvaluationContext,
	attr: string,
): string | number | boolean | undefined {
	switch (attr) {
		case "organizationId":
			return ctx.organizationId;
		case "userId":
			return ctx.userId;
		case "plan":
			return ctx.plan;
		case "environment":
			return ctx.environment;
		default:
			return ctx.attributes?.[attr];
	}
}

function matchesCondition(cond: Condition, ctx: EvaluationContext): boolean {
	const left = getAttr(ctx, cond.attribute);
	const op = cond.operator;

	if (left === undefined) return false;

	switch (op) {
		case "eq":
			return String(left) === String(cond.value);
		case "neq":
			return String(left) !== String(cond.value);
		case "in": {
			const arr = Array.isArray(cond.value) ? cond.value : [String(cond.value)];
			return arr.map(String).includes(String(left));
		}
		case "nin": {
			const arr = Array.isArray(cond.value) ? cond.value : [String(cond.value)];
			return !arr.map(String).includes(String(left));
		}
		case "gt":
			return Number(left) > Number(cond.value);
		case "lt":
			return Number(left) < Number(cond.value);
		default:
			return false;
	}
}

function matchesRule(rule: TargetingRule, ctx: EvaluationContext): boolean {
	if (!rule.conditions.length) return true;
	return rule.conditions.every((c) => matchesCondition(c, ctx));
}

/**
 * Resolves the effective value for a flag definition given evaluation context.
 */
export async function evaluateFlagDefinition(
	def: FlagDefinition,
	ctx: EvaluationContext,
): Promise<FlagValue> {
	if (!def.enabled) {
		return def.type === "boolean" ? false : def.defaultValue;
	}

	if (def.environments?.length) {
		const env = ctx.environment ?? "";
		if (!def.environments.includes(env)) {
			return def.defaultValue;
		}
	}

	const rules = def.targeting ?? [];
	for (const rule of rules) {
		if (!matchesRule(rule, ctx)) continue;

		if (rule.rolloutPercentage !== undefined && rule.rolloutPercentage < 100) {
			const entity = ctx.organizationId ?? ctx.userId ?? "anonymous";
			const bucket = await rolloutBucket(def.key, entity);
			if (bucket >= rule.rolloutPercentage) {
				continue;
			}
		}

		return rule.value;
	}

	return def.defaultValue;
}
