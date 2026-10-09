// Contlas configuration — fill in once and the app connects straight to Supabase (no setup screen).
// Values: Supabase → Project Settings → API. The anon key is meant to be public; row-level security protects each account's data.
// Leave both empty to fall back to the in-app setup screen.
window.CONTLAS_CONFIG = {
  supabaseUrl: "https://wylxvmkcrexwfpjpbhyy.supabase.co",       // e.g. "https://abcd1234.supabase.co"
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5bHh2bWtjcmV4d2ZwanBiaHl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2MzkxMDYsImV4cCI6MjA4NDIxNTEwNn0.6Bxo42hx4jwlJGWnfjiTpiDUsYfc1QLTN3YtrU1efak",   // the "anon public" key, starts with eyJ…
  allowDemo: true        // false hides the "Try the demo" option
};
