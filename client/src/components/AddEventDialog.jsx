import React, { useState, useEffect } from 'react';
import { X, Clock, Calendar as CalendarIcon, AlignLeft, Check, Trash2 } from 'lucide-react';

export default function AddEventDialog({ isOpen, onClose, onSave, onDelete, initialDate, initialEndDate, initialEvent }) {
    const [title, setTitle] = useState('');
    const [startDate, setStartDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endDate, setEndDate] = useState('');
    const [endTime, setEndTime] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState('user'); // user, personal, work, critical

    useEffect(() => {
        if (isOpen) {
            if (initialEvent) {
                // Edit Mode
                setTitle(initialEvent.title || '');
                setStartDate(new Date(initialEvent.start).toISOString().split('T')[0]);
                setStartTime(new Date(initialEvent.start).toTimeString().slice(0, 5));
                setEndDate(new Date(initialEvent.end).toISOString().split('T')[0]);
                setEndTime(new Date(initialEvent.end).toTimeString().slice(0, 5));
                setDescription(initialEvent.description || '');
                setType(initialEvent.type || 'user');
            } else {
                // Create Mode
                const start = initialDate || new Date();
                const end = initialEndDate || new Date(new Date().setHours(new Date().getHours() + 1));

                setTitle('');
                setStartDate(start.toISOString().split('T')[0]);
                setStartTime(start.toTimeString().slice(0, 5));
                setEndDate(end.toISOString().split('T')[0]);
                setEndTime(end.toTimeString().slice(0, 5));
                setDescription('');
                setType('user');
            }
        }
    }, [isOpen, initialDate, initialEndDate, initialEvent]);

    const handleSubmit = (e) => {
        e.preventDefault();

        // Combine date and time
        const start = new Date(`${startDate}T${startTime}`);
        const end = new Date(`${endDate}T${endTime}`);

        if (end < start) {
            alert('End time cannot be before start time');
            return;
        }

        onSave({
            title,
            start,
            end,
            description,
            type,
            resource: 'user' // Default to user, but logic inside CalendarModal might prompt to sync
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900">
                    <h2 className="text-lg font-semibold text-white">{initialEvent ? 'Edit Event' : 'Add New Event'}</h2>
                    <button onClick={onClose} className="p-2 -mr-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">

                    {/* Title Input */}
                    <div className="space-y-4">
                        <input
                            type="text"
                            placeholder="Add title"
                            className="w-full bg-transparent text-2xl font-medium text-white placeholder-zinc-600 border-none focus:ring-0 p-0"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            autoFocus
                            required
                        />
                        <div className="flex gap-2">
                            {['user', 'work', 'personal', 'critical'].map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setType(t)}
                                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${type === t
                                        ? getCategoryStyles(t).active
                                        : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                                        }`}
                                >
                                    {t.charAt(0).toUpperCase() + t.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Date & Time */}
                    <div className="space-y-4 bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/50">
                        <div className="flex items-start gap-4 text-zinc-300">
                            <Clock size={18} className="text-zinc-500 mt-2" />
                            <div className="flex-1 flex flex-col gap-4">
                                {/* Start Row */}
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider ml-1">Start</label>
                                    <div className="flex gap-2 w-full">
                                        <input
                                            type="date"
                                            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all cursor-pointer"
                                            value={startDate}
                                            onChange={e => setStartDate(e.target.value)}
                                            required
                                        />
                                        <input
                                            type="time"
                                            className="w-32 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all cursor-pointer"
                                            value={startTime}
                                            onChange={e => setStartTime(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                {/* End Row */}
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider ml-1">End</label>
                                    <div className="flex gap-2 w-full">
                                        <input
                                            type="date"
                                            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all cursor-pointer"
                                            value={endDate}
                                            onChange={e => setEndDate(e.target.value)}
                                            required
                                        />
                                        <input
                                            type="time"
                                            className="w-32 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all cursor-pointer"
                                            value={endTime}
                                            onChange={e => setEndTime(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="flex gap-4">
                        <AlignLeft size={18} className="text-zinc-500 mt-1" />
                        <textarea
                            placeholder="Add description"
                            className="w-full bg-transparent border-none text-zinc-300 placeholder-zinc-600 focus:ring-0 p-0 text-sm resize-none"
                            rows={3}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    {/* Footer Actions */}
                    <div className="flex justify-between items-center pt-4 border-t border-zinc-800">
                        {/* Left Side: Delete (Edit Mode Only) */}
                        <div>
                            {initialEvent && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (window.confirm('Are you sure you want to delete this event?')) {
                                            onDelete(initialEvent);
                                            onClose();
                                        }
                                    }}
                                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-950/50 rounded-lg transition-colors flex items-center gap-2"
                                    title="Delete Event"
                                >
                                    <Trash2 size={18} />
                                    <span className="text-xs font-medium">Delete</span>
                                </button>
                            )}
                        </div>

                        {/* Right Side: Cancel & Save */}
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-500/20 transition-all"
                            >
                                {initialEvent ? 'Update Event' : 'Save Event'}
                            </button>
                        </div>
                    </div>

                </form>
            </div>
        </div>
    );
}

function getCategoryStyles(type) {
    switch (type) {
        case 'work': return { active: 'bg-indigo-900/50 border-indigo-500 text-indigo-300' };
        case 'personal': return { active: 'bg-amber-900/50 border-amber-500 text-amber-300' };
        case 'critical': return { active: 'bg-red-900/50 border-red-500 text-red-300' };
        default: return { active: 'bg-emerald-900/50 border-emerald-500 text-emerald-300' }; // user
    }
}
