/**
 * GigStamp Type Definitions
 * Core data models for the gig marketplace app
 */

export type UserRole = 'client' | 'worker';

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

export interface User {
  id: string;
  address: string;
  role: UserRole;
  createdAt: string;
}

export interface Job {
  id: string;
  onchainJobId?: string;
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
}
