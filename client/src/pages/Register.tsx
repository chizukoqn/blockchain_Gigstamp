/**
 * Register Page
 * MetaMask-only registration with role selection
 */

import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { useApp } from '@/contexts/AppContext';
import { useState } from 'react';
import { ArrowLeft, Briefcase, Users } from 'lucide-react';
import { toast } from 'sonner';
import { UserRole } from '@/types';
import { connectWallet as connectMetaMaskWallet } from '@/lib/blockchain';

export default function Register() {
  const [, setLocation] = useLocation();
  const { register } = useApp();
  const [step, setStep] = useState<'role' | 'connect'>('role');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [error, setError] = useState('');
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [connectingWallet, setConnectingWallet] = useState(false);

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setStep('connect');
    setError('');
  };

  const handleRegisterOnChain = async () => {
    if (!selectedRole) {
      setError('Please select a role');
      return;
    }
    if (!walletAddress) {
      setError('Please connect MetaMask first');
      return;
    }

    setError('');
    try {
      await register(selectedRole);
      toast.success('Account created successfully!');
      
      // Redirect to appropriate dashboard based on role
      if (selectedRole === 'client') {
        setLocation('/client/dashboard');
      } else {
        setLocation('/worker/dashboard');
      }
    } catch (err) {
      setError('Failed to create account');
      console.error(err);
    }
  };

  const handleConnectWallet = async () => {
    setError('');
    setConnectingWallet(true);
    try {
      const addr = await connectMetaMaskWallet();
      if (!addr) {
        setError('MetaMask connection failed or rejected');
        return;
      }
      setWalletAddress(addr);
      toast.success('Wallet connected');
    } catch (err) {
      console.error(err);
      setError('Failed to connect MetaMask');
    } finally {
      setConnectingWallet(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex flex-col">
      {/* Header */}
      <div className="p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (step === 'connect') {
              setStep('role');
              setError('');
            } else {
              setLocation('/');
            }
          }}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </div>

      {/* Form Container */}
      <div className="flex-1 flex items-center justify-center px-4 pb-8">
        <div className="w-full max-w-sm">
          {step === 'role' ? (
            // Step 1: Role Selection
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Choose Your Role
                </h1>
                <p className="text-gray-600">
                  Select whether you want to post jobs or find work.
                </p>
              </div>

              <div className="space-y-3">
                {/* Client Option */}
                <button
                  onClick={() => handleRoleSelect('client')}
                  className="w-full bg-white rounded-2xl p-6 border border-gray-200 hover:border-blue-500 hover:shadow-md transition-all text-left"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Briefcase className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">
                        I'm a Client
                      </h3>
                      <p className="text-sm text-gray-600">
                        Post jobs and hire talented workers
                      </p>
                    </div>
                  </div>
                </button>

                {/* Worker Option */}
                <button
                  onClick={() => handleRoleSelect('worker')}
                  className="w-full bg-white rounded-2xl p-6 border border-gray-200 hover:border-orange-500 hover:shadow-md transition-all text-left"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Users className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">
                        I'm a Worker
                      </h3>
                      <p className="text-sm text-gray-600">
                        Browse jobs and earn money
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </>
          ) : (
            // Step 2: Account Creation Form
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Create Account
                </h1>
                <p className="text-gray-600">
                  {selectedRole === 'client'
                    ? 'Join as a Client to start posting jobs.'
                    : 'Join as a Worker to start finding opportunities.'}
                </p>
              </div>

              {/* Connect MetaMask first */}
              <div className="bg-white rounded-2xl p-4 border border-gray-200 mb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">Connect MetaMask</h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Required before creating your account.
                    </p>
                  </div>

                  <Button
                    type="button"
                    onClick={handleConnectWallet}
                    disabled={connectingWallet}
                    className="h-9 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-3 disabled:opacity-50"
                  >
                    {connectingWallet ? 'Connecting...' : 'Connect Wallet'}
                  </Button>
                </div>

                {walletAddress ? (
                  <div className="mt-3 text-sm">
                    <p className="text-gray-700">
                      Connected:{" "}
                      <span className="font-mono">
                        {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                      </span>
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-gray-500">Not connected</div>
                )}
              </div>

              <div className="space-y-4">
                {/* Error Message */}
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  onClick={handleRegisterOnChain}
                  disabled={!walletAddress}
                  className="w-full h-12 mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50"
                >
                  Create Account
                </Button>
              </div>

              {/* Login Link */}
              <div className="mt-6 text-center">
                <p className="text-gray-600">
                  Already have an account?{' '}
                  <button
                    onClick={() => setLocation('/login')}
                    className="text-blue-600 font-semibold hover:underline"
                  >
                    Login
                  </button>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
