import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Cpu,
  Eye,
  EyeOff,
  GitBranch,
  Lock,
  ShieldCheck,
  User,
  Zap,
} from "lucide-react";
import { api } from "../services/api";
import {
  registerWithEmailFirebase,
  signInWithEmailFirebase,
  signInWithGoogleFirebase,
} from "../services/firebase";
import { useTwin } from "../context/TwinContext";
import type { UserRole } from "../types";

function GoogleIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
      />
    </svg>
  );
}

const FEATURES = [
  {
    icon: Zap,
    title: "Domino Cascade Engine",
    description: "Wave-based BFS propagation across 14 campus layers",
    iconColor: "text-[#2563EB]",
    iconBg: "bg-[#EFF6FF]",
  },
  {
    icon: Cpu,
    title: "OR-Tools CP-SAT Solver",
    description: "Zero-collision timetable & resource recovery plans",
    iconColor: "text-[#4F46E5]",
    iconBg: "bg-[#EEF2FF]",
  },
  {
    icon: GitBranch,
    title: "DAG & SPOF Analytics",
    description: "Real-time cycle validation & backup policy rules",
    iconColor: "text-[#0891B2]",
    iconBg: "bg-[#ECFEFF]",
  },
];

const DEMO_ROLES = [
  {
    key: "admin" as const,
    letter: "A",
    title: "Admin",
    subtitle: "Full Control",
    circleBg: "bg-[#2563EB]",
  },
  {
    key: "operator" as const,
    letter: "O",
    title: "Operator",
    subtitle: "Sim & Solver",
    circleBg: "bg-[#7C3AED]",
  },
  {
    key: "viewer" as const,
    letter: "V",
    title: "Viewer",
    subtitle: "Read-Only",
    circleBg: "bg-[#475569]",
  },
];

const DEMO_CREDENTIALS = [
  { username: "admin", password: "Admin@123" },
  { username: "operator", password: "Operator@123" },
  { username: "viewer", password: "Viewer@123" },
];

export function LoginPage() {
  const { signIn } = useTwin();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [identifier, setIdentifier] = useState("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Admin@123");
  const [registerRole, setRegisterRole] = useState<UserRole>("coordinator");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unauthorizedDomainHost, setUnauthorizedDomainHost] = useState<string | null>(null);

  const { data: systemStatus } = useQuery({
    queryKey: ["system-status-login"],
    queryFn: api.getSystemStatus,
    retry: false,
  });

  const engineOnline = systemStatus?.status === "online";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        // Try FastAPI credentials first (e.g. admin / operator / viewer); if email login is used, try Firebase Email Auth as well.
        try {
          const session = await api.login(identifier, password);
          signIn(session);
        } catch (localErr: any) {
          if (identifier.includes("@")) {
            const fbUser = await signInWithEmailFirebase(identifier.trim(), password);
            const session = await api.firebaseLogin({
              uid: fbUser.uid,
              email: fbUser.email || identifier.trim(),
              display_name: fbUser.displayName,
              provider: "firebase_email",
            });
            signIn(session);
          } else {
            throw localErr;
          }
        }
      } else {
        const fbUser = await registerWithEmailFirebase(email.trim(), password, identifier.trim());
        const session = await api.firebaseLogin({
          uid: fbUser.uid,
          email: fbUser.email || email.trim(),
          display_name: fbUser.displayName || identifier.trim(),
          role: registerRole,
          provider: "firebase_email",
        });
        signIn(session);
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleFirebaseLogin = async () => {
    setError(null);
    setUnauthorizedDomainHost(null);
    setLoading(true);
    try {
      const fbUser = await signInWithGoogleFirebase();
      const session = await api.firebaseLogin({
        uid: fbUser.uid,
        email: fbUser.email || `${fbUser.uid}@firebase.omnis-x.edu`,
        display_name: fbUser.displayName,
        role: "coordinator",
        provider: "firebase_google",
      });
      signIn(session);
    } catch (err: any) {
      if (err?.code === "auth/unauthorized-domain") {
        const host = window.location.hostname;
        setUnauthorizedDomainHost(host);
        setError(
          host === "127.0.0.1"
            ? "Firebase Google Sign-In blocks 127.0.0.1 unless added in Firebase Console → Authentication → Settings → Authorized domains. Use localhost instead:"
            : `Domain '${host}' is not listed under Firebase Console → Authentication → Settings → Authorized domains.`
        );
      } else {
        setError(err.message || "Google sign-in failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoAccess = async (demoRole: "admin" | "operator" | "viewer") => {
    setError(null);
    setLoading(true);
    try {
      const session = await api.demoLogin(demoRole);
      signIn(session);
    } catch (err: any) {
      setError(err.message || "Demo sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#DCEAFE] via-[#F4F8FF] to-[#E0F2FE] px-4 py-8">
      {/* Subtle Geometric Network Mesh Background */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-55"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <g stroke="#93C5FD" strokeWidth="1" strokeOpacity="0.45">
          <line x1="60" y1="90" x2="290" y2="210" />
          <line x1="290" y1="210" x2="120" y2="430" />
          <line x1="290" y1="210" x2="520" y2="110" />
          <line x1="120" y1="430" x2="260" y2="710" />
          <line x1="260" y1="710" x2="50" y2="820" />
          <line x1="1020" y1="120" x2="1240" y2="250" />
          <line x1="1240" y1="250" x2="1380" y2="90" />
          <line x1="1240" y1="250" x2="1170" y2="540" />
          <line x1="1170" y1="540" x2="1390" y2="690" />
          <line x1="1170" y1="540" x2="960" y2="790" />
          <line x1="520" y1="110" x2="860" y2="60" />
        </g>
        <g fill="#60A5FA" fillOpacity="0.45">
          <circle cx="60" cy="90" r="3" />
          <circle cx="290" cy="210" r="4" />
          <circle cx="120" cy="430" r="3" />
          <circle cx="260" cy="710" r="3.5" />
          <circle cx="520" cy="110" r="3" />
          <circle cx="1020" cy="120" r="3" />
          <circle cx="1240" cy="250" r="4" />
          <circle cx="1170" cy="540" r="3.5" />
          <circle cx="1390" cy="690" r="3" />
        </g>
      </svg>

      {/* Main Split Auth Card */}
      <div className="relative z-10 grid w-full max-w-[960px] grid-cols-1 overflow-hidden rounded-[22px] border border-white/80 bg-white/95 shadow-[0_24px_65px_-18px_rgba(30,58,138,0.18)] backdrop-blur-xl lg:grid-cols-2">
        {/* LEFT PANEL */}
        <div className="flex flex-col justify-between border-b border-slate-100 p-8 sm:p-10 lg:border-r lg:border-b-0">
          <div>
            {/* Brand + Status */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] text-white shadow-sm shadow-blue-500/30">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-display text-lg font-extrabold tracking-tight text-[#0F172A]">
                    OMNIS-X
                  </div>
                  <div className="text-[10px] font-bold tracking-[0.14em] text-[#2563EB] uppercase">
                    RESILIENCE CORE V2.0
                  </div>
                </div>
              </div>

              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold ${
                  engineOnline
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    engineOnline ? "animate-pulse bg-emerald-500" : "bg-amber-500"
                  }`}
                />
                {engineOnline ? "Core Engine Online" : "Connecting Engine..."}
              </span>
            </div>

            {/* Hero Copy */}
            <div className="mt-9">
              <h1 className="font-display text-[32px] font-extrabold leading-[1.12] tracking-tight text-[#0F172A] sm:text-[36px]">
                Autonomous Campus
                <span className="block bg-gradient-to-r from-[#2563EB] via-[#0EA5E9] to-[#0D9488] bg-clip-text text-transparent">
                  Resilience Intelligence
                </span>
              </h1>
              <p className="mt-4 text-[13.5px] leading-relaxed text-[#64748B]">
                Simulate cascading infrastructure failures, compute conflict-free CP-SAT recovery
                schedules, and verify institutional resilience in real time.
              </p>
            </div>

            {/* Feature Cards */}
            <div className="mt-8 space-y-3">
              {FEATURES.map((feat) => {
                const Icon = feat.icon;
                return (
                  <div
                    key={feat.title}
                    className="flex items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-[#F8FAFC]/80 px-4 py-3.5 transition hover:border-blue-200 hover:bg-white"
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${feat.iconBg} ${feat.iconColor}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-[#0F172A]">{feat.title}</p>
                      <p className="text-[11.5px] text-[#64748B]">{feat.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex flex-col justify-between p-8 sm:p-10">
          <div>
            {/* Secure Gateway Pill */}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/80 bg-blue-50/80 px-3 py-1 text-[10px] font-bold tracking-[0.1em] text-[#2563EB] uppercase">
              <Lock className="h-3 w-3" />
              SECURE RBAC GATEWAY
            </span>

            <h2 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-[#0F172A]">
              {mode === "login" ? "Sign in to Command Center" : "Register Command Account"}
            </h2>
            <p className="mt-1 text-xs text-[#64748B]">
              Authenticate with your institutional credentials or use quick role access.
            </p>

            {error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
                <p>{error}</p>
                {unauthorizedDomainHost === "127.0.0.1" && (
                  <a
                    href={`http://localhost:${window.location.port || "5173"}${window.location.pathname}`}
                    className="mt-2 inline-flex items-center gap-1 rounded-lg bg-[#2563EB] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-blue-700"
                  >
                    Switch to http://localhost:{window.location.port || "5173"}
                    <ArrowRight className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-[#334155]">
                  {mode === "login" ? "Username or Email" : "Username"}
                </label>
                <div className="relative mt-1.5">
                  <User className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="admin"
                    className="w-full rounded-xl border border-[#E2E8F0] bg-white py-2.5 pr-3.5 pl-10 text-xs font-medium text-[#0F172A] placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-blue-500/15 focus:outline-none"
                  />
                </div>
              </div>

              {mode === "register" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-[#334155]">Institutional Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@omnis-x.edu"
                      className="mt-1.5 w-full rounded-xl border border-[#E2E8F0] bg-white px-3.5 py-2.5 text-xs font-medium text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#334155]">Access Role</label>
                    <select
                      value={registerRole}
                      onChange={(e) => setRegisterRole(e.target.value as UserRole)}
                      className="mt-1.5 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 text-xs font-medium text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                    >
                      <option value="coordinator">Operator (Dept Coordinator)</option>
                      <option value="faculty">Faculty</option>
                      <option value="evaluator">Viewer (Read-Only)</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-[#334155]">Password</label>
                <div className="relative mt-1.5">
                  <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    className="w-full rounded-xl border border-[#E2E8F0] bg-white py-2.5 pr-10 pl-10 text-xs font-medium text-[#0F172A] placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-blue-500/15 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2563EB] via-[#1D8CF8] to-[#06B6D4] py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition hover:opacity-95 disabled:opacity-60"
              >
                {loading
                  ? "Authenticating..."
                  : mode === "login"
                  ? "Launch Command Center"
                  : "Create & Launch Command Center"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            {/* Google Firebase SSO Button */}
            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleFirebaseLogin}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] bg-white py-2.5 text-xs font-semibold text-[#0F172A] transition hover:bg-slate-50 disabled:opacity-60"
            >
              <GoogleIcon />
              Continue with Google (Firebase)
            </button>

            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  if (mode === "login") {
                    setMode("register");
                    setIdentifier("");
                    setPassword("");
                  } else {
                    setMode("login");
                    setIdentifier("admin");
                    setPassword("Admin@123");
                  }
                }}
                className="text-[11.5px] font-semibold text-[#2563EB] hover:underline"
              >
                {mode === "login"
                  ? "New user? Register with Firebase Email"
                  : "Already registered? Sign in to Command Center"}
              </button>
            </div>

            {/* One-Click Demo Access Divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-0.5 text-[10.5px] font-medium text-[#64748B]">
                One-Click Demo Access
              </span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            {/* 3 Role Quick-Access Cards */}
            <div className="grid grid-cols-3 gap-2.5">
              {DEMO_ROLES.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  disabled={loading}
                  onClick={() => handleDemoAccess(item.key)}
                  className="flex flex-col items-center rounded-xl border border-[#E2E8F0] bg-white px-2 py-3 text-center transition hover:border-blue-300 hover:bg-blue-50/40 disabled:opacity-60"
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${item.circleBg}`}
                  >
                    {item.letter}
                  </span>
                  <span className="mt-1.5 text-xs font-bold text-[#0F172A]">{item.title}</span>
                  <span className="text-[10px] text-[#64748B]">{item.subtitle}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Demo Credentials Box */}
          <div className="mt-5 rounded-xl border border-slate-200/80 bg-[#F8FAFC] px-3.5 py-2.5">
            <p className="text-[10px] font-bold tracking-[0.08em] text-[#64748B] uppercase">
              DEMO CREDENTIALS
            </p>
            <div className="mt-1.5 space-y-1 font-mono text-[11px]">
              {DEMO_CREDENTIALS.map((cred) => (
                <button
                  key={cred.username}
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setIdentifier(cred.username);
                    setPassword(cred.password);
                    setError(null);
                  }}
                  className="flex w-full items-center justify-between rounded px-1 py-0.5 text-left transition hover:bg-slate-200/60"
                >
                  <span className="font-semibold text-[#2563EB]">{cred.username}</span>
                  <span className="text-[#475569]">{cred.password}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
