import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  SECP256K1_P,
  SECP256K1_N,
  SECP256K1_GX,
  SECP256K1_GY,
  getServerPublicKey,
  signMessageWithVulnerableOracle,
} from "@/lib/secp256k1";
import { COOKIE_NAME, unsealSessionState } from "@/lib/crypto-cookie";
import { recordAuditEvent } from "@/lib/db-telemetry";

export async function GET() {
  const pubKey = getServerPublicKey();
  return NextResponse.json(
    {
      oracle: "LAZARUS_SECP256K1_HSM_ORACLE_V1",
      curve: "secp256k1",
      parameters: {
        p: "0x" + SECP256K1_P.toString(16),
        n: "0x" + SECP256K1_N.toString(16),
        Gx: "0x" + SECP256K1_GX.toString(16),
        Gy: "0x" + SECP256K1_GY.toString(16),
      },
      publicKey: pubKey,
      policy: {
        forbiddenTarget: "EXECUTE_PROTOCOL_OMEGA",
        entropyHeader: "X-Timestamp",
        warning:
          "Hardware entropy buffer synchronizes ephemeral nonce k against the X-Timestamp header.",
      },
    },
    {
      headers: {
        "X-Lazarus-Curve": "secp256k1",
        "X-Lazarus-Nonce-Source": "HMAC-SHA256(HSM_SEED, Header[X-Timestamp])",
      },
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (!message) {
      return NextResponse.json(
        { error: "INVALID_PAYLOAD: `message` string is required." },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const session = unsealSessionState(cookieStore.get(COOKIE_NAME)?.value);

    // Refuse to sign the restricted target message directly
    if (message === "EXECUTE_PROTOCOL_OMEGA") {
      await recordAuditEvent({
        operativeId: session.operativeId,
        callsign: session.callsign,
        layer: 3,
        eventType: "ORACLE_POLICY_BLOCK",
        payloadSummary: "Blocked direct signing request for EXECUTE_PROTOCOL_OMEGA",
        proofHash: "FORBIDDEN_TARGET",
        verified: false,
      });

      return NextResponse.json(
        {
          error:
            "HSM_SECURITY_POLICY_VIOLATION: Direct signing of `EXECUTE_PROTOCOL_OMEGA` is strictly prohibited by hardware filter. Recover d_A via cryptanalysis to forge this signature offline.",
          code: "ERR_OMEGA_FORBIDDEN",
        },
        { status: 403 }
      );
    }

    // Read X-Timestamp from request header (or optional body fallback for convenience in terminal)
    const headerTs =
      req.headers.get("x-timestamp") ||
      (typeof body?.xTimestamp === "string" ? body.xTimestamp : null) ||
      String(Math.floor(Date.now() / 1000));

    const sig = signMessageWithVulnerableOracle(message, headerTs);

    await recordAuditEvent({
      operativeId: session.operativeId,
      callsign: session.callsign,
      layer: 3,
      eventType: "ORACLE_ECDSA_SIGN",
      payloadSummary: `msg="${message.slice(0, 32)}" | X-Timestamp=${headerTs}`,
      proofHash: sig.r.slice(0, 34),
      verified: true,
    });

    return NextResponse.json(
      {
        status: "SIGNED",
        curve: "secp256k1",
        message: sig.message,
        xTimestamp: sig.xTimestamp,
        hashScalarZ: sig.z,
        signature: {
          r: sig.r,
          s: sig.s,
        },
        publicKey: sig.publicKey,
      },
      {
        headers: {
          "X-Timestamp-Used": sig.xTimestamp,
          "X-Oracle-R": sig.r,
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: "ORACLE_INTERNAL_FAULT",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
