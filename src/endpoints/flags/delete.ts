import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";

import type { HandleArgs } from "../../types";
import { getFlagService } from "./serviceFactory";

export class FlagsDeleteEndpoint extends OpenAPIRoute<HandleArgs> {
	schema = {
		tags: ["Flags"],
		summary: "Delete a feature flag",
		operationId: "flags-delete",
		request: {
			params: z.object({
				key: z.string(),
			}),
		},
		responses: {
			"200": {
				description: "Deleted",
				...contentJson({
					success: z.boolean(),
					message: z.string(),
				}),
			},
			"404": { description: "Not found" },
		},
	};

	async handle(...args: HandleArgs) {
		const [c] = args;
		const data = await this.getValidatedData<typeof this.schema>();
		const svc = getFlagService(c);
		const ok = await svc.remove(data.params.key);
		if (!ok) {
			return Response.json(
				{ success: false, error: "Flag not found" },
				{ status: 404 },
			);
		}
		return { success: true, message: "Flag deleted" };
	}
}
