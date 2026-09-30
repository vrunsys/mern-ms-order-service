import { beforeEach, describe, expect, it, mock } from "bun:test";
import cookieParser from "cookie-parser";
import express from "express";
import createHttpError from "http-errors";
import request from "supertest";
import { Role } from "../src/constants";
import { CouponController } from "../src/coupon/coupon-controller";
import type { CouponService } from "../src/coupon/coupon-service";
import {
	calculateDiscount,
	resolveTenantScope,
} from "../src/coupon/coupon-service";
import type {
	ApplyCouponInput,
	CouponInput,
	CouponResponse,
	CouponUpdate,
} from "../src/coupon/coupon-types";
import {
	applyCouponValidator,
	createCouponValidator,
	listCouponsValidator,
	updateCouponValidator,
} from "../src/coupon/coupon-validator";
import { globalError } from "../src/middleware/globalError";
import { asyncWrapper } from "../src/utils/wrapper";

type Auth = { id?: number; role?: string; tenantId?: number | null };

const VALID_ID = "65f1c2a4e1b2c3d4e5f60718";
const OTHER_ID = "65f1c2a4e1b2c3d4e5f60719";

const couponResponse = (
	over: Partial<CouponResponse> = {},
): CouponResponse => ({
	_id: VALID_ID,
	title: "Ten percent off",
	code: "ENJOY_10",
	discount: 10,
	validUpto: new Date("2030-01-31T00:00:00.000Z"),
	tenantId: 7,
	...over,
});

const buildApp = (service: Partial<CouponService>, auth: Auth | null) => {
	const app = express();
	app.use(express.json());
	app.use(cookieParser());

	app.use((req, _res, next) => {
		if (auth) {
			(req as { auth?: Auth }).auth = auth;
		}
		next();
	});

	const controller = new CouponController(service as CouponService);

	app.post(
		"/apply",
		applyCouponValidator,
		asyncWrapper(controller.apply.bind(controller)),
	);
	app.get(
		"/",
		listCouponsValidator,
		asyncWrapper(controller.list.bind(controller)),
	);
	app.post(
		"/",
		createCouponValidator,
		asyncWrapper(controller.create.bind(controller)),
	);
	app.patch(
		"/:id",
		updateCouponValidator,
		asyncWrapper(controller.update.bind(controller)),
	);
	app.delete("/:id", asyncWrapper(controller.remove.bind(controller)));
	app.use(globalError);
	return app;
};

const MANAGER: Auth = { id: 1, role: Role.MANAGER, tenantId: 7 };
const ADMIN: Auth = { id: 2, role: Role.ADMIN, tenantId: 7 };

const validBody = {
	title: "Ten percent off",
	code: "ENJOY_10",
	discount: 10,
	validUpto: "2030-01-31T00:00:00.000Z",
};

describe("resolveTenantScope", () => {
	it("pins a manager to their own tenant and ignores a requested one", () => {
		expect(resolveTenantScope({ role: Role.MANAGER, tenantId: 7 }, 99)).toBe(7);
	});

	it("rejects a manager with no tenant", () => {
		expect(() =>
			resolveTenantScope({ role: Role.MANAGER, tenantId: null }),
		).toThrow();
	});

	it("lets an admin target another tenant", () => {
		expect(resolveTenantScope({ role: Role.ADMIN, tenantId: 7 }, 42)).toBe(42);
	});

	it("falls back to the admin's own tenant", () => {
		expect(resolveTenantScope({ role: Role.ADMIN, tenantId: 7 })).toBe(7);
	});
});

describe("POST /coupons", () => {
	it("creates a coupon scoped to the manager's own tenant", async () => {
		const create = mock(async (_input: CouponInput) => couponResponse());
		const res = await request(buildApp({ create }, MANAGER))
			.post("/")
			.send({ ...validBody, tenantId: 99 });

		expect(res.status).toBe(201);
		expect(create.mock.calls[0]?.[0].tenantId).toBe(7);
	});

	it("lets an admin create for another tenant", async () => {
		const create = mock(async (_input: CouponInput) => couponResponse());
		await request(buildApp({ create }, ADMIN))
			.post("/")
			.send({ ...validBody, tenantId: 42 });

		expect(create.mock.calls[0]?.[0].tenantId).toBe(42);
	});

	it("uppercases the code", async () => {
		const create = mock(async (_input: CouponInput) => couponResponse());
		await request(buildApp({ create }, MANAGER))
			.post("/")
			.send({ ...validBody, code: "enjoy_10" });

		expect(create.mock.calls[0]?.[0].code).toBe("ENJOY_10");
	});

	it("rejects a discount above 100", async () => {
		const create = mock(async (_input: CouponInput) => couponResponse());
		const res = await request(buildApp({ create }, MANAGER))
			.post("/")
			.send({ ...validBody, discount: 150 });

		expect(res.status).toBe(400);
		expect(create).not.toHaveBeenCalled();
	});

	it("rejects a discount of 0", async () => {
		const create = mock(async (_input: CouponInput) => couponResponse());
		const res = await request(buildApp({ create }, MANAGER))
			.post("/")
			.send({ ...validBody, discount: 0 });

		expect(res.status).toBe(400);
	});

	it("rejects a code with illegal characters", async () => {
		const create = mock(async (_input: CouponInput) => couponResponse());
		const res = await request(buildApp({ create }, MANAGER))
			.post("/")
			.send({ ...validBody, code: "50% off!" });

		expect(res.status).toBe(400);
	});

	it("rejects a missing title", async () => {
		const create = mock(async (_input: CouponInput) => couponResponse());
		const { title: _title, ...withoutTitle } = validBody;
		const res = await request(buildApp({ create }, MANAGER))
			.post("/")
			.send(withoutTitle);

		expect(res.status).toBe(400);
	});

	it("rejects an invalid validUpto", async () => {
		const create = mock(async (_input: CouponInput) => couponResponse());
		const res = await request(buildApp({ create }, MANAGER))
			.post("/")
			.send({ ...validBody, validUpto: "not-a-date" });

		expect(res.status).toBe(400);
	});

	it("returns 401 without an auth context", async () => {
		const create = mock(async (_input: CouponInput) => couponResponse());
		const res = await request(buildApp({ create }, null))
			.post("/")
			.send(validBody);

		expect(res.status).toBe(401);
		expect(create).not.toHaveBeenCalled();
	});
});

describe("calculateDiscount", () => {
	it("takes a percentage off the subtotal", () => {
		expect(calculateDiscount(1000, 10)).toEqual({
			discountAmount: 100,
			discountedSubtotal: 900,
		});
	});

	it("rounds to two decimals", () => {
		expect(calculateDiscount(333, 15)).toEqual({
			discountAmount: 49.95,
			discountedSubtotal: 283.05,
		});
	});

	it("never produces a negative subtotal on a 100% coupon", () => {
		expect(calculateDiscount(250, 100)).toEqual({
			discountAmount: 250,
			discountedSubtotal: 0,
		});
	});

	it("clamps a percentage above 100 rather than going negative", () => {
		expect(calculateDiscount(200, 150)).toEqual({
			discountAmount: 200,
			discountedSubtotal: 0,
		});
	});
});

describe("POST /coupons/apply", () => {
	const applyCoupon = () =>
		mock(async (_input: ApplyCouponInput) => ({
			code: "ENJOY_10",
			title: "Ten percent off",
			discount: 10,
			discountAmount: 100,
			discountedSubtotal: 900,
		}));

	it("works without any auth context", async () => {
		const service = applyCoupon();
		const res = await request(buildApp({ applyCoupon: service }, null))
			.post("/apply")
			.send({ code: "ENJOY_10", tenantId: 7, subtotal: 1000 });

		expect(res.status).toBe(200);
		expect(res.body.discountedSubtotal).toBe(900);
		expect(service.mock.calls[0]?.[0].tenantId).toBe(7);
	});

	it("uppercases the code before sending it", async () => {
		const service = applyCoupon();
		await request(buildApp({ applyCoupon: service }, null))
			.post("/apply")
			.send({ code: "enjoy_10", tenantId: 7, subtotal: 1000 });

		expect(service.mock.calls[0]?.[0].code).toBe("ENJOY_10");
	});

	it("rejects a missing subtotal", async () => {
		const service = applyCoupon();
		const res = await request(buildApp({ applyCoupon: service }, null))
			.post("/apply")
			.send({ code: "ENJOY_10", tenantId: 7 });

		expect(res.status).toBe(400);
		expect(service).not.toHaveBeenCalled();
	});

	it("rejects a subtotal of zero", async () => {
		const service = applyCoupon();
		const res = await request(buildApp({ applyCoupon: service }, null))
			.post("/apply")
			.send({ code: "ENJOY_10", tenantId: 7, subtotal: 0 });

		expect(res.status).toBe(400);
	});

	it("surfaces a 404 for a code that is not valid", async () => {
		const service = mock(async (_input: ApplyCouponInput) => {
			throw createHttpError(404, "That coupon code is not valid");
		});
		const res = await request(buildApp({ applyCoupon: service }, null))
			.post("/apply")
			.send({ code: "NOPE", tenantId: 7, subtotal: 1000 });

		expect(res.status).toBe(404);
		expect(res.body.errors[0].msg).toBe("That coupon code is not valid");
	});
});

describe("GET /coupons", () => {
	let list: ReturnType<
		typeof mock<(_tenantId: number) => Promise<CouponResponse[]>>
	>;

	beforeEach(() => {
		list = mock(async (_tenantId: number): Promise<CouponResponse[]> => []);
	});

	it("lists only the manager's own tenant", async () => {
		await request(buildApp({ list }, MANAGER)).get("/").query({ tenantId: 99 });

		expect(list).toHaveBeenCalledWith(7);
	});

	it("lets an admin list another tenant", async () => {
		await request(buildApp({ list }, ADMIN)).get("/").query({ tenantId: 42 });

		expect(list).toHaveBeenCalledWith(42);
	});

	it("returns 401 without an auth context", async () => {
		const res = await request(buildApp({ list }, null)).get("/");
		expect(res.status).toBe(401);
	});
});

describe("PATCH /coupons/:id", () => {
	const update = () =>
		mock(async (_id: string, _input: CouponUpdate, _tenantId: number) =>
			couponResponse(),
		);

	it("scopes the update to the caller's tenant", async () => {
		const service = update();
		await request(buildApp({ update: service }, MANAGER))
			.patch(`/${VALID_ID}`)
			.send({ discount: 20 });

		expect(service).toHaveBeenCalledWith(VALID_ID, { discount: 20 }, 7);
	});

	it("does not let the url param leak into the update document", async () => {
		const service = update();
		await request(buildApp({ update: service }, MANAGER))
			.patch(`/${VALID_ID}`)
			.send({ discount: 20 });

		expect(service.mock.calls[0]?.[1]).not.toHaveProperty("id");
	});

	it("rejects a malformed id", async () => {
		const service = update();
		const res = await request(buildApp({ update: service }, MANAGER))
			.patch("/not-an-id")
			.send({ discount: 20 });

		expect(res.status).toBe(400);
		expect(service).not.toHaveBeenCalled();
	});

	it("ignores a spoofed tenantId from a manager", async () => {
		const service = update();
		await request(buildApp({ update: service }, MANAGER))
			.patch(`/${VALID_ID}`)
			.send({ discount: 20, tenantId: 99 });

		expect(service.mock.calls[0]?.[2]).toBe(7);
	});
});

describe("DELETE /coupons/:id", () => {
	const remove = () =>
		mock(async (_id: string, _tenantId: number) => couponResponse());

	it("scopes the delete to the caller's tenant", async () => {
		const service = remove();
		const res = await request(buildApp({ remove: service }, MANAGER)).delete(
			`/${VALID_ID}`,
		);

		expect(res.status).toBe(200);
		expect(service).toHaveBeenCalledWith(VALID_ID, 7);
	});

	it("surfaces a 404 when the coupon belongs to another tenant", async () => {
		const service = mock(async (_id: string, _tenantId: number) => {
			throw createHttpError(404, "Coupon not found");
		});
		const res = await request(buildApp({ remove: service }, MANAGER)).delete(
			`/${OTHER_ID}`,
		);

		expect(res.status).toBe(404);
		expect(res.body.errors[0].msg).toBe("Coupon not found");
	});
});
