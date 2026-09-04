"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Cloud File Storage — Professional Dashboard
// ─────────────────────────────────────────────────────────────────────────────

import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Activity,
  AlertCircle,
  Archive,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleDot,
  Cloud,
  Database,
  Download,
  File,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  FolderOpen,
  GitBranch,
  HardDrive,
  Layers,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Package,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Trash2,
  UploadCloud,
  User,
  X,
  Zap,
} from "lucide-react";
import { deleteFile, fetchFileVersions, fetchFiles, getDownloadUrl } from "@/lib/api-client";
import { classNames } from "@/lib/client-utils";
import { formatBytes, formatDate } from "@/lib/format";
import type { CloudFile, CloudFileVersion, FileCategory, SortField, SortOrder } from "@/types/cloud-file";

// ─── Types ───────────────────────────────────────────────────────────────────

type Page =
  | "dashboard"
  | "files"
  | "upload"
  | "recent"
  | "versions"
  | "monitoring"
  | "settings";

type Toast = { id: number; type: "success" | "error" | "info"; message: string } | null;

type AwsStatus = {
  config?: {
    bucketName: string;
    region: string;
    prefix: string;
    configured: boolean;
    iamAccessControl: string;
  };
  metrics?: {
    bucketName: string;
    region: string;
    totalFiles: number;
    totalBytes: number;
    configured: boolean;
  };
};

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_SIZE = 50 * 1024 * 1024;
const STORAGE_CAP = 5 * 1024 * 1024 * 1024; // 5 GB free-tier reference

const TYPE_FILTERS: Array<{ label: string; value: FileCategory }> = [
  { label: "All files", value: "all" },
  { label: "Images", value: "image" },
  { label: "Documents", value: "document" },
  { label: "Videos", value: "video" },
  { label: "Audio", value: "audio" },
  { label: "Archives", value: "archive" },
  { label: "Other", value: "other" },
];

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", page: "dashboard" as Page, icon: LayoutDashboard },
    ],
  },
  {
    label: "Files",
    items: [
      { label: "My Files", page: "files" as Page, icon: FolderOpen },
      { label: "Upload Files", page: "upload" as Page, icon: UploadCloud },
      { label: "Recent Files", page: "recent" as Page, icon: Activity },
      { label: "Version History", page: "versions" as Page, icon: GitBranch },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Monitoring", page: "monitoring" as Page, icon: Activity },
      { label: "Settings", page: "settings" as Page, icon: Settings },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cx(...v: Array<string | false | null | undefined>) {
  return classNames(...v);
}

function extIcon(file: CloudFile) {
  const ext = file.extension?.toLowerCase() ?? "";
  const cat = file.category;

  if (["pdf"].includes(ext)) return { icon: FileText, color: "text-red-500", bg: "bg-red-50" };
  if (["doc", "docx", "txt", "rtf", "md"].includes(ext)) return { icon: FileText, color: "text-blue-500", bg: "bg-blue-50" };
  if (["xls", "xlsx", "csv"].includes(ext)) return { icon: FileSpreadsheet, color: "text-emerald-500", bg: "bg-emerald-50" };
  if (["ppt", "pptx"].includes(ext)) return { icon: FileText, color: "text-orange-500", bg: "bg-orange-50" };
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return { icon: Archive, color: "text-amber-500", bg: "bg-amber-50" };
  if (cat === "image") return { icon: FileImage, color: "text-violet-500", bg: "bg-violet-50" };
  if (cat === "video") return { icon: FileVideo, color: "text-rose-500", bg: "bg-rose-50" };
  if (cat === "audio") return { icon: FileAudio, color: "text-cyan-500", bg: "bg-cyan-50" };
  if (cat === "document") return { icon: FileText, color: "text-indigo-500", bg: "bg-indigo-50" };
  if (cat === "archive") return { icon: Package, color: "text-amber-500", bg: "bg-amber-50" };
  return { icon: File, color: "text-slate-400", bg: "bg-slate-100" };
}

function FileIcon({ file, size = 18 }: { file: CloudFile; size?: number }) {
  const { icon: Icon, color, bg } = extIcon(file);
  return (
    <span className={cx("inline-flex items-center justify-center rounded-lg", bg, "p-2")}>
      <Icon size={size} className={color} />
    </span>
  );
}

function categoryLabel(c: string) {
  const map: Record<string, string> = {
    image: "Image", document: "Document", video: "Video",
    audio: "Audio", archive: "Archive", other: "File",
  };
  return map[c] ?? "File";
}

// ─── Auth view toggle ─────────────────────────────────────────────────────────
type AuthView = "login" | "register";

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function CloudStorageApp() {
  // Auth
  const [authed, setAuthed] = useState<boolean | null>(null); // null = loading
  const [authView, setAuthView] = useState<AuthView>("login");
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; fullName: string } | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  // Registration fields
  const [regFullName, setRegFullName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");

  // Nav
  const [page, setPage] = useState<Page>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Files
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);

  // Toolbar
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FileCategory>("all");
  const [sort, setSort] = useState<SortField>("date");
  const [order, setOrder] = useState<SortOrder>("desc");

  // Details
  const [selectedFile, setSelectedFile] = useState<CloudFile | null>(null);
  const [versions, setVersions] = useState<CloudFileVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsFile, setVersionsFile] = useState<CloudFile | null>(null);

  // Upload
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  // AWS
  const [awsStatus, setAwsStatus] = useState<AwsStatus | null>(null);

  // Toast
  const [toast, setToast] = useState<Toast>(null);
  const toastId = useRef(0);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<CloudFile | null>(null);

  // Derived
  const totalBytes = useMemo(() => files.reduce((s, f) => s + f.size, 0), [files]);
  const recentFiles = useMemo(() => [...files].slice(0, 8), [files]);

  const visibleFiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return files
      .filter(f => (!q || f.name.toLowerCase().includes(q)) && (filter === "all" || f.category === filter))
      .sort((a, b) => {
        let v = 0;
        if (sort === "name") v = a.name.localeCompare(b.name);
        else if (sort === "size") v = a.size - b.size;
        else v = new Date(a.lastModified ?? 0).getTime() - new Date(b.lastModified ?? 0).getTime();
        return order === "asc" ? v : -v;
      });
  }, [files, search, filter, sort, order]);

  // ── Notifications ──────────────────────────────────────────────────────────

  function notify(type: "success" | "error" | "info", message: string) {
    const id = ++toastId.current;
    setToast({ id, type, message });
    window.setTimeout(() => setToast(t => (t?.id === id ? null : t)), 4500);
  }

  // ── Data ───────────────────────────────────────────────────────────────────

  async function loadFiles() {
    setLoading(true);
    try {
      const res = await fetchFiles({ search, filter, sort, order });
      setFiles(res.files ?? []);
      setConfigured(res.configured ?? true);
    } catch (e) {
      notify("error", e instanceof Error ? e.message : "Failed to load files.");
    } finally {
      setLoading(false);
    }
  }

  async function loadAwsStatus() {
    try {
      const res = await fetch("/api/aws/config", { cache: "no-store" });
      if (res.ok) setAwsStatus((await res.json()) as AwsStatus);
    } catch { /* silent */ }
  }

  async function loadVersionsForFile(f: CloudFile) {
    setVersionsFile(f);
    setVersionsLoading(true);
    setVersions([]);
    try {
      const v = await fetchFileVersions(f.key);
      setVersions(v);
      if (v.length === 0) notify("info", "No versions found. Enable S3 bucket versioning to track file history.");
    } catch (e) {
      notify("error", e instanceof Error ? e.message : "Failed to load version history.");
    } finally {
      setVersionsLoading(false);
    }
  }

  // ── Session restore on mount ───────────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (res.ok) {
          const data = (await res.json()) as { user: { id: string; email: string; fullName: string } };
          setCurrentUser(data.user);
          setAuthed(true);
        } else {
          setAuthed(false);
        }
      } catch {
        setAuthed(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!authed) return;
    void loadFiles();
  }, [authed, search, filter, sort, order]);

  useEffect(() => {
    if (!authed) return;
    void loadAwsStatus();
  }, [authed, files.length]);

// async function handleLogin(e: FormEvent) {
  async function handleLogin(e: FormEvent) {
  e.preventDefault();
  setAuthError(null);
  setAuthSuccess(null);

  if (!email.trim()) {
    setAuthError("Email is required.");
    return;
  }

  if (!password) {
    setAuthError("Password is required.");
    return;
  }

  setAuthLoading(true);

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        email,
        password,
      }),
    });

    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      message?: string;
      user?: {
        sub: string;
        email: string;
        fullName: string;
      };
    };

    if (!res.ok || !data.ok || !data.user) {
      setAuthError(data.error ?? "Invalid email or password.");
      return;
    }

    setCurrentUser({
      id: data.user.sub,
      email: data.user.email,
      fullName: data.user.fullName,
    });

    setAuthed(true);
    setPage("dashboard");
    setPassword("");
  } catch (err) {
    setAuthError(
      err instanceof Error
        ? err.message
        : "Network error. Please try again."
    );
  } finally {
    setAuthLoading(false);
  }
}

async function handleLogout() {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  } finally {
    setAuthed(false);
    setCurrentUser(null);
    setPage("auth");
    setPassword("");
  }
}

  // ── File actions ───────────────────────────────────────────────────────────

  async function handleDownload(f: CloudFile) {
    try {
      const url = await getDownloadUrl(f.key);
      const a = document.createElement("a");
      a.href = url; a.download = f.name; a.rel = "noopener noreferrer";
      document.body.appendChild(a); a.click(); a.remove();
      notify("success", `"${f.name}" download started.`);
    } catch (e) {
      notify("error", e instanceof Error ? e.message : "Download failed.");
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    const f = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteFile(f.key);
      notify("success", `"${f.name}" has been permanently deleted.`);
      if (selectedFile?.key === f.key) setSelectedFile(null);
      await loadFiles();
    } catch (e) {
      notify("error", e instanceof Error ? e.message : "Delete failed.");
    }
  }

  function openVersionHistory(f: CloudFile) {
    setVersionsFile(f);
    setPage("versions");
    void loadVersionsForFile(f);
  }

  // ── Upload ─────────────────────────────────────────────────────────────────

  function validateUpload(f: File) {
    if (!f) return "No file selected.";
    if (f.size === 0) return "Empty files cannot be uploaded.";
    if (f.size > MAX_SIZE) return `File exceeds the 50 MB limit (${formatBytes(f.size)}).`;
    return null;
  }

  function pickFile(f: File | null | undefined) {
    if (!f) return;
    const err = validateUpload(f);
    if (err) { notify("error", err); return; }
    setUploadFile(f);
    setUploadProgress(0);
  }

  function startUpload() {
    if (!uploadFile) { notify("error", "Select a file first."); return; }
    const err = validateUpload(uploadFile);
    if (err) { notify("error", err); return; }

    const fd = new FormData();
    fd.append("file", uploadFile);
    setUploading(true);
    setUploadProgress(0);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("POST", "/api/files/upload");
    xhr.upload.onprogress = ev => { if (ev.lengthComputable) setUploadProgress(Math.round(ev.loaded / ev.total * 100)); };
    xhr.onload = async () => {
      setUploading(false);
      xhrRef.current = null;
      if (xhr.status >= 200 && xhr.status < 300) {
        setUploadProgress(100);
        setUploadFile(null);
        if (fileRef.current) fileRef.current.value = "";
        notify("success", "File uploaded successfully to Amazon S3.");
        await loadFiles();
        setPage("files");
      } else {
        try { notify("error", (JSON.parse(xhr.responseText) as { message?: string }).message ?? "Upload failed."); }
        catch { notify("error", "Upload failed. Check your AWS configuration."); }
      }
    };
    xhr.onerror = () => { setUploading(false); xhrRef.current = null; notify("error", "Network error during upload."); };
    xhr.onabort = () => { setUploading(false); xhrRef.current = null; setUploadProgress(0); notify("info", "Upload cancelled."); };
    xhr.send(fd);
  }

  function cancelUpload() {
    if (uploading && xhrRef.current) { xhrRef.current.abort(); return; }
    setUploadFile(null);
    setUploadProgress(0);
    if (fileRef.current) fileRef.current.value = "";
  }

  // ─── Loading session ──────────────────────────────────────────────────────
  if (authed === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <span className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  // ─── Auth page (login + register) ────────────────────────────────────────
  if (!authed) {
    const brandPanel = (
      <div className="hidden lg:flex lg:w-[480px] xl:w-[520px] flex-col justify-between p-12 border-r border-white/5">
        <div>
          <div className="flex items-center gap-3 mb-16">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <Cloud size={18} className="text-white" />
            </div>
            <span className="text-white font-semibold tracking-tight">CloudStore</span>
          </div>
          <h1 className="text-4xl xl:text-5xl font-bold text-white leading-[1.1] tracking-tight mb-6">
            Enterprise cloud storage, simplified.
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            Secure file management powered by Amazon S3 with IAM access control and real-time CloudWatch monitoring.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Shield, label: "IAM Security", sub: "Least-privilege access" },
            { icon: HardDrive, label: "Amazon S3", sub: "11-nine durability" },
            { icon: Activity, label: "CloudWatch", sub: "Real-time monitoring" },
            { icon: GitBranch, label: "Versioning", sub: "Full file history" },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="rounded-xl border border-white/8 bg-white/4 p-4">
              <Icon size={18} className="text-blue-400 mb-2.5" />
              <p className="text-white text-sm font-medium">{label}</p>
              <p className="text-slate-500 text-xs mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      </div>
    );

    if (authView === "register") {
      return (
        <div className="min-h-screen bg-slate-950 flex">
          {brandPanel}
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="w-full max-w-sm">
              <div className="flex items-center gap-2.5 mb-8 lg:hidden">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <Cloud size={16} className="text-white" />
                </div>
                <span className="text-white font-semibold">CloudStore</span>
              </div>

              <h2 className="text-2xl font-bold text-white mb-1.5">Create your account</h2>
              <p className="text-slate-400 text-sm mb-6">Fill in the details below to get started.</p>

              {authError && (
                <div className="mb-4 flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                  <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
                  <p className="text-red-300 text-xs">{authError}</p>
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={regFullName}
                    onChange={e => setRegFullName(e.target.value)}
                    placeholder="Jane Smith"
                    disabled={authLoading}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 transition disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    placeholder="you@company.com"
                    disabled={authLoading}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 transition disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    disabled={authLoading}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 transition disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Confirm Password</label>
                  <input
                    type="password"
                    value={regConfirm}
                    onChange={e => setRegConfirm(e.target.value)}
                    placeholder="Repeat your password"
                    disabled={authLoading}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 transition disabled:opacity-50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/60 text-white text-sm font-semibold rounded-lg py-2.5 transition flex items-center justify-center gap-2"
                >
                  {authLoading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating account…</> : "Create Account"}
                </button>
              </form>

              <p className="text-slate-500 text-xs text-center mt-5">
                Already have an account?{" "}
                <button
                  onClick={() => { setAuthView("login"); setAuthError(null); setAuthSuccess(null); }}
                  className="text-blue-400 hover:text-blue-300 font-medium"
                >
                  Sign In
                </button>
              </p>
            </div>
          </div>
          {toast && <ToastBar toast={toast} onDismiss={() => setToast(null)} />}
        </div>
      );
    }

    // ── Login form ──────────────────────────────────────────────────────────
    return (
      <div className="min-h-screen bg-slate-950 flex">
        {brandPanel}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm">
            <div className="flex items-center gap-2.5 mb-10 lg:hidden">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <Cloud size={16} className="text-white" />
              </div>
              <span className="text-white font-semibold">CloudStore</span>
            </div>

            <h2 className="text-2xl font-bold text-white mb-1.5">Sign in to your account</h2>
            <p className="text-slate-400 text-sm mb-8">Enter your credentials to access the dashboard.</p>

            {authSuccess && (
              <div className="mb-4 flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2.5">
                <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                <p className="text-emerald-300 text-xs">{authSuccess}</p>
              </div>
            )}
            {authError && (
              <div className="mb-4 flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-red-300 text-xs">{authError}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-slate-400 mb-1.5">Email address</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setAuthError(null); }}
                  placeholder="you@company.com"
                  disabled={authLoading}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 transition disabled:opacity-50"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setAuthError(null); }}
                    placeholder="••••••••"
                    disabled={authLoading}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 transition disabled:opacity-50"
                  />
                  <Lock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600" />
                </div>
              </div>
              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/60 text-white text-sm font-semibold rounded-lg py-2.5 transition flex items-center justify-center gap-2"
              >
                {authLoading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing in…</> : "Sign In"}
              </button>
            </form>

            <p className="text-slate-500 text-xs text-center mt-5">
              Don&apos;t have an account?{" "}
              <button
                onClick={() => { setAuthView("register"); setAuthError(null); setAuthSuccess(null); }}
                className="text-blue-400 hover:text-blue-300 font-medium"
              >
                Create Account
              </button>
            </p>

            <p className="text-slate-600 text-xs mt-6 leading-relaxed">
              AWS credentials are managed server-side using IAM. Your access keys are never transmitted to the browser.
            </p>
          </div>
        </div>
        {toast && <ToastBar toast={toast} onDismiss={() => setToast(null)} />}
      </div>
    );
  }

  // ─── Authenticated shell ─────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f8fafc] flex text-slate-900">

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className={cx(
        "fixed inset-y-0 left-0 z-40 w-60 bg-slate-900 flex flex-col transition-transform duration-200",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      )}>
        {/* Logo */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-white/6 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
              <Cloud size={14} className="text-white" />
            </div>
            <span className="text-white font-semibold text-sm tracking-tight">CloudStore</span>
          </div>
          <button className="lg:hidden text-slate-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 thin-scroll">
          {NAV_GROUPS.map(group => (
            <div key={group.label} className="mb-5">
              <p className="px-4 text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
                {group.label}
              </p>
              {group.items.map(({ label, page: p, icon: Icon }) => (
                <button
                  key={p}
                  onClick={() => { setPage(p); setSidebarOpen(false); }}
                  className={cx(
                    "w-full flex items-center gap-2.5 px-4 py-2 text-sm transition rounded-md mx-0",
                    page === p
                      ? "text-white bg-white/8 font-medium"
                      : "text-slate-400 hover:text-slate-100 hover:bg-white/4",
                  )}
                >
                  <Icon size={15} className={cx(page === p ? "text-blue-400" : "text-slate-500")} />
                  {label}
                  {p === "upload" && (
                    <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/15 px-1.5 py-0.5 rounded">
                      New
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* S3 status chip */}
        <div className="px-3 pb-3 shrink-0">
          <div className={cx(
            "rounded-lg px-3 py-2.5 text-xs flex items-center gap-2",
            configured ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300",
          )}>
            <CircleDot size={11} className={cx("shrink-0", configured ? "text-emerald-400" : "text-amber-400")} />
            <div className="min-w-0">
              <p className="font-medium truncate">{configured ? "S3 Connected" : "S3 Not Configured"}</p>
              <p className="opacity-70 truncate mt-0.5">{awsStatus?.config?.region ?? "No region set"}</p>
            </div>
          </div>
        </div>

        {/* User profile */}
        <div className="border-t border-white/6 px-3 py-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
              <User size={14} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-200 text-xs font-medium truncate">{currentUser?.fullName || currentUser?.email || "User"}</p>
              <p className="text-slate-500 text-[10px] truncate">{currentUser?.email ?? ""}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-slate-500 hover:text-slate-300 transition"
              title="Sign out"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main column ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-60">

        {/* Top nav */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center gap-3 px-4 sm:px-6 shrink-0 sticky top-0 z-20">
          <button
            className="lg:hidden text-slate-400 hover:text-slate-700 transition"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>

          {/* Page title */}
          <div className="flex items-center gap-1.5 text-sm text-slate-500 min-w-0 mr-2">
            <span className="font-medium text-slate-900">{pageLabel(page)}</span>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-xs hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition">
            <Search size={14} className="text-slate-400 shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search files…"
              className="flex-1 bg-transparent text-sm outline-none text-slate-700 placeholder:text-slate-400"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600">
                <X size={12} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <button
              onClick={loadFiles}
              className={cx(
                "flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-100 transition",
              )}
            >
              <RefreshCw size={13} className={cx(loading ? "animate-spin" : "")} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button className="relative p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition">
              <Bell size={17} />
              {toast?.type === "error" && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>

            <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center cursor-default">
              <User size={13} className="text-white" />
            </div>
          </div>
        </header>

        {/* Page body */}
        <main className="flex-1 p-4 sm:p-6 overflow-auto thin-scroll">
          {page === "dashboard" && (
            <DashboardPage
              files={files} visibleFiles={visibleFiles} recentFiles={recentFiles}
              totalBytes={totalBytes} loading={loading} configured={configured}
              awsStatus={awsStatus}
              search={search} setSearch={setSearch}
              filter={filter} setFilter={setFilter}
              sort={sort} setSort={setSort}
              order={order} setOrder={setOrder}
              onUpload={() => setPage("upload")}
              onFiles={() => setPage("files")}
              onVersions={() => setPage("versions")}
              onDownload={handleDownload}
              onDelete={f => setDeleteTarget(f)}
              onVersionHistory={openVersionHistory}
            />
          )}
          {page === "files" && (
            <FilesPage
              files={visibleFiles} allCount={files.length} loading={loading}
              search={search} setSearch={setSearch}
              filter={filter} setFilter={setFilter}
              sort={sort} setSort={setSort}
              order={order} setOrder={setOrder}
              onDownload={handleDownload}
              onDelete={f => setDeleteTarget(f)}
              onVersionHistory={openVersionHistory}
            />
          )}
          {page === "upload" && (
            <UploadPage
              fileRef={fileRef}
              selectedFile={uploadFile}
              dragActive={dragActive}
              uploading={uploading}
              progress={uploadProgress}
              configured={configured}
              onDragActive={setDragActive}
              onDrop={ev => { ev.preventDefault(); ev.stopPropagation(); setDragActive(false); pickFile(ev.dataTransfer.files?.[0]); }}
              onInput={ev => pickFile(ev.target.files?.[0])}
              onStart={startUpload}
              onCancel={cancelUpload}
            />
          )}
          {page === "recent" && (
            <RecentPage
              files={recentFiles} loading={loading}
              onDownload={handleDownload}
              onDelete={f => setDeleteTarget(f)}
              onVersionHistory={openVersionHistory}
            />
          )}
          {page === "versions" && (
            <VersionsPage
              file={versionsFile} versions={versions} loading={versionsLoading}
              allFiles={files}
              onPickFile={f => void loadVersionsForFile(f)}
              onRefresh={() => versionsFile && void loadVersionsForFile(versionsFile)}
            />
          )}
          {page === "monitoring" && (
            <MonitoringPage awsStatus={awsStatus} files={files} totalBytes={totalBytes} onRefresh={loadAwsStatus} />
          )}
          {page === "settings" && (
            <SettingsPage awsStatus={awsStatus} onRefresh={loadAwsStatus} />
          )}
        </main>
      </div>

              {/* Delete dialog */}
        {deleteTarget ? (
          <DeleteDialog
            file={deleteTarget}
            onConfirm={handleDeleteConfirmed}
            onCancel={() => setDeleteTarget(null)}
          />
        ) : null}

        {/* Toast */}
        {toast ? (
          <ToastBar
            toast={toast}
            onDismiss={() => setToast(null)}
          />
        ) : null}
      </div>
    );
}

// ─── Page label ───────────────────────────────────────────────────────────────

function pageLabel(p: Page) {
  const m: Record<Page, string> = {
    dashboard: "Dashboard", files: "My Files", upload: "Upload Files",
    recent: "Recent Files", versions: "Version History",
    monitoring: "Monitoring", settings: "Settings",
  };
  return m[p] ?? p;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard page
// ─────────────────────────────────────────────────────────────────────────────

function DashboardPage(props: {
  files: CloudFile[]; visibleFiles: CloudFile[]; recentFiles: CloudFile[];
  totalBytes: number; loading: boolean; configured: boolean | null;
  awsStatus: AwsStatus | null;
  search: string; setSearch: (v: string) => void;
  filter: FileCategory; setFilter: (v: FileCategory) => void;
  sort: SortField; setSort: (v: SortField) => void;
  order: SortOrder; setOrder: (v: SortOrder) => void;
  onUpload: () => void; onFiles: () => void; onVersions: () => void;
  onDownload: (f: CloudFile) => void;
  onDelete: (f: CloudFile) => void;
  onVersionHistory: (f: CloudFile) => void;
}) {
  const usedPct = Math.min((props.totalBytes / STORAGE_CAP) * 100, 100);
  const available = Math.max(STORAGE_CAP - props.totalBytes, 0);
  const imgCount = props.files.filter(f => f.category === "image").length;
  const docCount = props.files.filter(f => f.category === "document").length;

  return (
    <div className="space-y-5 max-w-[1400px]">

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Files"
          value={props.files.length.toLocaleString()}
          sub={`${imgCount} images · ${docCount} docs`}
          icon={<FolderOpen size={16} />}
          accent="blue"
        />
        <StatCard
          label="Storage Used"
          value={formatBytes(props.totalBytes)}
          sub={`${usedPct.toFixed(1)}% of ${formatBytes(STORAGE_CAP)}`}
          icon={<HardDrive size={16} />}
          accent="violet"
          progress={usedPct}
        />
        <StatCard
          label="Recent Uploads"
          value={props.recentFiles.length.toString()}
          sub="Most recent files"
          icon={<Activity size={16} />}
          accent="emerald"
        />
        <StatCard
          label="Storage Status"
          value={props.configured ? "Connected" : "Inactive"}
          sub={props.configured ? `S3 · ${props.awsStatus?.config?.region ?? "–"}` : "Configure AWS variables"}
          icon={<Database size={16} />}
          accent={props.configured ? "emerald" : "amber"}
          statusDot={props.configured}
        />
      </div>

      <div className="grid xl:grid-cols-[1fr_320px] gap-5">
        <div className="space-y-5">
          {/* Quick actions */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Quick Actions</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={props.onUpload}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
              >
                <UploadCloud size={15} /> Upload Files
              </button>
              <button
                onClick={props.onFiles}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg transition"
              >
                <FolderOpen size={15} /> View All Files
              </button>
              <button
                onClick={props.onVersions}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg transition"
              >
                <GitBranch size={15} /> Version History
              </button>
            </div>
          </div>

          {/* Recent files table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Recent Files</h2>
                <p className="text-xs text-slate-400 mt-0.5">Last {props.recentFiles.length} objects from S3</p>
              </div>
              <button
                onClick={props.onFiles}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-500 font-medium"
              >
                View all <ChevronRight size={12} />
              </button>
            </div>
            <SearchBar search={props.search} setSearch={props.setSearch} filter={props.filter} setFilter={props.setFilter} />
            {props.loading
              ? <TableSkeleton />
              : props.recentFiles.length === 0
                ? <EmptyFiles onUpload={props.onUpload} />
                : <FileTable
                    files={props.recentFiles}
                    sort={props.sort} setSort={props.setSort}
                    order={props.order} setOrder={props.setOrder}
                    onDownload={props.onDownload}
                    onDelete={props.onDelete}
                    onVersionHistory={props.onVersionHistory}
                  />
            }
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Storage overview */}
          <StorageOverview totalBytes={props.totalBytes} usedPct={usedPct} available={available} />

          {/* AWS services */}
          <AwsServices awsStatus={props.awsStatus} configured={props.configured} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Files page
// ─────────────────────────────────────────────────────────────────────────────

function FilesPage(props: {
  files: CloudFile[]; allCount: number; loading: boolean;
  search: string; setSearch: (v: string) => void;
  filter: FileCategory; setFilter: (v: FileCategory) => void;
  sort: SortField; setSort: (v: SortField) => void;
  order: SortOrder; setOrder: (v: SortOrder) => void;
  onDownload: (f: CloudFile) => void;
  onDelete: (f: CloudFile) => void;
  onVersionHistory: (f: CloudFile) => void;
}) {
  return (
    <div className="max-w-[1400px] space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">My Files</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {props.allCount} object{props.allCount !== 1 ? "s" : ""} in Amazon S3
          {props.files.length !== props.allCount && ` · ${props.files.length} shown after filters`}
        </p>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <SearchBar search={props.search} setSearch={props.setSearch} filter={props.filter} setFilter={props.setFilter} />
        <div className="border-t border-slate-100 flex items-center gap-3 px-4 py-2.5 bg-slate-50/50">
          <span className="text-xs text-slate-500">Sort by</span>
          {(["name", "size", "date"] as SortField[]).map(field => (
            <button
              key={field}
              onClick={() => {
                if (props.sort === field) props.setOrder(props.order === "asc" ? "desc" : "asc");
                else { props.setSort(field); props.setOrder("asc"); }
              }}
              className={cx(
                "flex items-center gap-1 text-xs px-2 py-1 rounded-md transition font-medium",
                props.sort === field ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
              )}
            >
              {field.charAt(0).toUpperCase() + field.slice(1)}
              {props.sort === field && (props.order === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
            </button>
          ))}
        </div>
        {props.loading
          ? <TableSkeleton />
          : props.files.length === 0
            ? <EmptyFiles />
            : <FileTable
                files={props.files}
                sort={props.sort} setSort={props.setSort}
                order={props.order} setOrder={props.setOrder}
                onDownload={props.onDownload}
                onDelete={props.onDelete}
                onVersionHistory={props.onVersionHistory}
              />
        }
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Recent Files page
// ─────────────────────────────────────────────────────────────────────────────

function RecentPage(props: {
  files: CloudFile[]; loading: boolean;
  onDownload: (f: CloudFile) => void;
  onDelete: (f: CloudFile) => void;
  onVersionHistory: (f: CloudFile) => void;
}) {
  return (
    <div className="max-w-[1400px] space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Recent Files</h1>
        <p className="text-sm text-slate-500 mt-0.5">The {props.files.length} most recently uploaded objects from S3</p>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {props.loading
          ? <TableSkeleton />
          : props.files.length === 0
            ? <EmptyFiles />
            : <FileTable
                files={props.files}
                sort="date" setSort={() => undefined}
                order="desc" setOrder={() => undefined}
                onDownload={props.onDownload}
                onDelete={props.onDelete}
                onVersionHistory={props.onVersionHistory}
              />
        }
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload page
// ─────────────────────────────────────────────────────────────────────────────

function UploadPage(props: {
  fileRef: React.RefObject<HTMLInputElement | null>;
  selectedFile: File | null; dragActive: boolean;
  uploading: boolean; progress: number; configured: boolean | null;
  onDragActive: (v: boolean) => void;
  onDrop: (ev: DragEvent<HTMLDivElement>) => void;
  onInput: (ev: ChangeEvent<HTMLInputElement>) => void;
  onStart: () => void; onCancel: () => void;
}) {
  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Upload Files</h1>
        <p className="text-sm text-slate-500 mt-0.5">Files are stored directly in Amazon S3 via the backend API.</p>
      </div>

      {props.configured === false && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          AWS S3 is not configured. Set the environment variables before uploading.
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragEnter={e => { e.preventDefault(); props.onDragActive(true); }}
        onDragOver={e => { e.preventDefault(); props.onDragActive(true); }}
        onDragLeave={e => { e.preventDefault(); props.onDragActive(false); }}
        onDrop={props.onDrop}
        className={cx(
          "relative border-2 border-dashed rounded-xl p-10 text-center transition",
          props.dragActive
            ? "border-blue-400 bg-blue-50"
            : "border-slate-300 bg-white hover:border-blue-300 hover:bg-slate-50/50",
        )}
      >
        <div className="flex flex-col items-center gap-3 pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
            <UploadCloud size={22} className={cx("transition", props.dragActive ? "text-blue-500" : "text-slate-400")} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700">Drag and drop files here</p>
            <p className="text-xs text-slate-400 mt-1">or click to browse · max {formatBytes(MAX_SIZE)}</p>
          </div>
        </div>
        <input
          ref={props.fileRef}
          type="file"
          className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={props.onInput}
          disabled={props.uploading || props.configured === false}
        />
      </div>

      {/* Selected file */}
      {props.selectedFile && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <FileText size={18} className="text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{props.selectedFile.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {formatBytes(props.selectedFile.size)} · {props.selectedFile.type || "Unknown type"}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={props.onCancel}
                className="text-xs text-slate-500 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={props.onStart}
                disabled={props.uploading}
                className="text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 text-white rounded-lg px-3 py-1.5 transition"
              >
                {props.uploading ? "Uploading…" : "Upload"}
              </button>
            </div>
          </div>

          {props.uploading && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>Uploading to Amazon S3</span>
                <span>{props.progress}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-150"
                  style={{ width: `${props.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        <div className="px-4 py-3">
          <p className="text-xs font-semibold text-slate-600 mb-1">How it works</p>
          <ol className="space-y-1.5 text-xs text-slate-500">
            {[
              "Select or drag a file into the upload area.",
              "The file is sent to POST /api/files/upload on the backend.",
              "Express passes the file to S3 using PutObjectCommand.",
              "The file list refreshes automatically from Amazon S3.",
            ].map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="shrink-0 w-4 h-4 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </div>
        <div className="px-4 py-3 flex items-start gap-2 text-xs text-slate-400">
          <Shield size={13} className="shrink-0 mt-0.5 text-slate-300" />
          AWS credentials are stored server-side only. The browser never receives your access keys.
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Version History page
// ─────────────────────────────────────────────────────────────────────────────

function VersionsPage(props: {
  file: CloudFile | null; versions: CloudFileVersion[]; loading: boolean;
  allFiles: CloudFile[];
  onPickFile: (f: CloudFile) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="max-w-[1000px] space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Version History</h1>
        <p className="text-sm text-slate-500 mt-0.5">Browse all stored versions of an S3 object.</p>
      </div>

      {/* File picker */}
      {!props.file && props.allFiles.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-sm font-medium text-slate-700 mb-3">Select a file to view its version history</p>
          <div className="space-y-1 max-h-60 overflow-y-auto thin-scroll">
            {props.allFiles.map(f => (
              <button
                key={f.key}
                onClick={() => props.onPickFile(f)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-50 text-left transition"
              >
                <FileIcon file={f} size={14} />
                <span className="flex-1 text-sm text-slate-700 truncate">{f.name}</span>
                <ChevronRight size={13} className="text-slate-300 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {props.file && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileIcon file={props.file} size={14} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{props.file.name}</p>
                <p className="text-xs text-slate-400 truncate">{props.versions.length} version{props.versions.length !== 1 ? "s" : ""} · S3 key: {props.file.key}</p>
              </div>
            </div>
            <button
              onClick={props.onRefresh}
              className="flex items-center gap-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition"
            >
              <RefreshCw size={12} className={props.loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>

          {props.loading ? <TableSkeleton /> : props.versions.length === 0 ? (
            <div className="flex flex-col items-center py-14 text-center px-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <Layers size={20} className="text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-600">No versions found</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">Enable S3 bucket versioning and upload files multiple times to create version history.</p>
            </div>
          ) : (
            <div className="overflow-x-auto thin-scroll">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    {["Version ID", "Last Modified", "Size", "Status"].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-slate-400 px-4 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {props.versions.map(v => (
                    <tr key={v.versionId} className="hover:bg-slate-50/50 transition">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500 max-w-[180px]">
                        <span className="truncate block">{v.versionId}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{formatDate(v.lastModified)}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{formatBytes(v.size)}</td>
                      <td className="px-4 py-3">
                        {v.isCurrentVersion ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                            <CircleDot size={9} />Current
                          </span>
                        ) : (
                          <span className="inline-flex text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            Previous
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!props.file && props.allFiles.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl flex flex-col items-center py-14">
          <Layers size={28} className="text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-500">No files in S3 yet</p>
          <p className="text-xs text-slate-400 mt-1">Upload files first, then view their version history here.</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Monitoring page
// ─────────────────────────────────────────────────────────────────────────────

function MonitoringPage(props: {
  awsStatus: AwsStatus | null; files: CloudFile[];
  totalBytes: number; onRefresh: () => void;
}) {
  const usedPct = Math.min((props.totalBytes / STORAGE_CAP) * 100, 100);

  return (
    <div className="max-w-[1000px] space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Monitoring</h1>
          <p className="text-sm text-slate-500 mt-0.5">Live metrics pulled from Amazon S3 and AWS configuration.</p>
        </div>
        <button onClick={props.onRefresh} className="flex items-center gap-1.5 text-xs text-slate-600 border border-slate-200 bg-white rounded-lg px-3 py-1.5 hover:bg-slate-50 transition">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <MetricTile label="Total Objects" value={props.files.length.toLocaleString()} icon={<FolderOpen size={15} />} />
        <MetricTile label="Storage Used" value={formatBytes(props.totalBytes)} icon={<HardDrive size={15} />} />
        <MetricTile label="Capacity Used" value={`${usedPct.toFixed(1)}%`} icon={<Activity size={15} />} />
      </div>

      <StorageOverview totalBytes={props.totalBytes} usedPct={usedPct} available={Math.max(STORAGE_CAP - props.totalBytes, 0)} />
      <AwsServices awsStatus={props.awsStatus} configured={props.awsStatus?.config?.configured ?? null} />

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">CloudWatch Integration</h3>
        <p className="text-xs text-slate-500 leading-relaxed mb-3">
          The Express backend emits structured JSON logs to stdout on every S3 operation. When deployed on AWS (EC2, ECS, Lambda), CloudWatch Logs captures these automatically.
        </p>
        <div className="bg-slate-950 rounded-lg p-3 text-xs font-mono text-slate-300 overflow-x-auto thin-scroll">
          {`{"timestamp":"${new Date().toISOString()}","level":"INFO","event":"s3.upload.success","message":"File uploaded successfully to S3"}`}
        </div>
        <p className="text-xs text-slate-400 mt-2">See <strong className="text-slate-600">CLOUDWATCH.md</strong> for setup instructions, metric filters, and Logs Insights queries.</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings page
// ─────────────────────────────────────────────────────────────────────────────

function SettingsPage(props: { awsStatus: AwsStatus | null; onRefresh: () => void }) {
  const cfg = props.awsStatus?.config;
  const met = props.awsStatus?.metrics;
  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">AWS configuration and application preferences.</p>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-semibold text-slate-700">AWS Configuration</p>
          <button onClick={props.onRefresh} className="flex items-center gap-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition">
            <RefreshCw size={11} /> Refresh
          </button>
        </div>
        {[
          ["S3 Bucket", cfg?.bucketName ?? "Not configured"],
          ["AWS Region", cfg?.region ?? "Not configured"],
          ["Key Prefix", cfg?.prefix || "Bucket root"],
          ["Configured", cfg?.configured ? "Yes" : "No"],
          ["IAM Access", "Least-privilege policy (see AWS_SECURITY.md)"],
          ["Total Objects", String(met?.totalFiles ?? 0)],
          ["Storage Used", formatBytes(met?.totalBytes ?? 0)],
          ["Versioning", "Enabled — see CLOUDWATCH.md"],
          ["Logging", "Structured JSON → stdout → CloudWatch"],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between px-4 py-2.5 gap-4">
            <span className="text-xs text-slate-500 shrink-0">{label}</span>
            <span className="text-xs font-medium text-slate-800 text-right break-all">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared components
// ─────────────────────────────────────────────────────────────────────────────

// File table

function FileTable(props: {
  files: CloudFile[];
  sort: SortField; setSort: (v: SortField) => void;
  order: SortOrder; setOrder: (v: SortOrder) => void;
  onDownload: (f: CloudFile) => void;
  onDelete: (f: CloudFile) => void;
  onVersionHistory: (f: CloudFile) => void;
}) {
  function SortTh({ field, label }: { field: SortField; label: string }) {
    const active = props.sort === field;
    return (
      <th
        className="text-left text-xs font-semibold text-slate-400 px-4 py-2.5 cursor-pointer select-none whitespace-nowrap"
        onClick={() => {
          if (active) props.setOrder(props.order === "asc" ? "desc" : "asc");
          else { props.setSort(field); props.setOrder("asc"); }
        }}
      >
        <span className={cx("flex items-center gap-1 hover:text-slate-600 transition", active && "text-blue-600")}>
          {label}
          {active ? (props.order === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronDown size={11} className="opacity-30" />}
        </span>
      </th>
    );
  }

  return (
    <div className="overflow-x-auto thin-scroll">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/60">
            <SortTh field="name" label="File Name" />
            <th className="text-left text-xs font-semibold text-slate-400 px-4 py-2.5">Type</th>
            <SortTh field="size" label="Size" />
            <SortTh field="date" label="Last Modified" />
            <th className="text-left text-xs font-semibold text-slate-400 px-4 py-2.5">Status</th>
            <th className="text-right text-xs font-semibold text-slate-400 px-4 py-2.5">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {props.files.map(f => (
            <tr key={f.key} className="hover:bg-slate-50/60 transition">
              {/* Name */}
              <td className="px-4 py-3 max-w-[220px]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileIcon file={f} size={15} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{f.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{f.key}</p>
                  </div>
                </div>
              </td>
              {/* Type */}
              <td className="px-4 py-3 whitespace-nowrap">
                <span className={cx("inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full", typePillStyle(f.category))}>
                  {categoryLabel(f.category)}
                </span>
              </td>
              {/* Size */}
              <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatBytes(f.size)}</td>
              {/* Modified */}
              <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(f.lastModified)}</td>
              {/* Status */}
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  <CircleDot size={9} />Stored
                </span>
              </td>
              {/* Actions */}
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <ActionIconBtn icon={<Download size={13} />} label="Download" onClick={() => props.onDownload(f)} color="blue" />
                  <ActionIconBtn icon={<GitBranch size={13} />} label="Versions" onClick={() => props.onVersionHistory(f)} color="violet" />
                  <ActionIconBtn icon={<Trash2 size={13} />} label="Delete" onClick={() => props.onDelete(f)} color="red" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function typePillStyle(cat: string) {
  const m: Record<string, string> = {
    image: "bg-violet-50 text-violet-700", document: "bg-blue-50 text-blue-700",
    video: "bg-rose-50 text-rose-700", audio: "bg-cyan-50 text-cyan-700",
    archive: "bg-amber-50 text-amber-700", other: "bg-slate-100 text-slate-600",
  };
  return m[cat] ?? m["other"];
}

function ActionIconBtn(props: { icon: React.ReactNode; label: string; onClick: () => void; color: "blue" | "violet" | "red" }) {
  const clr = { blue: "hover:bg-blue-50 hover:text-blue-600", violet: "hover:bg-violet-50 hover:text-violet-600", red: "hover:bg-red-50 hover:text-red-600" };
  return (
    <button
      onClick={props.onClick}
      title={props.label}
      aria-label={props.label}
      className={cx("p-1.5 rounded-md text-slate-400 transition", clr[props.color])}
    >
      {props.icon}
    </button>
  );
}

// Search bar

function SearchBar(props: { search: string; setSearch: (v: string) => void; filter: FileCategory; setFilter: (v: FileCategory) => void }) {
  return (
    <div className="px-4 py-3 space-y-2.5">
      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition">
        <Search size={13} className="text-slate-400 shrink-0" />
        <input
          value={props.search}
          onChange={e => props.setSearch(e.target.value)}
          placeholder="Search by file name…"
          className="flex-1 bg-transparent text-sm outline-none text-slate-700 placeholder:text-slate-400"
        />
        {props.search && <button onClick={() => props.setSearch("")} className="text-slate-400 hover:text-slate-600"><X size={12} /></button>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TYPE_FILTERS.map(item => (
          <button
            key={item.value}
            onClick={() => props.setFilter(item.value)}
            className={cx(
              "text-xs px-2.5 py-1 rounded-full font-medium transition",
              props.filter === item.value
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Stat card

type Accent = "blue" | "violet" | "emerald" | "amber";

function StatCard(props: {
  label: string; value: string; sub: string;
  icon: React.ReactNode; accent: Accent;
  progress?: number; statusDot?: boolean | null;
}) {
  const accentBg: Record<Accent, string> = { blue: "bg-blue-50 text-blue-600", violet: "bg-violet-50 text-violet-600", emerald: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-600" };
  const accentBar: Record<Accent, string> = { blue: "bg-blue-500", violet: "bg-violet-500", emerald: "bg-emerald-500", amber: "bg-amber-400" };
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{props.label}</p>
        <div className={cx("w-7 h-7 rounded-lg flex items-center justify-center", accentBg[props.accent])}>
          {props.icon}
        </div>
      </div>
      <div>
        <div className="flex items-center gap-2">
          {props.statusDot !== undefined && (
            <span className={cx("w-1.5 h-1.5 rounded-full shrink-0", props.statusDot ? "bg-emerald-500" : "bg-amber-400")} />
          )}
          <p className="text-xl font-bold text-slate-900 leading-none">{props.value}</p>
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5">{props.sub}</p>
      </div>
      {props.progress !== undefined && (
        <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
          <div className={cx("h-full rounded-full transition-all", accentBar[props.accent])} style={{ width: `${props.progress}%` }} />
        </div>
      )}
    </div>
  );
}

// Storage overview

function StorageOverview(props: { totalBytes: number; usedPct: number; available: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Storage Overview</h3>
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">Used</span>
          <span className="font-medium text-slate-700">{formatBytes(props.totalBytes)} of {formatBytes(STORAGE_CAP)}</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${props.usedPct}%` }} />
        </div>
        <p className="text-[11px] text-slate-400 text-right">{props.usedPct.toFixed(1)}% used</p>
      </div>
      <div className="space-y-2.5">
        {[
          { label: "Total capacity", value: formatBytes(STORAGE_CAP), dot: "bg-slate-200" },
          { label: "Used storage", value: formatBytes(props.totalBytes), dot: "bg-blue-500" },
          { label: "Available", value: formatBytes(props.available), dot: "bg-emerald-400" },
        ].map(({ label, value, dot }) => (
          <div key={label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={cx("w-2 h-2 rounded-full shrink-0", dot)} />
              <span className="text-xs text-slate-500">{label}</span>
            </div>
            <span className="text-xs font-medium text-slate-700">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// AWS services

function AwsServices(props: { awsStatus: AwsStatus | null; configured: boolean | null }) {
  const services = [
    { label: "Amazon S3", sub: props.awsStatus?.config?.bucketName ?? "Not configured", ok: Boolean(props.awsStatus?.config?.configured), icon: <Database size={14} /> },
    { label: "AWS IAM", sub: "Least-privilege policy", ok: Boolean(props.configured), icon: <Shield size={14} /> },
    { label: "CloudWatch", sub: "Structured JSON logging", ok: true, icon: <Activity size={14} /> },
    { label: "AWS Region", sub: props.awsStatus?.config?.region ?? "Not set", ok: Boolean(props.awsStatus?.config?.region), icon: <Zap size={14} /> },
  ];
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">AWS Services</h3>
      <div className="space-y-2.5">
        {services.map(({ label, sub, ok, icon }) => (
          <div key={label} className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 shrink-0">
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-700">{label}</p>
              <p className="text-[11px] text-slate-400 truncate">{sub}</p>
            </div>
            <span className={cx(
              "shrink-0 w-2 h-2 rounded-full",
              ok ? "bg-emerald-400" : "bg-amber-400",
            )} title={ok ? "Connected" : "Not configured"} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Metric tile

function MetricTile(props: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
      <div className="w-9 h-9 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center text-slate-500 shrink-0">
        {props.icon}
      </div>
      <div>
        <p className="text-xl font-bold text-slate-900">{props.value}</p>
        <p className="text-xs text-slate-400 mt-0.5">{props.label}</p>
      </div>
    </div>
  );
}

// Empty state

function EmptyFiles(props: { onUpload?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
        <FolderOpen size={20} className="text-slate-400" />
      </div>
      <p className="text-sm font-medium text-slate-600">No files stored yet</p>
      <p className="text-xs text-slate-400 mt-1 max-w-xs">Upload your first file to Amazon S3 to see it appear here.</p>
      {props.onUpload && (
        <button onClick={props.onUpload} className="mt-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition">
          <UploadCloud size={13} /> Upload a file
        </button>
      )}
    </div>
  );
}

// Skeleton loader

function TableSkeleton() {
  return (
    <div className="p-4 space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-100 animate-pulse shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 bg-slate-100 rounded animate-pulse w-3/5" />
            <div className="h-2 bg-slate-100 rounded animate-pulse w-2/5" />
          </div>
          <div className="h-2.5 bg-slate-100 rounded animate-pulse w-16" />
          <div className="h-2.5 bg-slate-100 rounded animate-pulse w-24" />
        </div>
      ))}
    </div>
  );
}

// Delete confirmation dialog

function DeleteDialog(props: { file: CloudFile; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center shrink-0 mt-0.5">
            <Trash2 size={16} className="text-red-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Delete file</h3>
            <p className="text-xs text-slate-500 mt-1">
              <span className="font-medium text-slate-700">{props.file.name}</span> will be permanently removed from Amazon S3. This cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={props.onCancel} className="text-sm text-slate-600 border border-slate-200 rounded-lg px-4 py-2 hover:bg-slate-50 transition">
            Cancel
          </button>
          <button onClick={props.onConfirm} className="text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg px-4 py-2 transition">
            Delete permanently
          </button>
        </div>
      </div>
    </div>
  );
}

// Toast

function ToastBar(props: { toast: Exclude<Toast, null>; onDismiss: () => void }) {
  const styles = {
    success: { bar: "bg-white border-emerald-200", icon: <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />, text: "text-slate-700" },
    error: { bar: "bg-white border-red-200", icon: <AlertCircle size={15} className="text-red-500 shrink-0" />, text: "text-slate-700" },
    info: { bar: "bg-white border-blue-200", icon: <CircleDot size={15} className="text-blue-500 shrink-0" />, text: "text-slate-700" },
  };
  const s = styles[props.toast.type];
  return (
    <div className={cx("fixed bottom-5 right-5 z-50 flex items-center gap-2.5 border rounded-xl shadow-lg px-4 py-3 max-w-sm text-sm", s.bar)}>
      {s.icon}
      <span className={cx("flex-1 leading-snug", s.text)}>{props.toast.message}</span>
      <button onClick={props.onDismiss} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={13} /></button>
    </div>
  );
}
