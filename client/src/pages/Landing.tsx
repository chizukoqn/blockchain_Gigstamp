/**
 * Landing Page
 * Initial screen with Login and Register options
 * Design: Modern Minimalism - Clean, minimal landing with clear CTAs
 */

import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { Briefcase } from 'lucide-react';

export default function Landing() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex flex-col items-center justify-center px-4">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center mb-4">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center">
            <Briefcase className="w-8 h-8 text-white" />
          </div>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">
          GigStamp
        </h1>
        <p className="text-lg text-gray-600 max-w-md mx-auto">
          Connect with gig workers and clients. Post jobs, find opportunities, and build your reputation.
        </p>
      </div>

      {/* CTA Buttons */}
      <div className="flex flex-col gap-3 w-full max-w-sm">
        <Button
          onClick={() => setLocation('/register')}
          className="w-full h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
        >
          Register
        </Button>
        <Button
          onClick={() => setLocation('/login')}
          variant="outline"
          className="w-full h-12 text-base font-semibold border-2 border-blue-600 text-blue-600 hover:bg-blue-50 rounded-lg"
        >
          Login
        </Button>
      </div>

      {/* Footer Info */}
      <div className="mt-12 text-center text-sm text-gray-500 max-w-md">
        <p>
          GigStamp is a decentralized gig marketplace. No blockchain required—just a seamless experience.
        </p>
      </div>
    </div>
  );
}
