// App.jsx (已移除 Layers 狀態)

import { useCallback, useRef, useState } from 'react'
import { Terms } from './components/Terms'
import { QueryBuilder } from './components/QueryBuilder'
import { Studies } from './components/Studies'
import { NiiViewer } from './components/NiiViewer'
import { useUrlQueryState } from './hooks/useUrlQueryState'
import './App.css'

export default function App () {
  const [query, setQuery] = useUrlQueryState('q')
  const [history, setHistory] = useState([]);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false)
  const [search, setSearch] = useState('') 
  const [selectedLetter, setSelectedLetter] = useState(null); 

  // --- 【已移除 1/3】 'layers' state ---

  const handlePickTerm = useCallback((t) => {
    setQuery((q) => (q ? `${q} ${t}` : t))
  }, [setQuery])

  // --- 【修改 2/3】 handleResetQuery 恢復 ---
  const handleResetQuery = () => {
    if (query.trim()) {
      setHistory(prevHistory => {
        const newHistory = [query, ...prevHistory.filter(h => h !== query)];
        return newHistory.slice(0, 5);
      });
    }
    setQuery('');
    // 'setLayers([])' 已移除
  };

  // --- (Search 相關邏輯保持不變) ---
  const handleLetterClick = (letter) => {
    setSearch('');
    setSelectedLetter(prev => (prev === letter ? null : letter));
  }
  const handleSearchChange = (e) => {
    setSelectedLetter(null);
    setSearch(e.target.value);
  }
  
  // --- 【已移除 3/3】 'handleToggleLayer' 函式 ---
  
  // --- (resizable panes state 保持不變) ---
  const gridRef = useRef(null) 
  const [sizes, setSizes] = useState([28, 44, 28])
  const MIN_PX = 240
  const startDrag = (which, e) => {
    e.preventDefault()
    const startX = e.clientX
    const rect = gridRef.current.getBoundingClientRect()
    const total = rect.width
    const curPx = sizes.map(p => (p / 100) * total)
    const onMouseMove = (ev) => {
      const dx = ev.clientX - startX
      if (which === 0) {
        let newLeft = curPx[0] + dx
        let newMid = curPx[1] - dx
        if (newLeft < MIN_PX) { newMid -= (MIN_PX - newLeft); newLeft = MIN_PX }
        if (newMid < MIN_PX) { newLeft -= (MIN_PX - newMid); newMid = MIN_PX }
        const s0 = (newLeft / total) * 100
        const s1 = (newMid / total) * 100
        const s2 = 100 - s0 - s1
        setSizes([s0, s1, Math.max(s2, 0)])
      } else {
        let newMid = curPx[1] + dx
        let newRight = curPx[2] - dx
        if (newMid < MIN_PX) { newRight -= (MIN_PX - newMid); newMid = MIN_PX }
        if (newRight < MIN_PX) { newMid -= (MIN_PX - newRight); newRight = MIN_PX }
        const s1 = (newMid / total) * 100
        const s2 = (newRight / total) * 100
        const s0 = (curPx[0] / total) * 100
        setSizes([s0, s1, Math.max(s2, 0)])
      }
    }
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  // --- (漢堡按鈕樣式保持不變) ---
  const hamburgerStyle = {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '6px',
    color: 'var(--fg)',
    marginBottom: '12px',
  };

  return (
    <div 
      className={`app ${isLeftCollapsed ? 'app--sidebar-collapsed' : ''}`}
      ref={gridRef} 
      style={{ position: 'relative' }}
    >
      {/* <style> 標籤內容保持不變... */}
      <style>{`
        :root {
          --primary-600: #2563eb;
          --border: #e5e7eb;
          --sidebar-collapsed-width: 72px; /* 圖標寬度 */
        }
        .app { display: flex; padding: 0 !important; height: 100vh; overflow: hidden; }
        .app__sidebar {
          flex-shrink: 0;
          transition: flex-basis 0.2s ease, min-width 0.2s ease, padding 0.2s ease, border 0.2s ease;
          display: flex !important;
          flex-direction: column !important;
          height: 100vh;
          box-sizing: border-box;
          padding: 18px 12px 12px 18px !important; 
          align-items: flex-start !important;
        }
        .app__main-wrapper {
          flex-grow: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        .app__main-wrapper .app__header {
          width: 100%;
          padding: 18px 18px 0 18px; 
          min-height: 58px; 
          flex-shrink: 0;
        }
        .app__main-wrapper .app__grid {
          flex-grow: 1;
          padding: 14px 18px 18px 18px;
          gap: 0;
          display: flex; 
          min-height: 0; 
        }
        .app--sidebar-collapsed .app__sidebar {
          flex-basis: var(--sidebar-collapsed-width) !important;
          min-width: var(--sidebar-collapsed-width) !important;
          padding: 18px 12px !important; 
          overflow: hidden;
          align-items: center !important; 
        }
        .app--sidebar-collapsed .app__sidebar-resizer { display: none; }
        .app--sidebar-collapsed .hamburger-btn {
           align-self: auto !important; 
           margin: 0 auto 24px auto !important;
        }
        .sidebar__top-row {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          margin-bottom: 12px;
        }
        .sidebar__top-row .terms__controls {
          display: flex;
          gap: 8px;
          flex: 1;
        }
        .sidebar__top-row .terms__controls input {
          width: 100%;
          display: block;
          padding: 8px 12px;
          border: 1px solid var(--border);
          border-radius: 12px;
          outline: none;
        }
        .sidebar__top-row .terms__controls input:focus { box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.25); }
        .app__grid { width: 100%; max-width: 100%; }
        .card input[type="text"], .card input[type="search"], .card input[type="number"], .card select, .card textarea { width: 100% !important; max-width: 100% !important; display: block; }
        
        .card button, .card [role="button"], .card .btn, .card .button {
          font-size: 12px !important; padding: 4px 8px !important; border-radius: 8px !important; line-height: 1.2 !important; background: var(--primary-600) !important; color: #fff !important; border: none !important;
        }
        .card button:hover, .card button:active, .card [role="button"]:hover, .card [role="button"]:active, .card .btn:hover, .card .btn:active, .card .button:hover, .card .button:active {
          background: var(--primary-600) !important; color: #fff !important;
        }
        
        #root .app__sidebar .btn.btn--primary {
           background: var(--primary-600) !important; color: #fff !important; border: none !important; font-size: 12px !important; padding: 8px 12px !important; border-radius: 8px !important;
        }
        #root .app__sidebar button.hamburger-btn {
           background: transparent !important; color: var(--fg) !important; border: none !important; transition: background .2s ease;
        }
        #root .app__sidebar button.hamburger-btn:hover { background: #f3f4f6 !important; }
        #root .app__sidebar button.term-button {
           background: transparent !important; color: var(--fg) !important; border: none !important; font-weight: 500 !important; font-size: 14px !important; display: flex !important; justify-content: flex-start !important; padding: 3px 6px !important; line-height: 1.2 !important;
        }
        #root .app__sidebar button.term-button:hover,
        #root .app__sidebar button.term-button:active { 
           background: #f3f4f6 !important; 
           color: var(--primary-600) !important;
        }
      `}</style>

      {/* 側邊欄 (Terms) */}
      <section 
        className="card app__sidebar" 
        style={{ flexBasis: `${sizes[0]}%` }}
      >
        <div className="sidebar__top-row">
          <button 
            onClick={() => setIsLeftCollapsed(c => !c)} 
            title="Toggle sidebar" 
            style={hamburgerStyle}
            className="hamburger-btn"
            type="button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          
          <div 
            className='terms__controls'
            style={{ visibility: isLeftCollapsed ? 'hidden' : 'visible' }}
          >
            <input
              value={search}
              onChange={handleSearchChange}
              placeholder='Search terms…'
              className='input'
            />
            <button
              onClick={() => setSearch('')}
              className='btn btn--primary'
              type="button"
            >
              Clear
            </button>
          </div>
        </div>
        
        <Terms 
          onPickTerm={handlePickTerm} 
          isCollapsed={isLeftCollapsed}
          history={history}
          search={search}
          selectedLetter={selectedLetter}
          onLetterClick={handleLetterClick}
        />
      </section>

      {/* 拖曳條 1 (保持不變) */}
      <div 
        className="resizer app__sidebar-resizer" 
        aria-label="Resize left/middle" 
        onMouseDown={(e) => startDrag(0, e)} 
      />
      
      {/* 主內容包裝 (Header + Main Grid) */}
      <div className="app__main-wrapper">
        
        <header 
          className="app__header" 
        >
          <div>
            <h1 className="app__title">LoTUS-BF</h1>
            <div className="app__subtitle">Location-or-Term Unified Search for Brain Functions</div>
          </div>
        </header>

        <main className="app__grid" style={{ minHeight: 0 }}>
          
          <section 
            className="card card--stack" 
            style={{ 
              flexBasis: `${sizes[1]}%`, 
              display: 'flex', 
              flexDirection: 'column',
              minHeight: 0 
            }}
          >
            <QueryBuilder 
              query={query} 
              setQuery={setQuery} 
              onResetQuery={handleResetQuery} 
            />
            <div className="divider" />
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {/* --- 【已還原】--- */}
              {/* 移除 'activeLayers' 和 'onToggleLayer' props */}
              <Studies 
                query={query} 
              />
            </div>
          </section>

          <div className="resizer" aria-label="Resize middle/right" onMouseDown={(e) => startDrag(1, e)} />

          <section 
            className="card" 
            style={{ 
              flexBasis: `${sizes[2]}%`, 
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0
            }}
          >
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              
              {/* --- 【已還原】--- */}
              {/* 移除 'layers' prop */}
              <NiiViewer 
                query={query} 
              />
            </div>
          </section>
        </main>
      </div> 
    </div>
  )
}