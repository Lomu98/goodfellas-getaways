import React from 'react';

const DateTimeInput = ({ label, valueIso, onChange, required }) => {
  const [d, t] = (valueIso || '').split('T');

  const handleChange = (newD, newT) => { 
    if (!newD && !newT) { 
        onChange(''); 
        return; 
    } 
    if (!newD) { 
        onChange(valueIso); 
        return;
    } 
    if (!newT) { 
        onChange(newD); 
    } else { 
        onChange(`${newD}T${newT}`); 
    } 
  };

  const handleDateChange = (e) => handleChange(e.target.value, t);
  const handleTimeChange = (e) => handleChange(d, e.target.value);

  return ( 
    <div>
        <label className="text-xs text-brand-secondary block mb-1">{label}</label>
        <div className="flex gap-1">
            <input 
              type="date" 
              value={d || ''} 
              onChange={handleDateChange} 
              className="w-2/3 p-2 border rounded text-sm" 
              required={required} 
            />
            <input 
              type="time" 
              value={t || ''} 
              onChange={handleTimeChange} 
              className="w-1/3 p-2 border rounded text-sm" 
            />
        </div>
    </div> 
  );
};

export default DateTimeInput;