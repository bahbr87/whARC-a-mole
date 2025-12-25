import { createClient } from '@supabase/supabase-js';

// Get env vars (allow build to succeed even if not set)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
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

