import React, { useState, useEffect } from 'react';
import { Loader2, Plane, Bed, Utensils, Car, Info, Camera, MapPin } from 'lucide-react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import Modal from './Modal';
import { formatDateRange } from '../utils/dateUtils';
import { appId } from '../lib/firebase';

const groupExcursionsByDay = (excursions) => excursions.reduce((acc, ex) => { const day = ex.dateStart ? ex.dateStart.split('T')[0] : 'Indefinito'; if (!acc[day]) acc[day] = []; acc[day].push(ex); return acc; }, {});

const ProgrammaPreviewModal = ({ trip, db, onClose }) => {
  const [excursions, setExcursions] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  useEffect(() => onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', `published_trips/${trip.id}/excursions`)), s => { setExcursions(s.docs.map(d => ({id: d.id, ...d.data()}))); setLoading(false); }), [db, trip.id]);
  
  const grouped = groupExcursionsByDay(excursions); 
  const sortedDays = Object.keys(grouped).sort();
  
  const getTypeIcon = (type) => { switch(type){ case 'travel': return <Plane className="w-5 h-5 text-blue-500"/>; case 'accommodation': return <Bed className="w-5 h-5 text-purple-500"/>; case 'food': return <Utensils className="w-5 h-5 text-orange-500"/>; case 'rental': return <Car className="w-5 h-5 text-teal-600"/>; case 'other': return <Info className="w-5 h-5 text-gray-500"/>; default: return <Camera className="w-5 h-5 text-brand-accent"/>; } };
  
  return ( 
    <Modal onClose={onClose} size="xl">
        <h2 className="text-2xl font-serif font-bold text-brand-dark mb-4">Anteprima: {trip.name}</h2>
        {loading ? <Loader2 className="animate-spin w-8 h-8 mx-auto" /> : (
            <div className="space-y-6">
                {sortedDays.length > 0 ? sortedDays.map(day => (
                    <section key={day}>
                        <h3 className="text-lg font-serif font-bold text-brand-dark mb-2 border-b border-brand-accent/30 pb-1">{formatDateRange(day, day)}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {grouped[day].map(ex => (
                                <div key={ex.id} className="bg-white rounded-lg shadow-sm overflow-hidden flex border border-gray-100">
                                    <div className="w-1/3 bg-brand-dark flex-shrink-0 flex items-center justify-center relative">
                                        {ex.images && ex.images.length > 0 ? <img src={ex.images[0]} className="w-full h-full object-cover opacity-80" alt="" /> : <div className="h-full w-full flex items-center justify-center bg-brand-dark">{getTypeIcon(ex.type)}</div>}
                                    </div>
                                    <div className="p-4 flex-1">
                                        <h4 className="font-bold text-brand-dark flex items-center gap-2">{getTypeIcon(ex.type)} {ex.name}</h4>
                                        {ex.location && <span className="text-xs text-brand-secondary flex items-center gap-1"><MapPin className="w-3 h-3"/> {ex.location}</span>}
                                        <p className="text-xs text-brand-secondary line-clamp-2 mt-1">{ex.description}</p>
                                        <span className="text-sm font-bold text-brand-dark mt-2 block">€{ex.cost || 0}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )) : <p>Nessun dettaglio.</p>}
            </div>
        )}
    </Modal> 
  );
};
export default ProgrammaPreviewModal;