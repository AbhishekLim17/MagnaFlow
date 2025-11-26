// Test Reminder Button - Manual trigger for testing daily critical task reminders
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { checkAndSendCriticalReminders } from '@/services/reminderService';
import { useToast } from '@/components/ui/use-toast';

export default function TestReminderButton() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleTestReminder = async () => {
    setLoading(true);
    console.log('🧪 Manual test of critical task reminders initiated...');
    
    try {
      const result = await checkAndSendCriticalReminders();
      
      if (result.success) {
        toast({
          title: '✅ Reminder Check Complete',
          description: `Found ${result.totalCriticalTasks || 0} critical tasks. Sent ${result.remindersSent || 0} reminder emails.`,
          duration: 5000,
        });
        
        console.log('🎯 Test complete:', result);
      } else {
        toast({
          title: '❌ Reminder Check Failed',
          description: result.error || 'Unknown error occurred',
          variant: 'destructive',
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('❌ Error testing reminders:', error);
      toast({
        title: '❌ Error',
        description: error.message,
        variant: 'destructive',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleTestReminder}
      disabled={loading}
      className="w-full justify-start bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white"
    >
      <span className="mr-2">{loading ? '⏳' : '🧪'}</span>
      {loading ? 'Checking Critical Tasks...' : 'Test Critical Reminders'}
    </Button>
  );
}
