"use client";

import { useCallback, useEffect, useState } from "react";

export type LineMessage = {
  id: string;
  direction: "in" | "out";
  line_user_id: string | null;
  line_group_id: string | null;
  line_room_id: string | null;
  message_type: string | null;
  message: string | null;
  status: string | null;
  created_at: string | null;
};

export function useLineSend() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async (input: { to: string; message: string; type?: "user" | "group" | "room" }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/line/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to send LINE message");
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { send, loading, error };
}

export function useLineMessages(params?: {
  lineUserId?: string;
  lineGroupId?: string;
  lineRoomId?: string;
  limit?: number;
  autoRefreshMs?: number;
}) {
  const [messages, setMessages] = useState<LineMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const search = new URLSearchParams();
      if (params?.lineUserId) search.set("line_user_id", params.lineUserId);
      if (params?.lineGroupId) search.set("line_group_id", params.lineGroupId);
      if (params?.lineRoomId) search.set("line_room_id", params.lineRoomId);
      if (params?.limit) search.set("limit", String(params.limit));

      const response = await fetch(`/api/line/messages?${search.toString()}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to fetch LINE messages");
      }
      const payload = await response.json();
      setMessages(payload.messages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [params?.lineGroupId, params?.lineRoomId, params?.lineUserId, params?.limit]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (!params?.autoRefreshMs) return;
    const id = window.setInterval(fetchMessages, params.autoRefreshMs);
    return () => window.clearInterval(id);
  }, [fetchMessages, params?.autoRefreshMs]);

  return { messages, loading, error, refresh: fetchMessages };
}
