import { useState, useEffect, useRef } from "react";
import {
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Upload,
  Trash2,
  RefreshCw,
  Sliders,
  ShieldCheck,
  Server,
  Layers,
  Monitor,
  Plus,
  Edit,
  X,
  Check,
} from "lucide-react";
import "./App.css";

// Dynamic API Host resolver
const API_BASE = window.location.origin.includes("5173")
  ? "http://localhost:3000"
  : window.location.origin;

// Default beautiful wallpapers to show if no images are uploaded
const MOCK_IMAGES = [
  {
    id: "mock-1",
    fileName: "Cyberpunk Gaming Room.jpg",
    filePath: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=600&auto=format&fit=crop",
    fileSize: 1048576 * 1.5, // 1.5MB
    mimeType: "image/jpeg",
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "mock-2",
    fileName: "Sci-Fi Cyber City.jpg",
    filePath: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=600&auto=format&fit=crop",
    fileSize: 1048576 * 2.3, // 2.3MB
    mimeType: "image/jpeg",
    isActive: true,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "mock-3",
    fileName: "Dark Abstract Liquid.jpg",
    filePath: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop",
    fileSize: 1048576 * 0.8, // 0.8MB
    mimeType: "image/jpeg",
    isActive: false,
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
];

// Initial mock subscriptions
const MOCK_SUBSCRIPTIONS = [
  {
    id: "sub-1",
    tenantId: "tenant_starlight",
    tenantName: "Net Cyber Starlight",
    status: "ACTIVE",
    maxComputers: 30,
    currentComputers: 25,
    expiresAt: new Date(Date.now() + 86400000 * 45).toISOString(), // 45 days remaining
  },
  {
    id: "sub-2",
    tenantId: "tenant_arena",
    tenantName: "Gaming Arena X",
    status: "ACTIVE",
    maxComputers: 15,
    currentComputers: 12,
    expiresAt: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 days remaining (expires soon)
  },
  {
    id: "sub-3",
    tenantId: "tenant_pro",
    tenantName: "Pro Gamer Center",
    status: "EXPIRED",
    maxComputers: 40,
    currentComputers: 40,
    expiresAt: new Date(Date.now() - 86400000 * 5).toISOString(), // Expired 5 days ago
  },
];

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

function App() {
  // Navigation & Role States
  const [role, setRole] = useState<"shop_admin" | "super_admin">("shop_admin");
  const [activeTab, setActiveTab] = useState<"assets" | "subscription" | "all_subscriptions">("assets");
  
  // App Modes and Statuses
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [checkingConn, setCheckingConn] = useState<boolean>(true);
  const [tenantId, setTenantId] = useState<string>("tenant_starlight"); // Simulated active tenant
  const [tenantName, setTenantName] = useState<string>("Net Cyber Starlight");

  // Core Data States
  const [assets, setAssets] = useState<Asset[]>([]);
  const [mySubscription, setMySubscription] = useState<Subscription | null>(null);
  const [allSubscriptions, setAllSubscriptions] = useState<Subscription[]>([]);
  
  // UI Feedbacks
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" } | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);

  // Modals States
  const [showAddSubModal, setShowAddSubModal] = useState<boolean>(false);
  const [showEditSubModal, setShowEditSubModal] = useState<boolean>(false);
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);

  // Form States
  const [formTenantId, setFormTenantId] = useState("");
  const [formTenantName, setFormTenantName] = useState("");
  const [formMaxComputers, setFormMaxComputers] = useState<number>(20);
  const [formExpiresAt, setFormExpiresAt] = useState("");
  const [formStatus, setFormStatus] = useState("ACTIVE");

  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const res = await fetch(`${API_BASE}/health`, { method: "GET" });
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
    // Periodically ping backend
    const interval = setInterval(checkConnection, 15000);
    return () => clearInterval(interval);
  }, []);

  // Fetch initial data based on Role and Server Connection Status
  useEffect(() => {
    if (isOnline) {
      // Fetch using Backend APIs
      fetchAssets();
      fetchMySubscription();
      if (role === "super_admin") {
        fetchAllSubscriptions();
      }
    } else {
      // Offline / Demo Mode: Hydrate from localStorage or default mocks
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

      // Find my active tenant subscription
      const found = currentAllSubs.find((s) => s.tenantId === tenantId);
      if (found) {
        setMySubscription(found);
      } else {
        const fallbackSub = currentAllSubs[0];
        setTenantId(fallbackSub.tenantId);
        setTenantName(fallbackSub.tenantName || "Net Cyber Starlight");
        setMySubscription(fallbackSub);
      }
    }
  }, [isOnline, role, tenantId]);

  // Sync tab layout when role changes
  useEffect(() => {
    if (role === "super_admin") {
      setActiveTab("all_subscriptions");
    } else {
      setActiveTab("assets");
    }
  }, [role]);

  // Show a visual notification
  const showToast = (message: string, type: "success" | "error" | "warning" = "success") => {
    setToast({ message, type });
  };

  // --- API / Local state operations ---

  const fetchAssets = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/assets`, {
        headers: {
          Authorization: `Bearer mock-token-for-dev`, // The actual project uses real tokens
        },
      });
      const data = await res.json();
      if (data.success) {
        setAssets(data.data);
      }
    } catch (e) {
      console.error("Failed to fetch assets from backend", e);
    }
  };

  const fetchMySubscription = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/subscriptions/me`, {
        headers: {
          Authorization: `Bearer mock-token-for-dev`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setMySubscription(data.data);
      }
    } catch (e) {
      console.error("Failed to fetch subscription from backend", e);
    }
  };

  const fetchAllSubscriptions = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/subscriptions`, {
        headers: {
          Authorization: `Bearer mock-token-for-dev`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setAllSubscriptions(data.data);
      }
    } catch (e) {
      console.error("Failed to fetch all subscriptions from backend", e);
    }
  };

  // Handle image upload with validation
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // Client-side validations (Person 5 specifications)
    const allowedExtensions = [".png", ".jpg", ".jpeg"];
    const fileExt = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    
    if (!allowedExtensions.includes(fileExt)) {
      showToast("Định dạng tệp không được hỗ trợ. Chỉ chấp nhận ảnh JPG, JPEG, PNG.", "error");
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      showToast(`Tệp quá lớn (${(file.size / 1024 / 1024).toFixed(2)} MB). Dung lượng tối đa là 5 MB.`, "error");
      return;
    }

    setUploading(true);

    if (isOnline) {
      // Backend Upload
      const formData = new FormData();
      formData.append("image", file);

      try {
        const res = await fetch(`${API_BASE}/api/assets/upload`, {
          method: "POST",
          headers: {
            Authorization: `Bearer mock-token-for-dev`,
          },
          body: formData,
        });

        const data = await res.json();
        if (data.success) {
          showToast("Tải ảnh màn hình khóa lên thành công!");
          fetchAssets();
        } else {
          showToast(data.error?.message || "Tải ảnh thất bại.", "error");
        }
      } catch (e) {
        showToast("Lỗi kết nối khi tải ảnh lên.", "error");
      } finally {
        setUploading(false);
      }
    } else {
      // Local Mock Upload via FileReader
      const reader = new FileReader();
      reader.onload = (e) => {
        const newAsset: Asset = {
          id: `local-${Date.now()}`,
          fileName: file.name,
          filePath: e.target?.result as string || "https://images.unsplash.com/photo-1542751371-adc38448a05e",
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
      reader.onerror = () => {
        showToast("Đọc tệp tin thất bại.", "error");
        setUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  // Toggle active status
  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;

    if (isOnline) {
      try {
        const res = await fetch(`${API_BASE}/api/assets/${id}/active`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer mock-token-for-dev`,
          },
          body: JSON.stringify({ isActive: nextStatus }),
        });

        const data = await res.json();
        if (data.success) {
          showToast(nextStatus ? "Đã kích hoạt ảnh hiển thị." : "Đã hủy kích hoạt ảnh.");
          fetchAssets();
        } else {
          showToast(data.error?.message || "Cập nhật thất bại.", "error");
        }
      } catch (e) {
        showToast("Lỗi kết nối khi cập nhật trạng thái.", "error");
      }
    } else {
      // Local Mock Update
      const updated = assets.map((a) => (a.id === id ? { ...a, isActive: nextStatus } : a));
      setAssets(updated);
      localStorage.setItem("cloudcms_assets", JSON.stringify(updated));
      showToast(nextStatus ? "Kích hoạt ảnh màn hình chờ (Giả lập)." : "Tắt kích hoạt ảnh (Giả lập).");
    }
  };

  // Delete asset
  const handleDeleteAsset = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa hình nền này?")) return;

    if (isOnline) {
      try {
        const res = await fetch(`${API_BASE}/api/assets/${id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer mock-token-for-dev`,
          },
        });

        const data = await res.json();
        if (data.success) {
          showToast("Đã xóa hình nền thành công.");
          fetchAssets();
        } else {
          showToast(data.error?.message || "Xóa hình nền thất bại.", "error");
        }
      } catch (e) {
        showToast("Lỗi kết nối khi xóa hình nền.", "error");
      }
    } else {
      // Local Mock Delete
      const updated = assets.filter((a) => a.id !== id);
      setAssets(updated);
      localStorage.setItem("cloudcms_assets", JSON.stringify(updated));
      showToast("Đã xóa hình nền (Giả lập).");
    }
  };

  // Super Admin: Create subscription
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

    if (isOnline) {
      try {
        const res = await fetch(`${API_BASE}/api/subscriptions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer mock-token-for-dev`,
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (data.success) {
          showToast("Cấp bản quyền phòng máy thành công!");
          fetchAllSubscriptions();
          setShowAddSubModal(false);
          resetSubForm();
        } else {
          showToast(data.error?.message || "Cấp bản quyền thất bại.", "error");
        }
      } catch (e) {
        showToast("Lỗi kết nối khi đăng ký bản quyền.", "error");
      }
    } else {
      // Local Mock Create
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
      showToast("Đăng ký bản quyền mới (Giả lập) thành công!");
      setShowAddSubModal(false);
      resetSubForm();
    }
  };

  // Super Admin: Update subscription
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

    if (isOnline) {
      try {
        const res = await fetch(`${API_BASE}/api/subscriptions/${selectedSub.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer mock-token-for-dev`,
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (data.success) {
          showToast("Gia hạn và cập nhật bản quyền thành công!");
          fetchAllSubscriptions();
          setShowEditSubModal(false);
          resetSubForm();
        } else {
          showToast(data.error?.message || "Gia hạn thất bại.", "error");
        }
      } catch (e) {
        showToast("Lỗi kết nối khi cập nhật gói.", "error");
      }
    } else {
      // Local Mock Update
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
      showToast("Gia hạn bản quyền (Giả lập) thành công!");
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
    // Format expiration date for HTML input type datetime-local
    const expiryDate = new Date(sub.expiresAt);
    const offset = expiryDate.getTimezoneOffset();
    const localDate = new Date(expiryDate.getTime() - offset * 60 * 1000);
    setFormExpiresAt(localDate.toISOString().slice(0, 16));
    setShowEditSubModal(true);
  };

  // Helper date conversions
  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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

  // Switch demo tenant
  const handleTenantChange = (newId: string) => {
    const found = allSubscriptions.find((s) => s.tenantId === newId);
    if (found) {
      setTenantId(newId);
      setTenantName(found.tenantName || newId);
      showToast(`Chuyển sang phòng máy: ${found.tenantName || newId}`);
    }
  };

  return (
    <div className="app-container">
      {/* Toast Alert */}
      {toast && (
        <div className={`modal-overlay`} style={{ background: "transparent", pointerEvents: "none" }}>
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

      {/* Sidebar */}
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

        {/* Navigation menu */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span className="role-badge-title" style={{ paddingLeft: "16px", marginBottom: "8px" }}>Menu chủ quán</span>
            <button
              className={`menu-item ${activeTab === "assets" && role === "shop_admin" ? "active" : ""}`}
              onClick={() => {
                setRole("shop_admin");
                setActiveTab("assets");
              }}
            >
              <ImageIcon size={18} />
              Màn hình khóa
            </button>
            <button
              className={`menu-item ${activeTab === "subscription" && role === "shop_admin" ? "active" : ""}`}
              onClick={() => {
                setRole("shop_admin");
                setActiveTab("subscription");
              }}
            >
              <Layers size={18} />
              Gói bản quyền
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span className="role-badge-title" style={{ paddingLeft: "16px", marginBottom: "8px" }}>Hệ thống</span>
            <button
              className={`menu-item ${role === "super_admin" ? "active" : ""}`}
              onClick={() => {
                setRole("super_admin");
                setActiveTab("all_subscriptions");
              }}
            >
              <ShieldCheck size={18} />
              Cấp phép Admin
            </button>
          </div>
        </nav>

        {/* Sidebar Footer Info */}
        <div className="sidebar-footer">
          {role === "shop_admin" && (
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
            <span className="role-badge-title">Chế độ phân quyền</span>
            <span className="role-badge-value">
              <Sliders size={14} />
              {role === "super_admin" ? "Super Admin" : "Shop Admin"}
            </span>
          </div>

          {/* Connection Status Indicator */}
          <div className="conn-status">
            <div className={`conn-dot ${isOnline ? "online" : "offline"}`}></div>
            <span>
              {checkingConn
                ? "Đang kiểm tra..."
                : isOnline
                ? "Máy chủ: Trực tuyến"
                : "Máy chủ: Ngoại tuyến (Demo)"}
            </span>
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
        </div>
      </aside>

      {/* Main Area */}
      <main className="content-area">
        {/* Render Tab: Assets (Lock Screen slideshow management) */}
        {role === "shop_admin" && activeTab === "assets" && (
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

            {/* Custom drag/drop box display */}
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
                  handleFileUpload(fakeEvent);
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

            {/* Image Gallery */}
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
                            // If load fail (e.g. invalid server path), show fallback
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                        <div className="asset-fallback">
                          <ImageIcon size={24} />
                          <span>{asset.fileName}</span>
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
                          <span>{new Date(asset.createdAt).toLocaleDateString("vi-VN")}</span>
                        </div>

                        <div className="asset-actions">
                          <label className="switch-label">
                            <input
                              type="checkbox"
                              checked={asset.isActive}
                              onChange={() => handleToggleActive(asset.id, asset.isActive)}
                              className="switch-input"
                            />
                            <span className="switch-slider"></span>
                            <span>Hiển thị</span>
                          </label>

                          <button
                            className="btn-icon"
                            onClick={() => handleDeleteAsset(asset.id)}
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

        {/* Render Tab: My Subscription Details (Tenant view) */}
        {role === "shop_admin" && activeTab === "subscription" && (
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
                {/* Check if subscription expiring soon or already expired */}
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
                        Chỉ còn **{getRemainingDays(mySubscription.expiresAt)} ngày** nữa là gói dịch vụ của quán sẽ hết thời hạn. Vui lòng gia hạn để tránh gián đoạn dịch vụ của khách chơi máy trạm.
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
        {role === "super_admin" && (
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
                </tbody>
              </table>
            </section>
          </div>
        )}
      </main>

      {/* Modal: Create Subscription */}
      {showAddSubModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in">
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

      {/* Modal: Edit/Extend Subscription */}
      {showEditSubModal && selectedSub && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in">
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

export default App;
