# ObiReport Deployment Guide

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Vercel        │────▶│   Railway       │────▶│   PostgreSQL    │
│   (Frontend)    │     │   (Backend)     │     │   (Railway)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐     ┌─────────────────┐
                    │   Redis         │     │   Cloudflare R2 │
                    │   (Railway)     │     │   (File Storage)│
                    └─────────────────┘     └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐     ┌─────────────────┐
                    │   Turnitin API  │     │   SimulinkPay   │
                    │   (External)    │     │   (M-Pesa)      │
                    └─────────────────┘     └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   Resend        │
                    │   (Email)       │
                    └─────────────────┘
```

---

## Prerequisites

- GitHub account
- Vercel account
- Railway account
- Cloudflare account (for R2)
- Resend account
- Turnitin API credentials
- SimulinkPay credentials
- Firebase project
- Gemini API key

---

## Step 1: Set Up Cloudflare R2

### 1.1 Create R2 Bucket
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → R2
2. Click "Create bucket"
3. Name: `obireport-documents` (or your preferred name)
4. Leave default settings

### 1.2 Configure CORS
In bucket settings → CORS policy:
```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

### 1.3 Create API Token
1. Go to My Profile → API Tokens → Create Token
2. Use "Edit Cloudflare Workers" template or custom:
   - Account: R2 Read/Write
   - Zone: Not needed
3. Save token, note: `Account ID`, `Access Key ID`, `Secret Access Key`

### 1.4 (Optional) Custom Domain for Public URLs
1. In R2 bucket → Settings → Custom Domains
2. Add subdomain: `files.yourdomain.com`
3. Note for `R2_PUBLIC_URL`

---

## Step 2: Set Up Railway Services

### 2.1 Create PostgreSQL Database
1. Railway Dashboard → New → Database → PostgreSQL
2. Name: `obireport-db`
3. Note connection details: `SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME`
4. Also note admin credentials for migrations: `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD`

### 2.2 Create Redis Instance
1. Railway Dashboard → New → Database → Redis
2. Name: `obireport-redis`
3. Note `REDIS_URL` (format: `redis://default:password@host:port`)

### 2.3 Create Backend Service
1. Railway Dashboard → New → GitHub Repo
2. Select `masad-stock/obireport`
3. Configure:
   - **Root Directory**: `obireport`
   - **Build Command**: `npm install --legacy-peer-deps`
   - **Start Command**: `npm run start`
   - **Port**: `3000` (auto-detected)

### 2.4 Configure Backend Environment Variables
In Railway service → Variables, add:

```bash
# Database
SQL_HOST=your-postgres-host.railway.app
SQL_USER=postgres
SQL_PASSWORD=your-db-password
SQL_DB_NAME=railway
SQL_ADMIN_USER=postgres
SQL_ADMIN_PASSWORD=your-db-password

# Redis
REDIS_URL=redis://default:password@your-redis-host.railway.app:6379
QUEUE_CONCURRENCY=2

# R2 Storage
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET=obireport-documents
R2_PUBLIC_URL=https://files.yourdomain.com  # optional

# Firebase (from Firebase Console → Project Settings)
# Copy from firebase-applet-config.json or set individually

# Turnitin API
TURNITIN_API_URL=https://api.turnitin.com
TURNITIN_API_KEY=your-turnitin-api-key

# SimulinkPay (M-Pesa STK Push)
# Base URL is fixed: https://simulinkpay.co.ke/api/v1
SIMULINKPAY_API_TOKEN=your-simulinkpay-api-token
SIMULINKPAY_RECEIVING_ACCOUNT_ID=123
SIMULINKPAY_WEBHOOK_SECRET=your-webhook-secret

# Email (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM="ObiReport <noreply@yourdomain.com>"
APP_URL=https://your-frontend-domain.vercel.app

# Gemini
GEMINI_API_KEY=your-gemini-api-key

# App
NODE_ENV=production
PORT=3000
```

---

## Step 3: Run Database Migrations

### 3.1 Option A: Railway CLI (Recommended)
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and link project
railway login
railway link

# Run migrations
railway run --service obireport-backend npx drizzle-kit migrate
```

### 3.2 Option B: Local with Production DB
```bash
cd obireport

# Set env vars locally (create .env.local)
cp .env.example .env.local
# Edit .env.local with production values

# Run migration
npx drizzle-kit migrate
```

---

## Step 4: Set Up Vercel (Frontend)

### 4.1 Import Project
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. "Add New..." → Project → Import Git Repository
3. Select `masad-stock/obireport`
4. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `obireport`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install --legacy-peer-deps`

### 4.2 Configure Vercel Environment Variables
In Project Settings → Environment Variables:

```bash
# Firebase (from firebase-applet-config.json)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

# Backend URL (Railway service URL)
VITE_API_URL=https://your-backend.railway.app
```

### 4.3 Deploy
Click "Deploy" - first deployment will build and deploy.

---

## Step 5: Configure Firebase

### 5.1 Enable Email/Password Auth
1. Firebase Console → Authentication → Sign-in method
2. Enable "Email/Password"
3. Enable "Google" (already configured)

### 5.2 Configure Authorized Domains
Add your domains:
- `your-frontend-domain.vercel.app`
- `localhost` (for development)

### 5.3 Configure Action Code Settings
For email links (verification, password reset):
1. Authentication → Templates → Customize action URL
2. Set custom domain: `your-frontend-domain.vercel.app`

### 5.4 Get Service Account Key (for Admin SDK)
1. Project Settings → Service Accounts → Generate New Private Key
2. Save as `firebase-admin-sdk.json` (keep secure!)
3. Add to Railway environment or use individual fields

---

## Step 6: Set Up Resend

### 6.1 Create Account & Verify Domain
1. Go to [Resend](https://resend.com)
2. Add domain: `yourdomain.com`
3. Add DNS records as instructed
4. Verify domain

### 6.2 Create API Key
1. API Keys → Create Key
2. Name: `obireport-production`
3. Save key: `RESEND_API_KEY`

### 6.3 Test Email
```bash
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer re_xxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"from": "ObiReport <noreply@yourdomain.com>", "to": ["test@example.com"], "subject": "Test", "html": "<p>Test</p>"}'
```

---

## Step 7: Configure SimulinkPay

### 7.1 Get Credentials
From SimulinkPay Merchant Portal → Developer → API tokens:
- `SIMULINKPAY_API_TOKEN` — API token (sandbox or live)
- `SIMULINKPAY_RECEIVING_ACCOUNT_ID` — **Must be a VERIFIED receiving account** (verify in dashboard first)
- `SIMULINKPAY_WEBHOOK_SECRET` — Signing secret shown once when creating webhook endpoint

### 7.2 Configure Webhook URL
In SimulinkPay dashboard → Developer → Webhooks:
- URL: `https://your-backend.railway.app/api/payments/callback`
- Events: `payment.succeeded`, `payment.failed`, `payment.pending`

### 7.3 Verify Receiving Account
Before accepting payments, ensure the receiving account is **verified** in the SimulinkPay dashboard. An unverified account will cause `422 receiving_account_unverified` errors.

### 7.4 Fund the Wallet
SimulinkPay fees are deducted from a prepaid wallet (not from customer payments).
1. Check balance: `GET /wallet` via API
2. Top up: `POST /wallet/topups` with `Idempotency-Key`
3. If wallet balance is insufficient, payments are rejected with `402 insufficient_wallet_balance`

---

## Step 8: Configure Turnitin (if available)

### 8.1 Get API Credentials
From Turnitin account manager:
- `TURNITIN_API_URL` (usually `https://api.turnitin.com`)
- `TURNITIN_API_KEY`

### 8.2 Test Connection
```bash
curl -H "Authorization: Bearer YOUR_KEY" \
  https://api.turnitin.com/api/v1/health
```

---

## Step 9: Final Configuration & Testing

### 9.1 Update CORS in Backend
Ensure `APP_URL` in Railway matches your Vercel domain exactly.

### 9.2 Test End-to-End Flow
1. Visit `https://your-frontend.vercel.app`
2. Click "Get Started" → Register with email
3. Check email for verification link
4. Verify email → Sign in
5. Upload a test document (PDF)
6. Buy credits via M-Pesa (use sandbox)
7. Process document
8. Check report and PDF export

### 9.3 Verify Services
- [ ] Frontend loads on Vercel
- [ ] Backend health check: `https://your-backend.railway.app/api/health`
- [ ] Database connected (check Railway logs)
- [ ] Redis connected (check queue worker starts)
- [ ] R2 upload works (check bucket)
- [ ] Email verification sends
- [ ] Password reset works
- [ ] M-Pesa STK push triggers
- [ ] Webhook processes payment
- [ ] Turnitin/Gemini analysis runs
- [ ] PDF export downloads

---

## Step 10: Production Optimizations

### 10.1 Custom Domains
- **Frontend**: `app.yourdomain.com` → Vercel
- **Backend**: `api.yourdomain.com` → Railway
- **Files**: `files.yourdomain.com` → Cloudflare R2

### 10.2 SSL & Security Headers
Vercel handles SSL automatically. In `server.ts`, security headers are set:
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

Consider adding CSP header:
```typescript
res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;");
```

### 10.3 Monitoring & Alerts
- **Railway**: Enable metrics, set up alerts for CPU/memory
- **Vercel**: Enable analytics
- **Sentry** (optional): Add `@sentry/node` and `@sentry/react` for error tracking

### 10.4 Rate Limiting (Recommended)
Add to `server.ts`:
```bash
npm install @fastify/rate-limit
```
```typescript
import rateLimit from '@fastify/rate-limit';
await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
```

### 10.5 Backup Strategy
- **PostgreSQL**: Railway auto-backups (check retention)
- **R2**: Enable versioning on bucket
- **Redis**: Not critical (ephemeral queue data)

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Build fails on Vercel | Check Node version (use 20.x), clear cache, retry |
| Backend won't start | Check Railway logs, verify all env vars set |
| Database connection fails | Verify SQL_HOST includes port, check firewall |
| Redis connection fails | Ensure REDIS_URL format is correct |
| R2 upload fails | Check CORS policy, verify credentials |
| Email not sending | Verify Resend domain, check API key |
| Webhook not received | Ensure backend URL is public, check SimulinkPay config |
| Turnitin timeout | Increase polling attempts in analyzer.ts |

### Debug Commands
```bash
# Check Railway logs
railway logs --service obireport-backend

# Check queue status
railway run --service obireport-backend npx tsx -e "
import { documentQueue } from './src/queue/documentQueue';
console.log(await documentQueue.getJobCounts());
"

# Test R2 connection
railway run --service obireport-backend npx tsx -e "
import { putObject, getObject } from './src/services/storage';
await putObject('test.txt', Buffer.from('hello'), 'text/plain');
console.log(await getObject('test.txt').toString());
"
```

---

## Rollback Procedure

1. **Vercel**: Dashboard → Deployments → "Promote to Production" on previous deployment
2. **Railway**: Dashboard → Deployments → "Rollback" on previous deployment
3. **Database**: If migration broke, restore from Railway backup

---

## Cost Estimates (Monthly)

| Service | Estimate |
|---------|----------|
| Vercel (Frontend) | Free tier sufficient |
| Railway PostgreSQL | $5-10 |
| Railway Redis | $5 |
| Railway Backend | $5-20 |
| Cloudflare R2 | $0.015/GB storage + $0.36/GB egress |
| Resend | Free tier (3,000 emails/month) |
| **Total** | **~$15-40/month** |

---

## Support Contacts

- **Railway**: Discord community, docs.railway.app
- **Vercel**: vercel.com/support
- **Cloudflare R2**: developers.cloudflare.com/r2
- **Resend**: resend.com/docs
- **SimulinkPay**: Check their developer docs
- **Turnitin**: Your account manager

---

## Next Steps After Launch

1. Set up analytics (Vercel Analytics, Plausible, or GA4)
2. Add Sentry for error tracking
3. Implement rate limiting
4. Add automated tests (Playwright for E2E)
5. Set up staging environment
6. Configure CI/CD for automatic deployments on push to main