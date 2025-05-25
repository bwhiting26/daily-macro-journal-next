import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { AppNotification } from '@/app/types'; // Assuming types are here

export function useDailyQuote(
  userId: string | null,
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp' | 'read' | 'user_id'>) => void,
  isNotificationsLoaded: boolean // To ensure notifications are ready for potential errors
) {
  const [dailyQuote, setDailyQuote] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState<boolean>(true);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !isNotificationsLoaded) {
      // Do not attempt to fetch if userId is null or notifications aren't ready
      // Set loading to false if userId is null, as no fetch will occur.
      if (!userId) setQuoteLoading(false);
      return;
    }

    const fetchDailyQuote = async () => {
      setQuoteLoading(true);
      setQuoteError(null);

      const todayStr = new Date().toLocaleDateString('en-CA');

      const { data: motivationData, error: motivationError } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'hasSentDailyMotivation')
        .eq('user_id', userId)
        .maybeSingle();

      if (motivationError) {
        console.error('Error fetching daily motivation:', JSON.stringify(motivationError, null, 2));
        setQuoteError('Failed to load daily motivation.');
        if (addNotification) {
          addNotification({ title: 'Error Loading Quote', body: 'Could not load your daily motivation. Please try again later.', type: 'error' });
        }
        setDailyQuote(null);
      } else if (motivationData && motivationData.value && motivationData.value.date === todayStr) {
        setDailyQuote(motivationData.value.dailyQuote);
      } else {
        // No quote for today or data is old
        setDailyQuote(null); 
      }
      setQuoteLoading(false);
    };

    fetchDailyQuote();
  }, [userId, addNotification, isNotificationsLoaded]);

  return {
    dailyQuote,
    quoteLoading,
    quoteError,
  };
}
