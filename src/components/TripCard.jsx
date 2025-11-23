import React from 'react';
import { MapPin, Users2, CalendarRange, Banknote, ImageIcon, Star, Check, RotateCcw, Copy, UserPlus, Edit2, Eye, EyeOff, Trash2, Loader2 } from 'lucide-react';
import { formatDateRange } from '../utils/dateUtils';

const TripCard = ({ trip, isPublic, isAdmin, isCreator, onAction, onSecondaryAction, actionLoading }) => {
  const status = trip.status || 'private'; 
  const dateString = (trip.dateStart) ? formatDateRange(trip.dateStart, trip.dateEnd) : null; 
  const joinType = trip.joinType || 'open';
  const today = new Date().toISOString().split('T')[0]; 
  const isPast = trip.dateEnd && trip.dateEnd < today; 
  const effectiveDeadline = trip.joinDeadline || trip.dateStart; 
  const isJoinClosed = effectiveDeadline && effectiveDeadline < today;
  const ratingVal = (trip.ratingCount && trip.ratingCount > 0) ? (trip.ratingTotal / trip.ratingCount).toFixed(1) : null;

  const renderStatusBadge = () => {
    if (isPast) return <span className="absolute top-2 left-2 bg-gray-800 text-white text-xs px-2 py-1 rounded font-bold">SVOLTO</span>;
    if (isPublic) { 
        if (trip.hidden) return <span className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">NASCOSTO</span>; 
        return <span className={`absolute top-2 left-2 text-xs px-2 py-1 rounded font-bold ${joinType === 'open' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{joinType === 'open' ? 'Aperto' : 'Su Richiesta'}</span> 
    }
    if (isCreator) { 
        if (status === 'pending_review') return <span className="absolute top-2 right-2 bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded font-bold">IN ATTESA</span>; 
        if (status === 'approved') return <span className="absolute top-2 right-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-bold">PUBBLICATO</span>; 
        if (status === 'rejected') return <span className="absolute top-2 right-2 bg-red-100 text-red-800 text-xs px-2 py-1 rounded font-bold">RIFIUTATO</span>; 
    }
    return <span className={`absolute top-2 left-2 text-xs px-2 py-1 rounded font-bold ${joinType === 'open' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{joinType === 'open' ? 'Aperto' : 'Su Richiesta'}</span>;
  };

  return ( 
    <div className={`bg-white rounded-xl shadow-lg overflow-hidden flex flex-col border border-gray-100 relative group ${isPast ? 'opacity-90 grayscale-[20%]' : ''} ${trip.hidden && isPublic ? 'opacity-60 grayscale' : ''}`}>
        <div className="h-48 bg-brand-dark flex items-center justify-center relative cursor-pointer" onClick={onSecondaryAction}>
            {trip.imageUrl ? <img src={trip.imageUrl} onError={e=>e.currentTarget.src='https://placehold.co/600x400/222A3A/C6A875?text=Img+Error'} className="w-full h-full object-cover" alt={trip.name} /> : <ImageIcon className="w-12 h-12 text-brand-accent" />}
            {renderStatusBadge()}
            {ratingVal && (<div className="absolute bottom-2 right-2 bg-white/95 backdrop-blur border border-yellow-400 text-brand-dark px-2 py-1 rounded-lg shadow-md flex items-center gap-1 font-bold text-sm z-10"><span className="text-brand-dark">{ratingVal}</span><Star className="w-4 h-4 fill-yellow-400 text-yellow-400" /></div>)}
        </div>
        <div className="p-5 flex-grow cursor-pointer" onClick={onSecondaryAction}>
            <div className="flex justify-between items-start mb-2">
                <h3 className="text-xl font-serif font-semibold text-brand-dark line-clamp-1">{trip.name}</h3>
                {trip.price > 0 && <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded flex items-center gap-1 whitespace-nowrap"><Banknote className="w-3 h-3"/> €{trip.price}</span>}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-brand-secondary mb-3">
                {trip.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/> {trip.location}</span>}
                {trip.maxPeople > 0 && <span className="flex items-center gap-1"><Users2 className="w-3 h-3"/> Max {trip.maxPeople}</span>}
            </div>
            {dateString && <div className="text-xs text-brand-secondary mb-3 flex items-center gap-1"><CalendarRange className="w-3 h-3"/> {dateString}</div>}
            <p className="text-sm text-brand-secondary line-clamp-2">{trip.description}</p>
        </div>
        <div className="p-2 border-t bg-gray-50/50 text-xs text-brand-secondary">Curato da: <span className="font-medium text-brand-dark">{trip.organizers ? trip.organizers.join(', ') : (trip.creatorName || '...')}</span></div>
        <div className="p-4 border-t bg-gray-50 flex gap-2 items-center">
            {(() => { 
                let finalDisabled = actionLoading || (onAction.disabled && !onAction.isWithdraw); 
                let finalLabel = onAction.label; 
                let finalColor = onAction.color || 'bg-brand-action'; 
                if (isPublic) { 
                    if (isPast && finalLabel !== 'Iscritto') { finalLabel = "Svolto"; finalDisabled = true; finalColor = "bg-gray-400"; } 
                    else if (isJoinClosed && finalLabel !== 'Iscritto' && finalLabel !== 'Richiesta Inviata') { finalLabel = "Iscrizioni Chiuse"; finalDisabled = true; finalColor = "bg-gray-400"; } 
                } 
                return (<button onClick={onAction.onClick} disabled={finalDisabled} className={`flex-1 py-2 rounded-lg font-semibold hover:bg-opacity-90 flex justify-center gap-2 text-sm text-white ${finalColor} ${finalDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>{actionLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <>{onAction.icon} {finalLabel}</>}</button>); 
            })()}
            {(isAdmin || isCreator) && onAction.tools && (<div className="flex gap-1">{onAction.tools.map((tool, i) => (<button key={i} onClick={(e) => { e.stopPropagation(); tool.onClick(); }} className="p-2 bg-gray-200 rounded hover:bg-gray-300 text-brand-dark" title={tool.title}>{tool.icon}</button>))}</div>)}
        </div>
    </div> 
  );
};

export default TripCard;