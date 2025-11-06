// components/Studies.jsx (已還原)

import { API_BASE } from '../api'
import { useEffect, useMemo, useState } from 'react'

// (輔助函式已移除)

// --- 【已還原】---
// 移除 'onToggleLayer' 和 'activeLayers' props
export function Studies ({ query }) {
  // (State 保持不變)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [sortKey, setSortKey] = useState('year')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const pageSize = 20

  // (useEffect 邏輯保持不變)
  useEffect(() => { setPage(1) }, [query])
  useEffect(() => {
    if (!query) return
    let alive = true
    const ac = new AbortController()
    ;(async () => {
      setLoading(true)
      setErr('')
      try {
        const url = `${API_BASE}/query/${encodeURIComponent(query)}/studies`
        const res = await fetch(url, { signal: ac.signal })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
        if (!alive) return
        const list = Array.isArray(data?.results) ? data.results : []
        setRows(list)
      } catch (e) {
        if (!alive) return
        setErr(`Unable to fetch studies: ${e?.message || e}`)
        setRows([])
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false; ac.abort() }
  }, [query])

  // (排序邏輯 useMemo 保持不變)
  const sorted = useMemo(() => {
    const arr = [...rows]
    const dir = sortDir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      const A = a?.[sortKey]
      const B = b?.[sortKey]
      if (sortKey === 'year') return (Number(A || 0) - Number(B || 0)) * dir
      return String(A || '').localeCompare(String(B || ''), 'en') * dir
    })
    return arr
  }, [rows, sortKey, sortDir])

  // (分頁邏輯保持不變)
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className='flex flex-col rounded-2xl border' style={{ minHeight: 0 }}>
      
      {/* 卡片佈局的 CSS */}
      <style>{`
        .study-card-list {
          padding: 0 12px 12px 12px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .study-card {
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 12px 16px;
          box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.05);
          transition: all 0.15s ease;
        }
        .study-card:hover {
          border-color: #bfdbfe; 
          box-shadow: 0 4px 12px 0 rgb(0 0 0 / 0.07);
        }
        .study-card__meta-top { font-size: 13px; color: var(--muted); display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
        .study-card__title { font-size: 16px; font-weight: 600; color: var(--fg); margin: 0; line-height: 1.4; }
        .study-card__authors { font-size: 13px; color: #374151; margin-top: 8px; }
        .study-card__meta-bottom { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); }
        .study-card__meta-bottom > div { display: flex; flex-direction: column; }
        .study-card__label { font-size: 11px; color: var(--muted); font-weight: 500; letter-spacing: 0.5px; text-transform: uppercase; }
        .study-card__value { font-size: 13px; color: var(--fg); font-weight: 600; }
        .study-card__pubmed-link { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--primary-600); text-decoration: none; border-radius: 6px; padding: 4px 8px; margin: -4px -8px; }
        .study-card__pubmed-link:hover { background-color: #eff6ff; text-decoration: underline; }
        .study-card__pubmed-link svg { width: 14px; height: 14px; stroke-width: 2.5; }
        
        #root .card--stack .single-sort-btn {
          display: inline-flex !important;
          align-items: center !important;
          background: transparent !important; 
          border: 1px solid var(--border) !important;
          color: var(--fg) !important;
          padding: 6px !important; 
          border-radius: 8px !important;
          cursor: pointer;
          transition: background-color 0.15s ease, border-color 0.15s ease;
          line-height: 1 !important;
        }
        #root .card--stack .single-sort-btn svg {
          width: 14px;
          height: 14px;
          stroke-width: 2.5;
          color: var(--muted);
        }
        #root .card--stack .single-sort-btn:hover {
          background: #f3f4f6 !important; 
          border-color: #9ca3af !important;
          color: var(--fg) !important;
        }

        /* --- 【已移除】 .layer-toggle-btn 樣式 --- */

      `}</style>
      
      {/* 標頭 (使用 style 強制並排) */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '12px' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className='card__title' style={{ marginBottom: 0 }}>Studies</div>
          {!loading && !err && rows.length > 0 && (
            <button 
              onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
              className="single-sort-btn"
              title={sortDir === 'asc' ? "Sort by Year (Newest first)" : "Sort by Year (Oldest first)"}
              type="button"
            >
              {sortDir === 'asc' ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>

      {/* (Loading 和 Error 狀態保持不變) */}
      {query && loading && (
        <div className='grid gap-3 p-3'>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className='h-24 animate-pulse rounded-lg bg-gray-100' />
          ))}
        </div>
      )}
      {query && err && (
        <div className='mx-3 mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700'>
          {err}
        </div>
      )}

      {/* 卡片列表渲染 */}
      {query && !loading && !err && (
        <div className='study-card-list'>
          {pageRows.length === 0 ? (
            <div className='px-1 py-4 text-gray-500'>No studies found.</div>
          ) : (
            pageRows.map((r, i) => (
              <div className="study-card" key={r.study_id || i}>
                <div className="study-card__meta-top">
                  <span>{r.year}</span>
                  <span>•</span>
                  <span>{r.journal}</span>
                </div>
                
                <h3 className="study-card__title">{r.title}</h3>

                <div className="study-card__authors">{r.authors}</div>
                
                {r.study_id && (
                  <div className="study-card__meta-bottom">
                    <div>
                      <span className="study-card__label">STUDY ID</span>
                      <span className="study-card__value">{r.study_id}</span>
                    </div>

                    {/* --- 【已還原】--- */}
                    {/* 移除了按鈕容器和 "+ 比較" 按鈕 */}
                    <a 
                      href={`https://pubmed.ncbi.nlm.nih.gov/${r.study_id}/`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="study-card__pubmed-link"
                    >
                      於 PubMed 開啟 
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                      </svg>
                    </a>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* (分頁按鈕保持不變) */}
      {query && !loading && !err && (
        <div className='flex items-center justify-between border-t p-3 text-sm'>
          <div>Total <b>{sorted.length}</b> records, page <b>{page}</b>/<b>{totalPages}</b></div>
          <div className='flex items-center gap-2'>
            <button disabled={page <= 1} onClick={() => setPage(1)} className='rounded-lg border px-2 py-1 disabled:opacity-40'>⏮</button>
            <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className='rounded-lg border px-2 py-1 disabled:opacity-40'>Previous</button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className='rounded-lg border px-2 py-1 disabled:opacity-40'>Next</button>
            <button disabled={page >= totalPages} onClick={() => setPage(totalPages)} className='rounded-lg border px-2 py-1 disabled:opacity-40'>⏭</button>
          </div>
        </div>
      )}
    </div>
  )
}