import { useEffect, useRef } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

// Initialize a unique client token once per tab session
if (typeof window !== 'undefined' && !window.myClientToken) {
    window.myClientToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export default function useRealtimeSync() {
    const { token, user } = useAuth();
    const lastIdRef = useRef(null);
    const intervalRef = useRef(null);
    const isFetchingRef = useRef(false);

    useEffect(() => {
        const role = user?.role;
        if (!token || !user || (role !== 'ca' && role !== 'staff')) {
            // Clear interval if user logs out or role is not ca/staff
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            lastIdRef.current = null;
            return;
        }

        const checkUpdates = async () => {
            // Prevent concurrent/overlapping checks
            if (isFetchingRef.current) return;
            // Only check if the page/tab is active to preserve client and server resources
            if (document.visibilityState !== 'visible') return;

            isFetchingRef.current = true;
            try {
                const params = lastIdRef.current !== null ? { last_id: lastIdRef.current } : {};
                const res = await api.get('/ca/updates/check', { 
                    params,
                    // Avoid triggering global error toasts for transient network polling hiccups
                    headers: { 'X-Silent-Errors': 'true' } 
                });

                const { events, last_id } = res.data;
                lastIdRef.current = last_id;

                if (events && events.length > 0) {
                    events.forEach(evt => {
                        const parts = evt.event.split(':');
                        const eventName = parts[0];
                        const eventToken = parts[1];

                        // Skip event if it was triggered by this specific browser tab session
                        if (eventToken && eventToken === window.myClientToken) {
                            return;
                        }

                        // 1. Invalidate corresponding sessionStorage caches
                        if (eventName === 'clients_changed') {
                            sessionStorage.removeItem('cached_clients_v2');
                            sessionStorage.removeItem('cached_client_types');
                            sessionStorage.removeItem('cached_client_groups');
                        } else if (eventName === 'staff_changed') {
                            sessionStorage.removeItem('cached_staff_v2');
                            sessionStorage.removeItem('cached_roles');
                        } else if (eventName === 'tasks_changed') {
                            sessionStorage.removeItem('cached_work_types_v2');
                        }

                        // 2. Dispatch a clean custom event globally
                        const customEvent = new CustomEvent(eventName, { 
                            detail: { eventId: evt.id } 
                        });
                        window.dispatchEvent(customEvent);
                    });
                }
            } catch (err) {
                console.warn('Real-time sync check failed:', err.message || err);
            } finally {
                isFetchingRef.current = false;
            }
        };

        // 1. Initial check on mount/login
        checkUpdates();

        // 2. Poll every 5 seconds for lightweight status check
        intervalRef.current = setInterval(checkUpdates, 5000);

        // 3. Visibility change listener (check immediately when user returns to tab)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkUpdates();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleVisibilityChange);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleVisibilityChange);
        };
    }, [token, user]);

    return null;
}
