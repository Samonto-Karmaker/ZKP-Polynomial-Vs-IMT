# Zero Knowledge Proof Experimentation & Benchmarking

This repository contains experimentation code designed to benchmark and compare two different approaches for Zero Knowledge set membership proofs:

1. **Incremental Merkle Trees (IMT)**
2. **Polynomial Batching**

The project implements these systems using [Noir](https://noir-lang.org/) for the circuits and [Barretenberg](https://github.com/AztecProtocol/barretenberg) as the proving backend.

## Project Structure

-   **`benchmark.js`**: The main orchestration script that runs the experiments, manages user data generation, and logs performance metrics.
-   **`IMT/`**: Contains the implementation for the Incremental Merkle Tree approach, including Noir circuits (`circuit/`) and helper scripts (`utils/`).
-   **`polynomial/`**: Contains the implementation for the Polynomial approach, with its own circuits and helpers.
-   **`imt_results.csv` & `polynomial_results.csv`**: Output files where benchmark metrics are recorded.

## Prerequisites

### Benchmarks

Before running the benchmarks, ensure you have the following installed and available in your system path:

-   **Node.js** (v16 or higher)
-   **Nargo** (Noir Compiler)
-   **Barretenberg** (`bb` CLI tool)

### Results Notebook

To explore and visualise the benchmark results, the following are required:

-   **Python 3** (v3.8 or higher)
-   The following Python packages (installable via `pip`):

    ```bash
    pip install pandas matplotlib seaborn numpy
    ```

-   **Jupyter** (to run locally):

    ```bash
    pip install jupyter
    ```

## Usage

To run the full suite of benchmarks across all configured user counts:

```bash
node benchmark.js
```

### Options

-   **Dry Run**: Run the pipeline without generating full proofs (faster, for testing logic).
    ```bash
    node benchmark.js --dry-run
    ```
-   **Specific User Count**: Run the benchmark for a specific population size (e.g., 1024 users).
    ```bash
    node benchmark.js --count=1024
    ```

## Output Metrics

The benchmarks measure and record the following metrics in the CSV results files:

-   **Proof Generation Time**: Time taken to generate a valid proof.
-   **Verification Time**: Time taken to verify the proof.
-   **Proof Size**: Size of the generated proof in bytes.
-   **Storage/Population Time**: Time taken to update the data structure (Tree or Batches) with new users.
-   **Storage Size**: Structure size (e.g., coefficients or tree nodes) serialized to disk.

## Results

The results of the experiments are stored in [IMT](imt_results.csv) & [Polynomial](polynomial_results.csv).

The detailed visual comparison of the results can be found in [IMT_vs_PEB.ipynb](IMT_vs_PEB.ipynb).

## Running the Results Notebook

The notebook reads `imt_results.csv` and `polynomial_results.csv` from the **same directory** as the notebook file and saves generated graphs into a `graphs/` subdirectory (created automatically on first run).

### Option 1 — Run Locally with Jupyter

1.  Ensure all [notebook prerequisites](#results-notebook) are installed.
2.  From the repository root, launch Jupyter:

    ```bash
    jupyter notebook IMT_vs_PEB.ipynb
    ```

    Or, if you prefer JupyterLab:

    ```bash
    jupyter lab IMT_vs_PEB.ipynb
    ```

3.  In the Jupyter interface, select **Kernel → Restart & Run All** to execute all cells.
4.  Generated plots will be saved to the `graphs/` folder.

### Option 2 — Run on Google Colab

The notebook contains an **Open in Colab** badge at the top. Click it to open the notebook directly in Google Colab — no local installation required.

> **Note:** When running on Colab you will need to upload `imt_results.csv` and `polynomial_results.csv` to the Colab session storage (or mount your Google Drive) before executing the data-loading cells.
