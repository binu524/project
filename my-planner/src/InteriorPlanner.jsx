import React, { useRef, useState, useEffect } from 'react';

// --- [가구 표준 사이즈 프리셋 (단위: cm)] ---
const FURNITURE_PRESETS = {
  '침대': {
    '싱글 (100x200)': { w: 100, h: 200 },
    '슈퍼싱글 (110x200)': { w: 110, h: 200 },
    '퀸 (150x200)': { w: 150, h: 200 },
    '킹 (160x200)': { w: 160, h: 200 }
  },
  '책상': {
    '1인용 소형 (80x60)': { w: 80, h: 60 },
    '표준형 (120x60)': { w: 120, h: 60 },
    '넓은형 (160x80)': { w: 160, h: 80 }
  },
  '식탁': {
    '2인용 (80x80)': { w: 80, h: 80 },
    '4인용 (120x80)': { w: 120, h: 80 },
    '6인용 (160x80)': { w: 160, h: 80 }
  },
  '소파': {
    '2인용 (140x90)': { w: 140, h: 90 },
    '3인용 (200x90)': { w: 200, h: 90 },
    '4인용 (260x90)': { w: 260, h: 90 },
    '카우치형 (300x150)': { w: 300, h: 150 }
  },
  '의자': {
    '일반 의자 (50x50)': { w: 50, h: 50 },
    '1인용 안락의자 (80x80)': { w: 80, h: 80 }
  }
};

const InteriorPlanner = () => {
  const roomCanvas = { width: 900, height: 560 };
  const gridSize = 20;
  const [activeTab, setActiveTab] = useState('editor'); 
  const recommendedStoreLinks = [
    { name: 'IKEA 코리아', url: 'https://www.ikea.com/kr/ko/' },
    { name: '오늘의집', url: 'https://ohou.se' },
    { name: '29CM - 리빙', url: 'https://www.29cm.co.kr/store/category/main?categoryLargeCode=291100100&previousPage=category_main&gender=F&page=1&sort=RECOMMENDED&category=291100100' },
    { name: '노르딕네스트', url: 'https://www.nordicnest.kr/?utm_source=google&utm_medium=cpc&utm_campaign=bb-kr-search-brand-exact&utm_id=1900447568&gad_source=1&gad_campaignid=1900447568&gbraid=0AAAAADswOPunM9BugrIEcFZ-gBIlOz22E&gclid=Cj0KCQjw2_TQBhCnARIsAF3-Xhx-NLKPDOfxQTO_7IPeMOpSPhlAm_MZ-me02NauF06m--UsghHXuoYaAj0BEALw_wcB' }
  ];
  
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

  const [pxPerMeter, setPxPerMeter] = useState(20); 
  const [isScaleSet, setIsScaleSet] = useState(false);
  const [showScaleModal, setShowScaleModal] = useState(false);
  const [pendingWallLengthPx, setPendingWallLengthPx] = useState(0);

  const [showRoomModal, setShowRoomModal] = useState(false);
  const [pendingRoom, setPendingRoom] = useState(null);
  const [roomType, setRoomType] = useState('거실');
  const [customRoomType, setCustomRoomType] = useState('');
  const [roomAreaInput, setRoomAreaInput] = useState('');

  const [furnitureTypeInput, setFurnitureTypeInput] = useState('침대');
  const [furnitureSubtypeInput, setFurnitureSubtypeInput] = useState('슈퍼싱글 (110x200)');
  const [customFurnitureSize, setCustomFurnitureSize] = useState({ w: 120, h: 60 }); 
  const [customFurnitureName, setCustomFurnitureName] = useState('');
  const [furnitureColorInput, setFurnitureColorInput] = useState('#93c5fd');
  const [placedFurniture, setPlacedFurniture] = useState([]);
  
  const [isRotatedPreset, setIsRotatedPreset] = useState(false);
  
  useEffect(() => {
    if (FURNITURE_PRESETS[furnitureTypeInput]) {
      setFurnitureSubtypeInput(Object.keys(FURNITURE_PRESETS[furnitureTypeInput])[0]);
    } else {
      setFurnitureSubtypeInput('직접입력');
    }
  }, [furnitureTypeInput]);

  const [selectedFurnitureIds, setSelectedFurnitureIds] = useState([]);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [dragInitialFurniture, setDragInitialFurniture] = useState([]);
  
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [previewAiId, setPreviewAiId] = useState(null);
  const nextIdRef = useRef(Date.now());

  const restrictedRoomTypes = ['욕실', '현관'];

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

  // 💡 [복구 완료] 벽 관통 절대 방어! CCW (외적) 기반 교차 판별 수학 공식
  const checkWallCollision = (furniture, wall) => {
    const pad = 5; // 벽 두께를 고려한 방어막
    const rx = furniture.x - pad;
    const ry = furniture.y - pad;
    const rw = furniture.width + pad * 2;
    const rh = furniture.height + pad * 2;

    const x1 = wall.start.x, y1 = wall.start.y;
    const x2 = wall.end.x, y2 = wall.end.y;

    // 1. 선분의 끝점이 사각형 내부에 완전히 들어온 경우
    if ((x1 >= rx && x1 <= rx + rw && y1 >= ry && y1 <= ry + rh) ||
        (x2 >= rx && x2 <= rx + rw && y2 >= ry && y2 <= ry + rh)) {
      return true;
    }

    // 2. 벡터 외적(CCW)을 이용한 선분 교차 검사 (일직선 겹침 완벽 대응)
    const ccw = (px, py, qx, qy, ex, ey) => {
      return (qx - px) * (ey - py) - (qy - py) * (ex - px);
    };
    
    const intersects = (ax, ay, bx, by, cx, cy, dx, dy) => {
      const c1 = ccw(ax, ay, bx, by, cx, cy);
      const c2 = ccw(ax, ay, bx, by, dx, dy);
      const c3 = ccw(cx, cy, dx, dy, ax, ay);
      const c4 = ccw(cx, cy, dx, dy, bx, by);
      
      // 선분이 평행하면서 일직선 상에 포개지는 경우 (가장 큰 버그 원인 해결)
      if (c1 === 0 && c2 === 0 && c3 === 0 && c4 === 0) {
        const minX1 = Math.min(ax, bx), maxX1 = Math.max(ax, bx);
        const minY1 = Math.min(ay, by), maxY1 = Math.max(ay, by);
        const minX2 = Math.min(cx, dx), maxX2 = Math.max(cx, dx);
        const minY2 = Math.min(cy, dy), maxY2 = Math.max(cy, dy);
        return minX1 <= maxX2 && minX2 <= maxX1 && minY1 <= maxY2 && minY2 <= maxY1;
      }
      return c1 * c2 <= 0 && c3 * c4 <= 0;
    };

    // 가구의 상하좌우 4면의 테두리와 벽 선분이 한 곳이라도 교차하면 차단
    if (intersects(x1, y1, x2, y2, rx, ry, rx + rw, ry)) return true; // 상단
    if (intersects(x1, y1, x2, y2, rx, ry + rh, rx + rw, ry + rh)) return true; // 하단
    if (intersects(x1, y1, x2, y2, rx, ry, rx, ry + rh)) return true; // 좌측
    if (intersects(x1, y1, x2, y2, rx + rw, ry, rx + rw, ry + rh)) return true; // 우측

    return false;
  };

  const getBoundaryWalls = () => [
    { start: { x: 0, y: 0 }, end: { x: roomCanvas.width, y: 0 } },
    { start: { x: 0, y: roomCanvas.height }, end: { x: roomCanvas.width, y: roomCanvas.height } },
    { start: { x: 0, y: 0 }, end: { x: 0, y: roomCanvas.height } },
    { start: { x: roomCanvas.width, y: 0 }, end: { x: roomCanvas.width, y: roomCanvas.height } }
  ];

  const getRectDistance = (r1, r2) => {
    const left = Math.max(r1.x, r2.x);
    const right = Math.min(r1.x + r1.width, r2.x + r2.width);
    const top = Math.max(r1.y, r2.y);
    const bottom = Math.min(r1.y + r1.height, r2.y + r2.height);
    const dx = Math.max(0, left - right);
    const dy = Math.max(0, top - bottom);
    return Math.hypot(dx, dy);
  };

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

  const isValidPosition = (movingItem, allItems, intendedRoomId = null) => {
    if (walls.length === 0 && rooms.length === 0) return true;
    
    if (movingItem.x < 0 || movingItem.y < 0 || 
        movingItem.x + movingItem.width > roomCanvas.width || 
        movingItem.y + movingItem.height > roomCanvas.height) return false;

    // 복구된 철벽 CCW 알고리즘으로 벽, 창문, 외곽선 모두 검사
    const physicalBarriers = [...walls, ...windows, ...getBoundaryWalls()];
    if (physicalBarriers.some(w => checkWallCollision(movingItem, w))) return false;

    const hitsDoorSpace = doors.some(d => {
      const swingBox = getDoorSwingBox(d);
      if (checkCollision(movingItem, { x: swingBox.x - 2, y: swingBox.y - 2, width: swingBox.width + 4, height: swingBox.height + 4 })) return true;

      const isHorizontal = Math.abs(d.start.y - d.end.y) < Math.abs(d.start.x - d.end.x);
      let pMinX, pMaxX, pMinY, pMaxY;
      if (isHorizontal) {
          pMinX = Math.min(d.start.x, d.end.x) - 10; 
          pMaxX = Math.max(d.start.x, d.end.x) + 10;
          pMinY = Math.min(d.start.y, d.end.y) - 20; 
          pMaxY = Math.max(d.start.y, d.end.y) + 20;
      } else {
          pMinX = Math.min(d.start.x, d.end.x) - 20;
          pMaxX = Math.max(d.start.x, d.end.x) + 20;
          pMinY = Math.min(d.start.y, d.end.y) - 10;
          pMaxY = Math.max(d.start.y, d.end.y) + 10;
      }
      if (checkCollision(movingItem, { x: pMinX, y: pMinY, width: pMaxX - pMinX, height: pMaxY - pMinY })) return true;

      return false;
    });
    if (hitsDoorSpace) return false;

    const cx = movingItem.x + movingItem.width / 2;
    const cy = movingItem.y + movingItem.height / 2;
    const hostRoom = rooms.find(r => cx >= r.x && cx <= r.x + r.width && cy >= r.y && cy <= r.y + r.height);
    
    const tolerance = 5; 
    if (intendedRoomId && intendedRoomId !== 'outer-space') {
      const tgtRoom = rooms.find(r => r.id === intendedRoomId);
      if (tgtRoom) {
        const isInsideTgt = (
          movingItem.x >= tgtRoom.x - tolerance && movingItem.y >= tgtRoom.y - tolerance &&
          movingItem.x + movingItem.width <= tgtRoom.x + tgtRoom.width + tolerance &&
          movingItem.y + movingItem.height <= tgtRoom.y + tgtRoom.height + tolerance
        );
        if (!isInsideTgt) return false;
      }
    }

    return !allItems.some(item => item.id !== movingItem.id && checkCollision(movingItem, item));
  };

  const getRoomForFurniture = (item) => {
    const cx = item.x + item.width / 2;
    const cy = item.y + item.height / 2;
    const found = rooms.find(r => cx >= r.x && cx <= r.x + r.width && cy >= r.y && cy <= r.y + r.height);
    if (found) return found;

    let minX = 0, minY = 0, maxX = roomCanvas.width, maxY = roomCanvas.height;
    if (rooms.length > 0) {
      minX = Math.max(0, Math.min(...rooms.map(r => r.x))); 
      minY = Math.max(0, Math.min(...rooms.map(r => r.y)));
      maxX = Math.min(roomCanvas.width, Math.max(...rooms.map(r => r.x + r.width))); 
      maxY = Math.min(roomCanvas.height, Math.max(...rooms.map(r => r.y + r.height)));
    } else if (walls.length > 0) {
      minX = Math.max(0, Math.min(...walls.flatMap(w => [w.start.x, w.end.x])));
      minY = Math.max(0, Math.min(...walls.flatMap(w => [w.start.y, w.end.y])));
      maxX = Math.min(roomCanvas.width, Math.max(...walls.flatMap(w => [w.start.x, w.end.x])));
      maxY = Math.min(roomCanvas.height, Math.max(...walls.flatMap(w => [w.start.y, w.end.y])));
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

  const rotateSelectedFurniture = () => {
    setPlacedFurniture(prev => prev.map(f => {
      if (selectedFurnitureIds.includes(f.id)) {
        return { ...f, width: f.height, height: f.width };
      }
      return f;
    }));
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
    
    let cmW = 100, cmH = 80;
    if (furnitureSubtypeInput === '직접입력') {
      cmW = customFurnitureSize.w;
      cmH = customFurnitureSize.h;
    } else if (FURNITURE_PRESETS[furnitureTypeInput]) {
      const preset = FURNITURE_PRESETS[furnitureTypeInput][furnitureSubtypeInput];
      if (preset) {
        cmW = isRotatedPreset ? preset.h : preset.w;
        cmH = isRotatedPreset ? preset.w : preset.h;
      }
    }

    const pixelWidth = Math.round((cmW / 100) * pxPerMeter);
    const pixelHeight = Math.round((cmH / 100) * pxPerMeter);

    const newItem = { 
      id: ++nextIdRef.current, name: furnitureName, 
      x: 0, y: 0, width: pixelWidth, height: pixelHeight, color: furnitureColorInput, isLocked: false 
    };

    let placed = false;
    const centerX = snap(targetBox.x + targetBox.width / 2 - newItem.width / 2);
    const centerY = snap(targetBox.y + targetBox.height / 2 - newItem.height / 2);
    
    const maxRadius = Math.max(targetBox.width, targetBox.height);
    for (let radius = 0; radius < maxRadius; radius += gridSize) {
      for (let angle = 0; angle < 360; angle += 45) {
        const rad = angle * Math.PI / 180;
        const tx = snap(centerX + radius * Math.cos(rad));
        const ty = snap(centerY + radius * Math.sin(rad));
        
        const testItem = { ...newItem, x: tx, y: ty };
        if (isValidPosition(testItem, placedFurniture)) {
          setPlacedFurniture([...placedFurniture, testItem]);
          placed = true;
          break;
        }
      }
      if (placed) break;
    }

    if (!placed) alert("가구를 추가할 빈 공간을 찾지 못했습니다. 기존 가구를 이동시키거나 도면의 빈 공간을 직접 클릭해 추가해 보세요.");
  };

  // 💡 [복구 완료] 100점 남발 방지! 현실적이고 깐깐한 동적 채점 로직
  const getDetailedAnalysis = (layoutToScore = placedFurniture) => {
    
    // [채광 효율성] 창문을 하나 가릴 때마다 20점 감점
    let lightScore = windows.length > 0 ? 100 : 50; 
    if (windows.length > 0) {
      let blockCount = 0;
      layoutToScore.forEach(f => {
        windows.forEach(w => {
          const midX = (w.start.x + w.end.x) / 2;
          const midY = (w.start.y + w.end.y) / 2;
          if (midX >= f.x - 30 && midX <= f.x + f.width + 30 && 
              midY >= f.y - 30 && midY <= f.y + f.height + 30) { 
            blockCount++; 
          }
        });
      });
      lightScore -= (blockCount * 20); 
    }
    lightScore = Math.max(10, Math.min(100, lightScore)); 

    // [동선 안심도] 문 앞을 막거나, 가구 틈이 좁을 때 가차 없이 감점
    let trafficScore = doors.length > 0 ? 100 : 60;
    layoutToScore.forEach(f => {
      doors.forEach(d => {
        const box = getDoorSwingBox(d);
        // 문 앞 10px 범위를 침범하면 30점 감점
        if (checkCollision(f, { x: box.x - 10, y: box.y - 10, width: box.width + 20, height: box.height + 20 })) {
          trafficScore -= 30; 
        }
      });
    });

    let narrowPathCount = 0;
    for (let i = 0; i < layoutToScore.length; i++) {
      for (let j = i + 1; j < layoutToScore.length; j++) {
        const dist = getRectDistance(layoutToScore[i], layoutToScore[j]);
        // 가구 간 거리가 40px 미만(지나다니기 불편함)이면 비좁은 통로로 판정
        if (dist < 40) { 
          narrowPathCount++;
        }
      }
    }
    trafficScore -= (narrowPathCount * 10); // 좁은 통로 1개당 10점 감점
    trafficScore = Math.max(10, Math.min(100, trafficScore));

    // [공간 여유도] 가장 이상적인 면적 비율을 25%로 잡고 벗어날수록 감점
    let spaceScore = 100;
    let totalRoomPixels = rooms.reduce((sum, r) => sum + (r.width * r.height), 0);
    if (totalRoomPixels === 0) totalRoomPixels = roomCanvas.width * roomCanvas.height;
    
    const totalFurniturePixels = layoutToScore.reduce((sum, f) => sum + (f.width * f.height), 0);
    const densityRatio = (totalFurniturePixels / totalRoomPixels) * 100;

    if (densityRatio === 0) {
      spaceScore = 30; 
    } else if (densityRatio < 10) {
      spaceScore = 50; 
    } else if (densityRatio > 40) {
      spaceScore = Math.max(10, 100 - (densityRatio - 40) * 3); // 과밀집 시 점수 급락
    } else {
      spaceScore = 100 - Math.abs(25 - densityRatio) * 1.5; // 25%일 때 100점
    }
    spaceScore = Math.max(10, Math.min(100, Math.round(spaceScore)));

    const totalScore = Math.round((lightScore + trafficScore + spaceScore) / 3);

    return { totalScore, traffic: trafficScore, light: lightScore, space: spaceScore, ratio: densityRatio.toFixed(1) };
  };

  const generateAiRecommendations = () => {
    if (placedFurniture.length === 0) return;

    const generateLayout = (type) => {
      const result = [...placedFurniture.filter(f => f.isLocked)];
      const layoutItems = [];
      const processed = new Set();

      placedFurniture.filter(f => !f.isLocked).forEach(f => {
        if (processed.has(f.id)) return;
        if (f.groupId) {
          const group = placedFurniture.filter(g => g.groupId === f.groupId);
          group.forEach(g => processed.add(g.id));
          const minX = Math.min(...group.map(g => g.x)); const minY = Math.min(...group.map(g => g.y));
          const maxX = Math.max(...group.map(g => g.x + g.width)); const maxY = Math.max(...group.map(g => g.y + g.height));
          layoutItems.push({
            isGroup: true, 
            items: group.map(g => ({ ...g, offsetX: g.x - minX, offsetY: g.y - minY })),
            id: 'group-' + f.groupId, 
            name: group[0].name + ' 세트',
            x: minX, y: minY, width: maxX - minX, height: maxY - minY,
          });
        } else {
          processed.add(f.id);
          layoutItems.push({ ...f, isGroup: false });
        }
      });

      layoutItems.sort((a, b) => (b.width * b.height) - (a.width * a.height));

      const availableRooms = rooms.filter(r => !restrictedRoomTypes.includes(r.name));
      const fallbackRoom = availableRooms.sort((a, b) => (b.width * b.height) - (a.width * a.height))[0] || rooms[0];

      layoutItems.forEach((item) => {
        let targetRoom = getRoomForFurniture(item);
        if (restrictedRoomTypes.includes(targetRoom.name)) {
          if (fallbackRoom) targetRoom = fallbackRoom;
        }

        if (!targetRoom) { 
          if (item.isGroup) item.items.forEach(subItem => result.push({ ...subItem }));
          else result.push({ ...item });
          return; 
        }

        let bestPos = null;
        let maxScore = -99999;

        // 방 밖으로 절대 나가지 않도록 스캔 범위를 방 내부로 엄격히 제한
        for (let ty = targetRoom.y + 10; ty <= targetRoom.y + targetRoom.height - item.height - 10; ty += 10) {
          for (let tx = targetRoom.x + 10; tx <= targetRoom.x + targetRoom.width - item.width - 10; tx += 10) {
            const test = { ...item, x: tx, y: ty };
            
            if (isValidPosition(test, result, targetRoom.id)) {
              let minDistToOthers = 9999;
              result.forEach(other => {
                const dist = getRectDistance(test, other);
                if (dist < minDistToOthers) minDistToOthers = dist;
              });
              if (result.length === 0) minDistToOthers = 50;

              const distToWall = Math.min(
                tx - targetRoom.x, 
                ty - targetRoom.y,
                (targetRoom.x + targetRoom.width) - (tx + item.width),
                (targetRoom.y + targetRoom.height) - (ty + item.height)
              );

              let score = 0;
              if (type === 'rest') {
                score = (-distToWall * 3.0) + (minDistToOthers * 1.0) + (Math.random() * 5);
              } else {
                score = (distToWall * 2.0) + (minDistToOthers * 4.0) + (Math.random() * 5);
              }

              if (score > maxScore) {
                maxScore = score;
                bestPos = { x: tx, y: ty };
              }
            }
          }
        }

        if (bestPos) {
          if (item.isGroup) {
            item.items.forEach(subItem => {
              result.push({ ...subItem, x: bestPos.x + subItem.offsetX, y: bestPos.y + subItem.offsetY });
            });
          } else {
            const { isGroup, ...originalItem } = item;
            result.push({ ...originalItem, x: bestPos.x, y: bestPos.y });
          }
        } else {
          if (item.isGroup) item.items.forEach(subItem => result.push({ ...subItem }));
          else {
            const { isGroup, ...originalItem } = item;
            result.push({ ...originalItem }); 
          }
        }
      });
      return result;
    };
    
    const layoutA = generateLayout('rest');
    const layoutB = generateLayout('grid');
    
    const scoreA = getDetailedAnalysis(layoutA).totalScore;
    const scoreB = getDetailedAnalysis(layoutB).totalScore;
    
    setAiRecommendations([
      { id: 'A', name: '추천안 A (벽면 정렬 및 간격 확보)', score: scoreA, items: layoutA },
      { id: 'B', name: '추천안 B (여유로운 중앙 공간 확보)', score: scoreB, items: layoutB }
    ]);
    setPreviewAiId('A');
  };

  const handleMouseDown = (e) => {
    const p = getPoint(e);
    setIsDragging(true);

    if (activeTab === 'editor' && tool === 'room') {
      setDraftRoom({ start: p, end: p });
    }

    if (activeTab === 'placement' && tool !== 'delete') {
      const clickedFurniture = [...placedFurniture].reverse().find(f => 
        p.x >= f.x && p.x < f.x + f.width && p.y >= f.y && p.y < f.height + f.y
      );

      if (clickedFurniture) {
        let newSelection = [...selectedFurnitureIds];
        const groupIdsToSelect = clickedFurniture.groupId ? 
          placedFurniture.filter(f => f.groupId === clickedFurniture.groupId).map(f => f.id) : 
          [clickedFurniture.id];

        if (e.shiftKey) { 
          if (newSelection.includes(clickedFurniture.id)) {
            newSelection = newSelection.filter(id => !groupIdsToSelect.includes(id));
          } else {
            newSelection = [...newSelection, ...groupIdsToSelect];
          }
        } else {
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
      
      let cmW = 100, cmH = 80;
      let isDragSize = false;

      if (furnitureSubtypeInput === '직접입력' && rawW >= gridSize && rawH >= gridSize) {
        isDragSize = true;
      } else if (furnitureSubtypeInput === '직접입력') {
        cmW = customFurnitureSize.w;
        cmH = customFurnitureSize.h;
      } else if (FURNITURE_PRESETS[furnitureTypeInput]) {
        const preset = FURNITURE_PRESETS[furnitureTypeInput][furnitureSubtypeInput];
        if (preset) {
          cmW = isRotatedPreset ? preset.h : preset.w;
          cmH = isRotatedPreset ? preset.w : preset.h;
        }
      }

      const pixelWidth = isDragSize ? snap(rawW) : Math.round((cmW / 100) * pxPerMeter);
      const pixelHeight = isDragSize ? snap(rawH) : Math.round((cmH / 100) * pxPerMeter);

      const spawnX = isDragSize ? Math.min(draftFurniture.start.x, draftFurniture.end.x) : snap(draftFurniture.end.x);
      const spawnY = isDragSize ? Math.min(draftFurniture.start.y, draftFurniture.end.y) : snap(draftFurniture.end.y);
      
      const furnitureName = furnitureTypeInput === '기타' ? (customFurnitureName || '기타') : furnitureTypeInput;
      const newItem = { id: ++nextIdRef.current, name: furnitureName, x: spawnX, y: spawnY, width: pixelWidth, height: pixelHeight, color: furnitureColorInput, isLocked: false };
      
      if (isValidPosition(newItem, placedFurniture)) {
        setPlacedFurniture([...placedFurniture, newItem]);
        setSelectedFurnitureIds([newItem.id]);
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
        else if (tool === 'door') setDoors([...doors, { id: Date.now(), start: lineStart, end: p, swingSide: 1 }]);
        setLineStart(null);
      }
    }
  };

  const toggleLockFurniture = (ids) => {
    const allLocked = placedFurniture.filter(f => ids.includes(f.id)).every(f => f.isLocked);
    setPlacedFurniture(placedFurniture.map(f => ids.includes(f.id) ? { ...f, isLocked: !allLocked } : f));
  };

  const toggleGroupFurniture = () => {
    const selectedItems = placedFurniture.filter(f => selectedFurnitureIds.includes(f.id));
    const allSameGroup = selectedItems.every(f => f.groupId && f.groupId === selectedItems[0].groupId);

    if (allSameGroup) { 
      setPlacedFurniture(placedFurniture.map(f => selectedFurnitureIds.includes(f.id) ? { ...f, groupId: null } : f));
    } else { 
      const newGroupId = Date.now();
      setPlacedFurniture(placedFurniture.map(f => selectedFurnitureIds.includes(f.id) ? { ...f, groupId: newGroupId } : f));
    }
  };

  const currentAnalysis = getDetailedAnalysis();

  return (
    <div style={{ padding: '40px', backgroundColor: '#fcfaff', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center', fontSize: '32px', fontWeight: '900', marginBottom: '40px' }}>인테리어 플래너</h1>
      
      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '40px' }}>
        <button onClick={() => setActiveTab('editor')} style={{ padding: '12px 30px', borderRadius: '99px', fontWeight: 'bold', border: 'none', cursor: 'pointer', backgroundColor: activeTab === 'editor' ? '#6366f1' : '#f3f4f6', color: activeTab === 'editor' ? '#fff' : '#9ca3af' }}>1. 도면 그리기</button>
        <button onClick={() => setActiveTab('placement')} disabled={rooms.length === 0 && walls.length === 0} style={{ padding: '12px 30px', borderRadius: '99px', fontWeight: 'bold', border: 'none', cursor: 'pointer', backgroundColor: activeTab === 'placement' ? '#6366f1' : '#f3f4f6', color: activeTab === 'placement' ? '#fff' : '#d1d5db' }}>2. 가구 배치</button>
        <button onClick={() => setActiveTab('results')} disabled={placedFurniture.length === 0} style={{ padding: '12px 30px', borderRadius: '99px', fontWeight: 'bold', border: 'none', cursor: placedFurniture.length > 0 ? 'pointer' : 'not-allowed', backgroundColor: activeTab === 'results' ? '#6366f1' : '#f3f4f6', color: activeTab === 'results' ? '#fff' : '#d1d5db' }}>3. 결과 분석</button>
        <button onClick={() => setActiveTab('recommendations')} style={{ padding: '12px 30px', borderRadius: '99px', fontWeight: 'bold', border: 'none', cursor: 'pointer', backgroundColor: activeTab === 'recommendations' ? '#10b981' : '#f3f4f6', color: activeTab === 'recommendations' ? '#fff' : '#9ca3af' }}>4. 추천 쇼핑몰</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '40px' }}>
        <div style={{ position: 'relative', border: '12px solid #111827', borderRadius: '24px', overflow: 'hidden', backgroundColor: '#fff', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)' }}>
          <svg width={roomCanvas.width} height={roomCanvas.height} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onClick={handleCanvasClick}>
            <defs><pattern id="grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse"><path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="#f1f5f9" strokeWidth="1" /></pattern></defs>
            <rect width={roomCanvas.width} height={roomCanvas.height} fill="url(#grid)" />
            
            {rooms.map(r => (
              <g key={r.id}>
                <rect x={r.x} y={r.y} width={r.width} height={r.height} fill={activeTab === 'editor' ? "#60a5fa11" : "#fff"} stroke="#3b82f6" strokeWidth="2" 
                  style={{ pointerEvents: (tool === 'delete' && activeTab === 'editor') ? 'auto' : 'none' }} 
                  onClick={(e) => { if(tool === 'delete' && activeTab === 'editor') { e.stopPropagation(); setRooms(rooms.filter(i => i.id !== r.id)); } }} 
                />
                <text x={r.x + 8} y={r.y + 25} fontSize="14" fontWeight="bold" fill="#1e293b">{r.name}</text>
                <text x={r.x + 8} y={r.y + 45} fontSize="12" fill="#64748b">{r.pyeong}평</text>
              </g>
            ))}
            
            {walls.map(w => <line key={w.id} x1={w.start.x} y1={w.start.y} x2={w.end.x} y2={w.end.y} stroke="#1e293b" strokeWidth="8" strokeLinecap="round" style={{ pointerEvents: (tool === 'delete' && activeTab === 'editor') ? 'auto' : 'none' }} onClick={(e) => { if(tool === 'delete' && activeTab === 'editor') { e.stopPropagation(); setWalls(walls.filter(i=>i.id!==w.id)); } }} />)}
            {windows.map(w => <line key={w.id} x1={w.start.x} y1={w.start.y} x2={w.end.x} y2={w.end.y} stroke="#38bdf8" strokeWidth="12" strokeLinecap="square" style={{ pointerEvents: (tool === 'delete' && activeTab === 'editor') ? 'auto' : 'none' }} onClick={(e) => { if(tool === 'delete' && activeTab === 'editor') { e.stopPropagation(); setWindows(windows.filter(i=>i.id!==w.id)); } }} />)}
            
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
                     if (tool === 'delete' && activeTab === 'editor') setDoors(doors.filter(i => i.id !== d.id));
                     else if (activeTab === 'editor') setDoors(doors.map(i => i.id === d.id ? { ...i, swingSide: side * -1 } : i));
                   }}
                   style={{ pointerEvents: activeTab === 'editor' ? 'auto' : 'none', cursor: activeTab === 'editor' ? 'pointer' : 'default' }}>
                  <path d={`M ${d.start.x} ${d.start.y} L ${d.end.x} ${d.end.y} A ${r} ${r} 0 0 ${sweep} ${ox} ${oy} Z`} fill="rgba(180, 83, 9, 0.15)" stroke="none" />
                  <line x1={d.start.x} y1={d.start.y} x2={d.end.x} y2={d.end.y} stroke="#b45309" strokeWidth="10" strokeLinecap="round" />
                </g>
              );
            })}
            
            {draftRoom && <rect x={Math.min(draftRoom.start.x, draftRoom.end.x)} y={Math.min(draftRoom.start.y, draftRoom.end.y)} width={Math.abs(draftRoom.start.x-draftRoom.end.x)} height={Math.abs(draftRoom.start.y-draftRoom.end.y)} fill="rgba(59, 130, 246, 0.3)" stroke="#2563eb" strokeWidth="2" strokeDasharray="8 4" />}
            
            {draftFurniture && selectedFurnitureIds.length === 0 && furnitureSubtypeInput === '직접입력' && (
              <rect x={Math.min(draftFurniture.start.x, draftFurniture.end.x)} y={Math.min(draftFurniture.start.y, draftFurniture.end.y)} width={Math.abs(draftFurniture.start.x-draftFurniture.end.x)} height={Math.abs(draftFurniture.start.y-draftFurniture.end.y)} fill={furnitureColorInput + '66'} stroke="#334155" strokeDasharray="4 4" />
            )}

            {lineStart && <line x1={lineStart.x} y1={lineStart.y} x2={mousePos.x} y2={mousePos.y} stroke="#ef4444" strokeWidth="2" strokeDasharray="6 4" />}
            
            {(activeTab === 'placement' || activeTab === 'results') && placedFurniture.map(f => {
              const isSelected = selectedFurnitureIds.includes(f.id);
              const actualCmW = Math.round((f.width / pxPerMeter) * 100);
              const actualCmH = Math.round((f.height / pxPerMeter) * 100);
              return (
                <g key={f.id} onMouseDown={(e) => { 
                  if (tool === 'delete' && activeTab === 'placement') { 
                    e.stopPropagation(); 
                    setPlacedFurniture(placedFurniture.filter(i=>i.id!==f.id)); 
                    setSelectedFurnitureIds(prev => prev.filter(id => id !== f.id));
                    setTool('select'); 
                  }
                }}>
                  <rect x={f.x} y={f.y} width={f.width} height={f.height} fill={f.color} stroke={isSelected ? '#6366f1' : '#475569'} strokeWidth={isSelected ? "4" : "2"} rx="6" style={{ cursor: tool === 'delete' ? 'pointer' : 'grab' }} />
                  <text x={f.x+5} y={f.y+18} fontSize="12" fontWeight="bold" fill="#1e293b" style={{ pointerEvents: 'none' }}>
                    {f.isLocked ? '📌 ' : ''}{f.groupId ? '🔗 ' : ''}{f.name}
                  </text>
                  <text x={f.x+5} y={f.y+32} fontSize="10" fill="#334155" style={{ pointerEvents: 'none' }}>
                    {actualCmW}x{actualCmH}cm
                  </text>
                </g>
              );
            })}
            
            {activeTab === 'placement' && previewAiId && aiRecommendations.find(r => r.id === previewAiId)?.items.map(p => <rect key={`pre-${p.id}`} x={p.x} y={p.y} width={p.width} height={p.height} fill="none" stroke="#a855f7" strokeWidth="3" strokeDasharray="6 4" style={{ pointerEvents: 'none' }} />)}
          </svg>
        </div>
        
        <div style={{ width: '340px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {activeTab === 'editor' ? (
            <div style={{ padding: '24px', backgroundColor: '#fff', borderRadius: '24px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontWeight: '900', marginBottom: '20px' }}>도면 도구</h3>
              <p style={{ fontSize: '11px', color: '#6b7280', marginBottom: '12px' }}>💡 문을 클릭하면 열림 방향이 반대로 바뀝니다.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button onClick={() => setTool('wall')} style={{ width: '100%', padding: '14px', borderRadius: '12px', fontWeight: 'bold', border: 'none', backgroundColor: tool === 'wall' ? '#6366f1' : '#f1f5f9', color: tool === 'wall' ? '#fff' : '#64748b', cursor: 'pointer' }}>벽 설치 (물리적 차단)</button>
                <button onClick={() => setTool('room')} style={{ width: '100%', padding: '14px', borderRadius: '12px', fontWeight: 'bold', border: 'none', backgroundColor: tool === 'room' ? '#6366f1' : '#f1f5f9', color: tool === 'room' ? '#fff' : '#64748b', cursor: 'pointer' }}>방 영역 지정 (가상선)</button>
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
          ) : activeTab === 'recommendations' ? (
            <div style={{ padding: '24px', backgroundColor: '#fff', borderRadius: '24px', border: '1px solid #d1fae5' }}>
              <h3 style={{ fontWeight: '900', fontSize: '20px', marginBottom: '16px', color: '#065f46' }}>🛍️ 추천 쇼핑몰</h3>
              <p style={{ fontSize: '13px', color: '#4b5563', marginBottom: '18px' }}>인테리어 소품과 가구를 찾을 수 있는 인기 쇼핑몰입니다.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {recommendedStoreLinks.map(store => (
                  <a key={store.url} href={store.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '16px', borderRadius: '18px', backgroundColor: '#f0fdf4', color: '#065f46', textDecoration: 'none', fontWeight: '700', border: '1px solid #a7f3d0' }}>
                    {store.name}
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: '24px', backgroundColor: '#fff', borderRadius: '24px', border: '1px solid #e5e7eb' }}>
              <h3 style={{ fontWeight: '900', marginBottom: '16px' }}>가구 관리</h3>
              
              {selectedFurnitureIds.length > 0 && (
                <div style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
                  <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 'bold', color: '#1f2937' }}>
                    선택된 가구: <span style={{ color: '#4f46e5' }}>{selectedFurnitureIds.length}개</span>
                  </p>

                  <button 
                    onClick={rotateSelectedFurniture} 
                    style={{ width: '100%', padding: '10px', marginBottom: '10px', backgroundColor: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                    🔄 선택한 가구 90도 회전
                  </button>

                  {selectedFurnitureIds.length > 1 && (
                    <button 
                      onClick={toggleGroupFurniture} 
                      style={{ width: '100%', padding: '10px', marginBottom: '10px', backgroundColor: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                      🔗 선택한 가구 그룹 묶기 / 해제
                    </button>
                  )}

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold', color: '#4b5563' }}>
                    <input 
                      type="checkbox" 
                      checked={placedFurniture.filter(f => selectedFurnitureIds.includes(f.id)).every(f => f.isLocked)} 
                      onChange={() => toggleLockFurniture(selectedFurnitureIds)}
                      style={{ width: '16px', height: '16px', accentColor: '#4f46e5' }}
                    />
                    📌 위치 고정 (AI 자동배치에서 무시됨)
                  </label>
                  <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#9ca3af' }}>💡 Shift 키를 누른 채 클릭하여 다중 선택 가능</p>
                </div>
              )}

              <select value={furnitureTypeInput} onChange={e => setFurnitureTypeInput(e.target.value)} style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '12px', marginBottom: '10px', fontWeight: 'bold' }}>
                <option>침대</option><option>책상</option><option>식탁</option><option>소파</option><option>의자</option><option>기타</option>
              </select>
              
              <div style={{ marginBottom: '10px' }}>
                <select value={furnitureSubtypeInput} onChange={e => setFurnitureSubtypeInput(e.target.value)} style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '13px' }}>
                  {FURNITURE_PRESETS[furnitureTypeInput] && Object.keys(FURNITURE_PRESETS[furnitureTypeInput]).map(subtype => (
                    <option key={subtype} value={subtype}>{subtype}</option>
                  ))}
                  <option value="직접입력">직접입력 (크기/이름 지정)</option>
                </select>
              </div>

              {furnitureSubtypeInput !== '직접입력' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold', color: '#4b5563', marginBottom: '12px' }}>
                  <input 
                    type="checkbox" 
                    checked={isRotatedPreset} 
                    onChange={() => setIsRotatedPreset(!isRotatedPreset)}
                    style={{ width: '16px', height: '16px', accentColor: '#4f46e5' }}
                  />
                  🔄 추가할 가구 90도 회전 (가로 ↔ 세로)
                </label>
              )}

              {(furnitureSubtypeInput === '직접입력' || furnitureTypeInput === '기타') && (
                <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '12px', marginBottom: '10px', border: '1px dashed #cbd5e1' }}>
                  <input value={customFurnitureName} onChange={e => setCustomFurnitureName(e.target.value)} placeholder="가구 이름 (예: 화분)" style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '8px', boxSizing: 'border-box', fontSize: '13px' }} />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: '#64748b' }}>가로(cm)</label>
                      <input type="number" value={customFurnitureSize.w} onChange={e => setCustomFurnitureSize({ ...customFurnitureSize, w: parseInt(e.target.value) || 0 })} style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '8px', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: '#64748b' }}>세로(cm)</label>
                      <input type="number" value={customFurnitureSize.h} onChange={e => setCustomFurnitureSize({ ...customFurnitureSize, h: parseInt(e.target.value) || 0 })} style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '8px', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                </div>
              )}
              
              <input type="color" value={furnitureColorInput} onChange={e => setFurnitureColorInput(e.target.value)} style={{ width: '100%', height: '44px', border: 'none', borderRadius: '12px', cursor: 'pointer', marginBottom: '12px' }} />
              
              <div style={{ backgroundColor: '#e0e7ff', color: '#3730a3', padding: '10px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', textAlign: 'center', marginBottom: '12px' }}>
                💡 캔버스의 빈 곳을 클릭하면 즉시 배치됩니다.
              </div>

              <button onClick={handleAddFurnitureClick} style={{ width: '100%', padding: '14px', backgroundColor: '#6366f1', color: '#fff', borderRadius: '14px', fontWeight: '900', border: 'none', cursor: 'pointer', marginBottom: '24px' }}>
                방 중앙에 바로 추가
              </button>

              <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', marginBottom: '24px' }} />

              <button onClick={generateAiRecommendations} style={{ width: '100%', padding: '18px', backgroundColor: '#a855f7', color: '#fff', borderRadius: '18px', fontWeight: '900', border: 'none', cursor: 'pointer', marginBottom: '16px' }}>✨ AI 자동 배치 (똑똑해짐!)</button>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {aiRecommendations.map(r => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#faf5ff', borderRadius: '12px', border: '1px solid #f3e8ff' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#4c1d95' }}>{r.name}</span>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#7c3aed', marginTop: '4px' }}>🌟 예상 점수: {r.score}점</span>
                    </div>
                    <button onClick={() => { setPlacedFurniture(r.items.map(i => ({...i}))); setPreviewAiId(null); setSelectedFurnitureIds([]); }} style={{ padding: '6px 14px', backgroundColor: '#a855f7', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>적용</button>
                  </div>
                ))}
              </div>
              
              <button onClick={() => setTool(tool === 'delete' ? 'select' : 'delete')} style={{ width: '100%', marginTop: '16px', padding: '12px', borderRadius: '12px', border: tool==='delete'?'2px solid #ef4444':'none', backgroundColor: '#f9fafb', cursor: 'pointer', fontWeight: 'bold', color: tool==='delete'?'#ef4444':'#475569' }}>
                {tool === 'delete' ? '✅ 취소 (모드 끄기)' : '🗑️ 가구 지우개 (클릭 시 1개 제거)'}
              </button>
            </div>
          )}
        </div>
      </div>

      {showScaleModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '24px', padding: '32px', width: '90%', maxWidth: '420px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '22px', fontWeight: '900', margin: '0 0 16px 0', color: '#1e293b' }}>📐 첫 번째 벽 길이 입력 (배율 설정)</h2>
            <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.5', marginBottom: '20px' }}>방의 올바른 평수 예측 및 <b>가구 크기 자동 맞춤</b>을 위해, 방금 그리신 첫 번째 벽의 실제 길이를 입력해 주세요.</p>
            <div style={{ marginBottom: '24px' }}>
              <input type="number" step="0.1" defaultValue="3.5" id="wallMeterInput" style={{ width: '100%', padding: '12px', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', boxSizing: 'border-box' }} placeholder="예: 3.5" />
            </div>
            <button onClick={() => { handleSaveScale(parseFloat(document.getElementById('wallMeterInput').value) || 3.5); }} style={{ width: '100%', padding: '14px', backgroundColor: '#6366f1', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' }}>배율 설정 완료</button>
          </div>
        </div>
      )}

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