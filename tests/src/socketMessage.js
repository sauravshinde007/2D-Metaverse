export const validateMovementPayload = (data) => {
    if (!data) return false;
    const { x, y, anim } = data;
    if (typeof x !== 'number' || typeof y !== 'number') return false;
    if (x < 0 || y < 0) return false; 
    if (typeof anim !== 'string' || anim.length === 0) return false;
    return true;
};

export const sanitizeChatInput = (message) => {
    if (typeof message !== 'string') return '';
    return message.replace(/<[^>]*>?/gm, '').trim(); 
};
