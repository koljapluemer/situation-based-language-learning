# Railway Deployment Guide

Complete guide to deploy the Situation-Based Language Learning application to Railway.

## Architecture Overview

- **Railway Services**:
  - Backend API (Fastify + Prisma)
  - Frontend-CMS (Vue 3 + Vite static site)
  - Frontend-CRAM (Vue 3 + Vite static site)
- **Railway PostgreSQL Database**: Native managed PostgreSQL
- **Supabase**: Authentication only (no database)

---

## Prerequisites

- GitHub account with this repository pushed
- Railway account: https://railway.app
- Supabase project for authentication (see `SUPABASE_AUTH_SETUP.md`)

---

## Cost Estimate

### Hobby Plan (Recommended for development)
- **$5/month subscription** (includes $5 usage credit)
- Resource limits: 8 vCPU, 8GB RAM per service
- If usage exceeds $5, you pay the difference

### Pro Plan (For production/teams)
- **$20/month subscription** (includes $20 usage credit)
- Resource limits: 32 vCPU, 32GB RAM per service
- Better for collaboration and higher traffic

Official pricing: https://docs.railway.com/reference/pricing/plans

---

## Step 1: Create Railway Project

1. Go to https://railway.app and sign up/login
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Authorize Railway to access your GitHub account
5. Select the `situation-based-language-learning` repository
6. Railway will detect the monorepo structure

---

## Step 2: Create PostgreSQL Database

1. In your Railway project, click **"+ New"**
2. Select **"Database"** → **"PostgreSQL"**
3. Railway automatically creates the database
4. Note: `DATABASE_URL` environment variable is automatically shared with all services

---

## Step 3: Deploy Backend Service

### 3A. Create Backend Service

1. Click **"+ New"** → **"GitHub Repo"**
2. Select your repository
3. Railway detects it's a monorepo
4. Name the service: `backend`

### 3B. Configure Backend

1. Go to service **Settings** tab
2. Set **Root Directory**: `/src/backend`
3. Set **Watch Paths**: `/src/backend/**` and `/src/shared/**`
4. Railway will use the `railway.json` config in `/src/backend/`

### 3C. Environment Variables

Go to **Variables** tab and add:

```bash
NODE_ENV=production
PORT=8080
CORS_ORIGIN=http://localhost:4173,http://localhost:4174
SUPABASE_URL=https://yxhprmlbuzfdsbauiwbk.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
OPENAI_API_KEY=<optional>
GEMINI_API_KEY=<optional>
```

**Notes:**
- `DATABASE_URL` is automatically provided by Railway
- Update `CORS_ORIGIN` with actual frontend URLs after deployment (Step 4 & 5)
- Get Supabase keys from: https://supabase.com/dashboard/project/yxhprmlbuzfdsbauiwbk/settings/api

### 3D. Generate Domain

1. Go to **Settings** → **Networking**
2. Click **"Generate Domain"**
3. Copy the URL (e.g., `https://backend-production-xxxx.up.railway.app`)
4. Test: `curl https://your-backend-url/health` → should return `{"status":"ok"}`

---

## Step 4: Deploy Frontend-CMS

### 4A. Create CMS Service

1. Click **"+ New"** → **"GitHub Repo"**
2. Select your repository
3. Name the service: `frontend-cms`

### 4B. Configure CMS

1. Go to **Settings** tab
2. Set **Root Directory**: `/src/frontend-cms`
3. Set **Watch Paths**: `/src/frontend-cms/**` and `/src/shared/**`
4. Railway will use the `railway.json` config in `/src/frontend-cms/`

### 4C. Environment Variables

Go to **Variables** tab and add:

```bash
VITE_SUPABASE_URL=https://yxhprmlbuzfdsbauiwbk.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
VITE_API_URL=<your-backend-url-from-step-3>
```

### 4D. Generate Domain

1. Go to **Settings** → **Networking**
2. Click **"Generate Domain"**
3. Copy the URL (e.g., `https://frontend-cms-production-xxxx.up.railway.app`)

---

## Step 5: Deploy Frontend-CRAM

### 5A. Create CRAM Service

1. Click **"+ New"** → **"GitHub Repo"**
2. Select your repository
3. Name the service: `frontend-cram`

### 5B. Configure CRAM

1. Go to **Settings** tab
2. Set **Root Directory**: `/src/frontend-cram`
3. Set **Watch Paths**: `/src/frontend-cram/**` and `/src/shared/**`
4. Railway will use the `railway.json` config in `/src/frontend-cram/`

### 5C. Environment Variables

Go to **Variables** tab and add:

```bash
VITE_API_URL=<your-backend-url-from-step-3>
```

**Note:** CRAM doesn't need Supabase credentials (public app)

### 5D. Generate Domain

1. Go to **Settings** → **Networking**
2. Click **"Generate Domain"**
3. Copy the URL (e.g., `https://frontend-cram-production-xxxx.up.railway.app`)

---

## Step 6: Update Backend CORS

Now that frontends are deployed, update backend CORS:

1. Go to **backend** service → **Variables** tab
2. Update `CORS_ORIGIN` with actual URLs:
   ```
   https://frontend-cms-production-xxxx.up.railway.app,https://frontend-cram-production-xxxx.up.railway.app
   ```
3. Backend will automatically redeploy

**Important:** No spaces after commas

---

## Step 7: Verify Deployment

### Backend Health Check
```bash
curl https://your-backend-url/health
# Should return: {"status":"ok"}
```

### CMS Test
1. Open your CMS URL
2. Should redirect to `/login`
3. Login with Supabase admin credentials
4. Create a test situation
5. Verify it saves successfully

### CRAM Test
1. Open your CRAM URL
2. Navigate to situations
3. Should load data from backend API
4. No login required

### Check Logs
- Click on any service
- View **Deployments** tab for build logs
- View **Observability** tab for runtime logs

---

## Environment Variables Reference

### Backend

| Variable | Example | Required | Notes |
|----------|---------|----------|-------|
| `NODE_ENV` | `production` | Yes | Set to production |
| `PORT` | `8080` | Yes | Railway listens on this port |
| `DATABASE_URL` | Auto-set | Yes | Provided by Railway PostgreSQL |
| `CORS_ORIGIN` | `https://cms.app,https://cram.app` | Yes | Comma-separated frontend URLs |
| `SUPABASE_URL` | `https://xxx.supabase.co` | Yes | From Supabase dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...` | Yes | Secret key from Supabase |
| `OPENAI_API_KEY` | `sk-...` | No | For AI features |
| `GEMINI_API_KEY` | `...` | No | For AI features |

### Frontend-CMS

| Variable | Example | Required | Notes |
|----------|---------|----------|-------|
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | Yes | From Supabase dashboard |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGci...` | Yes | Public anon key |
| `VITE_API_URL` | `https://backend.railway.app` | Yes | Your Railway backend URL |

### Frontend-CRAM

| Variable | Example | Required | Notes |
|----------|---------|----------|-------|
| `VITE_API_URL` | `https://backend.railway.app` | Yes | Your Railway backend URL |

---

## Railway CLI (Optional)

Install Railway CLI for local testing and advanced operations:

```bash
# Install CLI
npm i -g @railway/cli

# Login
railway login

# Link to your project
railway link

# View logs
railway logs

# Run commands in Railway environment
railway run npm run backend:dev
```

Official docs: https://docs.railway.com/guides/cli

---

## How Deployments Work

### Automatic Deployments
- Push to `main` branch → Railway auto-deploys all services
- Each service only rebuilds if files in its watch paths change
- Migrations run automatically via backend's `startCommand`

### Build Process
1. Railway pulls latest code from GitHub
2. Runs `npm install` at repo root (installs all workspaces)
3. Executes `buildCommand` from each service's `railway.json`
4. For backend: Runs shared build, Prisma generate, backend build
5. For frontends: Runs shared build, then Vite build
6. Backend: Starts with `startCommand` (runs migrations first)
7. Frontends: Serves static files from `dist` folder

### Configuration Files
Each service has a `railway.json` that defines:
- **Builder**: `RAILPACK` (Railway's native builder, no Docker needed)
- **Build Command**: How to build the service
- **Start Command** (backend only): How to run the service
- **Static Publish Path** (frontends only): Where static files are located

---

## Database Management

### Connecting Locally

1. Get database connection string:
   - Go to **PostgreSQL service** → **Variables** tab
   - Copy `DATABASE_URL` value

2. Connect with psql:
   ```bash
   psql "postgresql://postgres:password@region.railway.app:5432/railway"
   ```

3. Or use Prisma Studio:
   ```bash
   export DATABASE_URL="postgresql://..."
   cd src/backend
   npx prisma studio
   ```

### Running Migrations Manually

```bash
# Set DATABASE_URL from Railway
export DATABASE_URL="postgresql://..."

# Run migrations
cd src/backend
npx prisma migrate deploy --schema prisma/schema.prisma
```

**Note:** Migrations run automatically on backend startup, so manual runs are rarely needed.

### Database Backups

Railway provides automatic daily backups:
1. Go to **PostgreSQL service** → **Backups** tab
2. Download backups or restore to a point in time

---

## Troubleshooting

### Build Fails

**Issue:** Service shows "Build failed"

**Solutions:**
- Check **Deployments** tab for build logs
- Verify `railway.json` configuration is correct
- Ensure all dependencies are in `package.json`
- Test build locally: `npm run shared:build && npm run backend:build`
- Check that root directory and watch paths are set correctly

### Backend Won't Start

**Issue:** Backend deploys but crashes

**Solutions:**
- Check **Observability** logs for errors
- Verify `DATABASE_URL` exists in Variables tab
- Ensure migrations ran successfully (check startup logs)
- Verify server listens on `process.env.PORT`
- Check Prisma Client is generated

### Database Connection Fails

**Issue:** Backend can't connect to database

**Solutions:**
- Verify PostgreSQL service is running
- Check `DATABASE_URL` format is correct
- Ensure backend and database are in same project
- Look for connection errors in logs

### Prisma Migrations Fail

**Issue:** Migrations fail on startup

**Solutions:**
- Check migration files exist in `src/backend/prisma/migrations/`
- Verify `DATABASE_URL` is accessible
- Run `npx prisma generate` locally to test
- Check logs for specific Prisma errors
- Ensure `prisma:migrate:deploy` command is in `startCommand`

### Frontend Build Fails

**Issue:** Frontend deployment fails

**Solutions:**
- Verify `buildCommand` includes `npm run shared:build`
- Check that Node version is compatible (20+)
- Ensure all `VITE_` env vars are set
- Test local build: `npm run cms:build` or `npm run cram:build`
- Check build logs for TypeScript errors

### CORS Errors

**Issue:** Browser shows CORS errors when accessing API

**Solutions:**
- Verify `CORS_ORIGIN` in backend Variables tab
- Ensure frontend URLs are exact (no trailing slashes)
- URLs must be comma-separated with no spaces
- Check backend logs for CORS-related messages
- Temporarily set `CORS_ORIGIN=*` to test (not for production!)

### CMS Login Fails

**Issue:** Can't login to CMS

**Solutions:**
- Verify admin user exists in Supabase dashboard
- Check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in CMS variables
- Verify `SUPABASE_SERVICE_ROLE_KEY` in backend variables
- Look for errors in browser console
- Test Supabase connection separately

### Static Site 404 Errors

**Issue:** Frontend shows 404 for routes

**Solutions:**
- Ensure Vue Router is in "history" mode for SPA routing
- Check that `staticPublishPath` points to correct `dist` folder
- Add a `_redirects` file if using client-side routing
- Verify build actually produces `dist` folder

---

## Updating Deployments

### Code Changes
1. Push to `main` branch:
   ```bash
   git push origin main
   ```
2. Railway auto-deploys affected services
3. Watch logs in Railway dashboard

### Schema Changes
1. Create migration locally:
   ```bash
   npm run prisma:migrate:dev
   ```
2. Commit migration files:
   ```bash
   git add src/backend/prisma/migrations/
   git commit -m "Add migration"
   git push origin main
   ```
3. Backend auto-deploys and runs migrations

### Environment Variables
1. Update in Railway dashboard → Service → **Variables**
2. Service automatically redeploys with new values

---

## Production Checklist

Before going live:

- [ ] Supabase admin user created
- [ ] PostgreSQL database running in Railway
- [ ] Backend deployed: `/health` endpoint returns OK
- [ ] Backend environment variables set (including Supabase keys)
- [ ] Frontend-CMS deployed and login works
- [ ] Frontend-CRAM deployed and loads data
- [ ] CORS configured with actual frontend URLs (no `*`)
- [ ] Watch paths configured to prevent unnecessary rebuilds
- [ ] Custom domains configured (optional)
- [ ] Database backups enabled (automatic in Railway)
- [ ] No errors in browser console
- [ ] No errors in Railway service logs
- [ ] End-to-end test: Create content in CMS, view in CRAM

---

## Custom Domains (Optional)

To use your own domains instead of Railway-generated URLs:

1. Go to service → **Settings** → **Networking**
2. Click **"Custom Domain"**
3. Enter your domain (e.g., `api.yourdomain.com`)
4. Add DNS records shown by Railway to your DNS provider
5. Railway automatically provisions SSL certificates

Repeat for each service (backend, CMS, CRAM).

---

## Resources

- **Railway Docs**: https://docs.railway.com
- **Railway Monorepo Guide**: https://docs.railway.com/guides/monorepo
- **Railway CLI**: https://docs.railway.com/guides/cli
- **Supabase Docs**: https://supabase.com/docs
- **Prisma Deployment**: https://www.prisma.io/docs/orm/prisma-client/deployment

For application-specific setup:
- `README.md` - Project overview and local development
- `src/backend/API.md` - API documentation
- `SUPABASE_AUTH_SETUP.md` - Authentication configuration
