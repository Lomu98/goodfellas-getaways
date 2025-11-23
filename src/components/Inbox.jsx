import React, { useState, useEffect } from 'react';
import { Mail, Check, X, Loader2 } from 'lucide-react';
import { collection, query, where, onSnapshot, writeBatch, doc, arrayUnion } from 'firebase/firestore';
import { appId } from '../lib/firebase';

const Inbox = ({ db, user }) => { 
  const [invites, setInvites] = useState([]); 
  
  useEffect(() => onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'invitations'), where('toUserId', '==', user.uid), where('status', '==', 'pending')), s => setInvites(s.docs.map(d => ({ id: d.id, ...d.data() })))), [db, user.uid]); 
  
  const handleResponse = async (invite, accept) => { 
      try { 
          const batch = writeBatch(db); 
          batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'invitations', invite.id), { status: accept ? 'accepted' : 'declined' }); 
          if (accept) { 
              const projectRef = doc(db, 'artifacts', appId, 'public', 'data', 'projects', invite.projectId); 
              batch.update(projectRef, { memberIds: arrayUnion(user.uid) }); 
              const participantRef = doc(db, 'artifacts', appId, 'public', 'data', 'projects', invite.projectId, 'participants', user.uid); 
              batch.set(participantRef, { name: user.email.split('@')[0] }, {merge: true}); 
          } 
          await batch.commit(); 
      } catch (e) { console.error(e); } 
  }; 
  
  if (invites.length === 0) return null; 
  
  return (
    <div className="mb-8 bg-white border-2 border-brand-accent/30 p-4 rounded-xl shadow-lg animate-slide-in">
        <h3 className="text-lg font-serif font-bold text-brand-dark mb-3 flex items-center gap-2"><Mail className="w-5 h-5 text-brand-action" /> Inviti Ricevuti</h3>
        <div className="space-y-3">
            {invites.map(inv => (
                <div key={inv.id} className="flex flex-col md:flex-row justify-between items-center bg-brand-light p-3 rounded-lg gap-3">
                    <div><p className="text-brand-dark"><span className="font-bold">{inv.fromUserName}</span> ti invita a <span className="font-bold text-brand-action">{inv.projectName}</span></p></div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <button onClick={() => handleResponse(inv, true)} className="flex-1 md:flex-none bg-green-600 text-white px-4 py-1.5 rounded font-bold hover:bg-green-700 flex justify-center items-center gap-1"><Check className="w-4 h-4"/> Accetta</button>
                        <button onClick={() => handleResponse(inv, false)} className="flex-1 md:flex-none bg-gray-300 text-gray-700 px-4 py-1.5 rounded font-bold hover:bg-gray-400 flex justify-center items-center gap-1"><X className="w-4 h-4"/> Rifiuta</button>
                    </div>
                </div>
            ))}
        </div>
    </div>
  ); 
};

export default Inbox;