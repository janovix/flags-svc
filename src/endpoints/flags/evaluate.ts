import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";

import type { HandleArgs } from "../../types";
import { getFlagService } from "./serviceFactory";

const contextSchema = z.object({
	organizationId: z.string().optional(),
	userId: z.string().optional(),
	plan: z.string().optional(),
	environment: z.string().optional(),
	attributes: z
		.record(z.union([z.string(), z.number(), z.boolean()]))
		.optional(),
});

export class FlagsEvaluateEndpoint extends OpenAPIRoute<HandleArgs> {
	schema = {
		tags: ["Flags"],
		summary: "Evaluate feature flags for a context",
		operationId: "flags-evaluate",
		request: {
			body: contentJson(
				z.object({
					context: contextSchema,
					keys: z.array(z.string()).optional(),
				}),
			),
		},
		responses: {
			"200": {
				description: "Resolved flag values",
				...contentJson({
					success: z.boolean(),
					result: z.record(z.unknown()),
				}),
			},
		},
	};

	async handle(...args: HandleArgs) {
		const [c] = args;
		const data = await this.getValidatedData<typeof this.schema>();
		const ctx = data.body.context;
		const svc = getFlagService(c);

		if (data.body.keys?.length) {
			const result = await svc.evaluateFlags(data.body.keys, ctx);
			return { success: true, result };
		}

		const result = await svc.evaluateAllFlags(ctx);
		return { success: true, result };
	}
}
