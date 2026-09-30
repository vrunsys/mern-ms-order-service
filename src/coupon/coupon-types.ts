import type { Request } from "express";

export interface AuthedRequest extends Request {
	auth?: { id?: number; role?: string; tenantId?: number | null };
}

export interface CouponInput {
	title: string;
	code: string;
	discount: number;
	validUpto: Date;
	tenantId: number;
}

export type CouponUpdate = Partial<Omit<CouponInput, "tenantId">> & {
	tenantId?: number;
};

export interface CouponResponse extends CouponInput {
	_id: string;
	createdAt?: Date;
	updatedAt?: Date;
}
