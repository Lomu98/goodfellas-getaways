import React from 'react';
import { Wallet, Camera, Plane, Bed, Utensils, Car, Info, Tag } from 'lucide-react';

const BudgetView = ({ excursions, myVotes }) => {
    const standardConfig = {
        'activity': { label: 'Attività', icon: <Camera className="w-4 h-4"/>, color: 'bg-brand-action' },
        'travel': { label: 'Spostamenti', icon: <Plane className="w-4 h-4"/>, color: 'bg-blue-500' },
        'accommodation': { label: 'Alloggi', icon: <Bed className="w-4 h-4"/>, color: 'bg-purple-500' },
        'food': { label: 'Ristorazione', icon: <Utensils className="w-4 h-4"/>, color: 'bg-orange-500' },
        'rental': { label: 'Noleggio', icon: <Car className="w-4 h-4"/>, color: 'bg-teal-500' },
        'other': { label: 'Altro', icon: <Info className="w-4 h-4"/>, color: 'bg-gray-500' }
    };

    const stats = {};
    let grandTotal = 0;

    excursions.forEach(ex => {
        const isIncluded = ex.isVotable === false || myVotes.includes(ex.id);
        
        if(isIncluded) {
            const cost = Number(ex.cost) || 0;
            const rawType = ex.type || 'activity';
            
            if (!stats[rawType]) {
                const isStandard = standardConfig[rawType];
                const conf = isStandard || { 
                    label: rawType.charAt(0).toUpperCase() + rawType.slice(1), 
                    icon: <Tag className="w-4 h-4"/>, 
                    color: 'bg-indigo-500' 
                };
                stats[rawType] = { ...conf, total: 0 };
            }
            
            stats[rawType].total += cost;
            grandTotal += cost;
        }
    });

    const sortedCategories = Object.entries(stats).sort(([,a], [,b]) => b.total - a.total);

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg">
            <h2 className="text-2xl font-serif font-bold text-brand-dark mb-6 flex items-center gap-2"><Wallet className="w-6 h-6 text-brand-accent"/> Gestione Budget</h2>
            
            <div className="mb-8 text-center p-6 bg-brand-light rounded-xl border border-brand-accent/30">
                <p className="text-sm text-brand-secondary uppercase tracking-wider font-bold mb-1">Totale Stimato</p>
                <div className="text-5xl font-serif font-bold text-brand-dark">€{grandTotal.toFixed(2)}</div>
            </div>

            <div className="space-y-4">
                {sortedCategories.length > 0 ? sortedCategories.map(([key, cat]) => {
                    const percent = grandTotal > 0 ? (cat.total / grandTotal) * 100 : 0;
                    return (
                        <div key={key}>
                            <div className="flex justify-between items-end mb-1">
                                <div className="flex items-center gap-2 font-bold text-brand-dark">{cat.icon} {cat.label}</div>
                                <div className="font-mono font-bold">€{cat.total.toFixed(2)}</div>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                                <div className={`h-full ${cat.color}`} style={{width: `${percent}%`}}></div>
                            </div>
                            <div className="text-right text-xs text-gray-400 mt-1">{percent.toFixed(1)}%</div>
                        </div>
                    );
                }) : <p className="text-center text-gray-500 italic">Nessuna spesa registrata.</p>}
            </div>
        </div>
    );
};

export default BudgetView;