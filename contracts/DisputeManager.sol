// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./GigStructs.sol";
import "./VoterSelector.sol";

contract DisputeManager is VoterSelector {

    // ── Storage ────────────────────────────────────────────────
    uint256 public constant VOTE_DURATION = 300; // 5 phút (đơn vị hiện là giây)
    // Để test trên Remix đổi thành: uint256 public constant VOTE_DURATION = 300; // 5 phút

    // Lưu dispute theo jobId
    // Dùng struct riêng không có mapping bên trong để tránh lỗi
    struct DisputeData {
        uint256 jobId;
        address initiator;
        string  evidenceHash;     // bằng chứng bên khởi tạo
        string  counterHash;      // bằng chứng bên kia phản hồi
        address[5] voters;        // 5 voter
        uint8   voterCount;       // thực tế có bao nhiêu voter (có thể < 5)
        uint8   votesForWorker;
        uint8   votesForClient;
        uint256 deadline;
        bool    resolved;
        bool    workerWon;
    }

    mapping(uint256 => DisputeData)              public  disputes;
    mapping(uint256 => mapping(address => bool)) public  hasVoted;
    // jobId => voter address => true/false (vote cho worker hay client)
    mapping(uint256 => mapping(address => bool)) public  voteChoice;

    // ── Events ─────────────────────────────────────────────────
    event DisputeRaised(uint256 indexed jobId, address indexed initiator);
    event CounterEvidenceSubmitted(uint256 indexed jobId, address indexed responder);
    event VoterSelected(uint256 indexed jobId, address[] voters);
    event Voted(uint256 indexed jobId, address indexed voter, bool voteForWorker);
    event DisputeResolved(uint256 indexed jobId, bool workerWon);

    // ── Bước 8: Raise dispute ───────────────────────────────────
    // Gọi từ GigStamp khi client hoặc worker muốn tranh chấp
    function _raiseDispute(
        uint256 jobId,
        address initiator,
        string memory evidenceHash,
        address jobClient,
        address jobWorker
    ) internal {
        DisputeData storage d = disputes[jobId];
        require(!d.resolved, "Already resolved");
        require(d.deadline == 0, "Dispute already raised"); // chưa có dispute

        d.jobId        = jobId;
        d.initiator    = initiator;
        d.evidenceHash = evidenceHash;
        d.deadline     = block.timestamp + VOTE_DURATION;

        // Bước 9: chọn voter ngay khi raise
        uint256 seed = uint256(
            keccak256(abi.encodePacked(block.timestamp, block.prevrandao, jobId))
        );

        address[] memory chosen = _selectVoters(jobClient, jobWorker, seed, 5);

        d.voterCount = uint8(chosen.length);
        for (uint8 i = 0; i < chosen.length; i++) {
            d.voters[i] = chosen[i];
        }

        emit DisputeRaised(jobId, initiator);
        emit VoterSelected(jobId, chosen);
    }

    // ── Bằng chứng phản hồi từ bên kia ────────────────────────
    function _submitCounter(
        uint256 jobId,
        address responder,
        address initiator,
        string memory counterHash
    ) internal {
        DisputeData storage d = disputes[jobId];
        require(d.deadline > 0, "No dispute");
        require(!d.resolved, "Already resolved");
        require(responder != initiator, "Cannot counter own dispute");
        require(bytes(d.counterHash).length == 0, "Counter already submitted");

        d.counterHash = counterHash;
        emit CounterEvidenceSubmitted(jobId, responder);
    }

    // ── Bước 10: Vote ──────────────────────────────────────────
    function _castVote(
        uint256 jobId,
        address voter,
        bool    voteForWorker
    ) internal {
        DisputeData storage d = disputes[jobId];
        require(d.deadline > 0,              "No dispute exists");
        require(!d.resolved,                 "Already resolved");
        require(block.timestamp < d.deadline,"Voting period ended");
        require(!hasVoted[jobId][voter],     "Already voted");

        // Kiểm tra voter có trong danh sách được chọn không
        bool isSelectedVoter = false;
        for (uint8 i = 0; i < d.voterCount; i++) {
            if (d.voters[i] == voter) {
                isSelectedVoter = true;
                break;
            }
        }
        require(isSelectedVoter, "Not a selected voter");

        hasVoted[jobId][voter]   = true;
        voteChoice[jobId][voter] = voteForWorker;

        if (voteForWorker) {
            d.votesForWorker++;
        } else {
            d.votesForClient++;
        }

        emit Voted(jobId, voter, voteForWorker);
    }

    // ── Bước 11: Resolve theo đa số ────────────────────────────
    // Trả về true nếu worker thắng
    function _resolveDispute(uint256 jobId) internal returns (bool workerWon) {
        DisputeData storage d = disputes[jobId];
        require(d.deadline > 0,               "No dispute");
        require(!d.resolved,                  "Already resolved");
        require(
            block.timestamp >= d.deadline ||
            d.votesForWorker + d.votesForClient == d.voterCount,
            "Voting not ended"
        ); // resolve sớm nếu tất cả đã vote

        d.resolved  = true;
        workerWon   = d.votesForWorker > d.votesForClient;
        d.workerWon = workerWon;

        emit DisputeResolved(jobId, workerWon);

        // Cập nhật score voter
        for (uint8 i = 0; i < d.voterCount; i++) {
            address v = d.voters[i];
            if (!hasVoted[jobId][v]) continue; // voter không bỏ phiếu → bỏ qua

            bool votedForWorker = voteChoice[jobId][v];
            bool votedCorrectly = (votedForWorker == workerWon);

            if (votedCorrectly) {
                _addScore(v, 3, "voted_correctly");
            } else {
                _subScore(v, 3, "voted_wrongly");
            }
        }
    }

    // ── View helpers ───────────────────────────────────────────
    function getDisputeVoters(uint256 jobId) external view returns (address[5] memory) {
        return disputes[jobId].voters;
    }

    function getVoteCount(uint256 jobId) external view returns (uint8 forWorker, uint8 forClient) {
        DisputeData storage d = disputes[jobId];
        return (d.votesForWorker, d.votesForClient);
    }
}