
interface PricingData {
    updated_at: string;
    prices: ModelPrice[];
}

interface ModelPrice {
    id: string;
    vendor: string;
    name: string;
    input: number; // Cost per 1M tokens
    output: number; // Cost per 1M tokens
}

const PRICING_URL = 'https://www.llm-prices.com/current-v1.json';
const CACHE_KEY = 'llm_pricing_data';
const CACHE_duration_MS = 24 * 60 * 60 * 1000; // 24 hours

export class PricingService {
    private static prices: Map<string, ModelPrice> = new Map();
    private static isInitialized = false;
    private static aliases: Map<string, string> = new Map();
    private static ALIAS_CACHE_KEY = 'llm_pricing_aliases';

    static async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            // Load Aliases
            const cachedAliases = localStorage.getItem(this.ALIAS_CACHE_KEY);
            if (cachedAliases) {
                const parsed = JSON.parse(cachedAliases);
                Object.entries(parsed).forEach(([k, v]) => this.aliases.set(k, v as string));
            }

            // Check cache
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const { timestamp, data } = JSON.parse(cached);
                if (Date.now() - timestamp < CACHE_duration_MS) {
                    this.setPrices(data);
                    this.isInitialized = true;
                    return;
                }
            }

            // Fetch fresh data
            const response = await fetch(PRICING_URL);
            if (!response.ok) {
                throw new Error(`Failed to fetch pricing data: ${response.statusText}`);
            }

            const data: PricingData = await response.json();
            this.setPrices(data);

            // Update cache
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                data: data
            }));

            this.isInitialized = true;
        } catch (error) {
            console.error("PricingService initialization failed:", error);
            // Offensive programming: Do not set initialized, let calls fail or handle explicitly
            throw error;
        }
    }

    private static setPrices(data: PricingData) {
        this.prices.clear();
        data.prices.forEach(p => {
            this.prices.set(p.id, p);
        });
    }

    static addAlias(fromId: string, toId: string) {
        this.aliases.set(fromId, toId);
        // Persist
        const obj = Object.fromEntries(this.aliases);
        localStorage.setItem(this.ALIAS_CACHE_KEY, JSON.stringify(obj));
    }

    static getAllModels(): ModelPrice[] {
        return Array.from(this.prices.values()).sort((a, b) => a.id.localeCompare(b.id));
    }

    /**
     * Calculates cost. Returns null if pricing not found (offensive).
     */
    static calculateCost(modelId: string, inputTokens: number, outputTokens: number): number | null {
        if (!this.isInitialized) {
            console.warn("PricingService not initialized");
            return null;
        }

        // 0. Check User Alias
        let targetId = this.aliases.get(modelId) || modelId;

        // 1. Try exact match
        let price = this.prices.get(targetId);

        // 2. Try hardcoded mapping if not found
        if (!price) {
            if (targetId === 'claude-3-5-sonnet-20240620') price = this.prices.get('claude-3.5-sonnet');
            else if (targetId === 'claude-3-opus-20240229') price = this.prices.get('claude-3-opus');
            else if (targetId === 'claude-3-sonnet-20240229') price = this.prices.get('claude-3-sonnet');
            else if (targetId === 'claude-3-haiku-20240307') price = this.prices.get('claude-3-haiku');
            else if (targetId === 'gpt-4-turbo-preview') price = this.prices.get('gpt-4-turbo');
            else if (targetId === 'grok-vision-beta') price = this.prices.get('grok-2-vision-1212');
        }

        if (!price) {
            console.error(`Pricing not found for model: ${modelId} (target: ${targetId})`);
            return null;
        }

        const inputCost = (inputTokens / 1_000_000) * price.input;
        const outputCost = (outputTokens / 1_000_000) * price.output;

        return inputCost + outputCost;
    }
}
