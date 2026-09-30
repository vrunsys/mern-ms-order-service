import { describe, expect, it } from "bun:test";
import express from "express";
import createHttpError from "http-errors";
import request from "supertest";
import { globalError } from "../src/middleware/globalError";
import { asyncWrapper } from "../src/utils/wrapper";

const buildApp = () => {
	const app = express();
	app.use(express.json());

	app.get(
		"/ok",
		asyncWrapper(async (_req, res) => {
			await Promise.resolve();
			res.status(200).json({ ok: true });
		}),
	);

	// Rejects with a typed HTTP error -> status and message must survive
	app.get(
		"/http-error",
		asyncWrapper(async () => {
			await Promise.resolve();
			throw createHttpError(404, "Order not found");
		}),
	);

	// Rejects with a non-HTTP error -> must be masked as a 500
	app.get(
		"/unknown-error",
		asyncWrapper(async () => {
			await Promise.resolve();
			throw new Error("database exploded: password=hunter2");
		}),
	);

	// Synchronous throw inside an async handler
	app.get(
		"/sync-throw",
		asyncWrapper(async () => {
			throw createHttpError(400, "Invalid order id");
		}),
	);

	// next(err) with an express-validator style array -> 400
	app.get(
		"/validation",
		asyncWrapper(async (_req, _res, next) => {
			next([
				{
					type: "field",
					msg: "quantity must be positive",
					path: "quantity",
					location: "body",
				},
			]);
		}),
	);

	app.use(globalError);
	return app;
};

describe("asyncWrapper", () => {
	it("resolves a successful handler without interfering", async () => {
		const res = await request(buildApp()).get("/ok");
		expect(res.status).toBe(200);
		expect(res.body).toEqual({ ok: true });
	});

	it("forwards a thrown HttpError with its original status", async () => {
		const res = await request(buildApp()).get("/http-error");
		expect(res.status).toBe(404);
		expect(res.body.errors[0].type).toBe("NotFoundError");
		expect(res.body.errors[0].msg).toBe("Order not found");
		expect(res.body.errors[0].ref).toBeString();
	});

	it("masks a non-HttpError rejection as a 500 and hides internals", async () => {
		const res = await request(buildApp()).get("/unknown-error");
		expect(res.status).toBe(500);
		expect(res.body.errors[0].msg).toBe("Internal Server Error");
		// the raw error message must never reach the client
		expect(JSON.stringify(res.body)).not.toContain("hunter2");
	});

	it("catches a synchronous throw inside an async handler", async () => {
		const res = await request(buildApp()).get("/sync-throw");
		expect(res.status).toBe(400);
		expect(res.body.errors[0].msg).toBe("Invalid order id");
	});

	it("renders a validation error array as 400", async () => {
		const res = await request(buildApp()).get("/validation");
		expect(res.status).toBe(400);
		expect(res.body.errors[0].type).toBe("ValidationError");
		expect(res.body.errors[0].field).toBe("quantity");
	});
});
