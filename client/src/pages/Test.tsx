import { useState } from "react";
import { getContract } from "../lib/contract.js";

export default function Test() {
  const [result, setResult] = useState("");

  const handleClick = async () => {
    const contract = await getContract();

    // createJob(_jobHash: string, _pay: uint256, _startTime: uint256, _endTime: uint256, _tolerance: uint256)
    const tx = await contract.createJob(
      "test-job-hash",
      BigInt("1000"),
      BigInt(String(Math.floor(Date.now() / 1000) + 3600)),
      BigInt(String(Math.floor(Date.now() / 1000) + 7200)),
      BigInt("600")
    );

    await tx.wait();

    setResult("Job created!");
  };

  return (
    <div>
      <button onClick={handleClick}>
        Test Create Job
      </button>

      <p>{result}</p>
    </div>
  );
}