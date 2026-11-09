export function returnPath(value: unknown) {
  if (typeof value !== "string" || value.length > 300 || !value.startsWith("/") ||
    value.startsWith("//") || /[\\\s%#]/.test(value)) return "/account";
  const path = value.split("?")[0];
  const allowed = ["/account", "/manager", "/admin", "/explore"];
  if (!allowed.includes(path)) return "/account";
  return value;
}
