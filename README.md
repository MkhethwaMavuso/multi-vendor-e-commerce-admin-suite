# VendorHub

VendorHub is a TypeScript MERN monorepo for operating a multi-vendor marketplace. It includes a React admin SPA, an Express API, indexed Mongoose models, tenant-scoped vendor workflows, and a transactional multi-vendor checkout pipeline.

## Repository layout

```text
client/                       React 18 + Vite + TypeScript SPA (Netlify)
  src/components/             Admin layout and shared UI
  src/context/                Cookie-backed authentication state
  src/pages/                  Login, registration, dashboards, catalog, orders
  src/services/               Axios API client
  src/types/                  Frontend domain types
  netlify.toml                SPA build and route fallback
server/                       Express + TypeScript API (Render)
  src/config/                 MongoDB connection
  src/controllers/            Auth, catalog, checkout, vendor and analytics
  src/middleware/             JWT/RBAC, tenant scope, CSRF and errors
  src/models/                 User, Vendor, Product and Order schemas
  src/routes/                 REST API routes
  src/scripts/                Explicit super-admin bootstrap command
  Dockerfile                  Multi-stage Render container
```

## Requirements and local development

- Node.js 22 or newer and npm
- MongoDB configured as a replica set (Atlas is supported); MongoDB transactions do not work on a standalone server.

```sh
npm install
cp server/.env.example server/.env
cp client/.env.example client/.env
npm run dev:server
npm run dev:client
```

Set `MONGO_URI`, a random `JWT_SECRET` of at least 32 characters, and `CLIENT_ORIGIN` in `server/.env`. The client defaults to `/api`; set `VITE_API_URL` to the API's absolute URL when running the SPA separately.

Create the first platform administrator explicitly from the server directory, after setting `MONGO_URI`, `ADMIN_NAME`, `ADMIN_EMAIL`, and a strong `ADMIN_PASSWORD` (minimum 12 characters):

```sh
npm run create-super-admin --workspace server
```

Vendor self-registration creates a `PENDING` store and owner account. A super admin must approve the vendor before checkout can accept its products.

Super admins can create and edit vendor stores and owner accounts. Archiving a vendor disables new sales while retaining its account, products, and order history. All new sales use a fixed 15% platform commission.

### Local marketplace simulation

The optional simulator is disabled by default and runs only when `NODE_ENV=development` and `DEMO_SIMULATOR_ENABLED=true`. It creates one active demo vendor per hour and creates 10 simulated orders for every active vendor every 20 minutes. If an active vendor has no simulator product, a clearly marked demo product is added. Simulated orders are marked paid for reporting and do not charge a payment provider. Keep the simulator disabled outside local development.

```sh
DEMO_SIMULATOR_ENABLED=true npm run dev:server
```

For an initial local dataset of 20 demo vendors with at least 100 paid orders each, run:

```sh
npm run seed-demo-marketplace --workspace server
```

The seed command is development-only and idempotently fills missing vendors or orders. Order totals vary by product price and quantity; commission is calculated at 15%.

The platform dashboard and order list are available to super-admins. Gross income and commission totals include paid orders only; order counts include all orders.

## Data model and isolation

- **User**: normalized unique email, bcrypt password hash (excluded from ordinary queries), required role, active flag, and a conditional tenant reference. Super admins have no vendor; vendor admins and fulfillment staff must have one.
- **Vendor**: unique store name and indexed slug, owner, approval status, bounded percentage commission, and payout fields excluded from ordinary reads.
- **Product**: tenant reference, unique per-vendor slug and variant SKU compound indexes, category index, active state, and variant subdocuments holding SKU, string attributes, price, compare-at price, and stock. Duplicate SKUs within one product are rejected by document validation.
- **Order**: customer snapshot and line-item snapshots including vendor, SKU, price, commission, payout, and fulfillment state. Compound indexes support vendor queues and customer history.

JWT claims are verified against the current active user record before protected requests proceed. Vendor query/body tenant IDs are checked and then overwritten from the verified account; all relevant database reads and writes also apply the server-derived vendor scope. Vendor order responses include only that vendor's lines and vendor-specific totals.

## Order pipeline

`POST /api/orders/checkout` accepts customer details and product/variant/quantity lines. The API starts a MongoDB session transaction, reads current product/vendor pricing, confirms each vendor is active, and decrements `variants.$.stock` only when the matching SKU has sufficient stock. It calculates each line's commission at the fixed 15% platform rate, creates one order containing all vendor lines, and aborts the transaction if any line cannot be fulfilled. Checkout is a guest-capable API scaffold: it records a pending payment status and does not charge a payment provider.

MongoDB transactions require Atlas or a replica-set deployment. Configure an appropriate transaction-capable MongoDB cluster before enabling checkout in production.

## API outline

| Method | Route | Access |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Public vendor registration |
| `POST` | `/api/auth/login` | Public sign-in |
| `POST` | `/api/auth/logout` | Public cookie clearing |
| `GET` | `/api/auth/me` | Authenticated |
| `GET/POST/PATCH/DELETE` | `/api/products` | Scoped product read; vendor-admin writes |
| `POST` | `/api/orders/checkout` | Public checkout |
| `GET` | `/api/orders` | Super admin or scoped vendor staff |
| `PATCH` | `/api/orders/:id/fulfillment` | Super admin or scoped vendor staff |
| `GET/POST/PATCH/DELETE` | `/api/vendors` | Super-admin vendor CRUD; DELETE archives |
| `GET` | `/api/analytics/summary` | Global or tenant-scoped summary |

Protected auth uses an HTTP-only JWT cookie, with Bearer token support for API clients. Cookie-authenticated writes require the app's custom request header; CORS must be configured with the exact frontend origin(s). For production browser deployment, use HTTPS and preferably custom frontend/API hostnames under the same site so browser third-party-cookie restrictions do not block sessions.

## Deployment

### Netlify

Use `client/` as the site base directory, `npm run build` as the build command, and `dist` as the publish directory. Set `VITE_API_URL` to the Render API URL including `/api`. The included Netlify config provides a history fallback for the SPA.

### Render

Create a Docker web service with the repository root as its build context and `server/Dockerfile` as the Dockerfile path. Set `MONGO_URI`, `JWT_SECRET` (32+ random characters), `CLIENT_ORIGIN` (comma-separated exact origins), and optionally `PORT` (Render supplies it). The container builds TypeScript and starts `server/dist/server.js`.

## Build

```sh
npm run build
```
