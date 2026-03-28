// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract BadgeManager {

    // ── Định nghĩa tất cả loại nhãn ───────────────────────────
    enum BadgeType {
        // Nhãn xấu — Worker
        ABANDONED_JOB,           // 0: nhận job rồi không start / không submit
        BAD_RATING,              // 1: bị đánh giá 1-2 sao
        LOST_DISPUTE,            // 2: thua dispute
        VOTED_WRONG,             // 3: voter bỏ phiếu sai
        RAGE_QUIT,               // 4: thoát job giữa chừng

        // Nhãn xấu — Client
        IGNORED_SUBMISSION,      // 5: không phản hồi sau worker submit
        CHANGED_TERMS,           // 6: thay đổi điều khoản giữa chừng
        LOST_DISPUTE_CLIENT,     // 7: thua dispute (phía client)
        SERIAL_CANCELLER,        // 8: hủy job nhiều lần sau khi có worker nhận
        SCAM_LABEL,              // 9: đủ điều kiện bị gán nhãn scam

        // Nhãn tốt — hiển thị thành tích
        TOP_WORKER,              // 10: hoàn thành nhiều job, rating cao
        RELIABLE_CLIENT,         // 11: luôn approve đúng hạn, không dispute
        TRUSTED_VOTER            // 12: vote đúng nhiều lần
    }

    // ── Struct lưu từng badge ──────────────────────────────────
    struct Badge {
        BadgeType badgeType;
        uint256   jobId;       // job liên quan (0 nếu không liên quan job cụ thể)
        uint256   timestamp;
        string    note;        // mô tả ngắn
    }

    // address → danh sách badge
    mapping(address => Badge[]) private _badges;

    // Đếm nhanh theo loại — để check ngưỡng mà không loop
    // address => BadgeType => count
    mapping(address => mapping(uint256 => uint256)) public badgeCount;

    // ── Ngưỡng tự động leo thang ──────────────────────────────
    uint256 public constant SERIAL_CANCEL_THRESHOLD = 3;  // hủy 3 job có worker → SERIAL_CANCELLER
    uint256 public constant SCAM_THRESHOLD          = 5;  // hủy 5 job có worker → SCAM_LABEL

    // ── Events ────────────────────────────────────────────────
    event BadgeAwarded(address indexed user, BadgeType indexed badgeType, uint256 jobId);

    // ── Internal: gán nhãn ────────────────────────────────────
    function _addBadge(
        address   user,
        BadgeType badgeType,
        uint256   jobId
    ) internal {
        string memory note = _badgeNote(badgeType);

        _badges[user].push(Badge({
            badgeType: badgeType,
            jobId:     jobId,
            timestamp: block.timestamp,
            note:      note
        }));

        badgeCount[user][uint256(badgeType)] += 1;

        emit BadgeAwarded(user, badgeType, jobId);
    }

    // ── Internal: logic kiểm tra serial cancel + scam ─────────
    function _recordClientCancel(address client, uint256 jobId) internal {
        // Mỗi lần client hủy job đã có worker → tăng đếm
        _addBadge(client, BadgeType.SERIAL_CANCELLER, jobId);

        uint256 cancelCount = badgeCount[client][uint256(BadgeType.SERIAL_CANCELLER)];

        // Leo thang: đủ ngưỡng → SCAM_LABEL
        if (cancelCount >= SCAM_THRESHOLD) {
            // Chỉ thêm SCAM_LABEL lần đầu
            if (badgeCount[client][uint256(BadgeType.SCAM_LABEL)] == 0) {
                _addBadge(client, BadgeType.SCAM_LABEL, 0);
            }
        }
    }

    // ── View: lấy toàn bộ badge của 1 address ─────────────────
    function getBadges(address user)
        external view
        returns (
            BadgeType[] memory types,
            uint256[]   memory jobIds,
            uint256[]   memory timestamps,
            string[]    memory notes
        )
    {
        Badge[] storage bs = _badges[user];
        uint256 len = bs.length;

        types      = new BadgeType[](len);
        jobIds     = new uint256[](len);
        timestamps = new uint256[](len);
        notes      = new string[](len);

        for (uint256 i = 0; i < len; i++) {
            types[i]      = bs[i].badgeType;
            jobIds[i]     = bs[i].jobId;
            timestamps[i] = bs[i].timestamp;
            notes[i]      = bs[i].note;
        }
    }

    // View: đếm badge theo loại
    function getBadgeCount(address user, BadgeType badgeType)
        external view returns (uint256)
    {
        return badgeCount[user][uint256(badgeType)];
    }

    // View: kiểm tra nhanh có nhãn scam không
    function isScammer(address user) public view returns (bool) {
        return badgeCount[user][uint256(BadgeType.SCAM_LABEL)] > 0;
    }

    // ── Internal: note mô tả cho từng loại ───────────────────
    function _badgeNote(BadgeType t) private pure returns (string memory) {
        if (t == BadgeType.ABANDONED_JOB)         return "Accepted or in-progress job abandoned";
        if (t == BadgeType.BAD_RATING)             return "Received 1 or 2 star rating";
        if (t == BadgeType.LOST_DISPUTE)           return "Lost a dispute";
        if (t == BadgeType.VOTED_WRONG)            return "Voted for the losing side in dispute";
        if (t == BadgeType.RAGE_QUIT)              return "Rage quit a job";
        if (t == BadgeType.IGNORED_SUBMISSION)     return "Did not respond after worker submitted";
        if (t == BadgeType.CHANGED_TERMS)          return "Reported for changing job terms";
        if (t == BadgeType.LOST_DISPUTE_CLIENT)    return "Lost a dispute as client";
        if (t == BadgeType.SERIAL_CANCELLER)       return "Cancelled job after worker accepted";
        if (t == BadgeType.SCAM_LABEL)             return "Flagged as potential scammer";
        if (t == BadgeType.TOP_WORKER)             return "Consistently high-rated worker";
        if (t == BadgeType.RELIABLE_CLIENT)        return "Reliable client with clean history";
        if (t == BadgeType.TRUSTED_VOTER)          return "Trusted dispute voter";
        return "";
    }
}