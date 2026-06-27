# SEET Election System — Setup & Deployment Guide

## What You're Setting Up
A secure online voting system for the School of Engineering & Engineering Technology student elections. Students authenticate with their matric number + a one-time token sent via SMS.

---

## Step 1 — Create Your Database (Supabase)

Supabase is a free online database. It stores your voters, tokens, and votes.

1. Go to **https://supabase.com** and create a free account
2. Click **New Project** → give it a name like `seet-election`
3. Choose a strong database password (save it somewhere)
4. Wait for it to set up (~1 minute)
5. Go to **SQL Editor** (left sidebar)
6. Open the file `database.sql` from this project
7. Paste it into the SQL editor and  click **Run**
8. ✅ Your database is ready

**Get your API keys:**
- Go to **Settings → API** in your Supabase project
- Copy: `Project URL`, `anon public` key, `service_role` key (keep this secret!)

---

## Step 2 — Set Up SMS (Termii)

Termii is a Nigerian SMS provider. This is how tokens get to students.

1. Go to **https://termii.com** and create an account
2. Verify your account and top up with some credit (very cheap per SMS)
3. Go to **Settings → API Key** and copy your key
4. Under **Sender ID**, request `SEETVote` as your sender name (or use your faculty name)

---

## Step 3 — Deploy to Vercel (Free Hosting)

1. Go to **https://github.com** and create a free account if you don't have one
2. Create a new repository called `seet-election`
3. Upload all the project files to that repository
4. Go to **https://vercel.com** and sign in with GitHub
5. Click **Add New Project** → select your `seet-election` repository
6. Before deploying, click **Environment Variables** and add these:

```
NEXT_PUBLIC_SUPABASE_URL        = (from Supabase)
NEXT_PUBLIC_SUPABASE_ANON_KEY   = (from Supabase)
SUPABASE_SERVICE_ROLE_KEY       = (from Supabase — keep secret)
ADMIN_KEY                       = (make up a strong password)
TERMII_API_KEY                  = (from Termii)
TERMII_SENDER_ID                = SEETVote
NEXT_PUBLIC_APP_URL             = https://seet-election.vercel.app
```

7. Click **Deploy**
8. ✅ Your site is live at `https://seet-election.vercel.app`

---

## Step 4 — Before Election Day

### 4a. Prepare your voter CSV file
Create a file (or copy from Excel) with these columns:

```
matric_number,full_name,department,level,phone
ENG/2021/001,John Adewale Doe,Civil Engineering,400,08012345678
ENG/2022/045,Jane Chioma Smith,Electrical Engineering,300,07098765432
```

### 4b. Upload voters and send tokens
1. Go to `https://your-site.vercel.app/admin`
2. Log in with your `ADMIN_KEY`
3. Go to **Voters** tab
4. Paste your CSV into the upload box
5. Click **Upload & Generate Tokens** — each student gets a unique token
6. Click **Send Tokens via SMS** — every student gets an SMS with their token

### 4c. Update candidate names
Replace the placeholder names in `database.sql` with real candidates before seeding, or update them directly in Supabase's Table Editor.

---

## Step 5 — On Election Day

1. Go to Admin Panel → **Dashboard**
2. Click **Open Election** — voting is now live
3. Students visit `https://your-site.vercel.app` and vote
4. Watch the **Dashboard** for live turnout numbers
5. When done, click **Close Election**
6. Check **Results** tab for the outcome

---

## How the Token System Works (Simple Explanation)

```
BEFORE ELECTION:
Student registered at Secretariat
→ System generates a unique token (e.g. A3F7-K2P9)
→ Token sent to student's phone via SMS

ON ELECTION DAY:
Student visits the website
→ Enters matric number + token
→ System checks: is this a real student? ✓
→ System checks: has this token been used? ✗ (first time)
→ System checks: has this person voted? ✗ (first time)
→ Token is marked as used (can't be used again)
→ Student votes
→ Student marked as "Voted" (can't vote again)
```

---

## Security Summary

| What could go wrong | How we prevent it |
|---|---|
| Random person votes | Token only sent to verified students |
| Student votes twice | Token invalidated after first use |
| Someone steals a token | One-time use — useless after voting |
| Fake matric numbers | Only uploaded matric numbers work |
| Admin tampering | Votes are stored separately from voter identity |

---

## Need Help?

Contact the developer or check the code comments for guidance.
