import { Router } from "express";
import authenticate from "../middleware/authenticate";
import { asyncWrapper } from "../utils/wrapper";
import { CustomerController } from "./customer-controller";
import type { CustomerService } from "./customer-service";
import customerServiceInstance from "./customer-service";
import {
	addAddressValidator,
	addressIdValidator,
	customerIdentityValidator,
} from "./customer-validator";

export const createCustomerRouter = (service: CustomerService) => {
	const router = Router();
	const controller = new CustomerController(service);

	router.get(
		"/",
		authenticate,
		customerIdentityValidator,
		asyncWrapper(controller.getCustomer.bind(controller)),
	);

	router.post(
		"/addresses",
		authenticate,
		addAddressValidator,
		asyncWrapper(controller.addAddress.bind(controller)),
	);

	router.patch(
		"/addresses/:addressId/default",
		authenticate,
		addressIdValidator,
		asyncWrapper(controller.setDefaultAddress.bind(controller)),
	);

	return router;
};

export default createCustomerRouter(customerServiceInstance);
