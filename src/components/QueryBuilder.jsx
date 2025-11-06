// components/QueryBuilder.jsx (已修正按鈕換行)

export function QueryBuilder({ query, setQuery, onResetQuery }) {
  const append = (token) => setQuery((q) => (q ? `${q} ${token}` : token));

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setQuery(e.currentTarget.value);
    }
  };

  return (
    <div className="flex flex-col gap-3 qb">
      <div className="flex items-center">
        <div className="card__title">Query Builder</div>
      </div>

      {/* Input 和 Reset 按鈕 (保持不變) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Create a query here, e.g.: [-22,-4,18] NOT emotion"
          className="qb__input w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring"
          style={{ width: "100%", flex: 1 }}
        />
        <button
          onClick={onResetQuery}
          className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
          type="button"
        >
          Reset
        </button>
      </div>
      
      {/* --- 【已修正】--- */}
      {/* 確保 'flex-wrap' (允許換行) 存在 */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: 'AND', onClick: () => append('AND') },
          { label: 'OR', onClick: () => append('OR') },
          { label: 'NOT', onClick: () => append('NOT') },
          { label: '(', onClick: () => append('(') },
          { label: ')', onClick: () => append(')') },
        ].map((b) => (
          <button
            key={b.label}
            onClick={b.onClick}
            className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
            type="button"
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}