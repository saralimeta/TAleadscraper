// Vercel Edge Middleware — gates the entire site behind a single shared
// password via HTTP Basic Auth (browser's native login popup), so nobody
// needs an account. Runs before every request, including static assets
// and API routes.

export const config = {
  matcher: "/:path*",
};

export default function middleware(request) {
  const authHeader = request.headers.get("authorization");

  if (authHeader?.startsWith("Basic ")) {
    const encoded = authHeader.slice("Basic ".length);
    const decoded = atob(encoded);
    const password = decoded.slice(decoded.indexOf(":") + 1);

    if (password && password === process.env.SITE_PASSWORD) {
      return;
    }
  }

  return new Response("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="TradeAnchor Lead Scraper"' },
  });
}
