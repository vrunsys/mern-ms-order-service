import type { NextFunction, Request, Response } from "express";
import { isHttpError } from "http-errors";
import { v4 as uuidv4 } from "uuid";
import logger from "../config/logger";

interface ValidationErrorItem {
	type: string;
	msg: string;
	path: string;
	location: string;
}

export const globalError = (
	err: unknown,
	req: Request,
	res: Response,
	// _next is required to preserve the 4-arg Express error handler signature
	_next: NextFunction,
) => {
	const errorId = uuidv4();
	const isProduction = process.env.NODE_ENV === "production";

	// Validation errors array from express-validator
	if (Array.isArray(err)) {
		const validationErrors = err as ValidationErrorItem[];
		logger.warn("Validation failed", {
			id: errorId,
			path: req.path,
			method: req.method,
			errors: validationErrors,
		});

		return res.status(400).json({
			errors: validationErrors.map((e) => ({
				ref: errorId,
				type: "ValidationError",
				msg: e.msg,
				path: req.path,
				method: req.method,
				location: e.location ?? "body",
				field: e.path,
			})),
		});
	}

	// Http errors (createHttpError)
	if (isHttpError(err)) {
		logger.error(err.message, {
			id: errorId,
			error: err.stack,
			path: req.path,
			method: req.method,
		});

		return res.status(err.status).json({
			errors: [
				{
					ref: errorId,
					type: err.name,
					msg: isProduction ? "Internal Server Error" : err.message,
					path: req.path,
					method: req.method,
					location: "server",
					stack: isProduction ? null : err.stack,
				},
			],
		});
	}

	// Unknown/unexpected errors
	const error = err as Error;
	logger.error(error.message ?? "Unknown error", {
		id: errorId,
		error: error.stack,
		path: req.path,
		method: req.method,
	});

	res.status(500).json({
		errors: [
			{
				ref: errorId,
				type: error.name ?? "Error",
				msg: isProduction
					? "Internal Server Error"
					: (error.message ?? "Unknown error"),
				path: req.path,
				method: req.method,
				location: "server",
				stack: isProduction ? null : error.stack,
			},
		],
	});
};
