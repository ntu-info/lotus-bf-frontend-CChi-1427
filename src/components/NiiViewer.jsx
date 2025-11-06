// components/NiiViewer.jsx (已修正 select 高度，不影響 number input)

const X_RIGHT_ON_SCREEN_RIGHT = true;

import { useEffect, useMemo, useRef, useState } from 'react'
import * as nifti from 'nifti-reader-js'
import { API_BASE } from '../api'

const MNI_BG_URL = 'static/mni_2mm.nii.gz'

// --- 輔助函式 (移至頂部) ---
function isStandardMNI2mm(dims, voxelMM) {
  const okDims = Array.isArray(dims) && dims[0]===91 && dims[1]===109 && dims[2]===91;
  const okSp   = voxelMM && Math.abs(voxelMM[0]-2)<1e-3 && Math.abs(voxelMM[1]-2)<1e-3 && Math.abs(voxelMM[2]-2)<1e-3;
  return okDims && okSp;
}
const MNI2MM = { x0: 90, y0: -126, z0: -72, vx: 2, vy: 2, vz: 2 };
function asTypedArray (header, buffer) {
  switch (header.datatypeCode) {
    case nifti.NIFTI1.TYPE_INT8:    return new Int8Array(buffer)
    case nifti.NIFTI1.TYPE_UINT8:   return new Uint8Array(buffer)
    case nifti.NIFTI1.TYPE_INT16:   return new Int16Array(buffer)
    case nifti.NIFTI1.TYPE_UINT16:  return new Uint16Array(buffer)
    case nifti.NIFTI1.TYPE_INT32:   return new Int32Array(buffer)
    case nifti.NIFTI1.TYPE_UINT32:  return new Uint32Array(buffer)
    case nifti.NIFTI1.TYPE_FLOAT32: return new Float32Array(buffer)
    case nifti.NIFTI1.TYPE_FLOAT64: return new Float64Array(buffer)
    default: return new Float32Array(buffer)
  }
}
function minmax (arr) {
  let mn =  Infinity, mx = -Infinity
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i]
    if (v < mn) mn = v
    if (v > mx) mx = v
  }
  return [mn, mx]
}
function percentile(arr, p, step=Math.ceil(arr.length/200000)) {
  if (!arr.length) return 0
  const samp = []
  for (let i=0; i<arr.length; i+=step) samp.push(arr[i])
  samp.sort((a,b)=>a-b)
  const k = Math.floor((p/100) * (samp.length - 1))
  return samp[Math.max(0, Math.min(samp.length-1, k))]
}
async function loadNifti(url) {
  const res = await fetch(url)
  if (!res.ok) {
    const t = await res.text().catch(()=> '')
    throw new Error(`GET ${url} → ${res.status} ${t}`)
  }
  let ab = await res.arrayBuffer()
  if (nifti.isCompressed(ab)) ab = nifti.decompress(ab)
  if (!nifti.isNIFTI(ab)) throw new Error('not a NIfTI file')
  const header = nifti.readHeader(ab)
  const image  = nifti.readImage(header, ab)
  const ta     = asTypedArray(header, image)
  let f32
  if (ta instanceof Float32Array) f32 = ta
  else if (ta instanceof Float64Array) f32 = Float32Array.from(ta)
  else {
    const [mn, mx] = minmax(ta)
    const range = (mx - mn) || 1
    f32 = new Float32Array(ta.length)
    for (let i=0;i<ta.length;i++) f32[i] = (ta[i] - mn) / range
  }
  const nx = header.dims[1] | 0
  const ny = header.dims[2] | 0
  const nz = header.dims[3] | 0
  if (!nx || !ny || !nz) throw new Error('invalid dims')
  const [mn, mx] = minmax(f32)
  const vx = Math.abs(header.pixDims?.[1] ?? 1)
  const vy = Math.abs(header.pixDims?.[2] ?? 1)
  const vz = Math.abs(header.pixDims?.[3] ?? 1)
  return { data: f32, dims:[nx,ny,nz], voxelMM:[vx,vy,vz], min: mn, max: mx }
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))


// (props 保持不變)
export function NiiViewer({ query }) {
  // (State 保持不變)
  const [loadingBG, setLoadingBG] = useState(false)
  const [loadingMap, setLoadingMap] = useState(false)
  const [errBG, setErrBG] = useState('')
  const [errMap, setErrMap] = useState('')
  const [voxel, setVoxel] = useState(2.0)
  const [fwhm, setFwhm] = useState(10.0)
  const [kernel, setKernel] = useState('gauss')
  const [r, setR] = useState(6.0)
  const [overlayAlpha, setOverlayAlpha] = useState(0.5)
  const [posOnly, setPosOnly] = useState(true)
  const [useAbs, setUseAbs] = useState(false)
  const [thrMode, setThrMode] = useState('pctl')
  const [pctl, setPctl] = useState(95)
  const [thrValue, setThrValue] = useState(0)
  const bgRef  = useRef(null)
  const mapRef = useRef(null)
  const getVoxelMM = () => {
    const vm = bgRef.current?.voxelMM ?? mapRef.current?.voxelMM ?? [1,1,1]
    return { x: vm[0], y: vm[1], z: vm[2] }
  }
  const [dims, setDims] = useState([0,0,0])
  const [ix, setIx] = useState(0)
  const [iy, setIy] = useState(0)
  const [iz, setIz] = useState(0)
  const [cx, setCx] = useState('0')
  const [cy, setCy] = useState('0')
  const [cz, setCz] = useState('0')
  const canvases = [useRef(null), useRef(null), useRef(null)]

  // (mapUrl 保持不變)
  const mapUrl = useMemo(() => {
    if (!query) return ''
    const u = new URL(`${API_BASE}/query/${encodeURIComponent(query)}/nii`)
    u.searchParams.set('voxel', String(voxel))
    u.searchParams.set('fwhm', String(fwhm))
    u.searchParams.set('kernel', String(kernel))
    u.searchParams.set('r', String(r))
    return u.toString()
  }, [query, voxel, fwhm, kernel, r])
  
  // (idx2coord, coord2idx 保持不變)
  const AXIS_SIGN = { x: -1, y: 1, z: 1 }
  const idx2coord = (i, n, axis) => {
    const [nx, ny, nz] = dims;
    const { x: vx, y: vy, z: vz } = getVoxelMM();
    const isStd = isStandardMNI2mm([nx, ny, nz], [vx, vy, vz]);
    if (isStd) {
      if (axis === 'x') return (-MNI2MM.vx * i + MNI2MM.x0);
      if (axis === 'y') return ( MNI2MM.vy * i + MNI2MM.y0);
      if (axis === 'z') return ( MNI2MM.vz * i + MNI2MM.z0);
    }
    const mmPerVoxel = axis === 'x' ? vx : axis === 'y' ? vy : vz;
    return AXIS_SIGN[axis] * (i - Math.floor(n/2)) * mmPerVoxel;
  }
  const coord2idx = (c_mm, n, axis) => {
    const [nx, ny, nz] = dims;
    const { x: vx, y: vy, z: vz } = getVoxelMM();
    const isStd = isStandardMNI2mm([nx, ny, nz], [vx, vy, vz]);
    if (isStd) {
      let v;
      if (axis === 'x') v = ( (MNI2MM.x0 - c_mm) / MNI2MM.vx );
      else if (axis === 'y') v = ( (c_mm - MNI2MM.y0) / MNI2MM.vy );
      else v = ( (c_mm - MNI2MM.z0) / MNI2MM.vz );
      const idx = Math.round(v);
      return Math.max(0, Math.min(n-1, idx));
    }
    const mmPerVoxel = axis === 'x' ? vx : axis === 'y' ? vy : vz;
    const sign = AXIS_SIGN[axis];
    const v = (sign * (c_mm / mmPerVoxel)) + Math.floor(n/2);
    const idx = Math.round(v);
    return Math.max(0, Math.min(n-1, idx));
  }
  
  // (useEffect hooks 保持不變)
  useEffect(() => {
    let alive = true
    setLoadingBG(true); setErrBG('')
    ;(async () => {
      try {
        const bg = await loadNifti(MNI_BG_URL)
        if (!alive) return
        bgRef.current = bg
        setDims(bg.dims)
        const [nx,ny,nz] = bg.dims
        const mx = Math.floor(nx/2), my = Math.floor(ny/2), mz = Math.floor(nz/2)
        setIx(mx); setIy(my); setIz(mz)
        setCx('0'); setCy('0'); setCz('0')
      } catch (e) {
        if (!alive) return
        setErrBG(e?.message || String(e))
        bgRef.current = null
      } finally {
        if (!alive) return
        setLoadingBG(false)
      }
    })()
    return () => { alive = false }
  }, [])
  
  useEffect(() => {
    const mn = mapRef.current?.min ?? 0
    const mx = mapRef.current?.max ?? 1
    if (thrValue < mn || thrValue > mx) {
      setThrValue(Math.min(mx, Math.max(mn, thrValue)))
    }
  }, [mapRef.current, dims])

  useEffect(() => {
    if (!mapUrl) { mapRef.current = null; return }
    let alive = true
    setLoadingMap(true); setErrMap('')
    ;(async () => {
      try {
        const mv = await loadNifti(mapUrl)
        if (!alive) return
        mapRef.current = mv
        if (!bgRef.current) {
          setDims(mv.dims)
          const [nx,ny,nz] = mv.dims
          const mx = Math.floor(nx/2), my = Math.floor(ny/2), mz = Math.floor(nz/2)
          setIx(mx); setIy(my); setIz(mz)
          setCx('0'); setCy('0'); setCz('0')
        }
      } catch (e) {
        if (!alive) return
        setErrMap(e?.message || String(e))
        mapRef.current = null
      } finally {
        if (!alive) return
        setLoadingMap(false)
      }
    })()
    return () => { alive = false }
  }, [mapUrl])
  
  // (mapThreshold useMemo 保持不變)
  const mapThreshold = useMemo(() => {
    const mv = mapRef.current
    if (!mv) return null
    if (thrMode === 'value') return Number(thrValue) || 0
    return percentile(mv.data, Math.max(0, Math.min(100, Number(pctl) || 95)))
  }, [thrMode, thrValue, pctl, mapRef.current])

  // (drawSlice 函式保持不變)
  function drawSlice (canvas, axis, index) {
    const [nx, ny, nz] = dims
    const sx = (x) => (X_RIGHT_ON_SCREEN_RIGHT ? (nx - 1 - x) : x);
    const bg  = bgRef.current
    const map = mapRef.current
    const dimsStr = dims.join('x')
    const bgOK  = !!(bg  && bg.dims.join('x')  === dimsStr)
    const mapOK = !!(map && map.dims.join('x') === dimsStr)
    let w=0, h=0, getBG=null, getMap=null
    if (axis === 'z') { w = nx; h = ny; if (bgOK)  getBG  = (x,y)=> bg.data[sx(x) + y*nx + index*nx*ny]; if (mapOK) getMap = (x,y)=> map.data[sx(x) + y*nx + index*nx*ny] }
    if (axis === 'y') { w = nx; h = nz; if (bgOK)  getBG  = (x,y)=> bg.data[sx(x) + index*nx + y*nx*ny]; if (mapOK) getMap = (x,y)=> map.data[sx(x) + index*nx + y*nx*ny] }
    if (axis === 'x') { w = ny; h = nz; if (bgOK)  getBG  = (x,y)=> bg.data[index + x*nx + y*nx*ny]; if (mapOK) getMap = (x,y)=> map.data[index + x*nx + y*nx*ny] }
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: false })
    const img = ctx.createImageData(w, h)
    const alpha = Math.max(0, Math.min(1, overlayAlpha))
    const R = 255, G = 0, B = 0
    const thr = mapThreshold
    const bgMin = bg?.min ?? 0
    const bgMax = bg?.max ?? 1
    const bgRange = (bgMax - bgMin) || 1
    let p = 0
    for (let yy=0; yy<h; yy++) {
      const srcY = h - 1 - yy
      for (let xx=0; xx<w; xx++) {
        let gray = 0
        if (getBG) {
          const vbg = getBG(xx, srcY)
          let g = (vbg - bgMin) / bgRange
          if (g < 0) g = 0
          if (g > 1) g = 1
          gray = (g * 255) | 0
        }
        img.data[p    ] = gray
        img.data[p + 1] = gray
        img.data[p + 2] = gray
        img.data[p + 3] = 255
        if (getMap) {
          let mv = getMap(xx, srcY)
          const raw = mv
          if (useAbs) mv = Math.abs(mv)
          let pass = (thr == null) ? (mv > 0) : (mv >= thr)
          if (posOnly && raw <= 0) pass = false
          if (pass) {
            img.data[p    ] = ((1 - alpha) * img.data[p]     + alpha * R) | 0
            img.data[p + 1] = ((1 - alpha) * img.data[p + 1] + alpha * G) | 0
            img.data[p + 2] = ((1 - alpha) * img.data[p + 2] + alpha * B) | 0
          }
        }
        p += 4
      }
    }
    ctx.putImageData(img, 0, 0)
    ctx.save()
    ctx.strokeStyle = '#00ff00'
    ctx.lineWidth = 1
    let chX = 0, chY = 0
    if (axis === 'z') {
      chX = Math.max(0, Math.min(w-1, (X_RIGHT_ON_SCREEN_RIGHT ? (w - 1 - ix) : ix)))
      chY = Math.max(0, Math.min(h-1, iy))
    } else if (axis === 'y') {
      chX = Math.max(0, Math.min(w-1, (X_RIGHT_ON_SCREEN_RIGHT ? (w - 1 - ix) : ix)))
      chY = Math.max(0, Math.min(h-1, iz))
    } else {
      chX = Math.max(0, Math.min(w-1, iy))
      chY = Math.max(0, Math.min(h-1, iz))
    }
    const screenY = h - 1 - chY
    ctx.beginPath(); ctx.moveTo(chX + 0.5, 0); ctx.lineTo(chX + 0.5, h); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, screenY + 0.5); ctx.lineTo(w, screenY + 0.5); ctx.stroke()
    ctx.restore()
  }
  
  // (onCanvasClick, commitCoord 保持不變)
  function onCanvasClick (e, axis) {
    const canvas = e.currentTarget
    const rect = canvas.getBoundingClientRect()
    const x = Math.floor((e.clientX - rect.left) * canvas.width / rect.width)
    const y = Math.floor((e.clientY - rect.top) * canvas.height / rect.height)
    const srcY = canvas.height - 1 - y
    const [nx,ny,nz] = dims
    const toIdxX = (screenX) => (X_RIGHT_ON_SCREEN_RIGHT ? (nx - 1 - screenX) : screenX);
    if (axis === 'z') { const xi = toIdxX(x); setIx(xi); setIy(srcY); setCx(String(idx2coord(xi, nx, 'x'))); setCy(String(idx2coord(srcY, ny, 'y'))) }
    else if (axis === 'y') { const xi = toIdxX(x); setIx(xi); setIz(srcY); setCx(String(idx2coord(xi, nx, 'x'))); setCz(String(idx2coord(srcY, nz, 'z'))) }
    else { setIy(x); setIz(srcY); setCy(String(idx2coord(x, ny, 'y'))); setCz(String(idx2coord(srcY, nz, 'z'))) }
  }

  useEffect(() => {
    const [nx,ny,nz] = dims
    if (!nx) return
    setCx(String(idx2coord(ix, nx, 'x')))
    setCy(String(idx2coord(iy, ny, 'y')))
    setCz(String(idx2coord(iz, nz, 'z')))
  }, [ix,iy,iz,dims])

  const commitCoord = (axis) => {
    const [nx,ny,nz] = dims
    let vStr = axis==='x' ? cx : axis==='y' ? cy : cz
    if (vStr === '' || vStr === '-' ) return
    const parsed = parseFloat(vStr)
    if (Number.isNaN(parsed)) return
    if (axis==='x') setIx(coord2idx(parsed, nx, 'x'))
    if (axis==='y') setIy(coord2idx(parsed, ny, 'y'))
    if (axis==='z') setIz(coord2idx(parsed, nz, 'z'))
  }

  // (重繪 useEffect 保持不變)
  useEffect(() => {
    const [nx, ny, nz] = dims
    if (!nx) return
    const c0 = canvases[0].current, c1 = canvases[1].current, c2 = canvases[2].current
    if (c0 && iz >=0 && iz < nz) drawSlice(c0, 'z', iz)
    if (c1 && iy >=0 && iy < ny) drawSlice(c1, 'y', iy)
    if (c2 && ix >=0 && ix < nx) drawSlice(c2, 'x', ix)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dims, ix, iy, iz,
    overlayAlpha, posOnly, useAbs, thrMode, pctl, thrValue,
    loadingBG, loadingMap, errBG, errMap, query
  ])

  const [nx, ny, nz] = dims
  const sliceConfigs = [
    { key: 'y', name: 'Coronal',  axisLabel: 'Y', index: iy, setIndex: setIy, max: Math.max(0, ny-1), canvasRef: canvases[1] },
    { key: 'x', name: 'Sagittal', axisLabel: 'X', index: ix, setIndex: setIx, max: Math.max(0, nx-1), canvasRef: canvases[2] },
    { key: 'z', name: 'Axial',    axisLabel: 'Z', index: iz, setIndex: setIz, max: Math.max(0, nz-1), canvasRef: canvases[0] },
  ]
  const nsInputCls = 'w-16 rounded border border-gray-400 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400'
  const nsLabelCls = 'mr-1 text-sm'
  
  // --- 【高度修正】---
  // 30px 是 'nsInputCls' (X,Y,Z) 的計算高度
  const controlHeight = '30px'; 

  return (
    <div className='flex flex-col gap-3'>
      
      {/* --- 【修正 1/2】CSS 規則 --- */}
      <style>{`
        .nii-download-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: var(--primary-600); 
          text-decoration: none;
          border-radius: 6px;
          padding: 4px 8px;
          margin: -4px -8px;
        }
        .nii-download-link:hover {
          background-color: #eff6ff; 
          text-decoration: underline;
        }
        
        /* --- 【新增】強制 <select> 等高 --- */
        .nii-control-box select.nii-control {
           height: ${controlHeight} !important; 
           padding-top: 4px !important;    /* 覆蓋 'py-1' (4px) */
           padding-bottom: 4px !important; /* 覆蓋 'py-1' (4px) */
           box-sizing: border-box !important; /* 確保 padding 不會增加高度 */
           
           /* 複製 'nsInputCls' 的核心樣式 */
           border-width: 1px;
           border-color: #9ca3af; /* gray-400 */
           border-radius: 0.25rem; /* rounded (4px) */
           padding-left: 8px;
           padding-right: 8px;
           font-size: 14px; /* text-sm */
           
           /* 確保 'select' 元素的外觀一致 */
           -webkit-appearance: none;
           appearance: none;
           background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
           background-position: right 0.5rem center;
           background-repeat: no-repeat;
           background-size: 1.5em 1.5em;
           padding-right: 2.5rem; /* 為下拉箭頭騰出空間 */
        }
      `}</style>
      
      {/* (標頭保持不變) */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px'
      }}>
        <div className='card__title' style={{ marginBottom: 0 }}>NIfTI Viewer</div>
        {query && (
          <a 
            href={mapUrl} 
            className='nii-download-link'
          >
            Download map
          </a>
        )}
      </div>
      
      {/* --- 【修正 2/2】套用 'nii-control' className --- */}
      <div className='rounded-xl border p-3 text-sm nii-control-box'>
        <label className='flex items-center gap-2' style={{ marginBottom: '12px' }}>
          <span>Threshold mode</span>
          <select 
            value={thrMode} 
            onChange={e=>setThrMode(e.target.value)} 
            className='nii-control' /* <-- 套用新 class */
            style={{ width: '100%' }} /* 讓它填滿寬度 */
          >
            <option value='value'>Value</option>
            <option value='pctl'>Percentile</option>
          </select>
        </label>
        
        <div className="nii-input-row" style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
          {thrMode === 'value' ? (
            <label style={{ flex: '1 1 0', minWidth: 0 }}>
              <span className={nsLabelCls}>Threshold</span>
              <input type='number' step='0.01' value={thrValue} onChange={e=>setThrValue(Number(e.target.value))} className={nsInputCls} style={{ width: '100%', height: controlHeight }} />
            </label>
          ) : (
            <label style={{ flex: '1 1 0', minWidth: 0 }}>
              <span className={nsLabelCls}>Percentile</span>
              <input type='number' min={50} max={99.9} step='0.5' value={pctl} onChange={e=>setPctl(Number(e.target.value)||95)} className={nsInputCls} style={{ width: '100%', height: controlHeight }} />
            </label>
          )}

          <label style={{ flex: '1 1 0', minWidth: 0 }}>
            <span className={nsLabelCls}>X (mm):</span>
            <input
              type='text' inputMode='decimal' pattern='-?[0-9]*([.][0-9]+)?'
              className={nsInputCls}
              style={{ width: '100%', height: controlHeight }}
              value={cx}
              onChange={e=>setCx(e.target.value)}
              onBlur={()=>commitCoord('x')}
              onKeyDown={e=>{ if(e.key==='Enter'){ commitCoord('x') } }}
              aria-label='X coordinate (centered)'
            />
          </label>
          <label style={{ flex: '1 1 0', minWidth: 0 }}>
            <span className={nsLabelCls}>Y (mm):</span>
            <input
              type='text' inputMode='decimal' pattern='-?[0-9]*([.][0-9]+)?'
              className={nsInputCls}
              style={{ width: '100%', height: controlHeight }}
              value={cy}
              onChange={e=>setCy(e.target.value)}
              onBlur={()=>commitCoord('y')}
              onKeyDown={e=>{ if(e.key==='Enter'){ commitCoord('y') } }}
              aria-label='Y coordinate (centered)'
            />
          </label>
          <label style={{ flex: '1 1 0', minWidth: 0 }}>
            <span className={nsLabelCls}>Z (mm):</span>
            <input
              type='text' inputMode='decimal' pattern='-?[0-9]*([.][0-9]+)?'
              className={nsInputCls}
              style={{ width: '100%', height: controlHeight }}
              value={cz}
              onChange={e=>setCz(e.target.value)}
              onBlur={()=>commitCoord('z')}
              onKeyDown={e=>{ if(e.key==='Enter'){ commitCoord('z') } }}
              aria-label='Z coordinate (centered)'
            />
          </label>
        </div>
      </div>

      {/* (腦圖瀏覽器和其餘部分保持不變) */}
      {(loadingBG || loadingMap) && (
        <div className='grid gap-3 lg:grid-cols-3'>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className='h-64 animate-pulse rounded-xl border bg-gray-100' />
          ))}
        </div>
      )}
      {(errBG || errMap) && (
        <div className='rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800'>
          {errBG && <div>Background: {errBG}</div>}
          {errMap && <div>Map: {errMap}</div>}
        </div>
      )}
      {!!nx && (
        <div className='grid grid-cols-3 gap-3' style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
          {sliceConfigs.map(({ key, name, axisLabel, index, setIndex, max, canvasRef }) => (
            <div key={key} className='flex flex-col gap-2'>
              <div className='text-xs text-gray-600'>{name} ({axisLabel})</div>
              <div className='flex items-center gap-2'>
                <canvas ref={canvasRef} className='h-64 w-full rounded-xl border' onClick={(e)=>onCanvasClick(e, key)} style={{ cursor: 'crosshair' }} />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className='rounded-xl border p-3 text-sm'>
        <label className='flex flex-col'>Gaussian FWHM:
          <input type='number' step='0.5' value={fwhm} onChange={e=>setFwhm(Number(e.target.value)||0)} className='w-28 rounded-lg border px-2 py-1'/>
          <br />
        </label>
      </div>
      <div className='rounded-xl border p-3 text-sm'>
        <label className='flex items-center gap-2'>
          <span>Overlay alpha</span>
          <input type='range' min={0} max={1} step={0.05} value={overlayAlpha} onChange={e=>setOverlayAlpha(Number(e.target.value))} className='w-40' />
        </label>
        <br />
      </div>
    </div>
  )
}