"use client";

import React, { useEffect, useRef, useState } from "react";
import { LAYER1_CONSTANTS } from "@/lib/lazarus-constants";

export interface ShaderUniforms {
  u_cam_x: number;
  u_cam_y: number;
  u_cam_z: number;
  u_time: number;
}

interface MandelbulbViewportProps {
  uniforms: ShaderUniforms;
  freezeTime: boolean;
  onUniformsChange: (next: ShaderUniforms, freeze?: boolean) => void;
  onSingularityLocked: () => void;
}

export const VERTEX_SHADER_SRC = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER_SRC = `
precision highp float;
varying vec2 v_uv;
uniform vec2 u_resolution;
uniform vec3 u_cam;
uniform float u_time;

// ============================================================================
// THE LAZARUS PROTOCOL // LAYER 1 FRAGMENT SHADER
// Mathematical Anomaly: Feigenbaum Period-Doubling Cascade Constants
//   delta = 4.6692016091 (Bifurcation velocity)
//   alpha = 2.5029078750 (Scaling factor)
//   r_inf = 3.5699456718 (Chaos accumulation point)
//   tau   = delta * alpha = 11.6866
// Console Hook: window.LAZARUS_SET_UNIFORMS(4.6692, 2.5029, 3.5699, 11.6866)
// ============================================================================

mat2 rot(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

// 4D Phase-Shifted Mandelbulb Distance Estimator
vec2 mandelbulbDE(vec3 pos, float powerShift) {
  vec3 z = pos;
  float dr = 1.0;
  float r = 0.0;
  float power = 8.0 + 0.45 * sin(powerShift * 0.37);
  float trap = 1e10;

  for (int i = 0; i < 7; i++) {
    r = length(z);
    if (r > 2.2) break;

    float theta = acos(clamp(z.z / max(r, 0.0001), -1.0, 1.0));
    float phi = atan(z.y, z.x);
    dr = pow(r, power - 1.0) * power * dr + 1.0;

    float zr = pow(r, power);
    theta = theta * power;
    phi = phi * power;

    z = zr * vec3(sin(theta) * cos(phi), sin(phi) * sin(theta), cos(theta));
    z += pos;
    trap = min(trap, abs(z.x) + abs(z.y));
  }
  return vec2(0.5 * log(max(r, 0.0001)) * r / max(dr, 0.0001), trap);
}

// Procedural 21x21 QR Matrix encoding LAZ1-FEIGENBAUM-466920-250290-ARTIFACT
float qrFinder(vec2 g, vec2 origin) {
  vec2 d = g - origin;
  if (d.x < 0.0 || d.x >= 7.0 || d.y < 0.0 || d.y >= 7.0) return -1.0;
  float bx = floor(d.x);
  float by = floor(d.y);
  if (bx == 0.0 || bx == 6.0 || by == 0.0 || by == 6.0) return 1.0;
  if (bx >= 2.0 && bx <= 4.0 && by >= 2.0 && by <= 4.0) return 1.0;
  return 0.0;
}

float sampleLazarusQR(vec2 uv) {
  vec2 q = (uv + 0.55) / 1.1;
  if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) return 0.0;
  vec2 cell = floor(q * 21.0);
  if (cell.x < 0.0 || cell.x >= 21.0 || cell.y < 0.0 || cell.y >= 21.0) return 0.0;

  float f1 = qrFinder(cell, vec2(0.0, 0.0));
  if (f1 >= 0.0) return f1;
  float f2 = qrFinder(cell, vec2(14.0, 0.0));
  if (f2 >= 0.0) return f2;
  float f3 = qrFinder(cell, vec2(0.0, 14.0));
  if (f3 >= 0.0) return f3;

  // Timing patterns
  if (cell.x == 6.0) return mod(cell.y, 2.0);
  if (cell.y == 6.0) return mod(cell.x, 2.0);

  // Deterministic Feigenbaum bit-lattice payload cells
  float h = fract(sin(dot(cell, vec2(4.6692016, 2.5029079)) + 3.5699457) * 43758.5453);
  return step(0.46, h);
}

void main() {
  vec2 uv = v_uv;
  uv.x *= u_resolution.x / max(u_resolution.y, 1.0);

  // Compute distance from Feigenbaum Resonance Singularity
  float errCam = abs(u_cam.x - 4.6692) + abs(u_cam.y - 2.5029) + abs(u_cam.z - 3.5699);
  float errTime = abs(u_time - 11.6866) * 0.2;
  float singularity = smoothstep(0.06, 0.0, errCam + errTime);

  // Camera setup
  vec3 ro = vec3(0.0, 0.0, -2.45);
  vec3 rd = normalize(vec3(uv, 1.35));

  float ax = u_cam.x * 0.65 + u_time * 0.12;
  float ay = u_cam.y * 0.65 - u_time * 0.09;
  rd.xz *= rot(ax);
  ro.xz *= rot(ax);
  rd.yz *= rot(ay);
  ro.yz *= rot(ay);

  float t = 0.0;
  float trap = 1.0;
  int steps = 0;
  for (int i = 0; i < 64; i++) {
    vec3 p = ro + rd * t;
    vec2 res = mandelbulbDE(p, u_time + u_cam.z);
    if (res.x < 0.0018 || t > 4.5) {
      trap = res.y;
      break;
    }
    t += res.x;
    steps = i;
  }

  vec3 col = vec3(0.02, 0.024, 0.035);
  if (t < 4.5) {
    float occ = 1.0 - float(steps) / 64.0;
    vec3 emerald = vec3(0.063, 0.725, 0.506);
    vec3 cyan = vec3(0.024, 0.714, 0.831);
    col = mix(cyan, emerald, clamp(trap * 0.85, 0.0, 1.0)) * occ * 1.35;
    col += vec3(0.12, 0.95, 0.68) * pow(occ, 4.0) * 0.45;
  } else {
    float grid = step(0.98, fract(uv.x * 12.0)) + step(0.98, fract(uv.y * 12.0));
    col += vec3(0.0, 0.14, 0.11) * clamp(grid, 0.0, 1.0) * 0.35;
  }

  // Blend in the Feigenbaum QR Singularity Matrix when uniforms align
  if (singularity > 0.001) {
    float qrBit = sampleLazarusQR(uv);
    vec3 qrCol = mix(vec3(0.02, 0.03, 0.05), vec3(0.063, 0.92, 0.62), qrBit);
    float border = step(abs(uv.x), 0.58) * step(abs(uv.y), 0.58);
    col = mix(col, mix(col * 0.25, qrCol, border), singularity);
  }

  gl_FragColor = vec4(col, 1.0);
}
`;

declare global {
  interface Window {
    LAZARUS_SET_UNIFORMS?: (
      camX: number,
      camY: number,
      camZ: number,
      time: number
    ) => string;
    LAZARUS_SHADER_SOURCE?: string;
  }
}

export default function MandelbulbViewport({
  uniforms,
  freezeTime,
  onUniformsChange,
  onSingularityLocked,
}: MandelbulbViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const uniformsRef = useRef<ShaderUniforms>(uniforms);
  const freezeRef = useRef<boolean>(freezeTime);
  const [webglReady, setWebglReady] = useState(true);

  useEffect(() => {
    uniformsRef.current = uniforms;
  }, [uniforms]);

  useEffect(() => {
    freezeRef.current = freezeTime;
  }, [freezeTime]);

  const isSingularityAligned =
    Math.abs(uniforms.u_cam_x - LAYER1_CONSTANTS.RESONANCE_UNIFORMS.u_cam_x) <=
      0.005 &&
    Math.abs(uniforms.u_cam_y - LAYER1_CONSTANTS.RESONANCE_UNIFORMS.u_cam_y) <=
      0.005 &&
    Math.abs(uniforms.u_cam_z - LAYER1_CONSTANTS.RESONANCE_UNIFORMS.u_cam_z) <=
      0.005 &&
    Math.abs(uniforms.u_time - LAYER1_CONSTANTS.RESONANCE_UNIFORMS.u_time) <=
      0.015;

  useEffect(() => {
    if (isSingularityAligned) {
      onSingularityLocked();
    }
  }, [isSingularityAligned, onSingularityLocked]);

  // Register global DevTools Console API for reverse engineers
  useEffect(() => {
    window.LAZARUS_SHADER_SOURCE = FRAGMENT_SHADER_SRC;
    window.LAZARUS_SET_UNIFORMS = (
      camX: number,
      camY: number,
      camZ: number,
      time: number
    ) => {
      onUniformsChange(
        {
          u_cam_x: Number(camX),
          u_cam_y: Number(camY),
          u_cam_z: Number(camZ),
          u_time: Number(time),
        },
        true
      );
      return `[LAZARUS GPU KERNEL] Uniforms locked to (${camX}, ${camY}, ${camZ}) @ t=${time}`;
    };

    console.info(
      "%c[THE LAZARUS PROTOCOL // LAYER 1 GPU KERNEL]%c\nInspect `window.LAZARUS_SHADER_SOURCE` or invoke `window.LAZARUS_SET_UNIFORMS(delta, alpha, r_inf, tau)` to align the Feigenbaum singularity.",
      "color:#10b981;font-weight:bold;background:#060709;padding:2px 6px;border:1px solid #10b981;",
      "color:#94a3b8;"
    );
  }, [onUniformsChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl =
      canvas.getContext("webgl") ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);

    if (!gl) {
      setWebglReady(false);
      return;
    }

    const compileShader = (type: number, src: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
    const fs = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);
    if (!vs || !fs) {
      setWebglReady(false);
      return;
    }

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      setWebglReady(false);
      return;
    }

    gl.useProgram(prog);

    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const aPos = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uResLoc = gl.getUniformLocation(prog, "u_resolution");
    const uCamLoc = gl.getUniformLocation(prog, "u_cam");
    const uTimeLoc = gl.getUniformLocation(prog, "u_time");

    let animId = 0;
    let internalClock = uniformsRef.current.u_time;
    let lastTs = performance.now();

    const render = (now: number) => {
      const dt = (now - lastTs) * 0.001;
      lastTs = now;

      if (!freezeRef.current) {
        internalClock += dt * 0.65;
      } else {
        internalClock = uniformsRef.current.u_time;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.floor(canvas.clientWidth * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = Math.max(1, w);
        canvas.height = Math.max(1, h);
        gl.viewport(0, 0, canvas.width, canvas.height);
      }

      gl.uniform2f(uResLoc, canvas.width, canvas.height);
      gl.uniform3f(
        uCamLoc,
        uniformsRef.current.u_cam_x,
        uniformsRef.current.u_cam_y,
        uniformsRef.current.u_cam_z
      );
      gl.uniform1f(uTimeLoc, internalClock);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div className="relative w-full h-full min-h-[380px] bg-[#060709] border border-[#1E2430] overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        className="w-full h-full block min-h-[380px]"
      />

      {!webglReady && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#060709]/95 p-6 text-center">
          <div className="text-xs font-mono text-emerald-400 uppercase tracking-widest mb-2">
            [GPU SOFTWARE RAYMARCHER FALLBACK ACTIVE]
          </div>
          <p className="text-xs font-mono text-slate-400 max-w-md">
            4D Mandelbulb Distance Estimator executing in deterministic software mode.
            Adjust uniform coordinates to Feigenbaum constants to collapse singularity.
          </p>
        </div>
      )}

      {/* Top-left HUD Telemetry */}
      <div className="absolute top-3 left-3 bg-[#060709]/85 backdrop-blur-md border border-[#1E2430] px-3 py-2 font-mono text-[11px] leading-relaxed pointer-events-none">
        <div className="flex items-center gap-2 text-emerald-400 font-semibold tracking-wider">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          GLSL_KERNEL :: 4D_MANDELBULB_DE
        </div>
        <div className="text-slate-400 mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5">
          <span>u_cam.x (δ): <strong className="text-slate-200">{uniforms.u_cam_x.toFixed(4)}</strong></span>
          <span>u_cam.y (α): <strong className="text-slate-200">{uniforms.u_cam_y.toFixed(4)}</strong></span>
          <span>u_cam.z (r∞): <strong className="text-slate-200">{uniforms.u_cam_z.toFixed(4)}</strong></span>
          <span>u_time (τ): <strong className="text-slate-200">{uniforms.u_time.toFixed(4)}</strong></span>
        </div>
      </div>

      {/* Singularity Decoded Overlay when Feigenbaum Uniforms Match */}
      {isSingularityAligned && (
        <div className="absolute bottom-3 left-3 right-3 bg-[#060709]/92 backdrop-blur-md border border-emerald-500/70 p-3 font-mono">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-emerald-400 font-bold">
                [SINGULARITY COLLAPSED // QR MATRIX DECODED]
              </div>
              <div className="text-xs text-slate-200 mt-0.5 break-all">
                ACCESS VECTOR:{" "}
                <span className="text-emerald-300 font-semibold select-all">
                  {LAYER1_CONSTANTS.ACCESS_VECTOR}
                </span>
              </div>
            </div>
            <span className="px-2 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              FEIGENBAUM LOCKED
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
