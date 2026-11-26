import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_BASE, api } from "../services/api";
import { useTwin } from "../context/TwinContext";

function getFastApiWsUrl(): string {
  if (API_BASE) {
    return `${API_BASE.replace(/^http/i, "ws").replace(/\/$/, "")}/api/ws`;
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/ws`;
}

export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const { activeSimulation, setActiveSimulation, resetTwinState } = useTwin();
  const activeSimIdRef = useRef<string | null>(null);
  activeSimIdRef.current = activeSimulation?.simulation_id ?? null;

  const [realtimeStatus, setRealtimeStatus] = useState<"realtime" | "rest_fallback">("rest_fallback");
  const [lastSync, setLastSync] = useState<string>(new Date().toISOString());

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let pingTimer: number | null = null;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      try {
        ws = new WebSocket(getFastApiWsUrl());
      } catch {
        setRealtimeStatus("rest_fallback");
        return;
      }

      ws.onopen = () => {
        if (disposed) return;
        setRealtimeStatus("realtime");
        pingTimer = window.setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send("ping");
          }
        }, 25000);
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === "state_updated") {
            queryClient.invalidateQueries({ queryKey: ["dashboard"] });
            queryClient.invalidateQueries({ queryKey: ["conflicts"] });
            queryClient.invalidateQueries({ queryKey: ["incidents"] });
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
            queryClient.invalidateQueries({ queryKey: ["simulations"] });
            queryClient.invalidateQueries({ queryKey: ["health-index"] });
            queryClient.invalidateQueries({ queryKey: ["audit-logs"] });

            // Only update activeSimulation if the WebSocket event targets the exact same simulation_id.
            // Unrelated simulation broadcasts must NEVER overwrite the user's current simulation view.
            const currentSimId = activeSimIdRef.current;
            const incomingSimId: string | null | undefined = data.simulation_id;

            if (currentSimId && incomingSimId && currentSimId === incomingSimId) {
              if (data.entity === "simulations" && data.action === "reset") {
                resetTwinState();
                queryClient.invalidateQueries({ queryKey: ["campus"] });
              } else if (data.entity === "recovery_plans" && data.action === "applied") {
                try {
                  const freshSim = await api.getSimulation(currentSimId);
                  if (activeSimIdRef.current === currentSimId) {
                    setActiveSimulation(freshSim);
                  }
                } catch {
                  // ignore transient fetch errors
                }
                queryClient.invalidateQueries({ queryKey: ["campus"] });
              }
            } else if (!currentSimId) {
              queryClient.invalidateQueries({ queryKey: ["campus"] });
            }

            setLastSync(new Date().toISOString());
          } else if (data.event === "connected") {
            setLastSync(new Date().toISOString());
          }
        } catch {
          // ignore non-JSON messages
        }
      };

      ws.onerror = () => {
        setRealtimeStatus("rest_fallback");
      };

      ws.onclose = () => {
        if (pingTimer !== null) {
          window.clearInterval(pingTimer);
          pingTimer = null;
        }
        if (disposed) return;
        setRealtimeStatus("rest_fallback");
        reconnectTimer = window.setTimeout(connect, 5000);
      };
    };

    connect();

    const fallbackPoll = window.setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setLastSync(new Date().toISOString());
    }, 20000);

    return () => {
      disposed = true;
      window.clearInterval(fallbackPoll);
      if (pingTimer !== null) window.clearInterval(pingTimer);
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [queryClient, resetTwinState, setActiveSimulation]);

  return { realtimeStatus, lastSync };
}
