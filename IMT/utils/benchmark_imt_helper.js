// IMT/utils/benchmark_imt_helper.js
const {
    StaticMerkleTree,
    realPoseidon2Hash,
} = require("./static_merkle_tree")

/**
 * Creates a static SMT from scratch
 * @param {bigint[]} allSecrets - Array of all secrets
 * @returns {StaticMerkleTree} - The populated tree
 */
function createStaticSMT(allSecrets) {
    return new StaticMerkleTree(allSecrets)
}

/**
 * Serializes the entire logic structure of the SMT to CSV for proper storage measurement.
 * Includes all active leaves and all active internal nodes.
 * Format: level,index,hash_value
 * @param {StaticMerkleTree} tree
 * @returns {string} CSV content
 */
function serializeSMTtoCSV(tree) {
    const lines = ["level,index,hash_value"]

    tree.levels.forEach((levelNodes, level) => {
        levelNodes.forEach((node, index) => {
            if (node !== undefined) {
                lines.push(`${level},${index},${node.toString()}`)
            }
        })
    })

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
    const proverToml = `# SMT Membership Proof
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
    createStaticSMT,
    serializeIMTtoCSV: serializeSMTtoCSV,
    generateProverToml,
}

