# Vercel Deployment Guide

This document outlines the steps to deploy the DermaDAO application to Vercel.

## Project Structure

- `frontend/` - Next.js frontend application
- `backend/src/` - Express API converted to Vercel serverless functions
- `vercel.json` - Vercel configuration file

## Pre-Deployment Checklist

1. Ensure all environment variables are set up in Vercel (see `.env.example` for required variables)
2. Make sure you have the Vercel CLI installed: `npm install -g vercel`

## Deployment Steps

### 1. Login to Vercel

```bash
vercel login
```

### 2. Link your project

```bash
vercel link
```

### 3. Set up environment variables

You can set environment variables in the Vercel dashboard or using the CLI:

```bash
vercel env add DATABASE_URL
vercel env add JWT_SECRET
# Add other required environment variables
```

### 4. Deploy

```bash
vercel --prod
```

### One-Shot Deployment Command

If you're already logged in and have your environment variables set up in the Vercel dashboard, you can deploy with a single command:

```bash
vercel --prod
```

## Checking Deployment Status

After deployment, you can check the status with:

```bash
vercel ls
```

## Troubleshooting

- If you encounter issues with serverless functions, check the function logs in the Vercel dashboard
- Make sure all required environment variables are correctly set up
- Verify database connections and ensure your database allows connections from Vercel's IP ranges
