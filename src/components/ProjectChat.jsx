import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, CornerDownLeft, Loader2, Send, X } from 'lucide-react'; 
import { collection, query, onSnapshot, addDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { getSimpleTime } from '../utils/dateUtils'; // Assicurati di avere questa utility
import Loader from './Loader';

const ProjectChat = ({ project, projectRef, user, userProfile, isCreator }) => {
    const [messages, setMessages] = useState([]);
    const [messageInput, setMessageInput] = useState('');
    const [loadingMessages, setLoadingMessages] = useState(true);
    const [sendingMessage, setSendingMessage] = useState(false);
    const [chatError, setChatError] = useState(null); 
    const messagesEndRef = useRef(null);
    
    // --- LISTENER 1: Chat in Tempo Reale ---
    useEffect(() => {
        setLoadingMessages(true);
        setChatError(null);

        // La sottocollezione è 'chats' all'interno del documento del progetto
        const q = query(
            collection(projectRef, 'chats'),
            orderBy('timestamp', 'asc'),
            limit(50)
        );
        
        const unsub = onSnapshot(q, s => {
            const newMessages = s.docs.map(d => ({ 
                id: d.id, 
                ...d.data(),
                isCreator: d.data().senderId === project.createdBy 
            }));
            setMessages(newMessages);
            setLoadingMessages(false);
            // Scrolla in basso
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100); 
        }, (error) => {
             console.error("Firebase Project Chat Listener Error:", error);
             setChatError("Impossibile caricare la chat. Controlla le regole di Firestore per la sottocollezione 'chats'.");
             setLoadingMessages(false);
        });
        return unsub;
    }, [projectRef, project.createdBy]);

    // Funzione interna per inviare messaggi di sistema (utile in futuro)
    const sendSystemMessage = async (content) => {
        await addDoc(collection(projectRef, 'chats'), {
            projectId: project.id,
            senderId: 'SYSTEM', 
            senderName: 'SYSTEM',
            content: content,
            timestamp: serverTimestamp(),
        });
    }

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!messageInput.trim() || sendingMessage) return;

        setSendingMessage(true);
        try {
            await addDoc(collection(projectRef, 'chats'), {
                projectId: project.id,
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
            setSendingMessage(false);
        }
    };


    return (
        <div className="md:w-full flex flex-col bg-white rounded-xl shadow-lg border border-gray-200 h-[70vh] overflow-hidden">
            <h3 className="font-bold text-xl text-brand-dark p-4 border-b flex items-center gap-2 shrink-0"><MessageSquare className="w-5 h-5 text-brand-secondary"/> Chat di Gruppo per "{project.name}"</h3>
            
            {/* Area Messaggi */}
            <div className="flex-1 p-4 space-y-4 overflow-y-auto custom-scroll">
                {loadingMessages ? (
                    <div className="text-center py-12"><Loader2 className="animate-spin mx-auto w-8 h-8 text-brand-action"/></div>
                ) : chatError ? (
                     <div className="text-center py-12 text-red-600 border border-red-300 p-4 rounded-lg bg-red-50">
                        <p className="font-bold">Errore Chat:</p>
                        <p className="text-sm">{chatError}</p>
                        <p className="text-xs italic mt-2">Verifica le regole di sicurezza in Firestore per la sottocollezione 'chats' di questo progetto.</p>
                     </div>
                ) : messages.length === 0 ? (
                    <p className="text-center text-gray-500 italic py-12">Inizia la conversazione! Solo i partecipanti possono scrivere.</p>
                ) : (
                    messages.map(msg => (
                        msg.senderId === 'SYSTEM' ? (
                            <div key={msg.id} className="text-center italic text-xs text-gray-500">
                                <span className="bg-gray-100 px-3 py-1 rounded-full">{msg.content}</span>
                            </div>
                        ) : (
                            <div key={msg.id} className={`flex ${msg.senderId === user.uid ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-xs md:max-w-md p-3 rounded-xl shadow-md ${msg.senderId === user.uid ? 'bg-brand-action text-white rounded-br-none' : 'bg-gray-100 text-brand-dark rounded-tl-none'}`}>
                                    {msg.senderId !== user.uid && (
                                        <p className="font-bold text-sm mb-1" style={{ color: msg.isCreator ? '#C6A875' : '#4A5568' }}>
                                            {msg.senderName} {msg.isCreator && "(Creatore)"}
                                        </p>
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
                    disabled={sendingMessage || chatError} 
                    required
                />
                <button type="submit" disabled={!messageInput.trim() || sendingMessage || chatError} className="bg-brand-dark text-white p-3 rounded-lg font-bold hover:bg-brand-accent transition flex items-center gap-1 disabled:opacity-50">
                    {sendingMessage ? <Loader2 className="w-5 h-5 animate-spin"/> : <Send className="w-5 h-5"/>} Invia
                </button>
            </form>
        </div>
    );
};

export default ProjectChat;