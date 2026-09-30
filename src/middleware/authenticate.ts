import config from "config";
import { expressjwt, type GetVerificationKey } from "express-jwt";
import jwksClient from "jwks-rsa";

const jwksUri = config.get<string>("auth.jwksUri");

if (!jwksUri) {
	throw new Error(
		"auth.jwksUri is not configured. Set it in config/default.json or via NODE_CONFIG.",
	);
}

const createAuthenticationMiddleware = (credentialsRequired: boolean) =>
	expressjwt({
		secret: jwksClient.expressJwtSecret({
			jwksUri,
			cache: true,
			rateLimit: true,
		}) as GetVerificationKey,
		algorithms: ["RS256"],
		credentialsRequired,
		getToken: (req) => {
			const authHeader = req.headers.authorization;

			if (authHeader?.startsWith("Bearer ")) {
				const token = authHeader.split(" ")[1];
				if (token) {
					return token;
				}
			}

			const accessTokenCookie = req.cookies?.accessToken;
			return accessTokenCookie;
		},
	});

export const optionalAuthenticate = createAuthenticationMiddleware(false);

export default createAuthenticationMiddleware(true);
