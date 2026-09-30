import config from "config";
import app from "./app";
import initDb from "./config/db";
import logger from "./config/logger";

const startServer = async () => {
	try {
		await initDb();
		const port = config.get<number>("service.port");
		app.listen(port, () => {
			logger.info(`Server is running on port ${port}`);
		});
	} catch (err) {
		logger.error(err);
		process.exit(1);
	}
};

await startServer();
