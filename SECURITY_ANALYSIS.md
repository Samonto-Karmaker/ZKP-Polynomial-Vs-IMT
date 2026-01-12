## Security Analysis and Proofs

In this section, we formalize the security properties of **Polynomial Equation Batching (PEB)** and compare them against **Incremental Merkle Trees (IMT)** under a unified authenticated accumulator model. We show that PEB satisfies all core security properties traditionally required of IMTs and is therefore **at least as secure**, under standard cryptographic assumptions.

---

### Model and Notation

Let $ \mathbb{F} $ be a finite field of size exponential in the security parameter $ \lambda $. Let Poseidon be modeled as a collision-resistant hash function.

#### Polynomial Equation Batching (PEB)

The membership structure is defined by a polynomial:

$$
P(x) = \prod_{i=1}^{n} (x - r_i)
$$

where each $ r_i \in \mathbb{F} $ represents a registered user.

Membership is proven by showing:

$$
P(s) = 0
$$

for a private witness $ s = r_i $.

The committed state is the hash of all coefficients of $ P $.

#### Incremental Merkle Tree (IMT)

The membership structure is a binary Merkle tree where each leaf corresponds to a user commitment. The committed state is the Merkle root.

Membership is proven via a Merkle authentication path.

---

### Security Properties

We analyze six standard security properties.

---

### Correctness

**Definition.** For any honestly constructed structure and any registered user $ r_i $, an honest prover can generate a proof that is accepted by the verifier.

**PEB.** Since $ r_i $ is a root of $ P(x) $, evaluation yields $ P(r_i) = 0 $. The circuit enforces this condition explicitly. Therefore, honest membership proofs always verify.

**IMT.** Correctness follows from the correctness of Merkle authentication paths.

**Conclusion.** Both constructions satisfy correctness.

---

### Membership Soundness

**Definition.** No probabilistic polynomial-time (PPT) adversary can produce a valid proof for an element not in the committed set.

**PEB.** Suppose an adversary produces $ s $ such that $ P(s) = 0 $ but $ s \notin \{r_1, \dots, r_n\} $. This implies finding a nontrivial root of $ P(x) $ without knowledge of the factorization, which contradicts the binding of the polynomial commitment and the soundness of the ZK proof system.

**IMT.** Soundness reduces to the collision resistance of the hash function.

**Conclusion.** Membership soundness in PEB is at least as strong as IMT.

---

### State Binding

**Definition.** A committed state uniquely binds to a single set of members.

**PEB.** The commitment is the Poseidon hash of all polynomial coefficients. Any change to the member set alters at least one coefficient, producing a different commitment. Under hash collision resistance, the committed polynomial is binding.

**IMT.** The Merkle root binds the entire tree structure.

**Conclusion.** PEB achieves equivalent state binding to IMT.

---

### Append-Only Consistency

**Definition.** The structure evolves monotonically; previous members remain valid after updates.

**PEB.** Appending a user corresponds to multiplying $ P(x) $ by $ (x - r) $. This operation is verifiable and monotonic. Deletions are disallowed without additional proofs, preserving append-only consistency.

**IMT.** New leaves are appended, and internal nodes are recomputed. Deletions are not supported.

**Conclusion.** Both constructions satisfy append-only consistency.

---

### Public Verifiability

**Definition.** Any verifier can check membership proofs using only public data.

**PEB.** Verification requires the public polynomial commitment and the zero-knowledge proof. No secret state is needed.

**IMT.** Verification requires the public Merkle root and authentication path.

**Conclusion.** Both systems are publicly verifiable.

---

### Revocation Support

**Definition.** Ability to invalidate previously valid members without compromising security.

**PEB.** Revocation is supported via auxiliary append-only structures (e.g., revocation polynomials or epochs). Direct deletion is algebraically possible but cryptographically disallowed to preserve state binding.

**IMT.** Revocation is handled via revocation lists or epoch-based trees.

**Conclusion.** PEB supports revocation under the same assumptions as IMT.

---

### Security Theorem

**Theorem 1.** Assuming collision resistance of Poseidon and soundness of the underlying zero-knowledge proof system, Polynomial Equation Batching satisfies correctness, membership soundness, state binding, append-only consistency, public verifiability, and revocation support. Moreover, it is **at least as secure** as Incremental Merkle Trees under the authenticated accumulator model.

**Proof Sketch.** Each security property of IMT reduces to either hash collision resistance or monotonic state evolution. PEB satisfies the same properties under identical assumptions. Therefore, any successful attack on PEB implies a corresponding attack on IMT or on the underlying cryptographic primitives.

---

### Discussion

The empirical results demonstrate that PEB achieves equivalent security guarantees while significantly outperforming IMT in population time and maintaining comparable proof sizes and verification costs. Thus, PEB offers a strictly better performance–security tradeoff for large-scale membership systems.

---

**Conclusion.** Polynomial Equation Batching is a secure, efficient, and scalable alternative to Incremental Merkle Trees for append-only membership verification.
