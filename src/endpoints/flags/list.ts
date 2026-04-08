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

export class FlagsListEndpoint extends OpenAPIRoute<HandleArgs> {
	schema = {
		tags: ["Flags"],
		summary: "List feature flags",
		operationId: "flags-list",
		request: {
			query: z.object({
				search: z.string().optional(),
				type: z.string().optional(),
				tag: z.string().optional(),
				limit: z.coerce.number().int().min(1).max(500).optional(),
				offset: z.coerce.number().int().min(0).optional(),
			}),
		},
		responses: {
			"200": {
				description: "Paginated flags",
				...contentJson({
					success: z.boolean(),
					data: z.array(flagSchema),
					pagination: z.object({
						total: z.number(),
						limit: z.number(),
						offset: z.number(),
					}),
				}),
			},
		},
	};

	async handle(...args: HandleArgs) {
		const [c] = args;
		const q = await this.getValidatedData<typeof this.schema>();
		const query = q.query;
		const svc = getFlagService(c);
		const limit = query.limit ?? 20;
		const offset = query.offset ?? 0;
		const { items, total } = await svc.listDefinitions({
			search: query.search,
			type: query.type,
			tag: query.tag,
			limit,
			offset,
		});

		return {
			success: true,
			data: items.map((f) => ({
				...f,
				targeting: f.targeting ?? null,
			})),
			pagination: { total, limit, offset },
		};
	}
}
