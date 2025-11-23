import React from 'react';
import { Edit2, Trash2, Bed, LogOut as CheckOutIcon, Link as Link2 } from 'lucide-react';
import { getSimpleTime } from '../utils/dateUtils';

const AccommodationCard = ({ ex, onEdit, onDelete, isReadOnly, isCheckOut }) => {
    return (
        <div className={`bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex items-start gap-4 relative h-full ${isCheckOut ? 'opacity-75 bg-gray-50' : ''}`}>
                {!isReadOnly && !isCheckOut && (<div className="absolute top-2 right-2 flex gap-1"><button onClick={onEdit} className="p-1 text-gray-400 hover:text-blue-600"><Edit2 className="w-3 h-3"/></button><button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-3 h-3"/></button></div>)}
                <div className={`p-3 rounded-full ${isCheckOut ? 'bg-gray-200 text-gray-500' : 'bg-purple-100 text-purple-600'}`}>{isCheckOut ? <CheckOutIcon className="w-6 h-6"/> : <Bed className="w-6 h-6"/>}</div>
                <div className="flex-1">
                <div className={`text-xs font-bold uppercase mb-0.5 ${isCheckOut ? 'text-gray-500' : 'text-purple-600'}`}>{isCheckOut ? 'Check-out' : 'Check-in / Alloggio'}</div>
                <div className="flex justify-between items-start">
                    <h4 className="text-lg font-bold text-brand-dark">{ex.name}</h4>
                    {!isCheckOut && ex.cost > 0 && <span className="font-bold text-purple-800 text-sm">€{ex.cost}</span>}
                </div>
                <p className="text-sm text-gray-600">{ex.location} • {ex.accommodationType}</p>
                {!isCheckOut && ex.description && <p className="text-xs text-gray-500 mt-1 bg-gray-50 p-2 rounded">{ex.description}</p>}
                <div className="mt-2 flex gap-3 text-xs font-medium text-gray-700">
                    <span>🕒 {isCheckOut ? 'Entro le' : 'Dalle'}: {getSimpleTime(isCheckOut ? ex.dateEnd : ex.dateStart) || (isCheckOut ? '10:00' : '14:00')}</span>
                    {!isCheckOut && ex.website && <a href={ex.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1"><Link2 className="w-3 h-3"/> Prenotazione</a>}
                </div>
                </div>
        </div>
    );
};
export default AccommodationCard;