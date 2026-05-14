import React, { useRef, useState } from 'react';

const InteriorPlanner = () => {
  const roomCanvas = { width: 900, height: 560 };
  const gridSize = 20;
  const [activeTab, setActiveTab] = useState('editor'); 
  
  // --- [상태 관리] ---
  const [tool, setTool] = useState('wall'); 
  const [walls, setWalls] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [windows, setWindows] = useState([]);
  const [doors, setDoors] = useState([]);
  const [history, setHistory] = useState([]); 
  const [lineStart, setLineStart] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [draftRoom, setDraftRoom] = useState(null); 
  const [draftFurniture, setDraftFurniture] = useState(null); 
  const [isDragging, setIsDragging] = useState(false);

  const [furnitureTypeInput, setFurnitureTypeInput] = useState('침대');
  const [furnitureColorInput, setFurnitureColorInput] = useState('#93c5fd');
  const [placedFurniture, setPlacedFurniture] = useState([]);
  const [selectedFurnitureId, setSelectedFurnitureId] = useState(null);
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [previewAiId, setPreviewAiId] = useState(null);
  const nextIdRef = useRef(Date.now());

  // --- [유틸리티] ---
  const snap = (value) => Math.round(value / gridSize) * gridSize;
  const getPoint = (evt) => {
    const rect = evt.currentTarget.getBoundingClientRect();
    return { x: snap(evt.clientX - rect.left), y: snap(evt.clientY - rect.top) };
  };

  const saveSnapshot = () => {
    setHistory([...history, { walls: [...walls], rooms: [...rooms], windows: [...windows], doors: [...doors], placedFurniture: [...placedFurniture] }]);
  };

  const undo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setWalls(last.walls); setRooms(last.rooms); setWindows(last.windows); setDoors(last.doors); setPlacedFurniture(last.placedFurniture);
    setHistory(history.slice(0, -1));
  };

  const checkCollision = (r1, r2) => (
    r1.x < r2.x + r2.width && r1.x + r1.width > r2.x &&
    r1.y < r2.y + r2.height && r1.y + r1.height > r2.y
  );

  const isValidPosition = (movingItem, allItems, boundary) => {
    if (!boundary) return false;
    if (movingItem.x < boundary.x || movingItem.y < boundary.y ||
        movingItem.x + movingItem.width > boundary.x + boundary.width ||
        movingItem.y + movingItem.height > boundary.y + boundary.height) return false;
    return !allItems.some(item => item.id !== movingItem.id && checkCollision(movingItem, item));
  };

  // --- [AI 배치 알고리즘 개선] ---
  const generateAiRecommendations = () => {
    if (rooms.length === 0 || placedFurniture.length === 0) return;
    const baseRoom = rooms[0];
    const margin = 20;
    const sorted = [...placedFurniture].sort((a, b) => (b.width * b.height) - (a.width * a.height));

    const generateLayout = (type) => {
      const result = [];
      let cx = baseRoom.x + margin, cy = baseRoom.y + margin, rh = 0;

      sorted.forEach((item) => {
        let placed = false, attempts = 0;
        // 시도 횟수를 늘리고, 실패 시 강제 배치 로직 추가
        while (!placed && attempts < 50) {
          let tx, ty;
          if (type === 'rest') {
            const cand = [
              {x:baseRoom.x+margin, y:baseRoom.y+margin}, 
              {x:baseRoom.x+baseRoom.width-item.width-margin, y:baseRoom.y+margin}, 
              {x:baseRoom.x+margin, y:baseRoom.y+baseRoom.height-item.height-margin}, 
              {x:baseRoom.x+baseRoom.width-item.width-margin, y:baseRoom.y+baseRoom.height-item.height-margin}
            ];
            tx = cand[attempts % 4].x; ty = cand[attempts % 4].y;
            if (attempts > 4) { // 구석이 다 찼으면 랜덤 위치 시도
                tx = baseRoom.x + margin + (Math.random() * (baseRoom.width - item.width - margin * 2));
                ty = baseRoom.y + margin + (Math.random() * (baseRoom.height - item.height - margin * 2));
            }
          } else {
            if (cx + item.width + margin > baseRoom.x + baseRoom.width - margin) { cx = baseRoom.x + margin; cy += rh + margin; rh = 0; }
            tx = cx; ty = cy;
          }

          const test = { ...item, x: snap(tx), y: snap(ty) };
          if (isValidPosition(test, result, baseRoom)) { 
            result.push(test); 
            if(type==='grid') { cx += item.width + margin; rh = Math.max(rh, item.height); }
            placed = true; 
          } else { 
            cx += 20; attempts++; 
          }

          // [마지막 수단] 모든 시도가 실패해도 가구가 사라지지 않게 강제로 리스트에 추가
          if (attempts === 49 && !placed) {
            result.push({ ...item, x: baseRoom.x + margin, y: baseRoom.y + margin });
            placed = true;
          }
        }
      });
      return result;
    };
    setAiRecommendations([
      { id: 'A', name: '추천안 A (벽 중심)', score: 88, items: generateLayout('rest') },
      { id: 'B', name: '추천안 B (균형 배치)', score: 94, items: generateLayout('grid') }
    ]);
    setPreviewAiId('A');
  };

  // --- [이벤트 핸들러] ---
  const handleMouseDown = (e) => {
    const p = getPoint(e);
    setIsDragging(true);
    if (activeTab === 'editor' && tool === 'room') setDraftRoom({ start: p, end: p });
    if (activeTab === 'placement' && tool !== 'delete') setDraftFurniture({ start: p, end: p });
  };

  const handleMouseMove = (e) => {
    const p = getPoint(e);
    setMousePos(p);
    if (!isDragging) return;
    if (draftRoom) setDraftRoom(prev => ({ ...prev, end: p }));
    if (draftFurniture) setDraftFurniture(prev => ({ ...prev, end: p }));
  };

  const handleMouseUp = () => {
    if (draftRoom) {
      const x = Math.min(draftRoom.start.x, draftRoom.end.x), y = Math.min(draftRoom.start.y, draftRoom.end.y);
      const w = Math.abs(draftRoom.start.x - draftRoom.end.x), h = Math.abs(draftRoom.start.y - draftRoom.end.y);
      if (w >= gridSize && h >= gridSize) { saveSnapshot(); setRooms([{ id: Date.now(), x, y, width: w, height: h }]); }
    }
    if (draftFurniture && rooms.length > 0) {
      const x = Math.min(draftFurniture.start.x, draftFurniture.end.x), y = Math.min(draftFurniture.start.y, draftFurniture.end.y);
      const w = Math.abs(draftFurniture.start.x - draftFurniture.end.x), h = Math.abs(draftFurniture.start.y - draftFurniture.end.y);
      if (w >= gridSize && h >= gridSize) {
        const newItem = { id: ++nextIdRef.current, name: furnitureTypeInput, x, y, width: w, height: h, color: furnitureColorInput };
        if (isValidPosition(newItem, placedFurniture, rooms[0])) setPlacedFurniture([...placedFurniture, newItem]);
      }
    }
    setDraftRoom(null); setDraftFurniture(null); setIsDragging(false);
  };

  const handleCanvasClick = (e) => {
    if (activeTab === 'editor' && ['wall', 'window', 'door'].includes(tool)) {
      const p = getPoint(e);
      if (!lineStart) setLineStart(p);
      else {
        saveSnapshot();
        const newItem = { id: Date.now(), start: lineStart, end: p };
        if (tool === 'wall') setWalls([...walls, newItem]);
        else if (tool === 'window') setWindows([...windows, newItem]);
        else if (tool === 'door') setDoors([...doors, newItem]);
        setLineStart(null);
      }
    }
  };

  const analysis = (rooms.length > 0) ? {
    totalScore: Math.round(85 * 0.4 + (windows.length > 0 ? 90 : 40) * 0.3 + (doors.length > 0 ? 80 : 20) * 0.3),
    traffic: doors.length > 0 ? 85 : 20, light: windows.length > 0 ? 90 : 40, space: 80
  } : null;

  return (
    <div style={{ padding: '40px', backgroundColor: '#fcfaff', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center', fontSize: '32px', fontWeight: '900', marginBottom: '40px' }}>인테리어 플래너</h1>
      
      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '40px' }}>
        <button onClick={() => setActiveTab('editor')} style={{ padding: '12px 30px', borderRadius: '99px', fontWeight: 'bold', border: 'none', cursor: 'pointer', backgroundColor: activeTab === 'editor' ? '#6366f1' : '#f3f4f6', color: activeTab === 'editor' ? '#fff' : '#9ca3af' }}>1. 도면 그리기</button>
        <button onClick={() => setActiveTab('placement')} disabled={rooms.length === 0} style={{ padding: '12px 30px', borderRadius: '99px', fontWeight: 'bold', border: 'none', cursor: rooms.length > 0 ? 'pointer' : 'not-allowed', backgroundColor: activeTab === 'placement' ? '#6366f1' : '#f3f4f6', color: activeTab === 'placement' ? '#fff' : '#d1d5db' }}>2. 가구 배치</button>
        <button onClick={() => setActiveTab('results')} disabled={placedFurniture.length === 0} style={{ padding: '12px 30px', borderRadius: '99px', fontWeight: 'bold', border: 'none', cursor: placedFurniture.length > 0 ? 'pointer' : 'not-allowed', backgroundColor: activeTab === 'results' ? '#6366f1' : '#f3f4f6', color: activeTab === 'results' ? '#fff' : '#d1d5db' }}>3. 결과 분석</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '40px' }}>
        <div style={{ position: 'relative', border: '12px solid #111827', borderRadius: '24px', overflow: 'hidden', backgroundColor: '#fff', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)' }}>
          <svg width={roomCanvas.width} height={roomCanvas.height} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onClick={handleCanvasClick}>
            <defs><pattern id="grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse"><path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="#f1f5f9" strokeWidth="1" /></pattern></defs>
            <rect width={roomCanvas.width} height={roomCanvas.height} fill="url(#grid)" />
            
            {rooms.map(r => <rect key={r.id} x={r.x} y={r.y} width={r.width} height={r.height} fill={activeTab === 'editor' ? "#60a5fa11" : "#fff"} stroke="#3b82f6" strokeWidth="2" style={{ pointerEvents: tool === 'delete' ? 'auto' : 'none' }} onClick={(e) => { if(tool === 'delete') { e.stopPropagation(); setRooms([]); } }} />)}
            
            {/* [수정] 도면 요소들: 지우개 모드가 아닐 때는 클릭을 통과시킴 (pointerEvents: none) */}
            {walls.map(w => <line key={w.id} x1={w.start.x} y1={w.start.y} x2={w.end.x} y2={w.end.y} stroke="#1e293b" strokeWidth="8" strokeLinecap="round" style={{ pointerEvents: tool === 'delete' ? 'auto' : 'none' }} onClick={(e) => { if(tool === 'delete') { e.stopPropagation(); setWalls(walls.filter(i=>i.id!==w.id)); } }} />)}
            {windows.map(w => <line key={w.id} x1={w.start.x} y1={w.start.y} x2={w.end.x} y2={w.end.y} stroke="#38bdf8" strokeWidth="12" strokeLinecap="square" style={{ pointerEvents: tool === 'delete' ? 'auto' : 'none' }} onClick={(e) => { if(tool === 'delete') { e.stopPropagation(); setWindows(windows.filter(i=>i.id!==w.id)); } }} />)}
            {doors.map(d => <line key={d.id} x1={d.start.x} y1={d.start.y} x2={d.end.x} y2={d.end.y} stroke="#b45309" strokeWidth="10" strokeLinecap="round" style={{ pointerEvents: tool === 'delete' ? 'auto' : 'none' }} onClick={(e) => { if(tool === 'delete') { e.stopPropagation(); setDoors(doors.filter(i=>i.id!==d.id)); } }} />)}
            
            {draftRoom && <rect x={Math.min(draftRoom.start.x, draftRoom.end.x)} y={Math.min(draftRoom.start.y, draftRoom.end.y)} width={Math.abs(draftRoom.start.x-draftRoom.end.x)} height={Math.abs(draftRoom.start.y-draftRoom.end.y)} fill="rgba(59, 130, 246, 0.3)" stroke="#2563eb" strokeWidth="2" strokeDasharray="8 4" />}
            {draftFurniture && <rect x={Math.min(draftFurniture.start.x, draftFurniture.end.x)} y={Math.min(draftFurniture.start.y, draftFurniture.end.y)} width={Math.abs(draftFurniture.start.x-draftFurniture.end.x)} height={Math.abs(draftFurniture.start.y-draftFurniture.end.y)} fill={furnitureColorInput + '66'} stroke="#334155" strokeDasharray="4 4" />}
            {lineStart && <line x1={lineStart.x} y1={lineStart.y} x2={mousePos.x} y2={mousePos.y} stroke="#ef4444" strokeWidth="2" strokeDasharray="6 4" />}
            
            {(activeTab === 'placement' || activeTab === 'results') && placedFurniture.map(f => (
              <g key={f.id} onMouseDown={(e) => { if(tool === 'delete') { e.stopPropagation(); setPlacedFurniture(placedFurniture.filter(i=>i.id!==f.id)); } else { setSelectedFurnitureId(f.id); } }}>
                <rect x={f.x} y={f.y} width={f.width} height={f.height} fill={f.color} stroke={selectedFurnitureId === f.id ? '#6366f1' : '#475569'} strokeWidth="2" rx="6" />
                <text x={f.x+5} y={f.y+18} fontSize="12" fontWeight="bold" fill="#1e293b">{f.name}</text>
              </g>
            ))}
            {activeTab === 'placement' && previewAiId && aiRecommendations.find(r => r.id === previewAiId)?.items.map(p => <rect key={`pre-${p.id}`} x={p.x} y={p.y} width={p.width} height={p.height} fill="none" stroke="#a855f7" strokeWidth="3" strokeDasharray="6 4" />)}
          </svg>
        </div>
        
        <div style={{ width: '340px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {activeTab === 'editor' ? (
            <div style={{ padding: '24px', backgroundColor: '#fff', borderRadius: '24px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontWeight: '900', marginBottom: '20px' }}>도면 도구</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button onClick={() => setTool('wall')} style={{ width: '100%', padding: '14px', borderRadius: '12px', fontWeight: 'bold', border: 'none', backgroundColor: tool === 'wall' ? '#6366f1' : '#f1f5f9', color: tool === 'wall' ? '#fff' : '#64748b', cursor: 'pointer' }}>벽 설치</button>
                <button onClick={() => setTool('room')} style={{ width: '100%', padding: '14px', borderRadius: '12px', fontWeight: 'bold', border: 'none', backgroundColor: tool === 'room' ? '#6366f1' : '#f1f5f9', color: tool === 'room' ? '#fff' : '#64748b', cursor: 'pointer' }}>방 영역 지정</button>
                <button onClick={() => setTool('window')} style={{ width: '100%', padding: '14px', borderRadius: '12px', fontWeight: 'bold', border: 'none', backgroundColor: tool === 'window' ? '#0ea5e9' : '#f1f5f9', color: tool === 'window' ? '#fff' : '#64748b', cursor: 'pointer' }}>창문 설치</button>
                <button onClick={() => setTool('door')} style={{ width: '100%', padding: '14px', borderRadius: '12px', fontWeight: 'bold', border: 'none', backgroundColor: tool === 'door' ? '#b45309' : '#f1f5f9', color: tool === 'door' ? '#fff' : '#64748b', cursor: 'pointer' }}>문 설치</button>
                <button onClick={() => setTool('delete')} style={{ width: '100%', padding: '14px', borderRadius: '12px', fontWeight: 'bold', border: 'none', backgroundColor: tool === 'delete' ? '#ef4444' : '#f1f5f9', color: tool === 'delete' ? '#fff' : '#64748b', cursor: 'pointer' }}>지우개 모드</button>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button onClick={undo} style={{ flex: 1, padding: '10px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>↩ 취소</button>
                <button onClick={() => { setWalls([]); setRooms([]); setWindows([]); setDoors([]); setPlacedFurniture([]); }} style={{ flex: 1, padding: '10px', backgroundColor: '#fff1f2', color: '#e11d48', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>초기화</button>
              </div>
            </div>
          ) : activeTab === 'results' ? (
            <div style={{ padding: '24px', backgroundColor: '#fff', borderRadius: '24px', border: '2px solid #6366f1' }}>
              <h3 style={{ fontWeight: '900', fontSize: '20px', marginBottom: '20px' }}>분석 리포트</h3>
              <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#f5f3ff', borderRadius: '16px', marginBottom: '20px' }}>
                <p style={{ fontSize: '44px', fontWeight: '900', margin: '8px 0', color: '#4338ca' }}>{analysis?.totalScore}점</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', fontWeight: 'bold' }}>
                <p>🚶 동선: {analysis?.traffic}점</p>
                <p>☀️ 채광: {analysis?.light}점</p>
                <p>📦 공간: {analysis?.space}점</p>
              </div>
            </div>
          ) : (
            <div style={{ padding: '24px', backgroundColor: '#fff', borderRadius: '24px', border: '1px solid #e5e7eb' }}>
              <h3 style={{ fontWeight: '900', marginBottom: '20px' }}>가구 관리</h3>
              <input value={furnitureTypeInput} onChange={e => setFurnitureTypeInput(e.target.value)} style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '12px', marginBottom: '10px' }} placeholder="가구 이름" />
              <input type="color" value={furnitureColorInput} onChange={e => setFurnitureColorInput(e.target.value)} style={{ width: '100%', height: '44px', border: 'none', borderRadius: '12px', cursor: 'pointer', marginBottom: '20px' }} />
              <button onClick={generateAiRecommendations} style={{ width: '100%', padding: '18px', backgroundColor: '#a855f7', color: '#fff', borderRadius: '18px', fontWeight: '900', border: 'none', cursor: 'pointer', marginBottom: '16px' }}>AI 자동 배치 생성</button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {aiRecommendations.map(r => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: '#faf5ff', borderRadius: '12px', border: '1px solid #f3e8ff' }}>
                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{r.name}</span>
                    <button onClick={() => { setPlacedFurniture(r.items.map(i => ({...i}))); setPreviewAiId(null); }} style={{ padding: '4px 12px', backgroundColor: '#a855f7', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>적용</button>
                  </div>
                ))}
              </div>
              <button onClick={() => setTool('delete')} style={{ width: '100%', marginTop: '10px', padding: '12px', borderRadius: '12px', border: tool==='delete'?'2px solid #ef4444':'none', backgroundColor: '#f9fafb', cursor: 'pointer', fontWeight: 'bold' }}>🗑️ 가구 지우기 모드</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InteriorPlanner;