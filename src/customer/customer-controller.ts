import type { NextFunction, Response } from "express";
import { matchedData, validationResult } from "express-validator";
import createHttpError from "http-errors";
import logger from "../config/logger";
import type { CustomerService } from "./customer-service";
import type {
	Address,
	AuthedRequest,
	CustomerIdentity,
} from "./customer-types";

export class CustomerController {
	constructor(private readonly customerService: CustomerService) {}

	async getCustomer(
		req: AuthedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		const result = validationResult(req);
		if (!result.isEmpty()) {
			next(result.array());
			return;
		}

		const authId = req.auth?.id;
		if (authId === undefined) {
			next(createHttpError(401, "Unauthorized"));
			return;
		}

		const { firstName, lastName, email } = matchedData(req) as CustomerIdentity;

		const { customer, created } = await this.customerService.getOrCreate({
			id: authId,
			firstName,
			lastName,
			email,
		});

		logger.info(created ? "Customer created" : "Customer fetched", {
			id: customer.id,
		});

		res.status(created ? 201 : 200).json(customer);
	}

	async addAddress(
		req: AuthedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		const result = validationResult(req);
		if (!result.isEmpty()) {
			next(result.array());
			return;
		}

		const authId = req.auth?.id;
		if (authId === undefined) {
			next(createHttpError(401, "Unauthorized"));
			return;
		}

		const { isDefault, ...rest } = matchedData(req) as Address;
		const address: Address = { ...rest, isDefault: isDefault === true };

		const customer = await this.customerService.addAddress(authId, address);
		res.status(201).json(customer);
	}

	async setDefaultAddress(
		req: AuthedRequest,
		res: Response,
		next: NextFunction,
	): Promise<void> {
		const result = validationResult(req);
		if (!result.isEmpty()) {
			next(result.array());
			return;
		}

		const authId = req.auth?.id;
		if (authId === undefined) {
			next(createHttpError(401, "Unauthorized"));
			return;
		}

		const { addressId } = req.params;
		if (typeof addressId !== "string") {
			next(createHttpError(400, "Invalid address id"));
			return;
		}

		const customer = await this.customerService.setDefaultAddress(
			authId,
			addressId,
		);

		res.status(200).json(customer);
	}
}
