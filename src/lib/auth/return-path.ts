export function returnPath(value: unknown) {
  if (typeof value !== "string" || value.length > 300 || !value.startsWith("/") ||
    value.startsWith("//") || /[\\\s%#]/.test(value)) return "/account";
  const path = value.split("?")[0];
  const allowed = ["/account", "/manager", "/admin", "/explore", "/guides", "/plan", "/my-trips"];
  if (!allowed.includes(path) && !/^\/guides\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path) &&
    !/^\/my-trips\/[a-f0-9-]{36}(\/(edit|print))?$/.test(path) && !/^\/my-trips\/requests\/(?:[a-f0-9-]{36}|GC-[A-F0-9]{8})$/.test(path)) return "/account";
  return value;
}
