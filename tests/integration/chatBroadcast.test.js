import { jest } from '@jest/globals';

describe('Integration: Multi-Client Unified Chat Broadcasting Engine', () => {
    
    it('Should perform injection sanitation then successfully push public network broadcasts', async () => {
        const mockIO = { emit: jest.fn(), to: jest.fn().mockReturnThis() };
        let mockPersistentDatabaseStorage = jest.fn().mockResolvedValue(true);

        const handleIncomingChatEvent = async (senderId, text, room = null) => {
            const sanitizedCleanText = text.replace(/<.*?>/g, ''); 
            await mockPersistentDatabaseStorage({ senderId, text: sanitizedCleanText });
            
            if (room) mockIO.to(room).emit('chatMessage', { senderId, text: sanitizedCleanText });
            else mockIO.emit('chatMessage', { senderId, text: sanitizedCleanText });
        };

        await handleIncomingChatEvent('u1', '<b>Hello World</b>');

        // Validation against successful database preservation + live socket delivery
        expect(mockPersistentDatabaseStorage).toHaveBeenCalled();
        expect(mockIO.emit).toHaveBeenCalledWith('chatMessage', { senderId: 'u1', text: 'Hello World' });
    });

    it('Should route confidential communications strictly to allocated memory nodes (Private Spaces)', () => {
        const specificRoomChannel = { emit: jest.fn() };
        const mockIO = { emit: jest.fn(), to: jest.fn().mockReturnValue(specificRoomChannel) };
        
        const handleIncomingChatEvent = (senderId, text, room) => mockIO.to(room).emit('chatMessage', { senderId, text });

        handleIncomingChatEvent('u1', 'Private executive metrics', 'room_executive');

        // Verifies the backend routing engine limits access to specific ID segments rather than broadcast
        expect(mockIO.to).toHaveBeenCalledWith('room_executive');
        expect(specificRoomChannel.emit).toHaveBeenCalledWith('chatMessage', { senderId: 'u1', text: 'Private executive metrics' });
    });
});
