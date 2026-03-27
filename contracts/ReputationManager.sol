// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ReputationManager {

    // ── Constants ──────────────────────────────────────
    uint8 public constant INIT_SCORE   = 100;
    uint8 public constant MAX_SCORE    = 100;
    uint8 public constant MIN_SCORE    = 0;
    uint8 public constant VOTER_THRESHOLD = 100; // cần ≥ 80 để được chọn làm voter

    // ── Storage ────────────────────────────────────────
    mapping(address => uint8)  public  reputationScore;
    mapping(address => bool)   private _initialized; // Địa chỉ đã được khởi tạo score hay chưa

    // ── Events ─────────────────────────────────────────
    event ScoreChanged(address indexed user, uint8 oldScore, uint8 newScore, string reason);
    event ScoreInitialized(address indexed user);

    // ── Internal: init khi user đăng ký ───────────────
    function _initScore(address user) internal {
        require(!_initialized[user], "Already initialized");
        reputationScore[user] = INIT_SCORE;
        _initialized[user]    = true;
        emit ScoreInitialized(user);
    }

    // ── Internal: cộng điểm (có cap MAX) ──────────────
    function _addScore(address user, uint8 delta, string memory reason) internal {
        uint8 old = reputationScore[user];
        uint8 next = (uint16(old) + delta > MAX_SCORE)
            ? MAX_SCORE
            : old + delta;
        reputationScore[user] = next;
        emit ScoreChanged(user, old, next, reason);
    }

    // ── Internal: trừ điểm (có floor MIN) ─────────────
    function _subScore(address user, uint8 delta, string memory reason) internal {
        uint8 old = reputationScore[user];
        uint8 next = (delta >= old) ? MIN_SCORE : old - delta;
        reputationScore[user] = next;
        emit ScoreChanged(user, old, next, reason);
    }

    // ── View: kiểm tra đủ uy tín làm voter ────────────
    function isEligibleVoter(address user) public view returns (bool) {
        return reputationScore[user] >= VOTER_THRESHOLD;
    }
}