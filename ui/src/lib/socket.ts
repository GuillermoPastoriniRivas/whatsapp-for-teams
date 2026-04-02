import { io, Socket } from "socket.io-client";

// NEXT_PUBLIC_API_URL includes /api (e.g. https://asis.chat/api)
// Socket.io needs the base origin (e.g. https://asis.chat)
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const SOCKET_URL = API_URL.replace(/\/api\/?$/, "") || API_URL;

let socket: Socket | null = null;
let onAuthErrorCallback: (() => void) | null = null;
let intentionalDisconnect = false;

export function onSocketAuthError(cb: () => void) {
  onAuthErrorCallback = cb;
}

export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket;

  intentionalDisconnect = false;

  socket = io(`${SOCKET_URL}/ws`, {
    auth: { token },
    transports: ["websocket"],
  });

  socket.on("connect", () => {
    console.log("[socket] connected");
  });

  socket.on("disconnect", (reason) => {
    console.log("[socket] disconnected:", reason);
    if (reason === "io server disconnect" && !intentionalDisconnect) {
      onAuthErrorCallback?.();
    }
  });

  socket.on("connect_error", (err) => {
    console.warn("[socket] connect_error:", err.message);
    if (!intentionalDisconnect) {
      onAuthErrorCallback?.();
    }
  });

  socket.on("auth_error", () => {
    console.warn("[socket] auth_error");
    if (!intentionalDisconnect) {
      onAuthErrorCallback?.();
    }
  });

  return socket;
}

export function reconnectSocket(token: string): Socket {
  disconnectSocket();
  return connectSocket(token);
}

export function disconnectSocket() {
  intentionalDisconnect = true;
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}
