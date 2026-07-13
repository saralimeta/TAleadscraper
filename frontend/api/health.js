export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    serper_configured: Boolean(process.env.SERPER_API_KEY),
    supabase_configured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
  });
}
