import React, { useState } from 'react';
import { Loader2, Camera, Save, User, Globe, MapPin, Calendar, ScrollText } from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'; // Importa serverTimestamp
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Modal from './Modal.jsx'; // Aggiunto .jsx
import { appId } from '../lib/firebase.js'; // Aggiunto .js

const EditProfileModal = ({ user, onClose, db, storage, currentProfileData }) => {
    
    // Inizializza lo stato con tutti i campi esistenti
    const [formData, setFormData] = useState({
        name: currentProfileData.name || '',
        photoUrl: currentProfileData.photoUrl || '',
        birthdate: currentProfileData.birthdate || '', 
        nationality: currentProfileData.nationality || '',
        residence: currentProfileData.residence || '',
        description: currentProfileData.description || '',
    });
    
    const [photoFile, setPhotoFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(currentProfileData.photoUrl);
    const [loading, setLoading] = useState(false);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setPhotoFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            let photoURL = formData.photoUrl;

            // 1. Carica nuova foto se presente
            if (photoFile) {
                const storageRef = ref(storage, `profile_pics/${user.uid}_${Date.now()}`);
                await uploadBytes(storageRef, photoFile);
                photoURL = await getDownloadURL(storageRef);
            }

            // 2. Aggiorna Auth Profile (solo nome e URL foto)
            await updateProfile(user, { displayName: formData.name, photoURL });

            // 3. Aggiorna Firestore User Document con tutti i dati
            const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
            await updateDoc(userRef, { 
                name: formData.name, 
                photoUrl: photoURL,
                birthdate: formData.birthdate,
                nationality: formData.nationality,
                residence: formData.residence,
                description: formData.description,
                updatedAt: serverTimestamp() // Usa la funzione importata
            });
            
            // Aggiorna la pagina per riflettere i cambiamenti globali
            window.location.reload();
        } catch (error) {
            console.error("Errore aggiornamento profilo:", error);
            alert("Errore: " + error.message);
        } finally {
            setLoading(false);
        }
    };
    
    // Calcola l'età in base alla data di nascita
    const calculateAge = (birthdate) => {
        if (!birthdate) return null;
        const diffMs = Date.now() - new Date(birthdate).getTime();
        const ageDt = new Date(diffMs); 
        return Math.abs(ageDt.getUTCFullYear() - 1970);
    };

    return (
        <Modal onClose={onClose} size="lg">
            <h2 className="text-2xl font-serif font-bold text-brand-dark mb-6">Modifica Profilo</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Sezione Foto & Nome */}
                <div className="flex flex-col md:flex-row items-center gap-6 pb-4 border-b border-gray-100">
                    <div className="flex flex-col items-center gap-2 shrink-0">
                        <div className="relative w-24 h-24">
                            <div className="w-full h-full rounded-full overflow-hidden border-4 border-brand-light shadow-lg bg-brand-dark flex items-center justify-center">
                                {previewUrl ? (
                                    <img src={previewUrl} alt="Anteprima" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-3xl text-white font-bold">{formData.name.charAt(0).toUpperCase()}</span>
                                )}
                            </div>
                            <label className="absolute bottom-0 right-0 bg-brand-action text-white p-2 rounded-full cursor-pointer shadow hover:bg-red-700 transition">
                                <Camera className="w-4 h-4" />
                                <input type="file" className="hidden" onChange={handleFileChange} accept="image/*" />
                            </label>
                        </div>
                    </div>
                    <div className="flex-1 w-full space-y-3">
                        <div>
                            <label className="block text-sm font-bold text-brand-dark mb-1">Nome Utente</label>
                            <div className="relative">
                                <User className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                                <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full pl-10 p-3 border border-gray-300 rounded-lg" placeholder="Il tuo nome" required/>
                            </div>
                        </div>
                        <div className="text-sm text-gray-500 italic">L'email (e l'ID utente) non è modificabile.</div>
                    </div>
                </div>

                <h3 className="text-lg font-serif font-bold text-brand-dark mt-4">Dettagli di Viaggio</h3>

                {/* Dati personali */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Data di Nascita */}
                    <div>
                        <label className="block text-sm font-bold text-brand-dark mb-1 flex items-center gap-2"><Calendar className="w-4 h-4"/> Data di Nascita</label>
                        <input type="date" name="birthdate" value={formData.birthdate} onChange={handleChange} className="w-full p-3 border rounded-lg" />
                        {formData.birthdate && <p className="text-xs text-brand-secondary mt-1">Età stimata: {calculateAge(formData.birthdate)} anni</p>}
                    </div>
                    
                    {/* Nazionalità */}
                    <div>
                        <label className="block text-sm font-bold text-brand-dark mb-1 flex items-center gap-2"><Globe className="w-4 h-4"/> Nazionalità</label>
                        <input type="text" name="nationality" value={formData.nationality} onChange={handleChange} className="w-full p-3 border rounded-lg" placeholder="Es. Italiana" />
                    </div>

                    {/* Residenza */}
                    <div>
                        <label className="block text-sm font-bold text-brand-dark mb-1 flex items-center gap-2"><MapPin className="w-4 h-4"/> Luogo di Residenza</label>
                        <input type="text" name="residence" value={formData.residence} onChange={handleChange} className="w-full p-3 border rounded-lg" placeholder="Es. Milano, Italia" />
                    </div>

                </div>

                {/* Descrizione */}
                <div>
                    <label className="block text-sm font-bold text-brand-dark mb-1 flex items-center gap-2"><ScrollText className="w-4 h-4"/> Descrizione/Bio</label>
                    <textarea name="description" value={formData.description} onChange={handleChange} className="w-full p-3 border rounded-lg" rows="3" placeholder="Parlaci dei tuoi tipi di viaggio preferiti..."></textarea>
                </div>

                <button 
                    type="submit" 
                    disabled={loading} 
                    className="w-full bg-brand-dark text-white py-3 rounded-lg font-bold hover:bg-gray-800 transition flex items-center justify-center gap-2"
                >
                    {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                    Salva Modifiche
                </button>
            </form>
        </Modal>
    );
};

export default EditProfileModal;