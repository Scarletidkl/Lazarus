import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { lazarusAuditLogs, lazarusSolverNodes } from "@/db/schema";

let seeded = false;

export async function ensureSeededTelemetry() {
  if (seeded) return;
  try {
    const existing = await db.select().from(lazarusSolverNodes).limit(1);
    if (existing.length === 0) {
      await db.insert(lazarusSolverNodes).values([
        {
          callsign: "ARCHITECT-ZERO",
          clearanceLevel: 4,
          layersMask: 15,
          proofDigest: "3b6eeea6f2286f41c27725cb6f31c211ad0161524ea9a7656e508f69063eb2bd",
        },
        {
          callsign: "EULER-3301",
          clearanceLevel: 3,
          layersMask: 7,
          proofDigest: "5c9dc491fa23fbe2d96b02980406c164b71f646528ceda97101f18eb434e6bd5",
        },
        {
          callsign: "GALOIS-FIELD-256",
          clearanceLevel: 2,
          layersMask: 3,
          proofDigest: "4c415a327b5a335f534d545f4d34545231585f5734534d5f305234434c33217d",
        },
      ]);

      await db.insert(lazarusAuditLogs).values([
        {
          operativeId: "OP-000001",
          layer: 1,
          eventType: "SHADER_SINGULARITY_ALIGNED",
          payloadSummary: "Feigenbaum coordinates (4.6692, 2.5029, 3.5699) @ t=11.6866",
          proofHash: "e91a4f7c8b21d09f34a1c55b88712399",
          verified: true,
        },
        {
          operativeId: "OP-000001",
          layer: 2,
          eventType: "WASM_Z3_ORACLE_SAT",
          payloadSummary: "oracle.wasm verify_key(ptr) == 1 (64/64 BV16 constraints)",
          proofHash: "4c415a327b5a335f534d545f4d345452",
          verified: true,
        },
        {
          operativeId: "OP-000001",
          layer: 3,
          eventType: "ECDSA_NONCE_COLLISION",
          payloadSummary: "secp256k1 k-reuse detected on X-Timestamp: 1337000000",
          proofHash: "5c9dc491fa23fbe2d96b02980406c164",
          verified: true,
        },
      ]);
    }
    seeded = true;
  } catch {
    // Graceful fallback if DB schema isn't pushed yet
  }
}

export async function recordAuditEvent(params: {
  operativeId: string;
  callsign?: string;
  layer: number;
  eventType: string;
  payloadSummary: string;
  proofHash: string;
  verified: boolean;
  clearedLayers?: number[];
}) {
  try {
    await ensureSeededTelemetry();
    await db.insert(lazarusAuditLogs).values({
      operativeId: params.operativeId,
      layer: params.layer,
      eventType: params.eventType,
      payloadSummary: params.payloadSummary.slice(0, 240),
      proofHash: params.proofHash.slice(0, 64),
      verified: params.verified,
    });

    if (params.verified && params.clearedLayers && params.callsign) {
      const mask = params.clearedLayers.reduce(
        (acc, l) => acc | (1 << (l - 1)),
        0
      );
      const level = params.clearedLayers.length;

      const existing = await db
        .select()
        .from(lazarusSolverNodes)
        .where(eq(lazarusSolverNodes.callsign, params.callsign))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(lazarusSolverNodes)
          .set({
            clearanceLevel: level,
            layersMask: mask,
            proofDigest: params.proofHash.slice(0, 64),
            updatedAt: new Date(),
          })
          .where(eq(lazarusSolverNodes.id, existing[0].id));
      } else {
        await db.insert(lazarusSolverNodes).values({
          callsign: params.callsign,
          clearanceLevel: level,
          layersMask: mask,
          proofDigest: params.proofHash.slice(0, 64),
        });
      }
    }
  } catch {
    // Non-blocking audit logging
  }
}

export async function fetchRecentTelemetry() {
  try {
    await ensureSeededTelemetry();
    const logs = await db
      .select()
      .from(lazarusAuditLogs)
      .orderBy(desc(lazarusAuditLogs.id))
      .limit(15);

    const solvers = await db
      .select()
      .from(lazarusSolverNodes)
      .orderBy(desc(lazarusSolverNodes.clearanceLevel), desc(lazarusSolverNodes.id))
      .limit(10);

    return { logs, solvers };
  } catch {
    return { logs: [], solvers: [] };
  }
}
