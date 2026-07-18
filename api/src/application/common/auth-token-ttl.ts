/**
 * Ventana de inactividad de la sesión. El refresh token rota en cada uso,
 * así que la sesión solo vence tras este tiempo sin abrir la app.
 * Mantener alineado con JWT_REFRESH_EXPIRES_IN.
 */
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días
