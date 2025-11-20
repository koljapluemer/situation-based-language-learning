# Deployment Guide: Render.com + Netlify

Complete step-by-step guide to deploy the Situation-Based Language Learning application.

## Architecture Overview

- **Render.com**: Backend API + PostgreSQL Database
- **Netlify**: Frontend-CMS + Frontend-CRAM (static sites)
- **Supabase**: Authentication only (no database)

---

## Prerequisites

- GitHub account
- Render.com account (https://dashboard.render.com/register)
- Netlify account (https://app.netlify.com/signup)
- Supabase project created (ID: `yxhprmlbuzfdsbauiwbk`)
- Repository pushed to GitHub

---

## Step 1: Supabase Setup (If Not Done)

1. Go to https://supabase.com/dashboard/project/yxhprmlbuzfdsbauiwbk/settings/api
2. Copy these values:
   - **Project URL**: `https://yxhprmlbuzfdsbauiwbk.supabase.co`
   - **anon public key**: For frontend-cms
   - **service_role secret key**: For backend (keep secret!)

3. Create admin user:
   - Go to Authentication → Users → Add User
   - Enter email and password
   - Save credentials for CMS login

---

## Step 2: Push render.yaml to GitHub

The `render.yaml` file in your repo root defines your infrastructure:

```yaml
services:
  - type: web
    name: sbll-backend
    runtime: docker
    plan: starter
    region: frankfurt
    rootDir: src/backend
    dockerfilePath: ./Dockerfile
    dockerContext: ../..
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 8080
      - key: CORS_ORIGIN
        sync: false
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
      - key: OPENAI_API_KEY
        sync: false
      - key: GEMINI_API_KEY
        sync: false
    preDeployCommand: npx prisma migrate deploy --schema prisma/schema.prisma

databases:
  - name: sbll-db
    databaseName: sbll
    user: sbll_user
    plan: starter
    region: frankfurt
```

**Ensure this file is committed and pushed to GitHub:**

```bash
git add render.yaml
git commit -m "Add Render.com configuration"
git push origin main
```

---

## Step 3: Create Render.com Account & Connect Repository

1. Go to https://dashboard.render.com/register
2. Sign up with GitHub (recommended for easier repo connection)
3. Once logged in, click **"New +"** → **"Blueprint"**
4. Connect your GitHub repository
5. Select the repository: `situation-based-language-learning`
6. Render auto-detects `render.yaml` and shows the infrastructure plan
7. Review:
   - **Web Service**: sbll-backend (Starter plan, $7/month)
   - **PostgreSQL**: sbll-db (Starter plan, $7/month)
   - **Total**: $14/month

8. Click **"Apply"**

Render will:
- Create the PostgreSQL database
- Create the web service
- Set `DATABASE_URL` environment variable automatically
- Start the first deployment

---

## Step 4: Configure Environment Variables

After the blueprint is applied, you need to set the secret environment variables (marked with `sync: false`).

1. Go to **Dashboard** → **sbll-backend** service
2. Click **"Environment"** tab
3. Add the following environment variables:

```bash
CORS_ORIGIN=http://localhost:5173,http://localhost:5174
SUPABASE_URL=https://yxhprmlbuzfdsbauiwbk.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aHBybWxidXpmZHNiYXVpd2JrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzU2NDczOCwiZXhwIjoyMDc5MTQwNzM4fQ.C1Gd3QAAlQLmQ2ArH2bov7Lm8CMVyepwGybuLes4ALg
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
```

**Important:**
- Set `CORS_ORIGIN` to localhost for initial testing
- You'll update it with actual frontend URLs in Step 7

4. Click **"Save Changes"**
5. The service will automatically redeploy with the new variables

---

## Step 5: Monitor Initial Deployment

1. Go to **Dashboard** → **sbll-backend**
2. Click **"Logs"** tab
3. Watch the deployment process:
   - Building Docker image (2-5 minutes)
   - Running pre-deploy command (Prisma migrations)
   - Starting service

4. Wait for the status to show **"Live"** (green dot)

5. Note your backend URL: `https://sbll-backend.onrender.com`

6. Test the health endpoint:
   ```bash
   curl https://sbll-backend.onrender.com/health
   # Should return: {"status":"ok"}
   ```

**Troubleshooting:**
- If deployment fails, check the **"Logs"** tab for errors
- Common issues:
  - Prisma migration errors (check database connection)
  - Build errors (check Dockerfile and dependencies)
  - Port configuration (ensure server listens on `process.env.PORT`)

---

## Step 6: Deploy Frontend-CMS to Netlify

### 6A. Create Site

1. Go to [Netlify Dashboard](https://app.netlify.com)
2. Click **"Add new site"** → **"Import an existing project"**
3. Connect to your GitHub repository
4. Configure build settings:
   - **Branch**: `main`
   - **Base directory**: Leave blank
   - **Build command**: `npm run shared:build && npm run cms:build`
   - **Publish directory**: `src/frontend-cms/dist`

### 6B. Environment Variables

Go to **Site configuration** → **Environment variables** and add:

```bash
VITE_SUPABASE_URL=https://yxhprmlbuzfdsbauiwbk.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_API_URL=https://sbll-backend.onrender.com
```

**Important:** Use your Render backend URL from Step 5.

### 6C. Deploy

1. Click **"Deploy site"**
2. Wait for build to complete (2-3 minutes)
3. Note your CMS URL: `https://your-cms.netlify.app`

### 6D. Verify CMS

1. Open your CMS URL
2. Should redirect to `/login`
3. Try logging in with Supabase admin credentials
4. Check browser console for errors

---

## Step 7: Deploy Frontend-CRAM to Netlify

### 7A. Create Site

1. Go to Netlify Dashboard → **"Add new site"**
2. Connect to same GitHub repository
3. Configure build settings:
   - **Branch**: `main`
   - **Base directory**: Leave blank
   - **Build command**: `npm run shared:build && npm run cram:build`
   - **Publish directory**: `src/frontend-cram/dist`

### 7B. Environment Variables

Go to **Site configuration** → **Environment variables** and add:

```bash
VITE_API_URL=https://sbll-backend.onrender.com
```

**Note:** CRAM doesn't need Supabase credentials (public app).

### 7C. Deploy

1. Click **"Deploy site"**
2. Wait for build to complete
3. Note your CRAM URL: `https://your-cram.netlify.app`

### 7D. Verify CRAM

1. Open your CRAM URL
2. Should show landing page
3. Try navigating to situations
4. Check browser console for errors

---

## Step 8: Update Backend CORS

Now that frontends are deployed, update backend CORS to specific URLs:

1. Go to **Render Dashboard** → **sbll-backend** → **"Environment"**
2. Update `CORS_ORIGIN`:
   ```
   https://your-cms.netlify.app,https://your-cram.netlify.app
   ```
3. Click **"Save Changes"**

**Important:**
- No spaces after comma
- Use your actual Netlify URLs
- Backend will automatically redeploy with new CORS settings

---

## Step 9: Final Verification

### CMS End-to-End Test

1. Open CMS: `https://your-cms.netlify.app`
2. Login with admin credentials
3. Create a new situation
4. Verify it appears in the list
5. Check Render logs: **Dashboard** → **sbll-backend** → **"Logs"**

### CRAM End-to-End Test

1. Open CRAM: `https://your-cram.netlify.app`
2. Navigate to situations
3. Verify situations load from API
4. No login required

### Check for Errors

- **Browser console**: No CORS errors
- **Render logs**: Requests from both frontends
- **Network tab**: All API calls succeed (200/201 status)

---

## Render CLI Commands Reference

### Installation

```bash
# Install Render CLI
npm install -g @render-oss/cli

# Login
render login
```

### Logs & Monitoring

```bash
# View logs (real-time)
render logs -s sbll-backend

# View service status
render service get sbll-backend

# List all services
render services list
```

### Database Management

```bash
# Connect to database (psql)
render psql sbll-db

# Get database connection info
render database get sbll-db
```

### Deployment

```bash
# Trigger manual deploy
render deploy -s sbll-backend

# Suspend service (stop temporarily)
render service suspend sbll-backend

# Resume service
render service resume sbll-backend
```

### Environment Variables

```bash
# List environment variables
render env-vars list -s sbll-backend

# Set environment variable
render env-vars set -s sbll-backend KEY=value

# Delete environment variable
render env-vars delete -s sbll-backend KEY
```

---

## Environment Variables Reference

### Backend (Render.com)

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | Set in render.yaml |
| `PORT` | `8080` | Set in render.yaml |
| `DATABASE_URL` | Auto-set | By Render database connection |
| `CORS_ORIGIN` | `https://cms.app,https://cram.app` | Update in Step 8 |
| `SUPABASE_URL` | `https://xxx.supabase.co` | From Supabase dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...` | Secret key from Supabase |
| `OPENAI_API_KEY` | `sk-...` | Optional (AI features) |
| `GEMINI_API_KEY` | `...` | Optional (AI features) |

### Frontend-CMS (Netlify)

| Variable | Value | Notes |
|----------|-------|-------|
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | From Supabase dashboard |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGci...` | Public anon key |
| `VITE_API_URL` | `https://backend.onrender.com` | Your Render backend URL |

### Frontend-CRAM (Netlify)

| Variable | Value | Notes |
|----------|-------|-------|
| `VITE_API_URL` | `https://backend.onrender.com` | Your Render backend URL |

---

## Troubleshooting

### Backend Build Fails

**Issue:** Docker build fails on Render

**Solutions:**
- Check build logs in Render dashboard
- Verify Dockerfile path in render.yaml: `dockerfilePath: ./Dockerfile`
- Ensure `dockerContext: ../..` is correct (repo root for shared package)
- Check that all dependencies are in package.json
- Test local Docker build: `docker build -f src/backend/Dockerfile .`

### Backend Won't Start

**Issue:** Service shows "Deploy failed"

**Solutions:**
- Check logs in Render dashboard
- Verify `DATABASE_URL` is set automatically (check Environment tab)
- Ensure migrations ran successfully (check pre-deploy logs)
- Verify server listens on `process.env.PORT` (should be 8080)
- Check for runtime errors in logs

### Database Connection Fails

**Issue:** Backend can't connect to database

**Solutions:**
- Verify database is running: Check **Dashboard** → **sbll-db** status
- Check `DATABASE_URL` is set: **sbll-backend** → **"Environment"**
- Ensure both backend and database are in same region (frankfurt)
- Check database connection logs in Render dashboard

### Prisma Migrations Fail

**Issue:** Pre-deploy command fails

**Solutions:**
- Check pre-deploy logs in deployment details
- Verify migration files exist in `src/backend/prisma/migrations/`
- Run `npx prisma generate` locally to ensure Prisma Client is up to date
- Check database is accessible during pre-deploy phase
- Ensure DATABASE_URL format is correct

### Frontend Build Fails

**Issue:** Netlify build fails

**Solutions:**
- Check Netlify build logs
- Verify build command includes `npm run shared:build &&`
- Ensure Node version is 20 (check netlify.toml or set in Netlify UI)
- Check all `VITE_` env vars are set in Netlify
- Test local build: `npm run cms:build` or `npm run cram:build`

### CORS Errors

**Issue:** Browser shows CORS errors

**Solutions:**
- Check `CORS_ORIGIN` in Render: **sbll-backend** → **"Environment"**
- Ensure frontend URLs are correct (no trailing slashes)
- Verify URLs are comma-separated with no spaces
- Check Render logs for CORS-related errors
- Test with `CORS_ORIGIN=*` temporarily to isolate issue

### CMS Login Fails

**Issue:** Can't login to CMS

**Solutions:**
- Verify admin user created in Supabase dashboard
- Check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Netlify
- Check `SUPABASE_SERVICE_ROLE_KEY` in Render environment
- Look for errors in browser console
- Test Supabase connection separately

### Slow First Request

**Issue:** First request after inactivity is slow

**Explanation:**
- Render Starter plan keeps services running (no sleep)
- If you're on Free plan: Services spin down after 15 min inactivity
- First request takes 30-60 seconds to wake up

**Solutions:**
- Upgrade to Starter plan ($7/month) for always-on
- Accept slow first request as free tier behavior
- Use cron job to ping health endpoint every 10 minutes (workaround for free tier)

---

## Render.com Pricing

### Development/Testing (Free Tier)

- Render Web Service: Free (with 15-min sleep)
- Render PostgreSQL: Free for 90 days, then must upgrade
- Netlify CMS: Free
- Netlify CRAM: Free
- **Total: $0/month for first 90 days**
- **Limitation: Backend sleeps, database expires**

### Production (Always-On)

- Render Web Service (Starter): $7/month
- Render PostgreSQL (Starter): $7/month
- Netlify (2 sites): Free
- **Total: $14/month**

---

## Updating Deployments

### Backend Updates

1. Push code to `main` branch:
   ```bash
   git push origin main
   ```
2. Render auto-deploys on push
3. Check deployment logs in Render dashboard
4. If schema changes: Migrations run automatically via pre-deploy command

### Frontend Updates

1. Push code to `main` branch:
   ```bash
   git push origin main
   ```
2. Netlify auto-deploys from GitHub
3. Check Netlify deploy logs
4. Clear browser cache if needed

### Database Migrations

**For schema changes:**

1. Develop locally:
   ```bash
   npm run prisma:migrate:dev
   ```

2. Commit migration files in `src/backend/prisma/migrations/`
   ```bash
   git add src/backend/prisma/migrations/
   git commit -m "Add new migration"
   ```

3. Push to GitHub:
   ```bash
   git push origin main
   ```

4. Render automatically runs migrations via pre-deploy command

---

## Manual Operations

### Connect to Database Locally

```bash
# Get database connection string from Render dashboard
# Dashboard → sbll-db → "Info" → "External Database URL"

# Connect with psql
psql postgresql://sbll_user:password@dpg-xxxxx.frankfurt-postgres.render.com/sbll

# Or set DATABASE_URL and use Prisma
export DATABASE_URL="postgresql://sbll_user:password@dpg-xxxxx.frankfurt-postgres.render.com/sbll"
npx prisma studio
```

### Run Migrations Manually

```bash
# Get database connection string (see above)
export DATABASE_URL="postgresql://..."

# Run migrations
cd src/backend
npx prisma migrate deploy --schema prisma/schema.prisma
```

### View Database Contents

```bash
# Option 1: Prisma Studio (local)
export DATABASE_URL="postgresql://..."
cd src/backend
npx prisma studio

# Option 2: psql (command line)
psql $DATABASE_URL
```

---

## Production Checklist

Before going live:

- [ ] Supabase admin user created
- [ ] Backend deployed: `https://sbll-backend.onrender.com/health` returns OK
- [ ] Database migrations applied (automatic via pre-deploy)
- [ ] Frontend-CMS deployed and login works
- [ ] Frontend-CRAM deployed and loads data
- [ ] CORS configured with actual frontend URLs
- [ ] All environment variables/secrets set correctly
- [ ] No errors in browser console
- [ ] No errors in Render logs
- [ ] End-to-end test passed (create content in CMS, view in CRAM)

---

## Support

- **Render Docs**: https://render.com/docs
- **Render Community**: https://community.render.com
- **Netlify Docs**: https://docs.netlify.com
- **Supabase Docs**: https://supabase.com/docs

For application-specific issues, check:
- `README.md` - Project overview
- `src/backend/API.md` - API documentation
- `SUPABASE_AUTH_SETUP.md` - Auth configuration
