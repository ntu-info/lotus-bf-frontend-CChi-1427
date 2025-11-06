// components/Terms.jsx (已加入 SVG 圖標)
import { API_BASE } from '../api'
import { useEffect, useMemo, useState } from 'react'
import './Terms.css' 

// (A-Z 分組函式保持不變)
const groupAndSortTerms = (terms) => {
  const sortedTerms = [...terms].sort((a, b) => a.localeCompare(b));
  const grouped = sortedTerms.reduce((acc, term) => {
    const firstChar = term[0]?.toUpperCase();
    const letter = firstChar?.match(/[A-Z]/) ? firstChar : '#';
    if (!acc[letter]) {
      acc[letter] = [];
    }
    acc[letter].push(term);
    return acc;
  }, {});
  return grouped;
};

export function Terms ({ 
  onPickTerm, 
  isCollapsed, 
  history = [], 
  search, 
  selectedLetter, 
  onLetterClick 
}) {
  
  const [terms, setTerms] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  // (資料載入 useEffect 保持不變)
  useEffect(() => {
    let alive = true
    const ac = new AbortController()
    const load = async () => {
      setLoading(true)
      setErr('')
      try {
        const res = await fetch(`${API_BASE}/terms`, { signal: ac.signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!alive) return
        setTerms(Array.isArray(data?.terms) ? data.terms : [])
      } catch (e) {
        if (!alive) return
        setErr(`Failed to fetch terms: ${e?.message || e}`)
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false; ac.abort() }
  }, [])

  // (useMemo 邏輯保持不變)
  const filteredTerms = useMemo(() => {
    const s = search.trim().toLowerCase() 
    if (!s) return [];
    return terms.filter(t => t.toLowerCase().includes(s))
  }, [terms, search])

  const allGroupedTerms = useMemo(() => {
    return groupAndSortTerms(terms);
  }, [terms]);
  
  const allSortedLetters = Object.keys(allGroupedTerms).sort();
  
  const termsToShow = useMemo(() => {
    const s = search.trim();
    if (s) {
      return filteredTerms;
    }
    if (selectedLetter) {
      return allGroupedTerms[selectedLetter] || [];
    }
    return [];
  }, [search, selectedLetter, filteredTerms, allGroupedTerms]);

  const isSearching = search.trim().length > 0;

  return (
    <div 
      className='terms' 
      style={{ 
        flex: 1, 
        minHeight: 0,
        display: 'flex', 
        flexDirection: 'column',
        visibility: isCollapsed ? 'hidden' : 'visible',
        width: '100%' 
      }}
    >
      
      {/* 搜尋列 JSX (位於 App.jsx) */}

      {loading && (
        <div className='terms__skeleton'>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className='terms__skeleton-row' />
          ))}
        </div>
      )}
      {err && (
        <div className='alert alert--error'>
          {err}
        </div>
      )}

      {!loading && !err && (
        <div className='terms-container terms__list' style={{ flexGrow: 1, overflowY: 'auto' }}>
          
          <div className="terms__section">
            {/* --- 【圖標 1/2】--- */}
            <h3 className="terms__section-title">
              {/* History 圖標 (時鐘) */}
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              History
            </h3>
            <div className="term-list">
              {history.length === 0 ? (
                <span className="terms__empty-history">No history yet.</span>
              ) : (
                history.map((histTerm) => (
                  <button 
                    key={histTerm}
                    className="term-button" 
                    onClick={(e) => { e.preventDefault(); onPickTerm?.(histTerm); }}
                    title={`Run query: ${histTerm}`}
                    type="button"
                  >
                    {histTerm}
                  </button>
                ))
              )}
            </div>
          </div>
          
          <div className="terms__section">
            {/* --- 【圖標 2/2】--- */}
            <h3 className="terms__section-title">
              {/* Terms 圖標 (書籤) */}
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
              </svg>
              Terms
            </h3>
            
            {!isSearching && (
              <div className="letter-toolbar">
                {allSortedLetters.map((letter) => (
                  <button
                    key={letter}
                    className={`letter-chip ${selectedLetter === letter ? 'is-active' : ''}`}
                    onClick={() => onLetterClick(letter)}
                    type="button"
                  >
                    {letter}
                  </button>
                ))}
              </div>
            )}

            <div className="term-list">
              {termsToShow.length === 0 && search.trim() && (
                 <div className='terms__empty'>No terms found</div>
              )}
              {termsToShow.length === 0 && !search.trim() && !selectedLetter && (
                 <div className='terms__empty'>Select a letter or search</div>
              )}
              {termsToShow.map((term) => (
                <button 
                  key={term} 
                  onClick={(e) => { e.preventDefault(); onPickTerm?.(term); }}
                  className="term-button"
                  title={term}
                  type="button"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}