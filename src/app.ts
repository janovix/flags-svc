import { ApiException, fromHono } from "chanfana";
import { Hono } from "hono";
import { ContentfulStatusCode } from "hono/utils/http-status";
import pkg from "../package.json";
import { getOpenApiInfo, getScalarHtml, type AppMeta } from "./app-meta";
import {
	adminMiddleware,
	authMiddleware,
	evaluateAuthMiddleware,
} from "./middleware/auth";
import type { Bindings } from "./types";
import { FlagsCreateEndpoint } from "./endpoints/flags/create";
import { FlagsDeleteEndpoint } from "./endpoints/flags/delete";
import { FlagsEvaluateEndpoint } from "./endpoints/flags/evaluate";
import { FlagsGetEndpoint } from "./endpoints/flags/get";
import { FlagsListEndpoint } from "./endpoints/flags/list";
import { FlagsToggleEndpoint } from "./endpoints/flags/toggle";
import { FlagsUpdateEndpoint } from "./endpoints/flags/update";

const appMeta: AppMeta = {
	name: pkg.name,
	version: pkg.version,
	description: pkg.description,
};

export const app = new Hono<{ Bindings: Bindings }>();

app.onError((err, c) => {
	if (err instanceof ApiException) {
		return c.json(
			{ success: false, errors: err.buildResponse() },
			err.status as ContentfulStatusCode,
		);
	}

	console.error("Global error handler caught:", err);

	return c.json(
		{
			success: false,
			errors: [{ code: 7000, message: "Internal Server Error" }],
		},
		500,
	);
});

const openapi = fromHono(app, {
	docs_url: "/docs",
	schema: {
		info: getOpenApiInfo(appMeta),
	},
});

app.get("/", (c) => {
	return c.json({ name: appMeta.name, version: appMeta.version });
});

app.get("/healthz", (c) => {
	return c.json({ ok: true });
});

app.get("/docsz", (c) => {
	return c.html(getScalarHtml(appMeta));
});

const evaluateRouter = fromHono(new Hono<{ Bindings: Bindings }>());
evaluateRouter.use("*", evaluateAuthMiddleware());
evaluateRouter.post("/", FlagsEvaluateEndpoint);

const adminRouter = fromHono(new Hono<{ Bindings: Bindings }>());
adminRouter.use("*", authMiddleware(), adminMiddleware());
adminRouter.get("/", FlagsListEndpoint);
adminRouter.get("/:key", FlagsGetEndpoint);
adminRouter.post("/", FlagsCreateEndpoint);
adminRouter.put("/:key", FlagsUpdateEndpoint);
adminRouter.delete("/:key", FlagsDeleteEndpoint);
adminRouter.patch("/:key/toggle", FlagsToggleEndpoint);

openapi.route("/api/flags/evaluate", evaluateRouter);
openapi.route("/api/flags", adminRouter);

export { openapi };
