/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, Suspense, Component, ReactNode, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { XR, createXRStore, useXRHitTest, useXRInputSourceEvent, XRDomOverlay } from '@react-three/xr';
import { OrbitControls, Environment, Line, useGLTF, useProgress } from '@react-three/drei';
import { Box, Circle, Triangle, Info, X, ChevronLeft, ChevronRight, HelpCircle, RotateCcw, RotateCw, Bone } from 'lucide-react';
import * as THREE from 'three';
import QuizOverlay from './components/QuizOverlay';

// Deskripsi Sarkofagus
const sarcophagusDesc = "Sarkofagus merupakan peti mati batu peninggalan masa Perundagian yang berfungsi sebagai wadah persemayaman jenazah sekaligus simbol perjalanan spiritual menuju alam roh. Di Bali, khususnya temuan dari wilayah Buleleng seperti di Desa Alas Angker, objek ini memiliki ciri khas berupa bentuk simetris menyerupai lesung atau tong dengan tonjolan pada bagian ujungnya yang sering dipahat menyerupai wajah atau sosok pelindung. Terbuat dari batu padas alami, sarkofagus ini mencerminkan tingginya tingkat peradaban dan kemahiran teknik memahat masyarakat Bali kuno dalam menghormati leluhur mereka.";

// Data Objek AR
const arData = [
  { id: '011', glb: 'https://ancdgyegjsjonjvjqorc.supabase.co/storage/v1/object/public/Asset/011.glb', img: 'https://ancdgyegjsjonjvjqorc.supabase.co/storage/v1/object/public/Asset/011.png', desc: sarcophagusDesc, title: 'Sarkofagus 1' },
  { id: '012', glb: 'https://ancdgyegjsjonjvjqorc.supabase.co/storage/v1/object/public/Asset/012.glb', img: 'https://ancdgyegjsjonjvjqorc.supabase.co/storage/v1/object/public/Asset/012.png', desc: sarcophagusDesc, title: 'Sarkofagus 2' },
  { id: '013', glb: 'https://ancdgyegjsjonjvjqorc.supabase.co/storage/v1/object/public/Asset/013.glb', img: 'https://ancdgyegjsjonjvjqorc.supabase.co/storage/v1/object/public/Asset/013.png', desc: sarcophagusDesc, title: 'Sarkofagus 3' },
];

// Preload semua model GLB agar tidak hilang saat transisi
arData.forEach((data) => {
  useGLTF.preload(data.glb);
});

// Error Boundary untuk mencegah crash jika file GLB belum diupload
class ErrorBoundary extends Component<{fallback: ReactNode, children: ReactNode}, {hasError: boolean}> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function GLBModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const clone = useMemo(() => scene.clone(), [scene]);
  return <primitive object={clone} />;
}

const store = createXRStore({
  depthSensing: false, // Dimatikan agar mendukung lebih banyak perangkat (tanpa fitur depth)
  meshDetection: false,
  planeDetection: false,
  bodyTracking: false,
  handTracking: false,
  anchors: false,
  layers: false,
  hitTest: true,
});

function ReticleAndPlacement({ 
  objectIndex, 
  setInstruction, 
  setReadiness,
  rotationY,
  setInfoModal
}: { 
  objectIndex: number, 
  setInstruction: (s: string) => void,
  setReadiness: (r: number) => void,
  rotationY: number,
  setInfoModal: (info: { title: string, desc: string } | null) => void
}) {
  const reticleRef = useRef<THREE.Mesh>(null);
  const [areaPoints, setAreaPoints] = useState<THREE.Vector3[]>([]);
  const [currentPosition, setCurrentPosition] = useState<THREE.Vector3 | null>(null);
  
  // State untuk Play Area tunggal dan Objek
  const [playArea, setPlayArea] = useState<{ scale: [number, number, number], p1: THREE.Vector3, p2: THREE.Vector3 } | null>(null);
  const [objectPosition, setObjectPosition] = useState<THREE.Vector3 | null>(null);

  const matrixHelper = new THREE.Matrix4();

  useXRHitTest((results, getWorldMatrix) => {
    if (results.length === 0) {
      // Jangan sembunyikan reticle jika tidak ada hit, biarkan di posisi terakhir
      return;
    }
    getWorldMatrix(matrixHelper, results[0]);
    const pos = new THREE.Vector3().setFromMatrixPosition(matrixHelper);
    setCurrentPosition(pos);

    if (reticleRef.current) {
      reticleRef.current.visible = true;
      reticleRef.current.matrix.copy(matrixHelper);
    }
  }, 'viewer');

  // Kalkulasi Kesiapan (Readiness) & Instruksi
  useEffect(() => {
    if (playArea) {
      setReadiness(100);
      setInstruction("Gunakan panah untuk ganti objek. Geser layar untuk merotasi.");
      return;
    }

    if (areaPoints.length === 1 && currentPosition) {
      const p1 = areaPoints[0];
      const p2 = currentPosition;
      const width = Math.abs(p1.x - p2.x);
      const depth = Math.abs(p1.z - p2.z);
      const area = width * depth;
      
      // Area optimal misalnya 0.04 m^2 (20cm x 20cm)
      const optimalArea = 0.04;
      const progress = Math.min(100, (area / optimalArea) * 100);
      setReadiness(progress);

      if (progress >= 100) {
        setInstruction("Area optimal! Ketuk untuk mengunci area.");
      } else {
        setInstruction("Mundur perlahan & tarik lebih luas agar area optimal.");
      }
    } else if (areaPoints.length === 0) {
      if (currentPosition) {
        setReadiness(10); // Permukaan terdeteksi
        setInstruction("Permukaan terdeteksi. Ketuk untuk mulai membuat area.");
      } else {
        setReadiness(0);
        setInstruction("Gerakkan kamera perlahan. Dekatkan atau jauhkan perangkat ke lantai.");
      }
    }
  }, [areaPoints, currentPosition, playArea, setInstruction, setReadiness]);

  useXRInputSourceEvent('all', 'select', () => {
    if (playArea) return; // Jika area sudah dibuat, abaikan tap untuk membuat area baru

    if (currentPosition) {
      if (areaPoints.length === 0) {
        // Titik pertama (Mulai menggambar area)
        setAreaPoints([currentPosition.clone()]);
      } else if (areaPoints.length === 1) {
        const p1 = areaPoints[0];
        const p2 = currentPosition.clone();
        const width = Math.abs(p1.x - p2.x);
        const depth = Math.abs(p1.z - p2.z);
        const area = width * depth;
        const optimalArea = 0.04;
        const progress = Math.min(100, (area / optimalArea) * 100);

        // Hanya izinkan membuat area jika sudah cukup besar (optimal)
        if (progress >= 100) {
          const center = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
          center.y = p1.y; 
          
          // Gunakan skala seragam (uniform scale) agar objek tidak lonjong
          const uniformScale = Math.min(width, depth);
          
          setPlayArea({ scale: [uniformScale, uniformScale, uniformScale], p1, p2 });
          setObjectPosition(center);
          setAreaPoints([]); // Selesai menggambar
        }
      }
    }
  }, [playArea, currentPosition, areaPoints]);

  const p1 = playArea ? playArea.p1 : areaPoints[0];
  const p2 = playArea ? playArea.p2 : (areaPoints.length === 1 ? currentPosition : null);

  // Garis imajiner (Bounding Box)
  const linePoints = (p1 && p2) ? [
    new THREE.Vector3(p1.x, p1.y, p1.z),
    new THREE.Vector3(p2.x, p1.y, p1.z),
    new THREE.Vector3(p2.x, p1.y, p2.z),
    new THREE.Vector3(p1.x, p1.y, p2.z),
    new THREE.Vector3(p1.x, p1.y, p1.z),
  ] : [];

  return (
    <>
      {/* Reticle (Penunjuk) */}
      <mesh ref={reticleRef} rotation-x={-Math.PI / 2} matrixAutoUpdate={false} renderOrder={1000}>
        <ringGeometry args={[0.05, 0.08, 32]} />
        <meshBasicMaterial color="white" opacity={0.8} transparent depthTest={false} depthWrite={false} />
      </mesh>

      {/* Garis Imajiner Area */}
      {linePoints.length > 0 && (
        <Line points={linePoints} color="#06b6d4" lineWidth={4} transparent depthTest={false} depthWrite={false} renderOrder={1000} />
      )}

      {/* Mesh Transparan Area */}
      {p1 && p2 && (
        <mesh position={[ (p1.x + p2.x)/2, p1.y, (p1.z + p2.z)/2 ]} rotation-x={-Math.PI / 2} renderOrder={999}>
          <planeGeometry args={[Math.abs(p1.x - p2.x), Math.abs(p1.z - p2.z)]} />
          <meshBasicMaterial color="#06b6d4" opacity={0.15} transparent side={THREE.DoubleSide} depthTest={false} depthWrite={false} />
        </mesh>
      )}

      {/* Objek 3D Tunggal yang bisa diganti dan digeser */}
      {playArea && objectPosition && (
        <group 
          position={objectPosition} 
          scale={playArea.scale}
          rotation={[0, rotationY, 0]}
        >
          <ErrorBoundary fallback={
            <mesh position={[0, 0.5, 0]}>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color="#ef4444" wireframe />
            </mesh>
          }>
            <Suspense fallback={
              <mesh position={[0, 0.5, 0]}>
                <sphereGeometry args={[0.5, 16, 16]} />
                <meshBasicMaterial color="#3b82f6" wireframe />
              </mesh>
            }>
              <GLBModel url={arData[objectIndex].glb} />
            </Suspense>
          </ErrorBoundary>
        </group>
      )}
    </>
  );
}

export default function App() {
  const [objectIndex, setObjectIndex] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const { progress: loadingProgress, active, loaded, total } = useProgress();
  const [isLoading, setIsLoading] = useState(true);
  const [instruction, setInstruction] = useState("Gerakkan kamera perlahan. Dekatkan atau jauhkan perangkat ke lantai.");
  const [readiness, setReadiness] = useState(0);
  const [rotationY, setRotationY] = useState(0);
  const [infoModal, setInfoModal] = useState<{ title: string, desc: string } | null>(null);
  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'quiz' | 'about' | 'ar'>('dashboard');

  const [isSwiping, setIsSwiping] = useState(false);
  const [touchStartX, setTouchStartX] = useState(0);
  const [startRotY, setStartRotY] = useState(0);

  const [isARSupported, setIsARSupported] = useState<boolean | null>(null);

  useEffect(() => {
    if (navigator.xr) {
      navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
        setIsARSupported(supported);
      });
    } else {
      setIsARSupported(false);
    }
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (readiness < 100) return;
    setIsSwiping(true);
    setTouchStartX(e.touches[0].clientX);
    setStartRotY(rotationY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping || readiness < 100) return;
    const deltaX = e.touches[0].clientX - touchStartX;
    setRotationY(startRotY + deltaX * 0.01);
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
  };

  useEffect(() => {
    // If loading is complete (progress is 100 or all items loaded)
    if (loadingProgress === 100 || (loaded > 0 && loaded === total)) {
      const timer = setTimeout(() => setIsLoading(false), 500);
      return () => clearTimeout(timer);
    }
    
    // Fallback if it's already cached and useProgress doesn't trigger
    const fallbackTimer = setTimeout(() => {
      setIsLoading(false);
    }, 3000);
    
    return () => clearTimeout(fallbackTimer);
  }, [loadingProgress, loaded, total]);

  const handleNextObject = () => {
    setObjectIndex((prev) => (prev + 1) % 3);
  };

  const handlePrevObject = () => {
    setObjectIndex((prev) => (prev - 1 + 3) % 3);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-screen bg-zinc-900 text-white font-sans">
        <h1 className="text-3xl font-bold mb-8">SarcoAR</h1>
        <div className="w-64 h-4 bg-zinc-800 rounded-full overflow-hidden mb-2 border border-zinc-700">
          <div
            className="h-full bg-blue-500 transition-all duration-200 ease-out"
            style={{ width: `${Math.min(loadingProgress, 100)}%` }}
          />
        </div>
        <p className="text-zinc-400 font-mono">{Math.round(Math.min(loadingProgress, 100))}%</p>
        <p className="text-sm text-zinc-500 mt-4">Memuat aset 3D dari Supabase...</p>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-screen overflow-hidden font-sans ${currentScreen === 'ar' ? 'bg-transparent' : 'bg-zinc-900'}`}>
      {/* 3D Canvas */}
      <Canvas className="w-full h-full" camera={{ position: [0, 0, 2], near: 0.001, far: 100 }}>
        <XR store={store}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 10]} intensity={1} />
          <Environment preset="city" />
          
          <ReticleAndPlacement 
            objectIndex={objectIndex} 
            setInstruction={setInstruction} 
            setReadiness={setReadiness}
            rotationY={rotationY}
            setInfoModal={setInfoModal}
          />
          
          <XRDomOverlay className="absolute inset-0 w-full h-full pointer-events-none">
            
            {/* Fullscreen swipe area for rotation */}
            <div 
              className={`absolute inset-0 z-0 ${readiness >= 100 ? 'pointer-events-auto' : 'pointer-events-none'}`}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
            />

            {/* Top Left: Progression Bar & Tutorial Button */}
            <div className="absolute top-6 left-6 flex flex-col gap-3 pointer-events-auto w-48 z-10">
              {/* Progression Bar */}
              <div className="bg-black/60 backdrop-blur-md p-3 rounded-xl border border-white/10 shadow-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">Kesiapan Area</span>
                  <span className="text-xs font-mono text-zinc-300">{Math.round(readiness)}%</span>
                </div>
                <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${readiness >= 100 ? 'bg-emerald-500' : readiness > 30 ? 'bg-amber-500' : 'bg-blue-500'}`}
                    style={{ width: `${readiness}%` }}
                  />
                </div>
              </div>

              {/* Tutorial Button */}
              <button
                onClick={() => setShowInfo(true)}
                className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-white hover:bg-white/20 transition-all shadow-lg w-fit"
              >
                <HelpCircle size={18} />
                <span className="text-sm font-medium">Tutorial</span>
              </button>
            </div>

            {/* Exit Button (Top Right) */}
            <div className="absolute top-6 right-6 pointer-events-auto z-10">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 bg-red-500/80 backdrop-blur-md px-4 py-2 rounded-xl border border-red-400/30 text-white hover:bg-red-500 transition-all shadow-lg"
              >
                <X size={18} />
                <span className="text-sm font-medium">Keluar</span>
              </button>
            </div>

            {/* Instruction Banner (Top Center) */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-md text-white px-6 py-3 rounded-full border border-white/20 text-center text-sm max-w-[50%] pointer-events-auto shadow-lg z-10">
              {instruction}
            </div>

            {/* UI Overlay (Bottom) */}
            <div className="absolute bottom-12 left-0 w-full px-6 flex flex-col items-center gap-4 pointer-events-none z-10">
              
              {readiness >= 100 && (
                <button
                  onClick={() => {
                    const currentObj = arData[objectIndex];
                    setInfoModal({ title: currentObj.title, desc: currentObj.desc });
                  }}
                  className="bg-black/60 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/20 text-white hover:bg-white/20 transition-all shadow-lg flex items-center gap-2 pointer-events-auto"
                >
                  <Info size={18} className="text-blue-400" />
                  <span className="text-sm font-medium">Informasi Objek</span>
                </button>
              )}

              <div className="bg-black/60 backdrop-blur-md p-2 rounded-2xl flex items-center gap-2 pointer-events-auto border border-white/10 shadow-2xl">
                <button
                  onClick={handlePrevObject}
                  className="p-3 text-white hover:bg-white/10 rounded-xl transition-colors"
                  aria-label="Objek Sebelumnya"
                >
                  <ChevronLeft size={24} />
                </button>
                
                <div className="w-16 h-16 flex items-center justify-center rounded-xl bg-white/10 overflow-hidden border border-white/20">
                  <img 
                    src={arData[objectIndex].img} 
                    alt="Icon" 
                    className="w-full h-full object-cover"
                    onError={(e) => { 
                      e.currentTarget.style.display = 'none'; 
                      e.currentTarget.parentElement?.classList.add('fallback-icon');
                    }}
                  />
                  <style>{`.fallback-icon::after { content: 'No Image'; font-size: 10px; color: #9ca3af; }`}</style>
                </div>

                <button
                  onClick={handleNextObject}
                  className="p-3 text-white hover:bg-white/10 rounded-xl transition-colors"
                  aria-label="Objek Selanjutnya"
                >
                  <ChevronRight size={24} />
                </button>
              </div>
            </div>

            {/* Info Modal (Tutorial) */}
            {showInfo && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6 pointer-events-auto">
                <div className="bg-zinc-900 border border-white/10 p-6 rounded-2xl max-w-sm w-full relative shadow-2xl">
                  <button
                    onClick={() => setShowInfo(false)}
                    className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
                  >
                    <X size={24} />
                  </button>
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <HelpCircle size={24} className="text-blue-400" />
                    Panduan AR
                  </h2>
                  <ul className="text-zinc-300 space-y-4 text-sm">
                    <li className="flex flex-col gap-1">
                      <strong className="text-white">1. Deteksi Permukaan</strong> 
                      <span>Gerakkan kamera perlahan. Dekatkan atau jauhkan perangkat ke lantai/meja hingga muncul garis biru (reticle).</span>
                    </li>
                    <li className="flex flex-col gap-1">
                      <strong className="text-white">2. Buat Area</strong> 
                      <span>Ketuk layar untuk titik pertama, lalu mundur perlahan untuk menggambar area. Ketuk lagi saat bar Kesiapan Area berwarna hijau (100%).</span>
                    </li>
                    <li className="flex flex-col gap-1">
                      <strong className="text-white">3. Ganti Objek Langsung</strong> 
                      <span>Setelah area terbentuk, gunakan panah di bawah untuk menukar objek 3D. Objek akan langsung berubah tanpa perlu menggambar area lagi.</span>
                    </li>
                    <li className="flex flex-col gap-1">
                      <strong className="text-white">4. Rotasi Objek</strong> 
                      <span>Geser layar ke kiri atau kanan untuk merotasi objek. Ketuk objek untuk melihat informasi.</span>
                    </li>
                  </ul>
                  <button 
                    onClick={() => setShowInfo(false)}
                    className="w-full mt-6 py-3 bg-white text-black font-semibold rounded-xl"
                  >
                    Mengerti
                  </button>
                </div>
              </div>
            )}

            {/* Object Info Modal */}
            {infoModal && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6 pointer-events-auto">
                <div className="bg-zinc-900 border border-white/10 p-6 rounded-2xl max-w-sm w-full relative shadow-2xl text-center">
                  <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Info size={32} />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">{infoModal.title}</h2>
                  <p className="text-zinc-300 text-sm leading-relaxed mb-6">
                    {infoModal.desc}
                  </p>
                  <button 
                    onClick={() => setInfoModal(null)}
                    className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-colors"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            )}
          </XRDomOverlay>
          
          <OrbitControls />
        </XR>
      </Canvas>

      {/* Dashboard Screen */}
      {currentScreen === 'dashboard' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-auto">
          {/* Background Image dari API */}
          <div className="absolute inset-0 z-0">
            <img src="https://picsum.photos/seed/prehistoric/1920/1080" alt="Background" className="w-full h-full object-cover opacity-40" crossOrigin="anonymous" />
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/40 to-zinc-900/95" />
          </div>

          <div className="z-10 flex flex-col items-center">
            <div className="w-20 h-20 bg-amber-700 rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-amber-700/20 border border-amber-500/30">
              <Bone size={40} className="text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">SarcoAR</h1>
            <p className="text-zinc-400 mb-12 text-center max-w-xs">Eksplorasi peninggalan prasejarah dalam wujud tiga dimensi.</p>
            
            <div className="flex flex-col gap-4 w-64">
              <button
                onClick={async () => {
                  if (isARSupported === false) {
                    alert("AR tidak didukung di perangkat atau browser ini.");
                    return;
                  }
                  try {
                    await store.enterAR();
                    setCurrentScreen('ar');
                  } catch (err: any) {
                    console.error("Failed to enter AR:", err);
                    alert("AR tidak didukung di perangkat ini atau terjadi kesalahan: " + err.message);
                  }
                }}
                disabled={isARSupported === false}
                className={`w-full py-4 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                  isARSupported === false 
                    ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed' 
                    : 'bg-amber-600 hover:bg-amber-700 text-white active:scale-95 shadow-lg shadow-amber-600/25'
                }`}
              >
                <Bone size={20} />
                {isARSupported === false ? 'AR Tidak Didukung' : 'Mulai AR'}
              </button>
              <button
                onClick={() => setCurrentScreen('quiz')}
                className="w-full bg-zinc-800/80 backdrop-blur-md hover:bg-zinc-700 text-white py-4 rounded-2xl font-semibold transition-all active:scale-95 border border-white/10 flex items-center justify-center gap-2"
              >
                <HelpCircle size={20} />
                Quiz
              </button>
              <button
                onClick={() => setCurrentScreen('about')}
                className="w-full bg-zinc-800/80 backdrop-blur-md hover:bg-zinc-700 text-white py-4 rounded-2xl font-semibold transition-all active:scale-95 border border-white/10 flex items-center justify-center gap-2"
              >
                <Info size={20} />
                About AR
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="absolute bottom-6 left-0 w-full flex justify-center z-20 pointer-events-auto">
            <a 
              href="https://wa.me/6285148444215" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-zinc-500 hover:text-amber-500 text-sm font-medium transition-colors"
            >
              Supported by TrigantalapatiStudio
            </a>
          </div>
        </div>
      )}

      {/* Quiz Screen */}
      {currentScreen === 'quiz' && (
        <QuizOverlay onClose={() => setCurrentScreen('dashboard')} />
      )}

      {/* About Screen */}
      {currentScreen === 'about' && (
        <div className="absolute inset-0 bg-zinc-900 flex flex-col items-center justify-center z-20 pointer-events-auto p-6">
          <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center mb-6">
            <Info size={32} className="text-purple-400" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">About SarcoAR</h2>
          <p className="text-zinc-400 mb-8 text-center max-w-sm leading-relaxed">
            SarcoAR adalah aplikasi Augmented Reality interaktif yang dirancang untuk membantu pengguna memvisualisasikan dan mempelajari bangun ruang tiga dimensi secara langsung di lingkungan sekitar.
          </p>
          <button
            onClick={() => setCurrentScreen('dashboard')}
            className="px-8 py-3 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 transition-colors"
          >
            Kembali ke Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
