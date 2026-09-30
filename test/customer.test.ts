import { beforeEach, describe, expect, it, mock } from "bun:test";
import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { CustomerController } from "../src/customer/customer-controller";
import type { CustomerService } from "../src/customer/customer-service";
import { applyDefaultRule } from "../src/customer/customer-service";
import type { Address, CustomerIdentity } from "../src/customer/customer-types";
import {
	addAddressValidator,
	customerIdentityValidator,
} from "../src/customer/customer-validator";
import { globalError } from "../src/middleware/globalError";
import { asyncWrapper } from "../src/utils/wrapper";

const address = (over: Partial<Address> = {}): Address => ({
	address: "12 MG Road, Bengaluru",
	postalCode: "560001",
	isDefault: false,
	...over,
});

describe("applyDefaultRule", () => {
	it("promotes the very first address to default even when isDefault is false", () => {
		const result = applyDefaultRule([], address());
		expect(result).toHaveLength(1);
		expect(result[0]?.isDefault).toBe(true);
	});

	it("promotes an incoming address and demotes the previous default", () => {
		const existing = [address({ address: "Home", isDefault: true })];
		const result = applyDefaultRule(
			existing,
			address({ address: "Office", isDefault: true }),
		);

		expect(result).toHaveLength(2);
		expect(result.filter((a) => a.isDefault)).toHaveLength(1);
		expect(result[0]?.isDefault).toBe(false);
		expect(result[1]?.isDefault).toBe(true);
	});

	it("leaves the existing default alone when the new one is not default", () => {
		const existing = [address({ address: "Home", isDefault: true })];
		const result = applyDefaultRule(existing, address({ address: "Office" }));

		expect(result.filter((a) => a.isDefault)).toHaveLength(1);
		expect(result[0]?.isDefault).toBe(true);
		expect(result[1]?.isDefault).toBe(false);
	});

	it("never leaves more than one default even if a stale flag is present", () => {
		const existing = [
			address({ address: "A", isDefault: true }),
			address({ address: "B", isDefault: true }),
		];
		const result = applyDefaultRule(existing, address({ address: "C" }));
		expect(result.filter((a) => a.isDefault)).toHaveLength(1);
	});
});

type FakeCustomer = {
	id: number;
	firstName: string;
	lastName: string;
	email: string;
	addresses: Address[];
};

const buildApp = (
	service: Partial<CustomerService>,
	auth: { id?: number } | null,
) => {
	const app = express();
	app.use(express.json());
	app.use(cookieParser());

	app.use((req, _res, next) => {
		if (auth) {
			(req as { auth?: { id?: number } }).auth = auth;
		}
		next();
	});

	const controller = new CustomerController(service as CustomerService);

	app.get(
		"/",
		customerIdentityValidator,
		asyncWrapper(controller.getCustomer.bind(controller)),
	);
	app.post(
		"/addresses",
		addAddressValidator,
		asyncWrapper(controller.addAddress.bind(controller)),
	);
	app.use(globalError);
	return app;
};

const existingCustomer: FakeCustomer = {
	id: 7,
	firstName: "Asha",
	lastName: "Rao",
	email: "asha@example.com",
	addresses: [],
};

describe("GET /customers", () => {
	it("returns 201 and creates the customer on first call", async () => {
		const service = {
			getOrCreate: mock(async () => ({
				customer: existingCustomer,
				created: true,
			})),
		};

		const res = await request(buildApp(service, { id: 7 }))
			.get("/")
			.query({ firstName: "Asha", lastName: "Rao", email: "asha@example.com" });

		expect(res.status).toBe(201);
		expect(res.body.id).toBe(7);
		expect(res.body.email).toBe("asha@example.com");
	});

	it("returns 200 for an already-known customer", async () => {
		const service = {
			getOrCreate: mock(async () => ({
				customer: existingCustomer,
				created: false,
			})),
		};

		const res = await request(buildApp(service, { id: 7 })).get("/");
		expect(res.status).toBe(200);
		expect(res.body.id).toBe(7);
	});

	it("uses the token id and ignores any id sent by the client", async () => {
		const getOrCreate = mock(async (_identity: CustomerIdentity) => ({
			customer: existingCustomer,
			created: false,
		}));
		const service = { getOrCreate };

		await request(buildApp(service, { id: 7 }))
			.get("/")
			.query({
				id: "999",
				firstName: "Asha",
				lastName: "Rao",
				email: "a@b.com",
			});

		expect(getOrCreate.mock.calls[0]?.[0].id).toBe(7);
	});

	it("returns 401 when there is no token identity", async () => {
		const service = {
			getOrCreate: mock(async () => ({
				customer: existingCustomer,
				created: false,
			})),
		};
		const res = await request(buildApp(service, null)).get("/");
		expect(res.status).toBe(401);
	});

	it("returns 400 when the email is malformed", async () => {
		const service = {
			getOrCreate: mock(async () => ({
				customer: existingCustomer,
				created: false,
			})),
		};
		const res = await request(buildApp(service, { id: 7 }))
			.get("/")
			.query({ email: "not-an-email" });

		expect(res.status).toBe(400);
		expect(res.body.errors[0].type).toBe("ValidationError");
	});
});

describe("POST /customers/addresses", () => {
	let addAddress: ReturnType<typeof mock>;

	beforeEach(() => {
		addAddress = mock(async () => existingCustomer);
	});

	it("adds an address and returns the updated customer", async () => {
		const service = { addAddress };
		const res = await request(buildApp(service, { id: 7 }))
			.post("/addresses")
			.send({ address: "12 MG Road, Bengaluru", postalCode: "560001" });

		expect(res.status).toBe(201);
		expect(addAddress).toHaveBeenCalledTimes(1);
	});

	it("accepts a multi-line address block", async () => {
		const service = { addAddress };
		const block = "12 MG Road\nNear Trinity\nBengaluru";
		const res = await request(buildApp(service, { id: 7 }))
			.post("/addresses")
			.send({ address: block, postalCode: "560001" });

		expect(res.status).toBe(201);
		const [, sent] = addAddress.mock.calls[0] as [number, Address];
		expect(sent.address).toBe(block);
	});

	it("coerces isDefault from a string to a boolean", async () => {
		const service = { addAddress };
		await request(buildApp(service, { id: 7 }))
			.post("/addresses")
			.send({
				address: "1 Brigade Rd, Bengaluru",
				postalCode: "560025",
				isDefault: "true",
			});

		const [, sent] = addAddress.mock.calls[0] as [number, Address];
		expect(sent.isDefault).toBe(true);
	});

	it("defaults isDefault to false when omitted", async () => {
		const service = { addAddress };
		await request(buildApp(service, { id: 7 }))
			.post("/addresses")
			.send({ address: "12 MG Road, Bengaluru", postalCode: "560001" });

		const [, sent] = addAddress.mock.calls[0] as [number, Address];
		expect(sent.isDefault).toBe(false);
	});

	it("returns 400 when required address fields are missing", async () => {
		const service = { addAddress };
		const res = await request(buildApp(service, { id: 7 }))
			.post("/addresses")
			.send({ address: "12 MG Road" });

		expect(res.status).toBe(400);
		expect(res.body.errors[0].type).toBe("ValidationError");
		expect(addAddress).not.toHaveBeenCalled();
	});

	it("returns 401 without a token identity", async () => {
		const service = { addAddress };
		const res = await request(buildApp(service, null))
			.post("/addresses")
			.send({ address: "12 MG Road, Bengaluru", postalCode: "560001" });

		expect(res.status).toBe(401);
		expect(addAddress).not.toHaveBeenCalled();
	});
});
