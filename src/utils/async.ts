type Task<T> = () => Promise<T>;

export function pLimit(concurrency: number) {
    const queue: (() => void)[] = [];
    let activeCount = 0;

    const next = () => {
        activeCount--;
        if (queue.length > 0) {
            const resume = queue.shift();
            if (resume) resume();
        }
    };

    return async <T>(fn: Task<T>): Promise<T> => {
        if (activeCount >= concurrency) {
            await new Promise<void>(resolve => queue.push(resolve));
        }

        activeCount++;
        try {
            return await fn();
        } finally {
            next();
        }
    };
}

export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    retries = 3,
    delay = 1000,
    backoff = 2,
    shouldRetry: (err: any) => boolean = (err) => {
        // Retry on network errors or 429/5xx
        const msg = String(err).toLowerCase();
        if (msg.includes('fetch failed') || msg.includes('network request failed')) return true;

        // Check for specific status codes if available in error object (e.g. from fetch response)
        // Assuming standard Error or something with status
        const status = (err as any)?.status || (err as any)?.response?.status;
        if (status === 429 || (status >= 500 && status < 600)) return true;

        // Also check message for "rate limit" or "too many requests"
        if (msg.includes('rate limit') || msg.includes('too many requests')) return true;

        return false;
    }
): Promise<T> {
    try {
        return await fn();
    } catch (err: any) {
        if (retries > 0 && shouldRetry(err)) {
            console.warn(`Retrying operation... (${retries} left). Error: ${err.message}`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return retryWithBackoff(fn, retries - 1, delay * backoff, backoff, shouldRetry);
        }
        throw err;
    }
}
