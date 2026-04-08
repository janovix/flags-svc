import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";

import type { HandleArgs } from "../../types";
import { getFlagService } from "./serviceFactory";

export class FlagsToggleEndpoint extends OpenAPIRoute<HandleArgs> {
	schema = {
		tags: ["Flags"],
		summary: "Toggle enabled on a feature flag",
		operationId: "flags-toggle",
		request: {
			params: z.object({
				key: z.string(),
			}),
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
		const updated = await svc.toggle(data.params.key);
		if (!updated) {
			return Response.json(
				{ success: false, error: "Flag not found" },
				{ status: 404 },
			);
		}
		return { success: true, data: updated };
	}
}
