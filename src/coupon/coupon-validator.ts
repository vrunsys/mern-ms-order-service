import { body, param, query } from "express-validator";

export const couponIdValidator = [
	param("id").isString().trim().isMongoId().withMessage("Invalid coupon id"),
];

export const createCouponValidator = [
	body("title")
		.isString()
		.trim()
		.notEmpty()
		.withMessage("title is required")
		.isLength({ max: 120 })
		.withMessage("title must be 120 characters or fewer")
		.escape(),
	body("code")
		.isString()
		.trim()
		.notEmpty()
		.withMessage("code is required")
		.matches(/^[A-Za-z0-9_-]+$/)
		.withMessage("code may only contain letters, numbers, _ and -")
		.isLength({ min: 3, max: 32 })
		.withMessage("code must be between 3 and 32 characters")
		.customSanitizer((value: string) => value.toUpperCase()),
	body("discount")
		.isFloat({ gt: 0, max: 100 })
		.withMessage("discount must be a percentage between 1 and 100")
		.toFloat(),
	body("validUpto")
		.isISO8601()
		.withMessage("validUpto must be a valid date")
		.toDate(),
	body("tenantId")
		.optional()
		.isInt({ min: 1 })
		.withMessage("tenantId must be a positive integer")
		.toInt(),
];

export const updateCouponValidator = [
	...couponIdValidator,
	body("title")
		.optional()
		.isString()
		.trim()
		.notEmpty()
		.withMessage("title cannot be empty")
		.isLength({ max: 120 })
		.withMessage("title must be 120 characters or fewer")
		.escape(),
	body("code")
		.optional()
		.isString()
		.trim()
		.notEmpty()
		.withMessage("code cannot be empty")
		.matches(/^[A-Za-z0-9_-]+$/)
		.withMessage("code may only contain letters, numbers, _ and -")
		.isLength({ min: 3, max: 32 })
		.withMessage("code must be between 3 and 32 characters")
		.customSanitizer((value: string) => value.toUpperCase()),
	body("discount")
		.optional()
		.isFloat({ gt: 0, max: 100 })
		.withMessage("discount must be a percentage between 1 and 100")
		.toFloat(),
	body("validUpto")
		.optional()
		.isISO8601()
		.withMessage("validUpto must be a valid date")
		.toDate(),
	body("tenantId")
		.optional()
		.isInt({ min: 1 })
		.withMessage("tenantId must be a positive integer")
		.toInt(),
];

export const listCouponsValidator = [
	query("tenantId")
		.optional()
		.isInt({ min: 1 })
		.withMessage("tenantId must be a positive integer")
		.toInt(),
];
