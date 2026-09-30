import config from "config";
import mongoose from "mongoose";

const initDb = async () => {
	await mongoose.connect(config.get("service.dbUrl"));
};

export default initDb;
