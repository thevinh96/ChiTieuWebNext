"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Banknote, BriefcaseBusiness, CalendarDays, Car, Check, ChevronRight, CircleHelp, CreditCard, Ellipsis, FileText, LogOut, Menu, Pencil, Plus, Receipt, Shapes, ShoppingBag, Trash2, Utensils, Wallet, X } from "lucide-react";
import { getSupabaseClient, supabaseConfigured } from "@/lib/supabase";

type Transaction = { id: string; title: string; category: string; categoryId: string; amount: number; type: "income" | "expense"; date: string; method: string; walletId: string; wallet: string };
type Category = { id: string; name: string; icon: string; color: string };
type WalletItem = { id: string; name: string; type: string; openingBalance: number; balance: number; color: string };
type Budget = { id: string; amount: number; month: string; categoryId: string; category: string; color: string; spent: number };
type Summary = { balance: number; income: number; expenses: number; transactionCount: number; categoryTotals: Record<string, number> };
type TransactionDraft = Partial<Transaction>;
type WalletDraft = Partial<WalletItem>;
type BudgetDraft = Partial<Budget>;

const currency = (value: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
const formatMoneyInput = (value: number | string | null | undefined) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? new Intl.NumberFormat("vi-VN").format(Number(digits)) : "";
};
const parseMoneyInput = (value: FormDataEntryValue | undefined) => Number(String(value ?? "").replace(/\D/g, ""));
const monthNow = new Date().toISOString().slice(0, 7);
const categoryIcons: Record<string, typeof Utensils> = { "Ăn uống": Utensils, "Di chuyển": Car, "Mua sắm": ShoppingBag, "Hóa đơn": Receipt, "Giải trí": Shapes, "Sức khỏe": Shapes, "Lương": BriefcaseBusiness, "Khác": Shapes };
const walletTypes: Record<string, string> = { cash: "Tiền mặt", bank: "Ngân hàng", ewallet: "Ví điện tử", savings: "Tiết kiệm" };

export default function Dashboard() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [activeNav, setActiveNav] = useState("Tổng quan");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [summary, setSummary] = useState<Summary>({ balance: 0, income: 0, expenses: 0, transactionCount: 0, categoryTotals: {} });
  const [month, setMonth] = useState(monthNow);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [formError, setFormError] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [txDraft, setTxDraft] = useState<TransactionDraft | null>(null);
  const [walletDraft, setWalletDraft] = useState<WalletDraft | null>(null);
  const [budgetDraft, setBudgetDraft] = useState<BudgetDraft | null>(null);

  const api = useCallback(async (path: string, init: RequestInit = {}) => {
    const response = await fetch(`/api${path}`, { ...init, headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${token}`, ...init.headers } });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || `API trả về lỗi ${response.status}. Kiểm tra backend/API_URL rồi thử lại.`);
    }
    return response.status === 204 ? null : response.json();
  }, [token]);

  const refresh = useCallback(async () => {
    if (!token) return;
    const results = await Promise.allSettled([
      api("/transactions?type=all"), api("/categories"), api("/wallets"), api(`/budgets?month=${month}`), api("/summary"),
    ]);
    const [tx, cats, walletRows, budgetRows, totals] = results;
    if (tx.status === "fulfilled") setTransactions(tx.value);
    if (cats.status === "fulfilled") setCategories(cats.value);
    if (walletRows.status === "fulfilled") setWallets(walletRows.value);
    if (budgetRows.status === "fulfilled") setBudgets(budgetRows.value);
    if (totals.status === "fulfilled") setSummary(totals.value);
    const failed = results.find((result) => result.status === "rejected");
    if (failed?.status === "rejected") setToast(failed.reason instanceof Error ? failed.reason.message : "Một số dữ liệu chưa tải được.");
  }, [api, month, token]);

  useEffect(() => {
    if (!supabaseConfigured) { setAuthReady(true); router.replace("/login"); return; }
    const supabase = getSupabaseClient();
    void supabase.auth.getSession().then(({ data }) => { setToken(data.session?.access_token ?? null); setEmail(data.session?.user.email ?? ""); setAuthReady(true); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setToken(session?.access_token ?? null); setEmail(session?.user.email ?? ""); setAuthReady(true); });
    return () => subscription.unsubscribe();
  }, [router]);
  useEffect(() => { if (token) void refresh(); else if (authReady) router.replace("/login"); }, [token, authReady, refresh, router]);
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(""), 4500); return () => clearTimeout(timer); } }, [toast]);
  useEffect(() => { setFormError(""); }, [txDraft, walletDraft, budgetDraft]);

  const currentTransactions = useMemo(() => transactions.filter((item) => item.date.startsWith(month)), [transactions, month]);
  const monthIncome = currentTransactions.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const monthExpenses = currentTransactions.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  const runAction = async (work: () => Promise<unknown>, success: string) => { setBusy(true); try { await work(); await refresh(); setToast(success); setFormError(""); return true; } catch (error) { const message = error instanceof Error ? error.message : "Thao tác thất bại."; setToast(message); setFormError(message); return false; } finally { setBusy(false); } };

  const saveTransaction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const fields = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = Object.fromEntries(fields.entries());
    payload.amount = parseMoneyInput(fields.get("amount") ?? undefined);
    if (await runAction(() => api(txDraft?.id ? `/transactions/${txDraft.id}` : "/transactions", { method: txDraft?.id ? "PATCH" : "POST", body: JSON.stringify(payload) }), txDraft?.id ? "Đã cập nhật giao dịch." : "Đã thêm giao dịch.")) setTxDraft(null);
  };
  const saveWallet = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const fields = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = Object.fromEntries(fields.entries());
    payload.openingBalance = parseMoneyInput(fields.get("openingBalance") ?? undefined);
    if (await runAction(() => api(walletDraft?.id ? `/wallets/${walletDraft.id}` : "/wallets", { method: walletDraft?.id ? "PATCH" : "POST", body: JSON.stringify(payload) }), walletDraft?.id ? "Đã cập nhật ví." : "Đã tạo ví.")) setWalletDraft(null);
  };
  const saveBudget = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const fields = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = Object.fromEntries(fields.entries());
    payload.amount = parseMoneyInput(fields.get("amount") ?? undefined);
    if (await runAction(() => api(budgetDraft?.id ? `/budgets/${budgetDraft.id}` : "/budgets", { method: budgetDraft?.id ? "PATCH" : "POST", body: JSON.stringify(payload) }), budgetDraft?.id ? "Đã cập nhật ngân sách." : "Đã lưu ngân sách.")) setBudgetDraft(null);
  };

  if (!authReady || !token) return <main className="auth-loading">Đang kiểm tra phiên đăng nhập…</main>;
  const navigation = ["Tổng quan", "Giao dịch", "Ngân sách", "Báo cáo", "Ví của tôi"];

  return <main className="app-shell">
    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
      <div className="brand"><div className="brand-mark"><Wallet size={19} /></div><span>chi tiêu<span className="brand-dot">.</span></span></div>
      <div className="workspace-label">KHÔNG GIAN CỦA BẠN</div>
      <div className="profile-switch"><div className="avatar avatar-large">{email.slice(0, 1).toUpperCase() || "U"}</div><div className="profile-copy"><strong>{email || "Tài khoản"}</strong><span>Tài khoản cá nhân</span></div></div>
      <div className="side-label">MENU CHÍNH</div><nav className="side-nav">{navigation.slice(0, 4).map((item, index) => { const Icon = [Wallet, ArrowLeftRight, CreditCard, FileText][index]; return <button key={item} className={`nav-item ${activeNav === item ? "nav-active" : ""}`} onClick={() => { setActiveNav(item); setMobileNav(false); }}><Icon size={18} /><span>{item}</span>{item === "Giao dịch" && <span className="nav-badge">{summary.transactionCount}</span>}</button>; })}</nav>
      <div className="side-separator" /><div className="side-label">TÀI KHOẢN</div><button className={`nav-item ${activeNav === "Ví của tôi" ? "nav-active" : ""}`} onClick={() => { setActiveNav("Ví của tôi"); setMobileNav(false); }}><CreditCard size={18} /><span>Ví của tôi</span></button>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={18} /></div><strong>Quản lý tài chính</strong><p>Ví, giao dịch và ngân sách của bạn được đồng bộ riêng tư.</p></div><button className="nav-item logout" onClick={async () => { await getSupabaseClient().auth.signOut(); router.replace("/login"); }}><LogOut size={18} /><span>Đăng xuất</span></button><div className="sidebar-foot">© 2026 Chi Tiêu</div></div>
    </aside>
    {mobileNav && <button className="mobile-scrim" aria-label="Đóng menu" onClick={() => setMobileNav(false)} />}
    <section className="main-area">
      <header className="topbar"><button className="icon-button mobile-menu" aria-label="Mở menu" onClick={() => setMobileNav(true)}><Menu size={20} /></button><div className="breadcrumb">Trang chủ <ChevronRight size={14} /> <strong>{activeNav}</strong></div><div className="top-actions"><span className="top-profile-name">{email}</span><button className="icon-button" aria-label="Đăng xuất" title="Đăng xuất" onClick={async () => { await getSupabaseClient().auth.signOut(); router.replace("/login"); }}><LogOut size={18} /></button></div></header>
      <div className="dashboard-content">
        {activeNav === "Tổng quan" && <DashboardView summary={{ ...summary, balance: monthIncome - monthExpenses, income: monthIncome, expenses: monthExpenses, transactionCount: currentTransactions.length }} transactions={currentTransactions} month={month} onMonth={setMonth} onAdd={() => setTxDraft({})} onNavigate={setActiveNav} onEdit={setTxDraft} onDelete={(id) => void runAction(() => api(`/transactions/${id}`, { method: "DELETE" }), "Đã xóa giao dịch.")} categories={categories} />}
        {activeNav === "Giao dịch" && <TransactionsView transactions={transactions} categories={categories} filter={filter} onFilter={setFilter} onAdd={() => setTxDraft({})} onEdit={setTxDraft} onDelete={(id) => void runAction(() => api(`/transactions/${id}`, { method: "DELETE" }), "Đã xóa giao dịch.")} />}
        {activeNav === "Ví của tôi" && <WalletsView wallets={wallets} onAdd={() => setWalletDraft({})} onEdit={setWalletDraft} onDelete={(id) => { if (confirm("Xóa ví này? Ví còn giao dịch sẽ không thể xóa.")) void runAction(() => api(`/wallets/${id}`, { method: "DELETE" }), "Đã xóa ví."); }} />}
        {activeNav === "Ngân sách" && <BudgetsView budgets={budgets} categories={categories} month={month} onMonth={setMonth} onAdd={() => setBudgetDraft({})} onEdit={setBudgetDraft} onDelete={(id) => { if (confirm("Xóa ngân sách này?")) void runAction(() => api(`/budgets/${id}`, { method: "DELETE" }), "Đã xóa ngân sách."); }} />}
        {activeNav === "Báo cáo" && <ReportsView month={month} onMonth={setMonth} transactions={currentTransactions} categories={categories} />}
      </div>
    </section>
    {txDraft && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setTxDraft(null); }}><form className="transaction-modal" onSubmit={saveTransaction}><ModalHead title={txDraft.id ? "Sửa giao dịch" : "Thêm giao dịch"} onClose={() => setTxDraft(null)} /><label>Tên giao dịch<input name="title" defaultValue={txDraft.title} placeholder="Ví dụ: Ăn trưa" maxLength={80} required /></label><div className="form-row"><label>Loại giao dịch<select name="type" defaultValue={txDraft.type || "expense"}><option value="expense">Chi tiêu</option><option value="income">Thu nhập</option></select></label><label>Danh mục<select name="categoryId" defaultValue={txDraft.categoryId || categories[0]?.id} required>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div><div className="form-row"><label>Số tiền<MoneyInput name="amount" defaultValue={txDraft.amount} min={1} /></label><label>Ví<select name="walletId" defaultValue={txDraft.walletId || wallets[0]?.id} required>{wallets.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label></div><div className="form-row"><label>Ngày<input name="date" type="date" defaultValue={txDraft.date || new Date().toISOString().slice(0, 10)} required /></label><label>Phương thức<select name="method" defaultValue={txDraft.method || "Tiền mặt"}><option>Tiền mặt</option><option>Chuyển khoản</option><option>Thẻ</option><option>Ví điện tử</option></select></label></div>{formError && <p className="form-error" role="alert">{formError}</p>}<button className="primary-button modal-submit" disabled={busy || !wallets.length || !categories.length}><Plus size={17} /> {busy ? "Đang lưu…" : "Lưu giao dịch"}</button>{!wallets.length && <p className="inline-note">Hãy tạo ví trước khi thêm giao dịch.</p>}</form></div>}
    {walletDraft && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setWalletDraft(null); }}><form className="transaction-modal" onSubmit={saveWallet}><ModalHead title={walletDraft.id ? "Sửa ví" : "Tạo ví mới"} onClose={() => setWalletDraft(null)} /><label>Tên ví<input name="name" defaultValue={walletDraft.name} placeholder="Ví dụ: Tài khoản ngân hàng" maxLength={60} required /></label><div className="form-row"><label>Loại ví<select name="type" defaultValue={walletDraft.type || "cash"}>{Object.entries(walletTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Số dư ban đầu<MoneyInput name="openingBalance" defaultValue={walletDraft.openingBalance ?? 0} min={0} /></label></div>{formError && <p className="form-error" role="alert">{formError}</p>}<button className="primary-button modal-submit" disabled={busy}><Check size={17} /> {busy ? "Đang lưu…" : "Lưu ví"}</button></form></div>}
    {budgetDraft && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setBudgetDraft(null); }}><form className="transaction-modal" onSubmit={saveBudget}><ModalHead title={budgetDraft.id ? "Sửa ngân sách" : "Tạo ngân sách"} onClose={() => setBudgetDraft(null)} /><label>Danh mục<select name="categoryId" defaultValue={budgetDraft.categoryId || categories[0]?.id} required disabled={Boolean(budgetDraft.id)}>{categories.filter((item) => item.name !== "Lương").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className="form-row"><label>Ngân sách tháng<MoneyInput name="amount" defaultValue={budgetDraft.amount} min={1} /></label>{!budgetDraft.id && <label>Tháng<input name="month" type="month" defaultValue={month} required /></label>}</div>{formError && <p className="form-error" role="alert">{formError}</p>}<button className="primary-button modal-submit" disabled={busy}><Check size={17} /> {busy ? "Đang lưu…" : "Lưu ngân sách"}</button></form></div>}
    {toast && <div className="toast"><span><Check size={15} /></span>{toast}<button onClick={() => setToast("")} aria-label="Đóng"><X size={14} /></button></div>}
  </main>;
}

function MoneyInput({ name, defaultValue, min = 0 }: { name: string; defaultValue?: number; min?: number }) {
  const [value, setValue] = useState(() => formatMoneyInput(defaultValue));
  return <span className="money-input-wrap">
    <input
      name={name}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="200.000"
      value={value}
      onChange={(event) => {
        const formatted = formatMoneyInput(event.target.value);
        const amount = Number(formatted.replace(/\D/g, ""));
        event.currentTarget.setCustomValidity(formatted && amount < min ? "Số tiền thấp hơn mức tối thiểu." : "");
        setValue(formatted);
      }}
      required
      aria-label="Số tiền, đơn vị VNĐ"
    />
    <span className="money-input-suffix" aria-hidden="true">VNĐ</span>
  </span>;
}
function PageHeading({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail: string; action?: React.ReactNode }) { return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{detail}</p></div>{action}</div>; }
function ModalHead({ title, onClose }: { title: string; onClose: () => void }) { return <div className="modal-head"><div><span className="eyebrow">CHI TIÊU</span><h2>{title}</h2></div><button type="button" className="icon-button" aria-label="Đóng" onClick={onClose}><X size={19} /></button></div>; }
function MonthPicker({ month, onChange }: { month: string; onChange: (value: string) => void }) { return <label className="month-picker"><CalendarDays size={16} /><input aria-label="Chọn tháng" type="month" value={month} onChange={(event) => onChange(event.target.value)} /></label>; }
function TransactionTable({ transactions, categories, onEdit, onDelete }: { transactions: Transaction[]; categories: Category[]; onEdit: (item: Transaction) => void; onDelete: (id: string) => void }) {
  if (!transactions.length) return <div className="empty-state">Chưa có giao dịch. Hãy thêm giao dịch đầu tiên.</div>;
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>Giao dịch</th><th>Danh mục</th><th>Ví</th><th>Ngày</th><th>Loại</th><th>Số tiền</th><th /></tr></thead><tbody>{transactions.map((item) => { const cat = categories.find((x) => x.id === item.categoryId); const Icon = categoryIcons[item.category] || Shapes; return <tr key={item.id}><td><span className="table-title"><i style={{ color: cat?.color, background: `${cat?.color || "#ddd"}20` }}><Icon size={16} /></i><span><strong>{item.title}</strong><small>{item.method}</small></span></span></td><td>{item.category}</td><td>{item.wallet}</td><td>{new Date(`${item.date}T00:00:00`).toLocaleDateString("vi-VN")}</td><td><span className={`type-pill ${item.type}`}>{item.type === "income" ? "Thu nhập" : "Chi tiêu"}</span></td><td className={`money ${item.type}`}>{item.type === "income" ? "+" : "−"}{currency(item.amount)}</td><td><span className="row-actions"><button title="Sửa" aria-label="Sửa giao dịch" onClick={() => onEdit(item)}><Pencil size={15} /></button><button title="Xóa" aria-label="Xóa giao dịch" onClick={() => { if (confirm("Xóa giao dịch này?")) onDelete(item.id); }}><Trash2 size={15} /></button></span></td></tr>; })}</tbody></table></div>;
}
function DashboardView({ summary, transactions, month, onMonth, onAdd, onNavigate, onEdit, onDelete, categories }: { summary: Summary; transactions: Transaction[]; month: string; onMonth: (value: string) => void; onAdd: () => void; onNavigate: (value: string) => void; onEdit: (item: Transaction) => void; onDelete: (id: string) => void; categories: Category[] }) {
  return <><PageHeading eyebrow="TỔNG QUAN" title="Tài chính của bạn" detail="Theo dõi tình hình thu chi và cập nhật giao dịch." action={<button className="primary-button" onClick={onAdd}><Plus size={17} /> Thêm giao dịch</button>} /><div className="dashboard-toolbar"><MonthPicker month={month} onChange={onMonth} /></div><div className="overview-grid"><article className="balance-card"><span className="card-caption">TỔNG SỐ DƯ</span><div className="balance-value">{currency(summary.balance)}</div><div className="balance-bottom">Từ tất cả giao dịch</div></article><Metric title="Thu nhập" value={summary.income} icon={<ArrowDownLeft size={18} />} /><Metric title="Chi tiêu" value={summary.expenses} icon={<ArrowUpRight size={18} />} /></div><div className="report-charts dashboard-charts"><section className="panel report-chart-card"><div className="report-chart-heading"><div><h2>Biến động chi tiêu</h2><p>Theo ngày trong tháng · Tháng {Number(month.slice(5, 7))} {month.slice(0, 4)}</p></div><button onClick={() => onNavigate("Báo cáo")}>Xem chi tiết ↗</button></div><ReportSpendingChart month={month} transactions={transactions} /></section><section className="panel report-chart-card"><div className="report-chart-heading"><div><h2>Chi theo danh mục</h2><p>Tỷ trọng chi tiêu tháng này</p></div><button onClick={() => onNavigate("Báo cáo")}>Danh mục ↗</button></div><ReportCategoryChart categories={categories} transactions={transactions} total={summary.expenses} /></section></div><section className="panel section-panel"><div className="section-heading"><div><h2>Giao dịch gần đây</h2><p>{summary.transactionCount} giao dịch tất cả</p></div><button className="text-link" onClick={() => onNavigate("Giao dịch")}>Xem tất cả <ChevronRight size={15} /></button></div><TransactionTable transactions={transactions.slice(0, 6)} categories={categories} onEdit={onEdit} onDelete={onDelete} /></section><div className="quick-links"><button onClick={() => onNavigate("Ví của tôi")}><Wallet size={18} /> Quản lý ví</button><button onClick={() => onNavigate("Ngân sách")}><CreditCard size={18} /> Lập ngân sách</button><button onClick={() => onNavigate("Báo cáo")}><FileText size={18} /> Xem báo cáo</button></div></>;
}
function Metric({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) { return <article className="stat-card"><div className="stat-heading"><span className="stat-icon income-icon">{icon}</span></div><span className="card-caption">{title.toUpperCase()}</span><strong className="stat-value">{currency(value)}</strong><span className="stat-subtitle">Từ tất cả giao dịch</span></article>; }
function TransactionsView({ transactions, categories, filter, onFilter, onAdd, onEdit, onDelete }: { transactions: Transaction[]; categories: Category[]; filter: string; onFilter: (value: string) => void; onAdd: () => void; onEdit: (item: Transaction) => void; onDelete: (id: string) => void }) { const visible = filter === "all" ? transactions : transactions.filter((item) => item.type === filter); return <><PageHeading eyebrow="SỔ GIAO DỊCH" title="Giao dịch" detail="Thêm, xem, chỉnh sửa hoặc xóa các khoản thu chi." action={<button className="primary-button" onClick={onAdd}><Plus size={17} /> Thêm giao dịch</button>} /><div className="panel section-panel"><div className="section-heading"><div className="filter-tabs">{[["all", "Tất cả"], ["income", "Thu nhập"], ["expense", "Chi tiêu"]].map(([value, label]) => <button key={value} className={filter === value ? "filter-active" : ""} onClick={() => onFilter(value)}>{label}</button>)}</div><span className="muted-copy">{visible.length} giao dịch</span></div><TransactionTable transactions={visible} categories={categories} onEdit={onEdit} onDelete={onDelete} /></div></>; }
function WalletsView({ wallets, onAdd, onEdit, onDelete }: { wallets: WalletItem[]; onAdd: () => void; onEdit: (item: WalletItem) => void; onDelete: (id: string) => void }) { const total = wallets.reduce((sum, item) => sum + item.balance, 0); return <><PageHeading eyebrow="TÀI KHOẢN CỦA BẠN" title="Ví của tôi" detail="Quản lý tiền mặt, tài khoản ngân hàng và ví điện tử." action={<button className="primary-button" onClick={onAdd}><Plus size={17} /> Tạo ví</button>} /><div className="wallet-total panel"><div><span className="card-caption">TỔNG SỐ DƯ CÁC VÍ</span><strong>{currency(total)}</strong></div><Wallet size={26} /></div>{wallets.length ? <div className="wallet-grid">{wallets.map((item) => <article className="wallet-card panel" key={item.id}><div className="wallet-card-head"><span className="wallet-icon" style={{ background: `${item.color}20`, color: item.color }}><Banknote size={20} /></span><span className="row-actions"><button aria-label="Sửa ví" onClick={() => onEdit(item)}><Pencil size={15} /></button><button aria-label="Xóa ví" onClick={() => onDelete(item.id)}><Trash2 size={15} /></button></span></div><span className="muted-copy">{walletTypes[item.type] || item.type}</span><h2>{item.name}</h2><strong className="wallet-balance">{currency(item.balance)}</strong><small>Số dư ban đầu: {currency(item.openingBalance)}</small></article>)}</div> : <div className="panel empty-panel"><Wallet size={30} /><h2>Bạn chưa có ví nào</h2><p>Tạo ví đầu tiên để ghi nhận số dư và gắn giao dịch với tài khoản phù hợp.</p><button className="primary-button" onClick={onAdd}><Plus size={17} /> Tạo ví đầu tiên</button></div>}</>; }
function BudgetsView({ budgets, categories, month, onMonth, onAdd, onEdit, onDelete }: { budgets: Budget[]; categories: Category[]; month: string; onMonth: (value: string) => void; onAdd: () => void; onEdit: (item: Budget) => void; onDelete: (id: string) => void }) { const total = budgets.reduce((sum, item) => sum + item.amount, 0); const spent = budgets.reduce((sum, item) => sum + item.spent, 0); return <><PageHeading eyebrow="KẾ HOẠCH CHI TIÊU" title="Ngân sách" detail="Đặt hạn mức theo danh mục và theo dõi tiến độ trong tháng." action={<button className="primary-button" onClick={onAdd}><Plus size={17} /> Tạo ngân sách</button>} /><div className="dashboard-toolbar"><MonthPicker month={month} onChange={onMonth} /><div className="budget-summary"><span>Hạn mức <strong>{currency(total)}</strong></span><span>Đã chi <strong>{currency(spent)}</strong></span></div></div>{budgets.length ? <div className="budget-list">{budgets.map((item) => { const ratio = item.amount ? Math.min(item.spent / item.amount * 100, 100) : 0; const over = item.spent > item.amount; return <article className="budget-card panel" key={item.id}><div className="budget-card-top"><span className="budget-dot" style={{ background: item.color }} /><div className="budget-title"><strong>{item.category}</strong><small>{currency(item.spent)} / {currency(item.amount)}</small></div><span className="budget-percent">{Math.round(item.spent / item.amount * 100)}%</span><span className="row-actions"><button aria-label="Sửa ngân sách" onClick={() => onEdit(item)}><Pencil size={15} /></button><button aria-label="Xóa ngân sách" onClick={() => onDelete(item.id)}><Trash2 size={15} /></button></span></div><div className="progress-track"><i className={over ? "over" : ""} style={{ width: `${ratio}%`, background: over ? "#d77b68" : item.color }} /></div><small className={over ? "over-text" : "muted-copy"}>{over ? `Vượt ${currency(item.spent - item.amount)}` : `Còn lại ${currency(item.amount - item.spent)}`}</small></article>; })}</div> : <div className="panel empty-panel"><CreditCard size={30} /><h2>Chưa có ngân sách tháng này</h2><p>Chọn danh mục và đặt mức chi tối đa để kiểm soát kế hoạch của bạn.</p><button className="primary-button" onClick={onAdd}><Plus size={17} /> Tạo ngân sách</button></div>}</>; }
function ReportsView({ month, onMonth, transactions, categories }: { month: string; onMonth: (value: string) => void; transactions: Transaction[]; categories: Category[] }) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const filteredTransactions = transactions.filter((item) => (typeFilter === "all" || item.type === typeFilter) && (categoryFilter === "all" || item.categoryId === categoryFilter));
  const income = filteredTransactions.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expenses = filteredTransactions.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  const daily = filteredTransactions.reduce<Record<string, { count: number; income: number; expenses: number }>>((map, item) => {
    const row = map[item.date] ?? { count: 0, income: 0, expenses: 0 };
    row.count++;
    row[item.type === "income" ? "income" : "expenses"] += item.amount;
    map[item.date] = row;
    return map;
  }, {});
  const dailyRows = Object.entries(daily).sort(([a], [b]) => b.localeCompare(a));
  const exportReport = () => downloadTransactionsExcel({
    month,
    typeFilter,
    categoryName: categoryFilter === "all" ? "Tất cả danh mục" : categories.find((category) => category.id === categoryFilter)?.name ?? "Danh mục",
    transactions: filteredTransactions,
    income,
    expenses,
  });

  return <>
    <PageHeading eyebrow="PHÂN TÍCH TÀI CHÍNH" title="Báo cáo" detail="Lọc và xuất chi tiết thu chi theo tháng." />
    <div className="report-filter-row">
      <MonthPicker month={month} onChange={onMonth} />
      <label>Loại giao dịch<select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">Tất cả</option><option value="income">Thu nhập</option><option value="expense">Chi tiêu</option></select></label>
      <label>Danh mục<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">Tất cả danh mục</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <span className="muted-copy report-filter-count">{filteredTransactions.length}/{transactions.length} giao dịch</span>
      <button className="primary-button report-export-button" onClick={exportReport}><FileText size={16} /> Xuất Excel</button>
    </div>
    <div className="report-metrics"><Metric title="Thu nhập" value={income} icon={<ArrowDownLeft size={18} />} /><Metric title="Chi tiêu" value={expenses} icon={<ArrowUpRight size={18} />} /><Metric title="Chênh lệch" value={Math.abs(income - expenses)} icon={<FileText size={18} />} /></div>
    <section id="daily-report" className="panel section-panel"><div className="section-heading"><div><h2>Thu chi theo ngày</h2><p>Chi tiết đã lọc theo tháng, loại giao dịch và danh mục</p></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Ngày</th><th>Số giao dịch</th><th>Thu nhập</th><th>Chi tiêu</th><th>Chênh lệch</th></tr></thead><tbody>{dailyRows.map(([date, row]) => <tr key={date}><td>{new Date(`${date}T00:00:00`).toLocaleDateString("vi-VN")}</td><td>{row.count}</td><td className="money income">{currency(row.income)}</td><td className="money expense">{currency(row.expenses)}</td><td>{currency(row.income - row.expenses)}</td></tr>)}</tbody></table>{!filteredTransactions.length && <div className="empty-state">Không có giao dịch phù hợp bộ lọc.</div>}</div></section>
  </>;
}

function ReportSpendingChart({ month, transactions }: { month: string; transactions: Transaction[] }) {
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const dailyExpenses = transactions.reduce<Record<number, number>>((map, item) => {
    if (item.type === "expense") {
      const day = Number(item.date.slice(8, 10));
      map[day] = (map[day] ?? 0) + item.amount;
    }
    return map;
  }, {});
  const points = Array.from({ length: daysInMonth }, (_, index) => ({ day: index + 1, amount: dailyExpenses[index + 1] ?? 0 }));
  const maxValue = Math.max(0, ...points.map((point) => point.amount));
  const chartMax = maxValue === 0 ? 1_000_000 : Math.ceil(maxValue / 5) * 5;
  const left = 76;
  const right = 880;
  const top = 20;
  const bottom = 244;
  const stepX = (right - left) / daysInMonth;
  const barWidth = Math.min(18, stepX * 0.62);
  const dayTicks = [...new Set([1, 5, 10, 15, 20, 25, daysInMonth])].filter((day) => day <= daysInMonth);
  const formatAxis = (value: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value);
  const activePoint = hoveredDay ? points[hoveredDay - 1] : null;

  return <div className="report-bar-wrap" onMouseLeave={() => setHoveredDay(null)}>
    {activePoint && <div className="report-chart-tooltip"><strong>Ngày {activePoint.day}</strong><span>Chi tiêu: {currency(activePoint.amount)}</span></div>}
    <svg className="report-bar-svg" viewBox="0 0 920 286" role="img" aria-label="Biểu đồ cột chi tiêu theo ngày">
      {[0, 1, 2, 3, 4].map((tick) => {
        const value = chartMax * (4 - tick) / 4;
        const yy = top + tick * (bottom - top) / 4;
        return <g key={tick}><line x1={left} x2={right} y1={yy} y2={yy} className="report-gridline" /><text x={left - 12} y={yy + 5} textAnchor="end" className="report-axis-label">{formatAxis(value)}</text></g>;
      })}
      {points.map((point, index) => {
        const height = (point.amount / chartMax) * (bottom - top);
        const x = left + index * stepX + (stepX - barWidth) / 2;
        return <g key={point.day} onMouseEnter={() => setHoveredDay(point.day)} onFocus={() => setHoveredDay(point.day)}>
          <rect x={left + index * stepX} y={top} width={stepX} height={bottom - top} fill="transparent" />
          {point.amount > 0 && <rect x={x} y={bottom - height} width={barWidth} height={Math.max(height, 2)} rx="5" className="report-bar"><title>Ngày {point.day}: {currency(point.amount)}</title></rect>}
        </g>;
      })}
      {dayTicks.map((day) => <text key={day} x={left + (day - 0.5) * stepX} y="272" textAnchor="middle" className="report-axis-label">{day}</text>)}
    </svg>
    {!transactions.some((item) => item.type === "expense") && <p className="report-chart-empty">Chưa có khoản chi nào trong tháng này.</p>}
  </div>;
}

function ReportCategoryChart({ categories, transactions, total }: { categories: Category[]; transactions: Transaction[]; total: number }) {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const categoryTotals = categories.map((category) => ({
    ...category,
    total: transactions.filter((item) => item.type === "expense" && item.categoryId === category.id).reduce((sum, item) => sum + item.amount, 0),
  })).filter((item) => item.total > 0).sort((a, b) => b.total - a.total);
  const colors = ["#62a47d", "#687cff", "#e3ab38", "#d16f73", "#8968d8", "#68a9bd", "#8c97a9", "#df8d62"];
  const circumference = 2 * Math.PI * 65;
  let offset = 0;
  const activeCategory = categoryTotals.find((item) => item.id === hoveredCategory);
  const percentage = (amount: number) => total ? (amount / total * 100).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) : "0";
  return <div className="report-donut-layout" onMouseLeave={() => setHoveredCategory(null)}>
    <div className="report-donut">
      <svg viewBox="0 0 180 180" role="img" aria-label="Biểu đồ tròn chi tiêu theo danh mục">
        <circle cx="90" cy="90" r="65" className="report-donut-track" />
        {categoryTotals.map((item, index) => {
          const length = total ? (item.total / total) * circumference : 0;
          const color = item.color || colors[index % colors.length];
          const segment = <circle key={item.id} cx="90" cy="90" r="65" fill="none" stroke={color} strokeWidth="22" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} transform="rotate(-90 90 90)" onMouseEnter={() => setHoveredCategory(item.id)}><title>{item.name}: {currency(item.total)} ({percentage(item.total)}%)</title></circle>;
          offset += length;
          return segment;
        })}
      </svg>
      <div className={`report-donut-center ${activeCategory ? "report-donut-active" : ""}`} aria-live="polite">
        <span>{activeCategory?.name ?? "Tổng chi"}</span>
        <strong>{new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(activeCategory?.total ?? total)}</strong>
        <small>{activeCategory ? `${percentage(activeCategory.total)}% · ₫` : "₫"}</small>
      </div>
    </div>
    {categoryTotals.length ? <div className="report-category-legend">{categoryTotals.map((item, index) => <div className={`report-category-legend-row ${hoveredCategory === item.id ? "report-category-legend-active" : ""}`} key={item.id} onMouseEnter={() => setHoveredCategory(item.id)}><i style={{ background: item.color || colors[index % colors.length] }} /><span>{item.name}</span><strong>{percentage(item.total)}%</strong></div>)}</div> : <p className="report-chart-empty">Chưa có dữ liệu danh mục.</p>}
  </div>;
}


function downloadTransactionsExcel({ month, typeFilter, categoryName, transactions, income, expenses }: { month: string; typeFilter: string; categoryName: string; transactions: Transaction[]; income: number; expenses: number }) {
  const escapeXml = (value: string | number) => String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char]!));
  const columnName = (index: number) => {
    let name = "";
    for (let number = index + 1; number > 0; number = Math.floor((number - 1) / 26)) name = String.fromCharCode(65 + (number - 1) % 26) + name;
    return name;
  };
  const makeCell = (row: number, col: number, value: string | number, style = 0, numeric = false) => {
    const ref = `${columnName(col)}${row}`;
    return numeric
      ? `<c r="${ref}" s="${style}" t="n"><v>${Number(value) || 0}</v></c>`
      : `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
  };
  const typeName = typeFilter === "income" ? "Thu nhập" : typeFilter === "expense" ? "Chi tiêu" : "Tất cả";
  const rowXml: string[] = [];
  rowXml.push(`<row r="1" ht="32" customHeight="1">${makeCell(1, 0, "BÁO CÁO THU CHI", 1)}</row>`);
  rowXml.push(`<row r="2" ht="22" customHeight="1">${makeCell(2, 0, `Tháng ${month.slice(5, 7)}/${month.slice(0, 4)} · Loại: ${typeName} · Danh mục: ${categoryName}`, 2)}</row>`);
  rowXml.push(`<row r="4" ht="22" customHeight="1">${["Tổng thu nhập", "Tổng chi tiêu", "Chênh lệch", "Số giao dịch"].map((label, index) => makeCell(4, index, label, 7)).join("")}</row>`);
  rowXml.push(`<row r="5" ht="27" customHeight="1">${[income, expenses, income - expenses, transactions.length].map((value, index) => makeCell(5, index, value, index === 3 ? 9 : 8, true)).join("")}</row>`);
  const headers = ["Ngày", "Tên giao dịch", "Loại", "Danh mục", "Ví", "Phương thức", "Số tiền (VNĐ)"];
  rowXml.push(`<row r="7" ht="25" customHeight="1">${headers.map((value, index) => makeCell(7, index, value, 3)).join("")}</row>`);
  transactions.forEach((item, index) => {
    const row = index + 8;
    const values = [item.date, item.title, item.type === "income" ? "Thu nhập" : "Chi tiêu", item.category, item.wallet, item.method];
    const style = index % 2 ? 6 : 5;
    rowXml.push(`<row r="${row}" ht="22" customHeight="1">${values.map((value, col) => makeCell(row, col, value, style)).join("")}${makeCell(row, 6, item.amount, 4, true)}</row>`);
  });
  const lastRow = Math.max(7, transactions.length + 7);
  const worksheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0"><pane ySplit="7" topLeftCell="A8" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="14" customWidth="1"/><col min="2" max="2" width="30" customWidth="1"/><col min="3" max="3" width="15" customWidth="1"/><col min="4" max="4" width="22" customWidth="1"/><col min="5" max="5" width="22" customWidth="1"/><col min="6" max="6" width="19" customWidth="1"/><col min="7" max="7" width="20" customWidth="1"/></cols><sheetData>${rowXml.join("")}</sheetData><autoFilter ref="A7:G${lastRow}"/><mergeCells count="1"><mergeCell ref="A1:G1"/></mergeCells><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0 &quot;₫&quot;"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="20"/><color rgb="FF174A3D"/><name val="Aptos Display"/></font><font><sz val="10"/><color rgb="FF718078"/><name val="Aptos"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF286647"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1F6F1"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFE5EBE5"/></left><right style="thin"><color rgb="FFE5EBE5"/></right><top style="thin"><color rgb="FFE5EBE5"/></top><bottom style="thin"><color rgb="FFE5EBE5"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="10"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/><xf numFmtId="164" fontId="1" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyNumberFormat="1"/><xf numFmtId="3" fontId="1" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const files: Record<string, string> = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Báo cáo" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/worksheets/sheet1.xml": worksheet,
    "xl/styles.xml": styles,
  };
  const bytes = createStoredZip(files);
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bao-cao-thu-chi-${month}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

function createStoredZip(files: Record<string, string>) {
  const encoder = new TextEncoder();
  const crc32 = (bytes: Uint8Array) => {
    let crc = -1;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ -1) >>> 0;
  };
  const u16 = (value: number) => { const bytes = new Uint8Array(2); new DataView(bytes.buffer).setUint16(0, value, true); return bytes; };
  const u32 = (value: number) => { const bytes = new Uint8Array(4); new DataView(bytes.buffer).setUint32(0, value >>> 0, true); return bytes; };
  const join = (parts: Uint8Array[]) => {
    const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
    let offset = 0;
    for (const part of parts) { result.set(part, offset); offset += part.length; }
    return result;
  };
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const crc = crc32(data);
    const local = join([u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(dosTime), u16(dosDate), u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), nameBytes, data]);
    const central = join([u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(dosTime), u16(dosDate), u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBytes]);
    localParts.push(local);
    centralParts.push(central);
    offset += local.length;
  }
  const centralDirectory = join(centralParts);
  const end = join([u32(0x06054b50), u16(0), u16(0), u16(centralParts.length), u16(centralParts.length), u32(centralDirectory.length), u32(offset), u16(0)]);
  return join([...localParts, centralDirectory, end]);
}
