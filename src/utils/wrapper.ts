import type { NextFunction, Request, RequestHandler, Response } from "express";
import createHttpError from "http-errors";

const asyncWrapper =
	<P = Record<string, string>, ResBody = unknown, ReqBody = unknown>(
		fn: (
			req: Request<P, ResBody, ReqBody>,
			res: Response,
			next: NextFunction,
		) => Promise<void>,
	): RequestHandler<P, ResBody, ReqBody> =>
	(req, res, next) => {
		Promise.resolve(fn(req, res, next)).catch((err: unknown) => {
			if (createHttpError.isHttpError(err)) {
				return next(err);
			}
			return next(createHttpError(500, "Internal Server Error"));
		});
	};

export { asyncWrapper };
