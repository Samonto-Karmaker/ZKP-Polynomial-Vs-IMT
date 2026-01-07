const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const { spawnSync } = require("child_process")

// Import Helpers
const imtHelper = require("./IMT/utils/benchmark_imt_helper")
const polyHelper = require("./polynomial/utils/benchmark_poly_helper")

// Argument parsing
const args = process.argv.slice(2)
const isDryRun = args.includes("--dry-run")

// --- Configuration ---
const USER_COUNTS = [128, 256, 512, 1024, 2048, 4096, 8192, 16384]
const specificCount = args.find((a) => a.startsWith("--count="))?.split("=")[1]
const TARGET_COUNTS = specificCount ? [parseInt(specificCount)] : USER_COUNTS
const SAMPLE_SIZE = 5 // Randomly sample 5 users for timing
// Output Handling
const suffix = isDryRun ? "_dryrun.csv" : ".csv"
const IMT_CSV_FILE = `imt_results${suffix}`
const POLY_CSV_FILE = `polynomial_results${suffix}`
const USERS_DB_FILE = "users.csv"

// Fixed test config
const VERIFIER_KEY = "benchmark_vk_123"
const FIELD_PRIME =
    21888242871839275222246405745257275088548364400416034343698204186575808495617n

// State management
let IMT_TREE = null
let POLY_BATCHES = []
let POLY_ROOTS = []
let POLY_USER_MAP = new Map()

// --- Utilities ---

function log(msg) {
    console.log(
        `[${new Date().toISOString().split("T")[1].split(".")[0]}] ${msg}`
    )
}

function hashToField(input) {
    const hash = crypto.createHash("sha256").update(input).digest("hex")
    return BigInt("0x" + hash) % FIELD_PRIME
}

function execute(command, cwd) {
    const start = process.hrtime.bigint()
    // Split command strictly by spaces, preserving quoted arguments if simple
    // For this script, commands are simple literals
    const [cmd, ...args] = command.split(" ")

    // On Windows, npm is a batch file
    const actualCmd =
        process.platform === "win32" && cmd === "npm" ? "npm.cmd" : cmd

    const result = spawnSync(actualCmd, args, {
        cwd,
        encoding: "utf-8",
        shell: true,
    })

    const end = process.hrtime.bigint()
    const durationMs = Number(end - start) / 1_000_000

    if (result.status !== 0) {
        throw new Error(
            `Command failed: ${command}\nStderr: ${result.stderr}\nStdout: ${result.stdout}`
        )
    }

    return durationMs
}

function getFileSize(filePath) {
    try {
        return fs.statSync(filePath).size
    } catch (e) {
        return 0
    }
}

function getDirSize(dirPath) {
    let size = 0
    try {
        const files = fs.readdirSync(dirPath)
        for (const file of files) {
            const stats = fs.statSync(path.join(dirPath, file))
            if (stats.isFile()) size += stats.size
        }
    } catch (e) {}
    return size
}

// --- User Management ---

function loadUsers() {
    if (!fs.existsSync(USERS_DB_FILE)) return []
    const content = fs.readFileSync(USERS_DB_FILE, "utf-8")
    // Skip header
    const lines = content
        .split("\n")
        .slice(1)
        .filter((l) => l.trim().length > 0)
    return lines.map((line) => {
        const [email, secretStr, salt] = line.split(",")
        return { email, secret: BigInt(secretStr), salt }
    })
}

function saveUsers(users) {
    const lines = ["email,secret,salt"]
    users.forEach((u) =>
        lines.push(`${u.email},${u.secret.toString()},${u.salt}`)
    )
    fs.writeFileSync(USERS_DB_FILE, lines.join("\n"))
}

function generateNewUsers(currentUsers, targetCount) {
    const needed = targetCount - currentUsers.length
    if (needed <= 0) return []

    log(`Generating ${needed} new users...`)
    const newUsers = []
    for (let i = 0; i < needed; i++) {
        const email = `user_${currentUsers.length + i}_${Date.now()}@test.com`
        const salt = crypto.randomBytes(8).toString("hex")
        const secret = hashToField(email + salt)
        newUsers.push({ email, secret, salt })
    }
    return newUsers
}

// --- Benchmark Runner ---

async function runBenchmark() {
    log(`🚀 Starting Benchmark [Dry Run: ${isDryRun}]`)

    // Initialize results CSVs
    if (!fs.existsSync(IMT_CSV_FILE)) {
        fs.writeFileSync(
            IMT_CSV_FILE,
            "user_count,proof_size_bytes,proof_gen_time_ms,vk_size_bytes,verification_time_ms,total_population_time_ms,avg_population_time_ms,total_structure_storage_bytes\n"
        )
    }
    if (!fs.existsSync(POLY_CSV_FILE)) {
        fs.writeFileSync(
            POLY_CSV_FILE,
            "user_count,proof_size_bytes,proof_gen_time_ms,vk_size_bytes,verification_time_ms,total_population_time_ms,avg_population_time_ms,total_structure_storage_bytes\n"
        )
    }

    let existingUsers = loadUsers()
    let totalPopulationTimeIMT = 0
    let totalPopulationTimePoly = 0

    // Install dependencies once
    log("Installing dependencies...")
    execute("npm install", "./IMT")
    execute("npm install", "./polynomial")

    for (const count of TARGET_COUNTS) {
        log(`\n=== Processing User Count: ${count} ===`)

        // 1. Generate incremental users
        const newUsers = generateNewUsers(existingUsers, count)
        existingUsers = [...existingUsers, ...newUsers]
        saveUsers(existingUsers)

        const newSecrets = newUsers.map((u) => u.secret)
        const allSecrets = existingUsers.slice(0, count).map((u) => u.secret)

        // --- System 1: IMT ---
        log(`[IMT] Populating tree...`)
        const startIMT = process.hrtime.bigint()
        IMT_TREE = imtHelper.createIncrementalIMT(IMT_TREE, newSecrets)
        const endIMT = process.hrtime.bigint()
        const popTimeIMT = Number(endIMT - startIMT) / 1_000_000
        totalPopulationTimeIMT += popTimeIMT

        // Storage Measurement
        const imtCsv = imtHelper.serializeIMTtoCSV(IMT_TREE)
        const imtStorageFile = "temp_imt_storage.csv"
        fs.writeFileSync(imtStorageFile, imtCsv)
        const imtStorageSize = getFileSize(imtStorageFile)

        // --- System 2: Polynomial ---
        log(`[Poly] Populating batches...`)
        const startPoly = process.hrtime.bigint()
        const polyState = polyHelper.addSecretsToBatches(
            POLY_BATCHES,
            POLY_ROOTS,
            POLY_USER_MAP,
            newSecrets
        )
        POLY_BATCHES = polyState.batches
        POLY_ROOTS = polyState.batchRoots
        POLY_USER_MAP = polyState.userMap
        const endPoly = process.hrtime.bigint()
        const popTimePoly = Number(endPoly - startPoly) / 1_000_000
        totalPopulationTimePoly += popTimePoly

        // Storage Measurement
        const polyCoeffsCsv = polyHelper.serializePolynomialToCSV(POLY_BATCHES)
        const polyMapCsv = polyHelper.serializeUserBatchMapToCSV(POLY_USER_MAP)
        const polyStorageFile = "temp_poly_storage.csv"
        const polyMapFile = "temp_poly_map.csv"
        fs.writeFileSync(polyStorageFile, polyCoeffsCsv)
        fs.writeFileSync(polyMapFile, polyMapCsv)
        const polyStorageSize =
            getFileSize(polyStorageFile) + getFileSize(polyMapFile)

        // --- Proof Generation & Verification Sampling ---
        const sampleUsers = []
        // Pick random samples from the CURRENT pool of 'count' users
        const availableIndices = Array.from({ length: count }, (_, i) => i)
        for (let i = 0; i < Math.min(SAMPLE_SIZE, count); i++) {
            const randIdx = Math.floor(Math.random() * availableIndices.length)
            const userIdx = availableIndices[randIdx]
            availableIndices.splice(randIdx, 1) // remove to avoid duplicate
            sampleUsers.push({ index: userIdx, secret: allSecrets[userIdx] })
        }

        log(`Sampling ${sampleUsers.length} users for proofs...`)

        // Measure IMT
        let metricsIMT = await measureCircuit(
            "IMT",
            "./IMT",
            "b2b_membership_imt",
            sampleUsers,
            (user) =>
                imtHelper.generateProverToml(
                    IMT_TREE,
                    user.index,
                    user.secret,
                    hashToField(VERIFIER_KEY)
                )
        )

        // Measure Poly
        let metricsPoly = await measureCircuit(
            "Poly",
            "./polynomial",
            "b2b_membership",
            sampleUsers,
            (user) => {
                const secretStr = user.secret.toString()
                const batchIdx = POLY_USER_MAP.get(secretStr)
                const batch = POLY_BATCHES[batchIdx]
                return polyHelper.generateProverToml(
                    batch,
                    user.secret,
                    hashToField(VERIFIER_KEY)
                )
            }
        )

        // Log Results
        appendResult(
            IMT_CSV_FILE,
            count,
            metricsIMT,
            getFileSize("./IMT/circuit/target/vk"),
            totalPopulationTimeIMT,
            imtStorageSize
        )
        appendResult(
            POLY_CSV_FILE,
            count,
            metricsPoly,
            getFileSize("./polynomial/circuit/target/vk"),
            totalPopulationTimePoly,
            polyStorageSize
        )

        // Cleanup temp files if not keeping them
        if (!isDryRun) {
            try {
                fs.unlinkSync(imtStorageFile)
            } catch (e) {}
            try {
                fs.unlinkSync(polyStorageFile)
            } catch (e) {}
            try {
                fs.unlinkSync(polyMapFile)
            } catch (e) {}
        }
    }

    log("🏁 Benchmark Complete!")
}

async function measureCircuit(name, cwd, circuitName, sampleUsers, inputGenFn) {
    let totalProofTime = 0
    let totalVerifyTime = 0
    let proofSize = 0

    // Compile once per count (assumes circuit doesn't change based on number of users, which is true for these fixed-depth/fixed-batch circuits)
    log(`[${name}] Compiling circuit...`)
    execute("nargo compile", path.join(cwd, "circuit"))

    for (const user of sampleUsers) {
        // Generate Input
        const inputs = inputGenFn(user)
        fs.writeFileSync(
            path.join(cwd, "circuit/Prover.toml"),
            inputs.proverToml
        )

        // Generate Witness
        execute("nargo execute", path.join(cwd, "circuit"))

        // Generate VK (needed once, but doing loop for simplicity as it's fast)
        execute(
            `bb write_vk -b ./target/${circuitName}.json -o ./target --oracle_hash keccak`,
            path.join(cwd, "circuit")
        )

        // Prove
        const t0 = process.hrtime.bigint()
        execute(
            `bb prove -b ./target/${circuitName}.json -w ./target/${circuitName}.gz -o ./target --oracle_hash keccak`,
            path.join(cwd, "circuit")
        )
        const t1 = process.hrtime.bigint()
        totalProofTime += Number(t1 - t0) / 1_000_000

        // Verify
        const v0 = process.hrtime.bigint()
        execute(
            `bb verify -k ./target/vk -p ./target/proof --oracle_hash keccak`,
            path.join(cwd, "circuit")
        )
        const v1 = process.hrtime.bigint()
        totalVerifyTime += Number(v1 - v0) / 1_000_000

        // Capture size
        proofSize = getFileSize(path.join(cwd, "circuit/target/proof"))
    }

    return {
        proofTime: totalProofTime / sampleUsers.length,
        verifyTime: totalVerifyTime / sampleUsers.length,
        proofSize: proofSize,
    }
}

function appendResult(file, count, metrics, vkSize, totalPopTime, storageSize) {
    const line = `${count},${metrics.proofSize},${metrics.proofTime.toFixed(
        2
    )},${vkSize},${metrics.verifyTime.toFixed(2)},${totalPopTime.toFixed(2)},${(
        totalPopTime / count
    ).toFixed(4)},${storageSize}`
    fs.appendFileSync(file, line + "\n")
    log(`Recorded result for ${count} users in ${file}`)
}

// Start
try {
    runBenchmark()
} catch (e) {
    console.error("CRITICAL ERROR:", e)
    process.exit(1)
}
