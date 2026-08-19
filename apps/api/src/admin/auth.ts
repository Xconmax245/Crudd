import type { FastifyRequest, FastifyReply } from 'fastify';
import { db, AdminUser } from '@crudd/database';
import { Errors } from './errors';

/**
 * Admin authentication + authorization (directives #2, #3).
 *
 * Security boundary: the API is authoritative. We never trust frontend route
 * guards, localStorage flags, or client-sent roles. Flow:
 *
 *   Bearer token -> verify with Supabase -> AdminUser lookup
 *     -> isActive check -> role check -> authorized admin request
 */

export interface AdminContext {
  adminUser: Pick<AdminUser, 'id' | 'email' | 'role' | 'displayName' | 'isActive'>;
  authUserId: string;
}

// Augment Fastify request with the resolved admin context.
declare module 'fastify' {
  interface FastifyRequest {
    admin?: AdminContext;
  }
}

interface SupabaseUser {
  id: string;
  email?: string;
}

/**
 * Verify a Supabase access token by calling the Auth user endpoint.
 * Returns the Supabase user, or null when the token is invalid/expired.
 */
async function verifySupabaseToken(token: string): Promise<SupabaseUser | null> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    throw Errors.internal('Supabase auth is not configured on the server');
  }

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as SupabaseUser;
    return user?.id ? user : null;
  } catch {
    return null;
  }
}

/** Extract a Bearer token from the Authorization header. */
function getBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

const AUTHORIZED_ROLES = new Set(['ADMIN', 'SUPER_ADMIN']);

/**
 * Bootstrap provisioning: allow-listed emails (comma-separated in
 * ADMIN_BOOTSTRAP_EMAILS) are auto-provisioned as ADMIN on first authenticated
 * request. This avoids hardcoding a single admin email throughout the app while
 * still giving a way to create the very first AdminUser.
 */
async function resolveAdminUser(authUserId: string, email?: string) {
  let adminUser = await db.adminUser.findUnique({ where: { authUserId } });

  if (!adminUser && email) {
    const bootstrap = (process.env.ADMIN_BOOTSTRAP_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (bootstrap.includes(email.toLowerCase())) {
      adminUser = await db.adminUser.upsert({
        where: { email },
        update: { authUserId, isActive: true },
        create: { authUserId, email, role: 'SUPER_ADMIN', isActive: true },
      });
    }
  }

  return adminUser;
}

/**
 * Fastify preHandler that authenticates + authorizes an admin request.
 * Attaches `request.admin` on success; throws ApiError otherwise.
 */
export async function requireAdmin(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const token = getBearerToken(request);
  if (!token) throw Errors.unauthenticated();

  const supabaseUser = await verifySupabaseToken(token);
  if (!supabaseUser) throw Errors.unauthenticated('Invalid or expired session');

  const adminUser = await resolveAdminUser(supabaseUser.id, supabaseUser.email);
  if (!adminUser) throw Errors.forbidden('This account is not an administrator');
  if (!adminUser.isActive) throw Errors.forbidden('This administrator account is deactivated');
  if (!AUTHORIZED_ROLES.has(adminUser.role)) throw Errors.forbidden('Insufficient role');

  request.admin = {
    authUserId: supabaseUser.id,
    adminUser: {
      id: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
      displayName: adminUser.displayName,
      isActive: adminUser.isActive,
    },
  };
}
