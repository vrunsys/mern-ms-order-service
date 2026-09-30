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

interface ResolvedHttpError {
	status: number;
	name: string;
	message: string;
	stack?: string;
}

const resolveHttpError = (err: unknown): ResolvedHttpError | null => {
	if (isHttpError(err)) {
		return {
			status: err.status,
			name: err.name,
			message: err.message,
			stack: err.stack,
		};
	}

	if (err instanceof Error) {
		const { status } = err as Error & { status?: unknown };
		if (typeof status === "number" && status >= 400 && status <= 599) {
			return {
				status,
				name: err.name || "Error",
				message: err.message,
				stack: err.stack,
			};
		}
	}

	return null;
};

export const globalError = (
	err: unknown,
	req: Request,
	res: Response,
	_next: NextFunction,
) => {
	const errorId = uuidv4();
	const isProduction = process.env.NODE_ENV === "production";

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

	const httpError = resolveHttpError(err);
	if (httpError) {
		logger.error(httpError.message, {
			id: errorId,
			error: httpError.stack,
			path: req.path,
			method: req.method,
		});

		return res.status(httpError.status).json({
			errors: [
				{
					ref: errorId,
					type: httpError.name,
					msg: isProduction ? "Internal Server Error" : httpError.message,
					path: req.path,
					method: req.method,
					location: "server",
					stack: isProduction ? null : (httpError.stack ?? null),
				},
			],
		});
	}

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
