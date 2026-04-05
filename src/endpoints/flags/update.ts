import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";

import type { HandleArgs } from "../../types";
import type {
	FlagType,
	FlagValue,
	TargetingRule,
} from "../../domain/flags/types";
import { getFlagService } from "./serviceFactory";

const targetingRuleSchema = z.object({
	name: z.string(),
	conditions: z.array(
		z.object({
			attribute: z.string(),
			operator: z.enum(["eq", "neq", "in", "nin", "gt", "lt"]),
			value: z.union([z.string(), z.array(z.string()), z.number()]),
		}),
	),
	value: z.unknown(),
	rolloutPercentage: z.number().min(0).max(100).optional(),
});

const bodySchema = z.object({
	name: z.string().optional(),
	description: z.string().nullable().optional(),
	type: z.enum(["boolean", "string", "number", "json"]).optional(),
	defaultValue: z.unknown().optional(),
	enabled: z.boolean().optional(),
	environments: z.array(z.string()).nullable().optional(),
	targeting: z.array(targetingRuleSchema).nullable().optional(),
	tags: z.array(z.string()).nullable().optional(),
});

export class FlagsUpdateEndpoint extends OpenAPIRoute<HandleArgs> {
	schema = {
		tags: ["Flags"],
		summary: "Update a feature flag",
		operationId: "flags-update",
		request: {
			params: z.object({
				key: z.string(),
			}),
			body: contentJson(bodySchema),
		},
		responses: {
			"200": {
				description: "Updated flag",
				...contentJson({
					success: z.boolean(),
					data: z.record(z.unknown()),
				}),
			},
			"404": { description: "Not found" },
		},
	};

	async handle(...args: HandleArgs) {
		const [c] = args;
		const data = await this.getValidatedData<typeof this.schema>();
		const svc = getFlagService(c);
		const b = data.body;

		const updated = await svc.update(data.params.key, {
			name: b.name,
			description: b.description,
			type: b.type as FlagType | undefined,
			defaultValue: b.defaultValue as FlagValue | undefined,
			enabled: b.enabled,
			environments: b.environments,
			targeting: b.targeting as TargetingRule[] | null | undefined,
			tags: b.tags,
		});

		if (!updated) {
			return Response.json(
				{ success: false, error: "Flag not found" },
				{ status: 404 },
			);
		}

		return { success: true, data: updated };
	}
}
