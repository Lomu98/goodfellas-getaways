import React from 'react';
import { Edit2, Trash2, CheckSquare, Car, Link as Link2 } from 'lucide-react';
import { getSimpleTime } from '../utils/dateUtils';

const RentalCard = ({ ex, onEdit, onDelete, isReadOnly, isDropOff }) => {
    const time = getSimpleTime(isDropOff ? ex.dateEnd : ex.dateStart);
    return (
        <div className={`relative flex flex-col md:flex-row bg-white rounded-lg shadow-md border-l-4 overflow-hidden ticket-edge h-full ${isDropOff ? 'border-gray-400 opacity-80' : 'border-teal-500'}`}>
            {!isReadOnly && !isDropOff && (<div className="absolute top-2 right-2 flex gap-1 z-10"><button onClick={onEdit} className="p-1 text-gray-400 hover:text-blue-600"><Edit2 className="w-3 h-3"/></button><button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-3 h-3"/></button></div>)}
            
            <div className="p-4 flex-1 flex flex-col justify-center border-r border-dashed border-gray-200 relative">
                <div className={`flex items-center gap-2 text-xs font-bold uppercase mb-1 ${isDropOff ? 'text-gray-500' : 'text-teal-600'}`}>
                    {isDropOff ? <CheckSquare className="w-4 h-4"/> : <Car className="w-4 h-4"/>} 
                    {isDropOff ? 'Fine Noleggio / Restituzione' : 'Ritiro Auto'}
                </div>
                <h4 className="text-lg font-bold text-brand-dark">{ex.name}</h4>
                <div className="flex items-center gap-3 mt-2">
                    <div className="text-xl font-bold text-gray-800">{time}</div>
                    <div className="text-sm text-gray-500 ml-2">
                        {isDropOff ? 'Consegna chiavi' : `Presso: ${ex.location || 'Luogo non specificato'}`}
                    </div>
                </div>
                {!isDropOff && ex.cost > 0 && <div className="mt-2 font-bold text-teal-800">€{ex.cost}</div>}
            </div>
            {!isDropOff && (
                <div className="p-4 w-full md:w-1/3 bg-gray-50 flex flex-col justify-center items-center text-center gap-2">
                    <div className="text-xs text-gray-400 uppercase tracking-widest">Info</div>
                    {ex.website && <a href={ex.website} target="_blank" rel="noreferrer" className="text-blue-600 underline text-xs truncate max-w-[150px]"><Link2 className="w-3 h-3 inline"/> Dettagli</a>}
                    <div className="text-xs text-gray-500 line-clamp-3">{ex.description || "Nessuna nota aggiuntiva"}</div>
                </div>
            )}
        </div>
    );
};
export default RentalCard;