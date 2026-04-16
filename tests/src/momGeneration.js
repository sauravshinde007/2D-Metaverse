export const formatTranscriptChunks = (transcripts) => {
    if (!transcripts || transcripts.length === 0) return '';
    return transcripts.map(t => `[${t.timestamp}] ${t.speaker}: ${t.text}`).join('\n');
};

export const constructPrompt = (contextText) => {
    if (!contextText) throw new Error('No Context Text Available for Parser');
    return `Generate a professional Minutes of Meeting (MOM) summary for the following transcript:\n\n${contextText}\n\nInclude Action Items and Key Decisions.`;
};

export const parseGroqResponse = (response) => {
    try {
        if (!response || !response.choices || response.choices.length === 0) return null;
        return response.choices[0].message.content.trim();
    } catch {
        return null;
    }
};
