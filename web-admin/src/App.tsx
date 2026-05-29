import { useState, useEffect, useRef, FormEvent, useMemo, useReducer } from "react";
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
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Sliders,
  ShieldCheck,
  Server,
  Layers,
  Monitor,
  Edit,
} from "lucide-react";
import "./App.css";
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

interface Asset {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  isActive: boolean;
  createdAt: string;
}

interface Subscription {
  id: string;
  tenantId: string;
  tenantName?: string;
  status: string;
  maxComputers: number;
  currentComputers?: number;
  expiresAt: string;
}

const PAGE_SIZE = 20;
const TYPE_OPTIONS: BlockRuleType[] = ["URL", "PROCESS", "KEYWORD"];
const STATUS_OPTIONS: BlockRuleStatus[] = ["ACTIVE", "DISABLED"];
const SORT_OPTIONS: Array<{ value: BlockRuleSort; label: string }> = [
  { value: "createdAt:desc", label: "Mới nhất" },
  { value: "createdAt:asc", label: "Cũ nhất" },
  { value: "priority:desc", label: "Độ ưu tiên cao" },
  { value: "priority:asc", label: "Độ ưu tiên thấp" },
];

const MOCK_IMAGES = [
  {
    id: "mock-1",
    fileName: "Cyberpunk Gaming Room.jpg",
    filePath: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=600&auto=format&fit=crop",
    fileSize: 1048576 * 1.5,
    mimeType: "image/jpeg",
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock-2",
    fileName: "Sci-Fi Cyber City.jpg",
    filePath: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=600&auto=format&fit=crop",
    fileSize: 1048576 * 2.3,
    mimeType: "image/jpeg",
    isActive: true,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "mock-3",
    fileName: "Dark Abstract Liquid.jpg",
    filePath: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop",
    fileSize: 1048576 * 0.8,
    mimeType: "image/jpeg",
    isActive: false,
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
];

const MOCK_SUBSCRIPTIONS = [
  {
    id: "sub-1",
    tenantId: "tenant_starlight",
    tenantName: "Net Cyber Starlight",
    status: "ACTIVE",
    maxComputers: 30,
    currentComputers: 25,
    expiresAt: new Date(Date.now() + 86400000 * 45).toISOString(),
  },
  {
    id: "sub-2",
    tenantId: "tenant_arena",
    tenantName: "Gaming Arena X",
    status: "ACTIVE",
    maxComputers: 15,
    currentComputers: 12,
    expiresAt: new Date(Date.now() + 86400000 * 2).toISOString(),
  },
  {
    id: "sub-3",
    tenantId: "tenant_pro",
    tenantName: "Pro Gamer Center",
    status: "EXPIRED",
    maxComputers: 40,
    currentComputers: 40,
    expiresAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
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

const formatDate = (value: string): string => {
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const parsePriority = (value: string): number | undefined => {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 9999) {
    throw new Error("Độ ưu tiên phải là số nguyên từ 0 tới 9999.");
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
  if (stored) return stored;
  return window.location.origin.includes("5173")
    ? "http://localhost:3000"
    : window.location.origin;
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
  
  // Navigation active tab
  const [activeTab, setActiveTab] = useState<"assets" | "subscription" | "all_subscriptions" | "block_rules" | "dashboard">("assets");

  // Connection & Offline simulated mode
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [checkingConn, setCheckingConn] = useState<boolean>(true);
  const [tenantId, setTenantId] = useState<string>("tenant_starlight");
  const [tenantName, setTenantName] = useState<string>("Net Cyber Starlight");

  // Block Rules State
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

  // Assets & Subscription States
  const [assets, setAssets] = useState<Asset[]>([]);
  const [mySubscription, setMySubscription] = useState<Subscription | null>(null);
  const [allSubscriptions, setAllSubscriptions] = useState<Subscription[]>([]);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" } | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);

  // Subscriptions Modal States
  const [showAddSubModal, setShowAddSubModal] = useState<boolean>(false);
  const [showEditSubModal, setShowEditSubModal] = useState<boolean>(false);
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);
  const [formTenantId, setFormTenantId] = useState("");
  const [formTenantName, setFormTenantName] = useState("");
  const [formMaxComputers, setFormMaxComputers] = useState<number>(20);
  const [formExpiresAt, setFormExpiresAt] = useState("");
  const [formStatus, setFormStatus] = useState("ACTIVE");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const canQuery =
    apiBase.trim().length > 0 &&
    accessToken.trim().length > 0 &&
    session?.user.role === "shop_admin";

  const activeCount = useMemo(
    () => items.filter((rule) => rule.status === "ACTIVE").length,
    [items],
  );

  // Auto-clear Toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Check Backend Connection
  const checkConnection = async () => {
    setCheckingConn(true);
    try {
      const res = await fetch(`${apiBase}/health`, { method: "GET" });
      if (res.ok) {
        setIsOnline(true);
      } else {
        setIsOnline(false);
      }
    } catch (e) {
      setIsOnline(false);
    } finally {
      setCheckingConn(false);
    }
  };

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 15000);
    return () => clearInterval(interval);
  }, [apiBase]);

  // Sync token to localstorage
  useEffect(() => {
    localStorage.setItem("cloudcms.apiBase", apiBase);
    localStorage.setItem("cloudcms.accessToken", accessToken);
    localStorage.setItem("cloudcms.refreshToken", refreshToken);
    localStorage.setItem("cloudcms.loginEmail", loginEmail);
  }, [apiBase, accessToken, refreshToken, loginEmail]);

  // Retrieve current user on token load
  useEffect(() => {
    if (!accessToken.trim()) {
      setSession(null);
      return;
    }

    getCurrentUser(apiBase, accessToken)
      .then((data) => {
        setSession(data);
        setError(null);
      })
      .catch((caught) => {
        setSession(null);
        setAccessToken("");
        setRefreshToken("");
        setError(caught instanceof Error ? caught.message : "Phiên đăng nhập hết hạn.");
      });
  }, [apiBase, accessToken]);

  // Sync navigation tabs based on user role
  useEffect(() => {
    if (session) {
      if (session.user.role === "super_admin") {
        setActiveTab("all_subscriptions");
      } else {
        setActiveTab("assets");
      }
    }
  }, [session]);

  // Load block rules list
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
      setError(caught instanceof Error ? caught.message : "Không thể tải danh sách chặn.");
    } finally {
      setBusy(false);
    }
  };

  // Trigger loading block rules
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRules(1);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [apiBase, accessToken, session?.user.role, q, sort, typeFilter, statusFilter, activeTab]);

  // Load assets and subscriptions
  const loadAssetsAndSubscriptions = async () => {
    if (isOnline && accessToken) {
      // Load Wallpapers
      try {
        const res = await fetch(`${apiBase}/api/assets`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await res.json();
        if (data.success) {
          setAssets(data.data);
        }
      } catch (e) {
        console.error("Lỗi khi tải hình nền", e);
      }

      // Load My Subscription
      try {
        const res = await fetch(`${apiBase}/api/subscriptions/me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await res.json();
        if (data.success) {
          setMySubscription(data.data);
        }
      } catch (e) {
        console.error("Lỗi khi tải gói bản quyền", e);
      }

      // Load All Subscriptions (Super Admin)
      if (session?.user.role === "super_admin") {
        try {
          const res = await fetch(`${apiBase}/api/subscriptions`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const data = await res.json();
          if (data.success) {
            setAllSubscriptions(data.data);
          }
        } catch (e) {
          console.error("Lỗi khi tải tất cả bản quyền", e);
        }
      }
    } else {
      // Offline/Demo Mode fallback
      const localAssets = localStorage.getItem("cloudcms_assets");
      if (localAssets) {
        setAssets(JSON.parse(localAssets));
      } else {
        setAssets(MOCK_IMAGES);
        localStorage.setItem("cloudcms_assets", JSON.stringify(MOCK_IMAGES));
      }

      const localSubs = localStorage.getItem("cloudcms_all_subscriptions");
      let currentAllSubs = MOCK_SUBSCRIPTIONS;
      if (localSubs) {
        currentAllSubs = JSON.parse(localSubs);
      } else {
        localStorage.setItem("cloudcms_all_subscriptions", JSON.stringify(MOCK_SUBSCRIPTIONS));
      }
      setAllSubscriptions(currentAllSubs);

      // Current active tenant
      const found = currentAllSubs.find((s) => s.tenantId === tenantId);
      if (found) {
        setMySubscription(found);
      } else if (currentAllSubs.length > 0) {
        const first = currentAllSubs[0];
        setTenantId(first.tenantId);
        setTenantName(first.tenantName || first.tenantId);
        setMySubscription(first);
      }
    }
  };

  useEffect(() => {
    void loadAssetsAndSubscriptions();
  }, [isOnline, accessToken, session, tenantId, activeTab]);

  const showToast = (message: string, type: "success" | "error" | "warning" = "success") => {
    setToast({ message, type });
  };

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
      showToast("Đăng nhập thành công!", "success");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Đăng nhập thất bại.");
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
      // Local session cleanup still wins
    } finally {
      setAccessToken("");
      setRefreshToken("");
      setSession(null);
      setItems([]);
      setLoginPassword("");
      setBusy(false);
      showToast("Đã đăng xuất hệ thống.", "warning");
    }
  };

  // Wallpaper Handlers
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const fileExt = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    
    if (![".png", ".jpg", ".jpeg"].includes(fileExt)) {
      showToast("Chỉ chấp nhận ảnh JPG, JPEG, PNG.", "error");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast("Tệp quá lớn. Dung lượng tối đa là 5 MB.", "error");
      return;
    }

    setUploading(true);

    if (isOnline && accessToken) {
      const formData = new FormData();
      formData.append("image", file);

      try {
        const res = await fetch(`${apiBase}/api/assets/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: formData,
        });

        const data = await res.json();
        if (data.success) {
          showToast("Tải ảnh màn hình khóa lên thành công!");
          void loadAssetsAndSubscriptions();
        } else {
          showToast(data.error?.message || "Tải ảnh thất bại.", "error");
        }
      } catch (e) {
        showToast("Lỗi kết nối khi tải ảnh lên.", "error");
      } finally {
        setUploading(false);
      }
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const newAsset: Asset = {
          id: `local-${Date.now()}`,
          fileName: file.name,
          filePath: (e.target?.result as string) || "",
          fileSize: file.size,
          mimeType: file.type,
          isActive: true,
          createdAt: new Date().toISOString(),
        };

        const updated = [newAsset, ...assets];
        setAssets(updated);
        localStorage.setItem("cloudcms_assets", JSON.stringify(updated));
        showToast("Tải ảnh lên giả lập thành công!");
        setUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;

    if (isOnline && accessToken) {
      try {
        const res = await fetch(`${apiBase}/api/assets/${id}/active`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ isActive: nextStatus }),
        });

        const data = await res.json();
        if (data.success) {
          showToast(nextStatus ? "Kích hoạt ảnh hiển thị thành công." : "Hủy kích hoạt ảnh thành công.");
          void loadAssetsAndSubscriptions();
        } else {
          showToast(data.error?.message || "Cập nhật thất bại.", "error");
        }
      } catch (e) {
        showToast("Lỗi kết nối khi cập nhật trạng thái.", "error");
      }
    } else {
      const updated = assets.map((a) => (a.id === id ? { ...a, isActive: nextStatus } : a));
      setAssets(updated);
      localStorage.setItem("cloudcms_assets", JSON.stringify(updated));
      showToast(nextStatus ? "Kích hoạt ảnh màn hình chờ (Demo)" : "Tắt kích hoạt ảnh (Demo)");
    }
  };

  const handleDeleteAsset = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa hình nền này?")) return;

    if (isOnline && accessToken) {
      try {
        const res = await fetch(`${apiBase}/api/assets/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        const data = await res.json();
        if (data.success) {
          showToast("Đã xóa hình nền thành công.");
          void loadAssetsAndSubscriptions();
        } else {
          showToast(data.error?.message || "Xóa hình nền thất bại.", "error");
        }
      } catch (e) {
        showToast("Lỗi kết nối khi xóa hình nền.", "error");
      }
    } else {
      const updated = assets.filter((a) => a.id !== id);
      setAssets(updated);
      localStorage.setItem("cloudcms_assets", JSON.stringify(updated));
      showToast("Đã xóa hình nền (Demo).");
    }
  };

  // Block Rules CRUD
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

    try {
      if (modal?.kind === "edit") {
        await updateBlockRule(apiBase, accessToken, modal.rule.id, {
          ...toCreateInput(draft),
          status: draft.status,
        });
        showToast("Đã cập nhật quy tắc chặn.", "success");
      } else {
        await createBlockRule(apiBase, accessToken, toCreateInput(draft));
        showToast("Đã tạo quy tắc chặn mới.", "success");
      }
      closeModal();
      void loadRules(1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Lưu quy tắc thất bại.");
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
      setError("Dữ liệu nhập hàng loạt rỗng.");
      return;
    }

    setBusy(true);
    setError(null);

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
      showToast(`Đã tạo thành công ${values.length} quy tắc.`, "success");
      closeModal();
      void loadRules(1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nhập hàng loạt thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (rule: BlockRule) => {
    setBusy(true);
    setError(null);
    try {
      await updateBlockRule(apiBase, accessToken, rule.id, {
        status: rule.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
      });
      void loadRules(page);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể đổi trạng thái.");
    } finally {
      setBusy(false);
    }
  };

  const removeRule = async (rule: BlockRule) => {
    if (!window.confirm(`Xóa quy tắc chặn cho: ${rule.value}?`)) return;

    setBusy(true);
    setError(null);
    try {
      await deleteBlockRule(apiBase, accessToken, rule.id);
      showToast("Đã xóa quy tắc chặn.", "success");
      void loadRules(page);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Xóa quy tắc thất bại.");
    } finally {
      setBusy(false);
    }
  };

  // Subscription Creators/Updaters (Super Admin only)
  const handleCreateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTenantId || !formTenantName || !formExpiresAt) {
      showToast("Vui lòng điền đầy đủ thông tin.", "error");
      return;
    }

    const payload = {
      tenantId: formTenantId,
      status: formStatus,
      maxComputers: Number(formMaxComputers),
      expiresAt: new Date(formExpiresAt).toISOString(),
    };

    if (isOnline && accessToken) {
      try {
        const res = await fetch(`${apiBase}/api/subscriptions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (data.success) {
          showToast("Cấp bản quyền phòng máy thành công!");
          void loadAssetsAndSubscriptions();
          setShowAddSubModal(false);
          resetSubForm();
        } else {
          showToast(data.error?.message || "Cấp bản quyền thất bại.", "error");
        }
      } catch (e) {
        showToast("Lỗi kết nối khi đăng ký bản quyền.", "error");
      }
    } else {
      const newSub: Subscription = {
        id: `sub-${Date.now()}`,
        tenantId: formTenantId,
        tenantName: formTenantName,
        status: formStatus,
        maxComputers: Number(formMaxComputers),
        currentComputers: 0,
        expiresAt: new Date(formExpiresAt).toISOString(),
      };

      const updated = [...allSubscriptions, newSub];
      setAllSubscriptions(updated);
      localStorage.setItem("cloudcms_all_subscriptions", JSON.stringify(updated));
      showToast("Đăng ký bản quyền mới (Demo) thành công!");
      setShowAddSubModal(false);
      resetSubForm();
    }
  };

  const handleUpdateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub || !formExpiresAt) {
      showToast("Vui lòng cung cấp ngày hết hạn.", "error");
      return;
    }

    const payload = {
      status: formStatus,
      maxComputers: Number(formMaxComputers),
      expiresAt: new Date(formExpiresAt).toISOString(),
    };

    if (isOnline && accessToken) {
      try {
        const res = await fetch(`${apiBase}/api/subscriptions/${selectedSub.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (data.success) {
          showToast("Gia hạn và cập nhật bản quyền thành công!");
          void loadAssetsAndSubscriptions();
          setShowEditSubModal(false);
          resetSubForm();
        } else {
          showToast(data.error?.message || "Gia hạn thất bại.", "error");
        }
      } catch (e) {
        showToast("Lỗi kết nối khi cập nhật gói.", "error");
      }
    } else {
      const updated = allSubscriptions.map((s) =>
        s.id === selectedSub.id
          ? {
              ...s,
              status: formStatus,
              maxComputers: Number(formMaxComputers),
              expiresAt: new Date(formExpiresAt).toISOString(),
            }
          : s
      );
      setAllSubscriptions(updated);
      localStorage.setItem("cloudcms_all_subscriptions", JSON.stringify(updated));
      showToast("Gia hạn bản quyền (Demo) thành công!");
      setShowEditSubModal(false);
      resetSubForm();
    }
  };

  const resetSubForm = () => {
    setFormTenantId("");
    setFormTenantName("");
    setFormMaxComputers(20);
    setFormExpiresAt("");
    setFormStatus("ACTIVE");
    setSelectedSub(null);
  };

  const openEditModal = (sub: Subscription) => {
    setSelectedSub(sub);
    setFormTenantId(sub.tenantId);
    setFormTenantName(sub.tenantName || sub.tenantId);
    setFormMaxComputers(sub.maxComputers);
    setFormStatus(sub.status);
    const expiryDate = new Date(sub.expiresAt);
    const offset = expiryDate.getTimezoneOffset();
    const localDate = new Date(expiryDate.getTime() - offset * 60 * 1000);
    setFormExpiresAt(localDate.toISOString().slice(0, 16));
    setShowEditSubModal(true);
  };

  const getRemainingDays = (expiresAtStr: string) => {
    const diff = new Date(expiresAtStr).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const getRemainingDaysText = (expiresAtStr: string) => {
    const days = getRemainingDays(expiresAtStr);
    if (days < 0) return "Đã hết hạn";
    if (days === 0) return "Hết hạn hôm nay";
    return `${days} ngày`;
  };

  const handleTenantChange = (newId: string) => {
    const found = allSubscriptions.find((s) => s.tenantId === newId);
    if (found) {
      setTenantId(newId);
      setTenantName(found.tenantName || newId);
      showToast(`Chuyển sang phòng máy: ${found.tenantName || newId}`);
    }
  };

  // If not logged in, render the login card
  if (!session) {
    return (
      <div className="modal-overlay" style={{ background: "radial-gradient(circle at center, #111827 0%, #030712 100%)" }}>
        <form className="modal-content animate-fade-in" onSubmit={(event) => void handleLogin(event)} style={{ maxWidth: "420px", padding: "40px" }}>
          <div style={{ textAlign: "center", marginBottom: "8px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "14px",
                background: "linear-gradient(135deg, var(--primary), var(--accent-purple))",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 800,
                fontSize: "24px",
                marginBottom: "16px",
                boxShadow: "0 8px 24px rgba(99, 102, 241, 0.4)",
              }}
            >
              C
            </div>
            <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "28px", fontWeight: 700, background: "linear-gradient(135deg, #fff 30%, var(--text-secondary) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              CloudCMS Dashboard
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>
              Quản lý phòng máy &amp; chính sách chặn tập trung
            </p>
          </div>

          {error && (
            <div className="subs-alert-banner" style={{ background: "var(--danger-glow)", borderColor: "var(--danger)", color: "#fca5a5", padding: "12px 16px", fontSize: "13px" }}>
              <XCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">API Base URL</label>
            <input
              value={apiBase}
              onChange={(event) => setApiBase(event.target.value)}
              className="form-input"
              placeholder="http://localhost:3000"
              spellCheck={false}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              value={loginEmail}
              onChange={(event) => setLoginEmail(event.target.value)}
              type="email"
              className="form-input"
              placeholder="admin@example.com"
              autoComplete="username"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Mật khẩu</label>
            <input
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              type="password"
              className="form-input"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          <button className="btn-glow" type="submit" disabled={busy} style={{ width: "100%", justifyContent: "center", marginTop: "12px" }}>
            {busy ? "Đang kết nối..." : "Đăng nhập hệ thống"}
          </button>
        </form>
      </div>
    );
  }

  // Dashboard layout
  return (
    <div className="app-container">
      {/* Toast Notification */}
      {toast && (
        <div className="modal-overlay" style={{ background: "transparent", pointerEvents: "none" }}>
          <div
            className="glass-panel animate-fade-in"
            style={{
              pointerEvents: "auto",
              position: "fixed",
              top: "24px",
              right: "24px",
              padding: "16px 24px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              background: toast.type === "error" ? "var(--danger-glow)" : toast.type === "warning" ? "var(--warning-glow)" : "var(--success-glow)",
              borderColor: toast.type === "error" ? "var(--danger)" : toast.type === "warning" ? "var(--warning)" : "var(--success)",
              zIndex: 9999,
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            }}
          >
            {toast.type === "error" ? (
              <XCircle className="pulse-glow" style={{ color: "var(--danger)" }} />
            ) : toast.type === "warning" ? (
              <AlertTriangle className="pulse-glow" style={{ color: "var(--warning)" }} />
            ) : (
              <CheckCircle className="pulse-glow" style={{ color: "var(--success)" }} />
            )}
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#fff" }}>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Sidebar Panel */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, var(--primary), var(--accent-purple))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 800,
              fontSize: "18px",
            }}
          >
            C
          </div>
          <span className="sidebar-logo">CloudCMS</span>
        </div>

        {/* Sidebar Nav links */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {session.user.role === "shop_admin" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span className="role-badge-title" style={{ paddingLeft: "16px", marginBottom: "8px" }}>Menu chủ quán</span>
              <button
                className={`menu-item ${activeTab === "dashboard" ? "active" : ""}`}
                onClick={() => setActiveTab("dashboard")}
              >
                <Monitor size={18} />
                Dashboard
              </button>
              <button
                className={`menu-item ${activeTab === "assets" ? "active" : ""}`}
                onClick={() => setActiveTab("assets")}
              >
                <ImageIcon size={18} />
                Màn hình khóa
              </button>
              <button
                className={`menu-item ${activeTab === "block_rules" ? "active" : ""}`}
                onClick={() => setActiveTab("block_rules")}
              >
                <Ban size={18} />
                Quản lý chặn
              </button>
              <button
                className={`menu-item ${activeTab === "subscription" ? "active" : ""}`}
                onClick={() => setActiveTab("subscription")}
              >
                <Layers size={18} />
                Gói bản quyền
              </button>
            </div>
          )}

          {session.user.role === "super_admin" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span className="role-badge-title" style={{ paddingLeft: "16px", marginBottom: "8px" }}>Hệ thống</span>
              <button
                className={`menu-item ${activeTab === "all_subscriptions" ? "active" : ""}`}
                onClick={() => setActiveTab("all_subscriptions")}
              >
                <ShieldCheck size={18} />
                Cấp phép Admin
              </button>
            </div>
          )}
        </nav>

        {/* Sidebar footer statistics */}
        <div className="sidebar-footer">
          {session.user.role === "shop_admin" && (
            <div className="role-badge">
              <span className="role-badge-title">Phòng máy hiện tại</span>
              <span className="role-badge-value" style={{ color: "var(--primary)" }}>
                <Server size={14} />
                {tenantName}
              </span>
              <select
                style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  padding: "4px 8px",
                  color: "var(--text-primary)",
                  fontSize: "11px",
                  marginTop: "8px",
                  cursor: "pointer",
                }}
                value={tenantId}
                onChange={(e) => handleTenantChange(e.target.value)}
              >
                {allSubscriptions.map((s) => (
                  <option key={s.id} value={s.tenantId}>
                    {s.tenantName || s.tenantId}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="role-badge">
            <span className="role-badge-title">Người dùng hiện tại</span>
            <span className="role-badge-value" style={{ color: "var(--accent-purple)", fontSize: "12px" }}>
              {session.user.fullName}
            </span>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              {session.user.role === "super_admin" ? "Super Admin" : "Shop Admin"}
            </span>
          </div>

          {/* Connection Status indicator */}
          <div className="conn-status" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div className={`conn-dot ${isOnline ? "online" : "offline"}`}></div>
              <span style={{ fontSize: "11px" }}>
                {checkingConn
                  ? "Đang kết nối..."
                  : isOnline
                  ? "Máy chủ: Trực tuyến"
                  : "Máy chủ: Ngoại tuyến"}
              </span>
            </div>
            <button
              onClick={checkConnection}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: "2px",
                display: "flex",
                alignItems: "center",
              }}
              title="Kiểm tra lại kết nối"
            >
              <RefreshCw size={12} className={checkingConn ? "pulse-glow" : ""} />
            </button>
          </div>

          <button className="btn-secondary" onClick={() => void handleLogout()} style={{ width: "100%", justifyContent: "center", marginTop: "4px" }}>
            <LogOut size={14} />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="content-area">
        {/* Render Tab: Lock Screen slideshow (Assets) */}
        {session.user.role === "shop_admin" && activeTab === "dashboard" && (
          <DashboardTab apiBase={apiBase} accessToken={accessToken} />
        )}
        {session.user.role === "shop_admin" && activeTab === "assets" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            <header className="content-header">
              <div>
                <h1 className="content-title">Hình nền Máy trạm</h1>
                <p className="content-subtitle">
                  Kích hoạt và quản lý slideshow hình nền hiển thị trên màn hình chờ của tất cả các máy trạm thuộc quán {tenantName}.
                </p>
              </div>
              <div>
                <button className="btn-glow" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={18} />
                  Tải ảnh mới
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                  accept=".png,.jpg,.jpeg"
                />
              </div>
            </header>

            {/* Drag & drop upload box */}
            <div
              className="upload-zone"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  const fakeEvent = {
                    target: { files: e.dataTransfer.files },
                  } as unknown as React.ChangeEvent<HTMLInputElement>;
                  void handleFileUpload(fakeEvent);
                }
              }}
            >
              <div className="upload-icon-wrapper">
                <Upload size={28} />
              </div>
              <div>
                <p className="upload-text">
                  {uploading ? "Đang tải tệp tin và kiểm tra bảo mật..." : "Kéo & thả tệp tin vào đây, hoặc Click để duyệt máy tính"}
                </p>
                <p className="upload-hint">Chỉ chấp nhận tệp JPG, JPEG, PNG dung lượng không quá 5 Megabytes.</p>
              </div>
            </div>

            {/* Gallery Grid */}
            <section style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "20px", fontWeight: 600 }}>Thư viện hình ảnh</h2>
              
              {assets.length === 0 ? (
                <div className="glass-panel empty-state">
                  <ImageIcon size={48} style={{ color: "var(--text-muted)" }} />
                  <p style={{ fontWeight: 500 }}>Chưa có hình nền nào trong quán của bạn</p>
                  <p style={{ fontSize: "13px", maxWidth: "320px", textAlign: "center" }}>
                    Hãy tải lên các hình ảnh có độ phân giải cao để tạo ấn tượng cho khách chơi net.
                  </p>
                </div>
              ) : (
                <div className="gallery-grid">
                  {assets.map((asset) => (
                    <article key={asset.id} className="glass-panel asset-card animate-fade-in">
                      <div className="asset-preview-container">
                        <img
                          src={asset.filePath}
                          alt={asset.fileName}
                          className="asset-preview"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                        <div className="asset-fallback">
                          <ImageIcon size={24} />
                          <span style={{ fontSize: "11px", padding: "0 12px", textAlign: "center", wordBreak: "break-all" }}>{asset.fileName}</span>
                        </div>
                        <span className={`asset-badge ${asset.isActive ? "active" : "inactive"}`}>
                          {asset.isActive ? "Đang hoạt động" : "Tắt"}
                        </span>
                      </div>

                      <div className="asset-details">
                        <h3 className="asset-title" title={asset.fileName}>
                          {asset.fileName}
                        </h3>
                        <div className="asset-meta">
                          <span>{(asset.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                          <span>{formatDate(asset.createdAt)}</span>
                        </div>

                        <div className="asset-actions">
                          <label className="switch-label">
                            <input
                              type="checkbox"
                              checked={asset.isActive}
                              onChange={() => void handleToggleActive(asset.id, asset.isActive)}
                              className="switch-input"
                            />
                            <span className="switch-slider"></span>
                            <span>Hiển thị</span>
                          </label>

                          <button
                            className="btn-icon"
                            onClick={() => void handleDeleteAsset(asset.id)}
                            title="Xóa hình nền"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* Render Tab: Quản lý chặn (Block Rules) */}
        {session.user.role === "shop_admin" && activeTab === "block_rules" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            <header className="content-header">
              <div>
                <h1 className="content-title">Danh sách Chặn máy trạm</h1>
                <p className="content-subtitle">
                  Chặn khách hàng truy cập các trang web có nội dung cấm, từ khóa độc hại hoặc tiến trình ứng dụng không mong muốn.
                </p>
              </div>
              <div style={{ display: "flex", gap: "12px" }}>
                <button className="btn-glow" onClick={openCreate}>
                  <Plus size={18} />
                  Thêm luật chặn
                </button>
                <button className="btn-secondary" onClick={() => setModal({ kind: "batch" })}>
                  <Upload size={18} />
                  Thêm hàng loạt
                </button>
              </div>
            </header>

            {/* Rules stats strip */}
            <div className="subs-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              <div className="glass-panel subs-stat-card">
                <span className="subs-stat-label">Tổng số luật</span>
                <span className="subs-stat-value">{total}</span>
              </div>
              <div className="glass-panel subs-stat-card">
                <span className="subs-stat-label">Đang kích hoạt</span>
                <span className="subs-stat-value" style={{ color: "var(--success)" }}>{activeCount}</span>
              </div>
              <div className="glass-panel subs-stat-card">
                <span className="subs-stat-label">Trang hiện tại</span>
                <span className="subs-stat-value" style={{ color: "var(--primary)" }}>{page} / {totalPages}</span>
              </div>
            </div>

            {/* Filter Toolbar */}
            <section className="toolbar-filters">
              <div className="search-box-container">
                <Search size={18} style={{ color: "var(--text-muted)" }} />
                <input
                  className="search-box-input"
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                  placeholder="Tìm kiếm luật hoặc nhãn..."
                />
              </div>

              <select
                className="select-filter"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as BlockRuleType | "")}
              >
                <option value="">Tất cả phân loại</option>
                {TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>

              <select
                className="select-filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as BlockRuleStatus | "")}
              >
                <option value="">Tất cả trạng thái</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status === "ACTIVE" ? "ĐANG BẬT" : "ĐANG TẮT"}
                  </option>
                ))}
              </select>

              <select
                className="select-filter"
                value={sort}
                onChange={(event) => setSort(event.target.value as BlockRuleSort)}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <button className="btn-secondary" onClick={() => void loadRules(page)} title="Làm mới">
                <RefreshCw size={16} />
              </button>
            </section>

            {/* Block Rules Table */}
            <section className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Loại</th>
                    <th>Giá trị chặn</th>
                    <th>Nhãn ghi chú</th>
                    <th>Trạng thái</th>
                    <th>Độ ưu tiên</th>
                    <th>Ngày tạo</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((rule) => (
                    <tr key={rule.id}>
                      <td>
                        <span className={`type-pill ${rule.type.toLowerCase()}`}>{rule.type}</span>
                      </td>
                      <td className="value-cell" title={rule.value}>
                        {rule.value}
                      </td>
                      <td>{rule.label || "-"}</td>
                      <td>
                        <button
                          className={`status-toggle ${rule.status.toLowerCase()}`}
                          onClick={() => void toggleStatus(rule)}
                          title="Bấm để đổi trạng thái"
                        >
                          {rule.status === "ACTIVE" ? <Check size={12} /> : <Ban size={12} />}
                          {rule.status === "ACTIVE" ? "ĐANG BẬT" : "ĐANG KHÓA"}
                        </button>
                      </td>
                      <td>{rule.priority}</td>
                      <td>{formatDate(rule.createdAt)}</td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                          <button
                            className="btn-secondary"
                            style={{ padding: "6px 10px" }}
                            onClick={() => openEdit(rule)}
                            title="Sửa"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            className="btn-icon"
                            onClick={() => void removeRule(rule)}
                            title="Xóa"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!busy && items.length === 0 && (
                    <tr>
                      <td colSpan={7} className="empty-state" style={{ textAlign: "center", padding: "40px" }}>
                        Không có luật chặn nào được hiển thị.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {busy && (
                <div className="pulse-glow" style={{ padding: "20px", textAlign: "center", color: "var(--primary)" }}>
                  Đang đồng bộ dữ liệu...
                </div>
              )}
            </section>

            {/* Pagination footer */}
            <footer className="pager" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                Tổng cộng: <strong>{total}</strong> luật chặn được cấu hình.
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <button
                  className="btn-secondary"
                  disabled={page <= 1 || busy}
                  onClick={() => void loadRules(page - 1)}
                  style={{ padding: "6px 12px" }}
                >
                  <ChevronLeft size={16} />
                  Trang trước
                </button>
                <span style={{ fontSize: "14px", fontWeight: 600 }}>
                  Trang {page} / {totalPages}
                </span>
                <button
                  className="btn-secondary"
                  disabled={page >= totalPages || busy}
                  onClick={() => void loadRules(page + 1)}
                  style={{ padding: "6px 12px" }}
                >
                  Trang sau
                  <ChevronRight size={16} />
                </button>
              </div>
            </footer>
          </div>
        )}

        {/* Render Tab: My Subscription Details (Tenant view) */}
        {session.user.role === "shop_admin" && activeTab === "subscription" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            <header className="content-header">
              <div>
                <h1 className="content-title">Gói dịch vụ &amp; Bản quyền</h1>
                <p className="content-subtitle">
                  Kiểm tra thời hạn sử dụng, thông số số lượng máy trạm được phép đăng ký của quán net.
                </p>
              </div>
            </header>

            {mySubscription ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
                {mySubscription.status === "EXPIRED" ? (
                  <div className="subs-alert-banner" style={{ background: "var(--danger-glow)", borderColor: "var(--danger)", color: "var(--danger)" }}>
                    <XCircle size={20} className="pulse-glow" />
                    <div>
                      <h3 className="subs-alert-title">Bản quyền của bạn đã HẾT HẠN!</h3>
                      <p className="subs-alert-desc" style={{ color: "var(--text-primary)" }}>
                        Phòng máy của bạn hiện đã hết thời gian sử dụng bản quyền ({formatDate(mySubscription.expiresAt)}). Các máy trạm khi mở lên sẽ hiển thị cảnh báo chặn màn hình khóa và không cho phép khách mở phiên đăng nhập. Vui lòng liên hệ Super Admin để gia hạn dịch vụ.
                      </p>
                    </div>
                  </div>
                ) : getRemainingDays(mySubscription.expiresAt) <= 7 ? (
                  <div className="subs-alert-banner">
                    <AlertTriangle size={20} className="pulse-glow" />
                    <div>
                      <h3 className="subs-alert-title">Bản quyền sắp hết hạn!</h3>
                      <p className="subs-alert-desc">
                        Chỉ còn <strong>{getRemainingDays(mySubscription.expiresAt)} ngày</strong> nữa là gói dịch vụ của quán sẽ hết thời hạn. Vui lòng gia hạn để tránh gián đoạn dịch vụ của khách chơi máy trạm.
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="subs-grid">
                  <div className="glass-panel subs-stat-card">
                    <span className="subs-stat-label">Trạng thái gói</span>
                    <span
                      className="subs-stat-value"
                      style={{
                        color: mySubscription.status === "ACTIVE" ? "var(--success)" : "var(--danger)",
                      }}
                    >
                      {mySubscription.status === "ACTIVE" ? "ĐANG HOẠT ĐỘNG" : "ĐÃ HẾT HẠN"}
                    </span>
                  </div>

                  <div className="glass-panel subs-stat-card">
                    <span className="subs-stat-label">Hạn sử dụng</span>
                    <span className="subs-stat-value" style={{ fontSize: "20px" }}>
                      {formatDate(mySubscription.expiresAt)}
                    </span>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                      Còn lại: {getRemainingDaysText(mySubscription.expiresAt)}
                    </span>
                  </div>

                  <div className="glass-panel subs-stat-card" style={{ gridColumn: "span 2" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span className="subs-stat-label">Thiết bị máy trạm</span>
                      <span style={{ fontSize: "14px", fontWeight: 600 }}>
                        {mySubscription.currentComputers || 0} / {mySubscription.maxComputers} máy
                      </span>
                    </div>
                    
                    <div className="progress-container" style={{ marginTop: "12px", marginBottom: "8px" }}>
                      <div
                        className={`progress-bar ${(mySubscription.currentComputers || 0) >= mySubscription.maxComputers ? "limit-reached" : ""}`}
                        style={{
                          width: `${Math.min(
                            (((mySubscription.currentComputers || 0) / mySubscription.maxComputers) * 100),
                            100
                          )}%`,
                        }}
                      ></div>
                    </div>
                    
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      {(mySubscription.currentComputers || 0) >= mySubscription.maxComputers
                        ? "⚠️ Đã đạt giới hạn máy tối đa trong gói bản quyền. Máy mới đăng ký sẽ bị chặn."
                        : `Còn có thể đăng ký thêm ${mySubscription.maxComputers - (mySubscription.currentComputers || 0)} máy trạm mới.`}
                    </span>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "16px" }}>
                  <h3 style={{ fontFamily: "var(--font-heading)", fontSize: "18px", fontWeight: 600 }}>
                    Làm thế nào để gia hạn hoặc tăng số máy?
                  </h3>
                  <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
                    Hệ thống CloudCMS hoạt động dựa trên cơ chế cấp phép linh hoạt. Khi cần mở rộng phòng máy hoặc gia hạn thời gian hoạt động, chủ quán vui lòng thực hiện:
                  </p>
                  <ol style={{ fontSize: "14px", color: "var(--text-secondary)", paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <li>Liên hệ quản trị viên cấp cao của hệ thống (Super Admin).</li>
                    <li>Cung cấp mã định danh Tenant của quán: <code style={{ color: "var(--accent-purple)", background: "rgba(192, 132, 252, 0.08)" }}>{mySubscription.tenantId}</code>.</li>
                    <li>Sau khi hoàn tất thanh toán/thỏa thuận gói, hệ thống sẽ được Super Admin gia hạn tự động qua API và có hiệu lực tức thì trên máy trạm của bạn.</li>
                  </ol>
                </div>
              </div>
            ) : (
              <div className="glass-panel empty-state">
                <Layers size={48} style={{ color: "var(--text-muted)" }} />
                <p style={{ fontWeight: 500 }}>Chưa đăng ký gói dịch vụ</p>
                <p style={{ fontSize: "13px" }}>Quán net của bạn chưa được cấp phép hoạt động trên hệ thống CloudCMS.</p>
              </div>
            )}
          </div>
        )}

        {/* Render Tab: Super Admin Subscriptions Panel */}
        {session.user.role === "super_admin" && activeTab === "all_subscriptions" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
            <header className="content-header">
              <div>
                <h1 className="content-title">Cấp phép Bản quyền hệ thống</h1>
                <p className="content-subtitle">
                  Dành riêng cho Quản trị viên cấp cao: Theo dõi, cấp mới và gia hạn thời gian sử dụng dịch vụ cho tất cả đại lý quán net.
                </p>
              </div>
              <div className="admin-header-actions">
                <button className="btn-glow" onClick={() => setShowAddSubModal(true)}>
                  <Plus size={18} />
                  Cấp mới bản quyền
                </button>
              </div>
            </header>

            <section className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Tên đại lý (Tenant)</th>
                    <th>Mã phòng máy</th>
                    <th>Trạng thái</th>
                    <th>Quy mô máy trạm</th>
                    <th>Hạn sử dụng</th>
                    <th>Thời gian còn lại</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {allSubscriptions.map((sub) => {
                    const remainingDays = getRemainingDays(sub.expiresAt);
                    const isExp = sub.status === "EXPIRED" || remainingDays < 0;
                    const isSoon = !isExp && remainingDays <= 7;

                    return (
                      <tr key={sub.id}>
                        <td style={{ fontWeight: 600 }}>{sub.tenantName || "Không tên"}</td>
                        <td>
                          <code style={{ background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: "4px" }}>
                            {sub.tenantId}
                          </code>
                        </td>
                        <td>
                          <span
                            className={`status-badge ${
                              isExp ? "expired" : isSoon ? "pending" : "active"
                            }`}
                          >
                            {isExp ? "Hết hạn" : isSoon ? "Sắp hết hạn" : "Hoạt động"}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <Monitor size={14} style={{ color: "var(--text-muted)" }} />
                            <span>{sub.currentComputers || 0} / {sub.maxComputers} máy</span>
                          </div>
                        </td>
                        <td>{formatDate(sub.expiresAt)}</td>
                        <td
                          style={{
                            color: isExp ? "var(--danger)" : isSoon ? "var(--warning)" : "var(--success)",
                            fontWeight: 500,
                          }}
                        >
                          {getRemainingDaysText(sub.expiresAt)}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            className="btn-secondary"
                            onClick={() => openEditModal(sub)}
                          >
                            <Edit size={14} />
                            Gia hạn / Sửa
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {allSubscriptions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="empty-state" style={{ textAlign: "center" }}>
                        Chưa có dữ liệu bản quyền đại lý nào.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </div>
        )}
      </main>

      {/* Modal: Rule CRUD Dialog (Create/Edit Block Rule) */}
      {modal && modal.kind !== "batch" && (
        <div className="modal-overlay" role="presentation">
          <form className="modal-content animate-fade-in" onSubmit={(event) => void handleRuleSubmit(event)} style={{ maxWidth: "560px" }}>
            <div className="modal-header">
              <h3 className="modal-title">{modal.kind === "edit" ? "Cập nhật luật chặn" : "Thêm luật chặn mới"}</h3>
              <button type="button" className="btn-icon" onClick={closeModal} title="Đóng">
                <X size={18} />
              </button>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div className="form-group">
                <label className="form-label">Loại quy tắc</label>
                <select
                  className="form-input"
                  value={draft.type}
                  onChange={(event) => setDraft({ ...draft, type: event.target.value as BlockRuleType })}
                >
                  {TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Độ ưu tiên (0 - 9999)</label>
                <input
                  className="form-input"
                  value={draft.priority}
                  onChange={(event) => setDraft({ ...draft, priority: event.target.value })}
                  inputMode="numeric"
                  placeholder="0"
                />
              </div>

              {modal.kind === "edit" && (
                <div className="form-group" style={{ gridColumn: "span 2" }}>
                  <label className="form-label">Trạng thái hoạt động</label>
                  <select
                    className="form-input"
                    value={draft.status}
                    onChange={(event) => setDraft({ ...draft, status: event.target.value as BlockRuleStatus })}
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status === "ACTIVE" ? "Kích hoạt (ACTIVE)" : "Vô hiệu hóa (DISABLED)"}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group" style={{ gridColumn: "span 2" }}>
                <label className="form-label">Giá trị chặn (URL, Tên tiến trình hoặc Từ khóa)</label>
                <input
                  className="form-input"
                  value={draft.value}
                  onChange={(event) => setDraft({ ...draft, value: event.target.value })}
                  required
                  maxLength={500}
                  placeholder="Ví dụ: evil.com, game_cheat.exe, hack"
                />
              </div>

              <div className="form-group" style={{ gridColumn: "span 2" }}>
                <label className="form-label">Nhãn ghi chú (Tên phần mềm/trang web)</label>
                <input
                  className="form-input"
                  value={draft.label}
                  onChange={(event) => setDraft({ ...draft, label: event.target.value })}
                  maxLength={200}
                  placeholder="Ví dụ: Trang web cá độ, Tool hack..."
                />
              </div>

              <div className="form-group" style={{ gridColumn: "span 2" }}>
                <label className="form-label">Lý do chặn hiển thị khách</label>
                <input
                  className="form-input"
                  value={draft.reason}
                  onChange={(event) => setDraft({ ...draft, reason: event.target.value })}
                  maxLength={500}
                  placeholder="Lý do hiển thị trên màn hình máy trạm khi bị chặn"
                />
              </div>
            </div>

            {error && <div style={{ color: "var(--danger)", fontSize: "13px" }}>{error}</div>}

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={closeModal}>
                Hủy bỏ
              </button>
              <button type="submit" className="btn-glow" disabled={busy}>
                <Check size={16} />
                Lưu quy tắc
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Batch Create block rules */}
      {modal && modal.kind === "batch" && (
        <div className="modal-overlay" role="presentation">
          <form className="modal-content animate-fade-in" onSubmit={(event) => void handleBatchSubmit(event)} style={{ maxWidth: "560px" }}>
            <div className="modal-header">
              <h3 className="modal-title">Thêm luật chặn hàng loạt</h3>
              <button type="button" className="btn-icon" onClick={closeModal} title="Đóng">
                <X size={18} />
              </button>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div className="form-group">
                <label className="form-label">Loại quy tắc</label>
                <select className="form-input" value={batchType} onChange={(event) => setBatchType(event.target.value as BlockRuleType)}>
                  {TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Độ ưu tiên (0 - 9999)</label>
                <input className="form-input" value={batchPriority} onChange={(event) => setBatchPriority(event.target.value)} />
              </div>

              <div className="form-group" style={{ gridColumn: "span 2" }}>
                <label className="form-label">Các giá trị chặn (Mỗi dòng là một giá trị)</label>
                <textarea
                  className="form-input"
                  value={batchText}
                  onChange={(event) => setBatchText(event.target.value)}
                  rows={8}
                  style={{ resize: "vertical", fontFamily: "monospace", minHeight: "140px" }}
                  required
                  placeholder="evil-site-1.com&#10;evil-site-2.com&#10;porn-site-xyz.net"
                />
              </div>
            </div>

            {error && <div style={{ color: "var(--danger)", fontSize: "13px" }}>{error}</div>}

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={closeModal}>
                Hủy bỏ
              </button>
              <button type="submit" className="btn-glow" disabled={busy}>
                <Check size={16} />
                Nhập hàng loạt
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Create Subscription (Super Admin) */}
      {showAddSubModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: "480px" }}>
            <div className="modal-header">
              <h3 className="modal-title">Cấp Bản quyền mới</h3>
              <button
                className="btn-icon"
                onClick={() => {
                  setShowAddSubModal(false);
                  resetSubForm();
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubscription} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group">
                <label className="form-label">Mã phòng máy (Tenant ID)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ví dụ: tenant_cyber_starlight"
                  value={formTenantId}
                  onChange={(e) => setFormTenantId(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tên quán Net (Tenant Name)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ví dụ: Net Cyber Starlight"
                  value={formTenantName}
                  onChange={(e) => setFormTenantName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Số lượng máy trạm tối đa</label>
                <input
                  type="number"
                  className="form-input"
                  min={1}
                  value={formMaxComputers}
                  onChange={(e) => setFormMaxComputers(Number(e.target.value))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Hạn sử dụng gói dịch vụ</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={formExpiresAt}
                  onChange={(e) => setFormExpiresAt(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Trạng thái ban đầu</label>
                <select
                  className="form-input"
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                >
                  <option value="ACTIVE">Kích hoạt (ACTIVE)</option>
                  <option value="EXPIRED">Khóa / Hết hạn (EXPIRED)</option>
                </select>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowAddSubModal(false);
                    resetSubForm();
                  }}
                >
                  Hủy bỏ
                </button>
                <button type="submit" className="btn-glow">
                  <Check size={16} />
                  Cấp phép
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit/Extend Subscription (Super Admin) */}
      {showEditSubModal && selectedSub && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: "480px" }}>
            <div className="modal-header">
              <h3 className="modal-title">Gia hạn &amp; Sửa Bản quyền</h3>
              <button
                className="btn-icon"
                onClick={() => {
                  setShowEditSubModal(false);
                  resetSubForm();
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateSubscription} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group">
                <label className="form-label">Phòng máy (Tenant ID)</label>
                <input
                  type="text"
                  className="form-input"
                  value={formTenantName}
                  disabled
                  style={{ opacity: 0.6, cursor: "not-allowed" }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Số lượng máy trạm tối đa</label>
                <input
                  type="number"
                  className="form-input"
                  min={1}
                  value={formMaxComputers}
                  onChange={(e) => setFormMaxComputers(Number(e.target.value))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Hạn sử dụng mới</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={formExpiresAt}
                  onChange={(e) => setFormExpiresAt(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Trạng thái gói</label>
                <select
                  className="form-input"
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                >
                  <option value="ACTIVE">Kích hoạt (ACTIVE)</option>
                  <option value="EXPIRED">Khóa / Hết hạn (EXPIRED)</option>
                </select>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowEditSubModal(false);
                    resetSubForm();
                  }}
                >
                  Hủy bỏ
                </button>
                <button type="submit" className="btn-glow">
                  <Check size={16} />
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Dashboard Tab
interface DailyDataEntry {
  date: string;
  totalAmount: number;
  sessionCount: number;
  totalMinutes: number;
}

interface DashboardData {
  dailyData: DailyDataEntry[];
  totalRevenue: number;
  totalSessions: number;
  totalMinutes: number;
  days: number;
}

type DashboardState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: DashboardData }
  | { status: "error"; message: string };

type DashboardAction =
  | { type: "FETCH_START" }
  | { type: "FETCH_SUCCESS"; data: DashboardData }
  | { type: "FETCH_ERROR"; message: string };

function dashboardReducer(
  _state: DashboardState,
  action: DashboardAction,
): DashboardState {
  switch (action.type) {
    case "FETCH_START":
      return { status: "loading" };
    case "FETCH_SUCCESS":
      return { status: "success", data: action.data };
    case "FETCH_ERROR":
      return { status: "error", message: action.message };
  }
}

function DashboardTab({
  apiBase,
  accessToken,
}: {
  apiBase: string;
  accessToken: string;
}) {
  const [days, setDays] = useState(7);
  const [state, dispatch] = useReducer(dashboardReducer, { status: "idle" });

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      dispatch({ type: "FETCH_START" });
      try {
        const r = await fetch(
          `${apiBase}/api/usage/dashboard?days=${days}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        const res = await r.json() as { success: boolean; data: DashboardData };
        if (cancelled) return;
        if (res.success) {
          dispatch({ type: "FETCH_SUCCESS", data: res.data });
        } else {
          dispatch({ type: "FETCH_ERROR", message: "Không thể tải dữ liệu dashboard." });
        }
      } catch {
        if (!cancelled) {
          dispatch({ type: "FETCH_ERROR", message: "Lỗi kết nối server." });
        }
      }
    };

    void fetchData();

    return () => {
      cancelled = true;
    };
  }, [days, apiBase, accessToken]);

  const barMax =
    state.status === "success" && state.data.dailyData.length > 0
      ? Math.max(...state.data.dailyData.map((d) => d.totalAmount), 1)
      : 1;

  return (
    <div style={{ padding: "32px", maxWidth: "900px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 700, margin: 0 }}>
          📊 Dashboard Doanh Thu
        </h2>
        <p style={{ color: "var(--text-muted, #6b7280)", marginTop: "4px", fontSize: "14px" }}>
          Thống kê doanh thu và phiên chơi của quán
        </p>
      </div>

      <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
        {[7, 14, 30].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            style={{
              padding: "6px 18px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "13px",
              background: days === d ? "var(--primary, #4f46e5)" : "var(--bg-secondary, #f3f4f6)",
              color: days === d ? "#fff" : "var(--text, #374151)",
            }}
          >
            {d} ngày
          </button>
        ))}
      </div>

      {state.status === "loading" && (
        <div style={{ textAlign: "center", padding: "48px", color: "var(--text-muted, #9ca3af)" }}>
          Đang tải...
        </div>
      )}

      {state.status === "error" && (
        <div style={{
          padding: "12px 16px",
          borderRadius: "8px",
          background: "#fef2f2",
          color: "#dc2626",
          marginBottom: "24px",
          fontSize: "14px",
        }}>
          {state.message}
        </div>
      )}

      {state.status === "success" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "32px" }}>
            <div style={{
              background: "var(--bg-card, #fff)",
              borderRadius: "12px",
              padding: "20px 24px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
              borderLeft: "4px solid var(--primary, #4f46e5)",
            }}>
              <div style={{ fontSize: "12px", color: "var(--text-muted, #6b7280)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Tổng doanh thu
              </div>
              <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--primary, #4f46e5)" }}>
                {state.data.totalRevenue.toLocaleString("vi-VN")} ₫
              </div>
            </div>

            <div style={{
              background: "var(--bg-card, #fff)",
              borderRadius: "12px",
              padding: "20px 24px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
              borderLeft: "4px solid #0ea5e9",
            }}>
              <div style={{ fontSize: "12px", color: "var(--text-muted, #6b7280)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Tổng phiên chơi
              </div>
              <div style={{ fontSize: "24px", fontWeight: 700, color: "#0ea5e9" }}>
                {state.data.totalSessions.toLocaleString("vi-VN")}
              </div>
            </div>

            <div style={{
              background: "var(--bg-card, #fff)",
              borderRadius: "12px",
              padding: "20px 24px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
              borderLeft: "4px solid #10b981",
            }}>
              <div style={{ fontSize: "12px", color: "var(--text-muted, #6b7280)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Tổng thời gian
              </div>
              <div style={{ fontSize: "24px", fontWeight: 700, color: "#10b981" }}>
                {Math.floor(state.data.totalMinutes / 60)}h {state.data.totalMinutes % 60}m
              </div>
            </div>
          </div>

          <div style={{
            background: "var(--bg-card, #fff)",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "24px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          }}>
            <h3 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "20px", marginTop: 0 }}>
              Doanh thu theo ngày (₫)
            </h3>
            {state.data.dailyData.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px", color: "var(--text-muted, #9ca3af)", fontSize: "14px" }}>
                Chưa có dữ liệu trong khoảng thời gian này
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", height: "180px" }}>
                {state.data.dailyData.map((d) => (
                  <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", height: "100%" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-muted, #9ca3af)", fontWeight: 500 }}>
                      {d.totalAmount > 0 ? `${(d.totalAmount / 1000).toFixed(0)}k` : ""}
                    </div>
                    <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
                      <div
                        style={{
                          width: "100%",
                          height: `${Math.max((d.totalAmount / barMax) * 100, d.totalAmount > 0 ? 4 : 0)}%`,
                          background: "linear-gradient(180deg, var(--primary, #4f46e5), #818cf8)",
                          borderRadius: "4px 4px 0 0",
                          minHeight: d.totalAmount > 0 ? "4px" : "0",
                          transition: "height 0.3s ease",
                        }}
                        title={`${d.date}: ${d.totalAmount.toLocaleString("vi-VN")} ₫`}
                      />
                    </div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted, #9ca3af)", textAlign: "center" }}>
                      {d.date.slice(5)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{
            background: "var(--bg-card, #fff)",
            borderRadius: "12px",
            padding: "24px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          }}>
            <h3 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "16px", marginTop: 0 }}>
              Chi tiết theo ngày
            </h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border, #e5e7eb)" }}>
                  <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-muted, #6b7280)", fontWeight: 600 }}>Ngày</th>
                  <th style={{ textAlign: "right", padding: "8px 12px", color: "var(--text-muted, #6b7280)", fontWeight: 600 }}>Doanh thu</th>
                  <th style={{ textAlign: "right", padding: "8px 12px", color: "var(--text-muted, #6b7280)", fontWeight: 600 }}>Phiên chơi</th>
                  <th style={{ textAlign: "right", padding: "8px 12px", color: "var(--text-muted, #6b7280)", fontWeight: 600 }}>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {state.data.dailyData.map((d, i) => (
                  <tr key={d.date} style={{ borderBottom: "1px solid var(--border, #f3f4f6)", background: i % 2 === 0 ? "transparent" : "var(--bg-secondary, #fafafa)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 500 }}>{d.date}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--primary, #4f46e5)", fontWeight: 600 }}>
                      {d.totalAmount.toLocaleString("vi-VN")} ₫
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>{d.sessionCount}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right", color: "#10b981" }}>
                      {Math.floor(d.totalMinutes / 60)}h {d.totalMinutes % 60}m
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
