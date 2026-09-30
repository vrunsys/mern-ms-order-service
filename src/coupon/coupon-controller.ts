import type { NextFunction, Response } from "express";
import { matchedData, validationResult } from "express-validator";
import createHttpError from "http-errors";
import type { CouponService } from "./coupon-service";
import { resolveTenantScope } from "./coupon-service";
import type {
	ApplyCouponInput,
	AuthedRequest,
	CouponInput,
	CouponUpdate,
} from "./coupon-types";

const requireAuth = (req: AuthedRequest) => {
	const auth = req.auth;

	if (!auth || auth.id === undefined) {
		throw createHttpError(401, "Unauthorized");
	}
	if (auth.role === undefined) {
		throw createHttpError(401, "Unauthorized");
	}

	return auth;
};

export class CouponController {
	constructor(private readonly couponService: CouponService) {}

	/**
	 * POST /coupons/apply
	 *
	 * Public, because a customer applying a code at checkout has no staff
	 * token. The code is only ever looked up inside the tenant being ordered
	 * from, so a code from one restaurant cannot be used at another.
	 */
	async apply(req: AuthedRequest, res: Response, next: NextFunction) {
		const result = validationResult(req);
		if (!result.isEmpty()) {
			next(result.array());
			return;
		}

		const input = matchedData(req) as ApplyCouponInput;
		const applied = await this.couponService.applyCoupon(input);

		res.status(200).json(applied);
	}

	async list(req: AuthedRequest, res: Response, next: NextFunction) {
		const result = validationResult(req);
		if (!result.isEmpty()) {
			next(result.array());
			return;
		}

		const auth = requireAuth(req);
		const { tenantId: requestedTenantId } = matchedData(req) as {
			tenantId?: number;
		};

		const tenantId = resolveTenantScope(auth, requestedTenantId);
		const coupons = await this.couponService.list(tenantId);

		res.status(200).json({ coupons });
	}

	async create(req: AuthedRequest, res: Response, next: NextFunction) {
		const result = validationResult(req);
		if (!result.isEmpty()) {
			next(result.array());
			return;
		}

		const auth = requireAuth(req);
		const { tenantId: requestedTenantId, ...rest } = matchedData(req) as {
			tenantId?: number;
		} & Omit<CouponInput, "tenantId">;

		const input: CouponInput = {
			...rest,
			tenantId: resolveTenantScope(auth, requestedTenantId),
		};

		const coupon = await this.couponService.create(input);
		res.status(201).json(coupon);
	}

	async update(req: AuthedRequest, res: Response, next: NextFunction) {
		const result = validationResult(req);
		if (!result.isEmpty()) {
			next(result.array());
			return;
		}

		const auth = requireAuth(req);
		const {
			id,
			tenantId: requestedTenantId,
			...rest
		} = matchedData(req) as {
			id?: string;
			tenantId?: number;
		} & CouponUpdate;

		const tenantId = resolveTenantScope(auth, requestedTenantId);

		if (typeof id !== "string") {
			next(createHttpError(400, "Invalid coupon id"));
			return;
		}

		const coupon = await this.couponService.update(id, rest, tenantId);
		res.status(200).json(coupon);
	}

	async remove(req: AuthedRequest, res: Response, next: NextFunction) {
		const result = validationResult(req);
		if (!result.isEmpty()) {
			next(result.array());
			return;
		}

		const auth = requireAuth(req);
		const { tenantId: requestedTenantId } = matchedData(req) as {
			tenantId?: number;
		};

		const tenantId = resolveTenantScope(auth, requestedTenantId);
		const id = String(req.params.id);

		const coupon = await this.couponService.remove(id, tenantId);
		res.status(200).json(coupon);
	}
}
