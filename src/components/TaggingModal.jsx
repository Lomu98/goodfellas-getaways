import React, { useState } from 'react';
import { X, Plus, ArrowRight, Send } from 'lucide-react';
import Modal from './Modal';
import DateTimeInput from './DateTimeInput';
import { formatDateRange } from '../utils/dateUtils';

const TaggingModal = ({ onClose, onSave, files, participants }) => {
    const [step, setStep] = useState(0);
    const [currentFileIndex, setCurrentFileIndex] = useState(0);
    const [data, setData] = useState(files.map(f => ({
        file: f,
        description: '',
        location: '',
        memoryDate: '',
        taggedUserIds: [],
    })));

    const currentData = data[currentFileIndex];
    const untaggedParticipants = participants.filter(p => !currentData.taggedUserIds.includes(p.id));

    const handleSave = () => {
        onSave(data);
        onClose();
    };

    const handleNext = () => {
        if (currentFileIndex < files.length - 1) {
            setCurrentFileIndex(i => i + 1);
        } else {
            setStep(1); 
        }
    };

    const toggleTag = (userId) => {
        setData(prev => {
            const newData = [...prev];
            const currentTags = newData[currentFileIndex].taggedUserIds;
            if (currentTags.includes(userId)) {
                newData[currentFileIndex].taggedUserIds = currentTags.filter(id => id !== userId);
            } else {
                newData[currentFileIndex].taggedUserIds = [...currentTags, userId];
            }
            return newData;
        });
    };
    
    const handleChange = (field, value) => {
        setData(prev => {
            const newData = [...prev];
            newData[currentFileIndex] = { ...newData[currentFileIndex], [field]: value };
            return newData;
        });
    };

    return (
        <Modal onClose={onClose} size="xl">
            <h2 className="text-2xl font-bold font-serif text-brand-dark mb-4">{step === 0 ? `Dettagli Foto ${currentFileIndex + 1}/${files.length}` : 'Riepilogo'}</h2>
            
            {step === 0 && (
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="w-full md:w-1/2 shrink-0 aspect-square bg-gray-200 rounded-lg overflow-hidden flex items-center justify-center">
                        <img src={URL.createObjectURL(currentData.file)} alt="Anteprima" className="w-full h-full object-cover" />
                    </div>
                    <div className="w-full md:w-1/2 space-y-4">
                        <textarea 
                            placeholder="Aggiungi una descrizione..." 
                            value={currentData.description} 
                            onChange={e => handleChange('description', e.target.value)}
                            className="w-full p-2 border rounded-lg text-sm" 
                            rows="3" 
                        />
                        <DateTimeInput 
                            label="Data del Ricordo (Opzionale)" 
                            valueIso={currentData.memoryDate} 
                            onChange={v => handleChange('memoryDate', v)} 
                        />
                        <input 
                            type="text" 
                            placeholder="Luogo (Geolocalizzazione opzionale)" 
                            value={currentData.location} 
                            onChange={e => handleChange('location', e.target.value)}
                            className="w-full p-2 border rounded-lg text-sm" 
                        />
                        <div className="pt-2">
                            <h4 className="font-bold text-sm text-brand-dark mb-2">Tagga Compagni ({currentData.taggedUserIds.length})</h4>
                            <div className="max-h-32 overflow-y-auto space-y-1 p-2 border rounded-lg bg-gray-50">
                                {participants.filter(p => currentData.taggedUserIds.includes(p.id)).map(p => (
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
            )}

            {step === 1 && (
                <div className="space-y-4">
                    <p className="text-brand-dark font-bold">Pronto per caricare {files.length} foto.</p>
                    <div className="max-h-80 overflow-y-auto space-y-3">
                    {data.map((item, index) => (
                        <div key={index} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                            <img src={URL.createObjectURL(item.file)} alt="Anteprima" className="w-12 h-12 object-cover rounded" />
                            <div className="flex-1">
                                <p className="font-medium line-clamp-1">{item.description || 'Nessuna descrizione'}</p>
                                <p className="text-xs text-gray-500">{item.location || 'Nessun luogo'} • {item.memoryDate ? formatDateRange(item.memoryDate) : 'Data Sconosciuta'} • {item.taggedUserIds.length} tag</p>
                            </div>
                        </div>
                    ))}
                    </div>
                    <button onClick={() => setStep(0)} className="text-sm text-brand-action hover:underline">Torna ai dettagli</button>
                </div>
            )}

            <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
                <button onClick={onClose} className="text-brand-secondary px-4 py-2 rounded-lg hover:bg-gray-100">Annulla</button>
                {step === 0 ? (
                    <button onClick={handleNext} disabled={!currentData.file} className="bg-brand-dark text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50">
                        {currentFileIndex < files.length - 1 ? 'Avanti' : 'Riepilogo'} <ArrowRight className="w-4 h-4"/>
                    </button>
                ) : (
                    <button onClick={handleSave} className="w-1/2 bg-brand-action text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2">
                        <Send className="w-5 h-5"/> Carica Tutto
                    </button>
                )}
            </div>
        </Modal>
    );
};

export default TaggingModal;