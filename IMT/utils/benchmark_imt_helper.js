// IMT/utils/benchmark_imt_helper.js
const {
    IncrementalMerkleTree,
    realPoseidon2Hash,
} = require("./test_data_generator")

/**
 * Incrementally adds new secrets to an existing IMT or creates a new one
 * @param {IncrementalMerkleTree | null} existingTree - The current tree (or null)
 * @param {bigint[]} newSecrets - Array of secrets to add
 * @returns {IncrementalMerkleTree} - The updated tree
 */
function createIncrementalIMT(existingTree, newSecrets) {
    const tree = existingTree || new IncrementalMerkleTree()

    for (const secret of newSecrets) {
        // Compute leaf hash from secret (mimics test_data_generator logic)
        const leaf = realPoseidon2Hash([secret])
        tree.insert(leaf)
    }

    return tree
}

/**
 * Serializes the entire logic structure of the IMT to CSV for proper storage measurement.
 * Includes all leaves and all internal nodes currently stored in the map.
 * Format: level,index,hash_value
 * @param {IncrementalMerkleTree} tree
 * @returns {string} CSV content
 */
function serializeIMTtoCSV(tree) {
    const lines = ["level,index,hash_value"]

    // 1. Serialize leaves (Level 0)
    // Accessing private 'leaves' via index since we don't have direct access if private
    // But test_data_generator implementation shows 'leaves' is public property (this.leaves)
    if (tree.leaves) {
        tree.leaves.forEach((leaf, index) => {
            if (leaf !== undefined) {
                lines.push(`0,${index},${leaf.toString()}`)
            }
        })
    }

    // 2. Serialize internal nodes
    // The implementation uses a Map 'nodes' with key "level:index"
    if (tree.nodes) {
        for (const [key, value] of tree.nodes.entries()) {
            const [level, index] = key.split(":")
            lines.push(`${level},${index},${value.toString()}`)
        }
    }

    return lines.join("\n")
}

/**
 * Generates Prover.toml content for a specific user index
 */
function generateProverToml(tree, userIndex, secret, verifierKey) {
    const merkleRoot = tree.getRoot()

    // Get Merkle path
    const { path: merklePath, pathIndices } = tree.getMerklePath(userIndex)

    // Generate nullifier
    const nullifier = realPoseidon2Hash([secret, verifierKey])

    // Format TOML
    // Matches the format in test_data_generator.js
    const proverToml = `# IMT Membership Proof
merkle_root = "${merkleRoot}"
nullifier = "${nullifier}"
verifier_key = "${verifierKey}"
secret = "${secret}"
isKYCed = true
leaf_index = "${userIndex}"
merkle_path = [${merklePath.map((p) => `"${p}"`).join(", ")}]
path_indices = [${pathIndices.map((p) => `"${p}"`).join(", ")}]
`

    return {
        proverToml,
        merkleRoot,
        nullifier,
    }
}

module.exports = {
    createIncrementalIMT,
    serializeIMTtoCSV,
    generateProverToml,
}
