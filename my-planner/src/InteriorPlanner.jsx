import React, { useMemo, useRef, useState } from 'react';

const InteriorPlanner = () => {
  const room = { width: 900, height: 560 };
  const gridSize = 20;
  const [tool, setTool] = useState('wall');
  const [walls, setWalls] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [history, setHistory] = useState([]);
  const [lineStart, setLineStart] = useState(null);
  const [draftRoom, setDraftRoom] = useState(null);
  const [isDraggingRoom, setIsDraggingRoom] = useState(false);
  const [activeTab, setActiveTab] = useState('editor');
  const [furnitureTypeInput, setFurnitureTypeInput] = useState('가구');
  const [furnitureColorInput, setFurnitureColorInput] = useState('#93c5fd');
  const [placedFurniture, setPlacedFurniture] = useState([]);
  const [isDraggingFurniture, setIsDraggingFurniture] = useState(false);
  const [draftFurniture, setDraftFurniture] = useState(null);
  const [selectedFurnitureId, setSelectedFurnitureId] = useState(null);
  const [furnitureInteraction, setFurnitureInteraction] = useState(null);
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [previewAiId, setPreviewAiId] = useState(null);
  const nextIdRef = useRef(Date.now());

  const snap = (value) => Math.round(value / gridSize) * gridSize;

  const getPoint = (evt) => {
    const rect = evt.currentTarget.getBoundingClientRect();
    const x = snap(evt.clientX - rect.left);
    const y = snap(evt.clientY - rect.top);
    return {
      x: Math.max(0, Math.min(room.width, x)),
      y: Math.max(0, Math.min(room.height, y)),
    };
  };

  const saveSnapshot = () => {
    setHistory((prev) => [
      ...prev,
      {
        walls: JSON.parse(JSON.stringify(walls)),
        rooms: JSON.parse(JSON.stringify(rooms)),
      },
    ]);
  };

  const handleCanvasClick = (evt) => {
    if (tool !== 'wall') return;
    const point = getPoint(evt);

    if (!lineStart) {
      setLineStart(point);
      return;
    }

    if (lineStart.x === point.x && lineStart.y === point.y) return;

    saveSnapshot();
    setWalls((prev) => [...prev, { id: Date.now(), start: lineStart, end: point }]);
    setLineStart(null);
  };

  const handleMouseDown = (evt) => {
    if (tool !== 'room') return;
    const point = getPoint(evt);
    setIsDraggingRoom(true);
    setDraftRoom({ start: point, end: point });
  };

  const handleMouseMove = (evt) => {
    if (!isDraggingRoom || tool !== 'room') return;
    const point = getPoint(evt);
    setDraftRoom((prev) => (prev ? { ...prev, end: point } : null));
  };

  const handleMouseUp = () => {
    if (!isDraggingRoom || !draftRoom) {
      setIsDraggingRoom(false);
      return;
    }

    const x = Math.min(draftRoom.start.x, draftRoom.end.x);
    const y = Math.min(draftRoom.start.y, draftRoom.end.y);
    const width = Math.abs(draftRoom.start.x - draftRoom.end.x);
    const height = Math.abs(draftRoom.start.y - draftRoom.end.y);

    if (width >= gridSize && height >= gridSize) {
      saveSnapshot();
      setRooms((prev) => [...prev, { id: Date.now(), x, y, width, height }]);
    }

    setDraftRoom(null);
    setIsDraggingRoom(false);
  };

  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setWalls(last.walls);
    setRooms(last.rooms);
    setHistory((prev) => prev.slice(0, -1));
    setLineStart(null);
    setDraftRoom(null);
  };

  const resetAll = () => {
    saveSnapshot();
    setWalls([]);
    setRooms([]);
    setLineStart(null);
    setDraftRoom(null);
  };

  const stats = useMemo(
    () => ({
      wallCount: walls.length,
      roomCount: rooms.length,
      totalArea: rooms.reduce((sum, r) => sum + (r.width * r.height) / 10000, 0),
    }),
    [walls, rooms],
  );

  const currentDraftRect =
    draftRoom &&
    ({
      x: Math.min(draftRoom.start.x, draftRoom.end.x),
      y: Math.min(draftRoom.start.y, draftRoom.end.y),
      width: Math.abs(draftRoom.start.x - draftRoom.end.x),
      height: Math.abs(draftRoom.start.y - draftRoom.end.y),
    });

  const isPlanCompleted = stats.wallCount > 0 && stats.roomCount > 0;

  const openNextTab = () => {
    if (!isPlanCompleted) return;
    setActiveTab('next');
  };

  const getRectFromDraft = (draft) => {
    if (!draft) return null;
    return {
      x: Math.min(draft.start.x, draft.end.x),
      y: Math.min(draft.start.y, draft.end.y),
      width: Math.abs(draft.start.x - draft.end.x),
      height: Math.abs(draft.start.y - draft.end.y),
    };
  };

  const addFurnitureByDragStart = (evt) => {
    const point = getPoint(evt);
    setIsDraggingFurniture(true);
    setDraftFurniture({ start: point, end: point });
  };

  const addFurnitureByDragMove = (evt) => {
    if (!isDraggingFurniture) return;
    const point = getPoint(evt);
    setDraftFurniture((prev) => (prev ? { ...prev, end: point } : null));
  };

  const addFurnitureByDragEnd = () => {
    if (!isDraggingFurniture || !draftFurniture) {
      setIsDraggingFurniture(false);
      return;
    }

    const rect = getRectFromDraft(draftFurniture);
    const typeName = furnitureTypeInput.trim();

    if (rect && rect.width >= gridSize && rect.height >= gridSize && typeName) {
      nextIdRef.current += 1;
      setPlacedFurniture((prev) => [
        ...prev,
        {
          id: nextIdRef.current,
          type: typeName.toLowerCase(),
          name: typeName,
          width: rect.width,
          height: rect.height,
          x: rect.x,
          y: rect.y,
          color: furnitureColorInput,
        },
      ]);
    }

    setDraftFurniture(null);
    setIsDraggingFurniture(false);
  };

  const currentDraftFurnitureRect = getRectFromDraft(draftFurniture);

  const startFurnitureMove = (evt, item) => {
    evt.stopPropagation();
    setSelectedFurnitureId(item.id);
    setFurnitureInteraction({
      mode: 'move',
      id: item.id,
      startPointer: getPoint(evt),
      startItem: { ...item },
    });
  };

  const startFurnitureResize = (evt, item, handle) => {
    evt.stopPropagation();
    setSelectedFurnitureId(item.id);
    setFurnitureInteraction({
      mode: 'resize',
      handle,
      id: item.id,
      startPointer: getPoint(evt),
      startItem: { ...item },
    });
  };

  const handleFurnitureCanvasMouseMove = (evt) => {
    if (furnitureInteraction) {
      const pointer = getPoint(evt);
      const dx = pointer.x - furnitureInteraction.startPointer.x;
      const dy = pointer.y - furnitureInteraction.startPointer.y;
      const base = furnitureInteraction.startItem;

      setPlacedFurniture((prev) =>
        prev.map((item) => {
          if (item.id !== furnitureInteraction.id) return item;

          if (furnitureInteraction.mode === 'move') {
            const x = snap(Math.max(0, Math.min(room.width - base.width, base.x + dx)));
            const y = snap(Math.max(0, Math.min(room.height - base.height, base.y + dy)));
            return { ...item, x, y };
          }

          const left = base.x;
          const top = base.y;
          const right = base.x + base.width;
          const bottom = base.y + base.height;
          let newLeft = left;
          let newTop = top;
          let newRight = right;
          let newBottom = bottom;

          if (furnitureInteraction.handle.includes('w')) {
            newLeft = Math.max(0, Math.min(right - gridSize, left + dx));
          }
          if (furnitureInteraction.handle.includes('e')) {
            newRight = Math.min(room.width, Math.max(left + gridSize, right + dx));
          }
          if (furnitureInteraction.handle.includes('n')) {
            newTop = Math.max(0, Math.min(bottom - gridSize, top + dy));
          }
          if (furnitureInteraction.handle.includes('s')) {
            newBottom = Math.min(room.height, Math.max(top + gridSize, bottom + dy));
          }

          newLeft = snap(newLeft);
          newTop = snap(newTop);
          newRight = snap(newRight);
          newBottom = snap(newBottom);

          const width = Math.max(gridSize, newRight - newLeft);
          const height = Math.max(gridSize, newBottom - newTop);

          return {
            ...item,
            x: Math.max(0, Math.min(room.width - width, newLeft)),
            y: Math.max(0, Math.min(room.height - height, newTop)),
            width,
            height,
          };
        }),
      );
      return;
    }

    if (isDraggingFurniture) {
      addFurnitureByDragMove(evt);
    }
  };

  const handleFurnitureCanvasMouseUp = () => {
    if (furnitureInteraction) {
      setFurnitureInteraction(null);
      return;
    }
    addFurnitureByDragEnd();
  };

  const runAutoPlacement = () => {
    if (rooms.length === 0 || placedFurniture.length === 0) return;
    const baseRoom = rooms[0];
    const margin = 20;
    let cursorX = baseRoom.x + margin;
    let cursorY = baseRoom.y + margin;
    let rowMaxHeight = 0;

    const autoLayout = placedFurniture.map((item, index) => {
      if (cursorX + item.width > baseRoom.x + baseRoom.width - margin) {
        cursorX = baseRoom.x + margin;
        cursorY += rowMaxHeight + margin;
        rowMaxHeight = 0;
      }

      const nextItem = {
        ...item,
        id: Date.now() + index,
        x: snap(Math.min(cursorX, baseRoom.x + baseRoom.width - item.width)),
        y: snap(Math.min(cursorY, baseRoom.y + baseRoom.height - item.height)),
      };

      cursorX += item.width + margin;
      rowMaxHeight = Math.max(rowMaxHeight, item.height);

      return {
        ...nextItem,
      };
    });

    setPlacedFurniture(autoLayout);
  };

  const clearFurniture = () => {
    setPlacedFurniture([]);
    setDraftFurniture(null);
    setIsDraggingFurniture(false);
    setSelectedFurnitureId(null);
    setFurnitureInteraction(null);
    setAiRecommendations([]);
    setPreviewAiId(null);
  };

  const generateAiRecommendations = () => {
    if (rooms.length === 0 || placedFurniture.length === 0) {
      setAiRecommendations([]);
      setPreviewAiId(null);
      return;
    }

    const baseRoom = rooms[0];
    const margin = 20;
    const sorted = [...placedFurniture].sort((a, b) => b.width * b.height - a.width * a.height);

    const wallFocused = sorted.map((item, index) => {
      const side = index % 4;
      let x = baseRoom.x + margin;
      let y = baseRoom.y + margin;

      if (side === 0) {
        x = baseRoom.x + margin + (index * gridSize) % Math.max(gridSize, baseRoom.width - item.width - margin * 2);
        y = baseRoom.y + margin;
      } else if (side === 1) {
        x = baseRoom.x + baseRoom.width - item.width - margin;
        y = baseRoom.y + margin + (index * gridSize) % Math.max(gridSize, baseRoom.height - item.height - margin * 2);
      } else if (side === 2) {
        x = baseRoom.x + margin + (index * gridSize) % Math.max(gridSize, baseRoom.width - item.width - margin * 2);
        y = baseRoom.y + baseRoom.height - item.height - margin;
      } else {
        x = baseRoom.x + margin;
        y = baseRoom.y + margin + (index * gridSize) % Math.max(gridSize, baseRoom.height - item.height - margin * 2);
      }

      return {
        ...item,
        x: snap(Math.max(baseRoom.x, Math.min(baseRoom.x + baseRoom.width - item.width, x))),
        y: snap(Math.max(baseRoom.y, Math.min(baseRoom.y + baseRoom.height - item.height, y))),
      };
    });

    let cursorX = baseRoom.x + margin;
    let cursorY = baseRoom.y + margin;
    let rowMaxHeight = 0;
    const gridBalanced = sorted.map((item) => {
      if (cursorX + item.width > baseRoom.x + baseRoom.width - margin) {
        cursorX = baseRoom.x + margin;
        cursorY += rowMaxHeight + margin;
        rowMaxHeight = 0;
      }
      const positioned = {
        ...item,
        x: snap(Math.min(cursorX, baseRoom.x + baseRoom.width - item.width)),
        y: snap(Math.min(cursorY, baseRoom.y + baseRoom.height - item.height)),
      };
      cursorX += item.width + margin;
      rowMaxHeight = Math.max(rowMaxHeight, item.height);
      return positioned;
    });

    const centerX = baseRoom.x + baseRoom.width / 2;
    const centerY = baseRoom.y + baseRoom.height / 2;
    const radial = sorted.map((item, index) => {
      const angle = (Math.PI * 2 * index) / sorted.length;
      const radius = Math.min(baseRoom.width, baseRoom.height) * 0.28;
      const x = centerX + Math.cos(angle) * radius - item.width / 2;
      const y = centerY + Math.sin(angle) * radius - item.height / 2;
      return {
        ...item,
        x: snap(Math.max(baseRoom.x, Math.min(baseRoom.x + baseRoom.width - item.width, x))),
        y: snap(Math.max(baseRoom.y, Math.min(baseRoom.y + baseRoom.height - item.height, y))),
      };
    });

    setAiRecommendations([
      { id: 'wall-focused', name: 'AI 추천 A (벽 중심)', score: 86, items: wallFocused },
      { id: 'grid-balanced', name: 'AI 추천 B (균형 배치)', score: 91, items: gridBalanced },
      { id: 'radial-flow', name: 'AI 추천 C (중심 동선)', score: 84, items: radial },
    ]);
    setPreviewAiId('grid-balanced');
  };

  const applyAiRecommendation = (layoutId) => {
    const layout = aiRecommendations.find((item) => item.id === layoutId);
    if (!layout) return;
    setPlacedFurniture(layout.items.map((item) => ({ ...item })));
    setPreviewAiId(layoutId);
  };

  const previewItems =
    aiRecommendations.find((item) => item.id === previewAiId)?.items || [];

  return (
    <div className="p-6 bg-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4">인테리어 플래너 도면 편집기</h1>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('editor')}
          className={`px-4 py-2 rounded-md text-sm font-semibold ${activeTab === 'editor' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          도면 편집
        </button>
        <button
          onClick={() => setActiveTab('next')}
          disabled={!isPlanCompleted}
          className={`px-4 py-2 rounded-md text-sm font-semibold ${
            activeTab === 'next' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'
          } ${!isPlanCompleted ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          다음 작업
        </button>
      </div>

      {activeTab === 'next' ? (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
            <h2 className="text-xl font-bold mb-1">가구 배치 및 자동 추천</h2>
            <p className="text-sm text-gray-600">도면 위에서 드래그하면 입력한 종류의 가구가 생성됩니다. 자동 배치는 첫 번째 방을 기준으로 가구를 정렬합니다.</p>
          </div>

          <div className="flex flex-col xl:flex-row gap-5">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3">
              <svg
                width={room.width}
                height={room.height}
                className="bg-white border-2 border-gray-800 cursor-crosshair"
                onMouseDown={addFurnitureByDragStart}
                onMouseMove={handleFurnitureCanvasMouseMove}
                onMouseUp={handleFurnitureCanvasMouseUp}
                onMouseLeave={handleFurnitureCanvasMouseUp}
              >
                <defs>
                  <pattern id="placementGrid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
                    <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="#efefef" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width={room.width} height={room.height} fill="url(#placementGrid)" />

                {rooms.map((r) => (
                  <rect key={r.id} x={r.x} y={r.y} width={r.width} height={r.height} fill="#dbeafe55" stroke="#60a5fa" strokeWidth="2" />
                ))}

                {walls.map((wall) => (
                  <line
                    key={wall.id}
                    x1={wall.start.x}
                    y1={wall.start.y}
                    x2={wall.end.x}
                    y2={wall.end.y}
                    stroke="#111827"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                ))}

                {placedFurniture.map((item) => (
                  <g key={item.id}>
                    <rect
                      x={item.x}
                      y={item.y}
                      width={item.width}
                      height={item.height}
                      fill={item.color}
                      stroke="#334155"
                      strokeWidth={selectedFurnitureId === item.id ? '3' : '2'}
                      rx="6"
                      onMouseDown={(evt) => startFurnitureMove(evt, item)}
                    />
                    <text x={item.x + 8} y={item.y + 18} fontSize="12" fill="#0f172a">
                      {item.name}
                    </text>
                    {selectedFurnitureId === item.id && (
                      <>
                        <circle cx={item.x} cy={item.y} r="6" fill="#0f172a" onMouseDown={(evt) => startFurnitureResize(evt, item, 'nw')} />
                        <circle cx={item.x + item.width} cy={item.y} r="6" fill="#0f172a" onMouseDown={(evt) => startFurnitureResize(evt, item, 'ne')} />
                        <circle cx={item.x} cy={item.y + item.height} r="6" fill="#0f172a" onMouseDown={(evt) => startFurnitureResize(evt, item, 'sw')} />
                        <circle cx={item.x + item.width} cy={item.y + item.height} r="6" fill="#0f172a" onMouseDown={(evt) => startFurnitureResize(evt, item, 'se')} />
                      </>
                    )}
                  </g>
                ))}

                {previewItems.map((item) => (
                  <rect
                    key={`preview-${item.id}`}
                    x={item.x}
                    y={item.y}
                    width={item.width}
                    height={item.height}
                    fill="none"
                    stroke="#7c3aed"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />
                ))}

                {currentDraftFurnitureRect &&
                  currentDraftFurnitureRect.width > 0 &&
                  currentDraftFurnitureRect.height > 0 && (
                    <rect
                      x={currentDraftFurnitureRect.x}
                      y={currentDraftFurnitureRect.y}
                      width={currentDraftFurnitureRect.width}
                      height={currentDraftFurnitureRect.height}
                      fill={`${furnitureColorInput}66`}
                      stroke="#334155"
                      strokeWidth="2"
                      strokeDasharray="6 4"
                    />
                  )}
              </svg>
            </div>

            <div className="w-full xl:w-96 space-y-4">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="font-semibold mb-3">가구 추가</h3>
                <div className="space-y-3">
                  <div>
                    <label htmlFor="furniture-type" className="block text-sm text-gray-700 mb-1">
                      가구 종류 이름
                    </label>
                    <input
                      id="furniture-type"
                      value={furnitureTypeInput}
                      onChange={(evt) => setFurnitureTypeInput(evt.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                      placeholder="예: 침대, 테이블, 수납장"
                    />
                  </div>
                  <div>
                    <label htmlFor="furniture-color" className="block text-sm text-gray-700 mb-1">
                      가구 색상
                    </label>
                    <input
                      id="furniture-color"
                      type="color"
                      value={furnitureColorInput}
                      onChange={(evt) => setFurnitureColorInput(evt.target.value)}
                      className="w-full h-10 border border-gray-300 rounded px-1 py-1"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  캔버스에서 드래그하면 선택한 종류의 가구가 그 크기로 생성됩니다.
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  생성된 가구는 드래그 이동, 모서리 핸들로 크기 조절이 가능합니다.
                </p>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="font-semibold mb-3">자동 추천</h3>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button onClick={runAutoPlacement} className="py-2 rounded bg-emerald-100 text-emerald-900 font-semibold">
                    자동 배치 실행
                  </button>
                  <button onClick={clearFurniture} className="py-2 rounded bg-rose-100 text-rose-900 font-semibold">
                    가구 초기화
                  </button>
                </div>
                <button onClick={generateAiRecommendations} className="w-full py-2 rounded bg-violet-100 text-violet-900 font-semibold mb-3">
                  AI 추천 배치 생성
                </button>
                <div className="space-y-2">
                  {aiRecommendations.length === 0 ? (
                    <p className="text-xs text-gray-500">AI 추천 배치를 생성하면 후보안이 표시됩니다.</p>
                  ) : (
                    aiRecommendations.map((layout) => (
                      <div key={layout.id} className="border border-gray-200 rounded p-2">
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="font-semibold">{layout.name}</span>
                          <span className="text-gray-500">점수 {layout.score}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setPreviewAiId(layout.id)}
                            className={`py-1 rounded text-sm ${previewAiId === layout.id ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                          >
                            미리보기
                          </button>
                          <button
                            onClick={() => applyAiRecommendation(layout.id)}
                            className="py-1 rounded text-sm bg-indigo-600 text-white"
                          >
                            적용
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="font-semibold mb-3">현재 배치</h3>
                <p className="text-sm text-gray-700 mb-2">배치된 가구: {placedFurniture.length}개</p>
                <div className="max-h-56 overflow-auto space-y-2">
                  {placedFurniture.length === 0 ? (
                    <p className="text-xs text-gray-500">아직 배치된 가구가 없습니다.</p>
                  ) : (
                    placedFurniture.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-sm bg-gray-50 rounded px-2 py-1">
                        <span>{item.name} ({item.x}, {item.y})</span>
                        <button
                          onClick={() => setPlacedFurniture((prev) => prev.filter((f) => f.id !== item.id))}
                          className="text-rose-600 font-semibold"
                        >
                          삭제
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <button
                onClick={() => setActiveTab('editor')}
                className="w-full px-4 py-2 rounded-md bg-indigo-600 text-white font-semibold"
              >
                도면 편집으로 돌아가기
              </button>

              <div className="bg-white rounded-lg border border-gray-200 p-4 text-sm text-gray-600">
                <p>벽 개수: {stats.wallCount}</p>
                <p>방 개수: {stats.roomCount}</p>
                <p>총 방 면적: {stats.totalArea.toFixed(2)}m²</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3">
          <svg
            width={room.width}
            height={room.height}
            className="bg-white border-2 border-gray-800 cursor-crosshair"
            onClick={handleCanvasClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <defs>
              <pattern id="smallGrid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
                <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="#ececec" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width={room.width} height={room.height} fill="url(#smallGrid)" />

            {rooms.map((r) => (
              <g key={r.id}>
                <rect x={r.x} y={r.y} width={r.width} height={r.height} fill="#bfdbfe66" stroke="#2563eb" strokeWidth="2" />
                <text x={r.x + 8} y={r.y + 18} fontSize="12" fill="#1e3a8a">
                  {Math.round((r.width * r.height) / 10000)}m²
                </text>
              </g>
            ))}

            {currentDraftRect && currentDraftRect.width > 0 && currentDraftRect.height > 0 && (
              <rect
                x={currentDraftRect.x}
                y={currentDraftRect.y}
                width={currentDraftRect.width}
                height={currentDraftRect.height}
                fill="#93c5fd44"
                stroke="#1d4ed8"
                strokeWidth="2"
                strokeDasharray="6 4"
              />
            )}

            {walls.map((wall) => (
              <line
                key={wall.id}
                x1={wall.start.x}
                y1={wall.start.y}
                x2={wall.end.x}
                y2={wall.end.y}
                stroke="#111827"
                strokeWidth="6"
                strokeLinecap="round"
              />
            ))}

            {lineStart && (
              <circle cx={lineStart.x} cy={lineStart.y} r="6" fill="#dc2626" />
            )}
          </svg>
        </div>

        <div className="w-full lg:w-80 space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="font-semibold mb-3">도구</h2>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={() => {
                  setTool('wall');
                  setDraftRoom(null);
                }}
                className={`py-2 rounded text-sm font-semibold ${tool === 'wall' ? 'bg-indigo-600 text-white' : 'bg-gray-100'}`}
              >
                벽 그리기
              </button>
              <button
                onClick={() => {
                  setTool('room');
                  setLineStart(null);
                }}
                className={`py-2 rounded text-sm font-semibold ${tool === 'room' ? 'bg-indigo-600 text-white' : 'bg-gray-100'}`}
              >
                방 그리기
              </button>
            </div>
            <div className="text-xs text-gray-600 space-y-1">
              <p>- 벽: 시작점 클릭 후 끝점 클릭</p>
              <p>- 방: 드래그해서 사각형 생성</p>
              <p>- 그리드 단위: 20px (스냅 적용)</p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="font-semibold mb-3">편집</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button onClick={undo} className="py-2 rounded bg-amber-100 text-amber-900 font-semibold">
                실행 취소
              </button>
              <button onClick={resetAll} className="py-2 rounded bg-rose-100 text-rose-900 font-semibold">
                전체 초기화
              </button>
              <button
                onClick={openNextTab}
                disabled={!isPlanCompleted}
                className={`py-2 rounded font-semibold sm:col-span-2 ${
                  isPlanCompleted ? 'bg-emerald-100 text-emerald-900' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                도면 완성 후 다음 작업 열기
              </button>
            </div>
            {!isPlanCompleted && (
              <p className="mt-2 text-xs text-gray-500">다음 단계로 이동하려면 벽 1개 이상, 방 1개 이상을 그려주세요.</p>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="font-semibold mb-3">도면 정보</h2>
            <div className="space-y-1 text-sm text-gray-700">
              <p>벽 개수: {stats.wallCount}</p>
              <p>방 개수: {stats.roomCount}</p>
              <p>총 방 면적: {stats.totalArea.toFixed(2)}m²</p>
            </div>
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
};

export default InteriorPlanner;
