/** Backend origin. Used directly for Socket.IO, the public widget and embed snippets. */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

/**
 * Base for credentialed HTTP calls from the browser. They go to this site's own origin and Next.js
 * rewrites /api/* to the backend (see next.config.ts), so the session cookie is first-party and isn't
 * blocked as a third-party cookie when the dashboard and API live on different domains.
 */
export const httpBase = () => (typeof window === "undefined" ? API_URL : window.location.origin);
