import { body, param, query } from "express-validator";

const trimmed = (field: string, label: string) =>
	query(field)
		.optional()
		.isString()
		.trim()
		.notEmpty()
		.withMessage(`${label} cannot be empty`)
		.escape();

export const customerIdentityValidator = [
	trimmed("firstName", "firstName"),
	trimmed("lastName", "lastName"),
	query("email")
		.optional()
		.isString()
		.trim()
		.isEmail()
		.withMessage("email must be a valid email address")
		.normalizeEmail({ gmail_remove_dots: false }),
	query("id")
		.optional()
		.isInt({ min: 1 })
		.withMessage("id must be a positive integer")
		.toInt(),
];

export const addAddressValidator = [
	body("address")
		.isString()
		.trim()
		.notEmpty()
		.withMessage("address is required")
		.isLength({ max: 500 })
		.withMessage("address must be 500 characters or fewer"),
	body("postalCode")
		.isString()
		.trim()
		.notEmpty()
		.withMessage("postalCode is required")
		.isLength({ max: 20 })
		.withMessage("postalCode must be 20 characters or fewer"),
	body("isDefault")
		.optional()
		.isBoolean()
		.withMessage("isDefault must be a boolean")
		.toBoolean(),
];

export const addressIdValidator = [
	param("addressId")
		.isString()
		.trim()
		.isMongoId()
		.withMessage("addressId must be a valid address id"),
];
