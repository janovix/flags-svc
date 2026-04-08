import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";

import type { HandleArgs } from "../../types";
import { getFlagService } from "./serviceFactory";

const flagSchema = z.object({
	key: z.string(),
	name: z.string(),
	description: z.string().nullable().optional(),
	type: z.enum(["boolean", "string", "number", "json"]),
	defaultValue: z.unknown(),
	enabled: z.boolean(),
	environments: z.array(z.string()).nullable().optional(),
	targeting: z.array(z.unknown()).nullable().optional(),
	tags: z.array(z.string()).nullable().optional(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export class FlagsGetEndpoint extends OpenAPIRoute<HandleArgs> {
	schema = {
		tags: ["Flags"],
		summary: "Get a feature flag by key",
		operationId: "flags-get",
		request: {
			params: z.object({
				key: z.string(),
			}),
		},
		responses: {
			"200": {
				description: "Flag definition",
				...contentJson({
					success: z.boolean(),
					data: flagSchema,
				}),
			},
			"404": { description: "Not found" },
		},
	};

	async handle(...args: HandleArgs) {
		const [c] = args;
		const data = await this.getValidatedData<typeof this.schema>();
		const svc = getFlagService(c);
		const flag = await svc.getDefinition(data.params.key);
		if (!flag) {
			return Response.json(
				{ success: false, error: "Flag not found" },
				{ status: 404 },
			);
		}
		return {
			success: true,
			data: { ...flag, targeting: flag.targeting ?? null },
		};
	}
}
