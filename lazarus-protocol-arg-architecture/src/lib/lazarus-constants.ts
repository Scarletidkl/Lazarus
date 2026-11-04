export const LAYER1_CONSTANTS = {
  FEIGENBAUM_DELTA: 4.66920160910299,
  FEIGENBAUM_ALPHA: 2.50290787509589,
  FEIGENBAUM_R_INF: 3.56994567187094,
  RESONANCE_UNIFORMS: {
    u_cam_x: 4.6692,
    u_cam_y: 2.5029,
    u_cam_z: 3.5699,
    u_time: 11.6866,
  },
  ACCESS_VECTOR: "LAZ1-FEIGENBAUM-466920-250290-ARTIFACT",
};

export const LAYER2_CONSTANTS = {
  EXPECTED_KEY_ASCII: "LAZ2{Z3_SMT_M4TR1X_W4SM_0R4CL3!}",
  EXPECTED_KEY_HEX:
    "4c415a327b5a335f534d545f4d34545231585f5734534d5f305234434c33217d",
  M1: [
    3, 5, 7, 9, 11, 13, 15, 3, 5, 7, 9, 11, 13, 15, 3, 5, 7, 9, 11, 13, 15, 3,
    5, 7, 9, 11, 13, 15, 3, 5, 7, 9,
  ],
  M2: [
    1, 3, 5, 7, 9, 1, 3, 5, 7, 9, 1, 3, 5, 7, 9, 1, 3, 5, 7, 9, 1, 3, 5, 7, 9,
    1, 3, 5, 7, 9, 1, 3,
  ],
  K_MASK: [
    165, 162, 171, 176, 185, 134, 143, 148, 157, 154, 227, 232, 241, 254, 199,
    204, 213, 210, 219, 32, 41, 54, 63, 4, 13, 10, 19, 24, 97, 110, 119, 124,
  ],
  ODD_MUL: [
    1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 39,
    41, 43, 45, 47, 49, 51, 53, 55, 57, 59, 61, 63,
  ],
  TARGET_A: [
    503, 812, 1838, 1759, 2843, 1360, 2097, 1184, 1931, 2532, 861, 1689, 1620,
    2268, 1572, 692, 1044, 1125, 1413, 2772, 1360, 667, 519, 929, 1965, 1164,
    961, 1795, 640, 1300, 643, 1008,
  ],
  TARGET_B: [
    26, 251, 517, 304, 1041, 1126, 815, 1499, 1499, 1508, 1733, 2351, 1989,
    1440, 2614, 2635, 1579, 3283, 3583, 3555, 2168, 3571, 3647, 4435, 2436,
    4225, 2707, 3639, 4428, 3094, 2062, 7926,
  ],
};

export function evaluateLayer2Equations(bytes: number[]): {
  satisfiedCount: number;
  equationResults: boolean[];
} {
  if (bytes.length !== 32) {
    return { satisfiedCount: 0, equationResults: Array(32).fill(false) };
  }
  const results: boolean[] = [];
  let satisfiedCount = 0;

  for (let i = 0; i < 32; i++) {
    const bi = bytes[i] & 0xff;
    const b5 = bytes[(i + 5) & 31] & 0xff;
    const b12 = bytes[(i + 12) & 31] & 0xff;
    const b23 = bytes[(i + 23) & 31] & 0xff;
    const b1 = bytes[(i + 1) & 31] & 0xff;
    const b7 = bytes[(i + 7) & 31] & 0xff;
    const b15 = bytes[(i + 15) & 31] & 0xff;

    const eqA =
      ((bi ^ b5) +
        b12 * LAYER2_CONSTANTS.M1[i] +
        (b23 ^ LAYER2_CONSTANTS.K_MASK[i]) * LAYER2_CONSTANTS.M2[i]) &
      0xffff;

    const eqB =
      (((bi * LAYER2_CONSTANTS.ODD_MUL[i]) & 0xffff) ^ b1) + (b7 ^ b15);

    const ok =
      eqA === LAYER2_CONSTANTS.TARGET_A[i] &&
      (eqB & 0xffff) === LAYER2_CONSTANTS.TARGET_B[i];
    results.push(ok);
    if (ok) satisfiedCount++;
  }

  return { satisfiedCount, equationResults: results };
}

export const LAYER3_CONSTANTS = {
  TARGET_MESSAGE: "EXECUTE_PROTOCOL_OMEGA",
  PUBLIC_KEY_X:
    "0x72faca5ab39f74fd01d1b1994449cae914de8dde878ba49c57179c648370cdfe",
  PUBLIC_KEY_Y:
    "0xf746ef7322830b9fb706489a8b17ed06b814cbb7e8e2d7abdf1370aba2929769",
  REFERENCE_PRIVATE_KEY:
    "0xcf6f5c92e2462215572cf4af1279e022485d1355d91bca50394e02121d845726",
  REFERENCE_REUSED_NONCE:
    "0x33f5b279ebee147fae51ee7453bb93e1e9f8c2cdc55a54f331d757a757152012",
  REFERENCE_OMEGA_R:
    "0x5c9dc491fa23fbe2d96b02980406c164b71f646528ceda97101f18eb434e6bd5",
  REFERENCE_OMEGA_S:
    "0xf5b8de321bcc88305451bb2023ba3fc8bf70176c9c22e062d54edef91f2d2a25",
};

export const LAYER4_CONSTANTS = {
  INITIAL_TAPE: 0xb6d3,
  ROM_HEX:
    "0501010102390601020401010100c803000002000107000005010201024a06010204010201003103" +
    "000102000107000005010301025b06010204010301002203000202000107000005010101026c0601" +
    "0204010401004c03000302000107000005010201027d060102040105010050030004020001070000" +
    "05010301028e06010204010101007b03000502000107000005010101029f0601020401020100cb03" +
    "00060200010700000501020102b006010204010301000c0300070200010700000501030102c10601" +
    "020401040100d80300080200010700000501010102d206010204010501008c030009020001070000" +
    "0501020102e306010204010101008503000a0200010700000501030102f40601020401020100c803" +
    "000b0200010700000501010102050601020401030100af03000c0200010700000501020102160601" +
    "020401040100ef03000d02000107000005010301022706010204010501009703000e020001070000" +
    "05010101023806010204010101003203000f02000107000005010201024906010204010201005f03" +
    "001002000107000005010301025a06010204010301002403001102000107000005010101026b0601" +
    "020401040100af03001202000107000005010201027c06010204010501002c030013020001070000" +
    "05010301028d06010204010101000503001402000107000005010101029e06010204010201001803" +
    "00150200010700000501020102af06010204010301000b0300160200010700000501030102c00601" +
    "0204010401006a0300170200010700000501010102d10601020401050100b1030018020001070000" +
    "0501020102e20601020401010100890300190200010700000501030102f306010204010201007e03" +
    "001a02000107000005010101020406010204010301004403001b020001070000ff0000",
  EXPECTED_FLAG: "LAZ4{RUL3_110_T3RN4RY_0M3G4}",
  EXPECTED_SHA256:
    "3b6eeea6f2286f41c27725cb6f31c211ad0161524ea9a7656e508f69063eb2bd",
};

export interface VmInstructionTrace {
  pc: number;
  rawBytes: [number, number, number];
  mnemonic: string;
  registersAfter: number[];
  tapeAfter: number;
  emittedChar?: string;
}

export function stepRule110(tape: number, steps: number): number {
  let current = tape & 0xffff;
  for (let s = 0; s < steps; s++) {
    let nextTape = 0;
    for (let bit = 0; bit < 16; bit++) {
      const left = (current >> ((bit + 1) & 15)) & 1;
      const center = (current >> bit) & 1;
      const right = (current >> ((bit + 15) & 15)) & 1;
      const pattern = (left << 2) | (center << 1) | right;
      const nextBit = (0b01101110 >> pattern) & 1;
      nextTape |= nextBit << bit;
    }
    current = nextTape & 0xffff;
  }
  return current;
}

export function tritOpU8(a: number, b: number): number {
  let res = 0;
  let pow3 = 1;
  for (let t = 0; t < 6; t++) {
    const ta = Math.floor(a / pow3) % 3;
    const tb = Math.floor(b / pow3) % 3;
    res += ((ta + tb) % 3) * pow3;
    pow3 *= 3;
  }
  return res & 0xff;
}

export function rol8(val: number, shift: number): number {
  const s = shift & 7;
  return (((val << s) | (val >> (8 - s))) & 0xff) >>> 0;
}

export function executeLazarusVm(
  romHex: string,
  maxSteps = 500
): {
  outputAscii: string;
  outputBytes: number[];
  registers: number[];
  tape: number;
  halted: boolean;
  trace: VmInstructionTrace[];
} {
  const cleanHex = romHex.replace(/[^0-9a-fA-F]/g, "");
  const rom: number[] = [];
  for (let i = 0; i + 1 < cleanHex.length; i += 2) {
    rom.push(parseInt(cleanHex.slice(i, i + 2), 16));
  }

  const regs = [0, 0, 0, 0, 0, 0, 0, 0];
  let tape = LAYER4_CONSTANTS.INITIAL_TAPE;
  const outputBytes: number[] = [];
  const trace: VmInstructionTrace[] = [];
  let pc = 0;
  let halted = false;
  let steps = 0;

  while (pc + 3 <= rom.length && steps < maxSteps) {
    const op = rom[pc];
    const a = rom[pc + 1];
    const b = rom[pc + 2];
    const instrPc = pc;
    pc += 3;
    steps++;

    let mnemonic = "";
    let emittedChar: string | undefined;

    if (op === 0x01) {
      regs[a & 7] = b & 0xff;
      mnemonic = `LDI R${a & 7}, 0x${b.toString(16).padStart(2, "0")}`;
    } else if (op === 0x02) {
      regs[a & 7] = (regs[a & 7] ^ regs[b & 7]) & 0xff;
      mnemonic = `XOR R${a & 7}, R${b & 7}`;
    } else if (op === 0x03) {
      regs[a & 7] = (regs[a & 7] + b) & 0xff;
      mnemonic = `ADD R${a & 7}, 0x${b.toString(16).padStart(2, "0")}`;
    } else if (op === 0x04) {
      regs[a & 7] = rol8(regs[a & 7], b);
      mnemonic = `ROL R${a & 7}, ${b & 7}`;
    } else if (op === 0x05) {
      tape = stepRule110(tape, b);
      regs[a & 7] = (tape & 0xff) ^ ((tape >> 8) & 0xff);
      mnemonic = `R110_STEP R${a & 7}, ${b}`;
    } else if (op === 0x06) {
      regs[a & 7] = tritOpU8(regs[a & 7], regs[b & 7]);
      mnemonic = `TRIT_MAD R${a & 7}, R${b & 7}`;
    } else if (op === 0x07) {
      const val = regs[a & 7] & 0xff;
      outputBytes.push(val);
      emittedChar =
        val >= 0x20 && val <= 0x7e ? String.fromCharCode(val) : ".";
      mnemonic = `EMIT R${a & 7} ('${emittedChar}')`;
    } else if (op === 0xff) {
      mnemonic = "HALT";
      halted = true;
      trace.push({
        pc: instrPc,
        rawBytes: [op, a, b],
        mnemonic,
        registersAfter: [...regs],
        tapeAfter: tape,
      });
      break;
    } else {
      mnemonic = `DB 0x${op.toString(16).padStart(2, "0")}`;
    }

    trace.push({
      pc: instrPc,
      rawBytes: [op, a, b],
      mnemonic,
      registersAfter: [...regs],
      tapeAfter: tape,
      emittedChar,
    });
  }

  const outputAscii = outputBytes
    .map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : "?"))
    .join("");

  return {
    outputAscii,
    outputBytes,
    registers: regs,
    tape,
    halted,
    trace,
  };
}
