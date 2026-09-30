import type { Request } from "express";
import type { Address, Customer } from "./customer-model";

export interface CustomerIdentity {
	id: number;
	firstName?: string;
	lastName?: string;
	email?: string;
}

export interface CustomerResponse {
	id: number;
	firstName: string;
	lastName: string;
	email: string;
	addresses: Address[];
	createdAt?: Date;
	updatedAt?: Date;
}

export interface AuthedRequest extends Request {
	auth?: { id?: number; role?: string; tenantId?: number | null };
}

export type AddAddressPayload = Omit<Address, "isDefault"> & {
	isDefault?: boolean;
};

export type { Address, Customer };
