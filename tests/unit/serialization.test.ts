import { describe, expect, it } from "vitest";
import {
	parseFlagValue,
	parseJsonArray,
	parseTargeting,
	rowToFlagDefinition,
	serializeFlagValue,
} from "../../src/domain/flags/serialization";

describe("serialization", () => {
	describe("serializeFlagValue", () => {
		it("serializes boolean, string, number, and json object", () => {
			expect(serializeFlagValue(true)).toBe("true");
			expect(serializeFlagValue("x")).toBe('"x"');
			expect(serializeFlagValue(42)).toBe("42");
			expect(serializeFlagValue({ a: 1 })).toBe('{"a":1}');
		});
	});

	describe("parseFlagValue", () => {
		it("parses boolean type", () => {
			expect(parseFlagValue("true", "boolean")).toBe(true);
			expect(parseFlagValue("false", "boolean")).toBe(false);
		});

		it("parses number type", () => {
			expect(parseFlagValue("3.14", "number")).toBe(3.14);
			expect(parseFlagValue("7", "number")).toBe(7);
		});

		it("parses string type", () => {
			expect(parseFlagValue('"hi"', "string")).toBe("hi");
		});

		it("parses json type as object or empty object for non-object", () => {
			expect(parseFlagValue('{"k":"v"}', "json")).toEqual({ k: "v" });
			expect(parseFlagValue("[]", "json")).toEqual({});
			expect(parseFlagValue("null", "json")).toEqual({});
		});

		it("falls back to parsed value for unknown type (default branch)", () => {
			expect(
				parseFlagValue(
					"99",
					"unknown" as import("../../src/domain/flags/types").FlagType,
				),
			).toBe(99);
		});
	});

	describe("parseJsonArray", () => {
		it("returns null for null, undefined, and empty string", () => {
			expect(parseJsonArray(null)).toBeNull();
			expect(parseJsonArray(undefined)).toBeNull();
			expect(parseJsonArray("")).toBeNull();
		});

		it("returns array when JSON is a string array", () => {
			expect(parseJsonArray('["a","b"]')).toEqual(["a", "b"]);
		});

		it("returns null when JSON is not an array", () => {
			expect(parseJsonArray('{"a":1}')).toBeNull();
		});
	});

	describe("parseTargeting", () => {
		it("returns null for null, undefined, and empty string", () => {
			expect(parseTargeting(null)).toBeNull();
			expect(parseTargeting(undefined)).toBeNull();
			expect(parseTargeting("")).toBeNull();
		});

		it("returns rules when JSON is an array", () => {
			const rules = [
				{
					name: "r",
					conditions: [],
					value: true,
				},
			];
			expect(parseTargeting(JSON.stringify(rules))).toEqual(rules);
		});

		it("returns null when JSON is not an array", () => {
			expect(parseTargeting("{}")).toBeNull();
		});
	});

	describe("rowToFlagDefinition", () => {
		it("maps a full row to FlagDefinition", () => {
			const created = new Date("2024-01-01T00:00:00.000Z");
			const updated = new Date("2024-06-01T12:00:00.000Z");
			const row = {
				key: "my-flag",
				name: "My Flag",
				description: "desc",
				type: "boolean",
				defaultValue: "true",
				enabled: true,
				environments: '["prod"]',
				targeting: JSON.stringify([
					{ name: "t", conditions: [], value: false },
				]),
				tags: '["x"]',
				createdAt: created,
				updatedAt: updated,
			};
			const def = rowToFlagDefinition(row);
			expect(def).toMatchObject({
				key: "my-flag",
				name: "My Flag",
				description: "desc",
				type: "boolean",
				defaultValue: true,
				enabled: true,
				environments: ["prod"],
				tags: ["x"],
				createdAt: created.toISOString(),
				updatedAt: updated.toISOString(),
			});
			expect(def.targeting).toHaveLength(1);
		});

		it("maps nullable JSON fields to null when empty", () => {
			const row = {
				key: "k",
				name: "N",
				description: null,
				type: "string",
				defaultValue: '"v"',
				enabled: false,
				environments: null,
				targeting: null,
				tags: null,
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			const def = rowToFlagDefinition(row);
			expect(def.description).toBeNull();
			expect(def.environments).toBeNull();
			expect(def.targeting).toBeNull();
			expect(def.tags).toBeNull();
		});
	});
});
