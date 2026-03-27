const hre = require("hardhat");
const fs = require("node:fs");
const path = require("node:path");

function upsertEnvVar(filePath, key, value) {
  let content = "";
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, "utf8");
  }

  const lineRegex = new RegExp(`^${key}=.*$`, "m");
  const newLine = `${key}=${value}`;

  if (lineRegex.test(content)) {
    content = content.replace(lineRegex, newLine);
  } else {
    if (content.length > 0 && !content.endsWith("\n")) content += "\n";
    content += newLine + "\n";
  }

  fs.writeFileSync(filePath, content, "utf8");
}

async function main() {
  const projectRoot = path.resolve(__dirname, "..");

  // Ensure artifacts are generated
  await hre.run("compile");

  const GigStamp = await hre.ethers.getContractFactory("GigStamp");
  const contract = await GigStamp.deploy();
  await contract.waitForDeployment();

  const deployedAddress = await contract.getAddress();
  console.log("Contract deployed to:", deployedAddress);

  // Load ABI from Hardhat artifacts
  const artifactPath = path.join(
    projectRoot,
    "artifacts",
    "contracts",
    "GigStamp.sol",
    "GigStamp.json"
  );

  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Missing artifact: ${artifactPath}`);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  if (!artifact.abi) {
    throw new Error(`Artifact does not contain abi: ${artifactPath}`);
  }

  // Write ABI into frontend
  const abiOutPath = path.join(projectRoot, "client", "src", "lib", "abi.json");
  fs.writeFileSync(abiOutPath, JSON.stringify(artifact.abi, null, 2) + "\n", "utf8");
  console.log("ABI written to:", abiOutPath);

  // Update env files for Vite
  const rootEnvPath = path.join(projectRoot, ".env");
  const clientEnvPath = path.join(projectRoot, "client", ".env");

  upsertEnvVar(rootEnvPath, "VITE_CONTRACT_ADDRESS", deployedAddress);
  upsertEnvVar(clientEnvPath, "VITE_CONTRACT_ADDRESS", deployedAddress);

  console.log("VITE_CONTRACT_ADDRESS injected into:");
  console.log(" - " + rootEnvPath);
  console.log(" - " + clientEnvPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});