import { describe, expect, it } from "bun:test";
import request from "supertest";
import app from "../src/app";

const ALLOWED_ORIGIN = "http://localhost:5173";

describe("CORS", () => {
	it("allows a configured origin", async () => {
		const res = await request(app).get("/health").set("Origin", ALLOWED_ORIGIN);

		expect(res.status).toBe(200);
		expect(res.headers["access-control-allow-origin"]).toBe(ALLOWED_ORIGIN);
		expect(res.headers["access-control-allow-credentials"]).toBe("true");
	});

	it("does not echo an origin that is not in the allow list", async () => {
		const res = await request(app)
			.get("/health")
			.set("Origin", "http://evil.example.com");

		expect(res.status).toBe(200);
		expect(res.headers["access-control-allow-origin"]).toBeUndefined();
	});

	it("answers a preflight request for the addresses route", async () => {
		const res = await request(app)
			.options("/customers/addresses")
			.set("Origin", ALLOWED_ORIGIN)
			.set("Access-Control-Request-Method", "POST")
			.set("Access-Control-Request-Headers", "content-type");

		expect(res.status).toBeLessThan(300);
		expect(res.headers["access-control-allow-origin"]).toBe(ALLOWED_ORIGIN);
		expect(res.headers["access-control-allow-credentials"]).toBe("true");
	});
});
