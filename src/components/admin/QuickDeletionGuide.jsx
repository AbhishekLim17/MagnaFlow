// Quick Deletion Guide - Shows up when email-already-in-use error occurs
// Provides step-by-step instructions for manual Firebase Auth cleanup

import React from 'react';
import { ExternalLink, Copy, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const QuickDeletionGuide = ({ email }) => {
  const { toast } = useToast();

  const firebaseAuthUrl = 'https://console.firebase.google.com/project/magnaflow-07sep25/authentication/users';

  const copyEmail = () => {
    navigator.clipboard.writeText(email);
    toast({
      title: "Email Copied!",
      description: `${email} copied to clipboard`,
    });
  };

  const steps = [
    {
      number: 1,
      title: 'Open Firebase Console',
      description: 'Click the button below to open Firebase Authentication',
      action: (
        <Button
          onClick={() => window.open(firebaseAuthUrl, '_blank')}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Open Firebase Console
        </Button>
      )
    },
    {
      number: 2,
      title: 'Search for Email',
      description: 'In Firebase Console, search for this email',
      action: (
        <div className="flex items-center gap-2">
          <code className="bg-gray-800 px-3 py-2 rounded text-sm flex-1">
            {email}
          </code>
          <Button
            onClick={copyEmail}
            variant="outline"
            size="sm"
            className="border-gray-700"
          >
            <Copy className="w-4 h-4" />
          </Button>
        </div>
      )
    },
    {
      number: 3,
      title: 'Delete the Account',
      description: 'Click the ⋮ (three dots) menu → Delete account',
      action: (
        <div className="text-gray-400 text-sm">
          ⚠️ This permanently removes the account from Firebase Authentication
        </div>
      )
    },
    {
      number: 4,
      title: 'Try Again',
      description: 'Close this dialog and add the staff member again',
      action: (
        <div className="flex items-center gap-2 text-green-400">
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm">Email will be available after deletion</span>
        </div>
      )
    }
  ];

  return (
    <Card className="glass-effect border-yellow-500/30 bg-yellow-500/5">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h3 className="text-lg font-semibold text-yellow-400 mb-2">
            📧 Email Already Registered
          </h3>
          <p className="text-gray-300 text-sm">
            This email exists in Firebase Authentication. Follow these steps to remove it:
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-4">
          {steps.map((step) => (
            <div key={step.number} className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                {step.number}
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <h4 className="font-semibold text-white">{step.title}</h4>
                  <p className="text-gray-400 text-sm">{step.description}</p>
                </div>
                {step.action}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-gray-700">
          <p className="text-xs text-gray-500">
            💡 <strong>Why this happens:</strong> When you delete a user from the portal, 
            they're removed from your database but still exist in Firebase Authentication. 
            This manual cleanup is required on the free plan.
          </p>
        </div>
      </div>
    </Card>
  );
};

export default QuickDeletionGuide;
