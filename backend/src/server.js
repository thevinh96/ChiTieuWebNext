import "dotenv/config";
import cors from "cors";
import express from "express";
import { requireUser, supabaseConfigured } from "./supabase.js";

const app = express();
const port = Number(process.env.PORT || 4000);
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000").split(",").map((origin) => origin.trim());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "32kb" }));
app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "chitieuwe-api", supabaseConfigured }));
app.use("/api", (req, res, next) => req.path === "/health" ? next() : requireUser(req, res, next));

const sendDbError = (res, error, message) => {
  if (["42P01", "42703", "PGRST200", "PGRST204"].includes(error?.code)) {
    return res.status(503).json({ message: "Cơ sở dữ liệu chưa có bảng hoặc cột mới. Hãy chạy migration 20261110000000_wallets_budgets.sql trong Supabase." });
  }
  if (error?.code === "42501") return res.status(403).json({ message: "Supabase từ chối quyền ghi. Hãy chạy lại migration wallets_budgets.sql để tạo quyền và chính sách RLS cho ví." });
  if (error?.code === "23514" || error?.code === "22P02") return res.status(400).json({ message: "Dữ liệu ví chưa hợp lệ. Kiểm tra loại ví và số dư rồi thử lại." });
  return res.status(500).json({ message });
};

app.get("/api/categories", async (req, res) => {
  const { data, error } = await req.supabase.from("categories").select("id,name,icon,color").order("name");
  if (error) return sendDbError(res, error, "Không thể tải danh mục.");
  res.json(data ?? []);
});

async function getTransactions(supabase, userId, type = "all") {
  let query = supabase.from("transactions")
    .select("id,title,amount,type,transaction_date,method,category_id,wallet_id,categories(name),wallets(name)")
    .eq("user_id", userId).order("transaction_date", { ascending: false }).order("created_at", { ascending: false });
  if (type !== "all") query = query.eq("type", type);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id, title: row.title, category: row.categories?.name ?? "Khác", categoryId: row.category_id,
    amount: Number(row.amount), type: row.type, date: row.transaction_date, method: row.method,
    walletId: row.wallet_id, wallet: row.wallets?.name ?? "Ví đã xóa",
  }));
}

app.get("/api/transactions", async (req, res) => {
  const type = req.query.type || "all";
  if (! ["all", "income", "expense"].includes(type)) return res.status(400).json({ message: "Bộ lọc giao dịch không hợp lệ." });
  try { res.json(await getTransactions(req.supabase, req.user.id, type)); }
  catch (error) { sendDbError(res, error, "Không thể tải giao dịch."); }
});

async function transactionPayload(req, res) {
  const { title, categoryId, category, walletId, amount, type, date, method } = req.body ?? {};
  const parsedAmount = Number(amount);
  if (typeof title !== "string" || !title.trim() || title.trim().length > 80 || !Number.isSafeInteger(parsedAmount) || parsedAmount <= 0 || !["expense", "income"].includes(type) || typeof walletId !== "string") {
    res.status(400).json({ message: "Vui lòng nhập tên, ví, số tiền nguyên dương và loại giao dịch hợp lệ." }); return null;
  }
  let categoryRow;
  if (typeof categoryId === "string") {
    const result = await req.supabase.from("categories").select("id,name").eq("id", categoryId).maybeSingle();
    categoryRow = result.data;
  } else if (typeof category === "string") {
    const result = await req.supabase.from("categories").select("id,name").eq("name", category).maybeSingle();
    categoryRow = result.data;
  }
  if (!categoryRow) { res.status(400).json({ message: "Danh mục không tồn tại." }); return null; }
  const { data: wallet, error: walletError } = await req.supabase.from("wallets").select("id").eq("id", walletId).eq("user_id", req.user.id).maybeSingle();
  if (walletError || !wallet) { res.status(400).json({ message: "Ví không tồn tại hoặc không thuộc tài khoản của bạn." }); return null; }
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) { res.status(400).json({ message: "Ngày giao dịch không hợp lệ." }); return null; }
  return {
    user_id: req.user.id, title: title.trim(), category_id: categoryRow.id, wallet_id: wallet.id,
    amount: parsedAmount, type, transaction_date: date || new Date().toISOString().slice(0, 10),
    method: typeof method === "string" && method.trim() ? method.trim().slice(0, 40) : "Tiền mặt",
  };
}

app.post("/api/transactions", async (req, res) => {
  try {
    const payload = await transactionPayload(req, res); if (!payload) return;
    const { data, error } = await req.supabase.from("transactions").insert(payload).select("id").single();
    if (error) return sendDbError(res, error, "Không thể lưu giao dịch.");
    res.status(201).json({ id: data.id });
  } catch (error) { sendDbError(res, error, "Không thể lưu giao dịch."); }
});

app.patch("/api/transactions/:id", async (req, res) => {
  try {
    const payload = await transactionPayload(req, res); if (!payload) return;
    delete payload.user_id;
    const { data, error } = await req.supabase.from("transactions").update(payload).eq("id", req.params.id).eq("user_id", req.user.id).select("id").maybeSingle();
    if (error) return sendDbError(res, error, "Không thể cập nhật giao dịch.");
    if (!data) return res.status(404).json({ message: "Không tìm thấy giao dịch." });
    res.json({ id: data.id });
  } catch (error) { sendDbError(res, error, "Không thể cập nhật giao dịch."); }
});

app.delete("/api/transactions/:id", async (req, res) => {
  const { data, error } = await req.supabase.from("transactions").delete().eq("id", req.params.id).eq("user_id", req.user.id).select("id").maybeSingle();
  if (error) return sendDbError(res, error, "Không thể xóa giao dịch.");
  if (!data) return res.status(404).json({ message: "Không tìm thấy giao dịch." });
  res.status(204).end();
});

app.get("/api/wallets", async (req, res) => {
  const [{ data: wallets, error }, { data: transactions, error: txError }] = await Promise.all([
    req.supabase.from("wallets").select("id,name,type,opening_balance,color,created_at").eq("user_id", req.user.id).order("created_at"),
    req.supabase.from("transactions").select("wallet_id,amount,type").eq("user_id", req.user.id),
  ]);
  if (error || txError) return sendDbError(res, error || txError, "Không thể tải ví.");
  const totals = new Map();
  for (const row of transactions ?? []) totals.set(row.wallet_id, (totals.get(row.wallet_id) ?? 0) + (row.type === "income" ? 1 : -1) * Number(row.amount));
  res.json((wallets ?? []).map((wallet) => ({ ...wallet, openingBalance: Number(wallet.opening_balance), balance: Number(wallet.opening_balance) + (totals.get(wallet.id) ?? 0) })));
});

app.post("/api/wallets", async (req, res) => {
  const { name, type = "cash", openingBalance = 0, color = "#4d8664" } = req.body ?? {};
  const balance = Number(openingBalance);
  if (typeof name !== "string" || !name.trim() || name.trim().length > 60 || !["cash", "bank", "ewallet", "savings"].includes(type) || !Number.isSafeInteger(balance) || balance < 0) {
    return res.status(400).json({ message: "Vui lòng nhập tên ví, loại ví và số dư ban đầu hợp lệ." });
  }
  const { data, error } = await req.supabase.from("wallets").insert({ user_id: req.user.id, name: name.trim(), type, opening_balance: balance, color }).select("id").single();
  if (error) return sendDbError(res, error, "Không thể tạo ví.");
  res.status(201).json({ id: data.id });
});

app.patch("/api/wallets/:id", async (req, res) => {
  const { name, type, openingBalance, color } = req.body ?? {};
  const balance = Number(openingBalance);
  if (typeof name !== "string" || !name.trim() || name.trim().length > 60 || !["cash", "bank", "ewallet", "savings"].includes(type) || !Number.isSafeInteger(balance) || balance < 0) {
    return res.status(400).json({ message: "Thông tin ví không hợp lệ." });
  }
  const { data, error } = await req.supabase.from("wallets").update({ name: name.trim(), type, opening_balance: balance, color }).eq("id", req.params.id).eq("user_id", req.user.id).select("id").maybeSingle();
  if (error) return sendDbError(res, error, "Không thể cập nhật ví.");
  if (!data) return res.status(404).json({ message: "Không tìm thấy ví." });
  res.json({ id: data.id });
});

app.delete("/api/wallets/:id", async (req, res) => {
  const { count, error: countError } = await req.supabase.from("transactions").select("id", { count: "exact", head: true }).eq("wallet_id", req.params.id).eq("user_id", req.user.id);
  if (countError) return sendDbError(res, countError, "Không thể kiểm tra giao dịch trong ví.");
  if (count) return res.status(409).json({ message: "Ví còn giao dịch. Hãy chuyển hoặc xóa giao dịch trong ví trước." });
  const { data, error } = await req.supabase.from("wallets").delete().eq("id", req.params.id).eq("user_id", req.user.id).select("id").maybeSingle();
  if (error) return sendDbError(res, error, "Không thể xóa ví.");
  if (!data) return res.status(404).json({ message: "Không tìm thấy ví." });
  res.status(204).end();
});

app.get("/api/budgets", async (req, res) => {
  const month = typeof req.query.month === "string" && /^\d{4}-\d{2}$/.test(req.query.month) ? `${req.query.month}-01` : `${new Date().toISOString().slice(0, 7)}-01`;
  const [year, monthNumber] = month.slice(0, 7).split("-").map(Number);
  const nextMonth = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
  const [{ data, error }, { data: transactions, error: txError }] = await Promise.all([
    req.supabase.from("budgets").select("id,amount,month,category_id,categories(name,color)").eq("user_id", req.user.id).eq("month", month).order("created_at"),
    req.supabase.from("transactions").select("category_id,amount").eq("user_id", req.user.id).eq("type", "expense").gte("transaction_date", month).lt("transaction_date", nextMonth),
  ]);
  if (error || txError) return sendDbError(res, error || txError, "Không thể tải ngân sách.");
  const spent = new Map();
  for (const row of transactions ?? []) spent.set(row.category_id, (spent.get(row.category_id) ?? 0) + Number(row.amount));
  res.json((data ?? []).map((row) => ({ id: row.id, amount: Number(row.amount), month: row.month, categoryId: row.category_id, category: row.categories?.name ?? "Danh mục", color: row.categories?.color ?? "#4d8664", spent: spent.get(row.category_id) ?? 0 })));
});

app.post("/api/budgets", async (req, res) => {
  const { categoryId, amount, month } = req.body ?? {};
  const parsedAmount = Number(amount);
  if (typeof categoryId !== "string" || !Number.isSafeInteger(parsedAmount) || parsedAmount <= 0 || typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ message: "Vui lòng chọn danh mục, tháng và ngân sách hợp lệ." });
  const { data, error } = await req.supabase.from("budgets").upsert({ user_id: req.user.id, category_id: categoryId, amount: parsedAmount, month: `${month}-01` }, { onConflict: "user_id,category_id,month" }).select("id").single();
  if (error) return sendDbError(res, error, "Không thể lưu ngân sách.");
  res.status(201).json({ id: data.id });
});

app.patch("/api/budgets/:id", async (req, res) => {
  const amount = Number(req.body?.amount);
  if (!Number.isSafeInteger(amount) || amount <= 0) return res.status(400).json({ message: "Ngân sách phải là số nguyên dương." });
  const { data, error } = await req.supabase.from("budgets").update({ amount }).eq("id", req.params.id).eq("user_id", req.user.id).select("id").maybeSingle();
  if (error) return sendDbError(res, error, "Không thể cập nhật ngân sách.");
  if (!data) return res.status(404).json({ message: "Không tìm thấy ngân sách." });
  res.json({ id: data.id });
});

app.delete("/api/budgets/:id", async (req, res) => {
  const { data, error } = await req.supabase.from("budgets").delete().eq("id", req.params.id).eq("user_id", req.user.id).select("id").maybeSingle();
  if (error) return sendDbError(res, error, "Không thể xóa ngân sách.");
  if (!data) return res.status(404).json({ message: "Không tìm thấy ngân sách." });
  res.status(204).end();
});

app.get("/api/summary", async (req, res) => {
  try {
    const transactions = await getTransactions(req.supabase, req.user.id);
    const income = transactions.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
    const expenses = transactions.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
    const categoryTotals = transactions.filter((item) => item.type === "expense").reduce((totals, item) => { totals[item.category] = (totals[item.category] || 0) + item.amount; return totals; }, {});
    res.json({ balance: income - expenses, income, expenses, transactionCount: transactions.length, categoryTotals });
  } catch (error) { sendDbError(res, error, "Không thể tải tổng quan tài chính."); }
});

app.listen(port, "0.0.0.0", () => console.log(`ChiTieuWeb API running at http://localhost:${port}`));
