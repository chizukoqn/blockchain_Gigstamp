/**
 * GigStamp App Context
 * Manages global state: user, jobs, feedbacks, worker stats
 * Auth: MetaMask only (no email/password)
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, Job, Feedback, WorkerStats, UserRole, JobStatus } from '@/types';
import { nanoid } from 'nanoid';
import { connectWallet as connectMetaMaskWallet, getContract } from '@/lib/blockchain';

interface AppContextType {
  currentUser: User | null;
  jobs: Job[];
  feedbacks: Feedback[];
  workerStats: Record<string, WorkerStats>;
  
  // Auth actions
  connectWallet: () => Promise<void>;
  register: (role: UserRole) => Promise<void>;
  logout: () => void;
  
  // Job actions
  createJob: (
    pay: number,
    startTime: string,
    endTime: string,
    tolerance: number,
    location: string,
    description: string,
    onchainJobId?: string
  ) => Job;
  updateJobStatus: (jobId: string, status: JobStatus) => void;
  applyForJob: (jobId: string) => boolean;
  submitWork: (jobId: string, submissionDescription: string, evidenceImages?: string[]) => void;
  setDisputeEvidence: (jobId: string, hash: string, text: string, images: string[]) => void;
  setCounterEvidence: (jobId: string, hash: string, text: string, images: string[]) => void;
  
  // Feedback actions
  submitFeedback: (
    jobId: string,
    rating: number,
    comment: string,
    evidenceImages?: string[]
  ) => void;
  
  // Utility
  getJobById: (jobId: string) => Job | undefined;
  getWorkerStats: (workerId: string) => WorkerStats;
  getJobsByClient: (clientId: string) => Job[];
  getAvailableJobs: () => Job[];
  getWorkerJobs: (workerId: string) => Job[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [workerStats, setWorkerStats] = useState<Record<string, WorkerStats>>({});

  // Load state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('gigstamp-state');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        setCurrentUser(state.currentUser ?? null);
        setJobs(state.jobs);
        setFeedbacks(state.feedbacks);
        setWorkerStats(state.workerStats);
      } catch (error) {
        console.error('Failed to load state:', error);
      }
    }
  }, []);

  // Save state to localStorage whenever it changes
  const saveState = useCallback(() => {
    const state = { currentUser, jobs, feedbacks, workerStats };
    localStorage.setItem('gigstamp-state', JSON.stringify(state));
  }, [currentUser, jobs, feedbacks, workerStats]);

  useEffect(() => {
    saveState();
  }, [currentUser, jobs, feedbacks, workerStats, saveState]);

  const connectWallet = useCallback(async () => {
    const address = await connectMetaMaskWallet();
    if (!address) return;

    const contract = await getContract();
    if (!contract) {
      alert(
        "Không thể kết nối contract. Vui lòng đảm bảo `VITE_CONTRACT_ADDRESS` trỏ đúng địa chỉ contract đã deploy."
      );
      setCurrentUser(null);
      return;
    }

    const roleEnum = await contract.getMyRole();
    const roleValue = Number(roleEnum);
    const role: UserRole | null =
      roleValue === 1 ? 'client' : roleValue === 2 ? 'worker' : null;

    if (!role) {
      setCurrentUser(null);
      return;
    }

    setCurrentUser({
      id: address,
      address,
      role,
      createdAt: new Date().toISOString(),
    });
  }, []);

  const register = useCallback(
    async (role: UserRole) => {
      const address = await connectMetaMaskWallet();
      if (!address) throw new Error('MetaMask connection failed.');

      const contract = await getContract();
      if (!contract)
        throw new Error(
          'Contract unavailable. Check `VITE_CONTRACT_ADDRESS` for current network.'
        );

      const tx =
        role === 'client' ? await contract.registerClient() : await contract.registerWorker();
      await tx.wait();

      // Reload role from chain.
      const roleEnum = await contract.getMyRole();
      const roleValue = Number(roleEnum);
      const updatedRole: UserRole | null =
        roleValue === 1 ? 'client' : roleValue === 2 ? 'worker' : null;

      if (!updatedRole) {
        setCurrentUser(null);
        return;
      }

      setCurrentUser({
        id: address,
        address,
        role: updatedRole,
        createdAt: new Date().toISOString(),
      });
    },
    []
  );

  const logout = useCallback(() => {
    setCurrentUser(null);
  }, []);

  const createJob = useCallback((
    pay: number,
    startTime: string,
    endTime: string,
    tolerance: number,
    location: string,
    description: string,
    onchainJobId?: string
  ): Job => {
    if (!currentUser || currentUser.role !== 'client') {
      throw new Error('Only clients can create jobs');
    }

    const startMs = new Date(startTime).getTime();
    const endMs = new Date(endTime).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      throw new Error('Invalid start/end time');
    }

    const newJob: Job = {
      id: nanoid(10),
      onchainJobId,
      clientId: currentUser.id,
      clientAddress: currentUser.address,
      pay,
      startTime,
      endTime,
      tolerance,
      location,
      description,
      status: 'created',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setJobs((prev) => [...prev, newJob]);
    return newJob;
  }, [currentUser]);

  const updateJobStatus = useCallback((jobId: string, status: JobStatus) => {
    setJobs((prev) =>
      prev.map((job) =>
        job.id === jobId
          ? { ...job, status, updatedAt: new Date().toISOString() }
          : job
      )
    );
  }, []);

  const applyForJob = useCallback((jobId: string): boolean => {
    if (!currentUser || currentUser.role !== 'worker') {
      throw new Error('Only workers can apply for jobs');
    }

    const job = jobs.find((j) => j.id === jobId);
    if (!job) return false;

    // Check if job is already accepted
    if (job.status !== 'funded') {
      return false;
    }

    // Check if already assigned
    if (job.workerId) {
      return false;
    }

    // Assign worker and update status
    setJobs((prev) =>
      prev.map((j) =>
        j.id === jobId
          ? {
              ...j,
              workerId: currentUser.id,
              workerAddress: currentUser.address,
              status: 'accepted',
              updatedAt: new Date().toISOString(),
            }
          : j
      )
    );

    return true;
  }, [currentUser, jobs]);

  const submitWork = useCallback(
    (jobId: string, submissionDescription: string, evidenceImages?: string[]) => {
      const normalizedDescription = submissionDescription.trim();
      if (!normalizedDescription) {
        throw new Error('Submission description is required');
      }

      setJobs((prev) =>
        prev.map((job) =>
          job.id === jobId
            ? {
                ...job,
                submissionDescription: normalizedDescription,
                submissionEvidenceImages: evidenceImages ?? [],
                status: 'submitted',
                updatedAt: new Date().toISOString(),
              }
            : job
        )
      );
    },
    []
  );

  const setDisputeEvidence = useCallback(
    (jobId: string, hash: string, text: string, images: string[]) => {
      setJobs((prev) =>
        prev.map((job) =>
          job.id === jobId
            ? {
                ...job,
                disputeEvidenceHash: hash,
                disputeEvidenceText: text.trim(),
                disputeEvidenceImages: images,
                updatedAt: new Date().toISOString(),
              }
            : job
        )
      );
    },
    []
  );

  const setCounterEvidence = useCallback(
    (jobId: string, hash: string, text: string, images: string[]) => {
      setJobs((prev) =>
        prev.map((job) =>
          job.id === jobId
            ? {
                ...job,
                counterEvidenceHash: hash,
                counterEvidenceText: text.trim(),
                counterEvidenceImages: images,
                updatedAt: new Date().toISOString(),
              }
            : job
        )
      );
    },
    []
  );

  const submitFeedback = useCallback(
    (jobId: string, rating: number, comment: string, evidenceImages?: string[]) => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job || !job.workerId) return;

    const feedback: Feedback = {
      id: nanoid(10),
      jobId,
      workerId: job.workerId,
      rating,
      comment,
      evidenceImages: evidenceImages ?? [],
      createdAt: new Date().toISOString(),
    };

    setFeedbacks((prev) => [...prev, feedback]);

    // Update worker stats
    setWorkerStats((prev) => {
      const stats = prev[job.workerId!] || {
        workerId: job.workerId!,
        totalJobsCompleted: 0,
        totalRating: 0,
        ratingCount: 0,
        averageRating: 0,
      };

      const updatedStats = {
        ...stats,
        totalJobsCompleted: stats.totalJobsCompleted + 1,
        totalRating: stats.totalRating + rating,
        ratingCount: stats.ratingCount + 1,
        averageRating: (stats.totalRating + rating) / (stats.ratingCount + 1),
      };

      return {
        ...prev,
        [job.workerId!]: updatedStats,
      };
    });

    // Update job status to completed
    updateJobStatus(jobId, 'completed');
  },
    [jobs, updateJobStatus]
  );

  const getJobById = useCallback((jobId: string): Job | undefined => {
    return jobs.find((j) => j.id === jobId);
  }, [jobs]);

  const getWorkerStats = useCallback((workerId: string): WorkerStats => {
    return (
      workerStats[workerId] || {
        workerId,
        totalJobsCompleted: 0,
        totalRating: 0,
        ratingCount: 0,
        averageRating: 0,
      }
    );
  }, [workerStats]);

  const getJobsByClient = useCallback((clientId: string): Job[] => {
    return jobs.filter((j) => j.clientId === clientId);
  }, [jobs]);

  const getAvailableJobs = useCallback((): Job[] => {
    return jobs.filter((j) => j.status === 'funded' && !j.workerId);
  }, [jobs]);

  const getWorkerJobs = useCallback((workerId: string): Job[] => {
    return jobs.filter((j) => j.workerId === workerId);
  }, [jobs]);

  const value: AppContextType = {
    currentUser,
    jobs,
    feedbacks,
    workerStats,
    // Auth
    connectWallet,
    register,
    logout,
    createJob,
    updateJobStatus,
    applyForJob,
    submitWork,
    setDisputeEvidence,
    setCounterEvidence,
    submitFeedback,
    getJobById,
    getWorkerStats,
    getJobsByClient,
    getAvailableJobs,
    getWorkerJobs,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
