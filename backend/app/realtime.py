"""FastAPI WebSocket connection manager for real-time frontend-backend sync."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Set
from fastapi import WebSocket


class RealtimeConnectionManager:
    """Tracks active WebSocket clients and broadcasts state changes from FastAPI."""

    def __init__(self) -> None:
        self._connections: Set[WebSocket] = set()
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._loop = asyncio.get_running_loop()
        self._connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self._connections.discard(websocket)

    async def broadcast(self, payload: Dict[str, Any]) -> None:
        if not self._connections:
            return
        dead: list[WebSocket] = []
        for ws in list(self._connections):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._connections.discard(ws)

    def broadcast_sync(
        self, entity: str, action: str = "updated", simulation_id: Optional[str] = None
    ) -> None:
        """Safely broadcast a state change from synchronous FastAPI route handlers."""
        if not self._connections or not self._loop or self._loop.is_closed():
            return
        payload: Dict[str, Any] = {
            "event": "state_updated",
            "entity": entity,
            "action": action,
            "simulation_id": simulation_id,
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        }
        try:
            asyncio.run_coroutine_threadsafe(self.broadcast(payload), self._loop)
        except Exception:
            pass


ws_manager = RealtimeConnectionManager()
