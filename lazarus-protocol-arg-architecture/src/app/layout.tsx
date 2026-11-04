import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "THE LAZARUS PROTOCOL // 4-Layer Cryptographic Singularity",
  description:
    "Hardcore Cryptographic & Reverse Engineering Challenge: 4D GLSL Mandelbulb Shader, Tri-Polyglot Forensics, Rust WebAssembly + Z3 SMT Solver, secp256k1 ECDSA Nonce Reuse Oracle, and Rule-110 Ternary VM.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#060709] text-[#E2E8F0] antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
        {children}
      </body>
    </html>
  );
}
