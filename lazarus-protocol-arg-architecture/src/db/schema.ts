import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const lazarusAuditLogs = pgTable("lazarus_audit_logs", {
  id: serial("id").primaryKey(),
  operativeId: text("operative_id").notNull(),
  layer: integer("layer").notNull(),
  eventType: text("event_type").notNull(), // e.g. 'ORACLE_SIGN', 'LAYER_VERIFY', 'VM_FETCH'
  payloadSummary: text("payload_summary").notNull(),
  proofHash: text("proof_hash").notNull(),
  verified: boolean("verified").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const lazarusSolverNodes = pgTable("lazarus_solver_nodes", {
  id: serial("id").primaryKey(),
  callsign: text("callsign").notNull(),
  clearanceLevel: integer("clearance_level").notNull().default(0), // 0..4
  layersMask: integer("layers_mask").notNull().default(0), // bitmask: 1=L1, 2=L2, 4=L3, 8=L4
  proofDigest: text("proof_digest").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
