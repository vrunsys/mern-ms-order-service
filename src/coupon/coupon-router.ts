import { Router } from "express";
import { Role } from "../constants";
import authenticate from "../middleware/authenticate";
import { canAccess } from "../middleware/canAccess";
import { asyncWrapper } from "../utils/wrapper";
import { CouponController } from "./coupon-controller";
import type { CouponService } from "./coupon-service";
import couponServiceInstance from "./coupon-service";
import {
	applyCouponValidator,
	couponIdValidator,
	createCouponValidator,
	listCouponsValidator,
	updateCouponValidator,
} from "./coupon-validator";

export const createCouponRouter = (service: CouponService) => {
	const router = Router();
	const controller = new CouponController(service);
	const staff = [authenticate, canAccess([Role.ADMIN, Role.MANAGER])];

	// Public: a customer applying a code at checkout has no staff token.
	// Declared before the staff routes so it can never be shadowed.
	router.post(
		"/apply",
		applyCouponValidator,
		asyncWrapper(controller.apply.bind(controller)),
	);

	router.get(
		"/",
		...staff,
		listCouponsValidator,
		asyncWrapper(controller.list.bind(controller)),
	);

	router.post(
		"/",
		...staff,
		createCouponValidator,
		asyncWrapper(controller.create.bind(controller)),
	);

	router.patch(
		"/:id",
		...staff,
		updateCouponValidator,
		asyncWrapper(controller.update.bind(controller)),
	);

	router.delete(
		"/:id",
		...staff,
		couponIdValidator,
		asyncWrapper(controller.remove.bind(controller)),
	);

	return router;
};

export default createCouponRouter(couponServiceInstance);
