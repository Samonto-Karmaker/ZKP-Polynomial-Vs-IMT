#!/bin/bash

echo "Extracting circuit information..."

# Create CSV header
echo "circuit,package,function,expression_width,acir_opcodes,brillig_opcodes" > circuit_complexity.csv

# Extract IMT main function only
cd IMT/circuit
nargo info | grep "main" | awk -F'|' '
{
    gsub(/^[ \t]+|[ \t]+$/, "", $2);
    gsub(/^[ \t]+|[ \t]+$/, "", $3);
    gsub(/^[ \t]+|[ \t]+$/, "", $5);
    gsub(/^[ \t]+|[ \t]+$/, "", $6);
    if ($3 == "main") print "IMT,"$2","$3",4,"$5","$6
}' >> ../../circuit_complexity.csv

# Extract Polynomial main function only
cd ../../polynomial/circuit
nargo info | grep "main" | awk -F'|' '
{
    gsub(/^[ \t]+|[ \t]+$/, "", $2);
    gsub(/^[ \t]+|[ \t]+$/, "", $3);
    gsub(/^[ \t]+|[ \t]+$/, "", $5);
    gsub(/^[ \t]+|[ \t]+$/, "", $6);
    if ($3 == "main") print "Polynomial,"$2","$3",4,"$5","$6
}' >> ../../circuit_complexity.csv

cd ../..
echo "Done! Circuit info saved to circuit_complexity.csv"
cat circuit_complexity.csv