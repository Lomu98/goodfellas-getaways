import React, { useState, useEffect } from 'react';
import { Plus, CheckSquare, Square, Trash2 } from 'lucide-react';
import { collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot, query, serverTimestamp } from 'firebase/firestore';

const TodoList = ({ projectRef, user, userProfile, readOnly }) => {
  const [todos, setTodos] = useState([]); 
  const [text, setText] = useState('');

  useEffect(() => onSnapshot(query(collection(projectRef, 'todos')), s => setTodos(s.docs.map(d=>({id:d.id, ...d.data()})))), [projectRef]);

  const add = async (e) => { 
      e.preventDefault(); 
      if(!text.trim()) return; 
      await addDoc(collection(projectRef, 'todos'), { 
          text, 
          completed: false, 
          createdBy: user.uid, 
          creatorName: userProfile.name, 
          createdAt: serverTimestamp() 
      }); 
      setText(''); 
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg">
        <h3 className="text-2xl font-serif font-bold text-brand-dark mb-4">To-Do</h3>
        {!readOnly && (
            <form onSubmit={add} className="flex gap-2 mb-4">
                <input value={text} onChange={e=>setText(e.target.value)} className="flex-1 p-2 border rounded" placeholder="Task..." />
                <button className="bg-brand-action text-white p-2 rounded"><Plus/></button>
            </form>
        )}
        <ul className="space-y-2">
            {todos.map(t => (
                <li key={t.id} className="flex justify-between items-center p-3 bg-brand-light rounded">
                    <div className="flex items-center gap-3">
                        <button disabled={readOnly} onClick={()=>updateDoc(doc(projectRef, 'todos', t.id), {completed: !t.completed})}>
                            {t.completed ? <CheckSquare className="text-brand-action"/> : <Square className="text-brand-secondary"/>}
                        </button>
                        <span className={t.completed?"line-through text-gray-500":""}>{t.text}</span>
                    </div>
                    {!readOnly && <button onClick={()=>deleteDoc(doc(projectRef, 'todos', t.id))} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>}
                </li>
            ))}
        </ul>
    </div>
  );
};

export default TodoList;