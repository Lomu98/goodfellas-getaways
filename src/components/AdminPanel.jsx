import React, { useState, useEffect } from 'react';
import { Bell, Send, FileWarning, UserPlus, Plus, Inbox as InboxIcon, Check, X, ExternalLink, UserCheck, UserX, Copy } from 'lucide-react';
import { onSnapshot, query, collection, where, doc, setDoc, updateDoc, addDoc, deleteDoc, writeBatch, getDocs, getDoc, serverTimestamp } from 'firebase/firestore';
import TripForm from './TripForm.jsx';
import { appId } from '../lib/firebase.js';

const AdminPanel = ({ db, storage, user, userProfile, onSelectProject, onPreview }) => {
  const [view, setView] = useState('requests'); 
  const [requests, setRequests] = useState([]); 
  const [proposals, setProposals] = useState([]); 
  const [unpubs, setUnpubs] = useState([]); 
  const [joinRequests, setJoinRequests] = useState([]); 
  const [showPublishForm, setShowPublishForm] = useState(false);

  useEffect(() => { 
      const u1 = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'admin_requests'), where('status', '==', 'pending')), s => { 
          const all = s.docs.map(d => ({id:d.id, ...d.data()})); 
          setRequests(all.filter(r => r.type !== 'unpublish')); 
          setUnpubs(all.filter(r => r.type === 'unpublish')); 
      }); 
      const u2 = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'projects'), where('status', '==', 'pending_review')), s => setProposals(s.docs.map(d => ({id:d.id, ...d.data()})))); 
      const u3 = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'join_requests'), where('status', '==', 'pending'), where('requestType', '==', 'public')), s => setJoinRequests(s.docs.map(d => ({id:d.id, ...d.data()})))); 
      return () => { u1(); u2(); u3(); }; 
  }, [db]);

  const handleApproveAdmin = async (req) => { try { await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'admins', req.userId), { email: req.email, name: req.userName, addedAt: serverTimestamp() }); await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'admin_requests', req.id), { status: 'approved' }); } catch (e) { console.error(e); } };
  const handleRejectAdmin = async (id) => { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'admin_requests', id), { status: 'rejected' }); };
  
  const handleApproveProposal = async (p) => { 
      try { 
          const d = { ...p }; 
          delete d.id; 
          d.organizers = ['Goodfellas Getaways', p.creatorName]; 
          d.basedOn = p.id; 
          d.hidden = false; 
          d.createdAt = serverTimestamp(); 
          d.ratingTotal=0; 
          d.ratingCount=0; 
          delete d.memberIds; 
          delete d.status; 
          
          const ref = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'published_trips'), d); 
          
          const sourceExcursions = collection(db, 'artifacts', appId, 'public', 'data', 'projects', p.id, 'excursions');
          const snap = await getDocs(sourceExcursions); 
          
          const b = writeBatch(db); 
          snap.forEach(x => { 
              const destRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'published_trips', ref.id, 'excursions'));
              b.set(destRef, x.data()); 
          }); 
          
          await b.commit(); 
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', p.id), { status: 'approved', publishedId: ref.id }); 
          alert("Pubblicato!"); 
      } catch (e) { alert(e.message); } 
  };
  
  const handleOpenFull = async (pid) => { if (!pid) return; try { const s = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'published_trips', pid)); if (s.exists()) onSelectProject({ id: s.id, ...s.data() }, 'published_trips'); else alert("Non trovato."); } catch (e) { console.error(e); } };
  
  const handleConfirmUnpublish = async (r) => { try { if (r.publicId) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'published_trips', r.publicId)); await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'projects', r.projectId), { status: 'private', publishedId: null }); await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'admin_requests', r.id), { status: 'approved' }); alert("Rimosso!"); } catch (e) { console.error(e); } };
  
  // --- LOGICA DI ACQUISIZIONE CORRETTA ---
  const handleTakeover = async (r) => { 
      if (!confirm("Confermi acquisizione? L'evento diventerà proprietà degli Admin.")) return; 
      try { 
          // 1. Usa il Viaggio PUBBLICO come fonte (sicurezza WYSIWYG)
          if (!r.publicId) throw new Error("ID Pubblico mancante nella richiesta.");
          
          const oldTripRef = doc(db, 'artifacts', appId, 'public', 'data', 'published_trips', r.publicId); 
          const oldSnap = await getDoc(oldTripRef); 
          
          if(!oldSnap.exists()) throw new Error("Viaggio pubblico originale non trovato."); 
          
          const oldData = oldSnap.data(); 
          
          // 2. Crea i nuovi metadati per il nuovo Admin Trip
          const newData = { 
              ...oldData, 
              organizers: ['Goodfellas Getaways'], 
              creatorName: 'Goodfellas Team', 
              createdBy: user.uid, 
              basedOn: null, 
              createdAt: serverTimestamp() 
          }; 
          delete newData.id; // Rimuovi vecchio ID se presente nei dati
          
          // 3. Scrivi il nuovo viaggio
          const newTripRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'published_trips'), newData); 
          
          // 4. Recupera le escursioni dal VECCHIO viaggio PUBBLICO
          const oldExcursionsRef = collection(db, 'artifacts', appId, 'public', 'data', 'published_trips', r.publicId, 'excursions');
          const exSnap = await getDocs(oldExcursionsRef); 
          
          const b = writeBatch(db); 
          
          // 5. Clona le escursioni nel NUOVO viaggio
          if (!exSnap.empty) {
            exSnap.forEach(x => { 
                const newExRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'published_trips', newTripRef.id, 'excursions'));
                b.set(newExRef, x.data()); 
                
                // Aggiungi eliminazione vecchia escursione al batch per pulizia
                b.delete(x.ref);
            }); 
          } else {
              console.warn("Nessuna escursione trovata nel viaggio pubblico originale.");
          }

          // 6. Elimina il vecchio documento padre pubblico
          b.delete(oldTripRef); 
          
          // 7. Aggiorna il progetto privato dell'utente (torna privato)
          b.update(doc(db, 'artifacts', appId, 'public', 'data', 'projects', r.projectId), { status: 'private', publishedId: null }); 
          
          // 8. Chiudi la richiesta admin
          b.update(doc(db, 'artifacts', appId, 'public', 'data', 'admin_requests', r.id), { status: 'approved_takeover' }); 
          
          await b.commit(); 
          alert("Evento acquisito e clonato con successo!"); 
      } catch (e) { 
          console.error("Errore Takeover:", e);
          alert("Errore durante l'acquisizione: " + e.message); 
      } 
  };
  
  const handleApprovePrivateJoin = async (req) => { try { const tRef = doc(db, 'artifacts', appId, 'public', 'data', 'published_trips', req.tripId); const tSnap = await getDoc(tRef); if (!tSnap.exists()) throw new Error("Trip not found"); const t = tSnap.data(); const pRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'projects'), { name: t.name, description: t.description, createdBy: req.userId, createdAt: serverTimestamp(), memberIds: [req.userId], basedOn: tSnap.id, location: t.location||'', dateStart: t.dateStart||'', dateEnd: t.dateEnd||'', price: t.price||0, maxPeople: t.maxPeople||0, imageUrl: t.imageUrl||'', status: 'private', creatorName: t.creatorName || t.organizers?.[0] || 'Sconosciuto', organizers: t.organizers||[], joinType: 'open' }); const exSnap = await getDocs(collection(tRef, 'excursions')); const b = writeBatch(db); exSnap.forEach(x => { b.set(doc(collection(pRef, 'excursions')), x.data()); }); await b.commit(); await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'join_requests', req.id), { status: 'approved' }); } catch (err) { console.error(err); alert("Errore approvazione: " + err.message); } };
  const handleRejectPrivateJoin = async (id) => { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'join_requests', id), { status: 'rejected' }); };

  const Empty = ({ t }) => ( <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center"><InboxIcon className="w-12 h-12 mb-3 text-gray-300"/><p className="font-medium">{t}</p></div> );

  return ( <> <div className="flex border-b border-gray-300 mb-6 overflow-x-auto"><button onClick={()=>setView('requests')} className={`py-3 px-6 font-bold flex items-center gap-2 whitespace-nowrap ${view==='requests'?'border-b-4 border-brand-action text-brand-dark':'text-brand-secondary'}`}><Bell/> Rich. Admin</button><button onClick={()=>setView('proposals')} className={`py-3 px-6 font-bold flex items-center gap-2 whitespace-nowrap ${view==='proposals'?'border-b-4 border-brand-action text-brand-dark':'text-brand-secondary'}`}><Send/> Proposte</button><button onClick={()=>setView('unpublish')} className={`py-3 px-6 font-bold flex items-center gap-2 whitespace-nowrap ${view==='unpublish'?'border-b-4 border-brand-action text-brand-dark':'text-brand-secondary'}`}><FileWarning/> Rimozioni</button><button onClick={()=>setView('joins')} className={`py-3 px-6 font-bold flex items-center gap-2 whitespace-nowrap ${view==='joins'?'border-b-4 border-brand-action text-brand-dark':'text-brand-secondary'}`}><UserPlus/> Iscrizioni</button><button onClick={()=>setShowPublishForm(true)} className={`py-3 px-6 font-bold flex items-center gap-2 whitespace-nowrap text-brand-secondary`}><Plus/> Pubblica</button></div>
      {view === 'requests' && (<div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-brand-accent"><h3 className="text-2xl font-serif font-bold text-brand-dark mb-4">Richieste Admin</h3>{requests.length === 0 ? <Empty t="Nessuna richiesta." /> : <ul className="space-y-3">{requests.map(r => (<li key={r.id} className="flex justify-between items-center bg-brand-light p-3 rounded"><div><p className="font-bold text-brand-dark">{r.userName}</p><p className="text-xs text-brand-secondary">{r.email}</p></div><div className="flex gap-2"><button onClick={()=>handleApproveAdmin(r)} className="text-green-600 p-1"><UserCheck/></button><button onClick={()=>handleRejectAdmin(r.id)} className="text-red-600 p-1"><UserX/></button></div></li>))}</ul>}</div>)}
      {view === 'proposals' && (<div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-brand-accent"><h3 className="text-2xl font-serif font-bold text-brand-dark mb-4">Proposte</h3>{proposals.length === 0 ? <Empty t="Nessuna proposta." /> : <ul className="space-y-3">{proposals.map(p => (<li key={p.id} className="flex justify-between items-center bg-brand-light p-3 rounded"><div><button onClick={() => onSelectProject(p)} className="text-left hover:underline text-blue-600 font-bold flex items-center gap-1">{p.name} <ExternalLink className="w-3 h-3" /></button><p className="text-xs text-brand-secondary">{p.creatorName}</p></div><div className="flex gap-2"><button onClick={()=>handleApproveProposal(p)} className="text-green-600 p-1 bg-green-100 rounded"><Check/></button><button onClick={()=>updateDoc(doc(db,'artifacts',appId,'public','data','projects',p.id),{status:'rejected'})} className="text-red-600 p-1 bg-red-100 rounded"><X/></button></div></li>))}</ul>}</div>)}
      {view === 'unpublish' && (<div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-brand-accent"><h3 className="text-2xl font-serif font-bold text-brand-dark mb-4">Rimozioni</h3>{unpubs.length === 0 ? <Empty t="Nessuna richiesta." /> : <ul className="space-y-3">{unpubs.map(u => (<li key={u.id} className="flex justify-between items-center bg-brand-light p-3 rounded"><div><button onClick={()=>handleOpenFull(u.publicId)} className="text-left hover:underline text-blue-600 font-bold flex items-center gap-1">{u.tripName} <ExternalLink className="w-3 h-3" /></button><p className="text-xs text-brand-secondary">di {u.userName}</p></div><div className="flex gap-2"><button onClick={()=>handleTakeover(u)} className="text-white bg-brand-accent px-2 py-1 rounded font-bold text-xs flex items-center gap-1"><Copy className="w-3 h-3"/> Acquisisci</button><button onClick={()=>handleConfirmUnpublish(u)} className="text-white bg-red-600 px-2 py-1 rounded font-bold text-xs">Accetta</button></div></li>))}</ul>}</div>)}
      {view === 'joins' && (<div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-brand-accent"><h3 className="text-2xl font-serif font-bold text-brand-dark mb-4">Iscrizioni</h3>{joinRequests.length === 0 ? <p>Nessuna.</p> : (<ul className="space-y-3">{joinRequests.map(req => (<li key={req.id} className="flex justify-between items-center bg-brand-light p-3 rounded"><div><p className="font-bold text-brand-dark">{req.userName}</p><p className="text-xs text-brand-secondary">Per: {req.tripName}</p></div><div className="flex gap-2"><button onClick={()=>handleApprovePrivateJoin(req)} className="text-green-600 p-1 bg-green-100 rounded"><Check/></button><button onClick={()=>handleRejectPrivateJoin(req.id)} className="text-red-600 p-1 bg-red-100 rounded"><X/></button></div></li>))}</ul>)}</div>)}
      {showPublishForm && <TripForm db={db} storage={storage} user={user} userProfile={userProfile} onClose={()=>setShowPublishForm(false)} isPrivate={false} />} </> );
};

export default AdminPanel;