
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

    static async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
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
            // Also map by name if needed, or handle variations?
            // For now, assume ID match. 
            // Some providers might use different IDs than the pricing JSON.
            // We might need a mapper later.
        });
    }

    /**
     * Calculates cost. Returns null if pricing not found (offensive).
     */
    static calculateCost(modelId: string, inputTokens: number, outputTokens: number): number | null {
        if (!this.isInitialized) {
            console.warn("PricingService not initialized");
            return null;
        }

        // Try exact match
        let price = this.prices.get(modelId);

        // Try fuzzy match if exact fail (e.g. "gpt-4o-2024-05-13" vs "gpt-4o")
        if (!price) {
            // Common aliasing or fuzzy matching logic could go here if needed.
            // For now, strict.
            // Actually, let's try to be a bit smart about provider prefixes if they exist in our app but not in the JSON
            // The JSON uses IDs like "gpt-4o", "claude-3-5-sonnet".
            // Our app uses IDs like "gpt-4o", "claude-3-5-sonnet-20240620".

            // Attempt to find a price where the known ID matches the start of our modelId
            // or vice versa.
            // But valid "offensive" approach is to require exact or known content.
            // Let's rely on exact match first.
        }

        if (!price) {
            // Check for specific known mappings if ids differ significantly
            // OpenAI: our app uses 'gpt-4o', json has 'gpt-4o'
            // Anthropic: our app 'claude-3-5-sonnet-20240620', json 'claude-3.5-sonnet' (note dot vs dash and version)

            // Mapping for Anthropic
            if (modelId === 'claude-3-5-sonnet-20240620') price = this.prices.get('claude-3.5-sonnet');
            else if (modelId === 'claude-3-opus-20240229') price = this.prices.get('claude-3-opus');
            else if (modelId === 'claude-3-sonnet-20240229') price = this.prices.get('claude-3-sonnet');
            else if (modelId === 'claude-3-haiku-20240307') price = this.prices.get('claude-3-haiku');

            // OpenAI
            else if (modelId === 'gpt-4-turbo-preview') price = this.prices.get('gpt-4-turbo');

            // Gemini
            // App: 'gemini-1.5-flash' -> JSON: 'gemini-1.5-flash' (match)
            // App: 'gemini-1.5-pro' -> JSON: 'gemini-1.5-pro' (match)

            // xAI
            // App: 'grok-vision-beta' -> JSON might not have it or have different ID
            // json has: grok-2-vision-1212 etc.
            else if (modelId === 'grok-vision-beta') price = this.prices.get('grok-2-vision-1212'); // Best guess mapping
        }

        if (!price) {
            console.error(`Pricing not found for model: ${modelId}`);
            return null;
        }

        const inputCost = (inputTokens / 1_000_000) * price.input;
        const outputCost = (outputTokens / 1_000_000) * price.output;

        return inputCost + outputCost;
    }
}
