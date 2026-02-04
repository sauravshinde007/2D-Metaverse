import { useEffect, useState, useRef } from 'react';
import { useNotification } from '../context/NotificationContext';

export default function CalendarReminders() {
    const { addNotification } = useNotification();
    const [events, setEvents] = useState([]);
    const notifiedEvents = useRef(new Set());

    // Load events from LocalStorage
    const loadEvents = () => {
        try {
            const saved = localStorage.getItem('metaverse_calendar_events');
            if (saved) {
                return JSON.parse(saved).map(evt => ({
                    ...evt,
                    start: new Date(evt.start), // Rehydrate dates
                    end: new Date(evt.end)
                }));
            }
        } catch (e) {
            console.error("Failed to load calendar events", e);
        }
        return [];
    };

    // Polling Effect
    useEffect(() => {
        // Initial load
        setEvents(loadEvents());

        const intervalId = setInterval(() => {
            const now = new Date();
            const currentEvents = loadEvents(); // Reload to get fresh data

            currentEvents.forEach(evt => {
                if (!evt.id) return;

                const timeDiff = evt.start.getTime() - now.getTime();
                const minutesLeft = Math.floor(timeDiff / (1000 * 60));

                // Notify if event is starting in exactly 10 minutes (or close to it)
                // We check a range because interval might skip the exact second
                // Let's say: Notify if between 9 and 10 minutes left
                const isTenMinWarning = minutesLeft >= 9 && minutesLeft <= 10;

                // Notify if starting NOW (less than 1 min away, but positive)
                const isStartingNow = minutesLeft >= 0 && minutesLeft <= 1;

                if (isTenMinWarning && !notifiedEvents.current.has(`${evt.id}-10min`)) {
                    addNotification(`Reminder: "${evt.title}" starts in 10 minutes.`, 'reminder');
                    notifiedEvents.current.add(`${evt.id}-10min`);
                }

                if (isStartingNow && !notifiedEvents.current.has(`${evt.id}-now`)) {
                    addNotification(`Event Started: "${evt.title}" is happening now!`, 'reminder');
                    notifiedEvents.current.add(`${evt.id}-now`);
                }
            });

        }, 30000); // Check every 30 seconds

        return () => clearInterval(intervalId);
    }, [addNotification]);

    return null; // Headless component
}
