import React, { useState } from 'react';

const CreateProfileScreen = ({ onSubmit }) => {
  const [name, setName] = useState('');
  return (
    <div className="flex items-center justify-center min-h-screen bg-brand-light p-4">
        <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-xl text-center">
            <h1 className="text-2xl font-serif font-bold mb-4">Benvenuto!</h1>
            <p className="mb-4 text-gray-600">Come vuoi essere chiamato nel gruppo?</p>
            <form onSubmit={e => {e.preventDefault(); if(name.trim()) onSubmit(name.trim());}}>
                <input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Nome visualizzato" className="w-full p-3 border rounded-lg mb-4" autoFocus />
                <button className="w-full bg-brand-action text-white py-3 rounded-lg font-bold">Salva Profilo</button>
            </form>
        </div>
    </div>
  );
};
export default CreateProfileScreen;