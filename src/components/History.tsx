import { StorageService, type TranscribedItem } from '../services/storage';
import { Clock, Trash2, ArrowRight } from 'lucide-react';
import { useState, useEffect } from 'react';

interface HistoryProps {
    onLoadItem: (item: TranscribedItem) => void;
    refreshTrigger: number;
}

export function History({ onLoadItem, refreshTrigger }: HistoryProps) {
    const [items, setItems] = useState<TranscribedItem[]>([]);

    useEffect(() => {
        setItems(StorageService.getHistory());
    }, [refreshTrigger]);

    const handleClear = () => {
        if (confirm("Clear history?")) {
            StorageService.clearHistory();
            setItems([]);
        }
    }

    if (items.length === 0) return (
        <div className="p-4 text-center text-foreground-muted text-sm">No history yet</div>
    );

    return (
        <div className="space-y-3 p-2">
            <div className="flex justify-between items-center px-2">
                <h3 className="text-sm font-semibold text-foreground-muted uppercase tracking-wider">History ({items.length})</h3>
                <button onClick={handleClear} className="text-foreground-muted hover:text-red-400"><Trash2 size={14} /></button>
            </div>
            {items.map(item => (
                <div
                    key={item.id}
                    onClick={() => onLoadItem(item)}
                    className="group cursor-pointer rounded-lg border border-border bg-surface/30 p-3 hover:bg-surface-hover hover:border-primary/30 transition-all"
                >
                    <div className="flex justify-between items-start mb-1">
                        <span className="text-xs text-foreground-muted">{new Date(item.timestamp).toLocaleString(undefined, {
                            year: 'numeric',
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false
                        })}</span>
                        <span className="text-xs bg-surface-hover px-1.5 py-0.5 rounded text-primary">{item.provider1}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-foreground">
                        <Clock size={12} className="text-foreground-muted" />
                        <span className="truncate">{item.result1.substring(0, 30)}...</span>
                        <ArrowRight size={12} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                    </div>
                </div>
            ))}
        </div>
    );
}
