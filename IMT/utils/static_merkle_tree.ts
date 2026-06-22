// IMT/utils/static_merkle_tree.ts
import { poseidon2Hash } from "@zkpassport/poseidon2"

export const bn_254_fp =
    21888242871839275222246405745257275088548364400416034343698204186575808495617n

export const TREE_DEPTH = 20

const mod = (x: bigint, f: bigint = bn_254_fp): bigint => {
    const result = x % f
    return result >= 0n ? result : result + f
}

export function poseidon2(inputs: bigint[]): bigint {
    try {
        const normalized = inputs.map((x) => mod(x))
        const result: unknown = poseidon2Hash(normalized)

        if (typeof result === "bigint") return mod(result)
        if (typeof result === "string") return mod(BigInt(result))
        if (result && typeof result === "object" && "toString" in result) {
            return mod(BigInt(result.toString()))
        }

        throw new Error("Unexpected poseidon2 result type")
    } catch (err) {
        console.error("Poseidon2 hash error:", err)
        throw err
    }
}

export function hashLeaf(secret: bigint): bigint {
    return poseidon2([secret])
}

export function hashPair(left: bigint, right: bigint): bigint {
    return poseidon2([left, right])
}

export function getZeroValue(): bigint {
    return poseidon2([0n])
}

function computeZeroHashes(): bigint[] {
    const zeroHashes: bigint[] = new Array(TREE_DEPTH + 1)
    zeroHashes[0] = getZeroValue()

    for (let i = 1; i <= TREE_DEPTH; i++) {
        zeroHashes[i] = hashPair(zeroHashes[i - 1], zeroHashes[i - 1])
    }

    return zeroHashes
}

export const ZERO_HASHES = computeZeroHashes()

export class StaticMerkleTree {
    public leaves: bigint[]
    public levels: bigint[][]

    constructor(secrets: bigint[]) {
        this.leaves = secrets.map((s) => hashLeaf(s))
        this.levels = []
        this.buildTree()
    }

    private buildTree(): void {
        let currentLevel = this.leaves
        this.levels.push(currentLevel)

        for (let level = 0; level < TREE_DEPTH; level++) {
            const nextLevel: bigint[] = []
            const activeCount = currentLevel.length
            const parentCount = Math.ceil(activeCount / 2)

            for (let i = 0; i < parentCount; i++) {
                const left = currentLevel[2 * i]
                const right =
                    2 * i + 1 < activeCount
                        ? currentLevel[2 * i + 1]
                        : ZERO_HASHES[level]
                nextLevel.push(hashPair(left, right))
            }
            currentLevel = nextLevel
            this.levels.push(currentLevel)
        }
    }

    getRoot(): bigint {
        return this.levels[TREE_DEPTH][0] ?? ZERO_HASHES[TREE_DEPTH]
    }

    getMerklePath(index: number): { path: bigint[]; pathIndices: bigint[] } {
        const path: bigint[] = []
        const pathIndices: bigint[] = []
        let currentIndex = index

        for (let level = 0; level < TREE_DEPTH; level++) {
            const isRight = currentIndex % 2 === 1
            const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1

            const levelNodes = this.levels[level]
            const siblingHash =
                siblingIndex < levelNodes.length
                    ? levelNodes[siblingIndex]
                    : ZERO_HASHES[level]

            path.push(siblingHash)
            pathIndices.push(isRight ? 1n : 0n)

            currentIndex = Math.floor(currentIndex / 2)
        }

        return { path, pathIndices }
    }
}
