// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Auth.sol";
import "./GigStructs.sol";
import "./DisputeManager.sol";
import "./BadgeManager.sol";

contract GigStamp is Auth, DisputeManager, BadgeManager {

    // STORAGE
    uint256 public jobCount;

    mapping(uint256 => Job) public jobs;

    // 1. CREATE JOB (CLIENT ONLY)
    function createJob(
        string memory _jobHash,
        uint256 _pay,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _tolerance
    ) external {

        require(roles[msg.sender] == Role.CLIENT, "Not client");

        jobs[jobCount] = Job({
            client: msg.sender,
            worker: address(0),

            pay: _pay,

            startTime: _startTime,
            endTime: _endTime,
            tolerance: _tolerance,
            
            jobHash: _jobHash,
            resultHash: "",

            status: JobStatus.CREATED,

            fundedAt: 0,
            acceptedAt: 0,
            submittedAt: 0
        });

        jobCount++;
    }

    // 2. FUND JOB
    function fundJob(uint256 jobId) external payable {
        Job storage job = jobs[jobId];

        require(roles[msg.sender] == Role.CLIENT, "Not client");
        require(msg.sender == job.client, "Not owner");
        require(job.status == JobStatus.CREATED, "Not Created");

        require(msg.value == job.pay, "Wrong amount");
        
        job.fundedAt = block.timestamp; // ghi lại thời điểm nạp tiền
        
        job.status = JobStatus.FUNDED;
    }

    // 3. ACCEPT JOB
    function acceptJob(uint256 jobId) external {
        Job storage job = jobs[jobId];

        require(roles[msg.sender] == Role.WORKER, "Not worker");
        require(job.status == JobStatus.FUNDED, "Not funded");
        require(msg.sender != job.client, "Cannot take own job");
        require(job.worker == address(0), "Already taken");
        require(
            block.timestamp <= job.startTime + job.tolerance,
            "Start window expired"
        );

        job.worker = msg.sender;
        job.acceptedAt = block.timestamp;

        job.status = JobStatus.ACCEPTED;
    }

    // Start
    function startWork(uint256 jobId) external {
    Job storage job = jobs[jobId];
    require(msg.sender == job.worker,          "Not worker");
    require(job.status == JobStatus.ACCEPTED,  "Not accepted");
    require(
        block.timestamp <= job.startTime + job.tolerance,
        "Start window expired"
    );

    job.status = JobStatus.IN_PROGRESS;
    }

    // Timeout: worker accept nhưng không start trong thời gian cho phép
    function cancelIfNotStarted(uint256 jobId) external {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.ACCEPTED, "Not accepted");
        require(
            block.timestamp > job.startTime + job.tolerance,
            "Too early"
        );

        job.status = JobStatus.CANCELLED; // Hủy
        address oldWorker  = job.worker;
        (bool ok, ) = job.client.call{value: job.pay}("");
        require(ok, "Refund failed");

        // Phạt worker nhận rồi bỏ
        _subScore(oldWorker, 5, "worker_accepted_not_started");
        _addBadge(oldWorker, BadgeType.ABANDONED_JOB, jobId);
    }

    // 4. SUBMIT WORK
    function submitWork(uint256 jobId, string memory _resultHash) external {
        Job storage job = jobs[jobId];

        require(msg.sender == job.worker, "Not worker");
        require(job.status == JobStatus.IN_PROGRESS, "Invalid state");
        require(
            block.timestamp <= job.endTime + job.tolerance,
            "Submit window expired"
        );

        job.resultHash = _resultHash;
        job.submittedAt  = block.timestamp;
        job.status = JobStatus.SUBMITTED;
    }

    // FEEDBACK STORAGE
    mapping(uint256 => Feedback) public feedbacks; // jobId → feedback

    // WORKER RATING
    mapping(address => uint256) public totalRating; // tổng sao
    mapping(address => uint256) public ratingCount; // số lần được đánh giá

    // 5. APPROVE & PAY & FEEDBACK
    function approveJob(uint256 jobId, uint8 _rating, string memory _comment) external {
        Job storage job = jobs[jobId];

        require(msg.sender == job.client, "Not client");
        require(job.status == JobStatus.SUBMITTED, "Not submitted");

        require(_rating >= 1 && _rating <= 5, "Invalid rating");

        job.status = JobStatus.COMPLETED;

        _addBadge(job.client, BadgeType.RELIABLE_CLIENT, jobId);

        // Score cho client khi approve
        _addScore(msg.sender, 5, "client_approved_job");

        // Score cho worker theo rating
        if (_rating >= 4) {
            _addScore(job.worker, 10, "job_completed");   // hoàn thành job
            _addScore(job.worker, 5,  "good_rating");     // rating tốt
        } else if (_rating <= 2) {
            _addScore(job.worker, 10, "job_completed");   // vẫn hoàn thành job
            _subScore(job.worker, 7,  "bad_rating");      // nhưng rating xấu
            _addBadge(job.worker, BadgeType.BAD_RATING, jobId);
        } else {
            // rating = 3: neutral
            _addScore(job.worker, 10, "job_completed");
        }

        // Lưu Feedback
        feedbacks[jobId] = Feedback({
            client: msg.sender,
            worker: job.worker,
            rating: _rating,
            comment: _comment
        });

        // Update Rating Worker
        totalRating[job.worker] += _rating;
        ratingCount[job.worker] += 1;

        // Pay        
        (bool success, ) = job.worker.call{value: job.pay}("");
        require(success, "Transfer failed");
    }

    // 6. REFUND IF NOT ACCEPTED
    
    function cancelJob(uint256 jobId) external {
        Job storage job = jobs[jobId];
        require(msg.sender == job.client, "Not client");

        // ── Trường hợp 1: FUNDED, chưa ai nhận
        if (job.status == JobStatus.FUNDED) {
            job.status = JobStatus.CANCELLED;
            _payout(job.client, job.pay);
            return;
        }

        // ── Trường hợp 2: ACCEPTED, worker đã nhận nhưng chưa start ──
        // Client được quyền hủy BẤT CỨ LÚC NÀO trong giai đoạn này
        if (job.status == JobStatus.ACCEPTED) {
            job.status = JobStatus.CANCELLED;

            // Ghi nhận hành vi client hủy sau khi có worker → scam check
            _recordClientCancel(job.client, jobId);

            // Worker bị hủy ngang không lỗi → không phạt, thậm chí bồi thường nhỏ
            // Trả lại toàn bộ tiền cho client (worker chưa làm gì)
            _payout(job.client, job.pay);

            // Nhưng ghi nhận để worker biết client này hay cancel
            _addBadge(job.client, BadgeType.SERIAL_CANCELLER, jobId);
            return;
        }

        revert("Cannot cancel at this stage");
    }

    // Helper tránh lặp code transfer
    function _payout(address to, uint256 amount) internal {
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "Transfer failed");
    }

    // 7. GET AVERAGE RATING
    function getRating(address worker) public view returns (uint256) {
        if (ratingCount[worker] == 0) {
            return 0; // chưa có đánh giá
        }
        return totalRating[worker] / ratingCount[worker];
    }


    // 8. RAISE DISPUTE
    // Có thể gọi sau khi SUBMITTED hoặc sau COMPLETED (trong vòng X ngày)
    function raiseDispute(uint256 jobId, string memory evidenceHash) external {
        Job storage job = jobs[jobId];
        require(
            msg.sender == job.client || msg.sender == job.worker,
            "Not involved"
        );
        require(
            job.status == JobStatus.SUBMITTED ||
            job.status == JobStatus.IN_PROGRESS,
            "Invalid state for dispute"
        );

        job.status = JobStatus.DISPUTED;

        _raiseDispute(
            jobId,
            msg.sender,
            evidenceHash,
            job.client,
            job.worker
        );
    }

    // 8b. COUNTER EVIDENCE — bên kia nộp bằng chứng phản hồi
    function submitCounterEvidence(uint256 jobId, string memory counterHash) external {
        Job storage job = jobs[jobId];
        require(
            msg.sender == job.client || msg.sender == job.worker,
            "Not involved"
        );
        require(job.status == JobStatus.DISPUTED, "Not disputed");

        _submitCounter(
            jobId,
            msg.sender,
            disputes[jobId].initiator,
            counterHash
        );
    }

    // 10. VOTE — voter bỏ phiếu
    function castVote(uint256 jobId, bool voteForWorker) external {
        require(jobs[jobId].status == JobStatus.DISPUTED, "Not disputed");
        _castVote(jobId, msg.sender, voteForWorker);
    }

    // 10b. REPLACE INACTIVE VOTERS — thay thế voter không hoạt động sau deadline
    function replaceInactiveVoters(uint256 jobId) external {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.DISPUTED, "Not disputed");
        _replaceInactiveVoters(jobId, job.client, job.worker);
    }

    // 11. RESOLVE — ai cũng có thể trigger sau khi hết thời gian vote
    function resolveDispute(uint256 jobId) external {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.DISPUTED, "Not disputed");

        bool workerWon = _resolveDispute(jobId);
        job.status     = JobStatus.RESOLVED;

        if (workerWon) {
            // Worker thắng: nhận tiền
            _subScore(job.client, 10, "lost_dispute");
            _addBadge(job.client, BadgeType.LOST_DISPUTE_CLIENT, jobId);

            _addScore(job.worker, 10, "won_dispute");
            
            (bool ok, ) = job.worker.call{value: job.pay}("");
            require(ok, "Transfer failed");
        } else {
            // Client thắng: nhận refund
            _subScore(job.worker, 10, "lost_dispute");
            _addBadge(job.worker, BadgeType.LOST_DISPUTE, jobId);

            _addScore(job.client, 10, "won_dispute");  // 👈 bạn đề xuất +score client thắng dispute
            (bool ok, ) = job.client.call{value: job.pay}("");
            require(ok, "Transfer failed");
        }
    }

    uint256 public constant APPROVE_TIMEOUT = 120;

    // ── TIMEOUT 2: Worker start nhưng không submit ─────────
    // Client hoặc bất kỳ ai trigger sau SUBMIT_TIMEOUT
    function cancelIfNotSubmitted(uint256 jobId) external {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.IN_PROGRESS, "Not in progress");
        require(
            block.timestamp >= job.endTime + job.tolerance,
            "Too early"
        );

        job.status = JobStatus.CANCELLED;

        // Phạt worker vì nhận job rồi bỏ
        _subScore(job.worker, 10, "worker_abandoned");
        _addBadge(job.worker, BadgeType.ABANDONED_JOB, jobId);

        // Refund client
        (bool ok, ) = job.client.call{value: job.pay}("");
        require(ok, "Refund failed");
    }

    // ── TIMEOUT 3: Worker submit nhưng client không phản hồi ──
    // tự động trả tiền cho worker
    function autoReleaseIfNotApproved(uint256 jobId) external {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.SUBMITTED, "Not submitted");
        require(
            block.timestamp >= job.submittedAt + APPROVE_TIMEOUT,
            "Too early"
        );

        job.status = JobStatus.COMPLETED;

        // Phạt client vì cố tình delay
        _subScore(job.client, 8, "client_ignored_submission");
        _addBadge(job.client, BadgeType.IGNORED_SUBMISSION, jobId);

        // Worker vẫn được cộng điểm hoàn thành (dù không có rating)
        _addScore(job.worker, 10, "job_completed_auto");

        // Trả tiền cho worker
        (bool ok, ) = job.worker.call{value: job.pay}("");
        require(ok, "Transfer failed");
    }
}