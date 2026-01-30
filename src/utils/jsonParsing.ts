import { jsonrepair } from 'jsonrepair';

/**
 * Extracts the likely JSON content from a string (finding the outer {} or []).
 * @param text The input string that might contain JSON.
 * @returns The extracted string that looks like JSON, or the original string if no braces found.
 */
export function extractJson(text: string): string {
    const trimmed = text.trim();
    // Match anything starting with { or [ and ending with } or ] regardless of newlines
    // We'll use a simple approach: find first { or [ and last } or ]

    const firstOpenBrace = trimmed.indexOf('{');
    const firstOpenBracket = trimmed.indexOf('[');

    let start = -1;
    if (firstOpenBrace !== -1 && firstOpenBracket !== -1) {
        start = Math.min(firstOpenBrace, firstOpenBracket);
    } else if (firstOpenBrace !== -1) {
        start = firstOpenBrace;
    } else if (firstOpenBracket !== -1) {
        start = firstOpenBracket;
    }

    if (start === -1) return text;

    const lastCloseBrace = trimmed.lastIndexOf('}');
    const lastCloseBracket = trimmed.lastIndexOf(']');

    let end = -1;
    if (lastCloseBrace !== -1 && lastCloseBracket !== -1) {
        end = Math.max(lastCloseBrace, lastCloseBracket);
    } else if (lastCloseBrace !== -1) {
        end = lastCloseBrace;
    } else if (lastCloseBracket !== -1) {
        end = lastCloseBracket;
    }

    if (end === -1 || end <= start) return text;

    return trimmed.substring(start, end + 1);
}

interface ParseResult {
    data: any;
    isRepaired: boolean;
    error?: string;
}

/**
 * Tries to parse JSON, first strictly, then using jsonrepair.
 * @param text The input text to parse.
 * @returns Object containing data, isRepaired flag, and optional error.
 */
export function parseMessyJson(text: string): ParseResult {
    const cleaned = extractJson(text);

    // 1. Try strict parsing first
    try {
        const data = JSON.parse(cleaned);
        return { data, isRepaired: false };
    } catch (e) {
        // Strict parsing failed, fall through to repair
    }

    // 2. Try jsonrepair
    try {
        const repaired = jsonrepair(cleaned);
        const data = JSON.parse(repaired);
        if (typeof data !== 'object' || data === null) {
            throw new Error("Parsed result is not an object or array");
        }
        return { data, isRepaired: true };
    } catch (e) {
        return { data: null, isRepaired: false, error: e instanceof Error ? e.message : String(e) };
    }
}
