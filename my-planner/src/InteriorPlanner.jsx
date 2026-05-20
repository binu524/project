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
  const [doors, setDoors] = useState([]); // 문은 이제 { id, start, end, swingSide } 형태를 가집니다.
  const [history, setHistory] = useState([]); 
  const [lineStart, setLineStart] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [draftRoom, setDraftRoom] = useState(null); 
  const [draftFurniture, setDraftFurniture] = useState(null); 
  const [isDragging, setIsDragging] = useState(false);

  // --- [배율(Scale) 시스템 상태] ---
  const [pxPerMeter, setPxPerMeter] = useState(20); 
  const [isScaleSet, setIsScaleSet] = useState(false);
  const [showScaleModal, setShowScaleModal] = useState(false);
  const [pendingWallLengthPx, setPendingWallLengthPx] = useState(0);

  // 방 정보 모달 상태
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [pendingRoom, setPendingRoom] = useState(null);
  const [roomType, setRoomType] = useState('거실');
  const [customRoomType, setCustomRoomType] = useState('');
  const [roomAreaInput, setRoomAreaInput] = useState('');

  // 가구 관련 상태
  const [furnitureTypeInput, setFurnitureTypeInput] = useState('침대');
  const [customFurnitureName, setCustomFurnitureName] = useState('');
  const [furnitureColorInput, setFurnitureColorInput] = useState('#93c5fd');
  const [placedFurniture, setPlacedFurniture] = useState([]);
  
  // [NEW] 다중 선택 및 드래그 상태
  const [selectedFurnitureIds, setSelectedFurnitureIds] = useState([]);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [dragInitialFurniture, setDragInitialFurniture] = useState([]);
  
  // AI 추천 상태
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [previewAiId, setPreviewAiId] = useState(null);
  const nextIdRef = useRef(Date.now());

  // AI 가구 자동 추천에서 제외할 방 유형 정의
  const restrictedRoomTypes = ['욕실', '현관'];

  // --- [유틸리티] ---
  const snap = (value) => Math.round(value / gridSize) * gridSize;
  const getPoint = (evt) => {
    const rect = evt.currentTarget.getBoundingClientRect();
    return { x: snap(evt.clientX - rect.left), y: snap(evt.clientY - rect.top) };
  };

  const calculateArea = (width, height) => {
    const widthInMeters = width / pxPerMeter;
    const heightInMeters = height / pxPerMeter;
    const squareMeters = widthInMeters * heightInMeters;
    const pyeong = (squareMeters / 3.3).toFixed(1);
    return { squareMeters: squareMeters.toFixed(1), pyeong };
  };

  const getTotalArea = () => {
    if (rooms.length === 0) return { total: 0, rooms: [] };
    let totalPyeong = 0;
    const roomDetails = rooms.map(r => {
      totalPyeong += parseFloat(r.pyeong || 0);
      return { ...r };
    });
    return { total: totalPyeong.toFixed(1), rooms: roomDetails };
  };

  const saveSnapshot = () => {
    setHistory([...history, { 
      walls: [...walls], rooms: [...rooms], windows: [...windows], doors: [...doors], 
      placedFurniture: [...placedFurniture], pxPerMeter, isScaleSet 
    }]);
  };

  const undo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setWalls(last.walls); setRooms(last.rooms); setWindows(last.windows); setDoors(last.doors); setPlacedFurniture(last.placedFurniture);
    setPxPerMeter(last.pxPerMeter || 20); setIsScaleSet(last.isScaleSet || false);
    setHistory(history.slice(0, -1));
  };

  const checkCollision = (r1, r2) => (
    r1.x < r2.x + r2.width && r1.x + r1.width > r2.x &&
    r1.y < r2.y + r2.height && r1.y + r1.height > r2.y
  );

  // [강화됨] 선분(벽)-사각형 충돌 교차 알고리즘 (벽 통과 완벽 차단)
  const checkWallCollision = (furniture, wall) => {
    const eps = 0.5; // 가장자리 밀착은 허용하기 위한 미세 여백
    const fLeft = furniture.x + eps; const fRight = furniture.x + furniture.width - eps;
    const fTop = furniture.y + eps; const fBottom = furniture.y + furniture.height - eps;

    const x1 = wall.start.x; const y1 = wall.start.y;
    const x2 = wall.end.x; const y2 = wall.end.y;

    if (x1 > fLeft && x1 < fRight && y1 > fTop && y1 < fBottom) return true;
    if (x2 > fLeft && x2 < fRight && y2 > fTop && y2 < fBottom) return true;

    const lineIntersect = (a, b, c, d, p, q, r, s) => {
      const det = (c - a) * (s - q) - (r - p) * (d - b);
      if (det === 0) return false;
      const lambda = ((s - q) * (r - a) + (p - r) * (s - b)) / det;
      const gamma = ((b - d) * (r - a) + (c - a) * (s - b)) / det;
      return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
    };

    if (lineIntersect(x1, y1, x2, y2, fLeft, fTop, fRight, fTop)) return true;
    if (lineIntersect(x1, y1, x2, y2, fLeft, fBottom, fRight, fBottom)) return true;
    if (lineIntersect(x1, y1, x2, y2, fLeft, fTop, fLeft, fBottom)) return true;
    if (lineIntersect(x1, y1, x2, y2, fRight, fTop, fRight, fBottom)) return true;

    return false;
  };

  // [NEW] 문의 열림 반경(부채꼴) 사각형 충돌 범위 반환
  const getDoorSwingBox = (door) => {
    const dx = door.end.x - door.start.x;
    const dy = door.end.y - door.start.y;
    const r = Math.hypot(dx, dy);
    const theta = Math.atan2(dy, dx);
    const side = door.swingSide || 1;
    const ox = door.start.x + r * Math.cos(theta + side * Math.PI / 2);
    const oy = door.start.y + r * Math.sin(theta + side * Math.PI / 2);

    const minX = Math.min(door.start.x, door.end.x, ox);
    const maxX = Math.max(door.start.x, door.end.x, ox);
    const minY = Math.min(door.start.y, door.end.y, oy);
    const maxY = Math.max(door.start.y, door.end.y, oy);

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  };

  // 통합 유효성 검사
  const isValidPosition = (movingItem, allItems, intendedRoomId = null) => {
    if (walls.length === 0 && rooms.length === 0) return true;
    
    let minX = 9999, minY = 9999, maxX = 0, maxY = 0;
    
    if (rooms.length > 0) {
      rooms.forEach(r => {
        if (r.x < minX) minX = r.x; if (r.y < minY) minY = r.y;
        if (r.x + r.width > maxX) maxX = r.x + r.width; if (r.y + r.height > maxY) maxY = r.y + r.height;
      });
    }
    
    if (walls.length > 0) {
      walls.forEach(w => {
        const x1 = Math.min(w.start.x, w.end.x), x2 = Math.max(w.start.x, w.end.x);
        const y1 = Math.min(w.start.y, w.end.y), y2 = Math.max(w.start.y, w.end.y);
        if (x1 < minX) minX = x1; if (y1 < minY) minY = y1;
        if (x2 > maxX) maxX = x2; if (y2 > maxY) maxY = y2;
      });
    }

    if (minX === 9999) { minX = 0; minY = 0; maxX = roomCanvas.width; maxY = roomCanvas.height; }

    const isInsideHouse = (
      movingItem.x >= minX && movingItem.y >= minY && 
      movingItem.x + movingItem.width <= maxX && movingItem.y + movingItem.height <= maxY
    );
    if (!isInsideHouse) return false;

    // 벽 관통 충돌 차단
    if (walls.some(w => checkWallCollision(movingItem, w))) return false;

    // 문 회전 반경(부채꼴) 침범 차단
    const hitsDoorSwing = doors.some(d => {
      const box = getDoorSwingBox(d);
      const eps = 1.0; 
      return checkCollision(movingItem, { x: box.x + eps, y: box.y + eps, width: box.width - 2*eps, height: box.height - 2*eps });
    });
    if (hitsDoorSwing) return false;

    const cx = movingItem.x + movingItem.width / 2;
    const cy = movingItem.y + movingItem.height / 2;
    const hostRoom = rooms.find(r => cx >= r.x && cx <= r.x + r.width && cy >= r.y && cy <= r.y + r.height);
    
    if (intendedRoomId) {
      if (intendedRoomId === 'outer-space') {
        if (hostRoom) return false; 
      } else {
        if (!hostRoom || hostRoom.id !== intendedRoomId) return false;
        const isInsideHost = (
          movingItem.x >= hostRoom.x && movingItem.y >= hostRoom.y &&
          movingItem.x + movingItem.width <= hostRoom.x + hostRoom.width &&
          movingItem.y + movingItem.height <= hostRoom.y + hostRoom.height
        );
        if (!isInsideHost) return false;
      }
    } else {
      if (hostRoom) {
        const isInsideHost = (
          movingItem.x >= hostRoom.x && movingItem.y >= hostRoom.y &&
          movingItem.x + movingItem.width <= hostRoom.x + hostRoom.width &&
          movingItem.y + movingItem.height <= hostRoom.y + hostRoom.height
        );
        if (!isInsideHost) return false;
      }
    }

    // 다른 가구와 겹침 차단
    return !allItems.some(item => item.id !== movingItem.id && checkCollision(movingItem, item));
  };

  const getRoomForFurniture = (item) => {
    const cx = item.x + item.width / 2;
    const cy = item.y + item.height / 2;
    const found = rooms.find(r => cx >= r.x && cx <= r.x + r.width && cy >= r.y && cy <= r.y + r.height);
    if (found) return found;

    let minX = 0, minY = 0, maxX = roomCanvas.width, maxY = roomCanvas.height;
    if (rooms.length > 0) {
      minX = Math.min(...rooms.map(r => r.x)); minY = Math.min(...rooms.map(r => r.y));
      maxX = Math.max(...rooms.map(r => r.x + r.width)); maxY = Math.max(...rooms.map(r => r.y + r.height));
    } else if (walls.length > 0) {
      minX = Math.min(...walls.flatMap(w => [w.start.x, w.end.x]));
      minY = Math.min(...walls.flatMap(w => [w.start.y, w.end.y]));
      maxX = Math.max(...walls.flatMap(w => [w.start.x, w.end.x]));
      maxY = Math.max(...walls.flatMap(w => [w.start.y, w.end.y]));
    }
    return { id: 'outer-space', x: minX, y: minY, width: maxX - minX, height: maxY - minY, name: '외곽영역' };
  };

  const handleSaveScale = (meters) => {
    if (meters > 0 && pendingWallLengthPx > 0) {
      setPxPerMeter(pendingWallLengthPx / meters);
      setIsScaleSet(true);
    }
    setShowScaleModal(false);
  };

  const handleSaveRoom = () => {
    if (pendingRoom) {
      const finalName = roomType === '기타' ? (customRoomType || '기타') : roomType;
      setRooms([...rooms, {
        id: Date.now(),
        x: pendingRoom.x, y: pendingRoom.y, width: pendingRoom.width, height: pendingRoom.height,
        name: finalName, pyeong: parseFloat(roomAreaInput) || 0
      }]);
      setShowRoomModal(false);
      setPendingRoom(null);
      setCustomRoomType('');
    }
  };

  const handleAddFurnitureClick = () => {
    let targetBox = { x: 40, y: 40, width: roomCanvas.width - 80, height: roomCanvas.height - 80 };
    const validRooms = rooms.filter(r => !restrictedRoomTypes.includes(r.name));
    
    if (validRooms.length > 0) {
      targetBox = [...validRooms].sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
    } else if (rooms.length > 0) {
      targetBox = [...rooms].sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
    } else if (walls.length > 0) {
      const minX = Math.min(...walls.flatMap(w => [w.start.x, w.end.x]));
      const minY = Math.min(...walls.flatMap(w => [w.start.y, w.end.y]));
      const maxX = Math.max(...walls.flatMap(w => [w.start.x, w.end.x]));
      const maxY = Math.max(...walls.flatMap(w => [w.start.y, w.end.y]));
      targetBox = { x: minX + 10, y: minY + 10, width: (maxX - minX) - 20, height: (maxY - minY) - 20 };
    }
    
    const furnitureName = furnitureTypeInput === '기타' ? (customFurnitureName || '기타') : furnitureTypeInput;
    const newItem = { 
      id: ++nextIdRef.current, name: furnitureName, 
      x: 0, y: 0, width: 100, height: 80, color: furnitureColorInput, isLocked: false 
    };

    let placed = false;
    for (let ty = targetBox.y; ty <= targetBox.y + targetBox.height - newItem.height; ty += 10) {
      for (let tx = targetBox.x; tx <= targetBox.x + targetBox.width - newItem.width; tx += 10) {
        const testItem = { ...newItem, x: snap(tx), y: snap(ty) };
        if (isValidPosition(testItem, placedFurniture)) {
          setPlacedFurniture([...placedFurniture, testItem]);
          placed = true;
          break;
        }
      }
      if (placed) break;
    }

    if (!placed) alert("벽이나 제한 영역을 피해서 가구를 추가할 공간을 찾지 못했습니다.");
  };

  // --- [AI 추천 알고리즘 수정 (마진 제로화 + 그룹 인식)] ---
  const generateAiRecommendations = () => {
    if (placedFurniture.length === 0) return;

    const generateLayout = (type) => {
      const result = [...placedFurniture.filter(f => f.isLocked)];
      const layoutItems = [];
      const processed = new Set();

      // 1. 잠기지 않은 가구들을 그룹 여부에 따라 합치기(Pack)
      placedFurniture.filter(f => !f.isLocked).forEach(f => {
        if (processed.has(f.id)) return;
        if (f.groupId) {
          const group = placedFurniture.filter(g => g.groupId === f.groupId);
          group.forEach(g => processed.add(g.id));
          const minX = Math.min(...group.map(g => g.x)); const minY = Math.min(...group.map(g => g.y));
          const maxX = Math.max(...group.map(g => g.x + g.width)); const maxY = Math.max(...group.map(g => g.y + g.height));
          layoutItems.push({
            isGroup: true, items: group.map(g => ({ ...g, offsetX: g.x - minX, offsetY: g.y - minY })),
            id: 'group-' + f.groupId, name: group[0].name + ' 세트',
            x: minX, y: minY, width: maxX - minX, height: maxY - minY,
          });
        } else {
          processed.add(f.id);
          layoutItems.push({ ...f, isGroup: false });
        }
      });

      layoutItems.sort((a, b) => (b.width * b.height) - (a.width * a.height));

      const roomCursors = {};
      rooms.forEach(r => { roomCursors[r.id] = { cx: r.x, cy: r.y, rh: 0 }; }); // Margin 0 반영

      const availableRooms = rooms.filter(r => !restrictedRoomTypes.includes(r.name));
      const fallbackRoom = availableRooms.sort((a, b) => (b.width * b.height) - (a.width * a.height))[0] || rooms[0];

      layoutItems.forEach((item) => {
        let targetRoom = getRoomForFurniture(item);
        if (restrictedRoomTypes.includes(targetRoom.name)) {
          if (fallbackRoom) targetRoom = fallbackRoom;
        }

        if (!targetRoom) { result.push({ ...item }); return; }

        let placed = false;
        let attempts = 0;
        const margin = 0; // [요청사항 반영] 벽에 완전히 밀착되도록 마진 0 적용

        while (!placed && attempts < 200) {
          let tx, ty;
          if (type === 'rest') {
            const cand = [
              {x: targetRoom.x + margin, y: targetRoom.y + margin}, 
              {x: targetRoom.x + targetRoom.width - item.width - margin, y: targetRoom.y + margin}, 
              {x: targetRoom.x + margin, y: targetRoom.y + targetRoom.height - item.height - margin}, 
              {x: targetRoom.x + targetRoom.width - item.width - margin, y: targetRoom.y + targetRoom.height - item.height - margin}
            ];
            if (attempts < 4) { tx = cand[attempts].x; ty = cand[attempts].y; } 
            else {
              tx = targetRoom.x + margin + (Math.random() * (targetRoom.width - item.width - margin * 2));
              ty = targetRoom.y + margin + (Math.random() * (targetRoom.height - item.height - margin * 2));
            }
          } else { 
            let cursor = roomCursors[targetRoom.id] || { cx: targetRoom.x, cy: targetRoom.y, rh: 0 };
            tx = cursor.cx; ty = cursor.cy;
            if (cursor.cx + item.width > targetRoom.x + targetRoom.width) { 
              cursor.cx = targetRoom.x; 
              cursor.cy += cursor.rh; 
              cursor.rh = 0; 
              tx = cursor.cx; ty = cursor.cy;
            }
          }

          const test = { ...item, x: snap(tx), y: snap(ty) };
          if (isValidPosition(test, result, targetRoom.id)) { 
            // 2. 그룹 해제 후 최종 배치 결과에 푸시(Unpack)
            if (item.isGroup) {
              item.items.forEach(subItem => {
                result.push({ ...subItem, x: test.x + subItem.offsetX, y: test.y + subItem.offsetY });
              });
            } else {
              delete test.isGroup; result.push(test);
            }

            if(type === 'grid' && roomCursors[targetRoom.id]) { 
              roomCursors[targetRoom.id].cx += item.width; 
              roomCursors[targetRoom.id].rh = Math.max(roomCursors[targetRoom.id].rh, item.height); 
            }
            placed = true; 
          } else { 
            if(type === 'grid' && roomCursors[targetRoom.id]) roomCursors[targetRoom.id].cx += gridSize;
            attempts++; 
          }
        }
        
        if (!placed) { // 실패 시 기존 위치 복구
          if (item.isGroup) {
            item.items.forEach(subItem => result.push({ ...subItem }));
          } else {
            result.push({ ...item }); 
          }
        }
      });
      return result;
    };
    
    setAiRecommendations([
      { id: 'A', name: '추천안 A (벽면 회피 안전 밀착)', score: 88, items: generateLayout('rest') },
      { id: 'B', name: '추천안 B (정렬 최적화 배치)', score: 94, items: generateLayout('grid') }
    ]);
    setPreviewAiId('A');
  };

  // --- [이벤트 핸들러] 다중 선택 및 그룹 드래그 로직 적용 ---
  const handleMouseDown = (e) => {
    const p = getPoint(e);
    setIsDragging(true);

    if (activeTab === 'editor' && tool === 'room') {
      setDraftRoom({ start: p, end: p });
    }

    if (activeTab === 'placement' && tool !== 'delete') {
      const clickedFurniture = [...placedFurniture].reverse().find(f => 
        p.x >= f.x && p.x < f.x + f.width && p.y >= f.y && p.y < f.y + f.height
      );

      if (clickedFurniture) {
        let newSelection = [...selectedFurnitureIds];
        const groupIdsToSelect = clickedFurniture.groupId ? 
          placedFurniture.filter(f => f.groupId === clickedFurniture.groupId).map(f => f.id) : 
          [clickedFurniture.id];

        if (e.shiftKey) { // Shift 클릭 시 다중 선택 토글
          if (newSelection.includes(clickedFurniture.id)) {
            newSelection = newSelection.filter(id => !groupIdsToSelect.includes(id));
          } else {
            newSelection = [...newSelection, ...groupIdsToSelect];
          }
        } else { // 일반 클릭 시 단일/그룹 선택
          if (!newSelection.includes(clickedFurniture.id)) {
            newSelection = groupIdsToSelect;
          }
        }
        
        setSelectedFurnitureIds(newSelection);
        setDragStartPos(p);
        setDragInitialFurniture(placedFurniture.map(f => ({...f})));
      } else {
        setSelectedFurnitureIds([]);
        setDraftFurniture({ start: p, end: p });
      }
    }
  };

  const handleMouseMove = (e) => {
    const p = getPoint(e);
    setMousePos(p);
    if (!isDragging) return;
    
    if (draftRoom) setDraftRoom(prev => ({ ...prev, end: p }));
    if (draftFurniture) setDraftFurniture(prev => ({ ...prev, end: p }));

    // 선택된 여러 가구 동시 이동 (충돌 방지)
    if (selectedFurnitureIds.length > 0 && activeTab === 'placement' && tool !== 'delete') {
      const dx = p.x - dragStartPos.x;
      const dy = p.y - dragStartPos.y;

      const movingItems = dragInitialFurniture.filter(f => selectedFurnitureIds.includes(f.id)).map(f => ({
        ...f, x: snap(f.x + dx), y: snap(f.y + dy)
      }));
      const staticItems = placedFurniture.filter(f => !selectedFurnitureIds.includes(f.id));

      const allValid = movingItems.every(mItem => isValidPosition(mItem, [...staticItems, ...movingItems]));
      
      if (allValid) {
        setPlacedFurniture([...staticItems, ...movingItems]);
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
        setRoomAreaInput(area.pyeong);
        setRoomType('거실');
        setShowRoomModal(true);
      }
    }
    
    if (draftFurniture && selectedFurnitureIds.length === 0) {
      const rawW = Math.abs(draftFurniture.start.x - draftFurniture.end.x);
      const rawH = Math.abs(draftFurniture.start.y - draftFurniture.end.y);
      
      if (rawW > gridSize && rawH > gridSize) {
        const x = Math.min(draftFurniture.start.x, draftFurniture.end.x);
        const y = Math.min(draftFurniture.start.y, draftFurniture.end.y);
        
        const furnitureName = furnitureTypeInput === '기타' ? (customFurnitureName || '기타') : furnitureTypeInput;
        const newItem = { id: ++nextIdRef.current, name: furnitureName, x, y, width: snap(rawW), height: snap(rawH), color: furnitureColorInput, isLocked: false };
        
        if (isValidPosition(newItem, placedFurniture)) {
          setPlacedFurniture([...placedFurniture, newItem]);
          setSelectedFurnitureIds([newItem.id]);
        }
      }
    }
    
    setDraftRoom(null); 
    setDraftFurniture(null); 
    setIsDragging(false);
  };

  const handleCanvasClick = (e) => {
    if (activeTab === 'editor' && ['wall', 'window', 'door'].includes(tool)) {
      const p = getPoint(e);
      if (!lineStart) setLineStart(p);
      else {
        saveSnapshot();
        if (tool === 'wall') {
          setWalls([...walls, { id: Date.now(), start: lineStart, end: p }]);
          if (!isScaleSet) {
            setPendingWallLengthPx(Math.hypot(p.x - lineStart.x, p.y - lineStart.y));
            setShowScaleModal(true);
          }
        }
        else if (tool === 'window') setWindows([...windows, { id: Date.now(), start: lineStart, end: p }]);
        else if (tool === 'door') setDoors([...doors, { id: Date.now(), start: lineStart, end: p, swingSide: 1 }]); // 문 기본 방향 1 설정
        setLineStart(null);
      }
    }
  };

  // 토글 제어 (고정, 그룹화)
  const toggleLockFurniture = (ids) => {
    const allLocked = placedFurniture.filter(f => ids.includes(f.id)).every(f => f.isLocked);
    setPlacedFurniture(placedFurniture.map(f => ids.includes(f.id) ? { ...f, isLocked: !allLocked } : f));
  };

  const toggleGroupFurniture = () => {
    const selectedItems = placedFurniture.filter(f => selectedFurnitureIds.includes(f.id));
    const allSameGroup = selectedItems.every(f => f.groupId && f.groupId === selectedItems[0].groupId);

    if (allSameGroup) { // 그룹 해제
      setPlacedFurniture(placedFurniture.map(f => selectedFurnitureIds.includes(f.id) ? { ...f, groupId: null } : f));
    } else { // 새로운 그룹으로 묶기
      const newGroupId = Date.now();
      setPlacedFurniture(placedFurniture.map(f => selectedFurnitureIds.includes(f.id) ? { ...f, groupId: newGroupId } : f));
    }
  };

  const getDetailedAnalysis = () => {
    let lightScore = 0;
    if (windows.length > 0) {
      lightScore = Math.min(100, windows.length * 35); 
      placedFurniture.forEach(f => {
        windows.forEach(w => {
          const midX = (w.start.x + w.end.x) / 2;
          const midY = (w.start.y + w.end.y) / 2;
          if (midX >= f.x - 20 && midX <= f.x + f.width + 20 && midY >= f.y - 20 && midY <= f.y + f.height + 20) { lightScore -= 15; }
        });
      });
      lightScore = Math.max(15, lightScore); 
    }

    let trafficScore = doors.length > 0 ? 90 : 30;
    placedFurniture.forEach(f => {
      doors.forEach(d => {
        const box = getDoorSwingBox(d);
        if (checkCollision(f, { x: box.x, y: box.y, width: box.width, height: box.height })) {
          trafficScore -= 25; // 열림 반경 충돌 감점
        }
      });
    });
    trafficScore = Math.max(10, trafficScore);

    let spaceScore = 100;
    let totalRoomPixels = rooms.reduce((sum, r) => sum + (r.width * r.height), 0);
    if (totalRoomPixels === 0) totalRoomPixels = roomCanvas.width * roomCanvas.height;
    
    const totalFurniturePixels = placedFurniture.reduce((sum, f) => sum + (f.width * f.height), 0);
    const densityRatio = (totalFurniturePixels / totalRoomPixels) * 100;

    if (densityRatio === 0) spaceScore = 50; 
    else if (densityRatio > 40) spaceScore = Math.max(20, 100 - (densityRatio - 40) * 2.5); 
    else spaceScore = Math.round(100 - Math.abs(25 - densityRatio)); 

    const totalScore = Math.round((lightScore + trafficScore + spaceScore) / 3);

    return { totalScore, traffic: trafficScore, light: lightScore, space: spaceScore, ratio: densityRatio.toFixed(1) };
  };

  const currentAnalysis = getDetailedAnalysis();

  return (
    <div style={{ padding: '40px', backgroundColor: '#fcfaff', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center', fontSize: '32px', fontWeight: '900', marginBottom: '40px' }}>인테리어 플래너</h1>
      
      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '40px' }}>
        <button onClick={() => setActiveTab('editor')} style={{ padding: '12px 30px', borderRadius: '99px', fontWeight: 'bold', border: 'none', cursor: 'pointer', backgroundColor: activeTab === 'editor' ? '#6366f1' : '#f3f4f6', color: activeTab === 'editor' ? '#fff' : '#9ca3af' }}>1. 도면 그리기</button>
        <button onClick={() => setActiveTab('placement')} disabled={rooms.length === 0 && walls.length === 0} style={{ padding: '12px 30px', borderRadius: '99px', fontWeight: 'bold', border: 'none', cursor: 'pointer', backgroundColor: activeTab === 'placement' ? '#6366f1' : '#f3f4f6', color: activeTab === 'placement' ? '#fff' : '#d1d5db' }}>2. 가구 배치</button>
        <button onClick={() => setActiveTab('results')} disabled={placedFurniture.length === 0} style={{ padding: '12px 30px', borderRadius: '99px', fontWeight: 'bold', border: 'none', cursor: placedFurniture.length > 0 ? 'pointer' : 'not-allowed', backgroundColor: activeTab === 'results' ? '#6366f1' : '#f3f4f6', color: activeTab === 'results' ? '#fff' : '#d1d5db' }}>3. 결과 분석</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '40px' }}>
        {/* 도면 캔버스 */}
        <div style={{ position: 'relative', border: '12px solid #111827', borderRadius: '24px', overflow: 'hidden', backgroundColor: '#fff', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)' }}>
          <svg width={roomCanvas.width} height={roomCanvas.height} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onClick={handleCanvasClick}>
            <defs><pattern id="grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse"><path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="#f1f5f9" strokeWidth="1" /></pattern></defs>
            <rect width={roomCanvas.width} height={roomCanvas.height} fill="url(#grid)" />
            
            {rooms.map(r => (
              <g key={r.id}>
                <rect x={r.x} y={r.y} width={r.width} height={r.height} fill={activeTab === 'editor' ? "#60a5fa11" : "#fff"} stroke="#3b82f6" strokeWidth="2" style={{ pointerEvents: tool === 'delete' ? 'auto' : 'none' }} onClick={(e) => { if(tool === 'delete') { e.stopPropagation(); setRooms(rooms.filter(i => i.id !== r.id)); } }} />
                <text x={r.x + 8} y={r.y + 25} fontSize="14" fontWeight="bold" fill="#1e293b">{r.name}</text>
                <text x={r.x + 8} y={r.y + 45} fontSize="12" fill="#64748b">{r.pyeong}평</text>
              </g>
            ))}
            
            {walls.map(w => <line key={w.id} x1={w.start.x} y1={w.start.y} x2={w.end.x} y2={w.end.y} stroke="#1e293b" strokeWidth="8" strokeLinecap="round" style={{ pointerEvents: tool === 'delete' ? 'auto' : 'none' }} onClick={(e) => { if(tool === 'delete') { e.stopPropagation(); setWalls(walls.filter(i=>i.id!==w.id)); } }} />)}
            {windows.map(w => <line key={w.id} x1={w.start.x} y1={w.start.y} x2={w.end.x} y2={w.end.y} stroke="#38bdf8" strokeWidth="12" strokeLinecap="square" style={{ pointerEvents: tool === 'delete' ? 'auto' : 'none' }} onClick={(e) => { if(tool === 'delete') { e.stopPropagation(); setWindows(windows.filter(i=>i.id!==w.id)); } }} />)}
            
            {/* [NEW] 문의 열림 반경 시각화 */}
            {doors.map(d => {
              const dx = d.end.x - d.start.x; const dy = d.end.y - d.start.y;
              const r = Math.hypot(dx, dy); const theta = Math.atan2(dy, dx);
              const side = d.swingSide || 1;
              const ox = d.start.x + r * Math.cos(theta + side * Math.PI / 2);
              const oy = d.start.y + r * Math.sin(theta + side * Math.PI / 2);
              const sweep = side === 1 ? 1 : 0;

              return (
                <g key={d.id} 
                   onClick={(e) => {
                     e.stopPropagation();
                     if (tool === 'delete') setDoors(doors.filter(i => i.id !== d.id));
                     else if (activeTab === 'editor') setDoors(doors.map(i => i.id === d.id ? { ...i, swingSide: side * -1 } : i));
                   }}
                   style={{ pointerEvents: 'auto', cursor: activeTab === 'editor' ? 'pointer' : 'default' }}>
                  <path d={`M ${d.start.x} ${d.start.y} L ${d.end.x} ${d.end.y} A ${r} ${r} 0 0 ${sweep} ${ox} ${oy} Z`} fill="rgba(180, 83, 9, 0.15)" stroke="none" />
                  <line x1={d.start.x} y1={d.start.y} x2={d.end.x} y2={d.end.y} stroke="#b45309" strokeWidth="10" strokeLinecap="round" />
                </g>
              );
            })}
            
            {draftRoom && <rect x={Math.min(draftRoom.start.x, draftRoom.end.x)} y={Math.min(draftRoom.start.y, draftRoom.end.y)} width={Math.abs(draftRoom.start.x-draftRoom.end.x)} height={Math.abs(draftRoom.start.y-draftRoom.end.y)} fill="rgba(59, 130, 246, 0.3)" stroke="#2563eb" strokeWidth="2" strokeDasharray="8 4" />}
            {draftFurniture && selectedFurnitureIds.length === 0 && <rect x={Math.min(draftFurniture.start.x, draftFurniture.end.x)} y={Math.min(draftFurniture.start.y, draftFurniture.end.y)} width={Math.abs(draftFurniture.start.x-draftFurniture.end.x)} height={Math.abs(draftFurniture.start.y-draftFurniture.end.y)} fill={furnitureColorInput + '66'} stroke="#334155" strokeDasharray="4 4" />}
            {lineStart && <line x1={lineStart.x} y1={lineStart.y} x2={mousePos.x} y2={mousePos.y} stroke="#ef4444" strokeWidth="2" strokeDasharray="6 4" />}
            
            {(activeTab === 'placement' || activeTab === 'results') && placedFurniture.map(f => {
              const isSelected = selectedFurnitureIds.includes(f.id);
              return (
                <g key={f.id} onMouseDown={(e) => { 
                  if (tool === 'delete') { 
                    e.stopPropagation(); 
                    setPlacedFurniture(placedFurniture.filter(i=>i.id!==f.id)); 
                    setSelectedFurnitureIds(prev => prev.filter(id => id !== f.id));
                  }
                }}>
                  <rect x={f.x} y={f.y} width={f.width} height={f.height} fill={f.color} stroke={isSelected ? '#6366f1' : '#475569'} strokeWidth={isSelected ? "4" : "2"} rx="6" style={{ cursor: tool !== 'delete' ? 'grab' : 'pointer' }} />
                  <text x={f.x+5} y={f.y+18} fontSize="12" fontWeight="bold" fill="#1e293b" style={{ pointerEvents: 'none' }}>
                    {f.isLocked ? '📌 ' : ''}{f.groupId ? '🔗 ' : ''}{f.name}
                  </text>
                </g>
              );
            })}
            
            {activeTab === 'placement' && previewAiId && aiRecommendations.find(r => r.id === previewAiId)?.items.map(p => <rect key={`pre-${p.id}`} x={p.x} y={p.y} width={p.width} height={p.height} fill="none" stroke="#a855f7" strokeWidth="3" strokeDasharray="6 4" style={{ pointerEvents: 'none' }} />)}
          </svg>
        </div>
        
        {/* 우측 사이드바 */}
        <div style={{ width: '340px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {activeTab === 'editor' ? (
            <div style={{ padding: '24px', backgroundColor: '#fff', borderRadius: '24px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontWeight: '900', marginBottom: '20px' }}>도면 도구</h3>
              <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '12px' }}>💡 생성된 문을 클릭하면 열림 방향이 뒤집힙니다.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button onClick={() => setTool('wall')} style={{ width: '100%', padding: '14px', borderRadius: '12px', fontWeight: 'bold', border: 'none', backgroundColor: tool === 'wall' ? '#6366f1' : '#f1f5f9', color: tool === 'wall' ? '#fff' : '#64748b', cursor: 'pointer' }}>벽 설치</button>
                <button onClick={() => setTool('room')} style={{ width: '100%', padding: '14px', borderRadius: '12px', fontWeight: 'bold', border: 'none', backgroundColor: tool === 'room' ? '#6366f1' : '#f1f5f9', color: tool === 'room' ? '#fff' : '#64748b', cursor: 'pointer' }}>방 영역 지정</button>
                <button onClick={() => setTool('window')} style={{ width: '100%', padding: '14px', borderRadius: '12px', fontWeight: 'bold', border: 'none', backgroundColor: tool === 'window' ? '#0ea5e9' : '#f1f5f9', color: tool === 'window' ? '#fff' : '#64748b', cursor: 'pointer' }}>창문 설치</button>
                <button onClick={() => setTool('door')} style={{ width: '100%', padding: '14px', borderRadius: '12px', fontWeight: 'bold', border: 'none', backgroundColor: tool === 'door' ? '#b45309' : '#f1f5f9', color: tool === 'door' ? '#fff' : '#64748b', cursor: 'pointer' }}>문 설치</button>
                <button onClick={() => setTool('delete')} style={{ width: '100%', padding: '14px', borderRadius: '12px', fontWeight: 'bold', border: 'none', backgroundColor: tool === 'delete' ? '#ef4444' : '#f1f5f9', color: tool === 'delete' ? '#fff' : '#64748b', cursor: 'pointer' }}>지우개 모드</button>
              </div>

              <div style={{ backgroundColor: '#f0f4ff', borderRadius: '16px', padding: '16px', marginTop: '16px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold', color: '#4338ca' }}>📐 평면도 정보</h4>
                <p style={{ margin: '6px 0', fontSize: '12px', color: '#4b5563' }}>배율 상태: <span style={{ fontWeight: 'bold' }}>{isScaleSet ? `설정 완료 (1m = ${Math.round(pxPerMeter)}px)` : '설정 전'}</span></p>
                <p style={{ margin: '6px 0', fontSize: '13px', color: '#475569' }}>총 면적: <span style={{ fontWeight: 'bold', color: '#4338ca' }}>{getTotalArea().total}평</span></p>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button onClick={undo} style={{ flex: 1, padding: '10px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>↩ 취소</button>
                <button onClick={() => { setWalls([]); setRooms([]); setWindows([]); setDoors([]); setPlacedFurniture([]); setIsScaleSet(false); setPxPerMeter(20); }} style={{ flex: 1, padding: '10px', backgroundColor: '#fff1f2', color: '#e11d48', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>초기화</button>
              </div>
            </div>
          ) : activeTab === 'results' ? (
            <div style={{ padding: '24px', backgroundColor: '#fff', borderRadius: '24px', border: '2px solid #6366f1' }}>
              <h3 style={{ fontWeight: '900', fontSize: '20px', marginBottom: '20px' }}>📐 구체화된 분석 리포트</h3>
              <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#f5f3ff', borderRadius: '16px', marginBottom: '20px' }}>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>종합 인테리어 점수</p>
                <p style={{ fontSize: '44px', fontWeight: '900', margin: '8px 0', color: '#4338ca' }}>{currentAnalysis.totalScore}점</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e5e7eb', paddingBottom: '6px' }}>
                  <span>🚶 <b>동선 안심도</b></span>
                  <span style={{ fontWeight: 'bold', color: currentAnalysis.traffic < 50 ? '#ef4444' : '#10b981' }}>{currentAnalysis.traffic}점</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e5e7eb', paddingBottom: '6px' }}>
                  <span>☀️ <b>채광 효율성</b></span>
                  <span style={{ fontWeight: 'bold', color: currentAnalysis.light < 1 ? '#ef4444' : '#10b981' }}>{currentAnalysis.light}점</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #e5e7eb', paddingBottom: '6px' }}>
                  <span>📦 <b>공간 여유도</b></span>
                  <span style={{ fontWeight: 'bold', color: '#3b82f6' }}>{currentAnalysis.space}점 ({currentAnalysis.ratio}%)</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '24px', backgroundColor: '#fff', borderRadius: '24px', border: '1px solid #e5e7eb' }}>
              <h3 style={{ fontWeight: '900', marginBottom: '16px' }}>가구 관리</h3>
              
              {/* [NEW] 다중 선택 가구 제어 패널 */}
              {selectedFurnitureIds.length > 0 && (
                <div style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
                  <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 'bold', color: '#1f2937' }}>
                    선택된 가구: <span style={{ color: '#4f46e5' }}>{selectedFurnitureIds.length}개</span>
                  </p>

                  {selectedFurnitureIds.length > 1 && (
                    <button 
                      onClick={toggleGroupFurniture} 
                      style={{ width: '100%', padding: '10px', marginBottom: '10px', backgroundColor: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                      🔗 선택한 가구 그룹으로 묶기 / 해제
                    </button>
                  )}

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold', color: '#4b5563' }}>
                    <input 
                      type="checkbox" 
                      checked={placedFurniture.filter(f => selectedFurnitureIds.includes(f.id)).every(f => f.isLocked)} 
                      onChange={() => toggleLockFurniture(selectedFurnitureIds)}
                      style={{ width: '16px', height: '16px', accentColor: '#4f46e5' }}
                    />
                    📌 위치 고정 (AI 무시)
                  </label>
                  <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#9ca3af' }}>💡 Shift 키를 누른 채 클릭하여 다중 선택이 가능합니다.</p>
                </div>
              )}

              <select value={furnitureTypeInput} onChange={e => setFurnitureTypeInput(e.target.value)} style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '12px', marginBottom: '10px', fontWeight: 'bold' }}>
                <option>소파</option><option>침대</option><option>책상</option><option>식탁</option><option>의자</option><option>기타</option>
              </select>
              
              {furnitureTypeInput === '기타' && (
                <input value={customFurnitureName} onChange={e => setCustomFurnitureName(e.target.value)} placeholder="가구 이름 입력" style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '12px', marginBottom: '10px', boxSizing: 'border-box' }} />
              )}
              
              <input type="color" value={furnitureColorInput} onChange={e => setFurnitureColorInput(e.target.value)} style={{ width: '100%', height: '44px', border: 'none', borderRadius: '12px', cursor: 'pointer', marginBottom: '16px' }} />
              
              <button onClick={handleAddFurnitureClick} style={{ width: '100%', padding: '14px', backgroundColor: '#6366f1', color: '#fff', borderRadius: '14px', fontWeight: '900', border: 'none', cursor: 'pointer', marginBottom: '24px' }}>
                방에 추가 (클릭)
              </button>

              <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', marginBottom: '24px' }} />

              <button onClick={generateAiRecommendations} style={{ width: '100%', padding: '18px', backgroundColor: '#a855f7', color: '#fff', borderRadius: '18px', fontWeight: '900', border: 'none', cursor: 'pointer', marginBottom: '16px' }}>✨ AI 자동 배치 생성</button>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {aiRecommendations.map(r => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#faf5ff', borderRadius: '12px', border: '1px solid #f3e8ff' }}>
                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{r.name}</span>
                    <button onClick={() => { setPlacedFurniture(r.items.map(i => ({...i}))); setPreviewAiId(null); setSelectedFurnitureIds([]); }} style={{ padding: '6px 14px', backgroundColor: '#a855f7', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>적용</button>
                  </div>
                ))}
              </div>
              <button onClick={() => setTool(tool === 'delete' ? 'select' : 'delete')} style={{ width: '100%', marginTop: '16px', padding: '12px', borderRadius: '12px', border: tool==='delete'?'2px solid #ef4444':'none', backgroundColor: '#f9fafb', cursor: 'pointer', fontWeight: 'bold', color: tool==='delete'?'#ef4444':'#475569' }}>
                {tool === 'delete' ? '✅ 지우개 모드 끄기' : '🗑️ 가구 지우기 모드'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* --- [배율 설정 모달] --- */}
      {showScaleModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '24px', padding: '32px', width: '90%', maxWidth: '420px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '22px', fontWeight: '900', margin: '0 0 16px 0', color: '#1e293b' }}>📐 첫 번째 벽 길이 입력 (배율 설정)</h2>
            <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.5', marginBottom: '20px' }}>방의 올바른 평수 예측을 위해, 방금 그리신 첫 번째 벽의 실제 길이를 입력해 주세요.</p>
            <div style={{ marginBottom: '24px' }}>
              <input type="number" step="0.1" defaultValue="3.5" id="wallMeterInput" style={{ width: '100%', padding: '12px', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', boxSizing: 'border-box' }} placeholder="예: 3.5" />
            </div>
            <button onClick={() => { handleSaveScale(parseFloat(document.getElementById('wallMeterInput').value) || 3.5); }} style={{ width: '100%', padding: '14px', backgroundColor: '#6366f1', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' }}>배율 설정 완료</button>
          </div>
        </div>
      )}

      {/* --- [방 정보 입력 모달] --- */}
      {showRoomModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '24px', padding: '32px', width: '90%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '900', margin: '0 0 24px 0' }}>방 정보 입력</h2>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#475569' }}>방 유형</label>
              <select value={roomType} onChange={e => setRoomType(e.target.value)} style={{ width: '100%', padding: '12px', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '14px', fontWeight: 'bold', marginBottom: '10px' }}>
                <option>거실</option><option>주방</option><option>침실</option><option>방</option><option>욕실</option>
                <option>현관</option><option>기타</option>
              </select>
              {roomType === '기타' && <input type="text" value={customRoomType} onChange={e => setCustomRoomType(e.target.value)} placeholder="방 이름을 직접 입력하세요 (예: 발코니)" style={{ width: '100%', padding: '12px', border: '2px solid #6366f1', borderRadius: '12px', fontSize: '14px', fontWeight: 'bold', boxSizing: 'border-box' }} />}
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#475569' }}>면적 (평)</label>
              <input type="number" step="0.1" value={roomAreaInput} onChange={e => setRoomAreaInput(e.target.value)} style={{ width: '100%', padding: '12px', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '14px', fontWeight: 'bold', color: '#4338ca', boxSizing: 'border-box' }} />
              <p style={{ fontSize: '12px', color: '#2563eb', margin: '8px 0 0 0', fontWeight: '600' }}>💡 크기 맞춤 자동 계산된 예상치: {pendingRoom?.area?.pyeong}평</p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => { setShowRoomModal(false); setPendingRoom(null); }} style={{ flex: 1, padding: '14px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>취소</button>
              <button onClick={handleSaveRoom} style={{ flex: 1, padding: '14px', backgroundColor: '#6366f1', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>완료</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InteriorPlanner;