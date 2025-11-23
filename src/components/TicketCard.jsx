import React from 'react';
import { Edit2, Trash2, Plane, ArrowRight } from 'lucide-react';
import { getSimpleTime } from '../utils/dateUtils';

const TicketCard = ({ ex, onEdit, onDelete, isReadOnly }) => {
    const timeStart = getSimpleTime(ex.dateStart);
    const timeEnd = getSimpleTime(ex.dateEnd);
    const originName = ex.origin || 'Partenza';
    const destName = ex.location || 'Arrivo';

    return (
        <div className="relative flex flex-col md:flex-row bg-white rounded-lg shadow-md border-l-4 border-blue-500 overflow-hidden ticket-edge h-full">
            {!isReadOnly && (<div className="absolute top-2 right-2 flex gap-1 z-10"><button onClick={onEdit} className="p-1 text-gray-400 hover:text-blue-600"><Edit2 className="w-3 h-3"/></button><button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-3 h-3"/></button></div>)}
            <div className="p-4 flex-1 flex flex-col justify-center border-r border-dashed border-gray-200 relative">
                <div className="flex items-center gap-2 text-blue-600 text-xs font-bold uppercase mb-1"><Plane className="w-4 h-4"/> {ex.transportMode || 'Spostamento'}</div>
                <h4 className="text-lg font-bold text-brand-dark">{ex.name}</h4>
                <div className="flex items-center gap-3 mt-2">
                    <div className="text-center w-1/3">
                        <div className="text-xl font-bold text-gray-800">{timeStart}</div>
                        <div className="text-xs text-gray-500 truncate">{originName}</div>
                    </div>
                    <div className="flex-1 flex items-center justify-center"><div className="h-[2px] w-full bg-gray-300 relative flex items-center justify-end"><ArrowRight className="w-4 h-4 text-gray-300 -mr-1" /></div></div>
                    <div className="text-center w-1/3">
                        <div className="text-xl font-bold text-gray-800">{timeEnd}</div>
                        <div className="text-xs text-gray-500 truncate">{destName}</div>
                    </div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-2 border-t border-dashed pt-2">
                    <span>{ex.duration}</span>
                    {ex.cost > 0 && <span className="font-bold text-blue-800">€{Number(ex.cost).toFixed(2)}</span>}
                </div>
            </div>
            <div className="p-4 w-full md:w-1/3 bg-gray-50 flex flex-col justify-center items-center text-center gap-2">
                <div className="text-xs text-gray-400 uppercase tracking-widest">Info</div>
                {ex.distance && <span className="font-mono text-sm font-bold">{ex.distance} km</span>}
                <div className="text-xs text-gray-500 line-clamp-3">{ex.description}</div>
            </div>
        </div>
    );
};
export default TicketCard;