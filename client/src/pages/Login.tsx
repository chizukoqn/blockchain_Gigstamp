/**
 * Login Page
 * MetaMask-only login
 */

import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { useApp } from '@/contexts/AppContext';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function Login() {
  const [, setLocation] = useLocation();
  const { currentUser, connectWallet } = useApp();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [didConnect, setDidConnect] = useState(false);

  const handleConnect = async () => {
    setError('');
    setLoading(true);
    try {
      await connectWallet();
      setDidConnect(true);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to connect MetaMask');
      toast.error('Failed to connect MetaMask');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (didConnect && !loading) {
      if (!currentUser) {
        setLocation('/register');
      } else if (currentUser.role === 'client') {
        setLocation('/client/dashboard');
      } else {
        setLocation('/worker/dashboard');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, loading, didConnect]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex flex-col">
      {/* Header */}
      <div className="p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation('/')}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </div>

      {/* Form Container */}
      <div className="flex-1 flex items-center justify-center px-4 pb-8">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Connect MetaMask
            </h1>
            <p className="text-gray-600">
              Use an ETH wallet account to access GigStamp.
            </p>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              onClick={handleConnect}
              disabled={loading}
              className="w-full h-12 mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50"
            >
              {loading ? 'Connecting...' : 'Connect Wallet'}
            </Button>
          </div>

          {/* Register Link */}
          <div className="mt-6 text-center">
            <p className="text-gray-600">
              If you are not registered on-chain yet:{' '}
              <button
                onClick={() => setLocation('/register')}
                className="text-blue-600 font-semibold hover:underline"
              >
                Register
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
