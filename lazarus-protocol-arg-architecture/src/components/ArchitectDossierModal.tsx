"use client";

import React, { useState } from "react";
import {
  X,
  Terminal,
  ShieldAlert,
  Cpu,
  Key,
  FileCode2,
  CheckCircle2,
  Copy,
  Zap,
} from "lucide-react";
import {
  LAYER1_CONSTANTS,
  LAYER2_CONSTANTS,
  LAYER3_CONSTANTS,
  LAYER4_CONSTANTS,
} from "@/lib/lazarus-constants";

interface ArchitectDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInjectSolution: (layer: 1 | 2 | 3 | 4) => void;
}

export default function ArchitectDossierModal({
  isOpen,
  onClose,
  onInjectSolution,
}: ArchitectDossierModalProps) {
  const [activeTab, setActiveTab] = useState<
    "writeup" | "z3" | "ecdsa" | "vm" | "deploy"
  >("writeup");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl max-h-[90vh] bg-[#0B0E14] border border-emerald-500/50 flex flex-col font-mono text-slate-200 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1E2430] bg-[#060709]">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold tracking-wider uppercase text-emerald-400">
                CLASSIFIED ARCHITECT DOSSIER // THE LAZARUS PROTOCOL WRITE-UP
              </h2>
              <p className="text-[11px] text-slate-400">
                Complete Mathematical Proofs, Z3 SMT Solver, secp256k1 ECDSA Nonce Reuse Exploit & Custom VM Emulator
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white border border-transparent hover:border-[#1E2430]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap border-b border-[#1E2430] bg-[#080A0F] px-4 gap-1 pt-2">
          {[
            { id: "writeup", label: "01 // MASTER WRITE-UP & ANSWERS", icon: Key },
            { id: "z3", label: "02 // RUST WASM & Z3 SOLVER", icon: FileCode2 },
            { id: "ecdsa", label: "03 // SECP256K1 ECDSA EXPLOIT", icon: Terminal },
            { id: "vm", label: "04 // RULE-110 TERNARY VM", icon: Cpu },
            { id: "deploy", label: "05 // VERCEL & BUILD PIPELINE", icon: CheckCircle2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold tracking-wider border-t border-x transition-colors ${
                  active
                    ? "bg-[#0B0E14] text-emerald-400 border-emerald-500/50"
                    : "bg-transparent text-slate-400 border-transparent hover:text-slate-200"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs leading-relaxed">
          {activeTab === "writeup" && (
            <div className="space-y-6">
              <div className="p-4 bg-[#060709] border border-[#1E2430]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-emerald-400 font-bold uppercase tracking-wider">
                    QUICK VERIFICATION VECTOR INJECTION (ONE-CLICK SOLVE)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Populates exact mathematical proofs into the active workstation
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    {
                      layer: 1 as const,
                      title: "Inject Layer 1",
                      sub: "Feigenbaum Uniforms + Vector",
                    },
                    {
                      layer: 2 as const,
                      title: "Inject Layer 2",
                      sub: "32-Byte Z3 Wasm Solution",
                    },
                    {
                      layer: 3 as const,
                      title: "Inject Layer 3",
                      sub: "Forged secp256k1 Signature",
                    },
                    {
                      layer: 4 as const,
                      title: "Inject Layer 4",
                      sub: "Rule-110 + Ternary VM Hash",
                    },
                  ].map((item) => (
                    <button
                      key={item.layer}
                      onClick={() => {
                        onInjectSolution(item.layer);
                        onClose();
                      }}
                      className="flex flex-col items-start p-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/40 text-left transition-colors"
                    >
                      <div className="flex items-center gap-1.5 text-emerald-300 font-bold">
                        <Zap className="w-3.5 h-3.5" />
                        {item.title}
                      </div>
                      <span className="text-[11px] text-slate-400 mt-1">
                        {item.sub}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Layer 1 Summary */}
              <div className="p-4 bg-[#060709] border border-[#1E2430] space-y-2">
                <div className="text-emerald-400 font-bold uppercase">
                  LAYER 1 // 4D MANDELBULB SHADER & TRI-POLYGLOT (PNG + PDF + ZIP)
                </div>
                <p className="text-slate-300">
                  The GLSL fragment shader raymarches an 8th-order phase-shifted Mandelbulb fractal.
                  Inspecting the shader source reveals a singularity distance check governed by the
                  Feigenbaum period-doubling bifurcation constants:
                </p>
                <pre className="p-3 bg-[#0B0E14] border border-[#1E2430] text-emerald-300 overflow-x-auto">
{`u_cam_x (δ : First Feigenbaum Constant)  = 4.6692
u_cam_y (α : Second Feigenbaum Constant) = 2.5029
u_cam_z (r∞: Logistic Map Accumulation)  = 3.5699
u_time  (τ : δ * α Product)              = 11.6866

Browser Console Command:
window.LAZARUS_SET_UNIFORMS(4.6692, 2.5029, 3.5699, 11.6866)

Decoded Layer 1 Access Vector:
${LAYER1_CONSTANTS.ACCESS_VECTOR}`}
                </pre>
                <p className="text-slate-400">
                  Downloading <code className="text-cyan-400">/artifact.png</code> and running{" "}
                  <code className="text-cyan-400">unzip artifact.png</code> or{" "}
                  <code className="text-cyan-400">binwalk -e artifact.png</code> extracts{" "}
                  <code>manifest.txt</code>, <code>oracle_constraints.smt2</code>,{" "}
                  <code>layer4_rom.bin</code>, and <code>isa_spec.pdf</code>.
                </p>
              </div>

              {/* Layer 2 Summary */}
              <div className="p-4 bg-[#060709] border border-[#1E2430] space-y-2">
                <div className="text-emerald-400 font-bold uppercase">
                  LAYER 2 // WEBASSEMBLY REVERSE ENGINEERING & Z3 SMT-SOLVER
                </div>
                <p className="text-slate-300">
                  The binary <code className="text-cyan-400">/oracle.wasm</code> exports{" "}
                  <code>verify_key(ptr: i32) -&gt; i32</code> and{" "}
                  <code>count_satisfied(ptr: i32) -&gt; i32</code>. For each index{" "}
                  <code>i in 0..31</code>, the 32-byte key <code>b[0..31]</code> must satisfy two
                  coupled equations modulo 65536:
                </p>
                <pre className="p-3 bg-[#0B0E14] border border-[#1E2430] text-emerald-300 overflow-x-auto">
{`eq_A[i]: ((b[i] ^ b[(i+5)%32]) + b[(i+12)%32]*M1[i] + (b[(i+23)%32] ^ K_MASK[i])*M2[i]) & 0xFFFF == TARGET_A[i]
eq_B[i]: (((b[i] * (2*i + 1)) & 0xFFFF) ^ b[(i+1)%32]) + (b[(i+7)%32] ^ b[(i+15)%32]) == TARGET_B[i]

Unique 32-Byte Solution (ASCII): ${LAYER2_CONSTANTS.EXPECTED_KEY_ASCII}
Unique 32-Byte Solution (HEX)  : ${LAYER2_CONSTANTS.EXPECTED_KEY_HEX}`}
                </pre>
              </div>

              {/* Layer 3 Summary */}
              <div className="p-4 bg-[#060709] border border-[#1E2430] space-y-2">
                <div className="text-emerald-400 font-bold uppercase">
                  LAYER 3 // SECP256K1 ECDSA NONCE REUSE CRYPTANALYSIS
                </div>
                <p className="text-slate-300">
                  The oracle <code className="text-cyan-400">POST /api/v1/sign</code> derives the
                  ephemeral scalar <code>k</code> deterministically from the HTTP header{" "}
                  <code>X-Timestamp</code>. Sending two distinct messages with{" "}
                  <code>X-Timestamp: 1337000000</code> yields identical <code>r</code>:
                </p>
                <pre className="p-3 bg-[#0B0E14] border border-[#1E2430] text-emerald-300 overflow-x-auto">
{`k   = (z1 - z2) * (s1 - s2)^(-1) mod n
    = ${LAYER3_CONSTANTS.REFERENCE_REUSED_NONCE}

d_A = (s1 * k - z1) * r^(-1) mod n
    = ${LAYER3_CONSTANTS.REFERENCE_PRIVATE_KEY}

Forged Signature for "EXECUTE_PROTOCOL_OMEGA":
r   = ${LAYER3_CONSTANTS.REFERENCE_OMEGA_R}
s   = ${LAYER3_CONSTANTS.REFERENCE_OMEGA_S}`}
                </pre>
              </div>

              {/* Layer 4 Summary */}
              <div className="p-4 bg-[#060709] border border-[#1E2430] space-y-2">
                <div className="text-emerald-400 font-bold uppercase">
                  LAYER 4 // LAZARUS-110 ESOTERIC CPU EMULATOR (RULE 110 + BASE-3 ALU)
                </div>
                <pre className="p-3 bg-[#0B0E14] border border-[#1E2430] text-emerald-300 overflow-x-auto">
{`Emulated VM ASCII Output : ${LAYER4_CONSTANTS.EXPECTED_FLAG}
Final SHA-256 Digest     : ${LAYER4_CONSTANTS.EXPECTED_SHA256}`}
                </pre>
              </div>
            </div>
          )}

          {activeTab === "z3" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-emerald-400 font-bold">
                  MICROSOFT Z3 SMT SOLVER SCRIPT (scripts/solve_layer2_z3.py)
                </span>
                <button
                  onClick={() =>
                    copyText(
                      "z3",
                      `from z3 import *\n# Solves oracle.wasm for ${LAYER2_CONSTANTS.EXPECTED_KEY_ASCII}`
                    )
                  }
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1E2430] hover:bg-slate-700 text-xs"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedId === "z3" ? "COPIED" : "COPY"}
                </button>
              </div>
              <pre className="p-4 bg-[#060709] border border-[#1E2430] text-slate-200 overflow-x-auto">
{`#!/usr/bin/env python3
from z3 import BitVec, Solver, sat

M1 = [${LAYER2_CONSTANTS.M1.join(", ")}]
M2 = [${LAYER2_CONSTANTS.M2.join(", ")}]
K_MASK = [${LAYER2_CONSTANTS.K_MASK.join(", ")}]
ODD_MUL = [2 * i + 1 for i in range(32)]
TARGET_A = [${LAYER2_CONSTANTS.TARGET_A.join(", ")}]
TARGET_B = [${LAYER2_CONSTANTS.TARGET_B.join(", ")}]

s = Solver()
b = [BitVec(f"b_{i}", 16) for i in range(32)]

for i in range(32):
    s.add(b[i] >= 0x20, b[i] <= 0x7E)
    eq_a = ((b[i] ^ b[(i+5)%32]) + b[(i+12)%32]*M1[i] + (b[(i+23)%32] ^ K_MASK[i])*M2[i]) & 0xFFFF
    eq_b = (((b[i] * ODD_MUL[i]) & 0xFFFF) ^ b[(i+1)%32]) + (b[(i+7)%32] ^ b[(i+15)%32])
    s.add(eq_a == TARGET_A[i])
    s.add((eq_b & 0xFFFF) == TARGET_B[i])

assert s.check() == sat
m = s.model()
key = bytes([m[b[i]].as_long() for i in range(32)])
print("SOLVED KEY:", key.decode("ascii")) # -> ${LAYER2_CONSTANTS.EXPECTED_KEY_ASCII}`}
              </pre>
            </div>
          )}

          {activeTab === "ecdsa" && (
            <div className="space-y-4">
              <div className="text-emerald-400 font-bold">
                SECP256K1 ECDSA NONCE REUSE EXPLOIT (scripts/solve_layer3_ecdsa.py)
              </div>
              <pre className="p-4 bg-[#060709] border border-[#1E2430] text-slate-200 overflow-x-auto">
{`#!/usr/bin/env python3
import hashlib

SECP_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
def modinv(a, m=SECP_N): return pow(a % m, m - 2, m)

# Step 1: Query POST /api/v1/sign twice with Header "X-Timestamp: 1337000000"
# msg1 = "PROBE_ALPHA_01", msg2 = "PROBE_BETA_02"
r  = 0x5c9dc491fa23fbe2d96b02980406c164b71f646528ceda97101f18eb434e6bd5
z1 = 0x62c0754d09b3ddb289d515405f6c8e1aae3e1e9d26c5ed2ce6ba31741f62c147
s1 = 0x7db47b72ed3708ad37e8eaef25e01278748487504c11216e252d41e411ebaf4b
z2 = 0x64e7e84350ddf7b7a12b098103a28c9e6261f58886384aad6ee7291645b2e590
s2 = 0xe7091a22b75e0554d2dc6ea4b139cc2fa9a857318ddc6f487fb049185e2e9f6d

# Step 2: Recover ephemeral nonce k and server private key d_A
k   = ((z1 - z2) * modinv(s1 - s2)) % SECP_N
d_A = ((s1 * k - z1) * modinv(r)) % SECP_N

# Step 3: Sign "EXECUTE_PROTOCOL_OMEGA"
z_omega = int.from_bytes(hashlib.sha256(b"EXECUTE_PROTOCOL_OMEGA").digest(), "big") % SECP_N
s_omega = (modinv(k) * (z_omega + r * d_A)) % SECP_N

print("Recovered d_A:", hex(d_A))
print("Forged r     :", hex(r))
print("Forged s     :", hex(s_omega))`}
              </pre>
            </div>
          )}

          {activeTab === "vm" && (
            <div className="space-y-4">
              <div className="text-emerald-400 font-bold">
                LAZARUS-110 ESOTERIC CPU SPECIFICATION & EMULATOR (scripts/solve_layer4_vm.py)
              </div>
              <pre className="p-4 bg-[#060709] border border-[#1E2430] text-slate-200 overflow-x-auto">
{`Architecture:
- Registers : R0..R7 (8-bit unsigned), initialized to 0x00
- Tape      : 16-bit circular Wolfram Rule 110 register, initialized to 0xB6D3
- Format    : Fixed 3-byte instructions [OPCODE, ARG_A, ARG_B]

Opcode Table:
  0x01 reg imm8  : LDI R[reg], imm8          -> R[reg] = imm8
  0x02 dst src   : XOR R[dst], R[src]        -> R[dst] = (R[dst] ^ R[src]) & 0xFF
  0x03 dst imm8  : ADD R[dst], imm8          -> R[dst] = (R[dst] + imm8) & 0xFF
  0x04 reg shift : ROL R[reg], shift         -> 8-bit rotate left by (shift & 7)
  0x05 dst steps : R110_STEP R[dst], steps   -> Evolve 16-bit Rule 110 tape by 'steps' generations;
                                                R[dst] = (TAPE & 0xFF) ^ ((TAPE >> 8) & 0xFF)
  0x06 dst src   : TRIT_MAD R[dst], R[src]   -> Base-3 digitwise addition mod 3 across 6 trits
  0x07 reg 0x00  : EMIT R[reg]               -> Append R[reg] to output buffer
  0xFF 0x00 0x00 : HALT                      -> Terminate execution

Emulated Output : ${LAYER4_CONSTANTS.EXPECTED_FLAG}
SHA-256 Digest  : ${LAYER4_CONSTANTS.EXPECTED_SHA256}`}
              </pre>
            </div>
          )}

          {activeTab === "deploy" && (
            <div className="space-y-4">
              <div className="text-emerald-400 font-bold">
                VERCEL DEPLOYMENT & ASSET GENERATION PIPELINE
              </div>
              <pre className="p-4 bg-[#060709] border border-[#1E2430] text-slate-200 overflow-x-auto">
{`# 1. Generate Tri-Polyglot (PNG+PDF+ZIP), oracle.wasm, and Layer 4 ROM:
python3 scripts/generate_assets.py

# 2. (Optional) Compile Rust Wasm source directly via Cargo / wasm-pack:
cd rust-oracle
cargo build --target wasm32-unknown-unknown --release
cp target/wasm32-unknown-unknown/release/lazarus_oracle_wasm.wasm ../public/oracle.wasm

# 3. Verify all 4 layers locally:
python3 scripts/solve_layer2_z3.py
python3 scripts/solve_layer3_ecdsa.py
python3 scripts/solve_layer4_vm.py

# 4. Build and deploy to Vercel:
npm run build
vercel --prod`}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
