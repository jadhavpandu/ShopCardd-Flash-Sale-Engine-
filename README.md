# ShopCardd Flash‑Sale Engine

A high‑performance, geolocation‑aware flash sale backend built with **Node.js**, **Express**, **MongoDB**, and **Redis**. The system supports real‑time deal discovery, atomic voucher claiming, and automatic expiry using Redis TTLs.

---

## Project Structure

```
shopcardd-flash-sale/
├── src/
│   ├── config/
│   │   ├── database.js          # MongoDB connection
│   │   └── redis.js             # Redis client configuration
│   │
│   ├── middleware/
│   │   └── validators.js        # Request validation rules
│   │
│   ├── models/
│   │   ├── Deal.js              # Deal schema (2dsphere index)
│   │   └── Claim.js             # Claim schema & voucher generation
│   │
│   └── routes/
│       └── dealRoutes.js        # API routes
│
├── scripts/
│   └── seed.js                  # Database seeding script
│
├── .env.example                 # Environment variables template
├── .gitignore                   # Git ignore rules
├── package.json                 # Project dependencies & scripts
├── package-lock.json            # Dependency lock file
├── server.js                    # Application entry point
└── README.md                    # Project documentation

```

---

##  Tech Stack

* **Node.js** (v18+)
* **Express.js**
* **MongoDB** (Mongoose)
* **Redis** (ioredis)
* **.env**

---

## Installation (Linux / Ubuntu)

### Prerequisites

* Node.js v18+
* npm
* MongoDB (local or Atlas)
* Redis (local or managed)

### Setup

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Start server
node server.js

# OR (recommended for development)
nodemon server.js

# install dotenv
npm install dotenv
```

---

##  Environment Variables

Create a `.env` file from `.env.example` and update values:

```env
MONGODB_URI=mongodb://localhost:27017/flash-sale
REDIS_HOST=localhost
REDIS_PORT=6379
PORT=3000
NODE_ENV=development
```

>  **Do not commit `.env`**. Only `.env.example` should be pushed to Git.

---

## API Endpoints

Base URL:

```
http://localhost:3000/api
```

---

### Create Deal

**POST** `/api/deals`

Create a new flash sale deal.

**Request Body**

```json
{
  "merchant_id": "123e4567-e89b-12d3-a456-426614174000",
  "title": "Flat 50% Off on Grilled Sandwiches",
  "total_vouchers": 100,
  "valid_until": "2026-02-01T23:59:59.000Z",
  "location": {
    "lat": 19.0760,
    "lng": 72.8777
  }
}
```

**Success Response (201)**

```json
{
  "status": "success",
  "deal_id": "507f1f77bcf86cd799439011",
  "message": "Deal created successfully"
}
```

---

### 2️⃣ Discover Nearby Deals

**GET** `/api/deals?lat=19.0760&long=72.8777&radius=5`

Find active deals within a given radius.

**Query Parameters**

| Param  | Required | Description                        |
| ------ | -------- | ---------------------------------- |
| lat    | Yes      | Latitude (-90 to 90)               |
| long   | Yes      | Longitude (-180 to 180)            |
| radius | No       | Radius in km (default: 5, max: 50) |

**Response (200)**

```json
{
  "status": "success",
  "count": 1,
  "deals": [
    {
      "deal_id": "507f1f77bcf86cd799439011",
      "merchant_id": "merchant_001",
      "title": "50% Off on Grilled Sandwiches",
      "total_vouchers": 100,
      "inventory_remaining": 85,
      "valid_until": "2026-02-01T18:29:59.000Z",
      "location": {
        "lat": 19.0760,
        "lng": 72.8777
      },
      "distance_km": 0.5
    }
  ]
}
```

---

### Claim Deal

**POST** `/api/deals/:deal_id/claim`

Claim **one voucher per user** (race‑condition safe).

**Request Body**

```json
{
  "user_id": "user-5656-7788"
}
```

**Success Response (200)**

```json
{
  "status": "success",
  "voucher_code": "SHOP-XY5Z-ABC123"
}
```

**Error Responses**

* **409 – Sold Out**

```json
{ "status": "fail", "reason": "Deal Sold Out" }
```

* **400 – Already Claimed**

```json
{ "status": "fail", "reason": "User already claimed" }
```

---

## Architecture Highlights

* **MongoDB** is the source of truth for deals and claims
* **Redis** is used for:

  * Atomic inventory decrement (race-condition safe)
  * Duplicate-claim prevention (SET-based)
  * TTL-based auto-expiry aligned with `valid_until`
* **2dsphere index** enables fast geospatial discovery
* **Redis Lua script** ensures atomic claim operations

---

## Redis Verification (How it was validated)

Redis functionality was verified using **three independent methods**:

1. **Application-level checks**

   * Successful `PING → PONG`
   * Test write & read (`SET` / `GET`) via API
   * Deal keys created on deal creation and claim

2. **redis-cli (Local / Cloud)**

   ```bash
   redis-cli
   PING
   KEYS deal:*
   GET deal:<deal_id>:inventory
   ```

   Inventory value decreases on every successful claim.

3. **Behavioral proof**

   * Duplicate claim by same user is rejected
   * Inventory reaches zero → deal becomes sold out
   * Keys auto-expire after `valid_until` via TTL

This confirms Redis is actively used for concurrency control and caching.

---

## Status

✔ APIs tested via Postman
✔ Redis verified via redis-cli and application checks
✔ Geo-filtering working correctly
✔ Expiry & sold-out logic validated

---
## health
<img width="1920" height="1080" alt="health" src="https://github.com/user-attachments/assets/b93ba461-3357-4d7c-9a39-71cfbc07b9c7" />

## api_deal
<img width="1145" height="889" alt="API_delas" src="https://github.com/user-attachments/assets/1c01e671-84c4-4f9e-9169-1301403b1f5e" />


## deals in database
<img width="1920" height="1080" alt="deals" src="https://github.com/user-attachments/assets/5a7e0d9f-3de3-4705-aec7-bdc590f5f607" />


## api for region to check deals
<img width="1145" height="889" alt="api for specific regin" src="https://github.com/user-attachments/assets/76a8b495-5c82-4ba4-b206-9e3811665c97" />

## api claim offer with in Range of Radius
<img width="1784" height="974" alt="Claim with in Range of radius" src="https://github.com/user-attachments/assets/2cdbc028-e344-4827-86b5-d5fd321797f9" />


## api to claim deal
<img width="1920" height="1080" alt="Claim" src="https://github.com/user-attachments/assets/b7ec3d66-56ea-494e-9a9c-6f10ba860bcf" />

## claim database image
<img width="1920" height="1080" alt="claim" src="https://github.com/user-attachments/assets/57445d72-a58f-4bcf-805c-6f13fbdf8688" />

## Redis database setup
<img width="1784" height="974" alt="Redis_coonection sting" src="https://github.com/user-attachments/assets/9ef1df4b-7db7-42d9-b097-dae658dca744" />
## redis-cli desktop
<img width="1920" height="1080" alt="Rediscli desktop" src="https://github.com/user-attachments/assets/739c05fb-9268-46bb-8a83-81413a625a86" />








