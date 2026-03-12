const byteToHex = (value: number): string => value.toString(16).padStart(2, "0");

export const createId = (): string => {
  const api = globalThis.crypto;

  if (api && typeof api.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    api.getRandomValues(bytes);

    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, byteToHex).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }

  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};
