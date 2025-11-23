import React from 'react';
import { Edit2, Trash2, MapPin, Euro, Check, X, CheckSquare, Camera, Utensils, Car } from 'lucide-react';
import { getSimpleTime } from '../utils/dateUtils';
import ImageCarousel from './ImageCarousel';

const ActivityCard = ({ ex, onToggleVote, hasVoted, voters, onEdit, onDelete, isReadOnly }) => {
    const mapQuery = ex.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ex.location)}` : null; 
    const dateString = getSimpleTime(ex.dateStart);
    const isVotable = ex.isVotable !== false;
    
    let config = {icon: <Camera className="w-4 h-4"/>, label: 'Attività', bg: 'bg-brand-accent text-brand-dark'}; 
    if(ex.type === 'food') { config.icon = <Utensils className="w-4 h-4"/>; config.label = 'Ristorazione'; config.bg = 'bg-orange-100 text-orange-800'; }
    if(ex.type === 'rental') { config.icon = <Car className="w-4 h-4"/>; config.label = 'Noleggio'; config.bg = 'bg-teal-100 text-teal-800'; }
    
    return (
      <div className={`bg-white rounded-xl shadow-lg overflow-hidden flex flex-col border border-gray-100 relative h-full ${!isVotable ? 'border-l-4 border-l-gray-300' : ''}`}>
        {!isReadOnly && (<div className="absolute top-2 right-2 z-10 flex gap-1"><button onClick={onEdit} className="p-1.5 bg-white/80 rounded-full hover:text-blue-600 shadow"><Edit2 className="w-4 h-4"/></button><button onClick={onDelete} className="p-1.5 bg-white/80 rounded-full hover:text-red-600 shadow"><Trash2 className="w-4 h-4"/></button></div>)}
        <div className="h-48 relative bg-brand-dark shrink-0">
            <ImageCarousel images={ex.images} name={ex.name} />
            <span className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 uppercase shadow-sm ${config.bg}`}>{config.icon} {config.label}</span>
        </div>
        <div className="p-5 flex-grow flex flex-col">
            <div className="flex justify-between items-start mb-2">
                <h3 className="text-xl font-serif font-semibold text-brand-dark leading-tight">{ex.name}</h3>
                {dateString && <span className="text-xs font-bold bg-gray-100 px-2 py-1 rounded shrink-0 ml-2">{dateString}</span>}
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
                {ex.location && (mapQuery ? <a href={mapQuery} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1"><MapPin className="w-3 h-3"/> {ex.location}</a> : <span className="text-xs text-brand-secondary flex items-center gap-1"><MapPin className="w-3 h-3"/> {ex.location}</span>)}
                {ex.cuisine && <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded">{ex.cuisine}</span>}
            </div>
            <p className="text-sm text-brand-secondary mb-4 whitespace-pre-wrap flex-grow">{ex.description}</p>
            <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between">
                {ex.cost > 0 ? <div className="flex items-center text-brand-dark font-bold text-lg"><Euro className="w-5 h-5 text-brand-accent mr-1"/>{ex.cost}</div> : <div></div>}
                {isVotable ? (
                <div className="flex items-center gap-2">
                    {voters && voters.length > 0 && <span className="text-xs text-gray-500">{voters.length} part.</span>}
                    <button onClick={()=>onToggleVote(ex.id)} className={`px-4 py-2 rounded-lg font-bold text-sm text-white flex items-center gap-2 ${hasVoted?'bg-brand-secondary':'bg-brand-action'}`}>{hasVoted ? <><X className="w-4 h-4"/> No</> : <><Check className="w-4 h-4"/> Sì</>}</button>
                </div>
                ) : (<span className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1"><CheckSquare className="w-4 h-4"/> Included</span>)}
            </div>
        </div>
      </div>
    );
};
export default ActivityCard;