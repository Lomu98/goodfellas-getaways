import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Send, CheckSquare, Square, Users, UserPlus } from 'lucide-react';
import { collection, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import Modal from './Modal';
import { appId } from '../lib/firebase';

// 💡 AGGIUNTO: Riceve myFriends e myCompanies da ProjectView
const InviteModal = ({ db, user, project, onClose, myFriends, myCompanies }) => {
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const [view, setView] = useState('friends'); // 'friends' o 'companies'
  const [loading, setLoading] = useState(false);
  
  const currentMembers = project.memberIds || [];
  
  // 💡 RIMOZIONE LISTENER OBSOLETO: Ora usiamo myFriends e myCompanies dalle props

  // 1. Filtra amici disponibili (non sono già membri)
  const availableFriends = useMemo(() => {
    return myFriends.filter(f => !currentMembers.includes(f.id));
  }, [myFriends, currentMembers]);

  // 2. Filtra compagnie che contengono almeno un membro non ancora nel progetto
  const availableCompanies = useMemo(() => {
    return myCompanies
        // Filtriamo le compagnie che hanno ALMENO UN membro non ancora nel progetto
        .filter(comp => comp.memberIds.some(memberId => !currentMembers.includes(memberId)))
        .map(comp => {
            // Aggiungiamo i membri target per facilitare l'invio
            const membersToInvite = comp.memberIds
                .filter(memberId => !currentMembers.includes(memberId))
                .map(memberId => myFriends.find(f => f.id === memberId))
                .filter(Boolean); // Rimuove gli amici non trovati in myFriends (dovrebbe essere raro)

            return {
                ...comp,
                membersToInvite: membersToInvite,
            };
        });
  }, [myCompanies, myFriends, currentMembers]);


  const toggleSelectFriend = (id) => { 
      setSelectedFriends(prev => 
          prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      );
  };
  
  const toggleSelectCompany = (id) => { 
      setSelectedCompanies(prev => 
          prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      );
  };

  const sendInvites = async () => { 
      if (selectedFriends.length === 0 && selectedCompanies.length === 0) return;
      setLoading(true); 
      
      const invitesToSend = [];
      const projectCreatorName = project.creatorName || 'N/A';
      
      // A. Inviti Amici Singoli
      selectedFriends.forEach(friendId => {
          const friend = availableFriends.find(f => f.id === friendId);
          if (friend) {
              invitesToSend.push({ toUserId: friendId, toUserName: friend.name });
          }
      });
      
      // B. Inviti Membri Compagnia
      selectedCompanies.forEach(companyId => {
          const company = availableCompanies.find(c => c.id === companyId);
          if (company) {
              company.membersToInvite.forEach(member => {
                  // Evita duplicati se l'amico è stato selezionato singolarmente E è in una compagnia
                  if (!selectedFriends.includes(member.id) && !invitesToSend.some(i => i.toUserId === member.id)) {
                      invitesToSend.push({ toUserId: member.id, toUserName: member.name });
                  }
              });
          }
      });
      
      try { 
          const batch = writeBatch(db); 
          
          invitesToSend.forEach(invite => { 
              const ref = doc(collection(db, 'artifacts', appId, 'public', 'data', 'invitations')); 
              batch.set(ref, { 
                  toUserId: invite.toUserId, 
                  toUserName: invite.toUserName, 
                  fromUserId: user.uid, 
                  fromUserName: user.userProfile?.name || projectCreatorName, // Usa il nome dell'utente loggato, non del creatore del progetto
                  projectId: project.id, 
                  projectName: project.name, 
                  status: 'pending', 
                  createdAt: serverTimestamp() 
              }); 
          }); 
          
          await batch.commit(); 
          alert(`Inviti inviati a ${invitesToSend.length} utenti!`); 
          onClose(); 
      } catch (e) { 
          console.error(e); 
          alert(e.message); 
      } 
      setLoading(false); 
  };

  const renderFriendList = () => (
    <div className="max-h-60 overflow-y-auto space-y-2 mb-6 p-1">
        {availableFriends.length === 0 ? <p className="text-center text-gray-500">Nessun amico disponibile per l'invito.</p> : availableFriends.map(f => (
            <div key={f.id} onClick={() => toggleSelectFriend(f.id)} className={`p-3 rounded-lg flex items-center justify-between cursor-pointer border ${selectedFriends.includes(f.id) ? 'bg-brand-action/10 border-brand-action' : 'bg-white border-gray-200 hover:border-brand-accent'}`}>
                <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-brand-dark text-brand-light flex items-center justify-center font-bold text-xs">{f.name.charAt(0)}</div><span className="font-medium">{f.name}</span></div>
                {selectedFriends.includes(f.id) ? <CheckSquare className="text-brand-action w-5 h-5" /> : <Square className="text-gray-300 w-5 h-5" />}
            </div>
        ))}
    </div>
  );

  const renderCompanyList = () => (
    <div className="max-h-60 overflow-y-auto space-y-2 mb-6 p-1">
        {availableCompanies.length === 0 ? <p className="text-center text-gray-500">Nessuna compagnia disponibile o tutti i membri sono già nel progetto.</p> : availableCompanies.map(c => (
            <div key={c.id} onClick={() => toggleSelectCompany(c.id)} className={`p-3 rounded-lg flex flex-col cursor-pointer border ${selectedCompanies.includes(c.id) ? 'bg-brand-action/10 border-brand-action' : 'bg-white border-gray-200 hover:border-brand-accent'}`}>
                <div className='flex justify-between items-center'>
                    <span className="font-bold text-lg flex items-center gap-2"><Users className='w-5 h-5'/> {c.name}</span>
                    {selectedCompanies.includes(c.id) ? <CheckSquare className="text-brand-action w-5 h-5" /> : <Square className="text-gray-300 w-5 h-5" />}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                    Inviterai: <span className='font-semibold'>{c.membersToInvite.map(m => m.name.split(' ')[0]).join(', ')}</span> ({c.membersToInvite.length} non-membri)
                </p>
            </div>
        ))}
    </div>
  );

  return ( 
    <Modal onClose={onClose} size="lg">
        <h2 className="text-2xl font-serif font-bold text-brand-dark mb-4">Invita in {project.name}</h2>
        
        {/* Tab Selector */}
        <div className="flex border-b border-gray-300 mb-4">
            <button 
                onClick={() => setView('friends')} 
                className={`py-2 px-4 font-bold flex items-center gap-2 ${view === 'friends' ? 'border-b-4 border-brand-action text-brand-dark' : 'text-brand-secondary'}`}
            >
                <UserPlus className="w-5 h-5"/> Amici ({availableFriends.length})
            </button>
            <button 
                onClick={() => setView('companies')} 
                className={`py-2 px-4 font-bold flex items-center gap-2 ${view === 'companies' ? 'border-b-4 border-brand-action text-brand-dark' : 'text-brand-secondary'}`}
            >
                <Users className="w-5 h-5"/> Compagnie ({availableCompanies.length})
            </button>
        </div>

        {view === 'friends' && renderFriendList()}
        {view === 'companies' && renderCompanyList()}
        
        <button 
            onClick={sendInvites} 
            disabled={loading || (selectedFriends.length === 0 && selectedCompanies.length === 0)} 
            className="w-full bg-brand-dark text-white py-3 rounded-lg font-bold flex justify-center gap-2 disabled:opacity-50"
        >
            {loading ? <Loader2 className="animate-spin"/> : <Send className="w-5 h-5" />} 
            Invia Inviti ({selectedFriends.length + availableCompanies.filter(c => selectedCompanies.includes(c.id)).reduce((sum, c) => sum + c.membersToInvite.length, 0)})
        </button>
    </Modal> 
  );
};

export default InviteModal;