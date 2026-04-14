import { jest } from '@jest/globals';
import { validateMovementPayload, sanitizeChatInput } from '../src/socketMessage.js';

describe('WebSocket Transmission Validations', () => {
    
    describe('Spatial Navigation Payloads', () => {
        it('should accept properly formed x/y/anim payloads', () => {
            expect(validateMovementPayload({ x: 100, y: 150, anim: 'walk-down' })).toBe(true);
        });
        it('should identify missing X coordinates', () => {
            expect(validateMovementPayload({ y: 150, anim: 'walk-down' })).toBe(false);
        });
        it('should identify missing Y coordinates', () => {
            expect(validateMovementPayload({ x: 100, anim: 'walk-down' })).toBe(false);
        });
        it('should discard payload with malicious string-based numeric insertions', () => {
            expect(validateMovementPayload({ x: '100', y: 150, anim: 'walk-down' })).toBe(false);
        });
        it('should trap null injection inside mapped coordinates', () => {
            expect(validateMovementPayload({ x: 100, y: null, anim: 'walk-down' })).toBe(false);
        });
        it('should enforce boundaries and reject negative out-of-scope grid inputs', () => {
            expect(validateMovementPayload({ x: -10, y: 150, anim: 'walk-down' })).toBe(false);
        });
        it('should drop payloads that lack directional animation references', () => {
            expect(validateMovementPayload({ x: 100, y: 150, anim: '' })).toBe(false);
        });
        it('should gracefully close validation pipeline on completely undefined packets', () => {
            expect(validateMovementPayload(undefined)).toBe(false);
        });
        it('should safely error out on raw null dispatches', () => {
            expect(validateMovementPayload(null)).toBe(false);
        });
    });

    describe('Chat Pipeline Buffer Sanitization', () => {
        it('should allow clean strings unaffected', () => {
            expect(sanitizeChatInput('Hello team!')).toBe('Hello team!');
        });
        it('should effectively nullify script injections preventing Cross-Site execution', () => {
            expect(sanitizeChatInput('<script>alert("hack")</script>')).toBe('alert("hack")');
        });
        it('should strip complex DOM objects keeping only raw string data intact', () => {
            expect(sanitizeChatInput('<b onmouseover="alert(\'x\')">Bold text</b>')).toBe('Bold text');
        });
        it('should accept and transform empty string packets directly', () => {
            expect(sanitizeChatInput('')).toBe('');
        });
        it('should prevent null pointer violations from empty clients', () => {
            expect(sanitizeChatInput(null)).toBe('');
        });
        it('should enforce spacing normalization during broadcast preparation', () => {
            expect(sanitizeChatInput('   Hello   ')).toBe('Hello');
        });
    });
});
