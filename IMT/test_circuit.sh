#!/bin/bash
# IMT/test_circuit.sh
# Test script for IMT membership ZKP circuit

echo "🚀 Starting IMT ZKP Circuit Test"
echo "================================"

# Navigate to IMT directory
cd "$(dirname "$0")"

echo "📋 Step 1: Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ npm install failed!"
    exit 1
fi

echo "✅ Dependencies installed"

echo "📋 Step 2: Generating test data..."
node utils/test_data_generator.js

if [ $? -ne 0 ]; then
    echo "❌ Test data generation failed!"
    exit 1
fi

echo "✅ Test data generated successfully"

# Navigate to circuit directory
cd circuit

echo "🔧 Step 3: Compiling circuit..."
nargo compile

if [ $? -ne 0 ]; then
    echo "❌ Circuit compilation failed!"
    exit 1
fi

echo "✅ Circuit compiled successfully"

echo "🔐 Step 4: Generating witness..."
nargo execute

if [ $? -ne 0 ]; then
    echo "❌ Witness generation failed!"
    echo "💡 Check the Prover.toml file format and values"
    echo "📝 First 15 lines of Prover.toml:"
    head -15 Prover.toml
    exit 1
fi

echo "✅ Witness generated successfully"

echo "🔓 Step 5: Generating verification key..."
bb write_vk -b ./target/b2b_membership_imt.json -o ./target --oracle_hash keccak

if [ $? -ne 0 ]; then
    echo "❌ Verification key generation failed!"
    exit 1
fi

echo "✅ Verification key generated successfully"

echo "📜 Step 6: Generating Solidity verifier contract..."
bb write_solidity_verifier -k ./target/vk -o ./target/Verifier.sol

if [ $? -ne 0 ]; then
    echo "❌ Verifier contract generation failed!"
    exit 1
fi

echo "✅ Solidity verifier contract generated successfully"

echo "🔍 Step 7: Generating proof..."
bb prove -b ./target/b2b_membership_imt.json -w ./target/b2b_membership_imt.gz -o ./target --oracle_hash keccak

if [ $? -ne 0 ]; then
    echo "❌ Proof generation failed!"
    echo "💡 Check if target files exist:"
    ls -la target/
    exit 1
fi

echo "✅ Proof generated successfully"

echo "🔎 Step 8: Verifying proof..."
bb verify -k ./target/vk -p ./target/proof --oracle_hash keccak

if [ $? -eq 0 ]; then
    echo "✅ Proof verification successful!"
    echo "🎉 All tests passed! The IMT circuit works correctly."
else
    echo "❌ Proof verification failed!"
    echo "💡 Check if all required files exist:"
    ls -la target/
    exit 1
fi

echo ""
echo "📊 Test Results:"
echo "- Dependency installation: ✅ PASSED"
echo "- Test data generation: ✅ PASSED"
echo "- Circuit compilation: ✅ PASSED"
echo "- Witness generation: ✅ PASSED"
echo "- Proof generation: ✅ PASSED"
echo "- Proof verification: ✅ PASSED"
echo ""
echo "🎯 The B2B Membership IMT ZKP circuit is working correctly!"

echo ""
echo "📁 Generated Files:"
echo "- Circuit bytecode: ./circuit/target/b2b_membership_imt.json"
echo "- Witness: ./circuit/target/b2b_membership_imt.gz"
echo "- Verification key: ./circuit/target/vk"
echo "- Proof: ./circuit/target/proof"
echo "- Solidity verifier: ./circuit/target/Verifier.sol"
