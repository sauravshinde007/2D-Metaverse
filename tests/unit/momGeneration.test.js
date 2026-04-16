import { jest } from '@jest/globals';
import { formatTranscriptChunks, constructPrompt, parseGroqResponse } from '../src/momGeneration.js';

describe('Audio-to-Text MOM Logic Evaluator', () => {
    
    describe('Timeline Mapping & Text Generation', () => {
        it('should map a lonely timeline text chunk into readable dialog', () => {
            const data = [{ timestamp: '10:00', speaker: 'Alice', text: 'Hello' }];
            expect(formatTranscriptChunks(data)).toBe('[10:00] Alice: Hello');
        });
        it('should seamlessly append multiple sequential transcript blocks', () => {
            const data = [
                { timestamp: '10:00', speaker: 'Alice', text: 'Start' },
                { timestamp: '10:01', speaker: 'Bob', text: 'End' }
            ];
            expect(formatTranscriptChunks(data)).toBe('[10:00] Alice: Start\n[10:01] Bob: End');
        });
        it('should survive missing arrays returning standard fallback string', () => {
            expect(formatTranscriptChunks([])).toBe('');
        });
        it('should guarantee code execution continuity on empty inputs', () => {
            expect(formatTranscriptChunks(null)).toBe('');
        });
    });

    describe('LLM String Parsing Mechanics', () => {
        it('should correctly merge user transcript logic within prompt wrapper', () => {
            expect(constructPrompt('Critical Bug Found')).toContain('Critical Bug Found');
        });
        it('should enforce Action Items text inside instructions', () => {
            expect(constructPrompt('test')).toContain('Action Items');
        });
        it('should halt logic via Throw Exception when core data evaluates undefined', () => {
            expect(() => constructPrompt('')).toThrow('No Context Text Available for Parser');
        });
    });

    describe('External AI Provider Interface Translation', () => {
        it('should effectively unwrap deeply nested JSON into plain strings', () => {
            const mockResponse = { choices: [{ message: { content: ' Valid MOM Content ' } }] };
            expect(parseGroqResponse(mockResponse)).toBe('Valid MOM Content');
        });
        it('should fail with null if entire response wrapper is broken', () => {
            expect(parseGroqResponse(null)).toBeNull();
        });
        it('should map incomplete tree structures naturally without throwing stack dumps', () => {
            expect(parseGroqResponse({ someOtherData: true })).toBeNull();
        });
        it('should capture arrays missing intended indices seamlessly', () => {
            expect(parseGroqResponse({ choices: [] })).toBeNull();
        });
        it('should capture improperly built choices structures efficiently', () => {
            expect(parseGroqResponse({ choices: [{ noMessageHere: true }] })).toBeNull();
        });
    });
});
