# Robin.ai deployment

## Make the app publicly accessible

If your Vercel project has **Deployment Protection** enabled, only logged-in Vercel users can open the app. To allow anyone to test it:

1. Open [Vercel Dashboard](https://vercel.com) → **robin-ai** project.
2. Go to **Settings** → **Deployment Protection**.
3. For **Production**, set protection to **Disabled** (or "Only Preview Deployments" so production is public, preview stays protected).
4. Save. The production URL will then load without Vercel login.

## Production URL

After deployment, your app is at:

- **Production:** `https://robin-ai-abhishek-vyas-projects.vercel.app`  
  (or the custom domain you set in Vercel)

## Quick test (after protection is off)

1. Open the production URL → you should see the mode select (Post-Meeting / Pre-Meeting Prep / Pitch Stress-Test).
2. Click **Start** on any mode → Input screen with three streams and BYOK settings.
3. Paste 200+ characters in any stream (e.g. Pitch Material), add your OpenAI/Anthropic API key, click **Run Robin**.
4. You should see the 4-layer progress then the analysis report (Evidence Map, GRUE, Red/Yellow lists, etc.).

## Env vars

Ensure these are set in Vercel (**Settings** → **Environment Variables**):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Then redeploy once so the build picks them up.
