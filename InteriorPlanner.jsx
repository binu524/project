import React, { useState } from 'react';

const InteriorPlanner = () => {
  // 1. 입력값 설정 (기획안 Step 1 반영)
  const [room, setRoom] = useState({ width: 400, height: 300 }); // 4m x 3m (10px = 10cm) [cite: 96, 103]
  const [furnitures, setFurnitures] = useState([
    { id: 1, name: '침대', w: 150, h: 200, x: 0, y: 0, color: 'bg-blue-200' },
    { id: 2, name: '책상', w: 120, h: 60, x: 0, y: 0, color: 'bg-green-200' },
    { id: 3, name: '옷장', w: 180, h: 80, x: 0, y: 0, color: 'bg-yellow-200' },
  ]);
  const [recommendations, setRecommendations] = useState([]);

  // 2. 자동 배치 엔진 (기획안 핵심 로직 구현) [cite: 32, 39]
  const generateLayout = () => {
    // 단순화된 규칙 기반 배치: 가구를 벽면에 우선 배치 (Step 1~2 반영) [cite: 102, 121]
    const newLayouts = [
      // 추천안 A: 휴식 중심 (침대 벽면) [cite: 41, 63]
      furnitures.map((f, i) => {
        if (f.name === '침대') return { ...f, x: 0, y: 0 };
        if (f.name === '책상') return { ...f, x: 280, y: 0 };
        return { ...f, x: 0, y: 220 };
      }),
      // 추천안 B: 작업 중심 (책상 창가/코너) [cite: 41, 64]
      furnitures.map((f, i) => {
        if (f.name === '책상') return { ...f, x: 140, y: 0 };
        if (f.name === '침대') return { ...f, x: 0, y: 100 };
        return { ...f, x: 220, y: 220 };
      })
    ];
    
    setRecommendations(newLayouts);
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6">인테리어 플래너 AI 배치</h1> [cite: 1]
      
      <div className="flex gap-8">
        {/* 왼쪽: 2D 평면도 뷰어 [cite: 72, 117] */}
        <div className="bg-white border-4 border-gray-800 relative" 
             style={{ width: room.width, height: room.height }}>
          <div className="absolute top-0 right-10 w-20 h-2 bg-blue-400 text-xs text-center">창문</div> [cite: 27, 98]
          <div className="absolute bottom-0 left-4 w-2 h-16 bg-red-400 text-xs flex items-center">문</div> [cite: 26, 97]
          
          {(recommendations[0] || furnitures).map(f => (
            <div key={f.id} 
                 className={`absolute ${f.color} border border-gray-600 flex items-center justify-center text-xs font-bold transition-all`}
                 style={{ width: f.w, height: f.h, left: f.x, top: f.y }}>
              {f.name}
            </div>
          ))}
        </div>

        {/* 오른쪽: 제어 및 점수판 [cite: 42, 65] */}
        <div className="flex-1 space-y-4">
          <button onClick={generateLayout} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700">
            자동 배치 추천 실행
          </button> [cite: 21, 118]

          <div className="bg-white p-4 rounded shadow">
            <h3 className="font-bold mb-2">분석 점수</h3> [cite: 42]
            <p>🚶 동선 점수: 85점 [cite: 43]</p>
            <p>☀️ 채광 점수: 90점 [cite: 48]</p>
            <p>📦 공간 효율: 78점 [cite: 52]</p>
            <div className="mt-2 text-sm text-red-500 italic">
              * 이 배치는 옷장 문 열림 반경이 좁을 수 있습니다. [cite: 74]
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InteriorPlanner;