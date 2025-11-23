import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, ListChecks, Wallet, Map, BarChart2, CheckSquare, ImagePlus, UserPlus, Lock, Plus, Moon, Check, X, CalendarDays, Star, Share2, Copy, Banknote, Send, ExternalLink, RotateCcw, Info, Edit2, Users, Eye, EyeOff, Hand, HandIcon, Loader2, MessageSquare } from 'lucide-react'; 
import { doc, collection, onSnapshot, query, where, setDoc, addDoc, deleteDoc, updateDoc, writeBatch, increment, serverTimestamp, arrayUnion, orderBy, limit } from 'firebase/firestore';
import { getCoordinates, calculateHaversineDistance } from '../utils/geoUtils';
import { appId } from '../lib/firebase';
import { formatDateRange, getSimpleTime } from '../utils/dateUtils';

// Importazioni dei componenti locali
import ProgramItem from '../components/ProgramItem';
import AccommodationCard from '../components/AccommodationCard';
import RentalCard from '../components/RentalCard';
import BudgetView from '../components/BudgetView';
import TodoList from '../components/TodoList';
import MemoriesView from '../components/MemoriesView';
import AddExcursionForm from '../components/AddExcursionForm';
import InviteModal from '../components/InviteModal';
import ReviewModal from '../components/ReviewModal';
import Loader from '../components/Loader';
import ProjectChat from '../components/ProjectChat'; 

const groupExcursionsByDay = (excursions) => excursions.reduce((acc, ex) => { const day = ex.dateStart ? ex.dateStart.split('T')[0] : 'Indefinito'; if (!acc[day]) acc[day] = []; acc[day].push(ex); return acc; }, {});

const ProjectView = ({ project, onBack, user, userProfile, db, storage, collectionType = 'projects', onJoinRequest, isAdmin, myFriends, myCompanies }) => {
  const [view, setView] = useState('info'); 
  const [excursions, setExcursions] = useState([]); 
  const [votes, setVotes] = useState([]); 
  const [participants, setParticipants] = useState([]); 
  const [editingEx, setEditingEx] = useState(null); 
  const [showAdd, setShowAdd] = useState(false); 
  const [joinRequests, setJoinRequests] = useState([]); 
  const [showInvite, setShowInvite] = useState(false); 
  const [showReviewModal, setShowReviewModal] = useState(false); 
  const [userReview, setUserReview] = useState(null);
  
  const [autoKm, setAutoKm] = useState(0);
  const [isCalculatingKm, setIsCalculatingKm] = useState(false);
  
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  const [imageFile, setImageFile] = useState(null);
  
  // 💡 NUOVO: Stato per la Chat
  const [chatEnabled, setChatEnabled] = useState(project.chatEnabled || false);

  const isPreview = collectionType === 'published_trips'; 
  const projectRef = useMemo(() => doc(db, 'artifacts', appId, 'public', 'data', collectionType, project.id), [db, project.id, collectionType]); 
  const isCreator = !isPreview && project.createdBy === user.uid; 
  const isClosed = project.joinType === 'closed'; 
  const isPurelyPrivate = project.status === 'private' && !project.basedOn; 
  const hasFullAccess = isCreator || (isAdmin && !isPurelyPrivate); 
  const isParticipant = participants.some(p => p.id === user.uid) || hasFullAccess; // Aggiorna per includere hasFullAccess
  const today = new Date().toISOString().split('T')[0]; 
  const isPast = project.dateEnd && project.dateEnd < today;
  const permissions = project.permissions || { details: { visible: true, interact: true }, todo: { visible: true, interact: true }, memories: { visible: true, interact: true } }; 
  const canInteract = (type) => { if (hasFullAccess) return true; if (isPast && type !== 'memories') return false; return permissions[type]?.interact; };
  const isJoinedOpen = project.joinType === 'open';

  // Sincronizza lo stato locale della chat con il prop iniziale (utile dopo un salvataggio)
  useEffect(() => {
    setChatEnabled(project.chatEnabled || false);
  }, [project.chatEnabled]);

  useEffect(() => { if(!isPreview) setDoc(doc(collection(projectRef,'participants'),user.uid),{name:userProfile.name},{merge:true}); }, [isPreview]);
  useEffect(() => { 
      const uE = onSnapshot(collection(projectRef, 'excursions'), s => setExcursions(s.docs.map(d=>({id:d.id, ...d.data()})))); 
      let uV, uP, uJ, uR; 
      
      if (!isPreview) { 
          uV = onSnapshot(collection(projectRef, 'votes'), s => setVotes(s.docs.map(d=>({id:d.id, ...d.data()})))); 
          uP = onSnapshot(collection(projectRef, 'participants'), s => setParticipants(s.docs.map(d=>({id:d.id, ...d.data()})))); 
          uJ = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'join_requests'), where('status', '==', 'pending'), where('requestType', '==', 'private'), where('projectId', '==', project.id)), s => setJoinRequests(s.docs.map(d=>({id:d.id, ...d.data()})))); 
          uR = onSnapshot(query(collection(projectRef, 'reviews'), where('userId', '==', user.uid)), s => { 
              if (!s.empty) setUserReview({ id: s.docs[0].id, ...s.docs[0].data() }); 
              else setUserReview(null); 
          }); 
      } else { 
          uP = onSnapshot(collection(projectRef, 'participants'), s => setParticipants(s.docs.map(d=>({id:d.id, ...d.data()})))); 
      } 
      return () => { uE(); if(uV) uV(); if(uP) uP(); if(uJ) uJ(); if(uR) uR(); }; 
  }, [projectRef, db, project.id, isPreview, user.uid]);
  
  // --- CALCOLO AUTOMATICO KM E SALVATAGGIO ---
  useEffect(() => {
      const calculateRoute = async () => {
          if (excursions.length === 0) { setAutoKm(0); return; }
          setIsCalculatingKm(true);
          
          const sortedEx = [...excursions].sort((a, b) => (a.dateStart || '').localeCompare(b.dateStart || ''));
          let stops = [];

          sortedEx.forEach(e => {
              if(e.type === 'travel' && e.origin && e.origin.trim()) stops.push(e.origin);
              if (e.location && e.location.trim()) stops.push(e.location);
          });
          
          if (stops.length === 0 && project.location) stops.push(project.location);
          stops = stops.filter((loc, i, arr) => i === 0 || loc !== arr[i-1]);

          let totalDistance = 0;
          let prevCoords = null;

          for (const stop of stops) {
              // Modificato per usare la nuova geoUtils che restituisce {coords, country}
              const geoResult = await getCoordinates(stop); 
              const coords = geoResult?.coords;

              if (coords) {
                  if (prevCoords) {
                      totalDistance += calculateHaversineDistance(prevCoords, coords);
                  }
                  prevCoords = coords;
              }
              await new Promise(r => setTimeout(r, 100)); 
          }
          
          const finalKm = Math.round(totalDistance);
          setAutoKm(finalKm);
          setIsCalculatingKm(false);
          
          // Salva i Km totali nel documento del progetto (solo se è un progetto attivo)
          if (!isPreview && hasFullAccess && finalKm !== project.totalKm) {
              await updateDoc(projectRef, { totalKm: finalKm });
          }
      };
      
      const timer = setTimeout(calculateRoute, 1000);
      return () => clearTimeout(timer);
  }, [excursions, project.location, isPreview, hasFullAccess, project.totalKm, projectRef]);

  const handleSaveEx = async (data, files) => { 
      if(isPreview && !hasFullAccess) return; 
      let urls = []; 
      const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      
      if(files.length) {
          urls = await Promise.all(files.map(async f => { 
              const r = ref(storage, `excursions/${project.id}/${Date.now()}_${f.name}`); 
              await uploadBytes(r, f); 
              return getDownloadURL(r); 
          }));
      }

      const finalImages = editingEx ? [...(editingEx.images||[]), ...urls] : urls; 
      const finalData = { ...data, images: finalImages, updatedBy: user.uid }; 
      
      if (editingEx) {
          await updateDoc(doc(collection(projectRef, 'excursions'), editingEx.id), finalData);
      } else {
          // Se è un viaggio, usa la distanza calcolata dall'utente nel form (se fornita)
          if (data.type === 'travel' && data.distance) {
              finalData.distance = Number(data.distance);
          }
          await addDoc(collection(projectRef, 'excursions'), { ...finalData, createdBy: user.uid });
      }
  };

  const handleToggleVote = async (excursionId) => { if (isPreview || isPast) return; if (!hasFullAccess && !permissions.details.interact) { alert("No permessi."); return; } const existingVote = votes.find(v => v.userId === user.uid && v.excursionId === excursionId); if (existingVote) await deleteDoc(doc(collection(projectRef, 'votes'), existingVote.id)); else await addDoc(collection(projectRef, 'votes'), {userId: user.uid, excursionId: excursionId, createdAt: serverTimestamp()}); };
  const handleSaveReview = async (score, comment) => { try { const batch = writeBatch(db); if (userReview) batch.update(doc(projectRef, 'reviews', userReview.id), { rating: score, comment, updatedAt: serverTimestamp() }); else batch.set(doc(collection(projectRef, 'reviews')), { userId: user.uid, userName: userProfile.name, rating: score, comment, createdAt: serverTimestamp() }); const ratingDelta = userReview ? (score - userReview.rating) : score; const countDelta = userReview ? 0 : 1; batch.update(projectRef, { ratingTotal: increment(ratingDelta), ratingCount: increment(countDelta) }); if (project.basedOn) batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'published_trips', project.basedOn), { ratingTotal: increment(ratingDelta), ratingCount: increment(countDelta) }); await batch.commit(); setShowReviewModal(false); alert(userReview ? "Aggiornata!" : "Inviata!"); } catch (e) { alert("Errore: " + e.message); } };
  
  // FUNZIONE: Salva i dettagli modificati del progetto (INCLUSA IMMAGINE E PERMESSI)
  const handleSaveDetails = async (e) => {
    e.preventDefault();
    if (!isCreator && !isAdmin) return;
    setLoadingDetails(true);

    try {
        const formData = new FormData(e.target);
        const newPermissions = {
            details: { 
                visible: formData.get('detailsVisible') === 'true', 
                interact: formData.get('detailsInteract') === 'true' 
            },
            todo: { 
                visible: formData.get('todoVisible') === 'true', 
                interact: formData.get('todoInteract') === 'true' 
            },
            memories: { 
                visible: formData.get('memoriesVisible') === 'true', 
                interact: formData.get('memoriesInteract') === 'true' 
            },
        };

        let imageUrl = project.imageUrl;
        if (imageFile) {
            const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
            const imageRef = ref(storage, `projects/${project.id}/cover/${Date.now()}_${imageFile.name}`);
            await uploadBytes(imageRef, imageFile);
            imageUrl = await getDownloadURL(imageRef);
        }

        // 💡 AGGIUNTA: chatEnabled
        const updatedData = {
            name: formData.get('name') || project.name,
            description: formData.get('description') || project.description,
            dateStart: formData.get('dateStart') || project.dateStart,
            dateEnd: formData.get('dateEnd') || project.dateEnd,
            location: formData.get('location') || project.location,
            price: Number(formData.get('price')) || 0,
            maxPeople: Number(formData.get('maxPeople')) || 0,
            joinType: formData.get('joinType') || project.joinType,
            imageUrl: imageUrl, 
            permissions: newPermissions, 
            chatEnabled: formData.get('chatEnabled') === 'true', // 👈 CAMPO CHAT
            updatedAt: serverTimestamp(),
            updatedBy: user.uid
        };

        await updateDoc(projectRef, updatedData);
        
        // Aggiorna lo stato locale dopo il salvataggio
        setChatEnabled(updatedData.chatEnabled);
        setIsEditingDetails(false); 
        setImageFile(null);
        alert("Dettagli aggiornati con successo.");
        
    } catch (error) {
        console.error("Errore nel salvataggio dei dettagli:", error);
        alert("Errore nell'aggiornamento dei dettagli: " + error.message);
    } finally {
        setLoadingDetails(false);
    }
  };
  
  const myVotes = votes.filter(v => v.userId === user.uid).map(v => v.excursionId); 
  const grouped = groupExcursionsByDay(excursions); 
  const sortedDays = Object.keys(grouped).sort(); 
  const totalCost = excursions.reduce((acc, ex) => { const isIncluded = ex.isVotable === false || myVotes.includes(ex.id); return isIncluded ? acc + (Number(ex.cost) || 0) : acc; }, 0);
  const ranked = excursions.map(ex => ({...ex, count: votes.filter(v=>v.excursionId===ex.id).length})).filter(e=>e.count>0).sort((a,b)=>b.count-a.count);
  
  const mapEmbedUrl = useMemo(() => {
    const sortedEx = [...excursions].sort((a, b) => (a.dateStart || '').localeCompare(b.dateStart || ''));
    let stops = [];
    sortedEx.forEach(e => { if(e.type === 'travel' && e.origin && e.origin.trim()) stops.push(e.origin); if (e.location && e.location.trim()) stops.push(e.location); });
    if (stops.length === 0 && project.location) stops.push(project.location);
    stops = stops.filter((loc, i, arr) => i === 0 || loc !== arr[i-1]);
    if (stops.length === 0) return '';
    const baseUrl = "https://maps.google.com/maps?";
    if (stops.length === 1) return `${baseUrl}q=${encodeURIComponent(stops[0])}&t=m&z=10&output=embed`;
    const origin = encodeURIComponent(stops[0]);
    const rest = stops.slice(1).map(s => encodeURIComponent(s)).join('+to:');
    return `${baseUrl}saddr=${origin}&daddr=${rest}&output=embed`;
  }, [project.location, excursions]);

  const stats = useMemo(() => {
      // Calcola la distanza totale basandosi su 'distance' delle attività 'travel', con fallback su autoKm
      let travelKm = excursions
          .filter(e => e.type === 'travel' && e.distance)
          .reduce((sum, e) => sum + (Number(e.distance) || 0), 0);
          
      // Se l'utente non ha usato il campo distance, usa l'autoKm calcolato
      const finalKm = travelKm > 0 ? travelKm : autoKm;
      
      const places = new Set();
      if(project.location) places.add(project.location);
      excursions.forEach(e => { if(e.location) places.add(e.location); if(e.origin) places.add(e.origin); });
      return { 
          km: finalKm, 
          isLoadingKm: isCalculatingKm, 
          places: places.size, 
          people: participants.length 
      };
  }, [excursions, project.location, participants, autoKm, isCalculatingKm]);
  
  const getNightStay = (dateStr) => { const d = new Date(dateStr); d.setHours(23, 59, 59, 0); return excursions.find(e => { if (e.type !== 'accommodation') return false; const s = new Date(e.dateStart); s.setHours(0,0,0,0); const end = e.dateEnd ? new Date(e.dateEnd) : null; if (end) end.setHours(0,0,0,0); return s.getTime() <= d.getTime() && (!end || end.getTime() > d.getTime()); }); };
  const getCheckOuts = (dateStr) => excursions.filter(e => e.type === 'accommodation' && e.dateEnd && new Date(e.dateEnd).toISOString().split('T')[0] === dateStr);
  const getRentalDropoffs = (dateStr) => excursions.filter(e => e.type === 'rental' && e.dateEnd && new Date(e.dateEnd).toISOString().split('T')[0] === dateStr);
  const handleApprovePrivateJoin = async (req) => { try { await updateDoc(projectRef, { memberIds: arrayUnion(req.userId) }); await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'join_requests', req.id), { status: 'approved' }); } catch (e) { alert(e.message); } };
  const handleRejectPrivateJoin = async (reqId) => { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'join_requests', reqId), { status: 'rejected' }); };
  
  let tabs = [ 
    {id:'info', icon:Info, label:'Info', locked: false}, 
    {id:'programma', icon:ListChecks, label:'Programma', locked: false}, 
    {id:'budget', icon:Wallet, label:'Budget', locked: isPreview && !isAdmin}, 
    {id:'mappa', icon:Map, label:'Mappa', locked: isPreview && !isAdmin}, 
    {id:'summary', icon:BarChart2, label:'Sondaggi', locked: isPreview && !isAdmin}, 
    {id:'todo', icon:CheckSquare, label:'To-Do', locked: isPreview && !isAdmin}, 
    {id:'memories', icon:ImagePlus, label:'Ricordi', locked: isPreview && !isAdmin} 
  ];
  // 💡 NUOVO: Aggiungi la tab Chat se abilitata e NON è una preview
  if (chatEnabled && !isPreview) {
      tabs.push({id:'chat', icon:MessageSquare, label:'Chat', locked: !isParticipant}); // Blocca se non è un partecipante
  }
  
  if (!hasFullAccess && !isPreview) { 
      if (!permissions.details.visible) tabs = tabs.filter(t => t.id !== 'mappa' && t.id !== 'summary' && t.id !== 'budget' && t.id !== 'info'); 
      if (!permissions.todo.visible) tabs = tabs.filter(t => t.id !== 'todo'); 
      if (!permissions.memories.visible) tabs = tabs.filter(t => t.id !== 'memories'); 
  }
  if (hasFullAccess && isClosed) tabs.push({id:'requests', icon:UserPlus, label:'Richieste', locked: false});
  const showRatingButton = isPast && !isPreview && !isAdmin;
  
  // 💡 NUOVO: Rendering della vista Info
  const renderInfoView = () => (
    <div className="bg-white p-6 rounded-xl shadow-lg">
        <div className="flex justify-between items-center mb-4 border-b pb-3">
            <h2 className="text-2xl font-serif font-bold text-brand-dark">Dettagli Evento</h2>
            {isCreator && !isPreview && (
                <button 
                    onClick={() => { setIsEditingDetails(prev => !prev); setImageFile(null); }} // Resetta imageFile
                    className={`text-sm py-1 px-3 rounded font-bold flex items-center gap-1 ${isEditingDetails ? 'bg-red-500 text-white' : 'bg-brand-accent text-brand-dark hover:bg-brand-accent/80'}`}
                    disabled={loadingDetails}
                >
                    {isEditingDetails ? <X className="w-4 h-4"/> : <Edit2 className="w-4 h-4"/>} 
                    {isEditingDetails ? 'Annulla Modifica' : 'Modifica Dettagli'}
                </button>
            )}
        </div>

        <form onSubmit={handleSaveDetails} className="space-y-6">
            
            {/* Immagine di Copertina */}
            <div className="col-span-full">
                <label className="text-sm font-semibold text-gray-600 block mb-1">Immagine di Copertina</label>
                {(project.imageUrl || imageFile) && (
                    <img 
                        src={imageFile ? URL.createObjectURL(imageFile) : project.imageUrl} 
                        alt="Copertina Evento" 
                        className="w-full h-auto object-contain rounded-lg mb-2 shadow-md"
                    />
                )}
                {isEditingDetails ? (
                    <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => setImageFile(e.target.files[0])} 
                        className="w-full p-2 border rounded-lg text-sm" 
                    />
                ) : (
                    !project.imageUrl && <p className="text-sm italic text-gray-500">Nessuna immagine caricata.</p>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nome */}
                <div className="col-span-full">
                    <label className="text-sm font-semibold text-gray-600 block mb-1">Nome Evento</label>
                    {isEditingDetails ? (
                        <input type="text" name="name" defaultValue={project.name} className="w-full p-2 border rounded-lg text-lg font-serif" required />
                    ) : (
                        <p className="text-xl font-bold text-brand-dark">{project.name}</p>
                    )}
                </div>

                {/* Descrizione */}
                <div className="col-span-full">
                    <label className="text-sm font-semibold text-gray-600 block mb-1">Descrizione</label>
                    {isEditingDetails ? (
                        <textarea name="description" defaultValue={project.description} rows="3" className="w-full p-2 border rounded-lg"></textarea>
                    ) : (
                        <p className="text-gray-700 whitespace-pre-wrap">{project.description || 'Nessuna descrizione.'}</p>
                    )}
                </div>

                {/* Date e Luogo */}
                <div>
                    <label className="text-sm font-semibold text-gray-600 block mb-1">Periodo</label>
                    {isEditingDetails ? (
                         <div className="flex gap-2">
                             <input type="date" name="dateStart" defaultValue={project.dateStart} className="p-2 border rounded-lg w-full" />
                             <input type="date" name="dateEnd" defaultValue={project.dateEnd} className="p-2 border rounded-lg w-full" />
                         </div>
                    ) : (
                        <p className="font-medium text-brand-dark flex items-center gap-2"><CalendarDays className="w-4 h-4 text-brand-action"/> {formatDateRange(project.dateStart, project.dateEnd)}</p>
                    )}
                </div>
                <div>
                    <label className="text-sm font-semibold text-gray-600 block mb-1">Location Base</label>
                    {isEditingDetails ? (
                        <input type="text" name="location" defaultValue={project.location} className="w-full p-2 border rounded-lg" />
                    ) : (
                        <p className="font-medium text-brand-dark flex items-center gap-2"><Map className="w-4 h-4 text-brand-action"/> {project.location || 'Non specificata'}</p>
                    )}
                </div>
                
                {/* Prezzo e Persone */}
                <div>
                    <label className="text-sm font-semibold text-gray-600 block mb-1">Budget Totale Stimato (€)</label>
                    {isEditingDetails ? (
                        <input type="number" name="price" defaultValue={project.price} className="w-full p-2 border rounded-lg" />
                    ) : (
                        <p className="font-medium text-brand-dark flex items-center gap-2"><Banknote className="w-4 h-4 text-brand-action"/> €{project.price || 0}</p>
                    )}
                </div>
                <div>
                    <label className="text-sm font-semibold text-gray-600 block mb-1">Max Partecipanti</label>
                    {isEditingDetails ? (
                        <input type="number" name="maxPeople" defaultValue={project.maxPeople} className="w-full p-2 border rounded-lg" />
                    ) : (
                        <p className="font-medium text-brand-dark flex items-center gap-2"><Users className="w-4 h-4 text-brand-action"/> {project.maxPeople || 'Illimitato'}</p>
                    )}
                </div>
                
                {/* Tipo di Iscrizione */}
                <div className="col-span-full">
                    <label className="text-sm font-semibold text-gray-600 block mb-1">Tipo di Iscrizione</label>
                    {isEditingDetails ? (
                        <select name="joinType" defaultValue={project.joinType || 'open'} className="w-full p-2 border rounded-lg">
                            <option value="open">Aperta (Chiunque può iscriversi)</option>
                            <option value="closed">Chiusa (Solo su invito/richiesta)</option>
                        </select>
                    ) : (
                        <p className="font-medium text-brand-dark">{project.joinType === 'closed' ? 'Chiusa (Su invito)' : 'Aperta'}</p>
                    )}
                </div>
                
                {/* 💡 NUOVO: Toggle Attivazione Chat */}
                {(isCreator || isAdmin) && !isPreview && (
                    <div className="col-span-full">
                        <label className="text-sm font-semibold text-gray-600 block mb-1">Chat di Gruppo</label>
                        {isEditingDetails ? (
                            <select name="chatEnabled" defaultValue={chatEnabled ? 'true' : 'false'} className="w-full p-2 border rounded-lg bg-yellow-50 font-bold">
                                <option value="true">Attiva</option>
                                <option value="false">Disattiva</option>
                            </select>
                        ) : (
                            <p className={`font-medium text-brand-dark flex items-center gap-2 ${chatEnabled ? 'text-green-600' : 'text-red-600'}`}>
                                {chatEnabled ? <Check className="w-4 h-4"/> : <X className="w-4 h-4"/>} 
                                {chatEnabled ? 'Attivata' : 'Disattivata'}
                            </p>
                        )}
                    </div>
                )}
            </div>
            
            {/* NUOVA SEZIONE: PERMESSI */}
            {isCreator && !isPreview && (
                <div className="col-span-full pt-4 border-t border-gray-200">
                    <h3 className="text-lg font-bold text-brand-dark mb-2">Permessi Partecipanti</h3>
                    <div className="space-y-2">
                        {['details', 'todo', 'memories'].map(type => (
                            <div key={type} className="p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                                <span className="font-medium capitalize text-sm">{type.charAt(0).toUpperCase() + type.slice(1)}:</span>
                                {isEditingDetails ? (
                                    <div className="flex gap-4 text-sm">
                                        <label className="flex items-center gap-1">
                                            <span className='font-semibold'>Vista:</span>
                                            <select name={`${type}Visible`} defaultValue={permissions[type]?.visible ? 'true' : 'false'} className="p-1 border rounded">
                                                <option value="true">Sì</option>
                                                <option value="false">No</option>
                                            </select>
                                        </label>
                                        <label className="flex items-center gap-1">
                                            <span className='font-semibold'>Interagisci:</span>
                                            <select name={`${type}Interact`} defaultValue={permissions[type]?.interact ? 'true' : 'false'} className="p-1 border rounded">
                                                <option value="true">Sì</option>
                                                <option value="false">No</option>
                                            </select>
                                        </label>
                                    </div>
                                ) : (
                                    <div className="flex gap-4 text-xs">
                                        <span className={`flex items-center gap-1 ${permissions[type]?.visible ? 'text-green-600' : 'text-red-600'}`} title="Visibilità">
                                            {permissions[type]?.visible ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4"/>} Visibile
                                        </span>
                                        <span className={`flex items-center gap-1 ${permissions[type]?.interact ? 'text-green-600' : 'text-red-600'}`} title="Interazione">
                                            {permissions[type]?.interact ? <Hand className="w-4 h-4"/> : <HandIcon className="w-4 h-4"/>} Interagibile
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {isEditingDetails && (
                <button type="submit" disabled={loadingDetails} className="mt-4 w-full bg-brand-action text-white py-3 rounded-lg font-bold flex justify-center gap-2 disabled:opacity-50">
                    {loadingDetails ? <Loader2 className="animate-spin"/> : <Check className="w-5 h-5" />} Salva Modifiche
                </button>
            )}
            
        </form>
        {loadingDetails && <Loader text="Salvataggio..." />}
    </div>
  );

  console.log('🎯 ProjectView render:', { 
    view, 
    projectId: project.id,
    projectName: project.name,
    isEditingDetails,
    collectionType 
  });

  return ( 
    <div className="min-h-screen bg-brand-light pb-10">
        <header className="sticky top-0 z-10 bg-brand-dark shadow-md">
            <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3"><button onClick={onBack} className="text-gray-400 hover:text-white"><ArrowLeft/></button><div><h1 className="text-xl font-serif font-bold text-brand-light flex items-center gap-2">{project.name}{isPreview && <span className="bg-brand-accent text-brand-dark text-[10px] px-2 py-0.5 rounded uppercase">Anteprima</span>}{isPast && <span className="bg-gray-700 text-gray-300 text-[10px] px-2 py-0.5 rounded uppercase">Svolto</span>}</h1><p className="text-xs text-brand-accent">Partecipanti: {participants.length > 0 ? participants.map(p=>p.name).join(', ') : '...'}</p></div></div>
                <div className="flex items-center gap-3">
                    {!isPreview && (<div className="text-center px-3 py-1 border border-brand-accent/50 rounded"><div className="text-[10px] text-brand-accent uppercase">Spesa</div><div className="font-bold text-white">€{totalCost.toFixed(2)}</div></div>)}
                    {showRatingButton && (<button onClick={() => setShowReviewModal(true)} className={`${userReview ? 'bg-white text-brand-dark border-2 border-brand-accent' : 'bg-brand-accent text-brand-dark'} px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:opacity-90 transition shadow-lg`}><Star className={`w-4 h-4 ${userReview ? 'fill-brand-accent text-brand-accent' : 'fill-brand-dark'}`}/> {userReview ? `Il tuo voto: ${userReview.rating}/5` : 'Valuta Evento'}</button>)}
                    {isPreview ? (<button onClick={() => onJoinRequest(project)} disabled={isPast} className={`bg-brand-action text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm ${isPast ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-700'}`}>{isJoinedOpen ? <Copy className="w-4 h-4"/> : <UserPlus className="w-4 h-4"/>}{isPast ? 'Concluso' : (isJoinedOpen ? 'Iscriviti' : 'Richiedi')}</button>) : (!isPast && (<button onClick={() => setShowInvite(true)} className={`bg-brand-accent text-brand-dark px-3 py-2 rounded font-bold flex items-center gap-2 text-sm hover:bg-white transition`}><UserPlus className="w-4 h-4"/> <span className="hidden md:inline">Invita</span></button>))}<button onClick={() => navigator.clipboard.writeText(window.location.href)} className="bg-brand-secondary/20 hover:bg-brand-secondary/40 text-brand-light p-2 rounded"><Share2 className="w-5 h-5"/></button>
                </div>
            </div>
            {/* 💡 AGGIUNTO: Classe per la tab Chat bloccata (visibile se !isPreview e chatEnabled) */}
            <div className="flex justify-center gap-1 p-2 bg-brand-dark/90 backdrop-blur border-t border-white/10 overflow-x-auto">{tabs.map(tab => (<button key={tab.id} onClick={() => tab.locked ? alert("Devi essere un partecipante per accedere alla Chat.") : setView(tab.id)} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition relative ${view===tab.id ? 'bg-brand-light text-brand-dark' : 'text-gray-400 hover:text-white'} ${tab.locked ? 'opacity-50' : ''}`}>{tab.locked ? <Lock className="w-3 h-3"/> : <tab.icon className="w-4 h-4"/>} {tab.label}{tab.id === 'requests' && joinRequests.length > 0 && <span className="bg-brand-action text-white text-xs w-5 h-5 rounded-full flex items-center justify-center ml-2">{joinRequests.length}</span>}</button>))}</div>
        </header>
        <main className="max-w-7xl mx-auto p-4">
            {view === 'info' && renderInfoView()}
            {view === 'programma' && (<div className="space-y-8">{(hasFullAccess || (!isPreview && canInteract('details'))) && (<div className="flex justify-end"><button onClick={()=>{setEditingEx(null); setShowAdd(true)}} className="bg-brand-action text-white px-4 py-2 rounded-lg font-bold shadow-lg flex items-center gap-2"><Plus className="w-5 h-5"/> Nuova Attività</button></div>)}{isPreview && !isAdmin && (<div className="bg-brand-dark text-brand-light p-4 rounded-lg mb-6 flex items-center justify-between border-l-4 border-brand-accent"><div><p className="font-bold">Modalità Anteprima</p><p className="text-sm text-brand-secondary">Iscriviti per vedere i dettagli.</p></div></div>)}{sortedDays.length > 0 ? sortedDays.map(day => { 
                const nightStay = getNightStay(day); const checkOuts = getCheckOuts(day); const rentalDropoffs = getRentalDropoffs(day);
                return (<section key={day}><div className="flex items-center justify-between border-b border-brand-accent/30 pb-1 mb-4"><h3 className="text-xl font-serif font-bold text-brand-dark flex items-center gap-2"><CalendarDays className="text-brand-action"/> {formatDateRange(day, day)}</h3>{nightStay && <div className="text-xs font-medium text-brand-secondary flex items-center gap-1 bg-purple-50 px-2 py-1 rounded-full"><Moon className="w-3 h-3"/> {nightStay.name}</div>}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {checkOuts.map(co => <div key={'co-'+co.id} className="col-span-1 md:col-span-2 lg:col-span-3"><AccommodationCard ex={co} isReadOnly={true} isCheckOut={true} /></div>)}
                {rentalDropoffs.map(rd => <div key={'rd-'+rd.id} className="col-span-1 md:col-span-2 lg:col-span-3"><RentalCard ex={rd} isReadOnly={true} isDropOff={true} /></div>)}
                {grouped[day].map(ex => (<ProgramItem key={ex.id} ex={ex} userId={user.uid} myVotes={myVotes} hasVoted={myVotes.includes(ex.id)} voters={participants.filter(p=>votes.some(v=>v.excursionId===ex.id && v.userId===p.id)).map(p=>p.name.split(' ')[0])} onToggleVote={handleToggleVote} onEdit={()=>{if(hasFullAccess){setEditingEx(ex); setShowAdd(true);}}} onDelete={()=>hasFullAccess && confirm("Cancello?") && deleteDoc(doc(collection(projectRef, 'excursions'), ex.id))} isReadOnly={(isPreview && !isAdmin) || (!hasFullAccess && !canInteract('details'))} />))}</div></section>);
            }) : (<div className="text-center text-brand-secondary p-10 bg-white rounded-lg shadow"><ListChecks className="w-12 h-12 mx-auto mb-4" /><h3 className="text-lg font-bold">Nessuna attività.</h3></div>)}</div>)}
            {view === 'budget' && (!isPreview || isAdmin) && <BudgetView excursions={excursions} myVotes={myVotes} />}
            {view === 'mappa' && (!isPreview || isAdmin) && (<div className="bg-white p-6 rounded-xl shadow-lg"><h2 className="text-2xl font-serif font-bold text-brand-dark mb-4">Mappa</h2><div className="aspect-video w-full"><iframe width="100%" height="100%" style={{ border: 0 }} loading="lazy" allowFullScreen src={mapEmbedUrl}></iframe></div></div>)}
            {view === 'summary' && (!isPreview || isAdmin) && <div className="bg-white p-6 rounded-xl shadow-lg"><h2 className="text-2xl font-serif font-bold text-brand-dark mb-4">Classifica Sondaggi</h2>{ranked.map((ex, i) => (<div key={ex.id} className="flex items-center gap-4 p-4 border-b last:border-0"><div className="text-2xl font-bold text-brand-action w-8">{i+1}.</div><div><h4 className="font-bold text-lg">{ex.name}</h4><p className="text-sm text-brand-secondary">{ex.count} voti</p></div></div>))}</div>}
            {view === 'todo' && (!isPreview || isAdmin) && <TodoList projectRef={projectRef} user={user} userProfile={userProfile} readOnly={!canInteract('todo')} />}
            {view === 'memories' && (!isPreview || isAdmin) && <MemoriesView projectRef={projectRef} storage={storage} user={user} userProfile={userProfile} readOnly={!canInteract('memories')} stats={stats} participants={participants} isCreator={isCreator} />}
            {view === 'requests' && hasFullAccess && isClosed && (<div className="bg-white p-6 rounded-xl shadow-lg"><h2 className="text-2xl font-serif font-bold text-brand-dark mb-4">Richieste Iscrizione</h2>{joinRequests.length === 0 ? <p>Nessuna.</p> : (<ul className="space-y-3">{joinRequests.map(req => (<li key={req.id} className="flex justify-between items-center bg-brand-light p-3 rounded"><div><p className="font-bold text-brand-dark">{req.userName}</p><p className="text-xs text-brand-secondary">Per: {req.tripName}</p></div><div className="flex gap-2"><button onClick={()=>handleApprovePrivateJoin(req)} className="text-green-600 p-1 bg-green-100 rounded"><Check/></button><button onClick={()=>handleRejectPrivateJoin(req.id)} className="text-red-600 p-1 bg-red-100 rounded"><X/></button></div></li>))}</ul>)}</div>)}
            {/* 💡 NUOVO: Chat View */}
            {view === 'chat' && chatEnabled && !isPreview && isParticipant && (
                <ProjectChat 
                    project={project} 
                    projectRef={projectRef} 
                    user={user} 
                    userProfile={userProfile} 
                    isCreator={isCreator} 
                />
            )}
            {view === 'chat' && chatEnabled && !isPreview && !isParticipant && (
                 <div className="bg-white p-6 rounded-xl shadow-lg text-center">
                    <Lock className="w-12 h-12 mx-auto text-red-400 mb-4"/>
                    <p className="font-bold text-lg text-brand-dark">Accesso Negato</p>
                    <p className="text-gray-700">Devi far parte dell'evento per partecipare alla chat.</p>
                 </div>
            )}
        </main>
        {showAdd && (!isPreview || isAdmin) && <AddExcursionForm initialData={editingEx} onSave={handleSaveEx} onClose={()=>setShowAdd(false)} tripDates={{start: project.dateStart, end: project.dateEnd}} />}
        {showInvite && !isPreview && <InviteModal db={db} user={user} project={project} onClose={() => setShowInvite(false)} myFriends={myFriends} myCompanies={myCompanies} />}
        {showReviewModal && <ReviewModal tripName={project.name} initialRating={userReview ? userReview.rating : 5} initialComment={userReview ? userReview.comment : ''} onClose={()=>setShowReviewModal(false)} onSave={handleSaveReview} />}
    </div> 
  );
};

export default ProjectView;