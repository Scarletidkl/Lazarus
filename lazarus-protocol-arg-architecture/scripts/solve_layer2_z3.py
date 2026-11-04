#!/usr/bin/env python3
"""
THE LAZARUS PROTOCOL — Layer 2 Solver (Microsoft Z3 SMT Theorem Prover)
Decompiled from `public/oracle.wasm` (`verify_key` / `count_satisfied`).

Usage:
  pip install z3-solver
  python3 scripts/solve_layer2_z3.py
"""

M1 = [
    3, 5, 7, 9, 11, 13, 15, 3, 5, 7, 9, 11, 13, 15, 3, 5,
    7, 9, 11, 13, 15, 3, 5, 7, 9, 11, 13, 15, 3, 5, 7, 9,
]
M2 = [
    1, 3, 5, 7, 9, 1, 3, 5, 7, 9, 1, 3, 5, 7, 9, 1,
    3, 5, 7, 9, 1, 3, 5, 7, 9, 1, 3, 5, 7, 9, 1, 3,
]
K_MASK = [
    165, 162, 171, 176, 185, 134, 143, 148, 157, 154, 227, 232, 241, 254, 199, 204,
    213, 210, 219, 32, 41, 54, 63, 4, 13, 10, 19, 24, 97, 110, 119, 124,
]
ODD_MUL = [2 * i + 1 for i in range(32)]

TARGET_A = [
    503, 812, 1838, 1759, 2843, 1360, 2097, 1184,
    1931, 2532, 861, 1689, 1620, 2268, 1572, 692,
    1044, 1125, 1413, 2772, 1360, 667, 519, 929,
    1965, 1164, 961, 1795, 640, 1300, 643, 1008,
]

TARGET_B = [
    26, 251, 517, 304, 1041, 1126, 815, 1499,
    1499, 1508, 1733, 2351, 1989, 1440, 2614, 2635,
    1579, 3283, 3583, 3555, 2168, 3571, 3647, 4435,
    2436, 4225, 2707, 3639, 4428, 3094, 2062, 7926,
]


def solve_with_z3():
    from z3 import BitVec, Solver, sat, ZeroExt

    s = Solver()
    # 32 symbolic 8-bit bytes extended to 16-bit bitvectors for arithmetic
    b = [BitVec(f"b_{i}", 16) for i in range(32)]

    for i in range(32):
        # Constrain each byte to valid 8-bit printable ASCII range [0x20, 0x7E]
        s.add(b[i] >= 0x20, b[i] <= 0x7E)

        bi = b[i]
        b5 = b[(i + 5) % 32]
        b12 = b[(i + 12) % 32]
        b23 = b[(i + 23) % 32]
        b1 = b[(i + 1) % 32]
        b7 = b[(i + 7) % 32]
        b15 = b[(i + 15) % 32]

        eq_a = ((bi ^ b5) + (b12 * M1[i]) + ((b23 ^ K_MASK[i]) * M2[i])) & 0xFFFF
        eq_b = (((bi * ODD_MUL[i]) & 0xFFFF) ^ b1) + (b7 ^ b15)

        s.add(eq_a == TARGET_A[i])
        s.add((eq_b & 0xFFFF) == TARGET_B[i])

    if s.check() == sat:
        m = s.model()
        sol = bytes([m[b[i]].as_long() for i in range(32)])
        print("[+] Z3 SMT Solver Result (SAT):")
        print("    ASCII Key :", sol.decode("ascii"))
        print("    Hex Key   :", sol.hex())
        return sol
    else:
        raise RuntimeError("UNSAT")


if __name__ == "__main__":
    try:
        solve_with_z3()
    except ImportError:
        print("[!] z3-solver package not installed in current Python env; verifying target vector directly:")
        candidate = b"LAZ2{Z3_SMT_M4TR1X_W4SM_0R4CL3!}"
        for i in range(32):
            bi = candidate[i]
            eq_a = ((bi ^ candidate[(i + 5) % 32]) + candidate[(i + 12) % 32] * M1[i] + (candidate[(i + 23) % 32] ^ K_MASK[i]) * M2[i]) & 0xFFFF
            eq_b = (((bi * ODD_MUL[i]) & 0xFFFF) ^ candidate[(i + 1) % 32]) + (candidate[(i + 7) % 32] ^ candidate[(i + 15) % 32])
            assert eq_a == TARGET_A[i] and (eq_b & 0xFFFF) == TARGET_B[i]
        print("[+] Verified all 64 equations satisfied by:", candidate.decode("ascii"))
        print("    Hex Key:", candidate.hex())
