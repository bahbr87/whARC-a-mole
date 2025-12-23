import { createClient } from '@supabase/supabase-js';

// ⚠️ SECURITY: This file uses SUPABASE_SERVICE_ROLE_KEY which should NEVER be exposed to the client
// This client should ONLY be used in server-side code (API routes, server components, etc.)
// If you need a client-side Supabase client, create a separate file using NEXT_PUBLIC_SUPABASE_ANON_KEY

// Validate that we're in a server environment
if (typeof window !== 'undefined') {
  throw new Error(
    '❌ SECURITY ERROR: lib/supabase.ts uses SUPABASE_SERVICE_ROLE_KEY and must only be imported in server-side code. ' +
    'Never import this file in client components. Use a separate client-side Supabase client with anon key instead.'
  );
}

// Get env vars (allow build to succeed even if not set)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create client only if both vars are set (will be validated at runtime in API routes)
export const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : (() => {
      // Return a mock client that throws on use (for build time)
      return {
        from: () => {
          throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables. Please configure your .env.local file.');
        }
      } as any;
    })();

