/** Turn unknown failures into an Error with message, stack, and chained causes preserved for display. */
export function normalizeUnknownError(e: unknown): Error {
    if (e instanceof Error) {
        const parts: string[] = [];
        if (e.message) parts.push(e.message);
        let c: unknown = (e as Error & { cause?: unknown }).cause;
        let depth = 0;
        while (c instanceof Error && depth < 8) {
            parts.push(`Cause: ${c.message}`);
            c = (c as Error & { cause?: unknown }).cause;
            depth++;
        }
        const msg = parts.length > 0 ? parts.join('\n') : e.name || 'Error';
        const out = new Error(msg);
        out.name = e.name;
        out.stack = e.stack;
        (out as Error & { cause?: unknown }).cause = (e as Error & { cause?: unknown }).cause;
        return out;
    }
    if (typeof e === 'object' && e !== null && 'message' in e) {
        return new Error(String((e as { message: unknown }).message));
    }
    return new Error(String(e));
}

/** Safe JSON-friendly snapshot for the error modal / GitHub report. */
export function serializeForErrorReport(e: unknown): unknown {
    if (e === null || e === undefined) return e;
    if (typeof e !== 'object') return e;
    if (e instanceof Error) {
        const base: Record<string, unknown> = {
            name: e.name,
            message: e.message,
            stack: e.stack,
        };
        const c = (e as Error & { cause?: unknown }).cause;
        if (c !== undefined) base.cause = serializeForErrorReport(c);
        return base;
    }
    try {
        return JSON.parse(JSON.stringify(e));
    } catch {
        return {
            note: 'Non-serializable object',
            stringTag: Object.prototype.toString.call(e),
        };
    }
}
