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
        <div className="p-4 text-center text-slate-500 text-sm">No history yet</div>
    );

    return (
        <div className="space-y-3 p-2">
            <div className="flex justify-between items-center px-2">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">History ({items.length})</h3>
                <button onClick={handleClear} className="text-slate-600 hover:text-red-400"><Trash2 size={14} /></button>
            </div>
            {items.map(item => (
                <div
                    key={item.id}
                    onClick={() => onLoadItem(item)}
                    className="group cursor-pointer rounded-lg border border-slate-800 bg-slate-900/30 p-3 hover:bg-slate-800 hover:border-blue-500/30 transition-all"
                >
                    <div className="flex justify-between items-start mb-1">
                        <span className="text-xs text-slate-500">{new Date(item.timestamp).toLocaleString(undefined, {
                            year: 'numeric',
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false
                        })}</span>
                        <span className="text-xs bg-slate-800 px-1.5 py-0.5 rounded text-blue-300">{item.provider1}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Clock size={12} className="text-slate-600" />
                        <span className="truncate">{item.result1.substring(0, 30)}...</span>
                        <ArrowRight size={12} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-blue-400" />
                    </div>
                </div>
            ))}
        </div>
    );
}
