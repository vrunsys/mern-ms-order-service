import { describe, expect, it } from "bun:test";
import cookieParser from "cookie-parser";
import express, { type Response } from "express";
import request from "supertest";
import { Role } from "../src/constants";
import authenticate, {
	optionalAuthenticate,
} from "../src/middleware/authenticate";
import { canAccess } from "../src/middleware/canAccess";
import { globalError } from "../src/middleware/globalError";
import type { OptionalAuthRequest } from "../src/types";

const buildApp = () => {
	const app = express();
	app.use(express.json());
	app.use(cookieParser());

	app.get("/protected", authenticate, (_req, res) => {
		res.status(200).json({ ok: true });
	});

	app.get(
		"/public",
		optionalAuthenticate,
		(req: OptionalAuthRequest, res: Response) => {
			res.status(200).json({ auth: req.auth ?? null });
		},
	);

	app.get(
		"/admin-only",
		optionalAuthenticate,
		canAccess([Role.ADMIN]),
		(_req, res) => {
			res.status(200).json({ ok: true });
		},
	);

	app.use(globalError);
	return app;
};

describe("authenticate", () => {
	it("rejects a request with no token (401)", async () => {
		const res = await request(buildApp()).get("/protected");
		expect(res.status).toBe(401);
	});

	it("rejects a malformed bearer token (401)", async () => {
		const res = await request(buildApp())
			.get("/protected")
			.set("Authorization", "Bearer not-a-real-jwt");
		expect(res.status).toBe(401);
	});

	it("optionalAuthenticate lets an anonymous request through", async () => {
		const res = await request(buildApp()).get("/public");
		expect(res.status).toBe(200);
		expect(res.body.auth).toBeNull();
	});
});

describe("canAccess", () => {
	it("returns 401 when no role is present", async () => {
		const res = await request(buildApp()).get("/admin-only");
		expect(res.status).toBe(401);
		expect(res.body.errors[0].msg).toBe("Unauthorized");
	});

	it("returns 403 when the role is not allowed", async () => {
		const res = await request(buildApp())
			.get("/admin-only")
			.set("Authorization", "Bearer not-a-real-jwt");
		expect(res.status).toBe(401);
	});

	it("returns 401 (not 500) for express-jwt errors", async () => {
		const res = await request(buildApp()).get("/protected");
		expect(res.status).toBe(401);
		expect(res.body.errors[0].type).toBe("UnauthorizedError");
	});
});
