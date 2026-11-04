#!/usr/bin/env python3
"""
THE LAZARUS PROTOCOL — Layer 3 Exploit (secp256k1 ECDSA Nonce Reuse Attack)

Mathematical Principle:
Given two ECDSA signatures (r, s1) and (r, s2) over secp256k1 generated with the
same ephemeral nonce k (triggered by sending identical `X-Timestamp` headers):
  s1 = k^-1 * (z1 + r * d_A) mod n
  s2 = k^-1 * (z2 + r * d_A) mod n
Subtracting:
  s1 - s2 = k^-1 * (z1 - z2) mod n
  ==> k   = (z1 - z2) * (s1 - s2)^-1 mod n
  ==> d_A = (s1 * k - z1) * r^-1 mod n
"""

import hashlib

SECP_P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
SECP_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
SECP_GX = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798
SECP_GY = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8


def modinv(a: int, m: int) -> int:
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
        lam = (3 * x1 * x1 * modinv(2 * y1, SECP_P)) % SECP_P
    else:
        lam = ((y2 - y1) * modinv(x2 - x1, SECP_P)) % SECP_P
    x3 = (lam * lam - x1 - x2) % SECP_P
    y3 = (lam * (x1 - x3) - y1) % SECP_P
    return (x3, y3)


def ec_mul(k: int, point=(SECP_GX, SECP_GY)):
    res = None
    addend = point
    k = k % SECP_N
    while k > 0:
        if k & 1:
            res = ec_add(res, addend)
        addend = ec_add(addend, addend)
        k >>= 1
    return res


def recover_private_key_and_forge():
    # Two oracle responses obtained with header `X-Timestamp: 1337000000`
    msg1 = "PROBE_ALPHA_01"
    z1 = int.from_bytes(hashlib.sha256(msg1.encode()).digest(), "big") % SECP_N
    r = 0x5C9DC491FA23FBE2D96B02980406C164B71F646528CEDA97101F18EB434E6BD5
    s1 = 0x7DB47B72ED3708AD37E8EAEF25E01278748487504C11216E252D41E411EBAF4B

    msg2 = "PROBE_BETA_02"
    z2 = int.from_bytes(hashlib.sha256(msg2.encode()).digest(), "big") % SECP_N
    s2 = 0xE7091A22B75E0554D2DC6EA4B139CC2FA9A857318DDC6F487FB049185E2E9F6D

    # Step 1: Recover ephemeral nonce k
    k = ((z1 - z2) * modinv(s1 - s2, SECP_N)) % SECP_N

    # Step 2: Recover server private key d_A
    d_A = ((s1 * k - z1) * modinv(r, SECP_N)) % SECP_N

    # Step 3: Forge ECDSA signature for "EXECUTE_PROTOCOL_OMEGA"
    target_msg = "EXECUTE_PROTOCOL_OMEGA"
    z_omega = int.from_bytes(hashlib.sha256(target_msg.encode()).digest(), "big") % SECP_N
    R_point = ec_mul(k)
    r_omega = R_point[0] % SECP_N
    s_omega = (modinv(k, SECP_N) * (z_omega + r_omega * d_A)) % SECP_N

    print("[+] Recovered Ephemeral Nonce k :", hex(k))
    print("[+] Recovered Server Key d_A    :", hex(d_A))
    print("[+] Forged Signature for EXECUTE_PROTOCOL_OMEGA:")
    print("    r =", hex(r_omega))
    print("    s =", hex(s_omega))


if __name__ == "__main__":
    recover_private_key_and_forge()
