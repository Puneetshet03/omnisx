import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Box,
  Building2,
  Bus,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Database,
  FileSpreadsheet,
  FlaskConical,
  GitBranch,
  GraduationCap,
  History,
  Home,
  LayoutDashboard,
  LogOut,
  Maximize2,
  Network,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  UserCheck,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import { api } from "../services/api";
import { useTwin } from "../context/TwinContext";
import { useRealtimeSync } from "../hooks/useRealtimeSync";
import type { UserRole } from "../types";

const NAV_GROUPS = [
  {
    label: "Command",
    items: [
      { to: "/", label: "Overview", icon: LayoutDashboard },
      { to: "/campus-3d", label: "3D Campus", icon: Box },
      { to: "/digital-twin", label: "Digital Twin", icon: Network },
      { to: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Academic & People",
    items: [
      { to: "/students", label: "Students", icon: GraduationCap },
      { to: "/academics", label: "Academics", icon: Calendar },
      { to: "/faculty", label: "Faculty", icon: Users },
      { to: "/classrooms", label: "Classrooms", icon: Building2 },
      { to: "/laboratories", label: "Laboratories", icon: FlaskConical },
    ],
  },
  {
    label: "Campus Operations",
    items: [
      { to: "/examinations", label: "Examinations", icon: FileSpreadsheet },
      { to: "/transportation", label: "Transportation", icon: Bus },
      { to: "/hostels", label: "Hostels", icon: Home },
      { to: "/placements", label: "Placements", icon: UserCheck },
      { to: "/events", label: "Events", icon: Sparkles },
      { to: "/infrastructure", label: "Infrastructure", icon: Cpu },
    ],
  },
  {
    label: "Intelligence & Recovery",
    items: [
      { to: "/conflicts", label: "Conflict Centre", icon: AlertTriangle },
      { to: "/simulation-lab", label: "Simulation Lab", icon: Activity },
      { to: "/recovery-optimizer", label: "Recovery Optimizer", icon: Wrench },
      { to: "/risk-intelligence", label: "Risk Intelligence", icon: ShieldAlert },
      { to: "/incidents", label: "Incident History", icon: History },
    ],
  },
  {
    label: "Governance",
    items: [
      { to: "/administration", label: "Administration", icon: GitBranch },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function MainLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [ozfLoading, setOzfLoading] = useState(false);
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString());
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    authUser,
    signOut,
    role,
    setRole,
    globalSearch,
    setGlobalSearch,
    setActiveSimulation,
    setRecoveryPlans,
    setAppliedPlanId,
  } = useTwin();

  const { realtimeStatus } = useRealtimeSync();

  const { data: dashboard } = useQuery({
    queryKey: ["dashboard"],
    queryFn: api.getDashboard,
    refetchInterval: 30000,
  });

  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: api.getNotifications,
  });

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date().toLocaleTimeString()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const handleOperationZeroFailure = async () => {
    setOzfLoading(true);
    try {
      const res = await api.runOperationZeroFailure();
      setActiveSimulation(res.simulation);
      setRecoveryPlans(res.recovery_plans);
      setAppliedPlanId(null);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["campus"] });
      navigate("/simulation-lab");
    } finally {
      setOzfLoading(false);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const dbConnected = dashboard?.db_status?.connected;
  const healthScore = dashboard?.kpis?.institutional_health_index ?? "--";

  return (
    <div className="flex min-h-screen bg-[#F4F7FC] text-[#0F172A]">
      {/* Left Collapsible Sidebar */}
      <aside
        className={`sticky top-0 flex h-screen flex-col border-r border-[#E2E8F0] bg-white transition-all duration-200 ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-[#E2E8F0] px-4">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#2563EB] to-[#7C3AED] font-display text-sm font-extrabold text-white shadow-sm">
              OX
            </div>
            {!collapsed && (
              <div className="leading-tight">
                <span className="font-display text-base font-extrabold tracking-tight text-[#0F172A]">
                  OMNIS-X
                </span>
                <p className="text-[10px] font-medium uppercase tracking-wider text-[#64748B]">
                  Predict · Prevent · Recover
                </p>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label="Toggle Sidebar"
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="mb-1.5 px-2.5 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === "/"}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium transition ${
                          isActive
                            ? "bg-blue-50 font-semibold text-[#2563EB]"
                            : "text-[#64748B] hover:bg-slate-50 hover:text-[#0F172A]"
                        }`
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Command Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-[#E2E8F0] bg-white/90 px-5 backdrop-blur-md">
          <div className="flex flex-1 items-center gap-3">
            <div className="relative max-w-xs flex-1">
              <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && globalSearch.trim()) {
                    navigate("/students");
                  }
                }}
                placeholder="Search students, USN, labs, rooms..."
                className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] py-1.5 pr-3 pl-9 text-xs text-[#0F172A] placeholder:text-slate-400 focus:border-[#2563EB] focus:bg-white focus:outline-none"
              />
            </div>

            <button
              onClick={handleOperationZeroFailure}
              disabled={ozfLoading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#7C3AED] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
            >
              <Zap className="h-3.5 w-3.5" />
              {ozfLoading ? "Simulating..." : "Operation Zero Failure"}
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Health Pill */}
            <div className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 md:flex">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Health: {healthScore}/100
            </div>

            {/* FastAPI Backend Status Pill */}
            <div
              title={dashboard?.db_status?.message || "FastAPI backend status"}
              className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold lg:flex ${
                dbConnected
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              <Database className="h-3 w-3" />
              {dbConnected ? "FastAPI Backend" : "FastAPI Offline"}
            </div>

            {/* Realtime Indicator */}
            <span className="hidden rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-medium text-cyan-800 xl:inline-flex">
              {realtimeStatus === "realtime" ? "FastAPI WS Live" : "FastAPI REST Sync"}
            </span>

            {/* Clock */}
            <span className="hidden font-mono text-xs text-[#64748B] xl:inline">{clock}</span>

            {/* Role Selector */}
            <select
              aria-label="Active Role"
              value={role}
              onChange={(e) => {
                setRole(e.target.value as UserRole);
                queryClient.invalidateQueries({ queryKey: ["students"] });
              }}
              className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 text-xs font-semibold text-[#0F172A]"
            >
              <option value="admin">Admin</option>
              <option value="coordinator">Dept Coordinator</option>
              <option value="faculty">Faculty</option>
              <option value="evaluator">Evaluator (Read-Only)</option>
            </select>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                aria-label="Notifications"
                className="relative rounded-xl border border-[#E2E8F0] p-2 text-slate-600 hover:bg-slate-50"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#2563EB] text-[10px] font-bold text-white">
                  {notifications?.items?.length || 0}
                </span>
              </button>
              {notifOpen && (
                <div className="glass-panel-floating absolute right-0 mt-2 w-80 rounded-2xl p-3 z-50">
                  <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-900">Notification Centre</span>
                    <button onClick={() => setNotifOpen(false)} className="text-[11px] text-blue-600">
                      Close
                    </button>
                  </div>
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {(notifications?.items || []).slice(0, 8).map((n: any) => (
                      <div key={n.notification_id} className="rounded-xl bg-slate-50 p-2.5 text-xs">
                        <p className="font-semibold text-slate-900">{n.title}</p>
                        <p className="mt-0.5 text-[11px] text-slate-600">{n.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={toggleFullscreen}
              aria-label="Toggle Fullscreen"
              className="rounded-xl border border-[#E2E8F0] p-2 text-slate-600 hover:bg-slate-50"
            >
              <Maximize2 className="h-4 w-4" />
            </button>

            <button
              onClick={signOut}
              title={authUser ? `Signed in as ${authUser.username} (${authUser.role_label})` : "Sign out"}
              aria-label="Sign Out"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E2E8F0] px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{authUser?.username || "Sign Out"}</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-5 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
