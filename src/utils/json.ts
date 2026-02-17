export type JSONParseStatus = 'clean' | 'markdown' | 'fuzzy' | 'failed';

export interface JSONParseResult {
    data: any;
    status: JSONParseStatus;
    error?: string;
}

/**
 * Attempts to parse JSON from a string using multiple strategies:
 * 1. Direct parsing
 * 2. Markdown code block extraction
 * 3. Brace matching (fuzzy)
 */
export function robustJSONParse(input: string): JSONParseResult {
    if (!input || typeof input !== 'string') {
        return { data: null, status: 'failed', error: 'Empty or invalid input' };
    }

    const trimmed = input.trim();

    // Strategy 1: Direct Parse
    try {
        const data = JSON.parse(trimmed);
        return { data, status: 'clean' };
    } catch (e) {
        // Continue to next strategy
    }

    // Strategy 2: Markdown Code Block
    // Matches ```json ... ``` or just ``` ... ```
    const markdownMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (markdownMatch) {
        try {
            const data = JSON.parse(markdownMatch[1]);
            return { data, status: 'markdown' };
        } catch (e) {
            // Found block but failed to parse content
        }
    }

    // Strategy 3: Fuzzy Extraction (Find outermost braces)
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const candidate = trimmed.substring(firstBrace, lastBrace + 1);
        try {
            const data = JSON.parse(candidate);
            return { data, status: 'fuzzy' };
        } catch (e) {
            // Failed fuzzy parse
        }
    }

    return { data: null, status: 'failed', error: 'Unable to parse JSON using any strategy' };
}
