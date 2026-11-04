#!/usr/bin/env python3
"""
Entrypoint wrapper for generating the PNG+PDF+ZIP polyglot `public/artifact.png`,
the WebAssembly challenge module `public/oracle.wasm`, and Layer 4 bytecode ROM.
"""
from generate_assets import main

if __name__ == "__main__":
    main()
