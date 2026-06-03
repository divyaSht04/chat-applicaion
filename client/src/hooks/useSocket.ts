import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";

export function useSocket(token: string | null): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!token) return;

    const s = io(import.meta.env.VITE_API_URL as string, { auth: { token } });
    s.on("connect", () => setSocket(s));

    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [token]);

  return socket;
}
