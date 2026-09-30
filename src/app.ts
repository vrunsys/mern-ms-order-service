import express from "express";
import { globalError } from "./middleware/globalError";

const app = express();

// biome-ignore lint: correctness/noUnusedVariables
app.all("/health", (req, res) => {
	res.status(200).json({ status: "OK" });
});

app.use(globalError);

export default app;
