# AI4Autism Video Modeling

Production-focused Next.js application for autism intervention workflows:

- Parent/Teacher role flows
- Video upload + metadata tagging
- Firestore-based data model
- AI assistance via Gemini server actions

## Runtime Baseline

- Node.js: 22.x
- Package manager: npm (lockfile-based install)
- Framework: Next.js 16

## Project Structure

- App Router root: `src/app`
- Main page entry: `src/app/page.tsx`
- Core services: `src/lib/services`

## Setup

1. Install dependencies

```bash
npm ci
```

2. Create environment file

```bash
cp .env.example .env
```

3. Fill real values in `.env`

4. Start development server

```bash
npm run dev
```

Open http://localhost:3000

## Environment Variables

Required keys:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `GOOGLE_GEMINI_API_KEY`
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
- `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`

Optional keys:

- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`
- `NEXT_PUBLIC_CLOUDINARY_MAX_FILE_SIZE_MB` (set `> 0` to enforce client-side cap; leave empty to rely on Cloudinary preset/plan limits)
- `NEXT_PUBLIC_ADMIN_USER_IDS` (comma-separated extra admin IDs; defaults already include `PH_admin,GV_admin`)

## Verify Before Merge

Run these commands locally and keep logs when debugging CI/runtime issues:

```bash
npm run lint
npm run build
```

Expected outcome:

- `npm run lint` exits 0
- `npm run build` exits 0

## Production Notes

- Do not commit real `.env` values.
- Keep service credentials outside source control.
- Validate Cloudinary upload preset restrictions (size/type/rate limit) before production release.
- Treat all AI responses as untrusted text and validate output shape before storing or rendering.
