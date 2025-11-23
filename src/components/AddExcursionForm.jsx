import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from './Modal';
import DateTimeInput from './DateTimeInput';

const AddExcursionForm = ({ onSave, onClose, initialData, tripDates }) => {
  const [data, setData] = useState(initialData || { name: '', type: 'activity', isVotable: true, dateStart: '', dateEnd: '', cost: '', description: '', location: '', origin: '' }); 
  const [files, setFiles] = useState([]); 
  const [loading, setLoading] = useState(false);
  
  const standardTypes = ['activity', 'travel', 'accommodation', 'food', 'rental', 'other'];
  const isCustomType = data.type && !standardTypes.includes(data.type);

  useEffect(() => {
      if (data.type === 'travel' && data.dateStart && data.dateEnd) {
          const start = new Date(data.dateStart); const end = new Date(data.dateEnd);
          const diffMs = end - start;
          if (diffMs > 0) {
              const hours = Math.floor(diffMs / 3600000); const mins = Math.round((diffMs % 3600000) / 60000);
              setData(prev => ({...prev, duration: `${hours}h ${mins > 0 ? mins + 'm' : ''}`}));
          }
      }
  }, [data.dateStart, data.dateEnd, data.type]);

  const handleSubmit = async (e) => { 
      e.preventDefault(); 
      if (tripDates && tripDates.start) { 
          const pStart = new Date(tripDates.start); pStart.setHours(0,0,0,0); 
          const pEnd = tripDates.end ? new Date(tripDates.end) : new Date(pStart); pEnd.setHours(23,59,59,999); 
          const aStart = new Date(data.dateStart); 
          const aEnd = data.dateEnd ? new Date(data.dateEnd) : aStart; 
          if (aStart < pStart || aEnd > pEnd) { 
              if (!confirm("Attenzione: Data fuori dal periodo evento. Continuare?")) return; 
          } 
      } 
      setLoading(true); 
      const finalData = { ...data, dateEnd: data.dateEnd || '', cost: Number(data.cost) || 0 }; 
      await onSave(finalData, files); 
      setLoading(false); 
      onClose(); 
  };
  
  const handleTypeSelect = (e) => { 
      const val = e.target.value;
      if (val === 'custom') setData({...data, type: ''});
      else { const autoVotable = val === 'activity' || val === 'food'; setData({...data, type: val, isVotable: autoVotable}); }
  };

  return ( 
    <Modal onClose={onClose}>
        <h2 className="text-2xl font-bold font-serif text-brand-dark mb-4">{initialData ? 'Modifica' : 'Nuovo'} Elemento</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2">
              <div className="w-2/3">
                <label className="text-xs text-gray-500 block mb-1">Tipologia</label>
                <div className="flex gap-2">
                    <select value={isCustomType ? 'custom' : (data.type || 'activity')} onChange={handleTypeSelect} className="flex-1 p-2 border rounded bg-white">
                        <option value="activity">📷 Attività / Escursione</option>
                        <option value="travel">✈️ Spostamento / Viaggio</option>
                        <option value="accommodation">🏨 Alloggio / Hotel</option>
                        <option value="food">🍽️ Ristorazione</option>
                        <option value="rental">🚗 Noleggio</option>
                        <option value="other">ℹ️ Generico / Info</option>
                        <option value="custom">✏️ Personalizzato...</option>
                    </select>
                </div>
                {(isCustomType || data.type === '') && (<input type="text" placeholder="Nome Categoria" value={data.type} onChange={e => setData({...data, type: e.target.value})} className="w-full p-2 border rounded mt-2 bg-blue-50 font-bold text-brand-dark" required />)}
              </div>
              <div className="w-1/3 flex items-end pb-2"><label className="flex items-center gap-2 cursor-pointer select-none"><input type="checkbox" checked={data.isVotable !== false} onChange={e=>setData({...data, isVotable: e.target.checked})} className="w-5 h-5 text-brand-action rounded" /><span className="text-sm font-bold">Adesione</span></label></div>
            </div>
            
            <input type="text" placeholder={data.type === 'travel' ? "Tratta (es. Roma - Milano)" : "Titolo"} value={data.name} onChange={e=>setData({...data, name: e.target.value})} className="w-full p-2 border rounded" required />
            
            {data.type === 'travel' ? (
                 <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="Da (Partenza)" value={data.origin || ''} onChange={e=>setData({...data, origin: e.target.value})} className="p-2 border rounded bg-gray-50" />
                    <input type="text" placeholder="A (Arrivo/Luogo)" value={data.location || ''} onChange={e=>setData({...data, location: e.target.value})} className="p-2 border rounded" />
                 </div>
            ) : (
                <input type="text" placeholder="Luogo / Indirizzo" value={data.location || ''} onChange={e=>setData({...data, location: e.target.value})} className="w-full p-2 border rounded" />
            )}
            
            {data.type === 'travel' && (<div className="grid grid-cols-2 gap-2"><input type="text" placeholder="Mezzo (es. Aereo)" value={data.transportMode || ''} onChange={e=>setData({...data, transportMode: e.target.value})} className="p-2 border rounded" /><input type="text" placeholder="Durata (es. 2h 30m)" value={data.duration || ''} onChange={e=>setData({...data, duration: e.target.value})} className="p-2 border rounded" /><input type="number" placeholder="Distanza (km)" value={data.distance || ''} onChange={e=>setData({...data, distance: e.target.value})} className="p-2 border rounded" /></div>)}
            {data.type === 'accommodation' && (<div className="grid grid-cols-2 gap-2"><input type="text" placeholder="Tipo (es. Hotel)" value={data.accommodationType || ''} onChange={e=>setData({...data, accommodationType: e.target.value})} className="p-2 border rounded" /><input type="text" placeholder="Sito Web" value={data.website || ''} onChange={e=>setData({...data, website: e.target.value})} className="p-2 border rounded" /></div>)}
            {data.type === 'food' && (<div className="grid grid-cols-2 gap-2"><input type="text" placeholder="Cucina" value={data.cuisine || ''} onChange={e=>setData({...data, cuisine: e.target.value})} className="p-2 border rounded" /><input type="text" placeholder="Link Menu" value={data.website || ''} onChange={e=>setData({...data, website: e.target.value})} className="p-2 border rounded" /></div>)}

            <div className="flex gap-2"><div className="w-1/2"><DateTimeInput label="Inizio" valueIso={data.dateStart} onChange={v=>setData({...data, dateStart: v})} required /></div><div className="w-1/2"><DateTimeInput label="Fine" valueIso={data.dateEnd} onChange={v=>setData({...data, dateEnd: v})} /></div></div><input type="number" placeholder="Costo (opzionale)" value={data.cost} onChange={e=>setData({...data, cost: e.target.value})} className="w-full p-2 border rounded" /><textarea placeholder="Descrizione..." value={data.description} onChange={e=>setData({...data, description: e.target.value})} className="w-full p-2 border rounded" rows="3"></textarea><div className="border-2 border-dashed p-4 text-center rounded bg-gray-50"><label className="cursor-pointer text-brand-action font-bold">Carica Foto<input type="file" multiple className="hidden" onChange={e=>setFiles(Array.from(e.target.files))} /></label>{files.length > 0 && <div className="text-xs mt-1">{files.length} file selezionati</div>}</div><button type="submit" disabled={loading} className="w-full bg-brand-dark text-white py-2 rounded font-bold flex justify-center">{loading?<Loader2 className="animate-spin"/>:'Salva'}</button>
        </form>
    </Modal> 
  );
};

export default AddExcursionForm;