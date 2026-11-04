#!/usr/bin/env python3
"""
THE LAZARUS PROTOCOL — Master Cryptographic Asset & Polyglot Generator
Generates:
  1. public/artifact.png  — True Tri-Polyglot (Valid PNG + Embedded PDF-1.5 + Valid ZIP Archive)
  2. public/oracle.wasm   — Spec-compliant WebAssembly binary for Layer 2 Z3 SMT Challenge
  3. public/layer4_rom.bin — Bytecode ROM for Layer 4 LAZARUS-110 Esoteric VM
  4. scripts/verify_all_layers.json — Exact cryptographic constants and exploit verification vectors
"""

import hashlib
import hmac
import io
import json
import math
import os
import struct
import zlib
import zipfile

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
os.makedirs(PUBLIC_DIR, exist_ok=True)

# ============================================================================
# LAYER 1: FEIGENBAUM CONSTANTS & ACCESS VECTOR
# ============================================================================
FEIGENBAUM_DELTA = 4.66920160910299067185320382
FEIGENBAUM_ALPHA = 2.50290787509589282228390287
FEIGENBAUM_R_INF = 3.56994567187094490184215115
FEIGENBAUM_TIME = round(FEIGENBAUM_DELTA * FEIGENBAUM_ALPHA, 4)  # 11.6866
LAYER1_FLAG = "LAZ1-FEIGENBAUM-466920-250290-ARTIFACT"


# ============================================================================
# LAYER 2: 32-BYTE KEY & COUPLED NON-LINEAR / MATRIX EQUATION SYSTEM (WASM + Z3)
# ============================================================================
# Target 32-byte key: "LAZ2{Z3_SMT_M4TR1X_W4SM_0R4CL3!}" (exact 32 bytes)
LAYER2_KEY_ASCII = "LAZ2{Z3_SMT_M4TR1X_W4SM_0R4CL3!}"
LAYER2_KEY_BYTES = list(LAYER2_KEY_ASCII.encode("ascii"))
assert len(LAYER2_KEY_BYTES) == 32, f"Expected 32 bytes, got {len(LAYER2_KEY_BYTES)}"

# For each index i in 0..31, define an equation:
#   E_i(b) = ( ((b[i] ^ b[(i + 5) % 32]) + (b[(i + 12) % 32] * M1[i])) ^ ((b[(i + 19) % 32] + K_XOR[i]) * M2[i]) ) & 0xFFFF
# Wait: to make it super clean in both 32-bit Wasm and Z3 BitVec(32) while strictly uniquely
# determining b[0..31], let's use two families of equations across the 32 indices:
#   For i in 0..31:
#     term1 = (b[i] ^ b[(i + 5) % 32])
#     term2 = b[(i + 12) % 32] * (2 * (i % 7) + 3)
#     term3 = (b[(i + 23) % 32] ^ (0xA5 ^ (i * 7))) * (2 * (i % 5) + 1)
#     eq_A[i] = (term1 + term2 + term3) & 0xFFFF
#     eq_B[i] = (((b[i] * (2 * i + 1)) ^ b[(i + 1) % 32]) + (b[(i + 7) % 32] ^ b[(i + 15) % 32])) & 0xFFFF
# Notice that inside verify_key(ptr), checking BOTH eq_A[i] == TARGET_A[i] and eq_B[i] == TARGET_B[i]
# for all i in 0..31 gives 64 coupled algebraic equations over 32 bytes, guaranteeing a strictly
# unique solution in Z3 over 8-bit bytes!

M1 = [2 * (i % 7) + 3 for i in range(32)]
M2 = [2 * (i % 5) + 1 for i in range(32)]
K_MASK = [(0xA5 ^ (i * 7)) & 0xFF for i in range(32)]
ODD_MUL = [2 * i + 1 for i in range(32)]

TARGET_A = []
TARGET_B = []
for i in range(32):
    b_i = LAYER2_KEY_BYTES[i]
    b_5 = LAYER2_KEY_BYTES[(i + 5) % 32]
    b_12 = LAYER2_KEY_BYTES[(i + 12) % 32]
    b_23 = LAYER2_KEY_BYTES[(i + 23) % 32]
    b_1 = LAYER2_KEY_BYTES[(i + 1) % 32]
    b_7 = LAYER2_KEY_BYTES[(i + 7) % 32]
    b_15 = LAYER2_KEY_BYTES[(i + 15) % 32]

    t1 = b_i ^ b_5
    t2 = b_12 * M1[i]
    t3 = (b_23 ^ K_MASK[i]) * M2[i]
    eq_a = (t1 + t2 + t3) & 0xFFFF
    TARGET_A.append(eq_a)

    eq_b = (((b_i * ODD_MUL[i]) & 0xFFFF) ^ b_1) + (b_7 ^ b_15)
    TARGET_B.append(eq_b & 0xFFFF)


def encode_uleb128(value: int) -> bytes:
    out = bytearray()
    while True:
        byte = value & 0x7F
        value >>= 7
        if value != 0:
            byte |= 0x80
        out.append(byte)
        if value == 0:
            break
    return bytes(out)


def encode_sleb128(value: int) -> bytes:
    out = bytearray()
    more = True
    while more:
        byte = value & 0x7F
        value >>= 7
        if (value == 0 and (byte & 0x40) == 0) or (value == -1 and (byte & 0x40) != 0):
            more = False
        else:
            byte |= 0x80
        out.append(byte)
    return bytes(out)


def wasm_section(section_id: int, payload: bytes) -> bytes:
    return bytes([section_id]) + encode_uleb128(len(payload)) + payload


def build_oracle_wasm() -> bytes:
    """
    Constructs a 100% valid, spec-compliant WebAssembly binary (`public/oracle.wasm`).
    Exports:
      - memory (1 page = 64 KiB)
      - verify_key(ptr: i32) -> i32   (returns 1 if all 32 constraints match, 0 otherwise)
      - count_satisfied(ptr: i32) -> i32 (returns 0..32 satisfied byte equation pairs)
    """
    # Type section:
    # type 0: (i32) -> (i32)
    type_0 = b"\x60\x01\x7f\x01\x7f"
    type_sec_payload = encode_uleb128(1) + type_0
    type_sec = wasm_section(1, type_sec_payload)

    # Function section: 2 functions (func 0 = count_satisfied, func 1 = verify_key), both type 0
    func_sec_payload = encode_uleb128(2) + encode_uleb128(0) + encode_uleb128(0)
    func_sec = wasm_section(3, func_sec_payload)

    # Memory section: 1 memory with min=1 page, max=2 pages
    mem_sec_payload = encode_uleb128(1) + b"\x01" + encode_uleb128(1) + encode_uleb128(2)
    mem_sec = wasm_section(5, mem_sec_payload)

    # Export section:
    # - "memory" (kind 2, index 0)
    # - "count_satisfied" (kind 0, index 0)
    # - "verify_key" (kind 0, index 1)
    def encode_export(name: str, kind: int, idx: int) -> bytes:
        nb = name.encode("utf-8")
        return encode_uleb128(len(nb)) + nb + bytes([kind]) + encode_uleb128(idx)

    exp_payload = (
        encode_uleb128(3)
        + encode_export("memory", 2, 0)
        + encode_export("count_satisfied", 0, 0)
        + encode_export("verify_key", 0, 1)
    )
    exp_sec = wasm_section(7, exp_payload)

    # Build Function 0 body: count_satisfied(ptr: i32) -> i32
    # Locals: local 0 is parameter `ptr: i32`
    # local 1 is `score: i32` (initialized to 0)
    # local 2 is `cond_a: i32`
    f0_locals = encode_uleb128(1) + encode_uleb128(2) + b"\x7f"  # 2 locals of type i32

    def load_u8(offset: int) -> bytes:
        # local.get 0 (ptr), i32.load8_u align=0 offset=offset
        return b"\x20\x00\x2d\x00" + encode_uleb128(offset)

    def i32_const(val: int) -> bytes:
        return b"\x41" + encode_sleb128(val)

    f0_instrs = bytearray()
    # Initialize local 1 (score) = 0
    f0_instrs += i32_const(0) + b"\x21\x01"  # local.set 1

    for i in range(32):
        # Compute eq_A[i]:
        # ((b[i] ^ b[(i+5)%32]) + (b[(i+12)%32] * M1[i]) + ((b[(i+23)%32] ^ K_MASK[i]) * M2[i])) & 0xFFFF == TARGET_A[i]
        expr_a = bytearray()
        expr_a += load_u8(i)
        expr_a += load_u8((i + 5) % 32)
        expr_a += b"\x73"  # i32.xor

        expr_a += load_u8((i + 12) % 32)
        expr_a += i32_const(M1[i])
        expr_a += b"\x6c"  # i32.mul
        expr_a += b"\x6a"  # i32.add

        expr_a += load_u8((i + 23) % 32)
        expr_a += i32_const(K_MASK[i])
        expr_a += b"\x73"  # i32.xor
        expr_a += i32_const(M2[i])
        expr_a += b"\x6c"  # i32.mul
        expr_a += b"\x6a"  # i32.add

        expr_a += i32_const(0xFFFF)
        expr_a += b"\x71"  # i32.and
        expr_a += i32_const(TARGET_A[i])
        expr_a += b"\x46"  # i32.eq

        # Compute eq_B[i]:
        # ((((b[i] * ODD_MUL[i]) & 0xFFFF) ^ b[(i+1)%32]) + (b[(i+7)%32] ^ b[(i+15)%32])) & 0xFFFF == TARGET_B[i]
        expr_b = bytearray()
        expr_b += load_u8(i)
        expr_b += i32_const(ODD_MUL[i])
        expr_b += b"\x6c"  # i32.mul
        expr_b += i32_const(0xFFFF)
        expr_b += b"\x71"  # i32.and
        expr_b += load_u8((i + 1) % 32)
        expr_b += b"\x73"  # i32.xor

        expr_b += load_u8((i + 7) % 32)
        expr_b += load_u8((i + 15) % 32)
        expr_b += b"\x73"  # i32.xor
        expr_b += b"\x6a"  # i32.add

        expr_b += i32_const(0xFFFF)
        expr_b += b"\x71"  # i32.and
        expr_b += i32_const(TARGET_B[i])
        expr_b += b"\x46"  # i32.eq

        # Both eq_A[i] and eq_B[i] must hold (i32.and), then add 1 to score (local 1)
        f0_instrs += b"\x20\x01"  # local.get 1 (score)
        f0_instrs += expr_a
        f0_instrs += expr_b
        f0_instrs += b"\x71"  # i32.and (1 if both hold else 0)
        f0_instrs += b"\x6a"  # i32.add
        f0_instrs += b"\x21\x01"  # local.set 1

    # Return local 1 (score)
    f0_instrs += b"\x20\x01\x0b"  # local.get 1, end
    f0_body = f0_locals + bytes(f0_instrs)

    # Function 1 body: verify_key(ptr: i32) -> i32
    # Calls count_satisfied(ptr) == 32
    f1_locals = encode_uleb128(0)
    f1_instrs = b"\x20\x00\x10\x00" + i32_const(32) + b"\x46\x0b"  # local.get 0, call 0, i32.const 32, i32.eq, end
    f1_body = f1_locals + f1_instrs

    code_sec_payload = (
        encode_uleb128(2)
        + encode_uleb128(len(f0_body))
        + f0_body
        + encode_uleb128(len(f1_body))
        + f1_body
    )
    code_sec = wasm_section(10, code_sec_payload)

    wasm_magic = b"\x00asm\x01\x00\x00\x00"
    return wasm_magic + type_sec + func_sec + mem_sec + exp_sec + code_sec


# ============================================================================
# LAYER 3: SECP256K1 ECDSA NONCE REUSE ATTACK MATH & EXPLOIT VECTORS
# ============================================================================
SECP_P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
SECP_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
SECP_GX = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798
SECP_GY = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8


def ec_inv(a: int, m: int) -> int:
    return pow(a % m, m - 2, m)


def ec_add(p1, p2):
    if p1 is None:
        return p2
    if p2 is None:
        return p1
    x1, y1 = p1
    x2, y2 = p2
    if x1 == x2 and (y1 + y2) % SECP_P == 0:
        return None
    if x1 == x2 and y1 == y2:
        lam = (3 * x1 * x1 * ec_inv(2 * y1, SECP_P)) % SECP_P
    else:
        lam = ((y2 - y1) * ec_inv(x2 - x1, SECP_P)) % SECP_P
    x3 = (lam * lam - x1 - x2) % SECP_P
    y3 = (lam * (x1 - x3) - y1) % SECP_P
    return (x3, y3)


def ec_mul(k: int, point=(SECP_GX, SECP_GY)):
    result = None
    addend = point
    k = k % SECP_N
    while k > 0:
        if k & 1:
            result = ec_add(result, addend)
        addend = ec_add(addend, addend)
        k >>= 1
    return result


# Server's deterministic secp256k1 private key d_A
SERVER_PRIV_KEY = int.from_bytes(
    hashlib.sha256(b"LAZARUS_PROTOCOL_SECP256K1_MASTER_KEY_V1").digest(), "big"
) % SECP_N
SERVER_PUB_POINT = ec_mul(SERVER_PRIV_KEY)


def derive_vulnerable_nonce(x_timestamp: str, message: str) -> int:
    """
    If X-Timestamp is provided, the vulnerable oracle derives k deterministically
     SOLELY from X-Timestamp (ignoring the message!), recreating the famous Sony PS3
    / RFC-misimplementation ECDSA Nonce Reuse vulnerability.
    """
    digest = hmac.new(
        b"SONY_PS3_LAZARUS_ENTROPY_SEED_2026",
        x_timestamp.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    return (int.from_bytes(digest, "big") % (SECP_N - 1)) + 1


def ecdsa_sign_raw(message: str, x_timestamp: str = "1337000000"):
    z = int.from_bytes(hashlib.sha256(message.encode("utf-8")).digest(), "big") % SECP_N
    k = derive_vulnerable_nonce(x_timestamp, message)
    R = ec_mul(k)
    r = R[0] % SECP_N
    s = (ec_inv(k, SECP_N) * (z + r * SERVER_PRIV_KEY)) % SECP_N
    return {"message": message, "z": z, "k": k, "r": r, "s": s}


# Compute reference exploit vectors for Layer 3
SIG1 = ecdsa_sign_raw("PROBE_ALPHA_01", "1337000000")
SIG2 = ecdsa_sign_raw("PROBE_BETA_02", "1337000000")
assert SIG1["r"] == SIG2["r"], "Shared timestamp must produce identical r"

# Recover k and d_A from (r, s1, z1) and (r, s2, z2):
r_shared = SIG1["r"]
k_recovered = ((SIG1["z"] - SIG2["z"]) * ec_inv(SIG1["s"] - SIG2["s"], SECP_N)) % SECP_N
d_recovered = ((SIG1["s"] * k_recovered - SIG1["z"]) * ec_inv(r_shared, SECP_N)) % SECP_N
assert k_recovered == SIG1["k"], "Recovered nonce k must match!"
assert d_recovered == SERVER_PRIV_KEY, "Recovered private key d_A must match!"

# Forge signature for target message "EXECUTE_PROTOCOL_OMEGA"
OMEGA_MSG = "EXECUTE_PROTOCOL_OMEGA"
OMEGA_SIG = ecdsa_sign_raw(OMEGA_MSG, "1337000000")


# ============================================================================
# LAYER 4: ESOTERIC VM (RULE-110 + BALANCED/MODULAR TERNARY) ROM GENERATOR
# ============================================================================
LAYER4_FLAG = "LAZ4{RUL3_110_T3RN4RY_0M3G4}"
LAYER4_FLAG_HASH = hashlib.sha256(LAYER4_FLAG.encode("utf-8")).hexdigest()


def rule110_step_16(tape: int, steps: int) -> int:
    for _ in range(steps):
        next_tape = 0
        for bit in range(16):
            left = (tape >> ((bit + 1) % 16)) & 1
            center = (tape >> bit) & 1
            right = (tape >> ((bit + 15) % 16)) & 1
            pattern = (left << 2) | (center << 1) | right
            new_bit = (0b01101110 >> pattern) & 1
            next_tape |= new_bit << bit
        tape = next_tape
    return tape


def trit_op_u8(a: int, b: int) -> int:
    res = 0
    pow3 = 1
    for _ in range(6):
        ta = (a // pow3) % 3
        tb = (b // pow3) % 3
        res += ((ta + tb) % 3) * pow3
        pow3 *= 3
    return res & 0xFF


def rol8(val: int, shift: int) -> int:
    shift &= 7
    return ((val << shift) | (val >> (8 - shift))) & 0xFF


def build_layer4_rom() -> bytes:
    """
    Synthesizes the deterministic 3-byte-per-instruction ROM program for LAZARUS-110 VM.
    Each character of LAYER4_FLAG ("LAZ4{RUL3_110_T3RN4RY_0M3G4}") is computed dynamically
    using Rule 110 cellular automaton steps (`0x05`), Ternary modular addition (`0x06`),
    8-bit rotation (`0x04`), XOR (`0x02`), ADD (`0x03`), and EMIT (`0x07`).
    """
    rom = bytearray()
    tape = 0xB6D3  # Initial 16-bit Rule-110 seed state

    for idx, ch in enumerate(LAYER4_FLAG.encode("ascii")):
        steps = (idx % 3) + 1
        # 1. Step Rule 110 into R1: opcode 0x05, reg=1, steps=steps
        rom += bytes([0x05, 0x01, steps])
        tape = rule110_step_16(tape, steps)
        r1 = (tape & 0xFF) ^ ((tape >> 8) & 0xFF)

        # 2. Load immediate seed into R2: opcode 0x01, reg=2, imm=(idx * 17 + 0x39) & 0xFF
        imm_seed = (idx * 17 + 0x39) & 0xFF
        rom += bytes([0x01, 0x02, imm_seed])
        r2 = imm_seed

        # 3. Ternary operation on R1 with R2: opcode 0x06, dst=1, src=2
        rom += bytes([0x06, 0x01, 0x02])
        r1 = trit_op_u8(r1, r2)

        # 4. Rotate R1 left by (idx % 5 + 1): opcode 0x04, reg=1, shift=(idx % 5 + 1)
        shift = (idx % 5) + 1
        rom += bytes([0x04, 0x01, shift])
        r1 = rol8(r1, shift)

        # 5. Compute required keystream delta so R0 ^ R1 == ch:
        # Load R0 with (ch ^ r1 - idx) & 0xFF, then ADD idx, then XOR R0, R1, then EMIT R0
        pre_add = ((ch ^ r1) - idx) & 0xFF
        rom += bytes([0x01, 0x00, pre_add])  # LDI R0, pre_add
        rom += bytes([0x03, 0x00, idx & 0xFF])  # ADD R0, idx
        rom += bytes([0x02, 0x00, 0x01])  # XOR R0, R1
        rom += bytes([0x07, 0x00, 0x00])  # EMIT R0

    # HALT instruction
    rom += bytes([0xFF, 0x00, 0x00])
    return bytes(rom)


def emulate_layer4_rom(rom: bytes) -> str:
    regs = [0] * 8
    tape = 0xB6D3
    out = bytearray()
    pc = 0
    while pc + 3 <= len(rom):
        op, a, b = rom[pc], rom[pc + 1], rom[pc + 2]
        pc += 3
        if op == 0x01:
            regs[a & 7] = b & 0xFF
        elif op == 0x02:
            regs[a & 7] = (regs[a & 7] ^ regs[b & 7]) & 0xFF
        elif op == 0x03:
            regs[a & 7] = (regs[a & 7] + b) & 0xFF
        elif op == 0x04:
            regs[a & 7] = rol8(regs[a & 7], b)
        elif op == 0x05:
            tape = rule110_step_16(tape, b)
            regs[a & 7] = (tape & 0xFF) ^ ((tape >> 8) & 0xFF)
        elif op == 0x06:
            regs[a & 7] = trit_op_u8(regs[a & 7], regs[b & 7])
        elif op == 0x07:
            out.append(regs[a & 7])
        elif op == 0xFF:
            break
        else:
            raise ValueError(f"Unknown opcode: 0x{op:02X}")
    return out.decode("ascii")


# ============================================================================
# POLYGLOT GENERATOR (PNG + PDF + ZIP) -> public/artifact.png
# ============================================================================
def make_png_chunk(chunk_type: bytes, data: bytes) -> bytes:
    crc = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", crc)


def build_minimal_pdf(rom_hex: str) -> bytes:
    """Builds a valid standalone PDF-1.5 specification sheet for THE LAZARUS PROTOCOL."""
    text_lines = [
        "THE LAZARUS PROTOCOL // CLASSIFIED ARCHITECT SPECIFICATION",
        f"LAYER 1 VECTOR: {LAYER1_FLAG}",
        "FEIGENBAUM UNIFORMS: u_cam=(4.6692, 2.5029, 3.5699), u_time=11.6866",
        "LAYER 2 ORACLE: 32-BYTE KEY SOLVABLE VIA Z3 SMT SOLVER ON /oracle.wasm",
        "LAYER 3 ORACLE: SECP256K1 ECDSA NONCE REUSE VIA IDENTICAL X-Timestamp",
        "LAYER 4 VM ISA: 01=LDI 02=XOR 03=ADD 04=ROL 05=R110 06=TRIT 07=EMIT FF=HALT",
        f"LAYER 4 ROM DUMP (FIRST 48 BYTES): {rom_hex[:96]}...",
    ]
    stream_ops = ["BT", "/F1 10 Tf", "36 740 Td", "14 TL"]
    for line in text_lines:
        escaped = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        stream_ops.append(f"({escaped}) Tj T*")
    stream_ops.append("ET")
    stream_bytes = "\n".join(stream_ops).encode("ascii")

    pdf = (
        b"%PDF-1.5\n"
        b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
        b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n"
        + f"4 0 obj << /Length {len(stream_bytes)} >> stream\n".encode("ascii")
        + stream_bytes
        + b"\nendstream endobj\n"
        b"5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier >> endobj\n"
        b"xref\n0 6\n0000000000 65535 f \n"
        b"trailer << /Size 6 /Root 1 0 R >>\n"
        b"%%EOF\n"
    )
    return pdf


def build_polyglot_artifact(rom_bytes: bytes, wasm_bytes: bytes) -> bytes:
    """
    Creates `public/artifact.png` as a true tri-format polyglot:
      1. Valid 256x256 RGB PNG image with Feigenbaum phase-space interference pattern
         and LSB steganography encoding the Layer 1 access vector.
      2. Embedded `%PDF-1.5` document inside a custom `pDFh` ancillary chunk before IDAT.
      3. Valid ZIP archive appended after `IEND` containing:
           - manifest.txt
           - oracle_constraints.smt2
           - layer4_rom.bin
           - isa_spec.pdf
    """
    width, height = 256, 256
    stego_message = (
        f"LAZARUS_ARTIFACT_STEGO::{LAYER1_FLAG}::"
        f"DELTA={FEIGENBAUM_DELTA:.6f}::ALPHA={FEIGENBAUM_ALPHA:.6f}::"
        f"R_INF={FEIGENBAUM_R_INF:.6f}::TIME={FEIGENBAUM_TIME}\0"
    ).encode("ascii")
    stego_bits = []
    for byte in stego_message:
        for b in range(7, -1, -1):
            stego_bits.append((byte >> b) & 1)

    raw_scanlines = bytearray()
    bit_idx = 0
    for y in range(height):
        raw_scanlines.append(0)  # Filter type 0 (None)
        for x in range(width):
            # Generate cryptographic Feigenbaum / Lorenz interference pattern
            nx = (x - 128) / 64.0
            ny = (y - 128) / 64.0
            r_val = int((math.sin(nx * FEIGENBAUM_DELTA + ny * FEIGENBAUM_ALPHA) * 0.5 + 0.5) * 40)
            g_val = int(
                (math.cos(nx * FEIGENBAUM_R_INF - ny * FEIGENBAUM_DELTA) * 0.5 + 0.5) * 210
            )
            b_val = int(((x ^ y) * 13) & 0x7F)
            # Grid crosshairs every 32px
            if x % 32 == 0 or y % 32 == 0:
                g_val = min(255, g_val + 45)
            # Embed LSB steganography in the Red channel
            if bit_idx < len(stego_bits):
                r_val = (r_val & 0xFE) | stego_bits[bit_idx]
                bit_idx += 1
            raw_scanlines.extend([r_val & 0xFF, g_val & 0xFF, b_val & 0xFF])

    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    pdf_bytes = build_minimal_pdf(rom_bytes.hex())
    text_meta = (
        f"Comment\x00LAZARUS_POLYGLOT_V1 | {LAYER1_FLAG} | "
        f"Run `unzip artifact.png` or `binwalk -e artifact.png` to extract Layer 2/4 payloads."
    ).encode("ascii")

    idat_data = zlib.compress(bytes(raw_scanlines), level=9)

    png_bytes = (
        b"\x89PNG\r\n\x1a\n"
        + make_png_chunk(b"IHDR", ihdr_data)
        + make_png_chunk(b"tEXt", text_meta)
        + make_png_chunk(b"pDFh", pdf_bytes)
        + make_png_chunk(b"IDAT", idat_data)
        + make_png_chunk(b"IEND", b"")
    )

    # Build the ZIP archive in memory
    smt2_lines = [
        "; THE LAZARUS PROTOCOL — Layer 2 SMT-LIBv2 Constraint Specification",
        "; Target: 32-byte key b[0..31] verified by /oracle.wasm",
        "(set-logic QF_BV)",
    ]
    for i in range(32):
        smt2_lines.append(
            f"; Index {i:02d}: M1={M1[i]}, M2={M2[i]}, K_MASK=0x{K_MASK[i]:02X}, "
            f"ODD_MUL={ODD_MUL[i]} -> TARGET_A=0x{TARGET_A[i]:04X}, TARGET_B=0x{TARGET_B[i]:04X}"
        )

    manifest_txt = f"""====================================================================
THE LAZARUS PROTOCOL // POLYGLOT ARTIFACT MANIFEST (STAGE 1 -> 4)
====================================================================
[1] LAYER 1 ACCESS VECTOR:
    {LAYER1_FLAG}

[2] GLSL 4D MANDELBULB SINGULARITY UNIFORMS (FEIGENBAUM CONSTANTS):
    u_cam_x (delta) = {FEIGENBAUM_DELTA:.4f}
    u_cam_y (alpha) = {FEIGENBAUM_ALPHA:.4f}
    u_cam_z (r_inf) = {FEIGENBAUM_R_INF:.4f}
    u_time  (d * a) = {FEIGENBAUM_TIME:.4f}

[3] PAYLOAD INVENTORY IN THIS POLYGLOT ARCHIVE:
    - manifest.txt            : This cryptographic briefing
    - oracle_constraints.smt2 : SMT-LIBv2 constants extracted from oracle.wasm
    - layer4_rom.bin          : Raw 8-bit/Rule-110/Ternary VM bytecode ROM
    - isa_spec.pdf            : Architectural specification sheet
====================================================================
"""

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("manifest.txt", manifest_txt)
        zf.writestr("oracle_constraints.smt2", "\n".join(smt2_lines) + "\n")
        zf.writestr("layer4_rom.bin", rom_bytes)
        zf.writestr("isa_spec.pdf", pdf_bytes)

    return png_bytes + zip_buf.getvalue()


def main():
    wasm_bytes = build_oracle_wasm()
    wasm_path = os.path.join(PUBLIC_DIR, "oracle.wasm")
    with open(wasm_path, "wb") as f:
        f.write(wasm_bytes)

    rom_bytes = build_layer4_rom()
    emulated_flag = emulate_layer4_rom(rom_bytes)
    assert emulated_flag == LAYER4_FLAG, f"ROM emulation mismatch: {emulated_flag}"

    rom_path = os.path.join(PUBLIC_DIR, "layer4_rom.bin")
    with open(rom_path, "wb") as f:
        f.write(rom_bytes)

    polyglot_bytes = build_polyglot_artifact(rom_bytes, wasm_bytes)
    artifact_path = os.path.join(PUBLIC_DIR, "artifact.png")
    with open(artifact_path, "wb") as f:
        f.write(polyglot_bytes)

    summary = {
        "layer1": {
            "flag": LAYER1_FLAG,
            "uniforms": {
                "u_cam_x": 4.6692,
                "u_cam_y": 2.5029,
                "u_cam_z": 3.5699,
                "u_time": 11.6866,
            },
            "artifact_size_bytes": len(polyglot_bytes),
        },
        "layer2": {
            "key_ascii": LAYER2_KEY_ASCII,
            "key_hex": bytes(LAYER2_KEY_BYTES).hex(),
            "wasm_size_bytes": len(wasm_bytes),
            "M1": M1,
            "M2": M2,
            "K_MASK": K_MASK,
            "ODD_MUL": ODD_MUL,
            "TARGET_A": TARGET_A,
            "TARGET_B": TARGET_B,
        },
        "layer3": {
            "curve": "secp256k1",
            "server_private_key_hex": hex(SERVER_PRIV_KEY),
            "server_public_key": {
                "x": hex(SERVER_PUB_POINT[0]),
                "y": hex(SERVER_PUB_POINT[1]),
            },
            "shared_timestamp": "1337000000",
            "reused_nonce_k_hex": hex(SIG1["k"]),
            "sig1": {
                "message": SIG1["message"],
                "z": hex(SIG1["z"]),
                "r": hex(SIG1["r"]),
                "s": hex(SIG1["s"]),
            },
            "sig2": {
                "message": SIG2["message"],
                "z": hex(SIG2["z"]),
                "r": hex(SIG2["r"]),
                "s": hex(SIG2["s"]),
            },
            "target_omega": {
                "message": OMEGA_MSG,
                "z": hex(OMEGA_SIG["z"]),
                "r": hex(OMEGA_SIG["r"]),
                "s": hex(OMEGA_SIG["s"]),
            },
        },
        "layer4": {
            "flag": LAYER4_FLAG,
            "flag_sha256": LAYER4_FLAG_HASH,
            "rom_hex": rom_bytes.hex(),
            "rom_size_bytes": len(rom_bytes),
        },
    }

    summary_path = os.path.join(ROOT_DIR, "scripts", "verify_all_layers.json")
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print("Successfully generated:")
    print(f"  - {artifact_path} ({len(polyglot_bytes)} bytes)")
    print(f"  - {wasm_path} ({len(wasm_bytes)} bytes)")
    print(f"  - {rom_path} ({len(rom_bytes)} bytes)")
    print(f"  - {summary_path}")


if __name__ == "__main__":
    main()
