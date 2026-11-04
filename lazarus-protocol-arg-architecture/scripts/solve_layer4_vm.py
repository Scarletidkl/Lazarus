#!/usr/bin/env python3
"""
THE LAZARUS PROTOCOL — Layer 4 Solver (LAZARUS-110 Esoteric CPU Emulator)
Architecture: 8-bit Registers R0..R7 + 16-bit Rule-110 Cellular Automaton Tape + Base-3 Ternary ALU
"""

import hashlib

ROM_HEX = (
    "0501010102390601020401010100c803000002000107000005010201024a06010204010201003103"
    "000102000107000005010301025b06010204010301002203000202000107000005010101026c0601"
    "0204010401004c03000302000107000005010201027d060102040105010050030004020001070000"
    "05010301028e06010204010101007b03000502000107000005010101029f0601020401020100cb03"
    "00060200010700000501020102b006010204010301000c0300070200010700000501030102c10601"
    "020401040100d80300080200010700000501010102d206010204010501008c030009020001070000"
    "0501020102e306010204010101008503000a0200010700000501030102f40601020401020100c803"
    "000b0200010700000501010102050601020401030100af03000c0200010700000501020102160601"
    "020401040100ef03000d02000107000005010301022706010204010501009703000e020001070000"
    "05010101023806010204010101003203000f02000107000005010201024906010204010201005f03"
    "001002000107000005010301025a06010204010301002403001102000107000005010101026b0601"
    "020401040100af03001202000107000005010201027c06010204010501002c030013020001070000"
    "05010301028d06010204010101000503001402000107000005010101029e06010204010201001803"
    "00150200010700000501020102af06010204010301000b0300160200010700000501030102c00601"
    "0204010401006a0300170200010700000501010102d10601020401050100b1030018020001070000"
    "0501020102e20601020401010100890300190200010700000501030102f306010204010201007e03"
    "001a02000107000005010101020406010204010301004403001b020001070000ff0000"
)


def rule110_step_16(tape: int, steps: int) -> int:
    for _ in range(steps):
        next_tape = 0
        for bit in range(16):
            left = (tape >> ((bit + 1) % 16)) & 1
            center = (tape >> bit) & 1
            right = (tape >> ((bit + 15) % 16)) & 1
            pattern = (left << 2) | (center << 1) | right
            next_tape |= ((0b01101110 >> pattern) & 1) << bit
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


def run_vm(rom: bytes) -> str:
    regs = [0] * 8
    tape = 0xB6D3
    out = bytearray()
    pc = 0
    while pc + 3 <= len(rom):
        op, a, b = rom[pc], rom[pc + 1], rom[pc + 2]
        pc += 3
        if op == 0x01:  # LDI R[a], imm8
            regs[a & 7] = b & 0xFF
        elif op == 0x02:  # XOR R[a], R[b]
            regs[a & 7] = (regs[a & 7] ^ regs[b & 7]) & 0xFF
        elif op == 0x03:  # ADD R[a], imm8
            regs[a & 7] = (regs[a & 7] + b) & 0xFF
        elif op == 0x04:  # ROL R[a], shift
            regs[a & 7] = rol8(regs[a & 7], b)
        elif op == 0x05:  # R110_STEP R[a], steps
            tape = rule110_step_16(tape, b)
            regs[a & 7] = (tape & 0xFF) ^ ((tape >> 8) & 0xFF)
        elif op == 0x06:  # TRIT_MAD R[a], R[b]
            regs[a & 7] = trit_op_u8(regs[a & 7], regs[b & 7])
        elif op == 0x07:  # EMIT R[a]
            out.append(regs[a & 7])
        elif op == 0xFF:  # HALT
            break
    return out.decode("ascii")


if __name__ == "__main__":
    flag = run_vm(bytes.fromhex(ROM_HEX))
    digest = hashlib.sha256(flag.encode()).hexdigest()
    print("[+] Emulated VM Output Flag :", flag)
    print("[+] Final SHA-256 Digest    :", digest)
