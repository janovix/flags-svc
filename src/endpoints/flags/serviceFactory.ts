import { FlagService } from "../../domain/flags/service";
import type { Bindings } from "../../types";

export function getFlagService(c: { env: Bindings }): FlagService {
	return FlagService.fromEnv(c.env);
}
