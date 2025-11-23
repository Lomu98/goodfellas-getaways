import React from 'react';
import { User, MapPin, Edit2, Trash2, Users2 } from 'lucide-react';
import { formatDateRange } from '../utils/dateUtils';

const MemoryCard = ({ photo, participants, onDelete, onEdit, isCreator, isUploader }) => {
    const uploader = participants.find(p => p.id === photo.uploadedBy);
    const tagged = photo.taggedUserIds?.map(id => participants.find(p => p.id === id)).filter(p => p);
    
    const displayDateRaw = photo.memoryDate || (photo.createdAt ? photo.createdAt.toDate().toISOString() : null);
    const displayDate = displayDateRaw ? formatDateRange(displayDateRaw) : 'Data Sconosciuta';

    const canInteract = isUploader || isCreator; 

    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 flex flex-col h-full overflow-hidden">
            <div className="aspect-square bg-brand-dark overflow-hidden relative">
                <img src={photo.url} alt={photo.description || 'Foto ricordo'} className="w-full h-full object-cover" />
                {tagged && tagged.length > 0 && (
                    <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                        <Users2 className="w-3 h-3"/> {tagged.length}
                    </div>
                )}
                {canInteract && (
                    <div className="absolute bottom-2 right-2 flex gap-2 z-10">
                        <button 
                            onClick={() => onEdit(photo)} 
                            className="bg-white/90 text-brand-action p-2 rounded-full hover:bg-white transition-colors shadow-lg"
                            title="Modifica Post"
                        >
                            <Edit2 className="w-4 h-4"/>
                        </button>
                        <button 
                            onClick={() => onDelete(photo)} 
                            className="bg-red-600/90 text-white p-2 rounded-full hover:bg-red-700 transition-colors shadow-lg"
                            title="Elimina Post"
                        >
                            <Trash2 className="w-4 h-4"/>
                        </button>
                    </div>
                )}
            </div>
            <div className="p-4 flex-grow flex flex-col">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                        <User className="w-3 h-3"/> Caricato da <span className="font-bold text-brand-dark">{uploader?.name || photo.uploaderName}</span>
                    </p>
                    <p className="text-xs text-brand-secondary">{displayDate}</p>
                </div>
                <p className="text-sm text-brand-dark mb-2 font-medium break-words">{photo.description}</p>
                {photo.location && (
                    <p className="text-xs text-blue-600 flex items-center gap-1 mt-auto">
                        <MapPin className="w-3 h-3"/> {photo.location}
                    </p>
                )}
                {tagged && tagged.length > 0 && (
                    <p className="text-xs text-gray-600 mt-2">
                        <span className="font-bold">Tag:</span> {tagged.map(p => p.name).join(', ')}
                    </p>
                )}
            </div>
        </div>
    );
};

export default MemoryCard;