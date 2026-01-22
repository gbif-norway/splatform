import { useState, useEffect } from 'react';
import { StorageService, type AppSettings } from '../services/storage';

export function useSettings() {
    const [settings, setSettings] = useState<AppSettings>(StorageService.getSettings());

    const __saveSettings = (newSettings: AppSettings) => {
        StorageService.saveSettings(newSettings);
        setSettings(newSettings);
        // Dispatch custom event to notify other hook instances
        window.dispatchEvent(new CustomEvent('slpat-settings-changed', { detail: newSettings }));
    };

    useEffect(() => {
        const handleSettingsChange = (e: Event) => {
             const detail = (e as CustomEvent<AppSettings>).detail;
             if (detail) {
                 setSettings(detail);
             } else {
                 setSettings(StorageService.getSettings());
             }
        };

        // Listen for internal changes
        window.addEventListener('slpat-settings-changed', handleSettingsChange);
        // Listen for cross-tab changes
        window.addEventListener('storage', () => setSettings(StorageService.getSettings()));

        return () => {
             window.removeEventListener('slpat-settings-changed', handleSettingsChange);
             window.removeEventListener('storage', () => setSettings(StorageService.getSettings()));
        };
    }, []);

    return {
        settings,
        saveSettings: __saveSettings
    };
}
