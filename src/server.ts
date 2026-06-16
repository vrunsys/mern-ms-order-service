import app from "./app";
import { config } from "./config";
import logger from "./config/logger";

const startServer = () => {
	const { PORT } = config;
	try {
		app.listen(PORT, () => {
			logger.info(`Server is running on port ${PORT}`);
		});
	} catch (err) {
		logger.error(err);
		process.exit(1);
	}
};

startServer();
