import mongoose from "mongoose";

export interface Address {
	address: string;
	postalCode: string;
	isDefault: boolean;
}

export interface Customer {
	id: number;
	firstName: string;
	lastName: string;
	email: string;
	addresses: Address[];
}

const addressSchema = new mongoose.Schema<Address>(
	{
		address: { type: String, required: true, trim: true },
		postalCode: { type: String, required: true, trim: true },
		isDefault: { type: Boolean, default: false },
	},
	{ _id: true },
);

const customerSchema = new mongoose.Schema<Customer>(
	{
		id: { type: Number, required: true, unique: true, index: true },
		firstName: { type: String, required: true, trim: true },
		lastName: { type: String, required: true, trim: true },
		email: {
			type: String,
			required: true,
			unique: true,
			lowercase: true,
			trim: true,
			index: true,
		},
		addresses: { type: [addressSchema], default: [] },
	},
	{ timestamps: true },
);

export default mongoose.model<Customer>("Customer", customerSchema);
