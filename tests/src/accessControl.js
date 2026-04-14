const ROOM_ACCESS_LEVELS = {
    'public': ['guest', 'employee', 'admin', 'moderator'],
    'confidential': ['employee', 'admin', 'moderator'],
    'executive': ['admin']
};

export const checkMeetingAccess = (userRole, roomType, isBanned) => {
    if (isBanned) return { allowed: false, reason: 'User is banned' };
    const allowedRoles = ROOM_ACCESS_LEVELS[roomType];
    if (!allowedRoles) return { allowed: false, reason: 'Invalid room type' };
    if (!allowedRoles.includes(userRole)) return { allowed: false, reason: 'Insufficient permissions' };
    return { allowed: true };
};

export const capacityCheck = (currentUsers, maxCapacity) => {
    return currentUsers >= maxCapacity ? false : true;
};
