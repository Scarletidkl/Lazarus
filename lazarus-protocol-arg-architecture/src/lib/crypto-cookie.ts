import crypto from "crypto";

export interface LazarusSessionState {
  operativeId: string;
  callsign: string;
  clearedLayers: number[]; // e.g., [1, 2, 3, 4]
  layerProofs: Record<string, string>;
  issuedAt: number;
  integrityTag: string;
}

export const COOKIE_NAME = "lazarus_clearance_jwe";

function getMasterSecret(): Buffer {
  const raw =
    process.env.LAZARUS_JWE_SECRET ||
    "LAZARUS_PROTOCOL_QUANTUM_JWE_MASTER_KEY_2026_CICADA_OMEGA";
  return crypto.createHash("sha256").update(raw).digest();
}

export function computeStateHmac(payloadJson: string): string {
  return crypto
    .createHmac("sha256", getMasterSecret())
    .update(payloadJson)
    .digest("hex");
}

/**
 * Encrypts and signs the player's progression state into a compact JWE-like
 * authenticated token (AES-256-GCM + inner HMAC-SHA256 proof).
 */
export function sealSessionState(
  state: Omit<LazarusSessionState, "integrityTag" | "issuedAt">
): { token: string; fullState: LazarusSessionState } {
  const issuedAt = Date.now();
  const baseObj = {
    operativeId: state.operativeId,
    callsign: state.callsign,
    clearedLayers: Array.from(new Set(state.clearedLayers)).sort(),
    layerProofs: state.layerProofs,
    issuedAt,
  };
  const integrityTag = computeStateHmac(JSON.stringify(baseObj));
  const fullState: LazarusSessionState = { ...baseObj, integrityTag };

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getMasterSecret(), iv);
  const plaintext = Buffer.from(JSON.stringify(fullState), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const token = [
    "LAZ-JWE-V1",
    iv.toString("base64url"),
    encrypted.toString("base64url"),
    authTag.toString("base64url"),
  ].join(".");

  return { token, fullState };
}

/**
 * Decrypts and verifies the JWE-like token from the HttpOnly cookie.
 */
export function unsealSessionState(token?: string | null): LazarusSessionState {
  const defaultState = (): LazarusSessionState => {
    const operativeId = "OP-" + crypto.randomBytes(3).toString("hex").toUpperCase();
    const base = {
      operativeId,
      callsign: `SHADOW-${operativeId.slice(3)}`,
      clearedLayers: [] as number[],
      layerProofs: {} as Record<string, string>,
      issuedAt: Date.now(),
    };
    return {
      ...base,
      integrityTag: computeStateHmac(JSON.stringify(base)),
    };
  };

  if (!token) return defaultState();

  try {
    const parts = token.split(".");
    if (parts.length !== 4 || parts[0] !== "LAZ-JWE-V1") {
      return defaultState();
    }
    const iv = Buffer.from(parts[1], "base64url");
    const ciphertext = Buffer.from(parts[2], "base64url");
    const authTag = Buffer.from(parts[3], "base64url");

    const decipher = crypto.createDecipheriv("aes-256-gcm", getMasterSecret(), iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    const parsed = JSON.parse(decrypted.toString("utf8")) as LazarusSessionState;

    const baseObj = {
      operativeId: parsed.operativeId,
      callsign: parsed.callsign,
      clearedLayers: parsed.clearedLayers,
      layerProofs: parsed.layerProofs,
      issuedAt: parsed.issuedAt,
    };
    const expectedHmac = computeStateHmac(JSON.stringify(baseObj));
    if (
      expectedHmac.length !== parsed.integrityTag.length ||
      !crypto.timingSafeEqual(
        Buffer.from(expectedHmac, "utf8"),
        Buffer.from(parsed.integrityTag, "utf8")
      )
    ) {
      return defaultState();
    }
    return parsed;
  } catch {
    return defaultState();
  }
}
