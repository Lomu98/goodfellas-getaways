import React, { useState, useEffect, useRef } from 'react';
import { X, Users, MessageSquare, Plus, Trash2, ShieldCheck, CornerDownLeft, Loader2, UserPlus, Mail, Check, RotateCcw } from 'lucide-react'; // Aggiunto UserPlus, Mail, Check, RotateCcw
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, writeBatch, arrayRemove, serverTimestamp, orderBy, limit, addDoc, deleteDoc } from 'firebase/firestore';
import { appId } from '../lib/firebase';
import Loader from './Loader';

const CompanyDetails = ({ company, db, user, userProfile, onClose, onSelectUser }) => {
    const [members, setMembers] = useState([]);
    const [messages, setMessages] = useState([]);
    const [messageInput, setMessageInput] = useState('');
    const [loadingMembers, setLoadingMembers] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(true);
    const [chatError, setChatError] = useState(null); 
    const messagesEndRef = useRef(null);
    const [localLoading, setLocalLoading] = useState(false);
    
    // STATI AGGIUNTI PER LA GESTIONE MEMBRI
    const [availableFriends, setAvailableFriends] = useState([]); // Amici non ancora membri
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [selectedFriendToInvite, setSelectedFriendToInvite] = useState(null);
    const [loadingFriends, setLoadingFriends] = useState(false);
    
    const isFounder = company.founderId === user.uid;


    // --- LISTENER 1: Caricamento Dati Membri ---
    useEffect(() => {
        setLoadingMembers(true);
        const memberIds = company.memberIds || [];
        if (!memberIds.length) {
            setMembers([]);
            setLoadingMembers(false);
            return;
        }

        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'users'), where('uid', 'in', memberIds));
        const unsub = onSnapshot(q, s => {
            setMembers(s.docs.map(d => ({ id: d.id, ...d.data(), isFounder: d.id === company.founderId })));
            setLoadingMembers(false);
        }, (error) => {
             console.error("Error fetching company members:", error);
             setLoadingMembers(false);
        });
        return unsub;
    }, [db, company.memberIds, company.founderId]);
    
    // --- LISTENER 3: Caricamento Amici Disponibili per l'Invito ---
    useEffect(() => {
        setLoadingFriends(true);
        const friendIds = userProfile.friendIds || [];
        if (!friendIds.length) {
            setAvailableFriends([]);
            setLoadingFriends(false);
            return;
        }
        
        // 1. Filtra gli amici che sono GIA' membri
        const nonMemberFriendIds = friendIds.filter(id => !company.memberIds.includes(id));

        if (!nonMemberFriendIds.length) {
            setAvailableFriends([]);
            setLoadingFriends(false);
            return;
        }

        // 2. Query per ottenere i profili degli amici non membri
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'users'), where('uid', 'in', nonMemberFriendIds)); 
        const unsub = onSnapshot(q, s => {
            setAvailableFriends(s.docs.map(d => ({ id: d.id, ...d.data(), uid: d.id }))); 
            setLoadingFriends(false);
        });
        return unsub;
    }, [db, userProfile.friendIds, company.memberIds]); // Dipende anche dai membri attuali!

    // --- LISTENER 2: Chat in Tempo Reale ---
    useEffect(() => {
        setLoadingMessages(true);
        setChatError(null);

        const q = query(
            collection(db, 'artifacts', appId, 'public', 'data', 'company_chats'),
            where('companyId', '==', company.id),
            orderBy('timestamp', 'asc'),
            limit(50)
        );
        
        const unsub = onSnapshot(q, s => {
            const newMessages = s.docs.map(d => ({ 
                id: d.id, 
                ...d.data(),
                isFounder: d.data().senderId === company.founderId 
            }));
            setMessages(newMessages);
            setLoadingMessages(false);
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100); 
        }, (error) => {
             console.error("Firebase Chat Listener Error:", error);
             setChatError("Impossibile caricare la chat. Controlla i permessi di Firestore (Regole).");
             setLoadingMessages(false);
        });
        return unsub;
    }, [db, company.id, company.founderId]);


    // --- AZIONI ---
    
    // Funzione interna per inviare messaggi di sistema
    const sendSystemMessage = async (content) => {
        // Evita di usare serverTimestamp per i messaggi di sistema, usa un timestamp fittizio o lascialo vuoto
        // In questo modo potremo distinguerli nel rendering
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'company_chats'), {
            companyId: company.id,
            senderId: 'SYSTEM', // ID Speciale per i messaggi di sistema
            senderName: 'SYSTEM',
            content: content,
            timestamp: serverTimestamp(),
        });
    }

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!messageInput.trim() || localLoading) return;

        setLocalLoading(true);
        try {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'company_chats'), {
                companyId: company.id,
                senderId: user.uid,
                senderName: userProfile.name,
                content: messageInput.trim(),
                timestamp: serverTimestamp(),
            });
            setMessageInput('');
        } catch (error) {
            console.error("Error sending message:", error);
            alert("Errore nell'invio del messaggio.");
        } finally {
            setLocalLoading(false);
        }
    };
    
    // 💡 NUOVA FUNZIONE: INVITA MEMBRO
    const handleInviteMember = async (friendId, friendName) => {
        setLocalLoading(true);

        try {
            const offerRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'company_offers'));
            await setDoc(offerRef, {
                companyId: company.id,
                companyName: company.name,
                senderId: user.uid,
                senderName: userProfile.name,
                receiverId: friendId,
                receiverName: friendName,
                status: 'pending',
                createdAt: serverTimestamp()
            });
            alert(`Offerta di ingresso inviata a ${friendName}!`);
            setShowInviteModal(false);
        } catch (e) {
            console.error(e);
            alert("Errore nell'invio dell'offerta: " + e.message);
        } finally {
            setLocalLoading(false);
        }
    };

    const handleRemoveMember = async (memberId, memberName) => {
        if (!isFounder || memberId === user.uid) return;
        if (!confirm(`Sei sicuro di voler rimuovere ${memberName} dalla compagnia?`)) return;

        setLocalLoading(true);
        try {
            const companyRef = doc(db, 'artifacts', appId, 'public', 'data', 'companies', company.id);
            await updateDoc(companyRef, { 
                memberIds: arrayRemove(memberId) 
            });
            
            // 💡 AGGIUNTO: Messaggio di sistema in chat
            await sendSystemMessage(`${userProfile.name} ha espulso ${memberName} dalla compagnia.`);

            alert(`${memberName} rimosso con successo.`);
        } catch (e) {
            console.error(e);
            alert("Errore nella rimozione del membro: " + e.message);
        } finally {
            setLocalLoading(false);
        }
    };
    
    const handleLeaveCompany = async () => {
        const leaveMessage = `Vuoi davvero uscire da ${company.name}?`;
        const deleteMessage = "Sei il fondatore. Se esci, la compagnia verrà eliminata. Continuare?";
        
        if (!confirm(isFounder ? deleteMessage : leaveMessage)) {
            return;
        }

        setLocalLoading(true);
        try {
            if (isFounder) {
                // Invio del messaggio prima della cancellazione
                await sendSystemMessage(`Il fondatore ${userProfile.name} ha eliminato la compagnia.`);
                
                await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'companies', company.id));
                alert("Compagnia eliminata.");
            } else {
                const companyRef = doc(db, 'artifacts', appId, 'public', 'data', 'companies', company.id);
                await updateDoc(companyRef, { memberIds: arrayRemove(user.uid) });
                
                // 💡 AGGIUNTO: Messaggio di sistema in chat
                await sendSystemMessage(`${userProfile.name} ha abbandonato la compagnia.`);

                alert(`Hai lasciato ${company.name}.`);
            }
            onClose(); 
        } catch (e) {
            console.error(e);
            alert("Errore: " + e.message);
        } finally {
            setLocalLoading(false);
        }
    };
    
    // 💡 NUOVO: Componente Modale/Selettore per invitare amici
    const renderInviteModal = () => (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-10">
            <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm">
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                    <h4 className="text-lg font-bold text-brand-dark flex items-center gap-2"><UserPlus className="w-5 h-5"/> Invita Amici in {company.name}</h4>
                    <button onClick={() => setShowInviteModal(false)} className="text-gray-500 hover:text-red-500"><X className="w-5 h-5"/></button>
                </div>
                
                {loadingFriends ? (
                    <p className="text-center py-4 text-gray-500 flex items-center justify-center gap-2"><Loader2 className="animate-spin w-4 h-4"/> Caricamento amici...</p>
                ) : availableFriends.length === 0 ? (
                    <p className="text-center py-4 text-gray-500 italic">Nessun amico disponibile per l'invito.</p>
                ) : (
                    <div className="max-h-60 overflow-y-auto space-y-2">
                        {availableFriends.map(f => (
                            <div key={f.id} className="p-2 rounded-lg flex items-center justify-between bg-gray-50 border">
                                <span className="font-medium text-sm">{f.name}</span>
                                <button 
                                    onClick={() => handleInviteMember(f.id, f.name)}
                                    disabled={localLoading}
                                    className="bg-brand-action text-white text-xs px-3 py-1 rounded font-bold hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                                >
                                    <Mail className="w-3 h-3"/> {localLoading ? 'Invio...' : 'Invita'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );


    // --- RENDERING ---

    return (
        <div className="min-h-[70vh] w-full max-w-7xl mx-auto p-4 bg-white rounded-xl shadow-lg mt-6 relative"> {/* Aggiunto relative per la modale */}
            {showInviteModal && renderInviteModal()}
            
            <div className="flex flex-col h-full">
                
                {/* Header Dettaglio Compagnia */}
                <div className="flex justify-between items-start pb-4 border-b border-gray-200 shrink-0">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-serif font-bold text-brand-dark flex items-center gap-2">
                            <Users className="w-6 h-6 text-brand-action"/> {company.name}
                        </h2>
                        {isFounder && <span className="text-sm font-semibold text-brand-action flex items-center gap-1 mt-1">FOUNDER</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                        {isFounder && (
                            <button 
                                onClick={() => setShowInviteModal(true)} 
                                className="text-sm py-1 px-3 rounded font-bold bg-brand-accent text-white hover:bg-red-700 flex items-center gap-1"
                                disabled={localLoading}
                            >
                                <UserPlus className="w-4 h-4"/> Invita
                            </button>
                        )}
                        <button onClick={handleLeaveCompany} className={`text-sm py-1 px-3 rounded font-bold ${isFounder ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                            {isFounder ? 'Elimina Gruppo' : 'Lascia Gruppo'}
                        </button>
                        <button onClick={onClose} className="text-gray-500 hover:text-brand-action p-1" title="Torna a Amici & Compagnie"><X className="w-6 h-6"/></button>
                    </div>
                </div>

                {/* Contenuto Principale: Membri (1/3) & Chat (2/3) */}
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden pt-4 gap-6">

                    {/* COLONNA 1: Membri */}
                    <div className="md:w-1/3 flex flex-col bg-gray-50 p-4 rounded-xl shadow-inner overflow-y-auto shrink-0 h-full max-h-[30vh] md:max-h-full">
                        <h3 className="font-bold text-xl text-brand-dark mb-4 flex items-center gap-2 border-b pb-2 shrink-0"><Users className="w-5 h-5 text-brand-action"/> Membri ({members.length})</h3>
                        {loadingMembers ? (
                            <Loader2 className="animate-spin mx-auto my-8 w-6 h-6 text-brand-secondary"/>
                        ) : (
                            <div className="space-y-3">
                                {members.map(m => (
                                    <div key={m.id} className="flex justify-between items-center p-2 rounded-lg bg-white shadow-sm border border-gray-100 cursor-pointer hover:bg-brand-light" onClick={() => m.id !== user.uid && onSelectUser(m.id)}>
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-brand-accent flex items-center justify-center text-brand-dark text-sm font-bold shrink-0">
                                                {m.photoUrl ? <img src={m.photoUrl} alt={m.name} className="w-full h-full object-cover rounded-full" /> : m.name?.charAt(0).toUpperCase()}
                                            </div>
                                            <span className={`font-medium text-sm truncate ${m.id === user.uid ? 'text-brand-action font-bold' : 'text-brand-dark'}`}>
                                                {m.name} {m.id === user.uid && "(Tu)"}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            {m.isFounder && <ShieldCheck className="w-4 h-4 text-brand-action" title="Founder"/>}
                                            {isFounder && m.id !== user.uid && !m.isFounder && (
                                                <button onClick={(e) => { e.stopPropagation(); handleRemoveMember(m.id, m.name); }} className="p-1 text-red-400 hover:text-red-600 ml-2" title="Rimuovi">
                                                    <Trash2 className="w-4 h-4"/>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* COLONNA 2: Chat */}
                    <div className="md:w-2/3 flex flex-col bg-white rounded-xl shadow-lg border border-gray-200 h-full md:h-auto overflow-hidden">
                        <h3 className="font-bold text-xl text-brand-dark p-4 border-b flex items-center gap-2 shrink-0"><MessageSquare className="w-5 h-5 text-brand-secondary"/> Chat di Gruppo</h3>
                        
                        {/* Area Messaggi */}
                        <div className="flex-1 p-4 space-y-4 overflow-y-auto custom-scroll">
                            {loadingMessages ? (
                                <div className="text-center py-12"><Loader2 className="animate-spin mx-auto w-8 h-8 text-brand-action"/></div>
                            ) : chatError ? (
                                <div className="text-center py-12 text-red-600 border border-red-300 p-4 rounded-lg bg-red-50">
                                    <p className="font-bold">Errore Chat:</p>
                                    <p className="text-sm">{chatError}</p>
                                    <p className="text-xs italic mt-2">Verifica le tue regole di sicurezza in Firestore per la collezione 'company_chats'.</p>
                                </div>
                            ) : messages.length === 0 ? (
                                <p className="text-center text-gray-500 italic py-12">Inizia la conversazione!</p>
                            ) : (
                                messages.map(msg => (
                                    // 💡 MODIFICATO: Logica per distinguere i messaggi di sistema
                                    msg.senderId === 'SYSTEM' ? (
                                        <div key={msg.id} className="text-center italic text-xs text-gray-500">
                                            <span className="bg-gray-100 px-3 py-1 rounded-full">{msg.content}</span>
                                        </div>
                                    ) : (
                                        <div key={msg.id} className={`flex ${msg.senderId === user.uid ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-xs md:max-w-md p-3 rounded-xl shadow-md ${msg.senderId === user.uid ? 'bg-brand-action text-white rounded-br-none' : 'bg-gray-100 text-brand-dark rounded-tl-none'}`}>
                                                {msg.senderId !== user.uid && (
                                                    <p className="font-bold text-sm mb-1" style={{ color: msg.isFounder ? '#C6A875' : '#4A5568' }}>{msg.senderName}</p>
                                                )}
                                                <p className="text-sm break-words">{msg.content}</p>
                                                <span className={`block text-xs mt-1 ${msg.senderId === user.uid ? 'text-gray-200' : 'text-gray-500'} text-right`}>
                                                    {msg.timestamp?.toDate().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                    )
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Chat */}
                        <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 flex gap-3 shrink-0">
                            <input
                                type="text"
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                placeholder="Scrivi un messaggio..."
                                className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-brand-action focus:border-brand-action"
                                disabled={localLoading || chatError} 
                                required
                            />
                            <button type="submit" disabled={!messageInput.trim() || localLoading || chatError} className="bg-brand-dark text-white p-3 rounded-lg font-bold hover:bg-brand-accent transition flex items-center gap-1 disabled:opacity-50">
                                {localLoading ? <Loader2 className="w-5 h-5 animate-spin"/> : <CornerDownLeft className="w-5 h-5"/>} Invia
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompanyDetails;