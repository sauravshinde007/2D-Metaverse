import { jest } from '@jest/globals';
import { checkMeetingAccess, capacityCheck } from '../src/accessControl.js';

describe('Meeting Access Control Logic', () => {
    
    describe('Role-based Authorizations', () => {
        it('should grant guest access to public rooms', () => {
            expect(checkMeetingAccess('guest', 'public', false)).toEqual({ allowed: true });
        });
        it('should revoke guest access to confidential rooms', () => {
            expect(checkMeetingAccess('guest', 'confidential', false).allowed).toBe(false);
        });
        it('should allow employees into confidential tier meetings', () => {
            expect(checkMeetingAccess('employee', 'confidential', false)).toEqual({ allowed: true });
        });
        it('should deny employee access to executive meetings', () => {
            expect(checkMeetingAccess('employee', 'executive', false).allowed).toBe(false);
        });
        it('should permit global admin bypass to executive zones', () => {
            expect(checkMeetingAccess('admin', 'executive', false)).toEqual({ allowed: true });
        });
    });

    describe('Access Overrides & Edge Cases', () => {
        it('should strictly deny banned users irrespective of high roles', () => {
            expect(checkMeetingAccess('admin', 'executive', true)).toEqual({ allowed: false, reason: 'User is banned' });
        });
        it('should deny if room configuration does not exist', () => {
            expect(checkMeetingAccess('employee', 'non_existent_room', false).allowed).toBe(false);
        });
        it('should deny access if user profile has undefined role', () => {
            expect(checkMeetingAccess(undefined, 'public', false).allowed).toBe(false);
        });
        it('should fail safely on empty string inputs', () => {
            expect(checkMeetingAccess('guest', '', false).allowed).toBe(false);
        });
    });

    describe('Server Node Capacity Limits', () => {
        it('should allow entry if room is completely empty', () => {
            expect(capacityCheck(0, 10)).toBe(true);
        });
        it('should allow entry if room is exactly 1 under maximum limit', () => {
            expect(capacityCheck(9, 10)).toBe(true);
        });
        it('should block entry via strict failure when at exact capacity', () => {
            expect(capacityCheck(10, 10)).toBe(false);
        });
        it('should block entry gracefully if room somehow exceeds limit', () => {
            expect(capacityCheck(15, 10)).toBe(false);
        });
    });
});
