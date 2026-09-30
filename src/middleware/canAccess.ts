import type { NextFunction, Request, RequestHandler, Response } from "express";
import createHttpError from "http-errors";
import type { AuthRequest } from "../types";

export const canAccess =
	(roles: string[]): RequestHandler =>
	(req: Request, _res: Response, next: NextFunction) => {
		const role = (req as AuthRequest).auth?.role;

		if (!role) {
			return next(createHttpError(401, "Unauthorized"));
		}

		if (!roles.includes(role)) {
			return next(createHttpError(403, "Forbidden"));
		}

		next();
	};
