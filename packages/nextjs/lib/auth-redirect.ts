export function getLocalRedirect(value: string | null, fallback = "/") {
  let decodedValue: string;
  try {
    decodedValue = decodeURIComponent(value ?? "");
  } catch {
    return fallback;
  }

  if (
    !value?.startsWith("/") ||
    value.startsWith("//") ||
    decodedValue.includes("\\")
  ) {
    return fallback;
  }

  const base = "https://passes.local";
  return new URL(value, base).origin === base ? value : fallback;
}
