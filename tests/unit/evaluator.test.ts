import { describe, expect, it } from "vitest";
import {
	evaluateFlagDefinition,
	rolloutBucket,
} from "../../src/domain/flags/evaluator";
import type { Condition, FlagDefinition } from "../../src/domain/flags/types";

const baseMeta = () => ({
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
});

describe("evaluator", () => {
	it("returns default when flag disabled", async () => {
		const def: FlagDefinition = {
			key: "f",
			name: "F",
			type: "boolean",
			defaultValue: false,
			enabled: false,
			...baseMeta(),
		};
		const v = await evaluateFlagDefinition(def, {});
		expect(v).toBe(false);
	});

	it("returns defaultValue for non-boolean disabled flag", async () => {
		const def: FlagDefinition = {
			key: "s",
			name: "S",
			type: "string",
			defaultValue: "fallback",
			enabled: false,
			...baseMeta(),
		};
		expect(await evaluateFlagDefinition(def, {})).toBe("fallback");
	});

	it("matches targeting rule with eq", async () => {
		const def: FlagDefinition = {
			key: "f",
			name: "F",
			type: "boolean",
			defaultValue: false,
			enabled: true,
			targeting: [
				{
					name: "org",
					conditions: [
						{ attribute: "organizationId", operator: "eq", value: "o1" },
					],
					value: true,
				},
			],
			...baseMeta(),
		};
		const v = await evaluateFlagDefinition(def, {
			organizationId: "o1",
		});
		expect(v).toBe(true);
	});

	it("matches neq operator", async () => {
		const def: FlagDefinition = {
			key: "f",
			name: "F",
			type: "boolean",
			defaultValue: false,
			enabled: true,
			targeting: [
				{
					name: "n",
					conditions: [{ attribute: "plan", operator: "neq", value: "free" }],
					value: true,
				},
			],
			...baseMeta(),
		};
		expect(await evaluateFlagDefinition(def, { plan: "pro" })).toBe(true);
		expect(await evaluateFlagDefinition(def, { plan: "free" })).toBe(false);
	});

	it("matches in operator with array and single value", async () => {
		const def: FlagDefinition = {
			key: "f",
			name: "F",
			type: "boolean",
			defaultValue: false,
			enabled: true,
			targeting: [
				{
					name: "in",
					conditions: [
						{
							attribute: "environment",
							operator: "in",
							value: ["a", "b"],
						},
					],
					value: true,
				},
			],
			...baseMeta(),
		};
		expect(await evaluateFlagDefinition(def, { environment: "b" })).toBe(true);
		const defSingle: FlagDefinition = {
			...def,
			targeting: [
				{
					name: "in2",
					conditions: [{ attribute: "userId", operator: "in", value: "u1" }],
					value: true,
				},
			],
		};
		expect(await evaluateFlagDefinition(defSingle, { userId: "u1" })).toBe(
			true,
		);
	});

	it("matches nin operator", async () => {
		const def: FlagDefinition = {
			key: "f",
			name: "F",
			type: "boolean",
			defaultValue: false,
			enabled: true,
			targeting: [
				{
					name: "nin",
					conditions: [
						{ attribute: "organizationId", operator: "nin", value: ["x"] },
					],
					value: true,
				},
			],
			...baseMeta(),
		};
		expect(await evaluateFlagDefinition(def, { organizationId: "y" })).toBe(
			true,
		);
		expect(await evaluateFlagDefinition(def, { organizationId: "x" })).toBe(
			false,
		);
	});

	it("matches gt and lt operators", async () => {
		const defGt: FlagDefinition = {
			key: "gt",
			name: "GT",
			type: "boolean",
			defaultValue: false,
			enabled: true,
			targeting: [
				{
					name: "g",
					conditions: [
						{
							attribute: "n",
							operator: "gt",
							value: 5,
						},
					],
					value: true,
				},
			],
			...baseMeta(),
		};
		expect(
			await evaluateFlagDefinition(defGt, {
				attributes: { n: 10 },
			}),
		).toBe(true);
		expect(
			await evaluateFlagDefinition(defGt, {
				attributes: { n: 3 },
			}),
		).toBe(false);

		const defLt: FlagDefinition = {
			key: "lt",
			name: "LT",
			type: "boolean",
			defaultValue: false,
			enabled: true,
			targeting: [
				{
					name: "l",
					conditions: [
						{
							attribute: "n",
							operator: "lt",
							value: 10,
						},
					],
					value: true,
				},
			],
			...baseMeta(),
		};
		expect(
			await evaluateFlagDefinition(defLt, {
				attributes: { n: 5 },
			}),
		).toBe(true);
	});

	it("returns false when attribute is undefined for condition", async () => {
		const def: FlagDefinition = {
			key: "f",
			name: "F",
			type: "boolean",
			defaultValue: true,
			enabled: true,
			targeting: [
				{
					name: "need-org",
					conditions: [
						{ attribute: "organizationId", operator: "eq", value: "o1" },
					],
					value: false,
				},
			],
			...baseMeta(),
		};
		expect(await evaluateFlagDefinition(def, {})).toBe(true);
	});

	it("filters by environments when set", async () => {
		const def: FlagDefinition = {
			key: "f",
			name: "F",
			type: "string",
			defaultValue: "default",
			enabled: true,
			environments: ["prod"],
			targeting: [
				{
					name: "t",
					conditions: [],
					value: "target",
				},
			],
			...baseMeta(),
		};
		expect(await evaluateFlagDefinition(def, { environment: "prod" })).toBe(
			"target",
		);
		expect(await evaluateFlagDefinition(def, { environment: "dev" })).toBe(
			"default",
		);
	});

	it("rule with empty conditions matches any context", async () => {
		const def: FlagDefinition = {
			key: "f",
			name: "F",
			type: "boolean",
			defaultValue: false,
			enabled: true,
			targeting: [
				{
					name: "open",
					conditions: [],
					value: true,
				},
			],
			...baseMeta(),
		};
		expect(await evaluateFlagDefinition(def, {})).toBe(true);
	});

	it("uses first matching rule in order", async () => {
		const def: FlagDefinition = {
			key: "f",
			name: "F",
			type: "boolean",
			defaultValue: "d",
			enabled: true,
			targeting: [
				{
					name: "first",
					conditions: [
						{ attribute: "organizationId", operator: "eq", value: "o1" },
					],
					value: "first",
				},
				{
					name: "second",
					conditions: [],
					value: "second",
				},
			],
			...baseMeta(),
		};
		expect(await evaluateFlagDefinition(def, { organizationId: "o1" })).toBe(
			"first",
		);
	});

	it("unknown condition operator does not match", async () => {
		const def: FlagDefinition = {
			key: "f",
			name: "F",
			type: "boolean",
			defaultValue: "d",
			enabled: true,
			targeting: [
				{
					name: "bad",
					conditions: [
						{
							attribute: "organizationId",
							operator: "eq",
							value: "o1",
						},
						{
							attribute: "organizationId",
							operator: "bad" as Condition["operator"],
							value: "x",
						} as Condition,
					],
					value: "won",
				},
			],
			...baseMeta(),
		};
		expect(await evaluateFlagDefinition(def, { organizationId: "o1" })).toBe(
			"d",
		);
	});

	it("applies rollout when bucket is below percentage", async () => {
		const key = "rollout-key";
		const entity = "entity-a";
		const bucket = await rolloutBucket(key, entity);
		const pct = Math.min(100, bucket + 1);
		const def: FlagDefinition = {
			key,
			name: "R",
			type: "boolean",
			defaultValue: false,
			enabled: true,
			targeting: [
				{
					name: "roll",
					conditions: [],
					value: true,
					rolloutPercentage: pct,
				},
			],
			...baseMeta(),
		};
		expect(await evaluateFlagDefinition(def, { organizationId: entity })).toBe(
			true,
		);
	});

	it("skips rule when rollout bucket is always above zero-percent rollout", async () => {
		const def: FlagDefinition = {
			key: "r2",
			name: "R2",
			type: "boolean",
			defaultValue: "fallback",
			enabled: true,
			targeting: [
				{
					name: "roll",
					conditions: [],
					value: "rolled",
					rolloutPercentage: 0,
				},
				{
					name: "second",
					conditions: [],
					value: "second",
				},
			],
			...baseMeta(),
		};
		expect(await evaluateFlagDefinition(def, { organizationId: "o" })).toBe(
			"second",
		);
	});

	it("rolloutBucket is deterministic", async () => {
		const a = await rolloutBucket("k", "e");
		const b = await rolloutBucket("k", "e");
		expect(a).toBe(b);
	});
});
