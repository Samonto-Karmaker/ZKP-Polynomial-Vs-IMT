// IMT/utils/test_data_generator.js
// Generates test data for the IMT circuit

const crypto = require("crypto")
const fs = require("fs")
const path = require("path")

const { poseidon2Hash } = require("@zkpassport/poseidon2")

// BN254 field prime
const FIELD_PRIME =
    21888242871839275222246405745257275088548364400416034343698204186575808495617n

// Tree depth (must match main.nr)
const TREE_DEPTH = 20

// Test configuration (same as polynomial module for consistency)
const TEST_CONFIG = {
    testSecrets: [123n, 456n, 789n],
    userEmail: "test@example.com",
    salt: "test_salt_123",
    verifierKey: "verifier_key_456",
    isKYCed: true,
}

// Simple SHA-256 -> field helper
function hashToField(input) {
    const hash = crypto.createHash("sha256").update(input).digest("hex")
    return BigInt("0x" + hash) % FIELD_PRIME
}

// Convert to canonical 0 <= x < FIELD_PRIME
function toPositiveField(value) {
    const r = value % FIELD_PRIME
    return r >= 0n ? r : r + FIELD_PRIME
}

/**
 * Poseidon2 hash wrapper
 */
function realPoseidon2Hash(inputs) {
    try {
        const arr = inputs.map((x) => toPositiveField(x))
        const raw = poseidon2Hash(arr)

        if (typeof raw === "bigint") return raw % FIELD_PRIME
        if (typeof raw === "string") return BigInt(raw) % FIELD_PRIME
        if (raw && raw.toString) return BigInt(raw.toString()) % FIELD_PRIME

        throw new Error("Unexpected poseidon2 result type")
    } catch (err) {
        console.error("Poseidon2 hash error:", err)
        throw err
    }
}

/**
 * Compute leaf hash from secret
 */
function hashLeaf(secret) {
    return realPoseidon2Hash([secret])
}

/**
 * Compute parent hash from two children
 */
function hashPair(left, right) {
    return realPoseidon2Hash([left, right])
}

/**
 * Get zero value for empty leaves
 */
function getZeroValue() {
    return realPoseidon2Hash([0n])
}

/**
 * Precompute zero hashes for each level
 */
function computeZeroHashes() {
    const zeroHashes = new Array(TREE_DEPTH + 1)
    zeroHashes[0] = getZeroValue()

    for (let i = 1; i <= TREE_DEPTH; i++) {
        zeroHashes[i] = hashPair(zeroHashes[i - 1], zeroHashes[i - 1])
    }

    return zeroHashes
}

const ZERO_HASHES = computeZeroHashes()

/**
 * Simple Incremental Merkle Tree for test data generation
 */
class IncrementalMerkleTree {
    constructor() {
        this.leaves = []
        this.nodes = new Map()
        this.nextIndex = 0
    }

    insert(leaf) {
        const index = this.nextIndex
        this.leaves[index] = leaf
        this.updatePath(index)
        this.nextIndex++
        return index
    }

    updatePath(index) {
        let currentIndex = index
        let currentHash = this.leaves[index]

        for (let level = 0; level < TREE_DEPTH; level++) {
            const isRight = currentIndex % 2 === 1
            const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1
            const parentIndex = Math.floor(currentIndex / 2)

            let siblingHash
            if (level === 0) {
                siblingHash = this.leaves[siblingIndex] ?? getZeroValue()
            } else {
                siblingHash =
                    this.nodes.get(`${level}:${siblingIndex}`) ??
                    ZERO_HASHES[level]
            }

            const [left, right] = isRight
                ? [siblingHash, currentHash]
                : [currentHash, siblingHash]
            const parentHash = hashPair(left, right)

            this.nodes.set(`${level + 1}:${parentIndex}`, parentHash)

            currentIndex = parentIndex
            currentHash = parentHash
        }
    }

    getRoot() {
        if (this.nextIndex === 0) {
            return ZERO_HASHES[TREE_DEPTH]
        }
        return this.nodes.get(`${TREE_DEPTH}:0`) ?? ZERO_HASHES[TREE_DEPTH]
    }

    getMerklePath(index) {
        const path = []
        const pathIndices = []

        let currentIndex = index

        for (let level = 0; level < TREE_DEPTH; level++) {
            const isRight = currentIndex % 2 === 1
            const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1

            let siblingHash
            if (level === 0) {
                siblingHash = this.leaves[siblingIndex] ?? getZeroValue()
            } else {
                siblingHash =
                    this.nodes.get(`${level}:${siblingIndex}`) ??
                    ZERO_HASHES[level]
            }

            path.push(siblingHash)
            pathIndices.push(isRight ? 1n : 0n)

            currentIndex = Math.floor(currentIndex / 2)
        }

        return { path, pathIndices }
    }
}

/**
 * Generate test data for the IMT circuit
 */
async function generateTestData() {
    console.log("🧪 Generating test data for IMT ZKP circuit...\n")

    // 1. Generate secret from user email + salt
    const secret = hashToField(TEST_CONFIG.userEmail + TEST_CONFIG.salt)
    console.log(`Secret (from ${TEST_CONFIG.userEmail}): ${secret}`)

    // 2. Build Merkle tree with test secrets + user secret
    const tree = new IncrementalMerkleTree()

    // Insert test secrets first
    for (const testSecret of TEST_CONFIG.testSecrets) {
        const leaf = hashLeaf(testSecret)
        tree.insert(leaf)
    }

    // Insert user's secret and record the index
    const userLeaf = hashLeaf(secret)
    const userIndex = tree.insert(userLeaf)
    console.log(`User inserted at index: ${userIndex}`)

    // 3. Get Merkle root
    const merkleRoot = tree.getRoot()
    console.log(`Merkle root: ${merkleRoot}`)

    // 4. Get Merkle path for user
    const { path, pathIndices } = tree.getMerklePath(userIndex)
    console.log(`Merkle path length: ${path.length}`)

    // 5. Generate verifier key
    const verifierKey = hashToField(TEST_CONFIG.verifierKey)

    // 6. Generate nullifier
    const nullifier = realPoseidon2Hash([secret, verifierKey])
    console.log(`Nullifier: ${nullifier}`)

    // 7. Format for Prover.toml
    const proverToml = `# IMT Membership Proof - Generated Test Data
# Tree depth: ${TREE_DEPTH}
# User index: ${userIndex}

# Public inputs
merkle_root = "${merkleRoot}"
nullifier = "${nullifier}"
verifier_key = "${verifierKey}"

# Private inputs
secret = "${secret}"
isKYCed = ${TEST_CONFIG.isKYCed}
leaf_index = "${userIndex}"
merkle_path = [${path.map((p) => `"${p}"`).join(", ")}]
path_indices = [${pathIndices.map((p) => `"${p}"`).join(", ")}]
`

    return {
        secret,
        userIndex,
        merkleRoot,
        merklePath: path,
        pathIndices,
        nullifier,
        verifierKey,
        proverToml,
    }
}

/**
 * Validate circuit inputs
 */
async function validateCircuitInputs(testData) {
    console.log("\n🔍 Validating circuit inputs...")

    // Verify leaf computation
    const computedLeaf = hashLeaf(testData.secret)
    console.log(`✓ Computed leaf: ${computedLeaf}`)

    // Verify Merkle path by recomputing root
    let currentHash = computedLeaf
    for (let i = 0; i < TREE_DEPTH; i++) {
        const isRight = testData.pathIndices[i] === 1n
        const [left, right] = isRight
            ? [testData.merklePath[i], currentHash]
            : [currentHash, testData.merklePath[i]]
        currentHash = hashPair(left, right)
    }

    const rootMatch = currentHash === testData.merkleRoot
    console.log(`✓ Merkle root verification: ${rootMatch ? "✅" : "❌"}`)

    // Verify nullifier
    const recomputedNullifier = realPoseidon2Hash([
        testData.secret,
        testData.verifierKey,
    ])
    const nullifierMatch = recomputedNullifier === testData.nullifier
    console.log(`✓ Nullifier consistency: ${nullifierMatch ? "✅" : "❌"}`)

    // Verify path indices match leaf index
    let reconstructedIndex = 0n
    let powerOfTwo = 1n
    for (let i = 0; i < TREE_DEPTH; i++) {
        reconstructedIndex += testData.pathIndices[i] * powerOfTwo
        powerOfTwo *= 2n
    }
    const indexMatch = reconstructedIndex === BigInt(testData.userIndex)
    console.log(`✓ Leaf index consistency: ${indexMatch ? "✅" : "❌"}`)

    return rootMatch && nullifierMatch && indexMatch
}

/* CLI entrypoint */
if (require.main === module) {
    ;(async () => {
        console.log("🚀 Starting IMT ZKP test data generation...\n")

        try {
            const testData = await generateTestData()
            const isValid = await validateCircuitInputs(testData)

            if (!isValid) {
                console.error("❌ Validation failed! Please check the inputs.")
                process.exit(1)
            }

            console.log("\n📝 Writing test data to Prover.toml...")
            const proverPath = path.join(__dirname, "../circuit/Prover.toml")
            fs.writeFileSync(proverPath, testData.proverToml)
            console.log("✅ Test data written to Prover.toml")

            console.log("\n📊 Test Summary:")
            console.log(`- Secret: ${testData.secret}`)
            console.log(`- User index: ${testData.userIndex}`)
            console.log(`- Merkle root: ${testData.merkleRoot}`)
            console.log(`- Nullifier: ${testData.nullifier}`)
            console.log(`- Verifier key: ${testData.verifierKey}`)
            console.log(`- Tree depth: ${TREE_DEPTH}`)
            console.log(`- Using Poseidon2 for hashing ✅`)

            console.log("\n🎯 Ready for circuit testing!")
            console.log("Run: cd circuit && nargo prove && nargo verify")
        } catch (err) {
            console.error("Fatal error generating test data:", err)
            process.exit(1)
        }
    })()
}

module.exports = {
    generateTestData,
    toPositiveField,
    FIELD_PRIME,
    TREE_DEPTH,
    realPoseidon2Hash,
    validateCircuitInputs,
    IncrementalMerkleTree,
}
