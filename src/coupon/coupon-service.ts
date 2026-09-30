import createHttpError from "http-errors";
import logger from "../config/logger";
import { Role } from "../constants";
import Coupon from "./coupon-model";
import type { CouponInput, CouponResponse, CouponUpdate } from "./coupon-types";

type AuthContext = { role?: string; tenantId?: number | null };

/**
 * Decides which tenant a request may act on.
 *
 * A manager is always pinned to their own tenant and any tenantId in the
 * request is ignored. An admin may target another tenant, falling back to their
 * own when they do not specify one.
 */
export const resolveTenantScope = (
	auth: AuthContext,
	requestedTenantId?: number,
): number => {
	const own = auth.tenantId;

	if (auth.role === Role.MANAGER) {
		if (own === null || own === undefined) {
			throw createHttpError(403, "Your account is not linked to a tenant");
		}
		return own;
	}

	if (requestedTenantId !== undefined) {
		return requestedTenantId;
	}

	if (own === null || own === undefined) {
		throw createHttpError(403, "tenantId is required");
	}

	return own;
};

const toResponse = (coupon: {
	_id: unknown;
	title: string;
	code: string;
	discount: number;
	validUpto: Date;
	tenantId: number;
	createdAt?: Date;
	updatedAt?: Date;
}): CouponResponse => ({
	_id: String(coupon._id),
	title: coupon.title,
	code: coupon.code,
	discount: coupon.discount,
	validUpto: coupon.validUpto,
	tenantId: coupon.tenantId,
	createdAt: coupon.createdAt,
	updatedAt: coupon.updatedAt,
});

const isDuplicateCodeError = (err: unknown): boolean =>
	typeof err === "object" &&
	err !== null &&
	(err as { code?: number }).code === 11000;

export class CouponService {
	async list(tenantId: number): Promise<CouponResponse[]> {
		const coupons = await Coupon.find({ tenantId })
			.sort({ createdAt: -1 })
			.lean();

		return coupons.map((coupon) => toResponse(coupon));
	}

	async create(input: CouponInput): Promise<CouponResponse> {
		try {
			const created = await Coupon.create(input);
			logger.info("Coupon created", {
				code: created.code,
				tenantId: created.tenantId,
			});
			return toResponse(created.toObject());
		} catch (err) {
			if (isDuplicateCodeError(err)) {
				throw createHttpError(
					409,
					`Coupon code "${input.code}" already exists for this tenant`,
				);
			}
			throw err;
		}
	}

	async update(
		id: string,
		input: CouponUpdate,
		tenantId: number,
	): Promise<CouponResponse> {
		const updated = await Coupon.findOneAndUpdate(
			{ _id: id, tenantId },
			{ $set: { ...input, tenantId } },
			{ new: true },
		).lean();

		if (!updated) {
			throw createHttpError(404, "Coupon not found");
		}

		logger.info("Coupon updated", { code: updated.code, tenantId });
		return toResponse(updated);
	}

	async remove(id: string, tenantId: number): Promise<CouponResponse> {
		const removed = await Coupon.findOneAndDelete({ _id: id, tenantId }).lean();

		if (!removed) {
			throw createHttpError(404, "Coupon not found");
		}

		logger.info("Coupon deleted", { code: removed.code, tenantId });
		return toResponse(removed);
	}
}

export { toResponse };
export default new CouponService();
