import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const configured = Boolean(url && publishableKey);

const verifier = configured
  ? createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  : null;

export async function requireUser(req, res, next) {
  if (!verifier) {
    return res.status(503).json({ message: "API chưa được cấu hình Supabase. Hãy thêm SUPABASE_URL và SUPABASE_PUBLISHABLE_KEY." });
  }

  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return res.status(401).json({ message: "Bạn cần đăng nhập để tiếp tục." });

  const { data, error } = await verifier.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ message: "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại." });

  req.user = data.user;
  req.supabase = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  next();
}

export const supabaseConfigured = configured;
