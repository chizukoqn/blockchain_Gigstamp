// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

enum JobStatus {
    CREATED,       // 0: vừa tạo
    FUNDED,        // 1: đã nạp tiền
    ACCEPTED,       // 2: Nhận job
    IN_PROGRESS,   // 3: đang làm
    SUBMITTED,     // 4: đã nộp
    COMPLETED,      // 5: hoàn thành
    CANCELLED,       // 6: hủy
    DISPUTED,   //  7: đang trong quá trình xử lý tranh chấp
    RESOLVED    // 8: tranh chấp đã có kết quả
}

struct Job {
    address client;    
    address worker;     

    uint256 pay;        // tiền trả
    uint256 startTime;  // thời điểm bắt đầu dự kiến (unix seconds)
    uint256 endTime;    // thời điểm kết thúc dự kiến (unix seconds)
    uint256 tolerance;  // độ trễ cho phép (seconds)

    string jobHash;     // mô tả (IPFS)
    string resultHash;  // kết quả (IPFS)

    uint256 fundedAt;   // thời điểm nạp tiền
    uint256 acceptedAt;     // lúc worker accept
    uint256 submittedAt;    // worker submit

    JobStatus status;   // trạng thái
}

struct Feedback {
    address client;   // người đánh giá
    address worker;   // người được đánh giá

    uint8 rating;     // số sao (1–5)
    string comment;   // nhận xét
}

struct Dispute {
    uint256 jobId;            // job liên quan
    address initiator;        // người khởi tạo dispute (client hoặc worker)
    string  evidenceHash;     // bằng chứng IPFS của người khởi tạo
    string  counterHash;      // bằng chứng phản hồi của bên kia
    address[5] voters;        // 5 voter được chọn ngẫu nhiên
    mapping(address => bool)  hasVoted;     // voter này đã vote chưa
    mapping(address => bool)  voteForWorker; // true = vote worker thắng
    uint8   votesForWorker;   // đếm số phiếu cho worker
    uint8   votesForClient;   // đếm số phiếu cho client
    uint256 deadline;         // thời hạn bỏ phiếu
    bool    resolved;         // đã kết luận chưa
    bool    workerWon;        // kết quả cuối: worker thắng?
}