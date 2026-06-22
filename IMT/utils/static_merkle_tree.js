// IMT/utils/static_merkle_tree.js
const { realPoseidon2Hash, FIELD_PRIME, TREE_DEPTH } = require("./test_data_generator")

function toPositiveField(value) {
    const r = value % FIELD_PRIME
    return r >= 0n ? r : r + FIELD_PRIME
}

function hashLeaf(secret) {
    return realPoseidon2Hash([secret])
}

function hashPair(left, right) {
    return realPoseidon2Hash([left, right])
}

function getZeroValue() {
    return realPoseidon2Hash([0n])
}

function computeZeroHashes() {
    const zeroHashes = new Array(TREE_DEPTH + 1)
    zeroHashes[0] = getZeroValue()

    for (let i = 1; i <= TREE_DEPTH; i++) {
        zeroHashes[i] = hashPair(zeroHashes[i - 1], zeroHashes[i - 1])
    }

    return zeroHashes
}

const ZERO_HASHES = computeZeroHashes()

class StaticMerkleTree {
    constructor(secrets) {
        this.leaves = secrets.map(s => hashLeaf(s))
        this.levels = []
        this.buildTree()
    }

    buildTree() {
        let currentLevel = this.leaves
        this.levels.push(currentLevel)

        for (let level = 0; level < TREE_DEPTH; level++) {
            const nextLevel = []
            const activeCount = currentLevel.length
            const parentCount = Math.ceil(activeCount / 2)

            for (let i = 0; i < parentCount; i++) {
                const left = currentLevel[2 * i]
                const right = (2 * i + 1 < activeCount) ? currentLevel[2 * i + 1] : ZERO_HASHES[level]
                nextLevel.push(hashPair(left, right))
            }
            currentLevel = nextLevel
            this.levels.push(currentLevel)
        }
    }

    getRoot() {
        return this.levels[TREE_DEPTH][0] ?? ZERO_HASHES[TREE_DEPTH]
    }

    getMerklePath(index) {
        const path = []
        const pathIndices = []
        let currentIndex = index

        for (let level = 0; level < TREE_DEPTH; level++) {
            const isRight = currentIndex % 2 === 1
            const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1
            
            const levelNodes = this.levels[level]
            const siblingHash = (siblingIndex < levelNodes.length) ? levelNodes[siblingIndex] : ZERO_HASHES[level]

            path.push(siblingHash)
            pathIndices.push(isRight ? 1n : 0n)

            currentIndex = Math.floor(currentIndex / 2)
        }

        return { path, pathIndices }
    }
}

module.exports = {
    StaticMerkleTree,
    ZERO_HASHES,
    realPoseidon2Hash,
}
