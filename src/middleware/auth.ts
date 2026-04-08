import { ApiException } from "chanfana";
import type { MiddlewareHandler } from "hono";
import * as jose from "jose";

export interface AuthTokenPayload {
	sub: string;
	iss?: string;
	aud?: string | string[];
	exp?: number;
	iat?: number;
	role?: string;
	organizationId?: string | null;
	email?: string;
	name?: string;
}

export interface AuthUser {
	id: string;
	email?: string;
	name?: string;
}

interface AuthSvcRpc {
	getJwks(): Promise<{ keys: unknown[] }>;
}

export interface AuthEnv {
	AUTH_SERVICE?: AuthSvcRpc;
	AUTH_JWKS_CACHE_TTL?: string;
}

const DEFAULT_JWKS_CACHE_TTL = 3600;

let cachedJWKS: jose.JSONWebKeySet | null = null;
let cachedJWKSExpiry = 0;

async function getJWKS(
	cacheTtl: number,
	authServiceBinding: AuthSvcRpc,
): Promise<jose.JSONWebKeySet> {
	const now = Date.now();

	if (cachedJWKS && cachedJWKSExpiry > now) {
		return cachedJWKS;
	}

	let jwks: jose.JSONWebKeySet;
	try {
		jwks = (await authServiceBinding.getJwks()) as jose.JSONWebKeySet;
	} catch (e) {
		const err = new Error("Failed to fetch JWKS", { cause: e });
		(err as Error & { statusCode?: number }).statusCode = 503;
		throw err;
	}

	if (!jwks.keys || !Array.isArray(jwks.keys) || jwks.keys.length === 0) {
		const err = new Error("Failed to fetch JWKS: Invalid JWKS: no keys found");
		(err as Error & { statusCode?: number }).statusCode = 503;
		throw err;
	}

	cachedJWKS = jwks;
	cachedJWKSExpiry = now + cacheTtl * 1000;

	return jwks;
}

async function verifyToken(
	token: string,
	cacheTtl: number,
	authServiceBinding: AuthSvcRpc,
	isRetry = false,
): Promise<AuthTokenPayload> {
	const jwks = await getJWKS(cacheTtl, authServiceBinding);
	const jwksInstance = jose.createLocalJWKSet(jwks);

	try {
		const { payload } = await jose.jwtVerify(token, jwksInstance);

		if (!payload.sub) {
			throw new Error("Token missing required 'sub' claim");
		}

		return payload as AuthTokenPayload;
	} catch (error) {
		if (error instanceof jose.errors.JWKSNoMatchingKey && !isRetry) {
			cachedJWKS = null;
			cachedJWKSExpiry = 0;
			return verifyToken(token, cacheTtl, authServiceBinding, true);
		}
		throw error;
	}
}

function extractBearerToken(authHeader: string | undefined): string | null {
	if (!authHeader) {
		return null;
	}

	const parts = authHeader.split(" ");
	if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
		return null;
	}

	return parts[1];
}

export function authMiddleware(): MiddlewareHandler<{
	Bindings: AuthEnv & { ENVIRONMENT?: string };
	Variables: {
		user?: AuthUser;
		tokenPayload?: AuthTokenPayload;
	};
}> {
	return async (c, next) => {
		if (c.env.ENVIRONMENT === "test") {
			c.set("user", { id: "test-user-id", email: "test@example.com" });
			c.set("tokenPayload", {
				sub: "test-user-id",
				role: "admin",
			});
			return next();
		}

		const authHeader = c.req.header("Authorization");
		const token = extractBearerToken(authHeader);

		if (!token) {
			const error = new ApiException("Unauthorized");
			error.status = 401;
			error.code = 401;
			throw error;
		}

		const authServiceBinding = c.env.AUTH_SERVICE;

		if (!authServiceBinding) {
			console.error("AUTH_SERVICE binding is not configured");
			const error = new ApiException("Authentication service not configured");
			error.status = 500;
			error.code = 500;
			throw error;
		}

		const cacheTtl = c.env.AUTH_JWKS_CACHE_TTL
			? parseInt(c.env.AUTH_JWKS_CACHE_TTL, 10)
			: DEFAULT_JWKS_CACHE_TTL;

		try {
			const payload = await verifyToken(token, cacheTtl, authServiceBinding);

			c.set("user", {
				id: payload.sub,
				email: payload.email,
				name: payload.name,
			});
			c.set("tokenPayload", payload);

			return next();
		} catch (error) {
			if (error instanceof jose.errors.JWTExpired) {
				const apiError = new ApiException(
					"The authentication token has expired",
				);
				apiError.status = 401;
				apiError.code = 401;
				throw apiError;
			}

			if (
				error instanceof Error &&
				error.message.includes("Failed to fetch JWKS")
			) {
				const apiError = new ApiException(
					"Authentication service temporarily unavailable",
				);
				apiError.status = 503;
				apiError.code = 503;
				throw apiError;
			}

			const apiError = new ApiException("Invalid authentication token");
			apiError.status = 401;
			apiError.code = 401;
			throw apiError;
		}
	};
}

export function adminMiddleware(): MiddlewareHandler<{
	Bindings: AuthEnv & { ENVIRONMENT?: string };
	Variables: {
		user?: AuthUser;
		tokenPayload?: AuthTokenPayload;
	};
}> {
	return async (c, next) => {
		const tokenPayload = c.get("tokenPayload");

		if (!tokenPayload) {
			const error = new ApiException("Unauthorized");
			error.status = 401;
			error.code = 401;
			throw error;
		}

		if (tokenPayload.role !== "admin") {
			const error = new ApiException("Admin access required");
			error.status = 403;
			error.code = 403;
			throw error;
		}

		return next();
	};
}

/** Allows POST /evaluate with Bearer JWT or matching X-Flags-Internal-Token. */
export function evaluateAuthMiddleware(): MiddlewareHandler<{
	Bindings: AuthEnv & {
		ENVIRONMENT?: string;
		FLAGS_EVALUATE_INTERNAL_TOKEN?: string;
	};
	Variables: {
		user?: AuthUser;
		tokenPayload?: AuthTokenPayload;
	};
}> {
	return async (c, next) => {
		if (c.env.ENVIRONMENT === "test") {
			return next();
		}

		const internal = c.req.header("X-Flags-Internal-Token");
		const secret = c.env.FLAGS_EVALUATE_INTERNAL_TOKEN;
		if (secret && internal === secret) {
			return next();
		}

		return authMiddleware()(c, next);
	};
}
