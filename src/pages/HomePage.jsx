import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Globe, Briefcase, Users, Shield, Plus, Check, RotateCcw, Copy, UserPlus, Edit2, Eye, EyeOff, Trash2, Send, Star, ImagePlus, UserX, FileWarning, Loader2, Mail, X } from 'lucide-react'; 
import { collection, query, where, onSnapshot, addDoc, deleteDoc, updateDoc, doc, serverTimestamp, writeBatch, getDocs, setDoc, arrayUnion, arrayRemove, limit } from 'firebase/firestore'; // Importato 'limit'
import { sortTripsByDate } from '../utils/dateUtils';
import { appId } from '../lib/firebase';

// Importazioni dei componenti
import Header from '../components/Header';
import TripCard from '../components/TripCard';
import CompanyManager from '../components/CompanyManager'; 
import AdminPanel from '../components/AdminPanel';
import TripForm from '../components/TripForm';
import ProgrammaPreviewModal from '../components/ProgrammaPreviewModal';
import Modal from '../components/Modal'; 

// Componente Inbox/Inviti (integrato qui per semplicità di file)
const InboxComponent = ({ db, user, handleRequestAction }) => { 
  const [invites, setInvites] = useState([]); 
  const [friendRequests, setFriendRequests] = useState([]); 
  
  // Listener Inviti Viaggio
  useEffect(() => onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'invitations'), where('toUserId', '==', user.uid), where('status', '==', 'pending')), s => setInvites(s.docs.map(d => ({ id: d.id, ...d.data() })))), [db, user.uid]); 

  // Listener Richieste d'Amicizia (Status: pending)
  useEffect(() => onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'friend_requests'), where('receiverId', '==', user.uid), where('status', '==', 'pending')), s => setFriendRequests(s.docs.map(d => ({ id: d.id, ...d.data() })))), [db, user.uid]); 
  
  const handleTravelInviteResponse = async (invite, accept) => { 
      try { 
          const batch = writeBatch(db); 
          batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'invitations', invite.id), { status: accept ? 'accepted' : 'declined' }); 
          if (accept) { 
              const projectRef = doc(db, 'artifacts', appId, 'public', 'data', 'projects', invite.projectId); 
              batch.update(projectRef, { memberIds: arrayUnion(user.uid) }); 
              const participantRef = doc(db, 'artifacts', appId, 'public', 'data', 'projects', invite.projectId, 'participants', user.uid); 
              batch.set(participantRef, { name: user.email.split('@')[0] }, {merge: true}); 
          } await batch.commit(); 
      } catch (e) { console.error(e); } 
  }; 

  if (invites.length === 0 && friendRequests.length === 0) return null; 
  
  return (
    <div className="mb-8 bg-white border-2 border-brand-accent/30 p-4 rounded-xl shadow-lg animate-slide-in">
        <h3 className="text-lg font-serif font-bold text-brand-dark mb-3 flex items-center gap-2">
            <Mail className="w-5 h-5 text-brand-action" /> Inbox ({invites.length + friendRequests.length})
        </h3>
        <div className="space-y-3">
            
            {/* Richieste di amicizia */}
            {friendRequests.map(req => (
                 <div key={req.id} className="flex flex-col md:flex-row justify-between items-center bg-yellow-50 p-3 rounded-lg gap-3">
                    <div>
                        <p className="text-brand-dark"><span className="font-bold">{req.senderName}</span> ti ha inviato una richiesta di amicizia.</p>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <button onClick={() => handleRequestAction(req, true)} className="flex-1 md:flex-none bg-green-600 text-white px-4 py-1.5 rounded font-bold hover:bg-green-700 flex justify-center items-center gap-1"><Check className="w-4 h-4"/> Accetta</button>
                        <button onClick={() => handleRequestAction(req, false)} className="flex-1 md:flex-none bg-gray-300 text-gray-700 px-4 py-1.5 rounded font-bold hover:bg-gray-400 flex justify-center items-center gap-1"><X className="w-4 h-4"/> Rifiuta</button>
                    </div>
                 </div>
            ))}

            {/* Inviti a Viaggi */}
            {invites.map(inv => (
                <div key={inv.id} className="flex flex-col md:flex-row justify-between items-center bg-brand-light p-3 rounded-lg gap-3">
                    <div>
                        <p className="text-brand-dark"><span className="font-bold">{inv.fromUserName}</span> ti invita a <span className="font-bold text-brand-action">{inv.projectName}</span></p>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <button onClick={() => handleTravelInviteResponse(inv, true)} className="flex-1 md:flex-none bg-green-600 text-white px-4 py-1.5 rounded font-bold hover:bg-green-700 flex justify-center items-center gap-1"><Check className="w-4 h-4"/> Accetta</button>
                        <button onClick={() => handleTravelInviteResponse(inv, false)} className="flex-1 md:flex-none bg-gray-300 text-gray-700 px-4 py-1.5 rounded font-bold hover:bg-gray-400 flex justify-center items-center gap-1"><X className="w-4 h-4"/> Rifiuta</button>
                    </div>
                </div>
            ))}
            
        </div>
    </div>
  ); 
};


const HomePage = ({ db, storage, user, userProfile, onSelectProject, onSelectUser, isAdmin, requestStatus }) => { 
  const [view, setView] = useState('explore'); 
  const [myProjects, setMyProjects] = useState([]); 
  const [publishedTrips, setPublishedTrips] = useState([]); 
  const [myJoinRequests, setMyJoinRequests] = useState([]); 
  const [subscribing, setSubscribing] = useState(false); 
  const [showModal, setShowModal] = useState(false); 
  const [editingTrip, setEditingTrip] = useState(null); 
  const [isPrivateModal, setIsPrivateModal] = useState(false); 
  const [previewTrip, setPreviewTrip] = useState(null);
  
  // Listener per i progetti
  useEffect(() => onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'projects'), where('memberIds', 'array-contains', user.uid)), s => setMyProjects(s.docs.map(d=>({id:d.id, ...d.data()})))), [db, user.uid]);
  // Listener per i viaggi pubblici
  useEffect(() => onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'published_trips')), s => setPublishedTrips(s.docs.map(d=>({id:d.id, ...d.data()})))), [db]);
  // Listener per le richieste di iscrizione
  useEffect(() => onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'join_requests'), where('userId', '==', user.uid)), s => setMyJoinRequests(s.docs.map(d=>({id:d.id, ...d.data()})))), [db, user.uid]);
  
  // --- AZIONI AMICIZIA (Necessarie qui per la Inbox) ---

  const handleRequestAction = useCallback(async (request, accept) => {
    const batch = writeBatch(db);
    const requestRef = doc(db, 'artifacts', appId, 'public', 'data', 'friend_requests', request.id);
    
    // 1. Aggiorna lo stato della richiesta
    batch.update(requestRef, { status: accept ? 'accepted' : 'rejected' });
    
    if (accept) {
        // 2. Aggiorna il profilo del mittente (aggiungi me)
        const senderRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', request.senderId);
        batch.update(senderRef, { friendIds: arrayUnion(user.uid) });

        // 3. Aggiorna il mio profilo (aggiungi il mittente)
        const receiverRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
        batch.update(receiverRef, { friendIds: arrayUnion(request.senderId) });
    }

    try {
        await batch.commit();
    } catch (error) {
        console.error("Errore nell'azione richiesta (Amicizia):", error);
    }
  }, [db, user.uid]);


  // --- AZIONE ISCRIVITI (Aggiornata per la condivisione) ---

  const handleSubscribe = async (trip) => { 
    setSubscribing(true); 
    try { 
        // 1. CERCA UN PROGETTO ESISTENTE (VERSIONE CONDIVISA) basato su questo viaggio pubblico
        const existingProjectQuery = query(
            collection(db, 'artifacts', appId, 'public', 'data', 'projects'), 
            where('basedOn', '==', trip.id),
            limit(1)
        );
        const existingProjectsSnapshot = await getDocs(existingProjectQuery);

        let projectRef;
        const batch = writeBatch(db);

        if (!existingProjectsSnapshot.empty) {
            // A. PROGETTO ESISTENTE TROVATO (Versione Condivisa): Aggiungi l'utente
            const existingProjectDoc = existingProjectsSnapshot.docs[0];
            projectRef = doc(db, 'artifacts', appId, 'public', 'data', 'projects', existingProjectDoc.id);

            // 1. Aggiungi l'utente a memberIds nel documento Project
            batch.update(projectRef, { memberIds: arrayUnion(user.uid) });
            
            // 2. Aggiungi l'utente alla sottocollezione 'participants'
            const participantRef = doc(collection(projectRef, 'participants'), user.uid); 
            batch.set(participantRef, { name: userProfile.name }, {merge: true}); 
            
            alert(`Aggiunto all'evento condiviso: ${trip.name}`);
            
        } else {
            // B. NUOVO PROGETTO: Crea la versione condivisa (primo utente che si iscrive)
            projectRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'projects')); // Riferimento con ID generato
            
            const newProjectData = { 
                name: trip.name, 
                description: trip.description, 
                createdBy: user.uid, // Il primo ad iscriversi è il "creatore" di questa istanza condivisa
                createdAt: serverTimestamp(), 
                memberIds: [user.uid], // Inizializza con l'utente corrente
                basedOn: trip.id, 
                location: trip.location || '', 
                dateStart: trip.dateStart || '', 
                dateEnd: trip.dateEnd || '', 
                price: trip.price || 0, 
                maxPeople: trip.maxPeople || 0, 
                imageUrl: trip.imageUrl || '', 
                status: 'private', // Mantengo lo status 'private' come nel tuo codice originale
                creatorName: userProfile.name, // Uso il nome del primo iscritto
                organizers: trip.organizers || [], 
                joinType: trip.joinType || 'open', 
                joinDeadline: trip.joinDeadline || '', 
                ratingTotal: trip.ratingTotal || 0, 
                ratingCount: trip.ratingCount || 0, 
                permissions: trip.permissions || { details: { visible: true, interact: true }, todo: { visible: true, interact: true }, memories: { visible: true, interact: true } } 
            };
            
            batch.set(projectRef, newProjectData); // Salva il nuovo progetto

            // 1. Aggiunge l'utente alla sottocollezione 'participants'
            const participantRef = doc(collection(projectRef, 'participants'), user.uid); 
            batch.set(participantRef, { name: userProfile.name }); 

            // 2. Copia le escursioni dalla versione pubblica a quella condivisa
            const exSnapshot = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'published_trips', trip.id, 'excursions')); 
            exSnapshot.forEach(docSnap => { 
                batch.set(doc(collection(projectRef, 'excursions')), docSnap.data()); 
            }); 
            
            alert(`Creata nuova istanza condivisa di: ${trip.name}`);
        }
        
        await batch.commit(); 
        setView('mine'); 

    } catch (err) { 
        console.error("Errore durante la sottoscrizione/adesione:", err);
        alert(err.message); 
    } finally { 
        setSubscribing(false); 
    } 
  };
  
  // --- VECCHIE AZIONI VIAGGIO (Rimaste invariate) ---
  // ... (handleRequestToJoin, handleWithdrawRequest, handleProposeTrip, handleDeleteProject, handleToggleVisibility, handleDeletePublished, handleRequestAdmin, handleRequestUnpublish)

  const handleRequestToJoin = async (trip) => { setSubscribing(true); try { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'join_requests'), { userId: user.uid, userName: userProfile.name, tripId: trip.id, tripName: trip.name, requestType: 'public', status: 'pending', createdAt: serverTimestamp() }); } catch(err) { alert(err.message); } finally { setSubscribing(false); } };
  const handleWithdrawRequest = async (reqId) => { if(!confirm("Annullare?")) return; try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'join_requests', reqId)); } catch(e) { alert(e.message); } };
  const handleProposeTrip = async (pid) => { if(confirm("Proporre?")) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', pid), { status: 'pending_review' }); };
  const handleDeleteProject = async (project) => { if(confirm("Rimuovere?")) { try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', project.id)); if (project.basedOn) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'published_trips', project.basedOn), { memberIds: arrayRemove(user.uid) }).catch(e=>console.log(e)); } catch(e) { console.error(e); } } };
  const handleToggleVisibility = async (trip) => { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'published_trips', trip.id), { hidden: !trip.hidden }); };
  const handleDeletePublished = async (tid) => { if(confirm("Eliminare?")) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'published_trips', tid)); };
  const handleRequestAdmin = async () => { if(confirm("Richiedere Admin?")) { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'admin_requests'), { userId: user.uid, userName: userProfile.name, email: user.email, status: 'pending', createdAt: serverTimestamp() }); alert("Richiesta inviata!"); } };
  const handleRequestUnpublish = async (p) => { if(confirm("Richiedere rimozione pubblicazione?")) { try { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'admin_requests'), { type: 'unpublish', projectId: p.id, publicId: p.publishedId || null, tripName: p.name, userName: userProfile.name, status: 'pending', createdAt: serverTimestamp() }); alert("Richiesta inviata con successo agli admin."); } catch (err) { console.error(err); alert("Errore: " + err.message); } } };

  const visibleTrips = useMemo(() => sortTripsByDate(publishedTrips.filter(t => isAdmin || !t.hidden)), [publishedTrips, isAdmin]);
  const sortedMyProjects = useMemo(() => sortTripsByDate(myProjects), [myProjects]);
  
  return (
    <div className="min-h-screen">
        <Header isAdmin={isAdmin} requestStatus={requestStatus} onRequestAdmin={handleRequestAdmin} />
        <div className="max-w-7xl mx-auto p-4 md:p-6">
            
            {/* INBOX AGGIORNATA (include richieste amicizia) */}
            {/* L'azione 'handleRequestAction' viene passata qui da HomePage.jsx */}
            <InboxComponent db={db} user={user} handleRequestAction={handleRequestAction} /> 
            
            <div className="flex border-b border-gray-300 mb-6 overflow-x-auto">
                <button onClick={()=>setView('explore')} className={`py-3 px-6 font-bold flex items-center gap-2 whitespace-nowrap ${view==='explore' ? 'border-b-4 border-brand-action text-brand-dark' : 'text-brand-secondary'}`}><Globe className="w-4 h-4"/> Esplora</button>
                <button onClick={()=>setView('mine')} className={`py-3 px-6 font-bold flex items-center gap-2 whitespace-nowrap ${view==='mine' ? 'border-b-4 border-brand-action text-brand-dark' : 'text-brand-secondary'}`}><Briefcase className="w-4 h-4"/> Miei Eventi</button>
                <button onClick={()=>setView('company')} className={`py-3 px-6 font-bold flex items-center gap-2 whitespace-nowrap ${view==='company' ? 'border-b-4 border-brand-action text-brand-dark' : 'text-brand-secondary'}`}><Users className="w-4 h-4"/> Amici & Compagnie</button>
                {isAdmin && <button onClick={()=>setView('admin')} className={`py-3 px-6 font-bold flex items-center gap-2 whitespace-nowrap ${view==='admin' ? 'border-b-4 border-brand-action text-brand-dark' : 'text-brand-secondary'}`}><Shield className="w-4 h-4"/> Admin</button>}
            </div>

            {view === 'explore' && (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{visibleTrips.map(trip => { 
                const joinType = trip.joinType || 'open'; const linkedProject = myProjects.find(p => p.basedOn === trip.id || p.publishedId === trip.id); const existingRequest = myJoinRequests.find(r => r.tripId === trip.id && r.status === 'pending'); 
                let actionLabel, actionIcon, actionColor, actionDisabled, actionOnClick, isWithdraw = false; 
                if (linkedProject) { actionLabel = "Iscritto"; actionIcon = <Check className="w-4 h-4"/>; actionColor = "bg-green-600"; actionOnClick = () => onSelectProject(linkedProject, 'projects'); } 
                else if (existingRequest) { actionLabel = "Annulla"; actionIcon = <RotateCcw className="w-4 h-4"/>; actionColor = "bg-red-500/80 hover:bg-red-600"; isWithdraw = true; actionOnClick = () => handleWithdrawRequest(existingRequest.id); } 
                else if (joinType === 'open') { actionLabel = "Iscriviti"; actionIcon = <Copy className="w-4 h-4"/>; actionColor = "bg-brand-action"; actionOnClick = () => handleSubscribe(trip); } 
                else { actionLabel = "Richiedi"; actionIcon = <UserPlus className="w-4 h-4"/>; actionColor = "bg-brand-accent text-brand-dark"; actionOnClick = () => handleRequestToJoin(trip); } 
                return (<TripCard key={trip.id} trip={trip} isPublic={true} isAdmin={isAdmin} isCreator={false} onSecondaryAction={() => { if (linkedProject) onSelectProject(linkedProject, 'projects'); else onSelectProject(trip, 'published_trips'); }} actionLoading={subscribing} onAction={{ label: actionLabel, icon: actionIcon, color: actionColor, disabled: actionDisabled, onClick: actionOnClick, isWithdraw, tools: [{ icon: <Edit2 className="w-4 h-4"/>, onClick: () => { setEditingTrip(trip); setIsPrivateModal(false); setShowModal(true); }, title: "Modifica" }, { icon: trip.hidden ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4"/>, onClick: () => handleToggleVisibility(trip), title: "Visibilità" }, { icon: <Trash2 className="w-4 h-4"/>, onClick: () => handleDeletePublished(trip.id), title: "Elimina" }] }} />); })}</div>)}

            {view === 'mine' && (<div><div className="flex justify-end mb-4"><button onClick={() => { setEditingTrip(null); setIsPrivateModal(true); setShowModal(true); }} className="bg-brand-action text-white py-2 px-4 rounded-lg font-semibold hover:bg-opacity-90 flex items-center gap-2"><Plus className="w-5 h-5"/> Crea Evento Privato</button></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{sortedMyProjects.map(p => { const isCreator = p.createdBy === user.uid; const status = p.status || 'private'; const isSubscribed = !!p.basedOn; const isPast = p.dateEnd && p.dateEnd < new Date().toISOString().split('T')[0]; let actionLabel, actionIcon, actionColor, actionDisabled = false; let actionOnClick = () => {}; const canEdit = !p.basedOn || isAdmin; if (isSubscribed) { if (isPast) { actionLabel = "Ricordi"; actionIcon = <ImagePlus className="w-4 h-4"/>; actionColor = "bg-brand-secondary"; actionOnClick = () => onSelectProject(p, 'projects'); } else { actionLabel = "Esci"; actionIcon = <UserX className="w-4 h-4"/>; actionColor = "bg-red-600 hover:bg-red-700"; actionOnClick = () => handleDeleteProject(p); } } else { if (isPast) { actionLabel = "Ricordi"; actionIcon = <ImagePlus className="w-4 h-4"/>; actionColor = "bg-brand-secondary"; actionOnClick = () => onSelectProject(p, 'projects'); } else { switch (status) { case 'pending_review': actionLabel = "In Attesa"; actionIcon = <Send className="w-4 h-4"/>; actionColor = "bg-gray-400"; actionDisabled = true; break; case 'approved': actionLabel = "Pubblicato"; actionIcon = <Check className="w-4 h-4"/>; actionColor = "bg-green-600"; actionDisabled = true; break; case 'rejected': actionLabel = "Riproponi"; actionIcon = <Star className="w-4 h-4"/>; actionColor = "bg-brand-accent text-brand-dark"; actionOnClick = () => handleProposeTrip(p.id); break; default: actionLabel = "Proponi"; actionIcon = <Star className="w-4 h-4"/>; actionColor = "bg-brand-accent text-brand-dark"; actionOnClick = () => handleProposeTrip(p.id); } } } const tools = [{ icon: <Trash2 className="w-4 h-4"/>, onClick: () => handleDeleteProject(p), title: "Elimina" }]; if (canEdit) tools.unshift({ icon: <Edit2 className="w-4 h-4"/>, onClick: () => { setEditingTrip(p); setIsPrivateModal(true); setShowModal(true); }, title: "Modifica" }); if(p.status === 'approved') tools.push({ icon: <FileWarning className="w-4 h-4 text-red-500"/>, title: "Richiedi Rimozione", onClick: () => handleRequestUnpublish(p) }); return (<TripCard key={p.id} trip={p} isPublic={false} isAdmin={false} isCreator={isCreator} onSecondaryAction={() => onSelectProject(p, 'projects')} onAction={{ label: actionLabel, icon: actionIcon, color: actionColor, disabled: actionDisabled, onClick: actionOnClick, tools: tools }} />); })}</div></div>)}

            {/* NUOVA VISTA AMICI & COMPAGNIE */}
            {view === 'company' && (<CompanyManager db={db} user={user} userProfile={userProfile} onSelectUser={onSelectUser} />)}

            {view === 'admin' && isAdmin && (<AdminPanel db={db} storage={storage} user={user} userProfile={userProfile} onSelectProject={onSelectProject} onPreview={setPreviewTrip} />)}
        </div>
        
        {showModal && (<TripForm db={db} storage={storage} user={user} userProfile={userProfile} isPrivate={isPrivateModal} initialData={editingTrip} onClose={() => { setShowModal(false); setEditingTrip(null); }} />)}
        {previewTrip && (<ProgrammaPreviewModal trip={previewTrip} db={db} onClose={() => setPreviewTrip(null)} />)}
    </div>
  );
};
export default HomePage;