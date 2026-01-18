# Universal POS Deployment Guide

## Architecture Overview

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Vercel    │ ───► │   Render    │ ───► │  Supabase   │
│  (Frontend) │      │  (Backend)  │      │ (Database)  │
└─────────────┘      └─────────────┘      └─────────────┘
```

---

## Step 1: Supabase Setup

### 1.1 Create Project
1. Go to [supabase.com](https://supabase.com) → New Project
2. Name: `pos-production`
3. Database Password: Generate strong password (save it!)
4. Region: Choose closest to users

### 1.2 Run Schema
1. Go to **SQL Editor**
2. Copy contents of `database/pos_schema.sql`
3. Click **Run** to create all tables

### 1.3 Get Credentials
From **Settings → API**, copy:
- `Project URL` → `SUPABASE_URL`
- `anon public` → `SUPABASE_ANON_KEY`
- `service_role` → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ Keep secret!

From **Settings → Database**:
- `Connection string` → `DATABASE_URL`

---

## Step 2: Backend on Render

### 2.1 Prepare Repository
```bash
cd backend
git init
git add .
git commit -m "Initial backend"
git remote add origin <your-github-repo>
git push -u origin main
```

### 2.2 Create Render Service
1. Go to [render.com](https://render.com) → New → Web Service
2. Connect GitHub repo
3. Configure:
   - **Name**: `pos-api`
   - **Root Directory**: `backend`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

### 2.3 Environment Variables
Add in Render dashboard:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `SUPABASE_URL` | From Step 1.3 |
| `SUPABASE_ANON_KEY` | From Step 1.3 |
| `SUPABASE_SERVICE_ROLE_KEY` | From Step 1.3 |
| `JWT_SECRET` | Generate: `openssl rand -base64 32` |
| `CORS_ORIGINS` | `https://your-frontend.vercel.app` |

### 2.4 Deploy
Click **Create Web Service**. Note the URL (e.g., `https://pos-api.onrender.com`)

---

## Step 3: Frontend on Vercel

### 3.1 Update API URL
Edit `frontend/js/api.js`:
```javascript
baseUrl: 'https://pos-api.onrender.com/api/v1',
```

### 3.2 Prepare Repository
```bash
cd frontend
git init
git add .
git commit -m "Initial frontend"
git push origin main
```

### 3.3 Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) → New Project
2. Import Git repository
3. **Root Directory**: `frontend`
4. **Framework Preset**: Other
5. Click Deploy

### 3.4 Custom Domain (Optional)
Settings → Domains → Add your domain

---

## Step 4: Final Configuration

### 4.1 Update CORS
In Render, update `CORS_ORIGINS` with actual Vercel URL:
```
https://your-app.vercel.app
```

### 4.2 Create First User
In Supabase SQL Editor:
```sql
-- Create admin user in Supabase Auth first via Dashboard
-- Then run:
INSERT INTO users (auth_id, email, full_name, is_active)
VALUES ('<auth_id_from_supabase>', 'admin@company.com', 'Admin User', true);

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r 
WHERE u.email = 'admin@company.com' AND r.name = 'Super Admin';
```

---

## Environment Variables Reference

### Backend (.env)
```env
NODE_ENV=production
PORT=3000

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# Auth
JWT_SECRET=your-32-char-secret

# Security
CORS_ORIGINS=https://your-app.vercel.app
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

---

## Common Errors & Fixes

### CORS Error
```
Access-Control-Allow-Origin missing
```
**Fix**: Ensure `CORS_ORIGINS` in Render matches your Vercel URL exactly (with https://)

### 401 Unauthorized
**Fix**: Check JWT_SECRET is same in backend and matches Supabase JWT config

### Database Connection Failed
**Fix**: Verify `SUPABASE_URL` doesn't have trailing slash

### Service Worker Not Registering
**Fix**: Ensure serving over HTTPS (automatic on Vercel)

### Cold Start Delay (Render Free Tier)
**Fix**: First request after 15min idle takes ~30s. Upgrade to paid or use cron to keep alive

---

## Testing Production

### 1. Health Check
```bash
curl https://pos-api.onrender.com/health
# Should return: {"status":"ok"}
```

### 2. Login Test
```bash
curl -X POST https://pos-api.onrender.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"test123"}'
```

### 3. Frontend Test
1. Open https://your-app.vercel.app
2. Login with credentials
3. Test POS, add items, complete sale
4. Check Reports for data

### 4. PWA Test
1. Open Chrome DevTools → Application
2. Verify Manifest loads
3. Verify Service Worker registered
4. Test Install prompt

---

## Monitoring

### Render
- Dashboard shows logs, metrics, deploys

### Supabase
- Dashboard → Logs for database queries
- Dashboard → Auth for user sessions

### Vercel
- Dashboard → Analytics for traffic
- Dashboard → Logs for access logs

---

## Backup Strategy

```bash
# Export Supabase data weekly
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

Or use Supabase Dashboard → Database → Backups
