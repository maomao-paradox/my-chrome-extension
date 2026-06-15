#!/bin/bash
echo '🚀 Building Chrome Extension with Rust WASM...'

# // 1. 编译 Rust
echo '📦 Compiling Rust to WASM...'
cargo build --target wasm32-unknown-unknown --release

# // 2. 生成 JS 绑定
echo '🔗 Generating WASM bindings...'
rm -rf ./pkg
wasm-bindgen --target web --out-name "aes_wasm_bg" --out-dir ./pkg ./target/wasm32-unknown-unknown/release/aes_wasm.wasm

# // 3. 复制文件到扩展目录
echo '📁 Copying files to public...'
mkdir -p ../public/static/wasm
cp ./pkg/*.{js,wasm} ../public/static/wasm/

# // 4. 编译 TypeScript
# echo '📝 Compiling TypeScript...'
# npx tsc

echo '✅ Build complete!';
