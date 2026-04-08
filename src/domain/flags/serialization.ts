import type {
	FlagDefinition,
	FlagType,
	FlagValue,
	TargetingRule,
} from "./types";

export function serializeFlagValue(value: FlagValue): string {
	return JSON.stringify(value);
}

export function parseFlagValue(raw: string, type: FlagType): FlagValue {
	const parsed: unknown = JSON.parse(raw);
	switch (type) {
		case "boolean":
			return Boolean(parsed);
		case "number":
			return typeof parsed === "number" ? parsed : Number(parsed);
		case "string":
			return typeof parsed === "string" ? parsed : String(parsed);
		case "json":
			return typeof parsed === "object" &&
				parsed !== null &&
				!Array.isArray(parsed)
				? (parsed as Record<string, unknown>)
				: {};
		default:
			return parsed as FlagValue;
	}
}

export function parseJsonArray(
	raw: string | null | undefined,
): string[] | null {
	if (raw == null || raw === "") return null;
	const v = JSON.parse(raw) as unknown;
	return Array.isArray(v) ? (v as string[]) : null;
}

export function parseTargeting(
	raw: string | null | undefined,
): TargetingRule[] | null {
	if (raw == null || raw === "") return null;
	const v = JSON.parse(raw) as unknown;
	return Array.isArray(v) ? (v as TargetingRule[]) : null;
}

export function rowToFlagDefinition(row: {
	key: string;
	name: string;
	description: string | null;
	type: string;
	defaultValue: string;
	enabled: boolean;
	environments: string | null;
	targeting: string | null;
	tags: string | null;
	createdAt: Date;
	updatedAt: Date;
}): FlagDefinition {
	const type = row.type as FlagType;
	return {
		key: row.key,
		name: row.name,
		description: row.description,
		type,
		defaultValue: parseFlagValue(row.defaultValue, type),
		enabled: row.enabled,
		environments: parseJsonArray(row.environments),
		targeting: parseTargeting(row.targeting),
		tags: parseJsonArray(row.tags),
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}
