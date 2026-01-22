export interface GBIFOccurrence {
    key: number;
    scientificName: string;
    decimalLatitude?: number;
    decimalLongitude?: number;
    eventDate?: string;
    country?: string;
    recordedBy?: string;
    catalogNumber?: string;
    institutionCode?: string;
    collectionCode?: string;
    locality?: string;
    media: Array<{
        type: string;
        format: string;
        identifier: string;
    }>;
    // Add other fields as needed for comparison
    [key: string]: any;
}

export const GBIFService = {
    parseOccurrenceId: (input: string): string | null => {
        if (!input) return null;

        // Handle full URLs like https://www.gbif.org/occurrence/2432617679
        const urlMatch = input.match(/occurrence\/(\d+)/);
        if (urlMatch) return urlMatch[1];

        // Handle plain numeric IDs
        if (/^\d+$/.test(input)) return input;

        return null;
    },

    fetchOccurrence: async (id: string): Promise<GBIFOccurrence> => {
        const response = await fetch(`https://api.gbif.org/v1/occurrence/${id}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch GBIF occurrence: ${response.statusText}`);
        }
        return response.json();
    },

    extractImage: (occurrence: GBIFOccurrence): string | null => {
        if (!occurrence.media || occurrence.media.length === 0) return null;

        // Prefer StillImage with jpeg/png format
        const image = occurrence.media.find(m =>
            m.type === 'StillImage' ||
            (m.format && m.format.startsWith('image/'))
        );

        return image ? image.identifier : null;
    }
};
