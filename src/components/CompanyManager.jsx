import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, Search, UserPlus, UserX, Users, Send, RotateCcw, Plus, Mail, Star, Check, X, ShieldCheck, Edit2, Trash2 } from 'lucide-react'; 
import { collection, query, where, getDocs, setDoc, doc, deleteDoc, onSnapshot, serverTimestamp, getDoc, writeBatch, arrayRemove, arrayUnion, updateDoc, addDoc } from 'firebase/firestore'; 
import { appId } from '../lib/firebase';
import Loader from './Loader'; 
import CompanyDetails from './CompanyDetails'; // 👈 IMPORT CORRETTO

const CompanyManager = ({ db, user, userProfile, onSelectUser }) => {
    // STATI COMUNI
    const [view, setView] = useState('companies'); // 'companies' o 'friends'
    const [loading, setLoading] = useState(false);
    
    // STATI AMICI (DA "CompanyManager" ORIGINALE)
    const [searchTerm, setSearchTerm] = useState('');
    const [foundUser, setFoundUser] = useState(null);
    const [searching, setSearching] = useState(false);
    const [myFriends, setMyFriends] = useState([]); 
    const [friendIds, setFriendIds] = useState(userProfile.friendIds || []); 
    const [sentRequests, setSentRequests] = useState([]); 
    
    // STATI COMPAGNIE (DA "CompanyModal")
    const [companyView, setCompanyView] = useState('mine'); // 'mine', 'create', 'requests'
    const [myCompanies, setMyCompanies] = useState([]);
    const [companyRequests, setCompanyRequests] = useState([]);
    const [friendsLoading, setFriendsLoading] = useState(true); // Per la lista amici da invitare
    const [selectedCompany, setSelectedCompany] = useState(null);
    // Stato per la creazione
    const [newCompanyName, setNewCompanyName] = useState('');
    const [selectedFriends, setSelectedFriends] = useState([]);
    

    // --- LISTENER (RIFATTI PER CompanyManager) ---

    // Listener 1: Ottiene l'array aggiornato di friendIds dal profilo utente (triggera Listener 2)
    useEffect(() => onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), 
      s => setFriendIds(s.data()?.friendIds || [])
    ), [db, user.uid]);
    
    // Listener 2: Ottiene i profili completi degli amici (Usato per lista Amici e per lista invitati Compagnia)
    useEffect(() => {
        setFriendsLoading(true); // Re-inizializza il loading per la lista amici completa
        if (!friendIds.length) {
            setMyFriends([]);
            setFriendsLoading(false);
            return;
        }
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'users'), where('uid', 'in', friendIds)); 
        const unsub = onSnapshot(q, s => {
            setMyFriends(s.docs.map(d => ({ id: d.id, ...d.data(), uid: d.id }))); 
            setFriendsLoading(false);
        });
        return unsub;
    }, [db, friendIds]);

    // Listener 3: Richieste di amicizia INVIATE da me
    useEffect(() => {
      const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'friend_requests'), 
                      where('senderId', '==', user.uid), 
                      where('status', '==', 'pending'));
      const unsub = onSnapshot(q, s => {
          setSentRequests(s.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return unsub;
    }, [db, user.uid]);
    
    // Listener 4: Le Mie Compagnie (fondate o a cui appartengo)
    useEffect(() => {
        setLoading(true);
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'companies'), 
            where('memberIds', 'array-contains', user.uid)
        );
        const unsub = onSnapshot(q, s => {
            setMyCompanies(s.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });
        return unsub;
    }, [db, user.uid]);

    // Listener 5: Proposte di Ingresso Compagnia in Arrivo (requests)
    useEffect(() => {
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'company_offers'), 
            where('receiverId', '==', user.uid),
            where('status', '==', 'pending')
        );
        const unsub = onSnapshot(q, s => {
            setCompanyRequests(s.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return unsub;
    }, [db, user.uid]);


    // --- AZIONI AMICIZIA ---

    const searchUser = async (e) => { 
        e.preventDefault(); 
        setSearching(true); 
        setFoundUser(null); 
        const normalizedSearchTerm = searchTerm.toLowerCase().trim();
        if (!normalizedSearchTerm) { setSearching(false); return; }

        try { 
            let snap = null;

            // 1. Prova prima la ricerca per email (se contiene '@')
            if (normalizedSearchTerm.includes('@')) {
                snap = await getDocs(query(collection(db, 'artifacts', appId, 'public', 'data', 'users'), where('email', '==', normalizedSearchTerm)));
            }
            
            // 2. Se non trova per email o se non è un'email, prova la ricerca per nome (name)
            if (!snap || snap.empty) {
                // RIPRISTINATO: Uso searchTerm.trim() per il nome, mantenendo la sensibilità al maiuscolo/minuscolo
                snap = await getDocs(query(collection(db, 'artifacts', appId, 'public', 'data', 'users'), where('name', '==', searchTerm.trim()))); 
            }

            if (snap && !snap.empty) { 
                const uData = snap.docs[0].data(); 
                const foundId = snap.docs[0].id;
                const isAlreadyFriend = friendIds.includes(foundId);
                const isRequestSent = sentRequests.some(r => r.receiverId === foundId);

                if (foundId === user.uid) {
                    alert("Sei tu!");
                } else if (isAlreadyFriend) {
                    alert(`${uData.name} è già tuo amico!`);
                } else if (isRequestSent) {
                    alert(`Richiesta già inviata a ${uData.name}.`);
                }
                else {
                  setFoundUser({ id: foundId, ...uData });
                }
            } else alert("Utente non trovato per email o nome utente."); 
        } catch (err) { console.error(err); } 
        setSearching(false); 
    };

    const sendFriendRequest = async () => {
        if (!foundUser) return;
        try {
            const docId = `${user.uid}_${foundUser.id}`; 
            
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'friend_requests', docId), {
                senderId: user.uid,
                senderName: userProfile.name,
                receiverId: foundUser.id,
                receiverName: foundUser.name,
                status: 'pending',
                createdAt: serverTimestamp()
            });
            setFoundUser(null);
            setSearchTerm(''); 
            alert(`Richiesta inviata a ${foundUser.name}!`);
        } catch (e) {
            console.error(e);
            alert("Errore nell'invio della richiesta.");
        }
    };

    const removeFriend = async (friendId) => {
        // 1. TROVA LE COMPAGNIE IN COMUNE
        setLoading(true);
        let companiesToUpdate = [];
        let leaveCompanyNames = [];
        let removeFriendCompanyNames = [];

        try {
            const commonCompanies = myCompanies.filter(comp => comp.memberIds.includes(friendId));
            
            if (commonCompanies.length > 0) {
                companiesToUpdate = commonCompanies.map(comp => {
                    const isFriendFounder = comp.founderId === friendId;
                    const isMyCompany = comp.founderId === user.uid;

                    if (isFriendFounder) {
                        leaveCompanyNames.push(comp.name); // Io devo lasciare la compagnia dell'amico
                        return { id: comp.id, action: 'leave' };
                    } else if (isMyCompany) {
                        removeFriendCompanyNames.push(comp.name); // Rimuovo l'amico dalla mia compagnia
                        return { id: comp.id, action: 'remove_friend' };
                    }
                    return null;
                }).filter(Boolean);
            }
        } catch (e) {
            console.error("Errore nella ricerca delle compagnie:", e);
            setLoading(false);
            alert("Errore nella preparazione della rimozione.");
            return;
        }

        let confirmationMessage = "Sei sicuro di voler rimuovere questa amicizia?";
        
        if (companiesToUpdate.length > 0) {
            confirmationMessage = `Tu e l'utente fate parte di alcune compagnie. Rimuovendo l'amicizia:
            
            - Abbandonerai le compagnie che ha fondato l'utente: ${leaveCompanyNames.length > 0 ? leaveCompanyNames.join(', ') : 'Nessuna'}
            - L'utente sarà rimosso dalle tue compagnie: ${removeFriendCompanyNames.length > 0 ? removeFriendCompanyNames.join(', ') : 'Nessuna'}
            
            Vuoi procedere con la rimozione dell'amicizia e l'aggiornamento dei gruppi?`;
        }


        if (!confirm(confirmationMessage)) {
            setLoading(false);
            return;
        }

        // 2. ESEGUI L'OPERAZIONE DI RIMOZIONE AMICIZIA + AGGIORNAMENTO GRUPPI
        try {
            const batch = writeBatch(db);
            const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
            const friendRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', friendId);
            
            // Rimozione Amicizia
            batch.update(friendRef, { friendIds: arrayRemove(user.uid) });
            batch.update(userRef, { friendIds: arrayRemove(friendId) });
            
            // Aggiornamento Compagnie
            companiesToUpdate.forEach(item => {
                const companyRef = doc(db, 'artifacts', appId, 'public', 'data', 'companies', item.id);
                if (item.action === 'leave') {
                    // Rimuovi me stesso dalla compagnia dell'amico
                    batch.update(companyRef, { memberIds: arrayRemove(user.uid) });
                } else if (item.action === 'remove_friend') {
                    // Rimuovi l'amico dalla mia compagnia
                    batch.update(companyRef, { memberIds: arrayRemove(friendId) });
                }
            });
            
            await batch.commit();
            alert("Amicizia rimossa e compagnie aggiornate.");
        } catch (e) {
            console.error(e);
            alert("Errore nella rimozione dell'amicizia o nell'aggiornamento delle compagnie: " + e.message);
        } finally {
            setLoading(false);
        }
    };
    
    const cancelRequest = async (requestId) => {
        if (!confirm("Annullare la richiesta?")) return;
        try {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'friend_requests', requestId), { status: 'cancelled' });
            alert("Richiesta annullata.");
        } catch (e) {
            console.error(e);
            alert("Errore nell'annullamento della richiesta.");
        }
    };
    
    
    // --- AZIONI COMPAGNIA ---
    
    const handleSelectCompany = (company) => {
        setSelectedCompany(company);
    };
    
    const handleCreateCompany = async (e) => {
        e.preventDefault();
        if (!newCompanyName.trim()) return;
        setLoading(true);

        try {
            const newCompany = {
                name: newCompanyName.trim(),
                founderId: user.uid,
                founderName: userProfile.name,
                memberIds: [user.uid],
                createdAt: serverTimestamp(),
            };
            const companyRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'companies'), newCompany);
            
            const batch = writeBatch(db);
            
            if (selectedFriends.length > 0) {
                 selectedFriends.forEach(friendId => {
                    const friend = myFriends.find(f => f.id === friendId);
                    if (friend) {
                        const offerRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'company_offers'));
                        batch.set(offerRef, {
                            companyId: companyRef.id,
                            companyName: newCompanyName,
                            senderId: user.uid,
                            senderName: userProfile.name,
                            receiverId: friendId,
                            receiverName: friend.name,
                            status: 'pending',
                            createdAt: serverTimestamp()
                        });
                    }
                });
            }
            
            // Messaggio di sistema per la creazione della compagnia
            const chatRef = collection(db, 'artifacts', appId, 'public', 'data', 'company_chats');
            const newChatDocRef = doc(chatRef);
            batch.set(newChatDocRef, {
                companyId: companyRef.id,
                senderId: 'SYSTEM',
                senderName: 'SYSTEM',
                content: `${userProfile.name} ha fondato la compagnia "${newCompanyName}"!`,
                timestamp: serverTimestamp(),
            });

            await batch.commit();

            setNewCompanyName('');
            setSelectedFriends([]);
            alert("Compagnia creata! Offerte di ingresso inviate agli amici selezionati.");
            setCompanyView('mine'); 
        } catch (e) {
            console.error(e);
            alert("Errore nella creazione della compagnia: " + e.message);
        } finally {
            setLoading(false);
        }
    };
    
    const handleOfferAction = async (offer, accept) => {
        setLoading(true);
        try {
            const batch = writeBatch(db);
            const offerRef = doc(db, 'artifacts', appId, 'public', 'data', 'company_offers', offer.id);
            
            batch.update(offerRef, { status: accept ? 'accepted' : 'rejected' });
            
            if (accept) {
                const companyRef = doc(db, 'artifacts', appId, 'public', 'data', 'companies', offer.companyId);
                batch.update(companyRef, { memberIds: arrayUnion(user.uid) });
                
                // CORRETTO: Messaggio di sistema in chat quando l'utente accetta
                const chatRef = collection(db, 'artifacts', appId, 'public', 'data', 'company_chats');
                const newChatDocRef = doc(chatRef);
                
                batch.set(newChatDocRef, {
                    companyId: offer.companyId,
                    senderId: 'SYSTEM',
                    senderName: 'SYSTEM',
                    content: `${userProfile.name} è entrato nella compagnia!`,
                    timestamp: serverTimestamp(),
                });
            }
            
            await batch.commit();
        } catch (e) {
            console.error(e);
            alert("Errore nell'azione: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelectFriend = (id) => {
        setSelectedFriends(prev => 
            prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
        );
    };
    
    const handleLeaveOrDeleteCompany = async (company) => {
        const isFounder = company.founderId === user.uid;
        
        if (isFounder) {
            if (!confirm("Sei il fondatore. Eliminare la compagnia cancellerà tutti i dati relativi. Sei sicuro?")) return;
            setLoading(true);
            
            // Aggiungo un messaggio di sistema prima di eliminare
            try {
                const chatRef = collection(db, 'artifacts', appId, 'public', 'data', 'company_chats');
                await addDoc(chatRef, {
                    companyId: company.id,
                    senderId: 'SYSTEM',
                    senderName: 'SYSTEM',
                    content: `La compagnia è stata ELIMINATA dal fondatore ${userProfile.name}.`,
                    timestamp: serverTimestamp(),
                });
            } catch (e) {
                console.warn("Impossibile inviare messaggio di eliminazione chat.", e);
            }
            
            await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'companies', company.id));
            alert("Compagnia eliminata.");
        } else {
            if (!confirm(`Vuoi davvero uscire da ${company.name}?`)) return;
            setLoading(true);
            const companyRef = doc(db, 'artifacts', appId, 'public', 'data', 'companies', company.id);
            await updateDoc(companyRef, { memberIds: arrayRemove(user.uid) });
            
            // Aggiungo un messaggio di sistema per l'abbandono
            try {
                const chatRef = collection(db, 'artifacts', appId, 'public', 'data', 'company_chats');
                await addDoc(chatRef, {
                    companyId: company.id,
                    senderId: 'SYSTEM',
                    senderName: 'SYSTEM',
                    content: `${userProfile.name} ha abbandonato la compagnia.`,
                    timestamp: serverTimestamp(),
                });
            } catch (e) {
                console.warn("Impossibile inviare messaggio di abbandono chat.", e);
            }
            
            alert(`Hai lasciato ${company.name}.`);
        }
        setLoading(false);
    };

    
    // --- RENDERING VIEWS COMPAGNIA (DA CompanyModal) ---

    const renderMineView = () => (
        <div className="space-y-4">
            {myCompanies.length === 0 ? (
                <p className="text-center text-gray-500 italic py-8">Nessuna compagnia attiva. Creane una.</p>
            ) : (
                myCompanies.map(comp => (
                    <div key={comp.id} className="bg-brand-light p-4 rounded-xl shadow border-l-4 border-brand-accent cursor-pointer hover:shadow-md transition" onClick={() => handleSelectCompany(comp)}> 
                        <div className="flex justify-between items-center">
                            <h4 className="font-bold text-lg text-brand-dark">{comp.name}</h4>
                            <span className="text-xs font-bold bg-brand-dark text-white px-2 py-1 rounded-full">{comp.memberIds?.length || 0} membri</span>
                        </div>
                        <p className="text-sm text-brand-secondary mt-1">
                            {comp.founderId === user.uid ? (
                                <span className="text-brand-action font-semibold flex items-center gap-1"><ShieldCheck className="w-3 h-3"/> Founder</span>
                            ) : (
                                `Membro (Fondatore: ${comp.founderName})`
                            )}
                        </p>
                        <div className="mt-3 pt-2 border-t border-gray-200 flex justify-end">
                            <button 
                                onClick={(e) => {e.stopPropagation(); handleLeaveOrDeleteCompany(comp);}} 
                                className="text-xs text-red-500 hover:underline flex items-center gap-1"
                            >
                                <Trash2 className="w-3 h-3"/> {comp.founderId === user.uid ? 'Elimina Gruppo' : 'Lascia Gruppo'}
                            </button>
                        </div>
                    </div>
                ))
            )}
        </div>
    );

    const renderCreateView = () => (
        <form onSubmit={handleCreateCompany} className="space-y-4">
            <input 
                type="text" 
                placeholder="Nome della Nuova Compagnia (es. The Globetrotters)" 
                value={newCompanyName} 
                onChange={e => setNewCompanyName(e.target.value)}
                className="w-full p-3 border rounded-lg text-lg font-serif"
                required
            />
            
            <h4 className="font-bold text-brand-dark mt-6 mb-3 flex items-center gap-2"><UserPlus className="w-5 h-5 text-brand-action"/> Invita Amici ({selectedFriends.length})</h4>
            
            <div className="max-h-60 overflow-y-auto space-y-2 p-3 border rounded-lg bg-gray-50">
                {friendsLoading ? (
                     <p className="text-sm text-gray-500 text-center py-4 flex items-center justify-center gap-2"><Loader2 className="animate-spin w-4 h-4"/> Caricamento Amici...</p>
                ) : myFriends.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">Nessun amico disponibile per l'invito. Aggiungi amici.</p>
                ) : (
                    myFriends.map(f => (
                        <div key={f.id} onClick={() => toggleSelectFriend(f.id)} className="p-2 rounded-lg flex items-center justify-between cursor-pointer bg-white border hover:border-brand-accent">
                            <span className="font-medium">{f.name}</span>
                            <input type="checkbox" checked={selectedFriends.includes(f.id)} readOnly className="w-4 h-4 text-brand-action rounded" />
                        </div>
                    ))
                )}
            </div>

            <button type="submit" disabled={loading} className="w-full bg-brand-dark text-white py-3 rounded-lg font-bold flex justify-center gap-2 disabled:opacity-50">
                {loading ? <Loader2 className="animate-spin"/> : <Star className="w-5 h-5" />} Crea Compagnia e Invia Offerte
            </button>
        </form>
    );

    const renderRequestsView = () => (
        <div className="space-y-4">
            {companyRequests.length === 0 ? (
                <p className="text-center text-gray-500 italic py-8">Nessuna proposta di ingresso pendente.</p>
            ) : (
                companyRequests.map(offer => (
                    <div key={offer.id} className="bg-red-50 p-4 rounded-xl shadow border border-red-200">
                        <p className="font-bold text-brand-dark mb-2">
                            {offer.senderName} ti ha offerto un posto in <span className="text-brand-action font-serif">{offer.companyName}</span>.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => handleOfferAction(offer, true)} className="bg-green-600 text-white px-3 py-1 rounded text-sm font-bold hover:bg-green-700 flex items-center gap-1">
                                <Check className="w-4 h-4"/> Accetta
                            </button>
                            <button onClick={() => handleOfferAction(offer, false)} className="bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm font-bold hover:bg-gray-400 flex items-center gap-1">
                                <X className="w-4 h-4"/> Rifiuta
                            </button>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
    
    // --- RENDERING SEZIONI PRINCIPALI ---

    const renderCompanySection = () => (
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-brand-action">
            <h3 className="text-2xl font-serif font-bold text-brand-dark mb-4">Gestione Compagnia</h3>
            
            <div className="flex border-b border-gray-300 mb-6 overflow-x-auto">
                <button onClick={() => setCompanyView('mine')} className={`py-2 px-4 font-bold ${companyView === 'mine' ? 'border-b-4 border-brand-action text-brand-dark' : 'text-brand-secondary'}`}><Users className="w-5 h-5 inline mr-2"/> Le Tue Compagnie ({myCompanies.length})</button>
                <button onClick={() => setCompanyView('create')} className={`py-2 px-4 font-bold ${companyView === 'create' ? 'border-b-4 border-brand-action text-brand-dark' : 'text-brand-secondary'}`}><Plus className="w-5 h-5 inline mr-2"/> Crea</button>
                <button onClick={() => setCompanyView('requests')} className={`py-2 px-4 font-bold ${companyView === 'requests' ? 'border-b-4 border-brand-action text-brand-dark' : 'text-brand-secondary'}`}><Mail className="w-5 h-5 inline mr-2"/> Offerte ({companyRequests.length})</button>
            </div>
            
            {companyView === 'mine' && renderMineView()}
            {companyView === 'create' && renderCreateView()}
            {companyView === 'requests' && renderRequestsView()}
            
            {loading && <Loader text="Aggiornamento..." />}
        </div>
    );

    const renderFriendSection = () => (
        <div className="space-y-6">
             {/* Cerca Amici */}
            <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-brand-action">
                <h3 className="text-2xl font-serif font-bold text-brand-dark mb-4">Cerca & Gestisci Richieste</h3>
                
                <form onSubmit={searchUser} className="flex gap-2 mb-4">
                    <input 
                        type="text" 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        placeholder="Cerca per email O nome utente" 
                        className="flex-1 p-3 border rounded-lg" 
                        required 
                    />
                    <button type="submit" disabled={searching} className="bg-brand-dark text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2">{searching ? <Loader2 className="animate-spin w-5 h-5" /> : <Search className="w-5 h-5" />} Cerca</button>
                </form>
                
                {foundUser && (
                    <div 
                        className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg flex justify-between items-center animate-slide-in cursor-pointer hover:shadow-md transition" 
                        onClick={() => onSelectUser(foundUser.id)} 
                    >
                        <div>
                            <p className="font-bold text-brand-dark">{foundUser.name}</p>
                            <p className="text-xs text-brand-secondary">{foundUser.email}</p>
                        </div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); sendFriendRequest(); }} 
                            className="bg-brand-action text-white px-3 py-1 rounded shadow hover:bg-red-700 flex items-center gap-1"
                        >
                            <Send className="w-4 h-4" /> Invia Richiesta
                        </button>
                    </div>
                )}
            </div>
            
            {/* Richieste Inviate Pendenti */}
            {sentRequests.length > 0 && (
                <div className="bg-yellow-50 p-6 rounded-xl shadow-lg border-l-4 border-yellow-500">
                    <h3 className="text-lg font-bold text-yellow-800 mb-4 flex items-center gap-2">
                        <Send className="w-5 h-5"/> Richieste Inviate ({sentRequests.length})
                    </h3>
                    <div className="space-y-2">
                        {sentRequests.map(req => (
                            <div key={req.id} className="flex justify-between items-center bg-yellow-100 p-3 rounded-lg">
                                <p className="text-sm text-yellow-900 font-medium">In attesa di {req.receiverName}</p>
                                <button 
                                    onClick={() => cancelRequest(req.id)} 
                                    className="bg-gray-300 text-gray-700 px-3 py-1 rounded text-xs font-bold hover:bg-gray-400 flex items-center gap-1"
                                >
                                    <RotateCcw className="w-4 h-4"/> Annulla
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {/* Lista Amici */}
            <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-brand-accent">
                <h3 className="text-2xl font-serif font-bold text-brand-dark mb-4">I Miei Amici ({myFriends.length})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {myFriends.map(friend => (
                        <div key={friend.id} className="bg-brand-light p-4 rounded-xl shadow flex justify-between items-center cursor-pointer hover:shadow-md transition" onClick={() => onSelectUser(friend.id)}> 
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-brand-accent flex items-center justify-center text-brand-dark font-bold text-lg">
                                    {friend.photoUrl ? (
                                        <img src={friend.photoUrl} alt={friend.name} className="w-full h-full object-cover rounded-full" />
                                    ) : (
                                        friend.name?.charAt(0).toUpperCase()
                                    )}
                                </div>
                                <div>
                                    <p className="font-bold text-brand-dark">{friend.name}</p>
                                    <p className="text-xs text-brand-secondary">{friend.email}</p>
                                </div>
                            </div>
                            <button onClick={(e) => {e.stopPropagation(); removeFriend(friend.id);}} className="text-red-400 hover:text-red-600 p-2" title="Rimuovi Amicizia">
                                <UserX className="w-5 h-5" />
                            </button>
                        </div>
                    ))}
                    {myFriends.length === 0 && (
                        <div className="col-span-full text-center py-8 text-brand-secondary bg-white/50 rounded-xl border border-dashed border-gray-300">
                            <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>Non hai ancora amici. Invia la prima richiesta!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
    
    // --- RENDER PRINCIPALE ---
    
    // Mostra la pagina di dettaglio della compagnia se selezionata
    if (selectedCompany) {
        return (
            <CompanyDetails 
                company={selectedCompany} 
                db={db}
                user={user}
                userProfile={userProfile}
                onClose={() => setSelectedCompany(null)} 
                onSelectUser={onSelectUser}
            />
        );
    }
    
    return ( 
        <div className="space-y-6">
            <h2 className="text-3xl font-serif font-bold text-brand-dark mb-4">Gestione Amici & Compagnie</h2>

            {/* BARRA DI NAVIGAZIONE TAB */}
            <div className="flex border-b border-gray-300 mb-6 overflow-x-auto">
                <button 
                    onClick={() => setView('companies')} 
                    className={`py-3 px-6 font-bold flex items-center gap-2 whitespace-nowrap ${view === 'companies' ? 'border-b-4 border-brand-action text-brand-dark' : 'text-brand-secondary'}`}
                >
                    <Users className="w-4 h-4"/> Compagnie ({myCompanies.length})
                </button>
                <button 
                    onClick={() => setView('friends')} 
                    className={`py-3 px-6 font-bold flex items-center gap-2 whitespace-nowrap ${view === 'friends' ? 'border-b-4 border-brand-action text-brand-dark' : 'text-brand-secondary'}`}
                >
                    <UserPlus className="w-4 h-4"/> Amici ({myFriends.length})
                </button>
            </div>
            
            {/* CONTENUTO IN BASE ALLA TAB */}
            {view === 'companies' && renderCompanySection()}
            {view === 'friends' && renderFriendSection()}
            
        </div> 
    );
};

export default CompanyManager;