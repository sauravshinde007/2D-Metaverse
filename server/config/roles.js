export const ROLES = {
    EMPLOYEE: 'employee',
    ADMIN: 'admin',
    HR: 'hr',
    CEO: 'ceo'
};

export const PERMISSIONS = {
    CAN_BAN_USERS: [ROLES.ADMIN],
    CAN_MANAGE_ROLES: [ROLES.ADMIN, ROLES.CEO],
    CAN_ENTER_RESTRICTED_AREAS: [ROLES.ADMIN, ROLES.CEO],
};

// Define access levels for specific room IDs (which we will map to coordinates/zones in client)
export const ROOM_ACCESS_LEVELS = {
    'common_area': [ROLES.EMPLOYEE, ROLES.ADMIN, ROLES.HR, ROLES.CEO],
    'meeting_room': [ROLES.EMPLOYEE, ROLES.ADMIN, ROLES.HR, ROLES.CEO],
    'server_room': [ROLES.ADMIN],
    'ceo_office': [ROLES.CEO, ROLES.ADMIN], // Maybe admin can enter for maintenance
    'hr_office': [ROLES.HR, ROLES.ADMIN, ROLES.CEO],
};
