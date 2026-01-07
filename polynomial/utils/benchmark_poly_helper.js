// polynomial/utils/benchmark_poly_helper.js
const {
    realPoseidon2Hash,
    FIELD_PRIME,
} = require("./test_data_generator")

// Helper to keep numbers in the field
const mod = (x, f = FIELD_PRIME) => {
    const result = x % f
    return result >= 0n ? result : result + f
}

/**
 * Adds a root to an existing polynomial.
 * Multiplies P(x) by (x - root).
 * P_new(x) = P(x) * (x - root) = P(x) * x - P(x) * root
 * @param {bigint[]} oldPoly - Coefficients of P(x) from x^0 to x^n
 * @param {bigint} newRoot - The root to add
 * @returns {bigint[]} - Coefficients of P_new(x)
 */
function addRoot(oldPoly, newRoot) {
    const newPoly = new Array(oldPoly.length + 1).fill(0n)

    for (let i = 0; i < oldPoly.length; i++) {
        // x term: P(x) * x
        // The coefficient of x^i in P(x) becomes the coefficient of x^(i+1)
        newPoly[i + 1] = mod(newPoly[i + 1] + oldPoly[i])

        // constant term: P(x) * (-root)
        // The coefficient of x^i in P(x) contributes to x^i
        newPoly[i] = mod(newPoly[i] - mod(oldPoly[i] * newRoot))
    }

    return newPoly
}

// Global constant matching circuit
const MAX_POLY_DEGREE = 128

/**
 * Adds new secrets to existing batches or creates new batches.
 * @param {Array<bigint[]>} batches - Array of polynomial coefficient arrays [batch1, batch2...]
 * @param {Array<bigint[]>} batchRoots - Array of roots for each batch (to allow adding more)
 * @param {bigint[]} newSecrets - New secrets to add
 * @returns {object} { batches, batchRoots, userMap } - Updated state and user->batch map
 */
function addSecretsToBatches(
    batches = [],
    batchRoots = [],
    userMap = new Map(),
    newSecrets
) {
    // Deep copy to avoid mutating inputs directly if passed by reference
    const currentBatches = [...batches]
    const currentRoots = batchRoots.map((r) => [...r])
    // userMap maps secret (string) -> { batchIndex, localIndex }

    for (const secret of newSecrets) {
        let inserted = false

        // Try to fit in existing batch
        for (let i = 0; i < currentRoots.length; i++) {
            if (currentRoots[i].length < MAX_POLY_DEGREE) {
                currentRoots[i].push(secret)

                // Efficiently update the polynomial by adding one root
                currentBatches[i] = addRoot(currentBatches[i], secret)

                userMap.set(secret.toString(), i) // Track which batch this user belongs to
                inserted = true
                break
            }
        }

        // If no space, create new batch
        if (!inserted) {
            const newBatchRoots = [secret]

            // Start with polynomial P(x) = 1 (empty roots)
            // Then add the first root
            let newBatchPoly = [1n]
            newBatchPoly = addRoot(newBatchPoly, secret)

            currentRoots.push(newBatchRoots)
            currentBatches.push(newBatchPoly)
            userMap.set(secret.toString(), currentRoots.length - 1)
        }
    }

    return {
        batches: currentBatches,
        batchRoots: currentRoots,
        userMap,
    }
}

/**
 * Serializes all polynomial batches to CSV.
 * Format: batch_index,coeff_index,value
 */
function serializePolynomialToCSV(batches) {
    const lines = ["batch_index,coeff_index,value"]

    batches.forEach((poly, batchIdx) => {
        poly.forEach((coeff, coeffIdx) => {
            lines.push(`${batchIdx},${coeffIdx},${coeff.toString()}`)
        })
    })

    return lines.join("\n")
}

/**
 * Serializes the User-to-Batch tracking map to CSV.
 * This represents the storage overhead of knowing WHICH batch a user is in.
 * Format: user_secret_hash,batch_index
 */
function serializeUserBatchMapToCSV(userMap) {
    const lines = ["user_secret,batch_index"]

    for (const [secret, batchIdx] of userMap.entries()) {
        lines.push(`${secret},${batchIdx}`)
    }

    return lines.join("\n")
}

/**
 * Generates Prover.toml for a specific user and their batch
 */
function generateProverToml(batchPoly, secret, verifierKey) {
    // Pad polynomial to MAX_POLY_DEGREE
    const paddedPoly = [...batchPoly]
    while (paddedPoly.length <= MAX_POLY_DEGREE) paddedPoly.push(0n)

    // Hash polynomial
    const polynomialHash = realPoseidon2Hash(paddedPoly)

    // Generate nullifier
    const nullifier = realPoseidon2Hash([secret, verifierKey])

    const proverToml = `isKYCed = true
nullifier = "${nullifier}"
polynomial = [${paddedPoly.map((p) => `"${p}"`).join(", ")}]
polynomial_hash = "${polynomialHash}"
secret = "${secret}"
verifier_key = "${verifierKey}"`

    return {
        proverToml,
        polynomialHash,
        nullifier,
    }
}

module.exports = {
    addSecretsToBatches,
    serializePolynomialToCSV,
    serializeUserBatchMapToCSV,
    generateProverToml,
    addRoot,
}
