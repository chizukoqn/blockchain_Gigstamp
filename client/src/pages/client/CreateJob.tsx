/**
 * Create Job Page
 * Form for clients to post new jobs
 * Design: Modern Minimalism - Clean form with clear inputs
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocation } from 'wouter';
import { useApp } from '@/contexts/AppContext';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { getContract } from '@/lib/blockchain';
import { ethers } from 'ethers';

export default function CreateJob() {
  const [, setLocation] = useLocation();
  const { createJob } = useApp();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    pay: '',
    startTime: '',
    endTime: '',
    tolerance: '0',
    location: '',
    description: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (
        !formData.title ||
        !formData.pay ||
        !formData.startTime ||
        !formData.endTime ||
        !formData.tolerance ||
        !formData.location ||
        !formData.description
      ) {
        toast.error('All fields are required');
        setLoading(false);
        return;
      }

      const pay = parseFloat(formData.pay);
      if (isNaN(pay) || pay <= 0) {
        toast.error('Pay must be a positive number');
        setLoading(false);
        return;
      }

      const tolerance = Number(formData.tolerance);
      if (!Number.isFinite(tolerance) || tolerance < 0) {
        toast.error('Tolerance must be a valid number of seconds');
        setLoading(false);
        return;
      }

      const startSec = Math.floor(new Date(formData.startTime).getTime() / 1000);
      const endSec = Math.floor(new Date(formData.endTime).getTime() / 1000);
      if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec <= startSec) {
        toast.error('End Date must be later than Start Date');
        setLoading(false);
        return;
      }

      const contract = await getContract();
      if (!contract) {
        toast.error('Contract unavailable');
        setLoading(false);
        return;
      }

      const onchainJobId = String(await contract.jobCount());
      const payWei = ethers.parseEther(formData.pay);
      const tx = await contract.createJob(
        formData.description,
        payWei,
        BigInt(startSec),
        BigInt(endSec),
        BigInt(Math.floor(tolerance))
      );
      await tx.wait();

      createJob(
        formData.title,
        pay,
        formData.startTime,
        formData.endTime,
        Math.floor(tolerance),
        formData.location,
        formData.description,
        onchainJobId
      );
      toast.success('Job created successfully!');
      setLocation('/client/dashboard');
    } catch (error) {
      toast.error('Failed to create job');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/client/dashboard')}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Post a Job</h1>
              <p className="text-sm text-gray-600 mt-1">
                Fill in the details to create a new job posting
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="container py-6 max-w-2xl">
        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Job Title */}
            <div>
              <Label htmlFor="title" className="text-sm font-semibold text-gray-700">
                Job Title
              </Label>
              <Input
                id="title"
                name="title"
                type="text"
                placeholder="e.g., UI Designer for Mobile App"
                value={formData.title}
                onChange={handleChange}
                className="mt-2 h-11 rounded-lg border-gray-300"
              />
              <p className="text-xs text-gray-500 mt-1">
                A short, descriptive title for your job
              </p>
            </div>
            {/* Pay */}
            <div>
              <Label htmlFor="pay" className="text-sm font-semibold text-gray-700">
                Pay Amount (ETH)
              </Label>
              <Input
                id="pay"
                name="pay"
                type="number"
                step="0.01"
                min="0"
                placeholder="100.00"
                value={formData.pay}
                onChange={handleChange}
                className="mt-2 h-11 rounded-lg border-gray-300"
              />
              <p className="text-xs text-gray-500 mt-1">
                The amount you're willing to pay for this job
              </p>
            </div>

            {/* Start Date */}
            <div>
              <Label htmlFor="startTime" className="text-sm font-semibold text-gray-700">
                Start Date
              </Label>
              <Input
                id="startTime"
                name="startTime"
                type="datetime-local"
                value={formData.startTime}
                onChange={handleChange}
                className="mt-2 h-11 rounded-lg border-gray-300"
              />
              <p className="text-xs text-gray-500 mt-1">
                Expected time when work should start
              </p>
            </div>

            {/* End Date */}
            <div>
              <Label htmlFor="endTime" className="text-sm font-semibold text-gray-700">
                End Date
              </Label>
              <Input
                id="endTime"
                name="endTime"
                type="datetime-local"
                value={formData.endTime}
                onChange={handleChange}
                className="mt-2 h-11 rounded-lg border-gray-300"
              />
              <p className="text-xs text-gray-500 mt-1">
                Expected time when work should finish
              </p>
            </div>

            {/* Tolerance */}
            <div>
              <Label htmlFor="tolerance" className="text-sm font-semibold text-gray-700">
                Tolerance (seconds)
              </Label>
              <Input
                id="tolerance"
                name="tolerance"
                type="number"
                min="0"
                step="1"
                value={formData.tolerance}
                onChange={handleChange}
                className="mt-2 h-11 rounded-lg border-gray-300"
              />
              <p className="text-xs text-gray-500 mt-1">
                Allowed delay beyond Start Date
              </p>
            </div>

            {/* Location */}
            <div>
              <Label htmlFor="location" className="text-sm font-semibold text-gray-700">
                Location
              </Label>
              <Input
                id="location"
                name="location"
                type="text"
                placeholder="e.g., Thu Duc, Ho Chi Minh City"
                value={formData.location}
                onChange={handleChange}
                className="mt-2 h-11 rounded-lg border-gray-300"
              />
              <p className="text-xs text-gray-500 mt-1">
                Where should the work be done?
              </p>
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description" className="text-sm font-semibold text-gray-700">
                Job Description
              </Label>
              <textarea
                id="description"
                name="description"
                placeholder="Describe the job in detail..."
                value={formData.description}
                onChange={handleChange}
                rows={5}
                className="mt-2 w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                Be specific about what you need done
              </p>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Post Job'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
