import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';

/**
 * Hook to track email quota usage in real-time
 * Monitors emails sent this month via EmailJS
 * @returns {Object} quota information
 */
export function useEmailQuota() {
  const [quota, setQuota] = useState({
    used: 0,
    limit: 200,
    percentage: 0,
    status: 'safe', // 'safe' | 'warning' | 'critical'
    dailyAverage: 0,
    projected: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentMonth = getCurrentMonthYear();
    
    // Query email_logs collection for current month
    const q = query(
      collection(db, 'email_logs'),
      where('monthYear', '==', currentMonth),
      where('status', '==', 'success')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const used = snapshot.size;
      const percentage = (used / 200) * 100;
      
      // Calculate daily average and projection
      const today = new Date();
      const dayOfMonth = today.getDate();
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const dailyAverage = dayOfMonth > 0 ? used / dayOfMonth : 0;
      const projected = Math.round(dailyAverage * daysInMonth);
      
      // Determine status
      let status = 'safe';
      if (percentage >= 95) status = 'critical';
      else if (percentage >= 75) status = 'warning';
      
      setQuota({
        used,
        limit: 200,
        percentage: Math.round(percentage),
        status,
        dailyAverage: Math.round(dailyAverage * 10) / 10,
        projected
      });
      
      setLoading(false);
    }, (error) => {
      console.error('Error fetching email quota:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { ...quota, loading };
}

function getCurrentMonthYear() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
