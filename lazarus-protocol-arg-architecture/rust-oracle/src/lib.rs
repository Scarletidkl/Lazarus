#![no_std]

//! THE LAZARUS PROTOCOL — Layer 2 WebAssembly Cryptographic Oracle (`oracle.wasm`)
//!
//! Compile to standalone WebAssembly:
//!   cargo build --target wasm32-unknown-unknown --release
//!   # or via wasm-pack:
//!   wasm-pack build --target web --release
//!
//! Mathematical Structure:
//! Given a 32-byte candidate key `b[0..31]` in linear memory at `ptr`,
//! no plaintext key or hash exists in the binary. Instead, the input vector `b`
//! must simultaneously satisfy 64 coupled modular/bitwise equations (`TARGET_A` and `TARGET_B`)
//! over `GF(2)^8` and `Z / 2^16 Z`, solvable only via SMT theorem proving (Microsoft Z3).

#[cfg(not(test))]
#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    loop {}
}

const M1: [u32; 32] = [
    3, 5, 7, 9, 11, 13, 15, 3, 5, 7, 9, 11, 13, 15, 3, 5,
    7, 9, 11, 13, 15, 3, 5, 7, 9, 11, 13, 15, 3, 5, 7, 9,
];

const M2: [u32; 32] = [
    1, 3, 5, 7, 9, 1, 3, 5, 7, 9, 1, 3, 5, 7, 9, 1,
    3, 5, 7, 9, 1, 3, 5, 7, 9, 1, 3, 5, 7, 9, 1, 3,
];

const K_MASK: [u32; 32] = [
    165, 162, 171, 176, 185, 134, 143, 148, 157, 154, 227, 232, 241, 254, 199, 204,
    213, 210, 219, 32, 41, 54, 63, 4, 13, 10, 19, 24, 97, 110, 119, 124,
];

const ODD_MUL: [u32; 32] = [
    1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31,
    33, 35, 37, 39, 41, 43, 45, 47, 49, 51, 53, 55, 57, 59, 61, 63,
];

const TARGET_A: [u32; 32] = [
    503, 812, 1838, 1759, 2843, 1360, 2097, 1184,
    1931, 2532, 861, 1689, 1620, 2268, 1572, 692,
    1044, 1125, 1413, 2772, 1360, 667, 519, 929,
    1965, 1164, 961, 1795, 640, 1300, 643, 1008,
];

const TARGET_B: [u32; 32] = [
    26, 251, 517, 304, 1041, 1126, 815, 1499,
    1499, 1508, 1733, 2351, 1989, 1440, 2614, 2635,
    1579, 3283, 3583, 3555, 2168, 3571, 3647, 4435,
    2436, 4225, 2707, 3639, 4428, 3094, 2062, 7926,
];

/// Returns the number of satisfied constraint pairs (0..=32) for the 32-byte key at `ptr`.
#[no_mangle]
pub unsafe extern "C" fn count_satisfied(ptr: *const u8) -> i32 {
    let b = core::slice::from_raw_parts(ptr, 32);
    let mut score: i32 = 0;

    let mut i = 0usize;
    while i < 32 {
        let bi = b[i] as u32;
        let b5 = b[(i + 5) & 31] as u32;
        let b12 = b[(i + 12) & 31] as u32;
        let b23 = b[(i + 23) & 31] as u32;
        let b1 = b[(i + 1) & 31] as u32;
        let b7 = b[(i + 7) & 31] as u32;
        let b15 = b[(i + 15) & 31] as u32;

        let eq_a = ((bi ^ b5)
            .wrapping_add(b12.wrapping_mul(M1[i]))
            .wrapping_add((b23 ^ K_MASK[i]).wrapping_mul(M2[i])))
            & 0xFFFF;

        let eq_b = (((bi.wrapping_mul(ODD_MUL[i]) & 0xFFFF) ^ b1)
            .wrapping_add(b7 ^ b15))
            & 0xFFFF;

        if eq_a == TARGET_A[i] && eq_b == TARGET_B[i] {
            score += 1;
        }
        i += 1;
    }

    score
}

/// Returns `1` iff all 32 coupled algebraic constraint pairs hold, `0` otherwise.
#[no_mangle]
pub unsafe extern "C" fn verify_key(ptr: *const u8) -> i32 {
    if count_satisfied(ptr) == 32 {
        1
    } else {
        0
    }
}
