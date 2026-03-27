import { useState } from "react";
import { connectWallet as connectMetaMask, getContract } from "../lib/blockchain";

export default function Demo() {
  const [account, setAccount] = useState("");
  const [createJobHash, setCreateJobHash] = useState("demo-job-hash");
  const [createJobPay, setCreateJobPay] = useState("1000");
  const [createJobStartTime, setCreateJobStartTime] = useState(
    `${Math.floor(Date.now() / 1000) + 3600}`
  );
  const [createJobEndTime, setCreateJobEndTime] = useState(
    `${Math.floor(Date.now() / 1000) + 7200}`
  );
  const [createJobTolerance, setCreateJobTolerance] = useState("600");

  const [acceptJobId, setAcceptJobId] = useState("1");
  const [disputeJobId, setDisputeJobId] = useState("1");
  const [disputeEvidenceHash, setDisputeEvidenceHash] = useState(
    "demo-evidence-hash"
  );

  const [loading, setLoading] = useState<string | null>(null);

  // CONNECT WALLET
  const connectWallet = async () => {
    const addr = await connectMetaMask();
    if (!addr) {
      alert("MetaMask connection failed or rejected.");
      return;
    }
    setAccount(addr);
  };

  // CALL SMART CONTRACT: createJob
  const handleCreateJob = async () => {
    try {
      setLoading("Processing transaction...");
      const contract = await getContract();
      if (!contract) {
        alert("Contract unavailable");
        return;
      }

      const tx = await contract.createJob(
        createJobHash,
        BigInt(createJobPay),
        BigInt(createJobStartTime),
        BigInt(createJobEndTime),
        BigInt(createJobTolerance)
      );

      await tx.wait();

      alert("Job created!");
    } catch (err) {
      console.error(err);
      alert("Error: " + (err as any)?.shortMessage || (err as any)?.message || "Unknown error");
    } finally {
      setLoading(null);
    }
  };

  // CALL SMART CONTRACT: acceptJob
  const handleAcceptJob = async () => {
    try {
      setLoading("Processing transaction...");
      const contract = await getContract();
      if (!contract) {
        alert("Contract unavailable");
        return;
      }

      const tx = await contract.acceptJob(BigInt(acceptJobId));
      await tx.wait();
      alert("Job accepted!");
    } catch (err) {
      console.error(err);
      alert("Error: " + (err as any)?.shortMessage || (err as any)?.message || "Unknown error");
    } finally {
      setLoading(null);
    }
  };

  // CALL SMART CONTRACT: raiseDispute
  const handleRaiseDispute = async () => {
    try {
      setLoading("Processing transaction...");
      const contract = await getContract();
      if (!contract) {
        alert("Contract unavailable");
        return;
      }

      const tx = await contract.raiseDispute(
        BigInt(disputeJobId),
        disputeEvidenceHash
      );
      await tx.wait();
      alert("Dispute raised!");
    } catch (err) {
      console.error(err);
      alert("Error: " + (err as any)?.shortMessage || (err as any)?.message || "Unknown error");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>GigStamp Demo</h1>

      {/* CONNECT WALLET */}
      <button onClick={connectWallet}>
        Connect Wallet
      </button>

      <p>Account: {account}</p>

      {loading ? (
        <p style={{ color: "#b45309", fontWeight: 600, marginTop: 8 }}>
          {loading}
        </p>
      ) : null}

      <hr style={{ margin: "16px 0" }} />

      <h2>Create Job</h2>
      <div style={{ display: "grid", gap: 8, maxWidth: 420 }}>
        <label>
          Job Hash
          <input
            value={createJobHash}
            onChange={(e) => setCreateJobHash(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
        <label>
          Pay (uint256)
          <input
            value={createJobPay}
            onChange={(e) => setCreateJobPay(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
        <label>
          Start Date (unix seconds)
          <input
            value={createJobStartTime}
            onChange={(e) => setCreateJobStartTime(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
        <label>
          End Date (unix seconds)
          <input
            value={createJobEndTime}
            onChange={(e) => setCreateJobEndTime(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
        <label>
          Tolerance (seconds)
          <input
            value={createJobTolerance}
            onChange={(e) => setCreateJobTolerance(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
        <button onClick={handleCreateJob} disabled={!!loading}>
          Create Job
        </button>
      </div>

      <hr style={{ margin: "16px 0" }} />

      <h2>Accept Job</h2>
      <div style={{ display: "grid", gap: 8, maxWidth: 420 }}>
        <label>
          JobId (uint256)
          <input
            value={acceptJobId}
            onChange={(e) => setAcceptJobId(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
        <button onClick={handleAcceptJob} disabled={!!loading}>
          Accept Job
        </button>
      </div>

      <hr style={{ margin: "16px 0" }} />

      <h2>Raise Dispute</h2>
      <div style={{ display: "grid", gap: 8, maxWidth: 420 }}>
        <label>
          JobId (uint256)
          <input
            value={disputeJobId}
            onChange={(e) => setDisputeJobId(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
        <label>
          evidenceHash (string)
          <input
            value={disputeEvidenceHash}
            onChange={(e) => setDisputeEvidenceHash(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
        <button onClick={handleRaiseDispute} disabled={!!loading}>
          Raise Dispute
        </button>
      </div>
    </div>
  );
}