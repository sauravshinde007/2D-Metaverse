import React, { useEffect, useState, useRef } from 'react';

const PlayerLabels = () => {
    // Strategy:
    // 1. Store label data in a Refs for direct access.
    // 2. ONLY re-render React component when the *list of players* changes (join/leave).
    // 3. Update DOM node positions directly via `style.transform` in the event loop.
    // This avoids React's VDOM diffing overhead for position updates (60fps).

    const [visibleIds, setVisibleIds] = useState([]);
    const labelDataRef = useRef({}); // Map id -> {x, y, username, isLocal}
    const labelElementsRef = useRef({}); // Map id -> DOMElement



    // Solution:
    // Use a Ref to store the latest IDs that React *has rendered*.
    const renderedIdsRef = useRef([]);

    // We need to re-bind the listener to use the ref correctly? No, ref is stable.

    useEffect(() => {
        const handleUpdate = (e) => {
            const newData = e.detail;
            const newIds = newData.map(l => l.id);

            // Update Data
            const newMap = {};
            newData.forEach(d => newMap[d.id] = d);
            labelDataRef.current = newMap;

            // Check Change
            const current = renderedIdsRef.current;
            const changed = newIds.length !== current.length || !newIds.every((val, index) => val === current[index]);
            // Using strict order comparison is fine if Phaser sends consistent order.
            // If order changes, we re-render. Cheap enough.

            if (changed) {
                renderedIdsRef.current = newIds;
                setVisibleIds(newIds);
            }

            // DOM Update
            newIds.forEach(id => {
                const el = labelElementsRef.current[id];
                const data = newMap[id];
                if (el && data) {
                    el.style.transform = `translate3d(${Math.round(data.x)}px, ${Math.round(data.y)}px, 0) translate(-50%, -100%)`;
                }
            });
        };

        window.addEventListener('player-labels-update', handleUpdate);
        return () => window.removeEventListener('player-labels-update', handleUpdate);
    }, []);

    return (
        <div
            className="absolute inset-0 pointer-events-none overflow-hidden"
            style={{ zIndex: 100 }}
        >
            {visibleIds.map(id => {
                // Use data from ref (might be slightly ahead of render cycle but safe)
                const data = labelDataRef.current[id];
                if (!data) return null;

                return (
                    <div
                        key={id}
                        ref={el => labelElementsRef.current[id] = el}
                        className="absolute whitespace-nowrap text-white font-bold text-sm select-none flex flex-col items-center 
                                   bg-black/60 backdrop-blur-sm rounded-lg py-1 px-3 border border-white/10 shadow-lg"
                        style={{
                            // Initial position
                            transform: `translate3d(${Math.round(data.x)}px, ${Math.round(data.y)}px, 0) translate(-50%, -100%)`,
                            willChange: 'transform',
                        }}
                    >
                        <span
                            className={data.isLocal ? "text-green-300" : "text-white"}
                            style={{ fontFamily: 'Inter, sans-serif' }}
                        >
                            {data.username}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

export default PlayerLabels;
