import config from "config";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import couponRouter from "./coupon/coupon-router";
import customerRouter from "./customer/customer-router";
import { globalError } from "./middleware/globalError";

const app = express();

app.use(cors({ origin: config.get("origins"), credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.all("/health", (_req, res) => {
	res.status(200).json({ status: "OK" });
});

app.use("/customers", customerRouter);
app.use("/coupons", couponRouter);

app.use(globalError);

export default app;
