import { createClient } from "@supabase/supabase-js";

// Get env vars (allow build to succeed even if not set)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Frontend (uso seguro)
export const supabase = supabaseUrl && anonKey
  ? createClient(supabaseUrl, anonKey)
  : (() => {
      // Return a mock client for build time
      return {
        from: () => {
          throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set in environment variables.');
        }
      } as any;
    })();

// Backend (service role, acesso completo)
export const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey)
  : (() => {
      // Return a mock client for build time
      return {
        from: () => {
          throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables.');
        }
      } as any;
    })();

