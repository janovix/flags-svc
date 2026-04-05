import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("flags API", () => {
	it("creates, lists, evaluates, toggles, and deletes a flag", async () => {
		const create = await SELF.fetch("http://local.test/api/flags", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				key: "test-flag",
				name: "Test Flag",
				type: "boolean",
				defaultValue: true,
				enabled: true,
				tags: ["test"],
			}),
		});
		expect(create.status).toBe(200);
		const created = (await create.json()) as {
			success: boolean;
			data: { key: string };
		};
		expect(created.success).toBe(true);
		expect(created.data.key).toBe("test-flag");

		const list = await SELF.fetch("http://local.test/api/flags");
		expect(list.status).toBe(200);
		const listed = (await list.json()) as {
			success: boolean;
			data: Array<{ key: string }>;
			pagination: { total: number };
		};
		expect(listed.success).toBe(true);
		expect(listed.data.some((f) => f.key === "test-flag")).toBe(true);

		const evalRes = await SELF.fetch("http://local.test/api/flags/evaluate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				context: { environment: "production" },
				keys: ["test-flag"],
			}),
		});
		expect(evalRes.status).toBe(200);
		const evaluated = (await evalRes.json()) as {
			success: boolean;
			result: Record<string, unknown>;
		};
		expect(evaluated.success).toBe(true);
		expect(evaluated.result["test-flag"]).toBe(true);

		const toggle = await SELF.fetch(
			"http://local.test/api/flags/test-flag/toggle",
			{ method: "PATCH" },
		);
		expect(toggle.status).toBe(200);
		const toggled = (await toggle.json()) as {
			success: boolean;
			data: { enabled: boolean };
		};
		expect(toggled.data.enabled).toBe(false);

		const del = await SELF.fetch("http://local.test/api/flags/test-flag", {
			method: "DELETE",
		});
		expect(del.status).toBe(200);
	});

	it("GET /api/flags/:key returns a flag and 404 when missing", async () => {
		const create = await SELF.fetch("http://local.test/api/flags", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				key: "get-by-key-flag",
				name: "Get By Key",
				type: "boolean",
				defaultValue: false,
				enabled: true,
			}),
		});
		expect(create.status).toBe(200);

		const getOk = await SELF.fetch(
			"http://local.test/api/flags/get-by-key-flag",
		);
		expect(getOk.status).toBe(200);
		const body = (await getOk.json()) as {
			success: boolean;
			data: { key: string; name: string; type: string };
		};
		expect(body.success).toBe(true);
		expect(body.data.key).toBe("get-by-key-flag");
		expect(body.data.name).toBe("Get By Key");

		const get404 = await SELF.fetch(
			"http://local.test/api/flags/does-not-exist",
		);
		expect(get404.status).toBe(404);

		await SELF.fetch("http://local.test/api/flags/get-by-key-flag", {
			method: "DELETE",
		});
	});

	it("PUT /api/flags/:key updates a flag and 404 when missing", async () => {
		await SELF.fetch("http://local.test/api/flags", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				key: "put-flag",
				name: "Before",
				type: "string",
				defaultValue: "a",
				enabled: true,
				tags: ["t1"],
			}),
		});

		const put = await SELF.fetch("http://local.test/api/flags/put-flag", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "After",
				description: "updated",
				defaultValue: "b",
				tags: ["t2"],
			}),
		});
		expect(put.status).toBe(200);
		const updated = (await put.json()) as {
			success: boolean;
			data: { name: string; defaultValue: unknown };
		};
		expect(updated.success).toBe(true);
		expect(updated.data.name).toBe("After");
		expect(updated.data.defaultValue).toBe("b");

		const put404 = await SELF.fetch("http://local.test/api/flags/missing-put", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "x" }),
		});
		expect(put404.status).toBe(404);

		await SELF.fetch("http://local.test/api/flags/put-flag", {
			method: "DELETE",
		});
	});

	it("DELETE and PATCH toggle return 404 when flag is missing", async () => {
		const del404 = await SELF.fetch("http://local.test/api/flags/nope-del", {
			method: "DELETE",
		});
		expect(del404.status).toBe(404);

		const toggle404 = await SELF.fetch(
			"http://local.test/api/flags/nope-toggle/toggle",
			{ method: "PATCH" },
		);
		expect(toggle404.status).toBe(404);
	});

	it("POST /api/flags rejects invalid body", async () => {
		const res = await SELF.fetch("http://local.test/api/flags", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "only-name" }),
		});
		expect(res.status).toBeGreaterThanOrEqual(400);
	});

	it("POST /api/flags/evaluate without keys evaluates all flags", async () => {
		await SELF.fetch("http://local.test/api/flags", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				key: "eval-all-a",
				name: "A",
				type: "boolean",
				defaultValue: true,
				enabled: true,
			}),
		});
		await SELF.fetch("http://local.test/api/flags", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				key: "eval-all-b",
				name: "B",
				type: "boolean",
				defaultValue: false,
				enabled: true,
			}),
		});

		const evalRes = await SELF.fetch("http://local.test/api/flags/evaluate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				context: { environment: "production" },
			}),
		});
		expect(evalRes.status).toBe(200);
		const evaluated = (await evalRes.json()) as {
			success: boolean;
			result: Record<string, unknown>;
		};
		expect(evaluated.success).toBe(true);
		expect(evaluated.result["eval-all-a"]).toBe(true);
		expect(evaluated.result["eval-all-b"]).toBe(false);

		await SELF.fetch("http://local.test/api/flags/eval-all-a", {
			method: "DELETE",
		});
		await SELF.fetch("http://local.test/api/flags/eval-all-b", {
			method: "DELETE",
		});
	});
});
