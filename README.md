# Stock Rating Platform

A React-based stock analysis UI that uses Claude (Anthropic's Messages API) as
its backend analysis engine.

## How this repo is structured

- `index.html` — the standalone frontend. React, ReactDOM, Babel Standalone,
  and Tailwind are loaded from CDNs. All JSX is transpiled in the browser. The
  Lucide-React icons are replaced with inline SVG stubs so no bundler is needed.
- `functions/api/analyze.js` — a Cloudflare Pages Function that proxies POST
  requests from the frontend to https://api.anthropic.com/v1/messages. The
  Anthropic API key lives on the server as a secret; it is never sent to the
  browser.
- `index.html.` — legacy file, no longer used. Safe to delete.

## Why you need the proxy

The browser cannot call `api.anthropic.com` directly. Anthropic blocks
cross-origin browser requests by default, and even if it did not, shipping your
API key in client-side code would expose it to everyone who loads the page.
The proxy function sits at `/api/analyze` on the same origin as your frontend,
so there is no CORS issue, and the key stays server-side.

## Deploying to Cloudflare Pages (recommended, free)

You must do these steps yourself. They involve creating an account and pasting
an API key, which should never be done on your behalf.

1. **Rotate your Anthropic API key.** Go to
   https://console.anthropic.com/settings/keys, revoke any old key that might
   have been exposed, and create a new one. Copy the new key somewhere safe.
2. **Create a Cloudflare account** at https://dash.cloudflare.com/sign-up if
   you do not already have one. The free tier is enough.
3. **Create a Pages project.** In the Cloudflare dashboard, go to
   Workers & Pages -> Create -> Pages -> Connect to Git. Authorize Cloudflare
   to access your GitHub account, then select
   `Babodebabo/Stock-rating-Platform`.
4. **Configure the build.** Framework preset: `None`. Build command: leave
   empty. Build output directory: `/` (the repo root, since the site is a
   single static file). Production branch: `main`. Click Save and Deploy.
5. **Add the API key secret.** After the first deploy, open the project's
   Settings -> Environment variables. Add a variable named
   `ANTHROPIC_API_KEY`, set its value to your new key, set the type to
   `Encrypted` (Secret), and apply it to the Production environment. Save.
6. **Redeploy** so the function picks up the new secret. Deployments tab ->
   click the latest deployment -> "Retry deployment".
7. **Visit your site** at the Cloudflare-provided URL (something like
   `stock-rating-platform.pages.dev`). Analysis should now work end to end.

### Optional: use your own domain

In the Cloudflare Pages project -> Custom domains, add your domain. Cloudflare
will create the necessary DNS records if your domain is also on Cloudflare.

## Running locally

You can open `index.html` directly in a browser for UI testing, but the
`/api/analyze` call will 404. To run the full stack locally:

```
npm install -g wrangler
wrangler pages dev . --compatibility-date=2024-01-01
```

Then set the secret for local dev:

```
wrangler pages secret put ANTHROPIC_API_KEY
```

Visit http://localhost:8788 and the function will be reachable at
`/api/analyze`.

## Security notes

- Never commit your API key to this repo. It's a public repo; secrets leak
  instantly and bots scrape GitHub.
- The proxy enforces a default model and clamps `max_tokens` so a malicious
  user of your public site cannot run up large bills by requesting huge
  completions. Tune these limits in `functions/api/analyze.js` as needed.
- If you tighten the `ALLOWED_ORIGINS` array in that same file from `"*"` to
  your actual domain, cross-origin abuse becomes harder too.

## Why not GitHub Pages?

GitHub Pages only serves static files. Any POST request to `/api/analyze`
returns `405 Method Not Allowed` because there is no server-side runtime. If
you want to keep the frontend on GitHub Pages, you can run just the proxy on a
separate Cloudflare Worker and change the four `fetch("/api/analyze", ...)`
calls in `index.html` to point at the Worker's URL (e.g.
`https://stock-proxy.<your-subdomain>.workers.dev`). You would also need to
tighten CORS in the Worker to allow your GitHub Pages origin.
