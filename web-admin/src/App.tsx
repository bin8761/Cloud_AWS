import {
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit3,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  batchCreateBlockRules,
  createBlockRule,
  deleteBlockRule,
  getCurrentUser,
  listBlockRules,
  login as loginRequest,
  logout as logoutRequest,
  updateBlockRule,
} from "./api";
import type {
  BlockRule,
  BlockRuleSort,
  BlockRuleStatus,
  BlockRuleType,
  CurrentUserResponse,
  CreateBlockRuleInput,
} from "./types";

type ModalState =
  | { kind: "create" }
  | { kind: "edit"; rule: BlockRule }
  | { kind: "batch" }
  | null;

type RuleDraft = {
  type: BlockRuleType;
  value: string;
  label: string;
  reason: string;
  status: BlockRuleStatus;
  priority: string;
};

const PAGE_SIZE = 20;
const TYPE_OPTIONS: BlockRuleType[] = ["URL", "PROCESS", "KEYWORD"];
const STATUS_OPTIONS: BlockRuleStatus[] = ["ACTIVE", "DISABLED"];
const SORT_OPTIONS: Array<{ value: BlockRuleSort; label: string }> = [
  { value: "createdAt:desc", label: "Newest" },
  { value: "createdAt:asc", label: "Oldest" },
  { value: "priority:desc", label: "Priority high" },
  { value: "priority:asc", label: "Priority low" },
];

const defaultDraft = (): RuleDraft => ({
  type: "URL",
  value: "",
  label: "",
  reason: "",
  status: "ACTIVE",
  priority: "0",
});

const draftFromRule = (rule: BlockRule): RuleDraft => ({
  type: rule.type,
  value: rule.value,
  label: rule.label ?? "",
  reason: rule.reason ?? "",
  status: rule.status,
  priority: String(rule.priority),
});

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const parsePriority = (value: string): number | undefined => {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 9999) {
    throw new Error("Priority must be an integer from 0 to 9999.");
  }
  return parsed;
};

const toCreateInput = (draft: RuleDraft): CreateBlockRuleInput => ({
  type: draft.type,
  value: draft.value.trim(),
  label: draft.label.trim() || undefined,
  reason: draft.reason.trim() || undefined,
  priority: parsePriority(draft.priority),
});

const readInitialApiBase = (): string => {
  const stored = localStorage.getItem("cloudcms.apiBase");
  if (!stored || stored === "http://localhost:3001") {
    return "http://localhost:3000";
  }

  return stored;
};

export function App() {
  const [apiBase, setApiBase] = useState(readInitialApiBase);
  const [accessToken, setAccessToken] = useState(
    () => localStorage.getItem("cloudcms.accessToken") ?? "",
  );
  const [refreshToken, setRefreshToken] = useState(
    () => localStorage.getItem("cloudcms.refreshToken") ?? "",
  );
  const [session, setSession] = useState<CurrentUserResponse | null>(null);
  const [loginEmail, setLoginEmail] = useState(
    () => localStorage.getItem("cloudcms.loginEmail") ?? "",
  );
  const [loginPassword, setLoginPassword] = useState("");
  const [items, setItems] = useState<BlockRule[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<BlockRuleType | "">("");
  const [statusFilter, setStatusFilter] = useState<BlockRuleStatus | "">("");
  const [sort, setSort] = useState<BlockRuleSort>("createdAt:desc");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [draft, setDraft] = useState<RuleDraft>(defaultDraft);
  const [batchType, setBatchType] = useState<BlockRuleType>("URL");
  const [batchPriority, setBatchPriority] = useState("0");
  const [batchText, setBatchText] = useState("");

  const canQuery =
    apiBase.trim().length > 0 &&
    accessToken.trim().length > 0 &&
    session?.user.role === "shop_admin";

  const activeCount = useMemo(
    () => items.filter((rule) => rule.status === "ACTIVE").length,
    [items],
  );

  const loadRules = async (nextPage = page) => {
    if (!canQuery) {
      setItems([]);
      setTotal(0);
      setTotalPages(1);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await listBlockRules(apiBase, accessToken, {
        page: nextPage,
        pageSize: PAGE_SIZE,
        q,
        sort,
        type: typeFilter || undefined,
        status: statusFilter || undefined,
      });
      setItems(result.items);
      setPage(result.page);
      setTotal(result.total);
      setTotalPages(Math.max(1, result.totalPages));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    localStorage.setItem("cloudcms.apiBase", apiBase);
    localStorage.setItem("cloudcms.accessToken", accessToken);
    localStorage.setItem("cloudcms.refreshToken", refreshToken);
    localStorage.setItem("cloudcms.loginEmail", loginEmail);
  }, [apiBase, accessToken, refreshToken, loginEmail]);

  useEffect(() => {
    if (!accessToken.trim()) {
      setSession(null);
      return;
    }

    void getCurrentUser(apiBase, accessToken)
      .then((data) => {
        setSession(data);
        if (data.user.role !== "shop_admin") {
          setError("Only shop_admin users can manage block rules.");
        }
      })
      .catch((caught) => {
        setSession(null);
        setAccessToken("");
        setRefreshToken("");
        setError(caught instanceof Error ? caught.message : "Session expired.");
      });
  }, [apiBase, accessToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRules(1);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [apiBase, accessToken, session?.user.role, q, sort, typeFilter, statusFilter]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const result = await loginRequest(apiBase, {
        email: loginEmail,
        password: loginPassword,
      });
      setAccessToken(result.accessToken);
      setRefreshToken(result.refreshToken);
      setSession({ user: result.user, tenant: null });
      setLoginPassword("");
      setMessage("Signed in.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      if (refreshToken.trim()) {
        await logoutRequest(apiBase, refreshToken);
      }
    } catch {
      // Local session cleanup still wins if logout cannot reach the server.
    } finally {
      setAccessToken("");
      setRefreshToken("");
      setSession(null);
      setItems([]);
      setLoginPassword("");
      setBusy(false);
    }
  };

  const openCreate = () => {
    setDraft(defaultDraft());
    setModal({ kind: "create" });
  };

  const openEdit = (rule: BlockRule) => {
    setDraft(draftFromRule(rule));
    setModal({ kind: "edit", rule });
  };

  const closeModal = () => {
    setModal(null);
    setDraft(defaultDraft());
    setBatchText("");
  };

  const handleRuleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      if (modal?.kind === "edit") {
        await updateBlockRule(apiBase, accessToken, modal.rule.id, {
          ...toCreateInput(draft),
          status: draft.status,
        });
        setMessage("Rule updated.");
      } else {
        await createBlockRule(apiBase, accessToken, toCreateInput(draft));
        setMessage("Rule created.");
      }
      closeModal();
      await loadRules(1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleBatchSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = batchText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (values.length === 0) {
      setError("Batch input is empty.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const priority = parsePriority(batchPriority);
      await batchCreateBlockRules(
        apiBase,
        accessToken,
        values.map((value) => ({
          type: batchType,
          value,
          priority,
        })),
      );
      setMessage(`${values.length} rules created.`);
      closeModal();
      await loadRules(1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Batch create failed.");
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (rule: BlockRule) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await updateBlockRule(apiBase, accessToken, rule.id, {
        status: rule.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
      });
      await loadRules(page);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Status update failed.");
    } finally {
      setBusy(false);
    }
  };

  const removeRule = async (rule: BlockRule) => {
    if (!window.confirm(`Delete ${rule.value}?`)) return;

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await deleteBlockRule(apiBase, accessToken, rule.id);
      setMessage("Rule deleted.");
      await loadRules(page);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">CloudCMS</span>
          <h1>Block Rules</h1>
        </div>
        <div className="summary-strip" aria-label="Rule summary">
          <span>{total} total</span>
          <span>{activeCount} visible active</span>
        </div>
      </header>

      <section className="connection-band" aria-label="Connection settings">
        <Settings size={18} aria-hidden="true" />
        <label>
          API base
          <input
            value={apiBase}
            onChange={(event) => setApiBase(event.target.value)}
            spellCheck={false}
          />
        </label>
        {session ? (
          <>
            <div className="session-chip" aria-label="Current session">
              <strong>{session.user.fullName}</strong>
              <span>{session.tenant?.code ?? session.user.role}</span>
            </div>
            <button className="icon-button" onClick={() => void loadRules(page)} title="Refresh">
              <RefreshCw size={18} aria-hidden="true" />
            </button>
            <button className="icon-button" onClick={() => void handleLogout()} title="Log out">
              <LogOut size={18} aria-hidden="true" />
            </button>
          </>
        ) : (
          <form className="login-form" onSubmit={(event) => void handleLogin(event)}>
            <label>
              Email
              <input
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                type="email"
                autoComplete="username"
                required
              />
            </label>
            <label>
              Password
              <input
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <button className="primary-button" type="submit" disabled={busy}>
              Sign in
            </button>
          </form>
        )}
      </section>

      <section className="toolbar" aria-label="Rule filters" aria-disabled={!canQuery}>
        <div className="search-box">
          <Search size={18} aria-hidden="true" />
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search value or label"
          />
        </div>
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as BlockRuleType | "")}>
          <option value="">All types</option>
          {TYPE_OPTIONS.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as BlockRuleStatus | "")}
        >
          <option value="">All status</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value as BlockRuleSort)}>
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button className="primary-button" onClick={openCreate} disabled={!canQuery}>
          <Plus size={18} aria-hidden="true" />
          Add rule
        </button>
        <button className="secondary-button" onClick={() => setModal({ kind: "batch" })} disabled={!canQuery}>
          <Upload size={18} aria-hidden="true" />
          Batch
        </button>
      </section>

      {message && <div className="notice success">{message}</div>}
      {error && <div className="notice error">{error}</div>}

      <section className="table-wrap" aria-label="Block rules table">
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Value</th>
              <th>Label</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Created</th>
              <th className="actions-cell">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((rule) => (
              <tr key={rule.id}>
                <td>
                  <span className={`type-pill ${rule.type.toLowerCase()}`}>{rule.type}</span>
                </td>
                <td className="value-cell">{rule.value}</td>
                <td>{rule.label || "-"}</td>
                <td>
                  <button
                    className={`status-toggle ${rule.status.toLowerCase()}`}
                    onClick={() => void toggleStatus(rule)}
                    title="Toggle status"
                  >
                    {rule.status === "ACTIVE" ? <Check size={16} /> : <Ban size={16} />}
                    {rule.status}
                  </button>
                </td>
                <td>{rule.priority}</td>
                <td>{formatDate(rule.createdAt)}</td>
                <td className="actions-cell">
                  <button className="icon-button" onClick={() => openEdit(rule)} title="Edit rule">
                    <Edit3 size={17} aria-hidden="true" />
                  </button>
                  <button className="icon-button danger" onClick={() => void removeRule(rule)} title="Delete rule">
                    <Trash2 size={17} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
            {!busy && items.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-state">
                  No block rules found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {busy && <div className="loading-bar">Loading...</div>}
      </section>

      <footer className="pager" aria-label="Pagination">
        <button
          className="icon-button"
          disabled={page <= 1 || busy}
          onClick={() => void loadRules(page - 1)}
          title="Previous page"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button
          className="icon-button"
          disabled={page >= totalPages || busy}
          onClick={() => void loadRules(page + 1)}
          title="Next page"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </footer>

      {modal?.kind !== "batch" && modal && (
        <div className="modal-backdrop" role="presentation">
          <form className="modal" onSubmit={(event) => void handleRuleSubmit(event)}>
            <div className="modal-header">
              <h2>{modal.kind === "edit" ? "Edit rule" : "Add rule"}</h2>
              <button type="button" className="icon-button" onClick={closeModal} title="Close">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="form-grid">
              <label>
                Type
                <select
                  value={draft.type}
                  onChange={(event) => setDraft({ ...draft, type: event.target.value as BlockRuleType })}
                >
                  {TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Priority
                <input
                  value={draft.priority}
                  onChange={(event) => setDraft({ ...draft, priority: event.target.value })}
                  inputMode="numeric"
                />
              </label>
              {modal.kind === "edit" && (
                <label>
                  Status
                  <select
                    value={draft.status}
                    onChange={(event) => setDraft({ ...draft, status: event.target.value as BlockRuleStatus })}
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="full">
                Value
                <input
                  value={draft.value}
                  onChange={(event) => setDraft({ ...draft, value: event.target.value })}
                  required
                  maxLength={500}
                />
              </label>
              <label>
                Label
                <input
                  value={draft.label}
                  onChange={(event) => setDraft({ ...draft, label: event.target.value })}
                  maxLength={200}
                />
              </label>
              <label>
                Reason
                <input
                  value={draft.reason}
                  onChange={(event) => setDraft({ ...draft, reason: event.target.value })}
                  maxLength={500}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" className="primary-button" disabled={busy}>
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {modal?.kind === "batch" && (
        <div className="modal-backdrop" role="presentation">
          <form className="modal" onSubmit={(event) => void handleBatchSubmit(event)}>
            <div className="modal-header">
              <h2>Batch create</h2>
              <button type="button" className="icon-button" onClick={closeModal} title="Close">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="form-grid">
              <label>
                Type
                <select value={batchType} onChange={(event) => setBatchType(event.target.value as BlockRuleType)}>
                  {TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Priority
                <input value={batchPriority} onChange={(event) => setBatchPriority(event.target.value)} />
              </label>
              <label className="full">
                Values
                <textarea
                  value={batchText}
                  onChange={(event) => setBatchText(event.target.value)}
                  rows={10}
                  required
                />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={closeModal}>
                Cancel
              </button>
              <button type="submit" className="primary-button" disabled={busy}>
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
