use dep::poseidon::poseidon2;

// Tree depth determines max members: 2^TREE_DEPTH
// Depth 20 = ~1M members, Depth 10 = 1024 members
global TREE_DEPTH: u32 = 20;

fn main(
    // Public inputs
    merkle_root: pub Field,
    nullifier: pub Field,
    verifier_key: pub Field,
    // Private inputs
    secret: Field,
    isKYCed: bool,
    leaf_index: Field,
    merkle_path: [Field; TREE_DEPTH],
    path_indices: [Field; TREE_DEPTH],
) {
    // 1. Verify KYC status
    assert(isKYCed == true, "KYC verification required");

    // 2. Compute leaf hash from secret
    let leaf = poseidon2::Poseidon2::hash([secret], 1);

    // 3. Compute Merkle root from leaf and path
    let mut current_hash = leaf;
    
    for i in 0..TREE_DEPTH {
        let path_element = merkle_path[i];
        let is_right = path_indices[i];
        
        // If is_right == 1, current_hash is on the right side
        // If is_right == 0, current_hash is on the left side
        let (left, right) = if is_right == 1 {
            (path_element, current_hash)
        } else {
            (current_hash, path_element)
        };
        
        current_hash = poseidon2::Poseidon2::hash([left, right], 2);
    }

    // 4. Verify computed root matches the public merkle_root
    assert(current_hash == merkle_root, "Merkle root mismatch: not a member");

    // 5. Verify leaf_index consistency with path_indices
    // path_indices encodes the position: bit i of leaf_index should equal path_indices[i]
    let mut reconstructed_index: Field = 0;
    let mut power_of_two: Field = 1;
    
    for i in 0..TREE_DEPTH {
        reconstructed_index = reconstructed_index + path_indices[i] * power_of_two;
        power_of_two = power_of_two * 2;
    }
    assert(reconstructed_index == leaf_index, "Leaf index mismatch");

    // 6. Generate and verify nullifier (prevent double-use)
    let computed_nullifier = poseidon2::Poseidon2::hash([secret, verifier_key], 2);
    assert(computed_nullifier == nullifier, "Nullifier mismatch");
}

// Helper function to compute empty leaf value (used for tree initialization)
fn get_zero_value() -> Field {
    // Empty leaf is hash of zero
    poseidon2::Poseidon2::hash([0], 1)
}
