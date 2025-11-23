import React from 'react';
import { Loader2 } from 'lucide-react';

const Loader = ({ text = "Caricamento..." }) => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-[#EFEBE0] fade-in">
    <Loader2 className="w-16 h-16 text-[#9B2C2C] animate-spin" />
    <p className="text-[#222A3A] font-serif text-xl mt-4">{text}</p>
  </div>
);

export default Loader;