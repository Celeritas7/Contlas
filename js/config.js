// Contlas configuration — fill in once and the app connects straight to Supabase (no setup screen).
// Values: Supabase → Project Settings → API. The anon key is meant to be public; row-level security protects each account's data.
// Leave both empty to fall back to the in-app setup screen.
window.CONTLAS_CONFIG = {
  supabaseUrl: "https://wylxvmkcrexwfpjpbhyy.supabase.co",       // e.g. "https://abcd1234.supabase.co"
  supabaseAnonKey: "sb_publishable_e3pDOuxIdstaC7s0a680kQ_R10TrAyv",   // the "anon public" key, starts with eyJ…
  allowDemo: true        // false hides the "Try the demo" option
};
