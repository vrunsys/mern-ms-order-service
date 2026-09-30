import { Router } from "express";
import { Role } from "../constants";
import authenticate from "../middleware/authenticate";
import { canAccess } from "../middleware/canAccess";
import { asyncWrapper } from "../utils/wrapper";
import { CouponController } from "./coupon-controller";
import type { CouponService } from "./coupon-service";
import couponServiceInstance from "./coupon-service";
import {
	couponIdValidator,
	createCouponValidator,
	listCouponsValidator,
	updateCouponValidator,
} from "./coupon-validator";

export const createCouponRouter = (service: CouponService) => {
	const router = Router();
	const controller = new CouponController(service);
	const staff = [authenticate, canAccess([Role.ADMIN, Role.MANAGER])];

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
