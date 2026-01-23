export interface TranscribedItem {
    id: string;
    timestamp: number;
    imageUrl?: string; // Stored as base64 (might be large, consider limits later or user-uploaded transient URL)
    // Actually, storing large images in localStorage is bad. 
    // For this app, maybe we just store the text result and metadata? 
    // And maybe a thumbnail? Or just rely on the user having the file.
    // The user requested: "it would be nice if there was locally stored history though"
    // I will try to store a small thumbnail if possible, or just the filename.
    filename: string;
    prompt1: string;
    result1: string;
    prompt2: string;
    result2: string;
    provider1: string; // "openai/gpt-4o"
    temp1: number;
    provider2: string;
    temp2: number;
}

export interface AppSettings {
    openaiKey: string;
    geminiKey: string;
    anthropicKey: string;
    xaiKey: string;
    proxyUrl: string;
}

const SETTINGS_KEY = 'slpat_settings';
const HISTORY_KEY = 'slpat_history';

export const StorageService = {
    getSettings: (): AppSettings => {
        try {
            const data = localStorage.getItem(SETTINGS_KEY);
            const defaults = {
                openaiKey: '',
                geminiKey: '',
                anthropicKey: '',
                xaiKey: '',
                proxyUrl: import.meta.env.VITE_PROXY_URL || ''
            };

            if (!data) return defaults;

            const parsed = JSON.parse(data);
            // Merge defaults to ensure new fields (like proxyUrl) are populated if missing in old data
            return { ...defaults, ...parsed, proxyUrl: parsed.proxyUrl || defaults.proxyUrl };
        } catch {
            return {
                openaiKey: '',
                geminiKey: '',
                anthropicKey: '',
                xaiKey: '',
                proxyUrl: import.meta.env.VITE_PROXY_URL || ''
            };
        }
    },

    saveSettings: (settings: AppSettings) => {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    },

    getHistory: (): TranscribedItem[] => {
        try {
            const data = localStorage.getItem(HISTORY_KEY);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    },

    addToHistory: (item: TranscribedItem) => {
        const history = StorageService.getHistory();
        // Keep max 50 items to avoid quota limits if we store text
        const newHistory = [item, ...history].slice(0, 50);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
    },

    clearHistory: () => {
        localStorage.removeItem(HISTORY_KEY);
    },

    getRecentState: () => {
        try {
            const data = localStorage.getItem('slpat_session');
            return data ? JSON.parse(data) : null;
        } catch { return null; }
    },

    saveRecentState: (state: any) => {
        localStorage.setItem('slpat_session', JSON.stringify(state));
    }
};
