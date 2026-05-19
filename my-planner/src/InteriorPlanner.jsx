import React, { useRef, useState, useEffect } from 'react';

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
  const [customFurnitureName, setCustomFurnitureName] = useState('');
  const [placedFurniture, setPlacedFurniture] = useState([]);
  const [selectedFurnitureId, setSelectedFurnitureId] = useState(null);
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [previewAiId, setPreviewAiId] = useState(null);
  const nextIdRef = useRef(Date.now());

  // 테스트용 전역 API: 자동 테스트에서 방/가구를 주입할 수 있도록 함
  useEffect(() => {
    window.__planner = window.__planner || {};
    window.__planner.addRoom = (r) => {
      setRooms(prev => [...prev, { id: r.id || Date.now(), x: r.x, y: r.y, width: r.width, height: r.height, name: r.name || '방', pyeong: r.pyeong || 0, area: r.area || null }]);
    };
    window.__planner.addFurniture = (f) => {
      setPlacedFurniture(prev => [...prev, { id: f.id || ++nextIdRef.current, name: f.name, x: f.x, y: f.y, width: f.width, height: f.height, color: f.color || '#93c5fd' }]);
    };
    return () => { if (window.__planner) { delete window.__planner.addRoom; delete window.__planner.addFurniture; } };
  }, []);

  // --- [방 정보 입력] ---
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [pendingRoom, setPendingRoom] = useState(null);
  const [roomNameInput, setRoomNameInput] = useState('거실');
  const [roomAreaInput, setRoomAreaInput] = useState('');
  // 가구 쌍 옵션 (사용자가 선택해서 활성화할 수 있음)
  const [pairOptions, setPairOptions] = useState([
    { id: 'desk-chair', primary: '책상', secondary: '의자', enabled: true },
    { id: 'dressing-stool', primary: '화장대', secondary: '스툴', enabled: false },
    { id: 'table-chairs', primary: '식탁', secondary: '식탁의자', enabled: false },
    { id: 'sofa-table', primary: '소파', secondary: '소파테이블', enabled: false },
    { id: 'bed-nightstand', primary: '침대', secondary: '협탁', enabled: false }
  ]);

  // --- [유틸리티] ---
  const snap = (value) => Math.round(value / gridSize) * gridSize;
  const getPoint = (evt) => {
    const rect = evt.currentTarget.getBoundingClientRect();
    return { x: snap(evt.clientX - rect.left), y: snap(evt.clientY - rect.top) };
  };

  // 면적 계산 (20px = 1m, 1평 = 3.3m²)
  const calculateArea = (width, height) => {
    const squareMeters = (width * height) / (gridSize * gridSize);
    const pyeong = (squareMeters / 3.3).toFixed(1);
    return { squareMeters: squareMeters.toFixed(1), pyeong };
  };

  const getTotalArea = () => {
    if (rooms.length === 0) return { total: 0, rooms: [] };
    let totalPyeong = 0;
    const roomDetails = rooms.map(r => {
      const area = calculateArea(r.width, r.height);
      totalPyeong += parseFloat(area.pyeong);
      return { ...r, area };
    });
    return { total: totalPyeong.toFixed(1), rooms: roomDetails };
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

    const activePairs = pairOptions.filter(p => p.enabled);
    const pairedItemIds = new Set();

    const groupedItems = activePairs.flatMap(pair => {
      const primary = sorted.find(item => item.name === pair.primary && !pairedItemIds.has(item.id));
      const secondary = sorted.find(item => item.name === pair.secondary && !pairedItemIds.has(item.id));
      if (!primary || !secondary) return [];
      pairedItemIds.add(primary.id);
      pairedItemIds.add(secondary.id);
      return [
        { ...primary, pairId: pair.id, pairRole: 'primary' },
        { ...secondary, pairId: pair.id, pairRole: 'secondary' }
      ];
    });

    const ungrouped = sorted.filter(item => !pairedItemIds.has(item.id));
    const orderedItems = [...groupedItems, ...ungrouped];

    const generateLayout = (type) => {
      const result = [];
      const groupPlacement = {};
      let cx = baseRoom.x + margin, cy = baseRoom.y + margin, rh = 0;

      const getAdjacentSpots = (base, item) => {
        return [
          { x: base.x + base.width + margin, y: base.y },
          { x: base.x - item.width - margin, y: base.y },
          { x: base.x, y: base.y + base.height + margin },
          { x: base.x, y: base.y - item.height - margin },
          { x: base.x + base.width + margin, y: base.y + base.height - item.height },
          { x: base.x - item.width - margin, y: base.y + base.height - item.height },
          { x: base.x + base.width + margin, y: base.y - item.height },
          { x: base.x - item.width - margin, y: base.y - item.height }
        ];
      };

      orderedItems.forEach((item) => {
        let placed = false, attempts = 0;
        const groupBase = item.pairId && item.pairRole === 'secondary' ? groupPlacement[item.pairId] : null;

        while (!placed && attempts < 50) {
          let tx, ty;

          if (groupBase) {
            const candidates = getAdjacentSpots(groupBase, item);
            const spot = candidates[attempts % candidates.length];
            tx = spot.x;
            ty = spot.y;
            if (attempts >= candidates.length) {
              tx = baseRoom.x + margin + Math.random() * (baseRoom.width - item.width - margin * 2);
              ty = baseRoom.y + margin + Math.random() * (baseRoom.height - item.height - margin * 2);
            }
          } else if (type === 'rest') {
            const cand = [
              {x:baseRoom.x+margin, y:baseRoom.y+margin},
              {x:baseRoom.x+baseRoom.width-item.width-margin, y:baseRoom.y+margin},
              {x:baseRoom.x+margin, y:baseRoom.y+baseRoom.height-item.height-margin},
              {x:baseRoom.x+baseRoom.width-item.width-margin, y:baseRoom.y+baseRoom.height-item.height-margin}
            ];
            tx = cand[attempts % 4].x; ty = cand[attempts % 4].y;
            if (attempts > 4) {
              tx = baseRoom.x + margin + (Math.random() * (baseRoom.width - item.width - margin * 2));
              ty = baseRoom.y + margin + (Math.random() * (baseRoom.height - item.height - margin * 2));
            }
          } else {
            if (cx + item.width + margin > baseRoom.x + baseRoom.width - margin) { cx = baseRoom.x + margin; cy += rh + margin; rh = 0; }
            tx = cx; ty = cy;
          }

          const test = { ...item, x: snap(tx), y: snap(ty) };
          if (!groupBase) {
            test.x = Math.max(baseRoom.x, Math.min(test.x, baseRoom.x + baseRoom.width - item.width));
            test.y = Math.max(baseRoom.y, Math.min(test.y, baseRoom.y + baseRoom.height - item.height));
          }

          if (isValidPosition(test, result, baseRoom)) {
            result.push(test);
            if (item.pairId && item.pairRole === 'primary') {
              groupPlacement[item.pairId] = test;
            }
            if (type === 'grid') { cx += item.width + margin; rh = Math.max(rh, item.height); }
            placed = true;
          } else {
            attempts += 1;
            if (!groupBase) {
              cx += 20;
            }
          }

          if (attempts === 49 && !placed) {
            let forcedX = baseRoom.x + margin;
            let forcedY = baseRoom.y + margin;
            if (forcedX + item.width > baseRoom.x + baseRoom.width - margin) {
              forcedX = baseRoom.x + baseRoom.width - item.width - margin;
            }
            if (forcedY + item.height > baseRoom.y + baseRoom.height - margin) {
              forcedY = baseRoom.y + baseRoom.height - item.height - margin;
            }
            forcedX = Math.max(baseRoom.x, forcedX);
            forcedY = Math.max(baseRoom.y, forcedY);
            const forced = { ...item, x: snap(forcedX), y: snap(forcedY) };
            result.push(forced);
            if (item.pairId && item.pairRole === 'primary') {
              groupPlacement[item.pairId] = forced;
            }
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
    // 선택된 가구 드래그 처리
    if (selectedFurnitureId && activeTab === 'placement' && tool !== 'delete') {
      const baseRoom = rooms[0];
      const furniture = placedFurniture.find(f => f.id === selectedFurnitureId);
      if (furniture && baseRoom) {
        // 마우스 위치가 가구의 중심이 되도록 계산
        const newX = snap(Math.max(baseRoom.x, Math.min(p.x, baseRoom.x + baseRoom.width - furniture.width)));
        const newY = snap(Math.max(baseRoom.y, Math.min(p.y, baseRoom.y + baseRoom.height - furniture.height)));
        
        const movedFurniture = { ...furniture, x: newX, y: newY };
        // 다른 가구와의 충돌만 확인 (경계는 이미 위에서 처리)
        const otherFurniture = placedFurniture.filter(f => f.id !== selectedFurnitureId);
        const hasCollision = otherFurniture.some(f => checkCollision(movedFurniture, f));
        
        if (!hasCollision) {
          setPlacedFurniture(placedFurniture.map(f => f.id === selectedFurnitureId ? movedFurniture : f));
        }
      }
    }
  };

  const handleMouseUp = () => {
    if (draftRoom) {
      const x = Math.min(draftRoom.start.x, draftRoom.end.x), y = Math.min(draftRoom.start.y, draftRoom.end.y);
      const w = Math.abs(draftRoom.start.x - draftRoom.end.x), h = Math.abs(draftRoom.start.y - draftRoom.end.y);
      if (w >= gridSize && h >= gridSize) { 
        saveSnapshot();
        const area = calculateArea(w, h);
        setPendingRoom({ x, y, width: w, height: h, area });
        setRoomNameInput('거실');
        setRoomAreaInput(area.pyeong);
        setShowRoomModal(true);
      }
    }
    if (draftFurniture && rooms.length > 0) {
      const rawX = Math.min(draftFurniture.start.x, draftFurniture.end.x), rawY = Math.min(draftFurniture.start.y, draftFurniture.end.y);
      const rawW = Math.abs(draftFurniture.start.x - draftFurniture.end.x), rawH = Math.abs(draftFurniture.start.y - draftFurniture.end.y);

      // 드래그가 1px 이상이면 배치 시도
      if (rawW > 0 && rawH > 0) {
        const baseRoom = rooms[0];

        // 스냅된 크기 또는 최소 그리드 크기 허용 (작은 드래그도 배치)
        let w = Math.max(snap(rawW), gridSize);
        let h = Math.max(snap(rawH), gridSize);

        // 기본 가구 크기가 너무 클 때를 대비한 제한 (방 크기보다 작게)
        w = Math.min(w, baseRoom.width - gridSize);
        h = Math.min(h, baseRoom.height - gridSize);

        // 위치 보정: 가구가 방 밖으로 나가지 않도록 조정
        let x = snap(rawX);
        let y = snap(rawY);
        if (x + w > baseRoom.x + baseRoom.width) x = baseRoom.x + baseRoom.width - w;
        if (y + h > baseRoom.y + baseRoom.height) y = baseRoom.y + baseRoom.height - h;
        x = Math.max(baseRoom.x, x);
        y = Math.max(baseRoom.y, y);

          const furnitureName = (furnitureTypeInput === '기타') ? (customFurnitureName || '기타') : furnitureTypeInput;
          const newItem = { id: ++nextIdRef.current, name: furnitureName, x, y, width: w, height: h, color: furnitureColorInput, groupId: Date.now() };

        if (isValidPosition(newItem, placedFurniture, baseRoom)) {
          setPlacedFurniture([...placedFurniture, newItem]);
        } else {
          // 충돌 시 방 내부를 스캔해 빈 영역을 찾아 배치 시도
          let placed = false;
          const step = gridSize;
          for (let yy = baseRoom.y + gridSize; yy <= baseRoom.y + baseRoom.height - h - gridSize; yy += step) {
            for (let xx = baseRoom.x + gridSize; xx <= baseRoom.x + baseRoom.width - w - gridSize; xx += step) {
              const test = { ...newItem, x: snap(xx), y: snap(yy) };
              if (isValidPosition(test, placedFurniture, baseRoom)) {
                setPlacedFurniture([...placedFurniture, test]);
                placed = true;
                break;
              }
            }
            if (placed) break;
          }
          if (!placed) {
            // 최종적으로 배치 불가하면 아무 작업 안함
            return;
          }
        }
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

  const handleSaveRoom = () => {
    if (pendingRoom) {
      const newRoom = {
        id: Date.now(),
        x: pendingRoom.x,
        y: pendingRoom.y,
        width: pendingRoom.width,
        height: pendingRoom.height,
        name: roomNameInput,
        pyeong: parseFloat(roomAreaInput),
        area: pendingRoom.area
      };
      setRooms([...rooms, newRoom]);
      setShowRoomModal(false);
      setPendingRoom(null);
    }
  };

  // 어떤 방에 어떤 가구가 속하는지 판단
  const getRoomForFurniture = (item) => {
    return rooms.find(r => item.x >= r.x && item.y >= r.y && item.x + item.width <= r.x + r.width && item.y + item.height <= r.y + r.height);
  };

  // 활성화된 쌍 옵션들을 검사해서, 특정 방에 primary는 있으나 secondary가 없는 경우를 반환
  const getMissingPairs = () => {
    const missing = [];
    const activePairs = pairOptions.filter(p => p.enabled);
    if (activePairs.length === 0 || rooms.length === 0) return missing;

    for (const room of rooms) {
      for (const p of activePairs) {
        const primaries = placedFurniture.filter(f => f.name === p.primary && getRoomForFurniture(f)?.id === room.id);
        if (primaries.length === 0) continue; // 해당 방에 primary가 없으면 문제 없음
        const secondaries = placedFurniture.filter(f => f.name === p.secondary && getRoomForFurniture(f)?.id === room.id);
        if (secondaries.length === 0) {
          missing.push({ roomId: room.id, roomName: room.name, primary: p.primary, secondary: p.secondary });
        }
      }
    }
    return missing;
  };

  const missingPairs = getMissingPairs();
  const hasMissingPairs = missingPairs.length > 0;

  // 책상-의자 같은 필수 쌍 검사 (간단 버전)
  const hasDeskWithoutChair = placedFurniture.some(f => f.name === '책상') && !placedFurniture.some(f => f.name === '의자');

  // 방에 직접 가구 배치 함수
  const placeFurnitureDirectly = () => {
    if (rooms.length === 0) return;
    const baseRoom = rooms[0];
    const margin = 30;
    
    // 방 내 임의의 위치 계산
    const randomX = baseRoom.x + margin + Math.random() * (baseRoom.width - 200 - margin * 2);
    const randomY = baseRoom.y + margin + Math.random() * (baseRoom.height - 100 - margin * 2);
    
    const furnitureName = (furnitureTypeInput === '기타') ? (customFurnitureName || '기타') : furnitureTypeInput;
    const newItem = {
      id: ++nextIdRef.current,
      name: furnitureName,
      x: snap(randomX),
      y: snap(randomY),
      width: 100,
      height: 80,
      color: furnitureColorInput,
      groupId: Date.now()
    };
    
    if (isValidPosition(newItem, placedFurniture, baseRoom)) {
      setPlacedFurniture([...placedFurniture, newItem]);
    } else {
      // 위치 조정해서 강제 배치
      newItem.x = snap(baseRoom.x + margin);
      newItem.y = snap(baseRoom.y + margin);
      setPlacedFurniture([...placedFurniture, newItem]);
    }
  };

  // 결과 분석 점수 구성 (세부 계산)
  const analysis = (() => {
    if (rooms.length === 0) return null;
    const room = rooms[0];

    const pxToMeter = (px) => px / gridSize;
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));

    const getCenter = (rect) => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });

    // line sampling intersection test (approx)
    const rectIntersectsLine = (r, x1, y1, x2, y2) => {
      const steps = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / (gridSize / 2)));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = x1 + (x2 - x1) * t;
        const y = y1 + (y2 - y1) * t;
        if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) return true;
      }
      return false;
    };

    // --- 1) 동선 점수 (circulation)
    // compute distances from each door to nearest bed and desk
    let totalDistanceM = 0;
    let obstaclePenalty = 0;
    const doorCenters = doors.map(d => ({ x: (d.start.x + d.end.x) / 2, y: (d.start.y + d.end.y) / 2 }));
    const beds = placedFurniture.filter(f => f.name === '침대');
    const desks = placedFurniture.filter(f => f.name === '책상');
    const furnitureRects = placedFurniture.map(f => ({ x: f.x, y: f.y, width: f.width, height: f.height, id: f.id }));

    doorCenters.forEach(dc => {
      // nearest bed
      const targets = [...beds, ...desks];
      targets.forEach(t => {
        const tc = getCenter(t);
        const dpx = dist(dc, tc);
        totalDistanceM += pxToMeter(dpx);
        // check obstacles along straight line
        const blocked = furnitureRects.some(r => r.id !== t.id && rectIntersectsLine(r, dc.x, dc.y, tc.x, tc.y));
        if (blocked) obstaclePenalty += 10;
      });
    });

    // narrow clearance penalty: find minimal gap between any two furniture bounding boxes
    let minGapM = Infinity;
    for (let i = 0; i < furnitureRects.length; i++) {
      for (let j = i + 1; j < furnitureRects.length; j++) {
        const a = furnitureRects[i];
        const b = furnitureRects[j];
        const gapX = Math.max(0, Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width)));
        const gapY = Math.max(0, Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height)));
        const gap = Math.hypot(gapX, gapY);
        minGapM = Math.min(minGapM, pxToMeter(gap));
      }
    }
    if (!isFinite(minGapM)) minGapM = Math.max(room.width, room.height) / gridSize; // large
    const minClearanceThreshold = 0.6; // meters
    const narrowPenalty = minGapM < minClearanceThreshold ? ((minClearanceThreshold - minGapM) / minClearanceThreshold) * 30 : 0;

    // distance penalty: 2 points per meter of travel
    const distancePenalty = totalDistanceM * 2;
    const circulationRaw = 100 - (distancePenalty + obstaclePenalty + narrowPenalty);
    const circulation = clamp(Math.round(circulationRaw), 0, 100);

    // --- 2) 채광 점수 (lighting)
    // basic model: furniture with significant height near window can reduce daylight
    const heightMap = { '침대': 0.5, '책상': 0.75, '소파': 0.8, '식탁': 0.75, '의자': 0.45, '선반': 1.8, '옷장': 2.0, '냉장고': 1.8, '세탁기': 0.9 };
    let lightPenalty = 0;
    const windowCenters = windows.map(w => ({ x: (w.start.x + w.end.x) / 2, y: (w.start.y + w.end.y) / 2 }));
    placedFurniture.forEach(f => {
      const fc = getCenter(f);
      const h = heightMap[f.name] || 1.0;
      windowCenters.forEach(wc => {
        const dM = pxToMeter(dist(fc, wc));
        if (dM < 3 && h > 1.2) {
          // tall close furniture blocks light
          lightPenalty += (3 - dM) * 8; // up to 24 points
        }
        // bed immediately in front of window causes glare penalty
        if (f.name === '침대' && dM < 1) lightPenalty += 10;
      });
    });
    const lighting = clamp(Math.round(100 - lightPenalty), 0, 100);

    // --- 3) 수납 효율 (storage)
    const storageTypes = ['옷장', '선반'];
    const roomAreaM2 = (room.width * room.height) / (gridSize * gridSize);
    let totalStorageVolume = 0;
    placedFurniture.forEach(f => {
      if (storageTypes.includes(f.name)) {
        const areaM2 = (f.width * f.height) / (gridSize * gridSize);
        const h = heightMap[f.name] || 1.8;
        const volume = areaM2 * h; // m^3
        totalStorageVolume += volume;
      }
    });
    // expected good storage volume ~ roomAreaM2 * 0.4 (m3 기준 with 0.4m height baseline)
    const expectedStorage = roomAreaM2 * 0.5; // target m3
    const storageScore = clamp(Math.round(Math.min(100, (totalStorageVolume / (expectedStorage || 1)) * 100)));

    // --- 4) 공간 활용률 (space utilization)
    const totalFurnitureAreaM2 = placedFurniture.reduce((s, f) => s + ((f.width * f.height) / (gridSize * gridSize)), 0);
    const utilizationRatio = totalFurnitureAreaM2 / (roomAreaM2 || 1);
    // ideal occupancy ~ 25% (0.25), score penalizes deviation
    const utilizationScore = clamp(Math.round(100 - (Math.abs(utilizationRatio - 0.25) / 0.25) * 100));

    // --- Total weighted score
    const totalScore = Math.round(0.5 * circulation + 0.2 * lighting + 0.2 * utilizationScore + 0.1 * storageScore);

    return {
      totalScore,
      traffic: circulation,
      light: lighting,
      space: utilizationScore,
      storage: storageScore
    };
  })();

  return (
    <div style={{ padding: '40px', backgroundColor: '#fcfaff', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center', fontSize: '32px', fontWeight: '900', marginBottom: '40px' }}>인테리어 플래너</h1>
      
      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '40px' }}>
        <button onClick={() => setActiveTab('editor')} style={{ padding: '12px 30px', borderRadius: '99px', fontWeight: 'bold', border: 'none', cursor: 'pointer', backgroundColor: activeTab === 'editor' ? '#6366f1' : '#f3f4f6', color: activeTab === 'editor' ? '#fff' : '#9ca3af' }}>1. 도면 그리기</button>
        <button onClick={() => setActiveTab('placement')} disabled={rooms.length === 0} style={{ padding: '12px 30px', borderRadius: '99px', fontWeight: 'bold', border: 'none', cursor: rooms.length > 0 ? 'pointer' : 'not-allowed', backgroundColor: activeTab === 'placement' ? '#6366f1' : '#f3f4f6', color: activeTab === 'placement' ? '#fff' : '#d1d5db' }}>2. 가구 배치</button>
        <button onClick={() => setActiveTab('results')} disabled={placedFurniture.length === 0 || hasMissingPairs} style={{ padding: '12px 30px', borderRadius: '99px', fontWeight: 'bold', border: 'none', cursor: placedFurniture.length > 0 && !hasMissingPairs ? 'pointer' : 'not-allowed', backgroundColor: activeTab === 'results' ? '#6366f1' : '#f3f4f6', color: activeTab === 'results' ? '#fff' : '#d1d5db' }}>3. 결과 분석</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '40px' }}>
        <div style={{ position: 'relative', border: '12px solid #111827', borderRadius: '24px', overflow: 'hidden', backgroundColor: '#fff', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)' }}>
          <svg width={roomCanvas.width} height={roomCanvas.height} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onClick={handleCanvasClick}>
            <defs><pattern id="grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse"><path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="#f1f5f9" strokeWidth="1" /></pattern></defs>
            <rect width={roomCanvas.width} height={roomCanvas.height} fill="url(#grid)" />
            
            {rooms.map(r => <g key={r.id}>
              <rect x={r.x} y={r.y} width={r.width} height={r.height} fill={activeTab === 'editor' ? "#60a5fa11" : "#fff"} stroke="#3b82f6" strokeWidth="2" style={{ pointerEvents: tool === 'delete' ? 'auto' : 'none' }} onClick={(e) => { if(tool === 'delete') { e.stopPropagation(); setRooms(rooms.filter(i => i.id !== r.id)); } }} />
              <text x={r.x + 8} y={r.y + 25} fontSize="14" fontWeight="bold" fill="#1e293b">{r.name}</text>
              <text x={r.x + 8} y={r.y + 45} fontSize="12" fill="#64748b">{r.pyeong}평</text>
            </g>)}
            
            {/* [수정] 도면 요소들: 지우개 모드가 아닐 때는 클릭을 통과시킴 (pointerEvents: none) */}
            {walls.map(w => <line key={w.id} x1={w.start.x} y1={w.start.y} x2={w.end.x} y2={w.end.y} stroke="#1e293b" strokeWidth="8" strokeLinecap="round" style={{ pointerEvents: tool === 'delete' ? 'auto' : 'none' }} onClick={(e) => { if(tool === 'delete') { e.stopPropagation(); setWalls(walls.filter(i=>i.id!==w.id)); } }} />)}
            {windows.map(w => <line key={w.id} x1={w.start.x} y1={w.start.y} x2={w.end.x} y2={w.end.y} stroke="#38bdf8" strokeWidth="12" strokeLinecap="square" style={{ pointerEvents: tool === 'delete' ? 'auto' : 'none' }} onClick={(e) => { if(tool === 'delete') { e.stopPropagation(); setWindows(windows.filter(i=>i.id!==w.id)); } }} />)}
            {doors.map(d => <line key={d.id} x1={d.start.x} y1={d.start.y} x2={d.end.x} y2={d.end.y} stroke="#b45309" strokeWidth="10" strokeLinecap="round" style={{ pointerEvents: tool === 'delete' ? 'auto' : 'none' }} onClick={(e) => { if(tool === 'delete') { e.stopPropagation(); setDoors(doors.filter(i=>i.id!==d.id)); } }} />)}
            
            {draftRoom && <rect x={Math.min(draftRoom.start.x, draftRoom.end.x)} y={Math.min(draftRoom.start.y, draftRoom.end.y)} width={Math.abs(draftRoom.start.x-draftRoom.end.x)} height={Math.abs(draftRoom.start.y-draftRoom.end.y)} fill="rgba(59, 130, 246, 0.3)" stroke="#2563eb" strokeWidth="2" strokeDasharray="8 4" />}
            {draftFurniture && <rect x={Math.min(draftFurniture.start.x, draftFurniture.end.x)} y={Math.min(draftFurniture.start.y, draftFurniture.end.y)} width={Math.abs(draftFurniture.start.x-draftFurniture.end.x)} height={Math.abs(draftFurniture.start.y-draftFurniture.end.y)} fill={furnitureColorInput + '66'} stroke="#334155" strokeDasharray="4 4" />}
            {lineStart && <line x1={lineStart.x} y1={lineStart.y} x2={mousePos.x} y2={mousePos.y} stroke="#ef4444" strokeWidth="2" strokeDasharray="6 4" />}
            
            {(activeTab === 'placement' || activeTab === 'results') && placedFurniture.map(f => (
              <g key={f.id} onMouseDown={(e) => { 
                e.stopPropagation();
                if(tool === 'delete') { 
                  setPlacedFurniture(placedFurniture.filter(i=>i.id!==f.id));
                } else { 
                  setSelectedFurnitureId(f.id); 
                } 
              }}>
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
              <div style={{ backgroundColor: '#f0f4ff', borderRadius: '16px', padding: '16px', marginTop: '16px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold', color: '#4338ca' }}>📐 평면도 정보</h4>
                <p style={{ margin: '6px 0', fontSize: '13px', color: '#475569' }}>총 면적: <span style={{ fontWeight: 'bold', color: '#4338ca' }}>{getTotalArea().total}평</span></p>
                {getTotalArea().rooms.length > 0 && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #c7d2fe' }}>
                    {getTotalArea().rooms.map(r => (
                      <p key={r.id} style={{ margin: '4px 0', fontSize: '12px', color: '#64748b' }}>
                        • {r.name}: {r.pyeong}평
                      </p>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button onClick={undo} style={{ flex: 1, padding: '10px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>↩ 취소</button>
                <button onClick={() => { setWalls([]); setRooms([]); setWindows([]); setDoors([]); setPlacedFurniture([]); }} style={{ flex: 1, padding: '10px', backgroundColor: '#fff1f2', color: '#e11d48', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>초기화</button>
              </div>
            </div>
          ) : activeTab === 'results' ? (
            <div style={{ padding: '24px', backgroundColor: '#fff', borderRadius: '24px', border: '2px solid #6366f1' }}>
              <h3 style={{ fontWeight: '900', fontSize: '20px', marginBottom: '20px' }}>분석 리포트</h3>
              {hasDeskWithoutChair ? (
                <div style={{ padding: '18px', borderRadius: '20px', backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: 'bold' }}>
                  📌 책상이 있으므로 반드시 방 안에 의자를 배치해야 합니다.
                  결과 분석을 위해 의자를 추가해주세요.
                </div>
              ) : (
                <>
                  <div style={{ textAlign: 'center', marginBottom: '18px' }}>
                    <div style={{ textAlign: 'center', padding: '18px', backgroundColor: '#f5f3ff', borderRadius: '16px', marginBottom: '12px' }}>
                      <p style={{ fontSize: '40px', fontWeight: '900', margin: '6px 0', color: '#4338ca' }}>{analysis?.totalScore}점</p>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>종합 점수</div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
                      <div style={{ flex: 1, padding: '12px', backgroundColor: '#f8fafc', borderRadius: '12px', textAlign: 'center', border: '1px solid #e6eefc' }}>
                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>🚶 동선</div>
                        <div style={{ fontSize: '22px', fontWeight: '800', color: '#0ea5e9' }}>{analysis?.traffic}점</div>
                      </div>
                      <div style={{ flex: 1, padding: '12px', backgroundColor: '#f8fafc', borderRadius: '12px', textAlign: 'center', border: '1px solid #f0e6ff' }}>
                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>☀️ 채광</div>
                        <div style={{ fontSize: '22px', fontWeight: '800', color: '#f59e0b' }}>{analysis?.light}점</div>
                      </div>
                      <div style={{ flex: 1, padding: '12px', backgroundColor: '#f8fafc', borderRadius: '12px', textAlign: 'center', border: '1px solid #eef6e9' }}>
                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>📦 공간</div>
                        <div style={{ fontSize: '22px', fontWeight: '800', color: '#10b981' }}>{analysis?.space}점</div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div style={{ padding: '24px', backgroundColor: '#fff', borderRadius: '24px', border: '1px solid #e5e7eb' }}>
              <h3 style={{ fontWeight: '900', marginBottom: '20px' }}>가구 관리</h3>
              <select value={furnitureTypeInput} onChange={e => setFurnitureTypeInput(e.target.value)} style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '12px', marginBottom: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                <option>침대</option>
                <option>책상</option>
                <option>소파</option>
                <option>식탁</option>
                <option>의자</option>
                <option>선반</option>
                <option>옷장</option>
                <option>세탁기</option>
                <option>냉장고</option>
                <option>기타</option>
              </select>
              {furnitureTypeInput === '기타' && (
                <input
                  type="text"
                  placeholder="가구 이름 입력 (예: 러그)"
                  value={customFurnitureName}
                  onChange={e => setCustomFurnitureName(e.target.value)}
                  style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '12px', marginBottom: '10px' }}
                />
              )}
              <input type="color" value={furnitureColorInput} onChange={e => setFurnitureColorInput(e.target.value)} style={{ width: '100%', height: '44px', border: 'none', borderRadius: '12px', cursor: 'pointer', marginBottom: '20px' }} />
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                <button onClick={generateAiRecommendations} style={{ flex: 1, padding: '18px', backgroundColor: '#a855f7', color: '#fff', borderRadius: '18px', fontWeight: '900', border: 'none', cursor: 'pointer' }}>AI 배치</button>
                <button onClick={placeFurnitureDirectly} style={{ flex: 1, padding: '18px', backgroundColor: '#6366f1', color: '#fff', borderRadius: '18px', fontWeight: '900', border: 'none', cursor: 'pointer' }}>방에 추가</button>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <h4 style={{ margin: '8px 0', fontSize: '13px', fontWeight: '800' }}>가구 쌍 규칙 (선택)</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {pairOptions.map(p => (
                    <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                      <input type="checkbox" checked={p.enabled} onChange={() => setPairOptions(pairOptions.map(x => x.id === p.id ? { ...x, enabled: !x.enabled } : x))} />
                      <span style={{ color: '#374151' }}>{p.primary} → {p.secondary}</span>
                    </label>
                  ))}
                </div>
              </div>

              {missingPairs.length > 0 && (
                <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#fff7ed', color: '#92400e', fontWeight: '700', marginBottom: '12px' }}>
                  <div>📌 누락된 쌍 발견:</div>
                  {missingPairs.map((m, idx) => (
                    <div key={idx} style={{ fontSize: '13px', marginTop: '6px' }}>• {m.roomName}: {m.primary}에 대해 {m.secondary}이(가) 없습니다.</div>
                  ))}
                  <div style={{ fontSize: '12px', marginTop: '6px', fontWeight: '600' }}>가구 목록에서 <strong>의자</strong>를 선택해 방 안에 직접 배치하세요.</div>
                </div>
              )}
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

      {/* [방 정보 입력 모달] */}
      {showRoomModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '24px', padding: '32px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', width: '90%', maxWidth: '400px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '24px', margin: '0 0 24px 0' }}>방 정보 입력</h2>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#475569' }}>방 이름</label>
              <select 
                value={roomNameInput} 
                onChange={e => setRoomNameInput(e.target.value)}
                style={{ width: '100%', padding: '12px', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                <option>거실</option>
                <option>주방</option>
                <option>침실</option>
                <option>방</option>
                <option>욕실</option>
                <option>화장실</option>
                <option>창고</option>
                <option>복도</option>
                <option>기타</option>
              </select>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#475569' }}>면적 (평)</label>
              <input 
                type="number" 
                step="0.1"
                value={roomAreaInput} 
                onChange={e => setRoomAreaInput(e.target.value)}
                style={{ width: '100%', padding: '12px', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '14px' }}
                placeholder="예: 24"
              />
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: '8px 0 0 0' }}>자동 계산된 면적: {roomAreaInput}평 (약 {(parseFloat(roomAreaInput) * 3.3).toFixed(1)}m²)</p>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setShowRoomModal(false)}
                style={{ flex: 1, padding: '14px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}
              >
                취소
              </button>
              <button 
                onClick={handleSaveRoom}
                style={{ flex: 1, padding: '14px', backgroundColor: '#6366f1', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}
              >
                완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InteriorPlanner;