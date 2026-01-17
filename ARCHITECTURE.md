# Architecture & Design Document

**Project:** ShopCardd Flash-Sale Engine  
**Date:** January 2026

---

## Part 1: Offline Voucher Verification

### Problem

A merchant's device has no internet connection. How can they verify if a customer's voucher is legitimate?

### Solution: JWT-Based Cryptographic Vouchers

#### Concept

Generate vouchers as **signed JSON Web Tokens (JWT)** that contain all verification data within themselves. The merchant can verify these tokens offline using cryptographic signatures.

#### Architecture

```
┌─────────────────┐
│  User Claims    │
│  Deal on App    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Backend Server                 │
│  • Creates JWT                  │
│  • Signs with Private Key       │
│  • Includes: deal_id, user_id,  │
│    merchant_id, expiry, nonce   │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Voucher Code (JWT)             │
│  eyJhbGci...XVCJ9.eyJkZWFsX2... │
└────────┬────────────────────────┘
         │
         ▼
    [Customer shows voucher in store]
         │
         ▼
┌─────────────────────────────────┐
│  Merchant Device (OFFLINE)      │
│  • Has Public Key stored        │
│  • Verifies JWT signature       │
│  • Checks expiry & merchant_id  │
│  • Stores locally if valid      │
└────────┬────────────────────────┘
         │
         ▼
    [Accepted or Rejected]
```

#### How Verification Works

**Step 1: Generate Voucher (Server)**
- Create JWT containing voucher details
- Sign with server's private key (RS256)
- Return signed token to user

**Step 2: Verify Offline (Merchant Device)**
- Read JWT signature
- Verify using public key (stored locally)
- If signature valid → voucher is authentic
- If signature invalid → voucher is fake

**Step 3: Prevent Double-Use**
- Save redeemed voucher ID to local database (SQLite)
- Check against local database before accepting
- Sync to backend when internet returns

#### Why This Works

**Asymmetric Encryption:**
- Private key (server) → can create signatures
- Public key (merchant) → can only verify signatures
- Merchant cannot create fake vouchers even with public key

**Offline Capability:**
- All data needed is in the JWT itself
- No network call required
- Instant verification

---

## Part 2: Scaling to 1 Million Requests/Minute

### Problem

Flash sale goes viral. System receives 1 million claim requests per minute. Current architecture will crash.

### Solution: Distributed Architecture

#### Current vs Scaled Architecture

**Before (Single Server):**
```
Users → Single Node.js Server → Single Redis → Single MongoDB
```

**After (Distributed):**
```
                    ┌──────────────┐
                    │ Load Balancer│
                    └───────┬──────┘
                            │
        ┏━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━━┓
        ▼                   ▼                   ▼
   ┌─────────┐         ┌─────────┐         ┌─────────┐
   │ Node.js │         │ Node.js │   ...   │ Node.js │
   │Server 1 │         │Server 2 │         │Server N │
   └────┬────┘         └────┬────┘         └────┬────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
     ┌──────────┐    ┌──────────┐   ┌──────────┐
     │  Redis   │    │RabbitMQ  │   │ MongoDB  │
     │ Cluster  │    │ Queue    │   │ Sharded  │
     └──────────┘    └──────────┘   └──────────┘
```

---

### Scaling Strategy

#### 1. Application Layer - Horizontal Scaling

**Setup:**
- Deploy 10-20 Node.js instances
- Add load balancer (Nginx/AWS ALB)
- Use least-connections routing

**Diagram:**
```
                Load Balancer
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
    Server 1      Server 2      Server N
```

---

#### 2. Database Layer - MongoDB Sharding

**Setup:**
- Split data across multiple MongoDB instances
- Use `merchant_id` as shard key
- Configure replica sets for each shard

**Diagram:**
```
                MongoDB Router
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
    Shard 1       Shard 2       Shard 3
  (merchant      (merchant     (merchant
   A-H data)     I-P data)     Q-Z data)
```

---

#### 3. Cache Layer - Redis Cluster

**Setup:**
- 3 master nodes + 3 replica nodes
- Automatic data distribution
- High availability with auto-failover

**Diagram:**
```
          Redis Cluster
    ┌───────────┬───────────┐
    ▼           ▼           ▼
 Master 1    Master 2    Master 3
    │           │           │
 Replica 1   Replica 2   Replica 3
```

---

#### 4. Async Processing - Message Queue

**Setup:**
- Use RabbitMQ for background tasks
- Separate workers for email, SMS, analytics
- Fast API response, slow tasks queued

**Diagram:**
```
Claim API (50ms response)
         │
         ▼
   RabbitMQ Queue
         │
         ▼
   Worker Pool
    │    │    │
    ▼    ▼    ▼
 Email  SMS  Analytics
```

**Why RabbitMQ over Kafka:**
- We need task queue (not event stream)
- Per-message acknowledgment
- Simpler setup and management
- Message priority support

---

### Complete System Architecture

```
┌──────────┐
│  Users   │
│ (1M/min) │
└────┬─────┘
     │
     ▼
┌─────────────────┐
│ Load Balancer   │
│  (Nginx/ALB)    │
└────┬────────────┘
     │
     ▼
┌──────────────────────────────┐
│  App Servers (10-20)         │
│  • Handle requests           │
│  • Atomic claim logic        │
└────┬─────────────────────┬───┘
     │                     │
     ▼                     ▼
┌──────────┐         ┌──────────┐
│  Redis   │         │ RabbitMQ │
│ Cluster  │         │  Queue   │
│          │         │          │
│ • Cache  │         │ • Email  │
│ • Atomic │         │ • SMS    │
│ • Claims │         │ • Logs   │
└────┬─────┘         └──────────┘
     │
     ▼
┌──────────────┐
│  MongoDB     │
│  Sharded     │
│              │
│ • Deals      │
│ • Claims     │
│ • Users      │
└──────────────┘
```

---

## Summary

**Offline Verification:**
- Use JWT with asymmetric encryption (RS256)
- Merchant verifies signature offline using public key
- Prevents forgery while working without internet

**Scaling to 1M req/min:**
- Horizontal scaling: Multiple app servers behind load balancer
- Database: MongoDB sharding + read replicas
- Cache: Redis cluster for high availability
- Async: RabbitMQ for background tasks

Both solutions focus on practical implementation with proven technologies.

---

