import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  COOKIE_NAME,
  sealSessionState,
  unsealSessionState,
} from "@/lib/crypto-cookie";
import {
  LAYER1_CONSTANTS,
  LAYER3_CONSTANTS,
  LAYER4_CONSTANTS,
  evaluateLayer2Equations,
} from "@/lib/lazarus-constants";
import { verifyEcdsaSignature } from "@/lib/secp256k1";
import { fetchRecentTelemetry, recordAuditEvent } from "@/lib/db-telemetry";

export async function GET() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(COOKIE_NAME)?.value;
  const session = unsealSessionState(rawToken);
  const telemetry = await fetchRecentTelemetry();

  const res = NextResponse.json({
    session,
    cookieSecured: Boolean(rawToken),
    telemetry,
  });

  if (!rawToken) {
    const { token } = sealSessionState({
      operativeId: session.operativeId,
      callsign: session.callsign,
      clearedLayers: session.clearedLayers,
      layerProofs: session.layerProofs,
    });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return res;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const cookieStore = await cookies();
    const session = unsealSessionState(cookieStore.get(COOKIE_NAME)?.value);

    const action = body?.action || "verify_layer";

    if (action === "reset_session") {
      const { token, fullState } = sealSessionState({
        operativeId: session.operativeId,
        callsign: session.callsign,
        clearedLayers: [],
        layerProofs: {},
      });
      const telemetry = await fetchRecentTelemetry();
      const res = NextResponse.json({
        ok: true,
        message: "Cryptographic clearance token reset.",
        session: fullState,
        telemetry,
      });
      res.cookies.set(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      return res;
    }

    if (action === "set_callsign") {
      const cleanCallsign = String(body?.callsign || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, "")
        .slice(0, 24);
      if (!cleanCallsign) {
        return NextResponse.json(
          { ok: false, error: "Invalid operative callsign." },
          { status: 400 }
        );
      }
      const { token, fullState } = sealSessionState({
        operativeId: session.operativeId,
        callsign: cleanCallsign,
        clearedLayers: session.clearedLayers,
        layerProofs: session.layerProofs,
      });
      const telemetry = await fetchRecentTelemetry();
      const res = NextResponse.json({
        ok: true,
        session: fullState,
        telemetry,
      });
      res.cookies.set(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      return res;
    }

    const layer = Number(body?.layer);
    let verified = false;
    let verificationDetail = "";
    let proofHash = "";

    if (layer === 1) {
      const candidate = String(body?.key || "").trim();
      const camX = Number(body?.uniforms?.u_cam_x);
      const camY = Number(body?.uniforms?.u_cam_y);
      const camZ = Number(body?.uniforms?.u_cam_z);
      const uTime = Number(body?.uniforms?.u_time);

      const uniformsMatch =
        !Number.isNaN(camX) &&
        Math.abs(camX - LAYER1_CONSTANTS.RESONANCE_UNIFORMS.u_cam_x) <= 0.005 &&
        Math.abs(camY - LAYER1_CONSTANTS.RESONANCE_UNIFORMS.u_cam_y) <= 0.005 &&
        Math.abs(camZ - LAYER1_CONSTANTS.RESONANCE_UNIFORMS.u_cam_z) <= 0.005 &&
        Math.abs(uTime - LAYER1_CONSTANTS.RESONANCE_UNIFORMS.u_time) <= 0.01;

      if (
        candidate.toUpperCase() === LAYER1_CONSTANTS.ACCESS_VECTOR ||
        uniformsMatch
      ) {
        verified = true;
        verificationDetail =
          "Layer 1 Feigenbaum 4D Singularity & Polyglot Vector verified.";
        proofHash = crypto
          .createHash("sha256")
          .update(LAYER1_CONSTANTS.ACCESS_VECTOR)
          .digest("hex");
      } else {
        verificationDetail =
          "Layer 1 verification failed: Uniform coordinates do not match Feigenbaum bifurcation constants (delta, alpha, r_inf, delta*alpha) or access vector is invalid.";
      }
    } else if (layer === 2) {
      const rawKey = String(body?.key || "").trim();
      let candidateBytes: number[] = [];

      if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
        for (let i = 0; i < 64; i += 2) {
          candidateBytes.push(parseInt(rawKey.slice(i, i + 2), 16));
        }
      } else {
        const buf = Buffer.from(rawKey, "utf8");
        candidateBytes = Array.from(buf.values());
      }

      const evalResult = evaluateLayer2Equations(candidateBytes);
      if (evalResult.satisfiedCount === 32) {
        verified = true;
        verificationDetail =
          "Layer 2 Wasm Oracle SAT: All 64 coupled BV16 algebraic equations satisfied.";
        proofHash = crypto
          .createHash("sha256")
          .update(Buffer.from(candidateBytes))
          .digest("hex");
      } else {
        verificationDetail = `Layer 2 Wasm Oracle UNSAT: ${evalResult.satisfiedCount}/32 byte equation pairs satisfied.`;
      }
    } else if (layer === 3) {
      const rHex = String(body?.r || "").trim();
      const sHex = String(body?.s || "").trim();

      if (verifyEcdsaSignature(LAYER3_CONSTANTS.TARGET_MESSAGE, rHex, sHex)) {
        verified = true;
        verificationDetail =
          "Layer 3 secp256k1 ECDSA Signature verified for `EXECUTE_PROTOCOL_OMEGA`.";
        proofHash = crypto
          .createHash("sha256")
          .update(`${rHex}:${sHex}`)
          .digest("hex");
      } else {
        verificationDetail =
          "Layer 3 ECDSA Verification failed: Invalid (r, s) signature over secp256k1 for `EXECUTE_PROTOCOL_OMEGA`.";
      }
    } else if (layer === 4) {
      const submission = String(body?.key || "").trim();
      const normalizedHex = submission.toLowerCase().replace(/^0x/, "");

      if (
        submission === LAYER4_CONSTANTS.EXPECTED_FLAG ||
        normalizedHex === LAYER4_CONSTANTS.EXPECTED_SHA256
      ) {
        verified = true;
        verificationDetail =
          "Layer 4 LAZARUS-110 Esoteric CPU Output & SHA-256 Singularity Digest verified.";
        proofHash = LAYER4_CONSTANTS.EXPECTED_SHA256;
      } else {
        verificationDetail =
          "Layer 4 verification failed: Emulated output does not match LAZARUS-110 Rule-110 + Ternary ROM execution.";
      }
    } else {
      return NextResponse.json(
        { ok: false, error: "Invalid layer index (expected 1..4)." },
        { status: 400 }
      );
    }

    const updatedLayers = verified
      ? Array.from(new Set([...session.clearedLayers, layer])).sort()
      : session.clearedLayers;

    const updatedProofs = verified
      ? { ...session.layerProofs, [String(layer)]: proofHash.slice(0, 32) }
      : session.layerProofs;

    await recordAuditEvent({
      operativeId: session.operativeId,
      callsign: session.callsign,
      layer,
      eventType: verified ? `LAYER_${layer}_CLEARED` : `LAYER_${layer}_REJECTED`,
      payloadSummary: verificationDetail,
      proofHash: proofHash || "REJECTED",
      verified,
      clearedLayers: updatedLayers,
    });

    const { token, fullState } = sealSessionState({
      operativeId: session.operativeId,
      callsign: session.callsign,
      clearedLayers: updatedLayers,
      layerProofs: updatedProofs,
    });

    const telemetry = await fetchRecentTelemetry();

    const res = NextResponse.json({
      ok: verified,
      layer,
      message: verificationDetail,
      proofHash,
      session: fullState,
      telemetry,
    });

    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return res;
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Verification error",
      },
      { status: 500 }
    );
  }
}
