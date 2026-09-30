import type { Request } from "express";

export interface AuthCookie {
	refreshToken: string;
	accessToken: string;
}

export interface AuthPayload {
	id: number;
	role: string;
	iat: number;
	exp: number;
	tenantId: number | null;
}

export interface AuthRequest extends Request {
	auth: AuthPayload;
}

export interface OptionalAuthRequest extends Request {
	auth?: AuthPayload;
}
