import { useState, useEffect } from 'react';
import { StorageService, type AppSettings } from '../services/storage';

export function useSettings() {
    const [settings, setSettings] = useState<AppSettings>(StorageService.getSettings());

    const __saveSettings = (newSettings: AppSettings) => {
        StorageService.saveSettings(newSettings);
        setSettings(newSettings);
    };

    // Sync with local storage on mount (in case changed in another tab, though unlikely to need real-time sync for this)
    useEffect(() => {
        setSettings(StorageService.getSettings());
    }, []);

    return {
        settings,
        saveSettings: __saveSettings
    };
}
