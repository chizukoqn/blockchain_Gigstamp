/**
 * GigStamp Type Definitions
 * Core data models for the gig marketplace app
 */

export type UserRole = 'client' | 'worker';
export type Language = 'en' | 'vi';

// Support both existing lowercase UI statuses and on-chain style uppercase statuses.
export type JobStatus =
  | 'created'
  | 'funded'
  | 'accepted'
  | 'submitted'
  | 'completed'
  | 'cancelled'
  | 'disputed'
  | 'resolved'
  | 'CREATED'
  | 'FUNDED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'DISPUTED'
  | 'RESOLVED'
  | 'COMPLETED'
  | 'CANCELLED';

export type NotificationType =
  | 'job_status_changed'
  | 'job_accepted'
  | 'job_started'
  | 'job_cancelled'
  | 'work_submitted'
  | 'job_approved'
  | 'dispute_raised'
  | 'dispute_raised_against_you'
  | 'selected_as_voter'
  | 'voter_voted'
  | 'voters_deadline_missed'
  | 'dispute_resolved';

export interface Notification {
  id: string;
  type: NotificationType;
  jobId: string;
  message: string;
  timestamp: string;
  read: boolean;
  targetAddress: string; // địa chỉ ví mà notification này thuộc về
}

export interface User {
  id: string;
  address: string;
  role: UserRole;
  createdAt: string;
}

export interface Job {
  id: string;
  onchainJobId?: string;
  title: string;
  clientId: string;
  clientAddress: string;
  workerId?: string;
  workerAddress?: string;
  pay: number;
  startTime: string;
  endTime: string;
  tolerance: number;
  location: string;
  description: string;
  // Worker submission (optional, stored in local app state for demo)
  submissionDescription?: string;
  submissionEvidenceImages?: string[];
  disputeEvidenceText?: string;
  disputeEvidenceImages?: string[];
  disputeEvidenceHash?: string;
  counterEvidenceText?: string;
  counterEvidenceImages?: string[];
  counterEvidenceHash?: string;
  // Dispute metadata
  disputeInitiator?: string;    // address của người khởi tạo dispute
  disputeVoters?: string[];     // danh sách address voter (fetch on-chain)
  disputeResolved?: boolean;    // dispute đã resolve chưa
  disputeWorkerWon?: boolean;   // kết quả: worker thắng?
  status: JobStatus;
  distance?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Feedback {
  id: string;
  jobId: string;
  workerId: string;
  rating: number;
  comment: string;
  // Minh chung ảnh (1 hoặc nhiều) lưu dưới dạng base64 string để demo/local state hoạt động.
  // Optional để tương thích feedback cũ đã lưu trong localStorage.
  evidenceImages?: string[];
  createdAt: string;
}

export interface WorkerStats {
  workerId: string;
  totalJobsCompleted: number;
  totalRating: number;
  ratingCount: number;
  averageRating: number;
}

export interface AppState {
  currentUser: User | null;
  jobs: Job[];
  feedbacks: Feedback[];
  workerStats: Record<string, WorkerStats>;
  notifications: Notification[];
  language: Language;
}
