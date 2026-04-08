import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";

import type { HandleArgs } from "../../types";
import type { FlagType, TargetingRule } from "../../domain/flags/types";
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
	key: z
		.string()
		.min(1)
		.regex(/^[a-z0-9][a-z0-9-]*$/),
	name: z.string().min(1),
	description: z.string().nullable().optional(),
	type: z.enum(["boolean", "string", "number", "json"]),
	defaultValue: z.unknown(),
	enabled: z.boolean().optional(),
	environments: z.array(z.string()).nullable().optional(),
	targeting: z.array(targetingRuleSchema).nullable().optional(),
	tags: z.array(z.string()).nullable().optional(),
});

export class FlagsCreateEndpoint extends OpenAPIRoute<HandleArgs> {
	schema = {
		tags: ["Flags"],
		summary: "Create a feature flag",
		operationId: "flags-create",
		request: {
			body: contentJson(bodySchema),
		},
		responses: {
			"200": {
				description: "Created flag",
				...contentJson({
					success: z.boolean(),
					data: z.record(z.unknown()),
				}),
			},
		},
	};

	async handle(...args: HandleArgs) {
		const [c] = args;
		const data = await this.getValidatedData<typeof this.schema>();
		const b = data.body;
		const svc = getFlagService(c);

		const created = await svc.create({
			key: b.key,
			name: b.name,
			description: b.description ?? null,
			type: b.type as FlagType,
			defaultValue:
				b.defaultValue as import("../../domain/flags/types").FlagValue,
			enabled: b.enabled,
			environments: b.environments ?? null,
			targeting: (b.targeting as TargetingRule[] | null | undefined) ?? null,
			tags: b.tags ?? null,
		});

		return { success: true, data: created };
	}
}
