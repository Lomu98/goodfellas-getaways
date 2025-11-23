import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Loader2, Users, Plus, Star, Check, X, UserPlus, Trash2, ShieldCheck, Mail, Send } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, addDoc, updateDoc, deleteDoc, writeBatch, arrayUnion, arrayRemove, getDocs, getDoc, serverTimestamp } from 'firebase/firestore';
import Modal from './Modal';
import Loader from './Loader'; // 👈 AGGIUNTO: Risolve l'errore di Modale vuoto
import { appId } from '../lib/firebase';

const CompanyModal = ({ db, user, userProfile, onClose, onSelectCompany }) => { // 👈 AGGIUNTO onSelectCompany
    const [view, setView] = useState('mine'); // 'mine', 'create', 'requests'
    const [myFriends, setMyFriends] = useState([]);
    const [myCompanies, setMyCompanies] = useState([]);
    const [companyRequests, setCompanyRequests] = useState([]);
    const [loading, setLoading] = useState(false); // Inizializzato a false
    const [friendsLoading, setFriendsLoading] = useState(true);

    // Stato per la creazione
    const [newCompanyName, setNewCompanyName] = useState('');
    const [selectedFriends, setSelectedFriends] = useState([]);

    // Listener 1: Amici (per invitare)
    useEffect(() => {
        setFriendsLoading(true);
        const friendIds = userProfile.friendIds || [];
        if (!friendIds.length) {
            setMyFriends([]);
            setFriendsLoading(false);
            return;
        }
        // Query corretta: Assumiamo che il campo 'uid' esista nei doc utente
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'users'), where('uid', 'in', friendIds));
        const unsub = onSnapshot(q, s => {
            setMyFriends(s.docs.map(d => ({ id: d.id, ...d.data() })));
            setFriendsLoading(false);
        }, (error) => {
             console.error("Error fetching friends for CompanyModal:", error);
             setFriendsLoading(false);
        });
        return unsub;
    }, [db, userProfile.friendIds]);

    // Listener 2: Le Mie Compagnie (fondate o a cui appartengo)
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

    // Listener 3: Proposte di Ingresso Compagnia in Arrivo (requests)
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


    // --- AZIONI DI GRUPPO ---

    const handleCreateCompany = async (e) => {
        e.preventDefault();
        if (!newCompanyName.trim()) return;
        setLoading(true);

        try {
            // 1. Crea il documento Compagnia
            const newCompany = {
                name: newCompanyName.trim(),
                founderId: user.uid,
                founderName: userProfile.name,
                memberIds: [user.uid], // Il fondatore è il primo membro
                createdAt: serverTimestamp(),
            };
            const companyRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'companies'), newCompany);
            
            const batch = writeBatch(db);
            
            // 2. Aggiungi gli invitati
            if (selectedFriends.length > 0) {
                 selectedFriends.forEach(friendId => {
                    const friend = myFriends.find(f => f.id === friendId);
                    if (friend) {
                        // Creazione di un'offerta/invito
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
            await batch.commit();

            setNewCompanyName('');
            setSelectedFriends([]);
            alert("Compagnia creata! Offerte di ingresso inviate agli amici selezionati.");
            setView('mine');
        } catch (e) {
            console.error(e);
            alert("Errore nella creazione della compagnia: " + e.message);
        } finally {
            setLoading(false);
        }
    };
    
    // Azione per accettare/rifiutare l'offerta di ingresso
    const handleOfferAction = async (offer, accept) => {
        setLoading(true);
        try {
            const batch = writeBatch(db);
            const offerRef = doc(db, 'artifacts', appId, 'public', 'data', 'company_offers', offer.id);
            
            // 1. Aggiorna lo stato dell'offerta
            batch.update(offerRef, { status: accept ? 'accepted' : 'rejected' });
            
            if (accept) {
                // 2. Aggiungimi all'array memberIds della compagnia
                const companyRef = doc(db, 'artifacts', appId, 'public', 'data', 'companies', offer.companyId);
                batch.update(companyRef, { memberIds: arrayUnion(user.uid) });
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
    
    // Azione per uscire o eliminare la compagnia (mancava la logica nel tuo file originale)
    const handleLeaveOrDeleteCompany = async (company) => {
        const isFounder = company.founderId === user.uid;
        
        if (isFounder) {
            if (!confirm("Sei il fondatore. Eliminare la compagnia cancellerà tutti i dati relativi. Sei sicuro?")) return;
            setLoading(true);
            await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'companies', company.id));
            alert("Compagnia eliminata.");
        } else {
            if (!confirm(`Vuoi davvero uscire da ${company.name}?`)) return;
            setLoading(true);
            const companyRef = doc(db, 'artifacts', appId, 'public', 'data', 'companies', company.id);
            await updateDoc(companyRef, { memberIds: arrayRemove(user.uid) });
            alert(`Hai lasciato ${company.name}.`);
        }
        setLoading(false);
    };


    // --- RENDERING VIEWS ---

    const renderMineView = () => (
        <div className="space-y-4">
            {myCompanies.length === 0 ? (
                <p className="text-center text-gray-500 italic py-8">Nessuna compagnia attiva. Creane una o accetta un'offerta.</p>
            ) : (
                myCompanies.map(comp => (
                    // AGGIUNTO GESTORE CLICK per il dettaglio
                    <div key={comp.id} className="bg-brand-light p-4 rounded-xl shadow border-l-4 border-brand-accent cursor-pointer hover:shadow-md transition" onClick={() => onSelectCompany(comp)}> 
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
                            {/* Il bottone per eliminare/uscire rimane separato per non triggerare il click sul div */}
                            <button 
                                onClick={(e) => {e.stopPropagation(); handleLeaveOrDeleteCompany(comp);}} // FERMA PROPAGAZIONE
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
                    <p className="text-sm text-gray-500 text-center py-4">Nessun amico disponibile per l'invito. Aggiungi amici dalla sezione Amici & Compagnie.</p>
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


    return (
        <Modal onClose={onClose} size="lg">
            <h2 className="text-2xl font-serif font-bold text-brand-dark mb-4">Gestione Compagnie</h2>
            
            <div className="flex border-b border-gray-300 mb-6">
                <button onClick={() => setView('mine')} className={`py-2 px-4 font-bold ${view === 'mine' ? 'border-b-4 border-brand-action text-brand-dark' : 'text-brand-secondary'}`}><Users className="w-5 h-5 inline mr-2"/> Le Tue Compagnie ({myCompanies.length})</button>
                <button onClick={() => setView('create')} className={`py-2 px-4 font-bold ${view === 'create' ? 'border-b-4 border-brand-action text-brand-dark' : 'text-brand-secondary'}`}><Plus className="w-5 h-5 inline mr-2"/> Crea</button>
                <button onClick={() => setView('requests')} className={`py-2 px-4 font-bold ${view === 'requests' ? 'border-b-4 border-brand-action text-brand-dark' : 'text-brand-secondary'}`}><Mail className="w-5 h-5 inline mr-2"/> Offerte ({companyRequests.length})</button>
            </div>

            {view === 'mine' && renderMineView()}
            {view === 'create' && renderCreateView()}
            {view === 'requests' && renderRequestsView()}
            
            {loading && <Loader text="Aggiornamento..." />}
        </Modal>
    );
};

export default CompanyModal;