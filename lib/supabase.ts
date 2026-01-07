import { createClient } from "@supabase/supabase-js";

// Helper function to get env vars dynamically (supports dotenv loading after module import)
function getEnvVar(key: string): string | undefined {
  return process.env[key];
}

// Frontend (uso seguro)
export const supabase = (() => {
  const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  
  if (supabaseUrl && anonKey) {
    return createClient(supabaseUrl, anonKey);
  }
  
  // Return a mock client for build time
  return {
    from: () => {
      throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set in environment variables.');
    }
  } as any;
})();

// Backend (service role, acesso completo) - lazy initialization
let _supabaseAdmin: ReturnType<typeof createClient> | null = null;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createClient>, {
  get(target, prop) {
    if (!_supabaseAdmin) {
      const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
      const serviceRoleKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
      
      if (supabaseUrl && serviceRoleKey) {
        _supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
      } else {
        // Return a mock client that throws error
        return {
          from: () => {
            throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables.');
          }
        } as any;
      }
    }
    return (_supabaseAdmin as any)[prop];
  }
});

