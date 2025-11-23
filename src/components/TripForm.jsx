import React, { useState } from 'react';
import { Loader2, Shield } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, updateDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import Modal from './Modal.jsx';
import DateTimeInput from './DateTimeInput.jsx';
import { appId } from '../lib/firebase.js';

const TripForm = ({ db, storage, user, userProfile, onClose, initialData, isPrivate }) => {
  const [formData, setFormData] = useState(() => { 
      const defPerms = { details: { visible: true, interact: true }, todo: { visible: true, interact: true }, memories: { visible: true, interact: true } }; 
      if (initialData) return { ...initialData, permissions: initialData.permissions || defPerms }; 
      return { name: '', description: '', location: '', dateStart: '', dateEnd: '', price: '', maxPeople: '', imageUrl: '', hidden: false, joinType: 'open', joinDeadline: '', permissions: defPerms }; 
  });
  const [imageFile, setImageFile] = useState(null); 
  const [loading, setLoading] = useState(false); 
  const isEditing = !!initialData;

  const handleSubmit = async (e) => { 
      e.preventDefault(); 
      setLoading(true); 
      try { 
          let finalImageUrl = formData.imageUrl; 
          if (imageFile) { 
              const storageRef = ref(storage, `trip_covers/${Date.now()}_${imageFile.name}`); 
              await uploadBytes(storageRef, imageFile); 
              finalImageUrl = await getDownloadURL(storageRef); 
          } 
          const dataToSave = { ...formData, imageUrl: finalImageUrl, price: Number(formData.price) || 0, maxPeople: Number(formData.maxPeople) || 0, dateEnd: formData.dateEnd || '', updatedAt: serverTimestamp(), ratingTotal: initialData?.ratingTotal || 0, ratingCount: initialData?.ratingCount || 0 }; 
          
          if (isPrivate) { 
              const collectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'projects'); 
              if (isEditing) await updateDoc(doc(collectionRef, initialData.id), dataToSave); 
              else { 
                  const newTripRef = await addDoc(collectionRef, { ...dataToSave, organizers: [userProfile.name], createdAt: serverTimestamp(), createdBy: user.uid, creatorName: userProfile.name, memberIds: [user.uid], status: 'private' }); 
                  await setDoc(doc(collection(newTripRef, 'participants'), user.uid), { name: userProfile.name }); 
              } 
          } else { 
              const collectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'published_trips'); 
              if (isEditing) await updateDoc(doc(collectionRef, initialData.id), dataToSave); 
              else { 
                  await addDoc(collectionRef, { ...dataToSave, organizers: ['Goodfellas Getaways'], createdAt: serverTimestamp(), createdBy: user.uid, creatorName: userProfile.name, ratingTotal: 0, ratingCount: 0 }); 
              } 
          } 
      } catch (err) { 
          console.error(err); 
          alert(err.message); 
      } finally { 
          setLoading(false); 
          onClose(); 
      } 
  };

  const handleChange = (e) => setFormData({...formData, [e.target.name]: e.target.value});
  const handlePermissionChange = (sec, type) => { setFormData(prev => { const newP = { ...prev.permissions }; if(!newP[sec]) newP[sec] = { visible: true, interact: true }; newP[sec] = { ...newP[sec], [type]: !newP[sec][type] }; return { ...prev, permissions: newP }; }); };

  return ( 
    <Modal onClose={onClose}>
        <h3 className="text-2xl font-serif font-bold text-brand-dark mb-4">{isEditing ? "Modifica" : "Nuovo Evento"}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
            <input name="name" value={formData.name} onChange={handleChange} className="w-full p-2 border rounded" placeholder="Nome Evento" required />
            <input name="location" value={formData.location} onChange={handleChange} className="w-full p-2 border rounded" placeholder="Location" required />
            <div className="flex gap-2">
                <div className="w-1/2"><DateTimeInput label="Inizio" valueIso={formData.dateStart} onChange={v=>setFormData({...formData, dateStart: v})} required /></div>
                <div className="w-1/2"><DateTimeInput label="Fine" valueIso={formData.dateEnd} onChange={v=>setFormData({...formData, dateEnd: v})} /></div>
            </div>
            <div className="w-full"><DateTimeInput label="Deadline Iscrizione" valueIso={formData.joinDeadline} onChange={v=>setFormData({...formData, joinDeadline: v})} /></div>
            <div className="flex gap-2">
                <input type="number" name="price" value={formData.price} onChange={handleChange} className="w-1/2 p-2 border rounded" placeholder="Budget (€)" />
                <input type="number" name="maxPeople" value={formData.maxPeople} onChange={handleChange} className="w-1/2 p-2 border rounded" placeholder="Max Persone" />
            </div>
            <div className="space-y-2">
                <input name="imageUrl" value={formData.imageUrl} onChange={handleChange} className="w-full p-2 border rounded" placeholder="URL Immagine (opzionale o incolla link)" />
                <div className="border-2 border-dashed p-4 text-center rounded bg-gray-50">
                    <label className="cursor-pointer text-brand-action font-bold hover:underline">{imageFile ? "Cambia Copertina" : "Carica Copertina dal dispositivo"}<input type="file" className="hidden" onChange={e=>setImageFile(e.target.files[0])} accept="image/*" /></label>
                    {imageFile && <div className="text-xs mt-1 font-medium text-brand-dark">{imageFile.name}</div>}
                </div>
            </div>
            <textarea name="description" value={formData.description} onChange={handleChange} className="w-full p-2 border rounded" placeholder="Descrizione..." rows="3"></textarea>
            <div>
                <label className="block text-sm font-medium text-brand-dark">Tipo Iscrizione</label>
                <select name="joinType" value={formData.joinType || 'open'} onChange={handleChange} className="w-full p-2 border rounded mt-1">
                    <option value="open">Aperta</option>
                    <option value="closed">Su Richiesta</option>
                </select>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <h4 className="font-bold text-sm text-brand-dark mb-2 flex items-center gap-2"><Shield className="w-4 h-4"/> Permessi Partecipanti</h4>
                <div className="space-y-2 text-sm">
                    {['details','todo','memories'].map(sec=>(
                        <div key={sec} className="flex items-center justify-between">
                            <span className="capitalize">{sec}</span>
                            <div className="flex gap-3">
                                <label className="flex items-center gap-1"><input type="checkbox" checked={formData.permissions?.[sec]?.visible} onChange={()=>handlePermissionChange(sec, 'visible')}/> Visibile</label>
                                <label className="flex items-center gap-1"><input type="checkbox" checked={formData.permissions?.[sec]?.interact} onChange={()=>handlePermissionChange(sec, 'interact')}/> Interagisci</label>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <button type="submit" disabled={loading} className="w-full bg-brand-dark text-white px-4 py-2 rounded font-bold flex justify-center">{loading ? <Loader2 className="animate-spin w-5 h-5" /> : "Salva"}</button>
        </form>
    </Modal> 
  );
};

export default TripForm;