// Public GitHub repo that hosts the installer release, e.g. "uzairbuilds/anywhere-ai".
// The site reads the release's .exe asset and download count from it.
window.ANYWHERE_CONFIG = {
  githubRepo: "uzair25321-ui/AnyWhere-AI",
  // Direct .exe link from the release (recommended fallback).
  downloadUrl: "https://github.com/uzair25321-ui/AnyWhere-AI/releases/download/v1.0.0/Anywhere.AI-Setup-1.0.0.exe",

  // Feedback form storage (Supabase). Paste the Project URL and the public
  // "anon" key from Supabase → Project Settings → API. Never use service_role.
  supabaseUrl: "https://yqssnazauigvdagwzzsp.supabase.co",
  supabaseAnonKey: "sb_publishable_XW2b7t1rv9-IKY4IqYqaDw_rGBAQP5w",
  feedbackTable: "feedback",
  // Read-only view that exposes only approved, public reviews.
  reviewsView: "feedback_public"
};
