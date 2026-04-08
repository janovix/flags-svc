import { describe, expect, it } from "vitest";
import { getOpenApiInfo, getScalarHtml } from "../../src/app-meta";

describe("app-meta", () => {
	describe("getOpenApiInfo", () => {
		it("uses package description when present", () => {
			const info = getOpenApiInfo({
				name: "svc",
				version: "1.0.0",
				description: "Custom description",
			});
			expect(info).toEqual({
				title: "svc",
				version: "1.0.0",
				description: "Custom description",
			});
		});

		it("falls back when description is missing", () => {
			const info = getOpenApiInfo({
				name: "backend-template",
				version: "0.0.0",
			});
			expect(info.description).toBe(
				"OpenAPI documentation for backend-template (0.0.0).",
			);
		});
	});

	describe("getScalarHtml", () => {
		it("includes meta name, version, Scalar assets, and OpenAPI URL", () => {
			const html = getScalarHtml({ name: "flags-svc", version: "2.0.0" });
			expect(html).toContain("flags-svc");
			expect(html).toContain("2.0.0");
			expect(html).toContain("@scalar/api-reference");
			expect(html).toContain('data-url="/openapi.json"');
		});
	});
});
