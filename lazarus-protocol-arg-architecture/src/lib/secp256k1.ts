import crypto from "crypto";

const BI_0 = BigInt(0);
const BI_1 = BigInt(1);
const BI_2 = BigInt(2);
const BI_3 = BigInt(3);

export const SECP256K1_P = BigInt(
  "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F"
);
export const SECP256K1_N = BigInt(
  "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141"
);
export const SECP256K1_GX = BigInt(
  "0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798"
);
export const SECP256K1_GY = BigInt(
  "0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8"
);

export type EcPoint = { x: bigint; y: bigint } | null;

export const GENERATOR_G: EcPoint = { x: SECP256K1_GX, y: SECP256K1_GY };

export function mod(a: bigint, m: bigint): bigint {
  const res = a % m;
  return res >= BI_0 ? res : res + m;
}

/**
 * Extended Euclidean Algorithm for modular inverse a^-1 mod m.
 */
export function modInv(a: bigint, m: bigint): bigint {
  let t = BI_0;
  let newT = BI_1;
  let r = m;
  let newR = mod(a, m);

  while (newR !== BI_0) {
    const quotient = r / newR;
    [t, newT] = [newT, t - quotient * newT];
    [r, newR] = [newR, r - quotient * newR];
  }

  if (r > BI_1) {
    throw new Error("Element is not invertible modulo m");
  }
  if (t < BI_0) {
    t += m;
  }
  return t;
}

export function ecAdd(p1: EcPoint, p2: EcPoint): EcPoint {
  if (!p1) return p2;
  if (!p2) return p1;

  const { x: x1, y: y1 } = p1;
  const { x: x2, y: y2 } = p2;

  if (x1 === x2 && mod(y1 + y2, SECP256K1_P) === BI_0) {
    return null;
  }

  let lambda: bigint;
  if (x1 === x2 && y1 === y2) {
    lambda = mod(
      BI_3 * x1 * x1 * modInv(BI_2 * y1, SECP256K1_P),
      SECP256K1_P
    );
  } else {
    lambda = mod(
      (y2 - y1) * modInv(x2 - x1, SECP256K1_P),
      SECP256K1_P
    );
  }

  const x3 = mod(lambda * lambda - x1 - x2, SECP256K1_P);
  const y3 = mod(lambda * (x1 - x3) - y1, SECP256K1_P);

  return { x: x3, y: y3 };
}

export function ecMul(k: bigint, point: EcPoint = GENERATOR_G): EcPoint {
  let result: EcPoint = null;
  let addend: EcPoint = point;
  let scalar = mod(k, SECP256K1_N);

  while (scalar > BI_0) {
    if ((scalar & BI_1) === BI_1) {
      result = ecAdd(result, addend);
    }
    addend = ecAdd(addend, addend);
    scalar >>= BI_1;
  }

  return result;
}

export function getServerPrivateKey(): bigint {
  const hash = crypto
    .createHash("sha256")
    .update("LAZARUS_PROTOCOL_SECP256K1_MASTER_KEY_V1")
    .digest("hex");
  return mod(BigInt("0x" + hash), SECP256K1_N);
}

export function getServerPublicKey(): { x: string; y: string } {
  const d = getServerPrivateKey();
  const pt = ecMul(d, GENERATOR_G);
  if (!pt) throw new Error("Invalid public key point");
  return {
    x: "0x" + pt.x.toString(16).padStart(64, "0"),
    y: "0x" + pt.y.toString(16).padStart(64, "0"),
  };
}

export function hashMessageToScalar(message: string): bigint {
  const digest = crypto.createHash("sha256").update(message, "utf8").digest("hex");
  return mod(BigInt("0x" + digest), SECP256K1_N);
}

/**
 * Fatal Cryptographic Vulnerability (Sony PS3 / Faulty HSM PRNG):
 * The ephemeral nonce k is derived SOLELY from the `X-Timestamp` header,
 * completely ignoring the message payload!
 * Sending two distinct messages with the same `X-Timestamp` produces two
 * signatures (r, s1) and (r, s2) with identical `r`, leaking both `k` and `d_A`.
 */
export function deriveVulnerableNonce(xTimestamp: string): bigint {
  const hmacHex = crypto
    .createHmac("sha256", "SONY_PS3_LAZARUS_ENTROPY_SEED_2026")
    .update(xTimestamp, "utf8")
    .digest("hex");
  return mod(BigInt("0x" + hmacHex), SECP256K1_N - BI_1) + BI_1;
}

export function signMessageWithVulnerableOracle(
  message: string,
  xTimestamp: string
): {
  message: string;
  xTimestamp: string;
  z: string;
  r: string;
  s: string;
  publicKey: { x: string; y: string };
} {
  const z = hashMessageToScalar(message);
  const k = deriveVulnerableNonce(xTimestamp);
  const dA = getServerPrivateKey();

  const R = ecMul(k, GENERATOR_G);
  if (!R) throw new Error("Point at infinity encountered");

  const r = mod(R.x, SECP256K1_N);
  const s = mod(modInv(k, SECP256K1_N) * (z + r * dA), SECP256K1_N);

  return {
    message,
    xTimestamp,
    z: "0x" + z.toString(16).padStart(64, "0"),
    r: "0x" + r.toString(16).padStart(64, "0"),
    s: "0x" + s.toString(16).padStart(64, "0"),
    publicKey: getServerPublicKey(),
  };
}

export function verifyEcdsaSignature(
  message: string,
  rHex: string,
  sHex: string
): boolean {
  try {
    const cleanR = rHex.trim().startsWith("0x") ? rHex.trim() : "0x" + rHex.trim();
    const cleanS = sHex.trim().startsWith("0x") ? sHex.trim() : "0x" + sHex.trim();

    const r = BigInt(cleanR);
    const s = BigInt(cleanS);

    if (r <= BI_0 || r >= SECP256K1_N || s <= BI_0 || s >= SECP256K1_N) {
      return false;
    }

    const z = hashMessageToScalar(message);
    const w = modInv(s, SECP256K1_N);
    const u1 = mod(z * w, SECP256K1_N);
    const u2 = mod(r * w, SECP256K1_N);

    const dA = getServerPrivateKey();
    const QA = ecMul(dA, GENERATOR_G);

    const p1 = ecMul(u1, GENERATOR_G);
    const p2 = ecMul(u2, QA);
    const R = ecAdd(p1, p2);

    if (!R) return false;
    return mod(R.x, SECP256K1_N) === r;
  } catch {
    return false;
  }
}
