import * as Sentry from "@sentry/cloudflare";
import { app } from "./app";
import type { Bindings } from "./types";

export { FlagsSvcEntrypoint } from "./entrypoint";

export default Sentry.withSentry((env: Bindings) => {
	const { id: versionId } = env.CF_VERSION_METADATA;
	return {
		dsn: env.SENTRY_DSN,
		release: versionId,
		environment: env.ENVIRONMENT,
		sendDefaultPii: true,
	};
}, app);
