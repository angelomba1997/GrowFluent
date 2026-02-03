
import React, { useState } from 'react';
import { Language } from '../types';
import { uiTranslations } from '../translations';

interface PhraseInputProps {
  onAdd: (phrase: string) => void;
  isLoading: boolean;
  currentLang: Language;
}

const PhraseInput: React.FC<PhraseInputProps> = ({ onAdd, isLoading, currentLang }) => {
  const [input, setInput] = useState('');
  const t = uiTranslations[currentLang];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onAdd(input.trim());
      setInput('');
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border p-6 mb-8">
      <h2 className="text-lg font-semibold mb-4 flex items-center">
        <i className="fas fa-plus-circle text-indigo-500 mr-2"></i>
        {t.newWordIn}
      </h2>
      <form onSubmit={handleSubmit} className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
          placeholder={t.writePhrase}
          className="w-full pl-4 pr-12 py-3 rounded-xl border-2 border-slate-100 focus:border-indigo-500 focus:ring-0 outline-none transition-all"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="absolute right-2 top-2 w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 disabled:bg-slate-300 transition-colors"
        >
          {isLoading ? (
            <i className="fas fa-spinner fa-spin text-sm"></i>
          ) : (
            <i className="fas fa-search text-sm"></i>
          )}
        </button>
      </form>
      <p className="mt-2 text-xs text-slate-400">
        {currentLang === Language.ENGLISH ? 'e.g., "Stunning" or "I am looking for..." ' : 'p. ex., "Vull anar a la platja"'}
      </p>
    </div>
  );
};

export default PhraseInput;
