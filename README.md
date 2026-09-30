# mern-ms-order-service

Order service for the MERN microservices stack. Exposed through the Kong
gateway under `/api/orders`.

## Setup

Install dependencies:

```bash
bun install
```

Configuration is read with [node-config](https://github.com/node-config/node-config)
and lives in a git-ignored `config/` directory, because it contains
credentials. Create it from the committed example:

```bash
mkdir -p config
cp config.example.json config/default.json
```

Then fill in `service.dbUrl` with a real MongoDB connection string.

To run:

```bash
bun run dev
```

## Tests

```bash
bun test
```

## Routes

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | public | Liveness check |
| `GET` | `/customers` | authenticated | Get-or-create the signed-in customer |
| `POST` | `/customers/addresses` | authenticated | Add an address |
| `PATCH` | `/customers/addresses/:addressId/default` | authenticated | Promote an address to default |
| `GET` | `/coupons` | admin, manager | List coupons for a tenant |
| `POST` | `/coupons` | admin, manager | Create a coupon |
| `PATCH` | `/coupons/:id` | admin, manager | Update a coupon |
| `DELETE` | `/coupons/:id` | admin, manager | Delete a coupon |

Managers are always scoped to the tenant in their access token. Admins may
target another tenant by passing `tenantId`.
