import React, { useState } from 'react';
import { Loader2, Edit2, X, Plus } from 'lucide-react';
import Modal from './Modal';
import DateTimeInput from './DateTimeInput';

const PostEditorModal = ({ onClose, onSave, post, participants }) => {
    const [data, setData] = useState({ 
        description: post.description || '', 
        location: post.location || '', 
        memoryDate: post.memoryDate || '',
        taggedUserIds: post.taggedUserIds || [],
    });
    const [saving, setSaving] = useState(false);

    const untaggedParticipants = participants.filter(p => !data.taggedUserIds.includes(p.id));

    const toggleTag = (userId) => {
        setData(prev => {
            const currentTags = prev.taggedUserIds;
            return {
                ...prev,
                taggedUserIds: currentTags.includes(userId)
                    ? currentTags.filter(id => id !== userId)
                    : [...currentTags, userId]
            };
        });
    };
    
    const handleSave = async () => {
        setSaving(true);
        await onSave(data);
        setSaving(false);
        onClose();
    };

    return (
        <Modal onClose={onClose} size="lg">
            <h2 className="text-2xl font-bold font-serif text-brand-dark mb-4">Modifica Post</h2>
            
            <div className="flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-1/3 shrink-0 aspect-square bg-gray-200 rounded-lg overflow-hidden flex items-center justify-center">
                    <img src={post.url} alt="Post attuale" className="w-full h-full object-cover" />
                </div>
                <div className="w-full md:w-2/3 space-y-4">
                        <p className="text-xs text-brand-secondary">Caricato da: **{post.uploaderName}**</p>
                    <textarea 
                        placeholder="Aggiungi una descrizione..." 
                        value={data.description} 
                        onChange={e => setData(prev => ({...prev, description: e.target.value}))}
                        className="w-full p-2 border rounded-lg text-sm" 
                        rows="3" 
                    />
                    
                    <DateTimeInput 
                        label="Data del Ricordo (Opzionale)" 
                        valueIso={data.memoryDate} 
                        onChange={v => setData(prev => ({...prev, memoryDate: v}))} 
                    />

                    <input 
                        type="text" 
                        placeholder="Luogo (Geolocalizzazione opzionale)" 
                        value={data.location} 
                        onChange={e => setData(prev => ({...prev, location: e.target.value}))}
                        className="w-full p-2 border rounded-lg text-sm" 
                    />
                    
                    <div className="pt-2">
                        <h4 className="font-bold text-sm text-brand-dark mb-2">Tagga Compagni ({data.taggedUserIds.length})</h4>
                        <div className="max-h-32 overflow-y-auto space-y-1 p-2 border rounded-lg bg-gray-50">
                            {participants.filter(p => data.taggedUserIds.includes(p.id)).map(p => (
                                <button key={p.id} onClick={() => toggleTag(p.id)} className="w-full text-left p-1.5 rounded-md bg-brand-action/10 border border-brand-action text-sm flex items-center justify-between font-medium">
                                    <span>{p.name}</span><X className="w-4 h-4 text-red-600"/>
                                </button>
                            ))}
                            {untaggedParticipants.map(p => (
                                <button key={p.id} onClick={() => toggleTag(p.id)} className="w-full text-left p-1.5 rounded-md bg-white hover:bg-brand-light text-sm flex items-center justify-between">
                                    <span>{p.name}</span><Plus className="w-4 h-4 text-brand-action"/>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end mt-6 pt-4 border-t border-gray-100">
                <button onClick={onClose} className="text-brand-secondary px-4 py-2 rounded-lg hover:bg-gray-100">Annulla</button>
                <button onClick={handleSave} disabled={saving} className="ml-3 bg-brand-dark text-white py-2 px-4 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50">
                    {saving ? <Loader2 className="animate-spin w-5 h-5"/> : <Edit2 className="w-5 h-5"/>} Salva Modifiche
                </button>
            </div>
        </Modal>
    );
};

export default PostEditorModal;