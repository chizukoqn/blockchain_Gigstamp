/**
 * GigStamp App Context
 * Manages global state: user, jobs, feedbacks, worker stats, notifications
 * Auth: MetaMask only (no email/password)
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, Job, Feedback, WorkerStats, UserRole, JobStatus, Notification, NotificationType } from '@/types';
import { nanoid } from 'nanoid';
import { connectWallet as connectMetaMaskWallet, getContract } from '@/lib/blockchain';

interface AppContextType {
  currentUser: User | null;
  jobs: Job[];
  feedbacks: Feedback[];
  workerStats: Record<string, WorkerStats>;
  notifications: Notification[];
  language: 'en';

  // Auth actions
  connectWallet: () => Promise<void>;
  register: (role: UserRole) => Promise<void>;
  logout: () => void;

  // Job actions
  createJob: (
    title: string,
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

  // Dispute metadata actions
  setDisputeInitiator: (jobId: string, initiatorAddress: string) => void;
  setDisputeVoters: (jobId: string, voters: string[]) => void;
  setDisputeResolved: (jobId: string, outcome: 'CLIENT_WON' | 'WORKER_WON' | 'DRAW') => void;

  // Notification actions
  addNotification: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (notifId: string) => void;
  markAllNotificationsRead: () => void;
  getUnreadCount: (address: string) => number;

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
  getDisputesForUser: (address: string) => Job[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [workerStats, setWorkerStats] = useState<Record<string, WorkerStats>>({});
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [language] = useState<'en'>('en');

  // Load state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('gigstamp-state');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        setCurrentUser(state.currentUser ?? null);
        setJobs(state.jobs ?? []);
        setFeedbacks(state.feedbacks ?? []);
        setWorkerStats(state.workerStats ?? {});
        setNotifications(state.notifications ?? []);
      } catch (error) {
        console.error('Failed to load state:', error);
      }
    }
  }, []);

  // Save state to localStorage whenever it changes
  const saveState = useCallback(() => {
    const state = { currentUser, jobs, feedbacks, workerStats, notifications, language };
    localStorage.setItem('gigstamp-state', JSON.stringify(state));
  }, [currentUser, jobs, feedbacks, workerStats, notifications, language]);

  useEffect(() => {
    saveState();
  }, [currentUser, jobs, feedbacks, workerStats, notifications, saveState]);

  // ── Notification helpers ──────────────────────────────────────
  const addNotification = useCallback((n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    setNotifications((prev) => {
      // Tránh duplicate: kiểm tra cùng type + jobId + targetAddress
      const isDuplicate = prev.some(
        (existing) =>
          existing.type === n.type &&
          existing.jobId === n.jobId &&
          existing.targetAddress?.toLowerCase() === n.targetAddress?.toLowerCase()
      );
      if (isDuplicate) return prev;

      const newNotif: Notification = {
        ...n,
        id: nanoid(10),
        timestamp: new Date().toISOString(),
        read: false,
      };
      return [newNotif, ...prev];
    });
  }, []);

  const markNotificationRead = useCallback((notifId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
    );
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const getUnreadCount = useCallback(
    (address: string) =>
      notifications.filter((n) => n.targetAddress?.toLowerCase() === address.toLowerCase() && !n.read).length,
    [notifications]
  );

  const connectWallet = useCallback(async () => {
    const address = await connectMetaMaskWallet();
    if (!address) return;

    const contract = await getContract();
    if (!contract) {
      alert(
        "Failed to connect to the contract. Please ensure VITE_CONTRACT_ADDRESS points to the correct deployed address."
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
    title: string,
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
      title,
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
    setJobs((prev) => {
      const job = prev.find((j) => j.id === jobId);
      if (!job) return prev;

      // Automated notifications
      if (status === 'IN_PROGRESS' || status === ('in_progress' as any)) {
        addNotification({
          type: 'job_started',
          jobId,
          message: `Worker has started working on Job #${jobId.slice(0, 6).toUpperCase()}`,
          targetAddress: job.clientAddress,
        });
      } else if (status === 'cancelled' && job.workerAddress) {
        addNotification({
          type: 'job_cancelled',
          jobId,
          message: `Client has cancelled Job #${jobId.slice(0, 6).toUpperCase()} that you accepted`,
          targetAddress: job.workerAddress,
        });
      }

      return prev.map((j) =>
        j.id === jobId
          ? { ...j, status, updatedAt: new Date().toISOString() }
          : j
      );
    });
  }, [addNotification]);

  const applyForJob = useCallback((jobId: string): boolean => {
    if (!currentUser || currentUser.role !== 'worker') {
      throw new Error('Only workers can apply for jobs');
    }

    const job = jobs.find((j) => j.id === jobId);
    if (!job) return false;

    if (job.status !== 'funded') {
      return false;
    }

    if (job.workerId) {
      return false;
    }

    setJobs((prev) => {
      const job = prev.find((j) => j.id === jobId);
      if (!job) return prev;

      // Notify Client
      addNotification({
        type: 'job_accepted',
        jobId,
        message: `Worker has accepted Job #${jobId.slice(0, 6).toUpperCase()}`,
        targetAddress: job.clientAddress,
      });

      return prev.map((j) =>
        j.id === jobId
          ? {
              ...j,
              workerId: currentUser.id,
              workerAddress: currentUser.address,
              status: 'accepted',
              updatedAt: new Date().toISOString(),
            }
          : j
      );
    });

    return true;
  }, [currentUser, jobs, addNotification]);

  const submitWork = useCallback(
    (jobId: string, submissionDescription: string, evidenceImages?: string[]) => {
      const normalizedDescription = submissionDescription.trim();
      if (!normalizedDescription) {
        throw new Error('Submission description is required');
      }

      setJobs((prev) => {
        const job = prev.find((j) => j.id === jobId);
        if (!job) return prev;

        // Notify Client
        addNotification({
          type: 'work_submitted',
          jobId,
          message: `Worker has submitted work for Job #${jobId.slice(0, 6).toUpperCase()}`,
          targetAddress: job.clientAddress,
        });

        return prev.map((j) =>
          j.id === jobId
            ? {
                ...j,
                submissionDescription: normalizedDescription,
                submissionEvidenceImages: evidenceImages ?? [],
                status: 'submitted',
                updatedAt: new Date().toISOString(),
              }
            : j
        );
      });
    },
    [addNotification]
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

  // ── Dispute metadata helpers ─────────────────────────────────
  const setDisputeInitiator = useCallback((jobId: string, initiatorAddress: string) => {
    setJobs((prev) =>
      prev.map((job) =>
        job.id === jobId
          ? { ...job, disputeInitiator: initiatorAddress, updatedAt: new Date().toISOString() }
          : job
      )
    );
  }, []);

  const setDisputeVoters = useCallback((jobId: string, voters: string[]) => {
    setJobs((prev) =>
      prev.map((job) =>
        job.id === jobId
          ? { ...job, disputeVoters: voters, updatedAt: new Date().toISOString() }
          : job
      )
    );

    // Notify each voter
    voters.forEach((vAddress) => {
      addNotification({
        type: 'selected_as_voter',
        jobId,
        message: `You have been selected as a voter for Job #${jobId.slice(0, 6).toUpperCase()}`,
        targetAddress: vAddress,
      });
    });
  }, [addNotification]);

  const setDisputeResolved = useCallback((jobId: string, outcome: 'CLIENT_WON' | 'WORKER_WON' | 'DRAW') => {
    setJobs((prev) =>
      prev.map((job) =>
        job.id === jobId
          ? {
              ...job,
              disputeResolved: true,
              disputeWorkerWon: outcome === 'WORKER_WON', // legacy support
              disputeOutcome: outcome,
              status: 'resolved' as JobStatus,
              updatedAt: new Date().toISOString(),
            }
          : job
      )
    );
  }, []);

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

    updateJobStatus(jobId, 'completed');

    // Notify Worker
    addNotification({
      type: 'job_approved',
      jobId,
      message: `Client has approved and paid for Job #${jobId.slice(0, 6).toUpperCase()}`,
      targetAddress: job.workerAddress!,
    });
  },
    [jobs, updateJobStatus, addNotification]
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

  // Trả về các jobs ở trạng thái disputed/resolved mà user hiện tại có liên quan
  // (là client, worker trong job ĐÓ, hoặc là voter)
  const getDisputesForUser = useCallback((address: string): Job[] => {
    return jobs.filter((j) => {
      const isDisputed =
        (j.status === 'disputed' || j.status === 'DISPUTED' ||
         j.status === 'resolved' || j.status === 'RESOLVED');
      if (!isDisputed) return false;

      const isClient = j.clientAddress?.toLowerCase() === address.toLowerCase();
      const isWorker = j.workerAddress?.toLowerCase() === address.toLowerCase();
      const isVoter = j.disputeVoters?.some(
        (v) => v.toLowerCase() === address.toLowerCase()
      );
      return isClient || isWorker || isVoter;
    });
  }, [jobs]);

  const value: AppContextType = {
    currentUser,
    jobs,
    feedbacks,
    workerStats,
    notifications,
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
    // Dispute metadata
    setDisputeInitiator,
    setDisputeVoters,
    setDisputeResolved,
    // Notifications
    addNotification,
    markNotificationRead,
    markAllNotificationsRead,
    getUnreadCount,
    // Feedback
    submitFeedback,
    // Getters
    getJobById,
    getWorkerStats,
    getJobsByClient,
    getAvailableJobs,
    getWorkerJobs,
    getDisputesForUser,
    language,
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
