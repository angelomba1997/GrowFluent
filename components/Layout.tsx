
import React from 'react';
import { Language } from '../types';
import { uiTranslations } from '../translations';

interface LayoutProps {
  children: React.ReactNode;
  onManageKey: () => void;
  currentLang: Language;
}

const Layout: React.FC<LayoutProps> = ({ children, onManageKey, currentLang }) => {
  const t = uiTranslations[currentLang];

  const getLangBadge = () => {
    switch(currentLang) {
      case Language.ENGLISH: return 'EN';
      case Language.CATALAN: return 'CA';
      case Language.FRENCH: return 'FR';
      default: return 'EN';
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
              <i className="fas fa-language text-white text-xl"></i>
            </div>
            <div>
              <h1 className="text-lg font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 leading-none">
                Polyglot Lab
              </h1>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">AI Language Tutor</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button 
              onClick={onManageKey}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-slate-200"
              title={t.switchKey}
            >
              <i className="fas fa-key text-xs"></i>
              <span className="text-[10px] font-black uppercase tracking-tight hidden sm:inline">{t.myKey}</span>
            </button>
            <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter hidden sm:block">
              ES <i className="fas fa-arrow-right mx-1 text-[8px] text-indigo-300"></i> {getLangBadge()}
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-6 pb-24">
        {children}
      </main>
    </div>
  );
};

export default Layout;
