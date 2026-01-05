// merkle_tree.ts - Incremental Merkle Tree implementation for B2B Membership ZKP
// Compatible with the Noir circuit in circuit/src/main.nr

export const bn_254_fp =
    21888242871839275222246405745257275088548364400416034343698204186575808495617n

// Tree depth (must match main.nr)
export const TREE_DEPTH = 20

// Maximum number of leaves: 2^TREE_DEPTH
export const MAX_LEAVES = 2n ** BigInt(TREE_DEPTH)

// Import poseidon2 for hashing (same as polynomial module)
import { poseidon2Hash } from "@zkpassport/poseidon2"

const mod = (x: bigint, f: bigint = bn_254_fp): bigint => {
    const result = x % f
    return result >= 0n ? result : result + f
}

/**
 * Compute Poseidon2 hash with proper field element handling
 */
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

/**
 * Compute leaf hash from secret
 */
export function hashLeaf(secret: bigint): bigint {
    return poseidon2([secret])
}

/**
 * Compute parent hash from two children
 */
export function hashPair(left: bigint, right: bigint): bigint {
    return poseidon2([left, right])
}

/**
 * Get zero value for empty leaves
 */
export function getZeroValue(): bigint {
    return poseidon2([0n])
}

/**
 * Precompute zero hashes for each level of the tree
 * zeroHashes[i] = hash of empty subtree of height i
 */
function computeZeroHashes(): bigint[] {
    const zeroHashes: bigint[] = new Array(TREE_DEPTH + 1)
    zeroHashes[0] = getZeroValue() // Zero leaf

    for (let i = 1; i <= TREE_DEPTH; i++) {
        zeroHashes[i] = hashPair(zeroHashes[i - 1], zeroHashes[i - 1])
    }

    return zeroHashes
}

export const ZERO_HASHES = computeZeroHashes()

/**
 * Incremental Merkle Tree class
 * Supports efficient insertions and Merkle path generation
 */
export class IncrementalMerkleTree {
    private leaves: bigint[]
    private nodes: Map<string, bigint> // Cache for internal nodes
    private nextIndex: number

    constructor() {
        this.leaves = []
        this.nodes = new Map()
        this.nextIndex = 0
    }

    /**
     * Get the current number of leaves
     */
    get length(): number {
        return this.nextIndex
    }

    /**
     * Insert a new leaf into the tree
     * @param leaf - The leaf value (should be hashLeaf(secret))
     * @returns The index of the inserted leaf
     */
    insert(leaf: bigint): number {
        if (this.nextIndex >= Number(MAX_LEAVES)) {
            throw new Error(`Tree is full: max ${MAX_LEAVES} leaves`)
        }

        const index = this.nextIndex
        this.leaves[index] = leaf

        // Update the path from leaf to root
        this.updatePath(index)

        this.nextIndex++
        return index
    }

    /**
     * Insert a member by their secret
     * @param secret - The member's secret
     * @returns The index of the inserted leaf
     */
    insertMember(secret: bigint): number {
        const leaf = hashLeaf(secret)
        return this.insert(leaf)
    }

    /**
     * Update a leaf at a given index
     * @param index - The leaf index to update
     * @param newLeaf - The new leaf value
     */
    update(index: number, newLeaf: bigint): void {
        if (index < 0 || index >= this.nextIndex) {
            throw new Error(`Invalid index: ${index}`)
        }

        this.leaves[index] = newLeaf
        this.updatePath(index)
    }

    /**
     * Delete a member by setting their leaf to zero
     * @param index - The leaf index to delete
     */
    delete(index: number): void {
        this.update(index, getZeroValue())
    }

    /**
     * Update internal nodes along the path from leaf to root
     */
    private updatePath(index: number): void {
        let currentIndex = index
        let currentHash = this.leaves[index]

        for (let level = 0; level < TREE_DEPTH; level++) {
            const isRight = currentIndex % 2 === 1
            const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1
            const parentIndex = Math.floor(currentIndex / 2)

            // Get sibling hash
            let siblingHash: bigint
            if (level === 0) {
                siblingHash = this.leaves[siblingIndex] ?? getZeroValue()
            } else {
                siblingHash =
                    this.getNode(level, siblingIndex) ?? ZERO_HASHES[level]
            }

            // Compute parent hash
            const [left, right] = isRight
                ? [siblingHash, currentHash]
                : [currentHash, siblingHash]
            const parentHash = hashPair(left, right)

            // Store parent node
            this.setNode(level + 1, parentIndex, parentHash)

            currentIndex = parentIndex
            currentHash = parentHash
        }
    }

    private getNodeKey(level: number, index: number): string {
        return `${level}:${index}`
    }

    private getNode(level: number, index: number): bigint | undefined {
        return this.nodes.get(this.getNodeKey(level, index))
    }

    private setNode(level: number, index: number, value: bigint): void {
        this.nodes.set(this.getNodeKey(level, index), value)
    }

    /**
     * Get the current Merkle root
     */
    getRoot(): bigint {
        if (this.nextIndex === 0) {
            // Empty tree: root is hash of all zeros
            return ZERO_HASHES[TREE_DEPTH]
        }

        return this.getNode(TREE_DEPTH, 0) ?? ZERO_HASHES[TREE_DEPTH]
    }

    /**
     * Get Merkle path for a leaf
     * @param index - The leaf index
     * @returns Object with path (sibling hashes) and pathIndices (bit representation)
     */
    getMerklePath(index: number): { path: bigint[]; pathIndices: bigint[] } {
        if (index < 0 || index >= this.nextIndex) {
            throw new Error(`Invalid index: ${index}`)
        }

        const path: bigint[] = []
        const pathIndices: bigint[] = []

        let currentIndex = index

        for (let level = 0; level < TREE_DEPTH; level++) {
            const isRight = currentIndex % 2 === 1
            const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1

            // Get sibling hash
            let siblingHash: bigint
            if (level === 0) {
                siblingHash = this.leaves[siblingIndex] ?? getZeroValue()
            } else {
                siblingHash =
                    this.getNode(level, siblingIndex) ?? ZERO_HASHES[level]
            }

            path.push(siblingHash)
            pathIndices.push(isRight ? 1n : 0n)

            currentIndex = Math.floor(currentIndex / 2)
        }

        return { path, pathIndices }
    }

    /**
     * Get leaf at index
     */
    getLeaf(index: number): bigint | undefined {
        return this.leaves[index]
    }
}

/**
 * Verify a Merkle proof locally
 * @param leaf - The leaf value
 * @param index - The leaf index
 * @param path - Sibling hashes
 * @param pathIndices - Path direction bits
 * @param root - Expected root
 * @returns true if proof is valid
 */
export function verifyMerkleProof(
    leaf: bigint,
    index: number,
    path: bigint[],
    pathIndices: bigint[],
    root: bigint
): boolean {
    if (path.length !== TREE_DEPTH || pathIndices.length !== TREE_DEPTH) {
        return false
    }

    // Verify index matches pathIndices
    let reconstructedIndex = 0n
    let powerOfTwo = 1n
    for (let i = 0; i < TREE_DEPTH; i++) {
        reconstructedIndex += pathIndices[i] * powerOfTwo
        powerOfTwo *= 2n
    }

    if (reconstructedIndex !== BigInt(index)) {
        return false
    }

    // Compute root from leaf and path
    let currentHash = leaf
    for (let i = 0; i < TREE_DEPTH; i++) {
        const isRight = pathIndices[i] === 1n
        const [left, right] = isRight
            ? [path[i], currentHash]
            : [currentHash, path[i]]
        currentHash = hashPair(left, right)
    }

    return currentHash === root
}

// Self-test when run directly
if (require.main === module) {
    console.log("=== Testing Incremental Merkle Tree ===\n")

    // Create tree
    const tree = new IncrementalMerkleTree()
    console.log("1️⃣ Created empty tree")
    console.log(`   Initial root: ${tree.getRoot()}`)
    console.log(`   Tree depth: ${TREE_DEPTH}`)

    // Insert some members
    const secrets = [123n, 456n, 789n]
    const indices: number[] = []

    console.log("\n2️⃣ Inserting members...")
    for (const secret of secrets) {
        const idx = tree.insertMember(secret)
        indices.push(idx)
        console.log(`   Inserted secret ${secret} at index ${idx}`)
    }

    console.log(`\n   Root after insertions: ${tree.getRoot()}`)

    // Generate and verify Merkle proofs
    console.log("\n3️⃣ Verifying Merkle proofs...")
    for (let i = 0; i < secrets.length; i++) {
        const secret = secrets[i]
        const index = indices[i]
        const leaf = hashLeaf(secret)
        const { path, pathIndices } = tree.getMerklePath(index)
        const root = tree.getRoot()

        const isValid = verifyMerkleProof(leaf, index, path, pathIndices, root)
        console.log(
            `   Secret ${secret} at index ${index}: ${isValid ? "✅" : "❌"}`
        )
    }

    // Test invalid proof
    console.log("\n4️⃣ Testing invalid proof...")
    const fakeSecret = 999n
    const fakeLeaf = hashLeaf(fakeSecret)
    const { path, pathIndices } = tree.getMerklePath(0)
    const isInvalid = verifyMerkleProof(
        fakeLeaf,
        0,
        path,
        pathIndices,
        tree.getRoot()
    )
    console.log(
        `   Fake secret 999: ${
            isInvalid ? "❌ PROBLEM" : "✅ Correctly rejected"
        }`
    )

    // Test update
    console.log("\n5️⃣ Testing update...")
    const oldRoot = tree.getRoot()
    const newSecret = 111n
    tree.update(0, hashLeaf(newSecret))
    const newRoot = tree.getRoot()
    console.log(`   Updated index 0 with new secret`)
    console.log(`   Root changed: ${oldRoot !== newRoot ? "✅" : "❌"}`)

    // Verify new secret works
    const newLeaf = hashLeaf(newSecret)
    const newPath = tree.getMerklePath(0)
    const newProofValid = verifyMerkleProof(
        newLeaf,
        0,
        newPath.path,
        newPath.pathIndices,
        newRoot
    )
    console.log(`   New secret verifies: ${newProofValid ? "✅" : "❌"}`)

    // Test delete
    console.log("\n6️⃣ Testing delete...")
    tree.delete(1)
    const deletedLeaf = tree.getLeaf(1)
    const zeroLeaf = getZeroValue()
    console.log(`   Deleted index 1`)
    console.log(`   Leaf is zero: ${deletedLeaf === zeroLeaf ? "✅" : "❌"}`)

    console.log("\n" + "=".repeat(50))
    console.log("🎉 All Merkle tree tests completed!")
}
