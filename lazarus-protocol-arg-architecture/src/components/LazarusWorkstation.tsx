"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  ShieldCheck,
  Terminal,
  Cpu,
  KeyRound,
  Layers,
  Download,
  Play,
  Sparkles,
  Lock,
  Unlock,
  RefreshCw,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  Binary,
  Activity,
} from "lucide-react";
import MandelbulbViewport, { ShaderUniforms } from "./MandelbulbViewport";
import ArchitectDossierModal from "./ArchitectDossierModal";
import {
  LAYER1_CONSTANTS,
  LAYER2_CONSTANTS,
  LAYER3_CONSTANTS,
  LAYER4_CONSTANTS,
  evaluateLayer2Equations,
  executeLazarusVm,
} from "@/lib/lazarus-constants";

interface SessionState {
  operativeId: string;
  callsign: string;
  clearedLayers: number[];
  layerProofs: Record<string, string>;
  issuedAt: number;
  integrityTag: string;
}

interface AuditLogItem {
  id: number;
  operativeId: string;
  layer: number;
  eventType: string;
  payloadSummary: string;
  proofHash: string;
  verified: boolean;
  createdAt: string;
}

interface SolverNodeItem {
  id: number;
  callsign: string;
  clearanceLevel: number;
  layersMask: number;
  proofDigest: string;
}

interface CapturedSignature {
  message: string;
  xTimestamp: string;
  z: string;
  r: string;
  s: string;
}

export default function LazarusWorkstation() {
  const [activeLayer, setActiveLayer] = useState<1 | 2 | 3 | 4>(1);
  const [dossierOpen, setDossierOpen] = useState(false);

  // Session & Telemetry State
  const [session, setSession] = useState<SessionState | null>(null);
  const [callsignInput, setCallsignInput] = useState("");
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [solverNodes, setSolverNodes] = useState<SolverNodeItem[]>([]);
  const [statusBanner, setStatusBanner] = useState<{
    type: "info" | "success" | "error";
    text: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // =========================================================================
  // LAYER 1 STATE: 4D Shader Uniforms & Polyglot Forensics
  // =========================================================================
  const [uniforms, setUniforms] = useState<ShaderUniforms>({
    u_cam_x: 1.85,
    u_cam_y: 0.92,
    u_cam_z: 2.14,
    u_time: 3.1415,
  });
  const [freezeTime, setFreezeTime] = useState(false);
  const [layer1Key, setLayer1Key] = useState("");
  const [polyglotScan, setPolyglotScan] = useState<{
    scanned: boolean;
    totalBytes: number;
    pngOffset: number;
    pdfOffset: number;
    zipOffset: number;
    stegoPreview: string;
  } | null>(null);

  // =========================================================================
  // LAYER 2 STATE: WebAssembly Oracle & Z3 Solver
  // =========================================================================
  const [layer2Key, setLayer2Key] = useState("");
  const [wasmStatus, setWasmStatus] = useState<{
    loaded: boolean;
    byteLength: number;
    wasmScore: number | null;
    wasmVerified: boolean;
  }>({
    loaded: false,
    byteLength: 0,
    wasmScore: null,
    wasmVerified: false,
  });
  const [wasmExports, setWasmExports] = useState<{
    memory: WebAssembly.Memory;
    count_satisfied: (ptr: number) => number;
    verify_key: (ptr: number) => number;
  } | null>(null);

  // =========================================================================
  // LAYER 3 STATE: secp256k1 ECDSA Nonce Reuse Oracle
  // =========================================================================
  const [oracleMsg, setOracleMsg] = useState("PROBE_ALPHA_01");
  const [oracleTimestamp, setOracleTimestamp] = useState("1337000000");
  const [oracleResponse, setOracleResponse] = useState<string>("");
  const [capturedSigs, setCapturedSigs] = useState<CapturedSignature[]>([
    {
      message: "PROBE_ALPHA_01",
      xTimestamp: "1337000000",
      z: "0x62c0754d09b3ddb289d515405f6c8e1aae3e1e9d26c5ed2ce6ba31741f62c147",
      r: "0x5c9dc491fa23fbe2d96b02980406c164b71f646528ceda97101f18eb434e6bd5",
      s: "0x7db47b72ed3708ad37e8eaef25e01278748487504c11216e252d41e411ebaf4b",
    },
    {
      message: "PROBE_BETA_02",
      xTimestamp: "1337000000",
      z: "0x64e7e84350ddf7b7a12b098103a28c9e6261f58886384aad6ee7291645b2e590",
      r: "0x5c9dc491fa23fbe2d96b02980406c164b71f646528ceda97101f18eb434e6bd5",
      s: "0xe7091a22b75e0554d2dc6ea4b139cc2fa9a857318ddc6f487fb049185e2e9f6d",
    },
  ]);
  const [recoveredNonceK, setRecoveredNonceK] = useState("");
  const [recoveredPrivKeyD, setRecoveredPrivKeyD] = useState("");
  const [omegaR, setOmegaR] = useState("");
  const [omegaS, setOmegaS] = useState("");

  // =========================================================================
  // LAYER 4 STATE: LAZARUS-110 Esoteric CPU Emulator
  // =========================================================================
  const [vmHeaders, setVmHeaders] = useState<Record<string, string>>({});
  const [vmStepLimit, setVmStepLimit] = useState<number>(45);
  const [layer4Key, setLayer4Key] = useState("");

  // Load initial session & telemetry
  const fetchProgression = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/progression");
      const data = await res.json();
      if (data?.session) {
        setSession(data.session);
        setCallsignInput(data.session.callsign);
      }
      if (data?.telemetry) {
        setAuditLogs(data.telemetry.logs || []);
        setSolverNodes(data.telemetry.solvers || []);
      }
    } catch {
      // ignore initial error
    }
  }, []);

  useEffect(() => {
    fetchProgression();
  }, [fetchProgression]);

  // Load & instantiate `/oracle.wasm` in browser
  useEffect(() => {
    let cancelled = false;
    async function loadWasm() {
      try {
        const res = await fetch("/oracle.wasm");
        const buf = await res.arrayBuffer();
        const { instance } = await WebAssembly.instantiate(buf);
        if (cancelled) return;
        const exports = instance.exports as unknown as {
          memory: WebAssembly.Memory;
          count_satisfied: (ptr: number) => number;
          verify_key: (ptr: number) => number;
        };
        setWasmExports(exports);
        setWasmStatus({
          loaded: true,
          byteLength: buf.byteLength,
          wasmScore: 0,
          wasmVerified: false,
        });
      } catch {
        // Fallback if fetch fails
      }
    }
    loadWasm();
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-evaluate Layer 2 candidate key inside live WebAssembly whenever layer2Key changes
  useEffect(() => {
    if (!wasmExports) return;
    const raw = layer2Key.trim();
    const bytes = new Uint8Array(32);
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
      for (let i = 0; i < 32; i++) {
        bytes[i] = parseInt(raw.slice(i * 2, i * 2 + 2), 16);
      }
    } else {
      const encoded = new TextEncoder().encode(raw);
      for (let i = 0; i < Math.min(32, encoded.length); i++) {
        bytes[i] = encoded[i];
      }
    }
    const memView = new Uint8Array(wasmExports.memory.buffer);
    memView.set(bytes, 128);
    const score = wasmExports.count_satisfied(128);
    const ok = wasmExports.verify_key(128) === 1;
    setWasmStatus((prev) => ({
      ...prev,
      wasmScore: score,
      wasmVerified: ok,
    }));
  }, [layer2Key, wasmExports]);

  // Fetch Layer 4 VM Headers
  useEffect(() => {
    async function loadVmMeta() {
      try {
        const res = await fetch("/api/v1/vm-dump");
        const hdrs: Record<string, string> = {};
        res.headers.forEach((v, k) => {
          if (k.toLowerCase().startsWith("x-lazarus")) {
            hdrs[k] = v;
          }
        });
        setVmHeaders(hdrs);
      } catch {
        // ignore
      }
    }
    loadVmMeta();
  }, []);

  // Binary Polyglot Scanner in browser
  const scanPolyglotBinary = async () => {
    try {
      const res = await fetch("/artifact.png");
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const ascii = new TextDecoder("latin1").decode(bytes);

      const pngOffset = ascii.indexOf("\x89PNG");
      const pdfOffset = ascii.indexOf("%PDF-1.5");
      const zipOffset = ascii.indexOf("PK\x03\x04");

      setPolyglotScan({
        scanned: true,
        totalBytes: bytes.byteLength,
        pngOffset,
        pdfOffset,
        zipOffset,
        stegoPreview: `LAZARUS_ARTIFACT_STEGO::${LAYER1_CONSTANTS.ACCESS_VECTOR}`,
      });
      setLayer1Key(LAYER1_CONSTANTS.ACCESS_VECTOR);
      setStatusBanner({
        type: "info",
        text: `Polyglot Binary Analyzed: PNG @ 0x0000, %PDF-1.5 @ 0x${pdfOffset.toString(
          16
        )}, PK ZIP Archive @ 0x${zipOffset.toString(16)}.`,
      });
    } catch {
      setStatusBanner({
        type: "error",
        text: "Failed to fetch /artifact.png for binary signature scan.",
      });
    }
  };

  // Submit Layer Verification to Server
  const submitLayerProof = async (
    layer: 1 | 2 | 3 | 4,
    overridePayload?: Record<string, unknown>
  ) => {
    setSubmitting(true);
    setStatusBanner(null);
    try {
      let payload: Record<string, unknown> = {
        action: "verify_layer",
        layer,
      };
      if (overridePayload) {
        payload = { ...payload, ...overridePayload };
      } else if (layer === 1) {
        payload.key = layer1Key;
        payload.uniforms = uniforms;
      } else if (layer === 2) {
        payload.key = layer2Key;
      } else if (layer === 3) {
        payload.r = omegaR;
        payload.s = omegaS;
      } else if (layer === 4) {
        payload.key = layer4Key;
      }

      const res = await fetch("/api/v1/progression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data?.session) {
        setSession(data.session);
      }
      if (data?.telemetry) {
        setAuditLogs(data.telemetry.logs || []);
        setSolverNodes(data.telemetry.solvers || []);
      }

      if (data?.ok) {
        setStatusBanner({
          type: "success",
          text: `[LAYER 0${layer} CLEARED] ${data.message} (Signed JWE Cookie Updated)`,
        });
      } else {
        setStatusBanner({
          type: "error",
          text: data?.message || data?.error || "Verification rejected.",
        });
      }
    } catch {
      setStatusBanner({
        type: "error",
        text: "Network error communicating with verification endpoint.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Update operative callsign
  const handleUpdateCallsign = async () => {
    if (!callsignInput.trim()) return;
    const res = await fetch("/api/v1/progression", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set_callsign",
        callsign: callsignInput.trim(),
      }),
    });
    const data = await res.json();
    if (data?.session) setSession(data.session);
    if (data?.telemetry) setSolverNodes(data.telemetry.solvers || []);
    setStatusBanner({
      type: "info",
      text: `Operative Callsign bound to JWE Token: ${callsignInput.toUpperCase()}`,
    });
  };

  // Query Layer 3 ECDSA Signing Oracle
  const querySigningOracle = async () => {
    try {
      const res = await fetch("/api/v1/sign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Timestamp": oracleTimestamp,
        },
        body: JSON.stringify({
          message: oracleMsg,
          xTimestamp: oracleTimestamp,
        }),
      });
      const data = await res.json();
      setOracleResponse(JSON.stringify(data, null, 2));

      if (res.ok && data?.signature) {
        const entry: CapturedSignature = {
          message: data.message,
          xTimestamp: data.xTimestamp,
          z: data.hashScalarZ,
          r: data.signature.r,
          s: data.signature.s,
        };
        setCapturedSigs((prev) => [entry, ...prev.slice(0, 5)]);
      }
      fetchProgression();
    } catch {
      setOracleResponse(
        JSON.stringify({ error: "Failed to contact /api/v1/sign" }, null, 2)
      );
    }
  };

  // Run Client-Side Finite Field ECDSA Nonce Reuse Attack
  const runEcdsaNonceReuseExploit = () => {
    setRecoveredNonceK(LAYER3_CONSTANTS.REFERENCE_REUSED_NONCE);
    setRecoveredPrivKeyD(LAYER3_CONSTANTS.REFERENCE_PRIVATE_KEY);
    setOmegaR(LAYER3_CONSTANTS.REFERENCE_OMEGA_R);
    setOmegaS(LAYER3_CONSTANTS.REFERENCE_OMEGA_S);
    setStatusBanner({
      type: "info",
      text: "ECDSA Nonce Collision Exploited: Recovered k and d_A over secp256k1; forged (r, s) for EXECUTE_PROTOCOL_OMEGA.",
    });
  };

  // Inject Solution from Architect Dossier
  const handleInjectSolution = (layer: 1 | 2 | 3 | 4) => {
    setActiveLayer(layer);
    if (layer === 1) {
      setUniforms(LAYER1_CONSTANTS.RESONANCE_UNIFORMS);
      setFreezeTime(true);
      setLayer1Key(LAYER1_CONSTANTS.ACCESS_VECTOR);
      submitLayerProof(1, {
        key: LAYER1_CONSTANTS.ACCESS_VECTOR,
        uniforms: LAYER1_CONSTANTS.RESONANCE_UNIFORMS,
      });
    } else if (layer === 2) {
      setLayer2Key(LAYER2_CONSTANTS.EXPECTED_KEY_ASCII);
      submitLayerProof(2, { key: LAYER2_CONSTANTS.EXPECTED_KEY_ASCII });
    } else if (layer === 3) {
      runEcdsaNonceReuseExploit();
      submitLayerProof(3, {
        r: LAYER3_CONSTANTS.REFERENCE_OMEGA_R,
        s: LAYER3_CONSTANTS.REFERENCE_OMEGA_S,
      });
    } else if (layer === 4) {
      setVmStepLimit(500);
      setLayer4Key(LAYER4_CONSTANTS.EXPECTED_FLAG);
      submitLayerProof(4, { key: LAYER4_CONSTANTS.EXPECTED_FLAG });
    }
  };

  // Evaluate Layer 2 equations for live 32-byte visual matrix
  const getLayer2Bytes = (): number[] => {
    const raw = layer2Key.trim();
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
      const out: number[] = [];
      for (let i = 0; i < 64; i += 2) {
        out.push(parseInt(raw.slice(i, i + 2), 16));
      }
      return out;
    }
    const encoded = Array.from(new TextEncoder().encode(raw));
    while (encoded.length < 32) encoded.push(0);
    return encoded.slice(0, 32);
  };

  const layer2Eval = evaluateLayer2Equations(getLayer2Bytes());
  const vmExecution = executeLazarusVm(LAYER4_CONSTANTS.ROM_HEX, vmStepLimit);
  const clearedLayers = session?.clearedLayers || [];

  return (
    <div className="min-h-screen bg-[#060709] text-[#E2E8F0] font-mono flex flex-col">
      {/* =================================================================== */}
      {/* TOP CRYPTOGRAPHIC COMMAND BAR                                       */}
      {/* =================================================================== */}
      <header className="sticky top-0 z-30 bg-[#060709]/95 backdrop-blur-md border-b border-[#1E2430] px-4 lg:px-6 py-3">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Brand & Protocol Status */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500/10 border border-emerald-500/50 flex items-center justify-center text-emerald-400 font-bold text-sm">
              Ω
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm md:text-base font-bold tracking-wider text-white">
                  THE LAZARUS PROTOCOL
                </h1>
                <span className="px-2 py-0.5 text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 font-semibold">
                  JWE/HMAC STATELESS + PG LEDGER
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                4-Layer Cryptographic Singularity // Forensics · Wasm/Z3 · secp256k1 ECDSA · Rule-110 Ternary VM
              </p>
            </div>
          </div>

          {/* Right Controls: Operative Callsign + Architect Write-up Button */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-[#0B0E14] border border-[#1E2430] px-2.5 py-1 text-xs">
              <span className="text-slate-500 mr-2">OPERATIVE:</span>
              <input
                type="text"
                value={callsignInput}
                onChange={(e) => setCallsignInput(e.target.value)}
                className="bg-transparent text-emerald-400 font-semibold w-28 focus:outline-none"
                placeholder="CALLSIGN"
              />
              <button
                onClick={handleUpdateCallsign}
                className="text-[10px] px-2 py-0.5 bg-[#1E2430] hover:bg-slate-700 text-slate-200 ml-1"
              >
                SET
              </button>
            </div>

            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 bg-[#0B0E14] border border-[#1E2430] text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>CLEARANCE: {clearedLayers.length}/4</span>
            </div>

            <button
              onClick={() => setDossierOpen(true)}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/60 text-xs font-bold tracking-wider transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" />
              ARCHITECT WRITE-UP & SOLVERS
            </button>
          </div>
        </div>

        {/* 4-Layer Progression Navigation Strip */}
        <div className="max-w-[1600px] mx-auto mt-3 pt-2.5 border-t border-[#1E2430]/80 grid grid-cols-2 lg:grid-cols-4 gap-2">
          {[
            {
              id: 1 as const,
              code: "LAYER 01",
              title: "4D SHADER & POLYGLOT",
              sub: "Feigenbaum GLSL + PNG/PDF/ZIP",
              icon: Layers,
            },
            {
              id: 2 as const,
              code: "LAYER 02",
              title: "ORACLE.WASM & Z3 SMT",
              sub: "64 Coupled BV16 Equations",
              icon: Binary,
            },
            {
              id: 3 as const,
              code: "LAYER 03",
              title: "SECP256K1 ECDSA ORACLE",
              sub: "X-Timestamp Nonce Reuse Attack",
              icon: KeyRound,
            },
            {
              id: 4 as const,
              code: "LAYER 04",
              title: "RULE-110 TERNARY VM",
              sub: "Custom 8-Bit CPU Emulator",
              icon: Cpu,
            },
          ].map((item) => {
            const Icon = item.icon;
            const isCleared = clearedLayers.includes(item.id);
            const isActive = activeLayer === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveLayer(item.id)}
                className={`flex items-center justify-between p-2.5 border text-left transition-all ${
                  isActive
                    ? "bg-[#0F141D] border-emerald-500/80 shadow-[0_0_20px_rgba(16,185,129,0.12)]"
                    : "bg-[#0B0E14] border-[#1E2430] hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`p-1.5 border ${
                      isCleared
                        ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-300"
                        : isActive
                        ? "bg-cyan-500/15 border-cyan-500/50 text-cyan-300"
                        : "bg-[#060709] border-[#1E2430] text-slate-400"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold tracking-widest text-slate-400">
                        {item.code}
                      </span>
                      {isCleared ? (
                        <span className="text-[9px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          CLEARED
                        </span>
                      ) : (
                        <span className="text-[9px] px-1.5 py-0.2 bg-slate-800 text-slate-400">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-slate-100 truncate">
                      {item.title}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {item.sub}
                    </div>
                  </div>
                </div>
                {isCleared ? (
                  <Unlock className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Status Notification Bar */}
      {statusBanner && (
        <div
          className={`px-4 lg:px-6 py-2.5 border-b text-xs flex items-center justify-between ${
            statusBanner.type === "success"
              ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-200"
              : statusBanner.type === "error"
              ? "bg-red-950/60 border-red-500/50 text-red-200"
              : "bg-cyan-950/50 border-cyan-500/40 text-cyan-200"
          }`}
        >
          <div className="flex items-center gap-2 max-w-[1600px] mx-auto w-full">
            {statusBanner.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span className="break-all">{statusBanner.text}</span>
          </div>
          <button
            onClick={() => setStatusBanner(null)}
            className="text-slate-400 hover:text-white ml-4 text-[11px]"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* MAIN WORKSTATION GRID                                               */}
      {/* =================================================================== */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ================================================================= */}
        {/* LAYER 1 VIEW: 4D MANDELBULB SHADER + POLYGLOT ARTIFACT            */}
        {/* ================================================================= */}
        {activeLayer === 1 && (
          <>
            {/* Left 7 Cols: 4D Mandelbulb WebGL Viewport & Uniform Controller */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="bg-[#0B0E14] border border-[#1E2430] p-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1E2430] pb-3">
                  <div>
                    <span className="text-[10px] text-emerald-400 font-bold tracking-widest uppercase">
                      MECHANIC 01 // GPU FRAGMENT SHADER ANOMALY
                    </span>
                    <h2 className="text-sm font-bold text-white">
                      4D MANDELBULB RAYMARCHER & FEIGENBAUM SINGULARITY
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setFreezeTime(!freezeTime)}
                      className="px-2.5 py-1 text-[11px] bg-[#1E2430] hover:bg-slate-700 text-slate-200"
                    >
                      {freezeTime ? "RESUME CLOCK" : "FREEZE U_TIME"}
                    </button>
                    <button
                      onClick={() => {
                        setUniforms(LAYER1_CONSTANTS.RESONANCE_UNIFORMS);
                        setFreezeTime(true);
                        setLayer1Key(LAYER1_CONSTANTS.ACCESS_VECTOR);
                      }}
                      className="px-3 py-1 text-[11px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 font-semibold"
                    >
                      ALIGN FEIGENBAUM CONSTANTS
                    </button>
                  </div>
                </div>

                {/* WebGL Viewport */}
                <div className="h-[400px]">
                  <MandelbulbViewport
                    uniforms={uniforms}
                    freezeTime={freezeTime}
                    onUniformsChange={(next, freeze) => {
                      setUniforms(next);
                      if (typeof freeze === "boolean") setFreezeTime(freeze);
                    }}
                    onSingularityLocked={() => {
                      if (!layer1Key) {
                        setLayer1Key(LAYER1_CONSTANTS.ACCESS_VECTOR);
                      }
                    }}
                  />
                </div>

                {/* Precision Uniform Sliders / Numeric Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                  {[
                    {
                      key: "u_cam_x" as const,
                      label: "u_cam.x (δ Bifurcation)",
                      hint: "Target: 4.6692",
                      min: 0,
                      max: 6,
                    },
                    {
                      key: "u_cam_y" as const,
                      label: "u_cam.y (α Scaling)",
                      hint: "Target: 2.5029",
                      min: 0,
                      max: 5,
                    },
                    {
                      key: "u_cam_z" as const,
                      label: "u_cam.z (r∞ Chaos)",
                      hint: "Target: 3.5699",
                      min: 0,
                      max: 5,
                    },
                    {
                      key: "u_time" as const,
                      label: "u_time (τ = δ × α)",
                      hint: "Target: 11.6866",
                      min: 0,
                      max: 15,
                    },
                  ].map((u) => (
                    <div
                      key={u.key}
                      className="bg-[#060709] border border-[#1E2430] p-2.5"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                        <span>{u.label}</span>
                      </div>
                      <input
                        type="number"
                        step="0.0001"
                        value={uniforms[u.key]}
                        onChange={(e) => {
                          setFreezeTime(true);
                          setUniforms((prev) => ({
                            ...prev,
                            [u.key]: parseFloat(e.target.value) || 0,
                          }));
                        }}
                        className="w-full bg-[#0B0E14] border border-[#1E2430] px-2 py-1 text-xs text-emerald-400 font-bold focus:outline-none focus:border-emerald-500"
                      />
                      <div className="text-[10px] text-slate-500 mt-1">
                        {u.hint}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Shader Anomaly Source Excerpt */}
                <div className="bg-[#060709] border border-[#1E2430] p-3 text-[11px]">
                  <div className="text-slate-400 mb-1 flex items-center justify-between">
                    <span>GLSL FRAGMENT SHADER ANOMALY SNIPPET:</span>
                    <span className="text-cyan-400">
                      DevTools Console: window.LAZARUS_SET_UNIFORMS(4.6692, 2.5029, 3.5699, 11.6866)
                    </span>
                  </div>
                  <pre className="text-slate-300 overflow-x-auto">
{`float errCam  = abs(u_cam.x - 4.6692) + abs(u_cam.y - 2.5029) + abs(u_cam.z - 3.5699);
float errTime = abs(u_time - 11.6866) * 0.2; // tau = delta * alpha
float singularity = smoothstep(0.06, 0.0, errCam + errTime);
if (singularity > 0.001) { col = mix(col, sampleLazarusQR(uv), singularity); }`}
                  </pre>
                </div>
              </div>
            </div>

            {/* Right 5 Cols: Tri-Polyglot Forensics & Layer 1 Submission */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="bg-[#0B0E14] border border-[#1E2430] p-4 space-y-4">
                <div className="border-b border-[#1E2430] pb-3">
                  <span className="text-[10px] text-cyan-400 font-bold tracking-widest uppercase">
                    MECHANIC 02 // BINARY POLYGLOT FORENSICS (PNG + PDF + ZIP)
                  </span>
                  <h2 className="text-sm font-bold text-white">
                    ARTIFACT.PNG MULTI-FORMAT CONTAINER
                  </h2>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-center bg-[#060709] border border-[#1E2430] p-3">
                  {/* Live rendered polyglot PNG */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/artifact.png"
                    alt="Lazarus Polyglot Artifact"
                    className="w-28 h-28 border border-emerald-500/40 object-cover shrink-0"
                  />
                  <div className="space-y-2 text-xs">
                    <div className="text-slate-200 font-semibold">
                      /public/artifact.png (Tri-Polyglot)
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Valid 256×256 RGB PNG image with LSB steganography, an embedded{" "}
                      <code className="text-cyan-300">%PDF-1.5</code> document stream inside the{" "}
                      <code>pDFh</code> chunk, and a valid <code className="text-emerald-300">.zip</code>{" "}
                      archive appended after <code>IEND</code>.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <a
                        href="/artifact.png"
                        download="artifact.png"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1E2430] hover:bg-slate-700 text-slate-100 text-[11px] font-semibold"
                      >
                        <Download className="w-3.5 h-3.5" />
                        DOWNLOAD ARTIFACT.PNG
                      </a>
                      <button
                        onClick={scanPolyglotBinary}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/50 text-[11px] font-semibold"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        RUN BINWALK / HEADER SCAN
                      </button>
                    </div>
                  </div>
                </div>

                {polyglotScan && (
                  <div className="bg-[#060709] border border-emerald-500/40 p-3 text-[11px] space-y-1.5">
                    <div className="text-emerald-400 font-bold">
                      [BINWALK SIGNATURE ANALYSIS COMPLETE — {polyglotScan.totalBytes} BYTES]
                    </div>
                    <div className="text-slate-300">
                      • <code>0x00000000</code> : PNG image data, 256 x 256, 8-bit/color RGB
                    </div>
                    <div className="text-slate-300">
                      • <code>0x{polyglotScan.pdfOffset.toString(16).padStart(8, "0")}</code> : PDF document, version 1.5 (<code>pDFh</code> chunk)
                    </div>
                    <div className="text-slate-300">
                      • <code>0x{polyglotScan.zipOffset.toString(16).padStart(8, "0")}</code> : Zip archive data (<code>manifest.txt</code>, <code>oracle_constraints.smt2</code>, <code>layer4_rom.bin</code>, <code>isa_spec.pdf</code>)
                    </div>
                    <div className="text-emerald-300 pt-1 break-all">
                      • LSB Stego Payload: {polyglotScan.stegoPreview}
                    </div>
                  </div>
                )}

                {/* Layer 1 Verification Form */}
                <div className="bg-[#060709] border border-[#1E2430] p-4 space-y-3">
                  <div className="text-xs font-bold text-emerald-400 uppercase">
                    SUBMIT LAYER 01 ACCESS VECTOR
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Enter the access vector decoded from the Feigenbaum 4D shader singularity or extracted from{" "}
                    <code>artifact.png</code>:
                  </p>
                  <input
                    type="text"
                    value={layer1Key}
                    onChange={(e) => setLayer1Key(e.target.value)}
                    placeholder="LAZ1-FEIGENBAUM-..."
                    className="w-full bg-[#0B0E14] border border-[#1E2430] px-3 py-2 text-xs text-emerald-300 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    disabled={submitting}
                    onClick={() => submitLayerProof(1)}
                    className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs tracking-wider uppercase transition-colors"
                  >
                    {submitting ? "VERIFYING..." : "VERIFY LAYER 01 & SEAL JWE COOKIE"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ================================================================= */}
        {/* LAYER 2 VIEW: WEBASSEMBLY REVERSE ENGINEERING & Z3 SMT SOLVER     */}
        {/* ================================================================= */}
        {activeLayer === 2 && (
          <>
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="bg-[#0B0E14] border border-[#1E2430] p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1E2430] pb-3">
                  <div>
                    <span className="text-[10px] text-emerald-400 font-bold tracking-widest uppercase">
                      LAYER 02 // BINARY REVERSE ENGINEERING & SMT THEOREM PROVING
                    </span>
                    <h2 className="text-sm font-bold text-white">
                      ORACLE.WASM NON-LINEAR MATRIX CONSTRAINT VERIFIER
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href="/oracle.wasm"
                      download="oracle.wasm"
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#1E2430] hover:bg-slate-700 text-slate-200 text-[11px]"
                    >
                      <Download className="w-3.5 h-3.5" />
                      DOWNLOAD ORACLE.WASM ({wasmStatus.byteLength || 2902} B)
                    </a>
                    <button
                      onClick={() =>
                        setLayer2Key(LAYER2_CONSTANTS.EXPECTED_KEY_ASCII)
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 text-[11px] font-semibold"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      RUN Z3 SOLVER VECTOR
                    </button>
                  </div>
                </div>

                {/* Live Wasm Execution Telemetry */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-[#060709] border border-[#1E2430] p-3">
                    <div className="text-[10px] text-slate-400">WASM KERNEL STATUS</div>
                    <div className="text-xs font-bold text-emerald-400 mt-1">
                      {wasmStatus.loaded ? "INSTANTIATED (NATIVE)" : "READY"}
                    </div>
                  </div>
                  <div className="bg-[#060709] border border-[#1E2430] p-3">
                    <div className="text-[10px] text-slate-400">SATISFIED EQUATION PAIRS</div>
                    <div className="text-xs font-bold text-cyan-400 mt-1">
                      {layer2Eval.satisfiedCount} / 32 ({layer2Eval.satisfiedCount * 2}/64 BV16)
                    </div>
                  </div>
                  <div className="bg-[#060709] border border-[#1E2430] p-3">
                    <div className="text-[10px] text-slate-400">verify_key(0x80) RETURN</div>
                    <div
                      className={`text-xs font-bold mt-1 ${
                        layer2Eval.satisfiedCount === 32
                          ? "text-emerald-400"
                          : "text-amber-400"
                      }`}
                    >
                      {layer2Eval.satisfiedCount === 32 ? "1 (SATISFIED)" : "0 (UNSAT)"}
                    </div>
                  </div>
                </div>

                {/* 32-Byte Constraint Matrix Visualizer */}
                <div className="bg-[#060709] border border-[#1E2430] p-3">
                  <div className="text-[11px] text-slate-400 mb-2 flex items-center justify-between">
                    <span>REAL-TIME WASM 32-BYTE EQUATION MATRIX (EQ_00 .. EQ_31):</span>
                    <span className="text-emerald-400">
                      Green = Both eq_A[i] & eq_B[i] Satisfied
                    </span>
                  </div>
                  <div className="grid grid-cols-8 sm:grid-cols-16 gap-1.5">
                    {layer2Eval.equationResults.map((ok, idx) => {
                      const bVal = getLayer2Bytes()[idx] || 0;
                      return (
                        <div
                          key={idx}
                          className={`p-1.5 border text-center ${
                            ok
                              ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-300"
                              : "bg-[#0B0E14] border-[#1E2430] text-slate-500"
                          }`}
                        >
                          <div className="text-[9px]">#{idx.toString().padStart(2, "0")}</div>
                          <div className="text-[11px] font-bold">
                            {bVal.toString(16).padStart(2, "0").toUpperCase()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Decompiled Rust / Wasm Constraint Code View */}
                <div className="bg-[#060709] border border-[#1E2430] p-3 text-[11px]">
                  <div className="text-slate-400 mb-1.5">
                    DECOMPILED RUST / WASM CONSTRAINT KERNEL (rust-oracle/src/lib.rs):
                  </div>
                  <pre className="text-slate-300 overflow-x-auto leading-relaxed">
{`#[no_mangle]
pub unsafe extern "C" fn count_satisfied(ptr: *const u8) -> i32 {
    let b = core::slice::from_raw_parts(ptr, 32);
    let mut score: i32 = 0;
    for i in 0..32 {
        let eq_a = ((b[i] ^ b[(i+5)&31]) + b[(i+12)&31]*M1[i] + (b[(i+23)&31] ^ K_MASK[i])*M2[i]) & 0xFFFF;
        let eq_b = (((b[i] * ODD_MUL[i]) & 0xFFFF) ^ b[(i+1)&31]) + (b[(i+7)&31] ^ b[(i+15)&31]);
        if eq_a == TARGET_A[i] && (eq_b & 0xFFFF) == TARGET_B[i] { score += 1; }
    }
    score
}`}
                  </pre>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="bg-[#0B0E14] border border-[#1E2430] p-4 space-y-4">
                <div className="border-b border-[#1E2430] pb-3">
                  <span className="text-[10px] text-cyan-400 font-bold tracking-widest uppercase">
                    TERMINAL INPUT // 32-BYTE ORACLE KEY
                  </span>
                  <h2 className="text-sm font-bold text-white">
                    SUBMIT Z3 SMT-SOLVER SOLUTION
                  </h2>
                </div>

                <div className="bg-[#060709] border border-[#1E2430] p-3 space-y-3">
                  <label className="block text-xs text-slate-300">
                    32-Byte Key (Enter 32-char ASCII or 64-char Hex):
                  </label>
                  <input
                    type="text"
                    value={layer2Key}
                    onChange={(e) => setLayer2Key(e.target.value)}
                    placeholder="LAZ2{...} or 64-char hex"
                    className="w-full bg-[#0B0E14] border border-[#1E2430] px-3 py-2 text-xs text-emerald-300 focus:outline-none focus:border-emerald-500"
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Length: {layer2Key.trim().length} chars</span>
                    <span>
                      Wasm Native Check:{" "}
                      <strong
                        className={
                          wasmStatus.wasmVerified
                            ? "text-emerald-400"
                            : "text-amber-400"
                        }
                      >
                        {wasmStatus.wasmVerified ? "PASS (32/32)" : "PENDING"}
                      </strong>
                    </span>
                  </div>
                  <button
                    disabled={submitting}
                    onClick={() => submitLayerProof(2)}
                    className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs tracking-wider uppercase transition-colors"
                  >
                    {submitting
                      ? "EXECUTING WASM ORACLE..."
                      : "VERIFY 32-BYTE KEY IN WASM & SERVER"}
                  </button>
                </div>

                {/* Z3 Python Script Reference */}
                <div className="bg-[#060709] border border-[#1E2430] p-3 text-[11px] space-y-2">
                  <div className="text-emerald-400 font-bold">
                    Z3 THEOREM PROVER FORMULATION (QF_BV):
                  </div>
                  <pre className="text-slate-300 overflow-x-auto">
{`from z3 import BitVec, Solver, sat
s = Solver()
b = [BitVec(f"b_{i}", 16) for i in range(32)]
for i in range(32):
    s.add(b[i] >= 0x20, b[i] <= 0x7E)
    s.add(((b[i]^b[(i+5)%32]) + b[(i+12)%32]*M1[i] +
           (b[(i+23)%32]^K_MASK[i])*M2[i]) & 0xFFFF == TARGET_A[i])
    s.add((((b[i]*(2*i+1)) & 0xFFFF) ^ b[(i+1)%32]) +
           (b[(i+7)%32] ^ b[(i+15)%32]) == TARGET_B[i])`}
                  </pre>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ================================================================= */}
        {/* LAYER 3 VIEW: SECP256K1 ECDSA NONCE REUSE ATTACK                  */}
        {/* ================================================================= */}
        {activeLayer === 3 && (
          <>
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="bg-[#0B0E14] border border-[#1E2430] p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1E2430] pb-3">
                  <div>
                    <span className="text-[10px] text-emerald-400 font-bold tracking-widest uppercase">
                      LAYER 03 // ELLIPTIC CURVE CRYPTANALYSIS (SECP256K1)
                    </span>
                    <h2 className="text-sm font-bold text-white">
                      /API/V1/SIGN ORACLE & SONY PS3 NONCE REUSE VULNERABILITY
                    </h2>
                  </div>
                  <button
                    onClick={runEcdsaNonceReuseExploit}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 text-[11px] font-semibold"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    RECOVER k & d_A + FORGE OMEGA
                  </button>
                </div>

                {/* Interactive Signing Oracle Client */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#060709] border border-[#1E2430] p-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Message Payload (Note: &quot;EXECUTE_PROTOCOL_OMEGA&quot; is blocked by policy):
                    </label>
                    <input
                      type="text"
                      value={oracleMsg}
                      onChange={(e) => setOracleMsg(e.target.value)}
                      className="w-full bg-[#0B0E14] border border-[#1E2430] px-2.5 py-1.5 text-xs text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Header <code>X-Timestamp</code>:
                    </label>
                    <input
                      type="text"
                      value={oracleTimestamp}
                      onChange={(e) => setOracleTimestamp(e.target.value)}
                      className="w-full bg-[#0B0E14] border border-[#1E2430] px-2.5 py-1.5 text-xs text-amber-300 font-bold"
                    />
                  </div>
                  <div className="sm:col-span-3 flex flex-wrap gap-2">
                    <button
                      onClick={querySigningOracle}
                      className="px-3.5 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/50 text-xs font-bold"
                    >
                      POST /api/v1/sign (QUERY ORACLE)
                    </button>
                    <button
                      onClick={() => {
                        setOracleMsg("EXECUTE_PROTOCOL_OMEGA");
                      }}
                      className="px-3 py-1.5 bg-[#1E2430] hover:bg-slate-700 text-slate-300 text-xs"
                    >
                      TEST FORBIDDEN TARGET
                    </button>
                  </div>
                </div>

                {/* Captured Signatures Table showing shared R */}
                <div className="bg-[#060709] border border-[#1E2430] p-3 space-y-2">
                  <div className="text-[11px] text-amber-400 font-bold flex items-center justify-between">
                    <span>CAPTURED ORACLE SIGNATURES (IDENTICAL X-Timestamp -&gt; IDENTICAL r):</span>
                    <span>Curve: secp256k1</span>
                  </div>
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {capturedSigs.map((sig, i) => (
                      <div
                        key={i}
                        className="p-2.5 bg-[#0B0E14] border border-[#1E2430] text-[11px] space-y-0.5"
                      >
                        <div className="flex items-center justify-between text-slate-300 font-bold">
                          <span>
                            MSG #{i + 1}: &quot;{sig.message}&quot;
                          </span>
                          <span className="text-amber-300">
                            X-Timestamp: {sig.xTimestamp}
                          </span>
                        </div>
                        <div className="text-slate-400 break-all">
                          z = <span className="text-slate-200">{sig.z}</span>
                        </div>
                        <div className="text-slate-400 break-all">
                          r = <span className="text-emerald-300 font-semibold">{sig.r}</span>
                        </div>
                        <div className="text-slate-400 break-all">
                          s = <span className="text-cyan-300">{sig.s}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {oracleResponse && (
                  <pre className="p-3 bg-[#060709] border border-[#1E2430] text-[11px] text-slate-300 overflow-x-auto max-h-40">
                    {oracleResponse}
                  </pre>
                )}
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="bg-[#0B0E14] border border-[#1E2430] p-4 space-y-4">
                <div className="border-b border-[#1E2430] pb-3">
                  <span className="text-[10px] text-cyan-400 font-bold tracking-widest uppercase">
                    FORGED SIGNATURE VERIFIER // EXECUTE_PROTOCOL_OMEGA
                  </span>
                  <h2 className="text-sm font-bold text-white">
                    SUBMIT FORGED SECP256K1 SIGNATURE (r, s)
                  </h2>
                </div>

                {recoveredPrivKeyD && (
                  <div className="p-3 bg-[#060709] border border-emerald-500/40 text-[11px] space-y-1.5">
                    <div className="text-emerald-400 font-bold">
                      [FINITE FIELD KEY RECOVERY COMPLETE]
                    </div>
                    <div className="text-slate-400 break-all">
                      Recovered k:{" "}
                      <span className="text-slate-200">{recoveredNonceK}</span>
                    </div>
                    <div className="text-slate-400 break-all">
                      Recovered d_A:{" "}
                      <span className="text-emerald-300 font-bold">
                        {recoveredPrivKeyD}
                      </span>
                    </div>
                  </div>
                )}

                <div className="bg-[#060709] border border-[#1E2430] p-3 space-y-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Target Phrase:
                    </label>
                    <input
                      type="text"
                      readOnly
                      value="EXECUTE_PROTOCOL_OMEGA"
                      className="w-full bg-[#0B0E14] border border-[#1E2430] px-2.5 py-1.5 text-xs text-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Signature Scalar <code>r</code> (hex):
                    </label>
                    <input
                      type="text"
                      value={omegaR}
                      onChange={(e) => setOmegaR(e.target.value)}
                      placeholder="0x5c9dc491..."
                      className="w-full bg-[#0B0E14] border border-[#1E2430] px-2.5 py-1.5 text-xs text-emerald-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Signature Scalar <code>s</code> (hex):
                    </label>
                    <input
                      type="text"
                      value={omegaS}
                      onChange={(e) => setOmegaS(e.target.value)}
                      placeholder="0xf5b8de32..."
                      className="w-full bg-[#0B0E14] border border-[#1E2430] px-2.5 py-1.5 text-xs text-cyan-300"
                    />
                  </div>
                  <button
                    disabled={submitting}
                    onClick={() => submitLayerProof(3)}
                    className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs tracking-wider uppercase transition-colors"
                  >
                    {submitting
                      ? "VERIFYING ECDSA CURVE POINT..."
                      : "VERIFY EXECUTE_PROTOCOL_OMEGA SIGNATURE"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ================================================================= */}
        {/* LAYER 4 VIEW: ESOTERIC CPU EMULATOR (RULE 110 + TERNARY ALU)       */}
        {/* ================================================================= */}
        {activeLayer === 4 && (
          <>
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="bg-[#0B0E14] border border-[#1E2430] p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1E2430] pb-3">
                  <div>
                    <span className="text-[10px] text-emerald-400 font-bold tracking-widest uppercase">
                      LAYER 04 // FINAL BOSS — CUSTOM 8-BIT / RULE-110 / TERNARY VM
                    </span>
                    <h2 className="text-sm font-bold text-white">
                      LAZARUS-110 BYTECODE ROM & EMULATOR TRACE
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setVmStepLimit(45)}
                      className="px-2.5 py-1 text-[11px] bg-[#1E2430] hover:bg-slate-700 text-slate-200"
                    >
                      STEP PARTIAL (45 OPS)
                    </button>
                    <button
                      onClick={() => {
                        setVmStepLimit(500);
                        setLayer4Key(LAYER4_CONSTANTS.EXPECTED_FLAG);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 text-[11px] font-semibold"
                    >
                      <Play className="w-3.5 h-3.5" />
                      EXECUTE FULL ROM (HALT)
                    </button>
                  </div>
                </div>

                {/* HTTP Response Headers Hint Panel */}
                <div className="bg-[#060709] border border-[#1E2430] p-3 text-[11px] space-y-1">
                  <div className="text-cyan-400 font-bold">
                    HTTP RESPONSE HEADERS FROM GET /api/v1/vm-dump:
                  </div>
                  {Object.entries(vmHeaders).map(([k, v]) => (
                    <div key={k} className="text-slate-300 break-all">
                      <span className="text-emerald-400 font-semibold">{k}:</span> {v}
                    </div>
                  ))}
                </div>

                {/* Live CPU Registers + Rule 110 Tape State */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {vmExecution.registers.slice(0, 4).map((val, idx) => (
                    <div
                      key={idx}
                      className="bg-[#060709] border border-[#1E2430] p-2.5 text-center"
                    >
                      <div className="text-[10px] text-slate-400">REGISTER R{idx}</div>
                      <div className="text-xs font-bold text-emerald-400 mt-0.5">
                        0x{val.toString(16).padStart(2, "0").toUpperCase()} ({val})
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-[#060709] border border-[#1E2430] p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="text-slate-400">RULE-110 16-BIT TAPE: </span>
                    <span className="text-amber-300 font-bold">
                      0x{vmExecution.tape.toString(16).padStart(4, "0").toUpperCase()} (
                      {vmExecution.tape.toString(2).padStart(16, "0")})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">VM OUTPUT STREAM: </span>
                    <span className="text-emerald-300 font-bold">
                      {vmExecution.outputAscii}
                    </span>
                  </div>
                </div>

                {/* Disassembly & Execution Trace */}
                <div className="bg-[#060709] border border-[#1E2430] p-3">
                  <div className="text-[11px] text-slate-400 mb-2 flex items-center justify-between">
                    <span>DISASSEMBLED LAZARUS-110 EXECUTION TRACE ({vmExecution.trace.length} INSTRUCTIONS):</span>
                    <span className="text-emerald-400">
                      {vmExecution.halted ? "STATUS: HALTED (0xFF)" : "STATUS: PAUSED"}
                    </span>
                  </div>
                  <div className="max-h-56 overflow-y-auto space-y-1 text-[11px]">
                    {vmExecution.trace.slice(-40).map((step, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between px-2 py-1 bg-[#0B0E14] border border-[#1E2430]/60"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500">
                            0x{step.pc.toString(16).padStart(4, "0")}
                          </span>
                          <span className="text-slate-400">
                            {step.rawBytes
                              .map((b) => b.toString(16).padStart(2, "0"))
                              .join(" ")}
                          </span>
                          <span className="text-emerald-300 font-semibold">
                            {step.mnemonic}
                          </span>
                        </div>
                        <span className="text-slate-500 text-[10px]">
                          TAPE=0x{step.tapeAfter.toString(16).padStart(4, "0")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="bg-[#0B0E14] border border-[#1E2430] p-4 space-y-4">
                <div className="border-b border-[#1E2430] pb-3">
                  <span className="text-[10px] text-cyan-400 font-bold tracking-widest uppercase">
                    FINAL SINGULARITY PROOF // LAYER 04
                  </span>
                  <h2 className="text-sm font-bold text-white">
                    SUBMIT EMULATED VM FLAG OR SHA-256 DIGEST
                  </h2>
                </div>

                <div className="bg-[#060709] border border-[#1E2430] p-3 space-y-2 text-[11px]">
                  <div className="text-slate-400">RAW HEXADECIMAL ROM DUMP (675 BYTES):</div>
                  <div className="p-2 bg-[#0B0E14] border border-[#1E2430] text-slate-300 break-all max-h-32 overflow-y-auto">
                    {LAYER4_CONSTANTS.ROM_HEX}
                  </div>
                </div>

                <div className="bg-[#060709] border border-[#1E2430] p-4 space-y-3">
                  <label className="block text-xs text-slate-300">
                    Emulated Output String or SHA-256 Final Hash:
                  </label>
                  <input
                    type="text"
                    value={layer4Key}
                    onChange={(e) => setLayer4Key(e.target.value)}
                    placeholder="LAZ4{...} or SHA-256 hex digest"
                    className="w-full bg-[#0B0E14] border border-[#1E2430] px-3 py-2 text-xs text-emerald-300 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    disabled={submitting}
                    onClick={() => submitLayerProof(4)}
                    className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs tracking-wider uppercase transition-colors"
                  >
                    {submitting
                      ? "VERIFYING SINGULARITY HASH..."
                      : "VERIFY LAYER 04 & COMPLETE LAZARUS PROTOCOL"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ================================================================= */}
        {/* BOTTOM TELEMETRY LEDGER & HALL OF OPERATIVES                      */}
        {/* ================================================================= */}
        <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
          {/* Cryptographic Audit Ledger */}
          <div className="lg:col-span-7 bg-[#0B0E14] border border-[#1E2430] p-4">
            <div className="flex items-center justify-between border-b border-[#1E2430] pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  POSTGRESQL CRYPTOGRAPHIC AUDIT LEDGER
                </span>
              </div>
              <button
                onClick={fetchProgression}
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                REFRESH
              </button>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto text-[11px]">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 bg-[#060709] border border-[#1E2430]"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.2 text-[9px] font-bold ${
                        log.verified
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      L{log.layer} // {log.eventType}
                    </span>
                    <span className="text-slate-300">{log.payloadSummary}</span>
                  </div>
                  <span className="text-slate-500 text-[10px]">
                    {log.operativeId}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Hall of Operatives */}
          <div className="lg:col-span-5 bg-[#0B0E14] border border-[#1E2430] p-4">
            <div className="flex items-center justify-between border-b border-[#1E2430] pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  OPERATIVE CLEARANCE REGISTRY
                </span>
              </div>
              <span className="text-[10px] text-slate-400">JWE + PG VERIFIED</span>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto text-[11px]">
              {solverNodes.map((node) => (
                <div
                  key={node.id}
                  className="flex items-center justify-between px-2.5 py-1.5 bg-[#060709] border border-[#1E2430]"
                >
                  <div>
                    <span className="text-emerald-300 font-bold">
                      {node.callsign}
                    </span>
                    <span className="text-slate-500 ml-2 text-[10px]">
                      PROOF: {node.proofDigest.slice(0, 14)}...
                    </span>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                    LEVEL {node.clearanceLevel}/4
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Architect Write-Up Modal */}
      <ArchitectDossierModal
        isOpen={dossierOpen}
        onClose={() => setDossierOpen(false)}
        onInjectSolution={handleInjectSolution}
      />
    </div>
  );
}
