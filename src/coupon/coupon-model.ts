import mongoose from "mongoose";

export interface Coupon {
	title: string;
	code: string;
	discount: number;
	validUpto: Date;
	tenantId: number;
}

const couponSchema = new mongoose.Schema<Coupon>(
	{
		title: { type: String, required: true, trim: true },
		code: {
			type: String,
			required: true,
			trim: true,
			uppercase: true,
			minlength: 3,
			maxlength: 32,
		},
		discount: { type: Number, required: true, min: 1, max: 100 },
		validUpto: { type: Date, required: true },
		tenantId: { type: Number, required: true, index: true },
	},
	{ timestamps: true },
);

couponSchema.index({ code: 1, tenantId: 1 }, { unique: true });

export default mongoose.model<Coupon>("Coupon", couponSchema);
