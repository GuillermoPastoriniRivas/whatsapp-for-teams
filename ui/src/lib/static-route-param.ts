export function browserPathParam(pathname: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = window.location.pathname.split("/").filter(Boolean).at(-1);
  return value ? decodeURIComponent(value) : fallback;
}
