import createHttpError from "http-errors";
import mongoose from "mongoose";
import logger from "../config/logger";
import Customer from "./customer-model";
import type {
	Address,
	CustomerIdentity,
	CustomerResponse,
} from "./customer-types";

type LeanCustomer = {
	id: number;
	firstName: string;
	lastName: string;
	email: string;
	addresses: Address[];
	createdAt?: Date;
	updatedAt?: Date;
};

export const applyDefaultRule = (
	existing: Address[],
	incoming: Address,
): Address[] => {
	const existingDefault = existing.find((address) => address.isDefault) ?? null;

	const incomingBecomesDefault =
		existing.length === 0 ||
		incoming.isDefault === true ||
		existingDefault === null;

	return [
		...existing.map((address) => ({
			...address,
			isDefault: incomingBecomesDefault ? false : address === existingDefault,
		})),
		{ ...incoming, isDefault: incomingBecomesDefault },
	];
};

const toResponse = (customer: LeanCustomer): CustomerResponse => ({
	id: customer.id,
	firstName: customer.firstName,
	lastName: customer.lastName,
	email: customer.email,
	addresses: customer.addresses ?? [],
	createdAt: customer.createdAt,
	updatedAt: customer.updatedAt,
});

const isDuplicateKeyError = (err: unknown): boolean =>
	typeof err === "object" &&
	err !== null &&
	(err as { code?: number }).code === 11000;

export class CustomerService {
	async getOrCreate(identity: CustomerIdentity): Promise<{
		customer: CustomerResponse;
		created: boolean;
	}> {
		const byId = await Customer.findOne({ id: identity.id }).lean();
		if (byId) {
			return { customer: toResponse(byId as LeanCustomer), created: false };
		}

		if (identity.email) {
			const byEmail = await Customer.findOne({
				email: identity.email.toLowerCase(),
			}).lean();
			if (byEmail) {
				return {
					customer: toResponse(byEmail as LeanCustomer),
					created: false,
				};
			}
		}

		if (!identity.firstName || !identity.lastName || !identity.email) {
			throw createHttpError(
				422,
				"firstName, lastName and email are required to create a customer",
			);
		}

		try {
			const created = await Customer.create({
				id: identity.id,
				firstName: identity.firstName,
				lastName: identity.lastName,
				email: identity.email,
				addresses: [],
			});

			return {
				customer: toResponse(created.toObject() as LeanCustomer),
				created: true,
			};
		} catch (err) {
			if (isDuplicateKeyError(err)) {
				const winner = await Customer.findOne({
					$or: [{ id: identity.id }, { email: identity.email?.toLowerCase() }],
				}).lean();
				if (winner) {
					return {
						customer: toResponse(winner as LeanCustomer),
						created: false,
					};
				}
			}
			throw err;
		}
	}

	async addAddress(
		customerId: number,
		incoming: Address,
	): Promise<CustomerResponse> {
		const customer = await Customer.findOne({ id: customerId });
		if (!customer) {
			throw createHttpError(404, "Customer not found");
		}

		customer.addresses = applyDefaultRule(
			(customer.addresses ?? []) as Address[],
			incoming,
		);
		await customer.save();

		logger.info("Address added to customer", {
			customerId,
			isDefault: customer.addresses.at(-1)?.isDefault,
		});

		return toResponse(customer.toObject() as LeanCustomer);
	}
	async setDefaultAddress(
		customerId: number,
		addressId: string,
	): Promise<CustomerResponse> {
		if (!mongoose.isValidObjectId(addressId)) {
			throw createHttpError(400, "Invalid address id");
		}

		const customer = await Customer.findOne({ id: customerId });
		if (!customer) {
			throw createHttpError(404, "Customer not found");
		}

		const addresses =
			customer.addresses as unknown as mongoose.Types.DocumentArray<
				Address & { _id: mongoose.Types.ObjectId }
			>;

		if (!addresses.id(addressId)) {
			throw createHttpError(404, "Address not found");
		}

		for (const entry of addresses) {
			entry.set("isDefault", entry._id.toString() === addressId);
		}
		await customer.save();

		logger.info("Default address changed", { customerId, addressId });

		return toResponse(customer.toObject() as LeanCustomer);
	}
}

export { toResponse };
export default new CustomerService();
