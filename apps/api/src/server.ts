// Sentry MUST be initialized before any other application code.
// This file is the process entrypoint so it runs first.
import './observability.js';

// This file MUST be the first thing loaded. It reads .env before any other
// module (including @crudd/database) is imported, so DATABASE_URL is set
// by the time PrismaPg creates its pg.Pool.
import 'dotenv/config';

// Dynamic import ensures @crudd/database is loaded AFTER dotenv has run.
// Wrapped in a void IIFE so this works in both CJS and ESM output formats.
void (async () => {
  await import('./index.js');
})();
