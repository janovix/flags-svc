/**
 * Feature flag domain types — evaluation context and flag payloads.
 */

export type FlagValue = boolean | string | number | Record<string, unknown>;

export type FlagType = "boolean" | "string" | "number" | "json";

export interface Condition {
	attribute: string;
	operator: "eq" | "neq" | "in" | "nin" | "gt" | "lt";
	value: string | string[] | number;
}

export interface TargetingRule {
	name: string;
	conditions: Condition[];
	value: FlagValue;
	rolloutPercentage?: number;
}

export interface FlagDefinition {
	key: string;
	name: string;
	description?: string | null;
	type: FlagType;
	defaultValue: FlagValue;
	enabled: boolean;
	environments?: string[] | null;
	targeting?: TargetingRule[] | null;
	tags?: string[] | null;
	createdAt: string;
	updatedAt: string;
}

export interface EvaluationContext {
	organizationId?: string;
	userId?: string;
	plan?: string;
	environment?: string;
	attributes?: Record<string, string | number | boolean>;
}

export interface CreateFlagInput {
	key: string;
	name: string;
	description?: string | null;
	type: FlagType;
	defaultValue: FlagValue;
	enabled?: boolean;
	environments?: string[] | null;
	targeting?: TargetingRule[] | null;
	tags?: string[] | null;
}

export type UpdateFlagInput = Partial<Omit<CreateFlagInput, "key">>;
