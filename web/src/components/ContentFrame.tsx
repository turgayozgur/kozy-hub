import { useState, useEffect, useRef } from 'react';
import { ImageIcon } from 'lucide-react';
import type { ImageSize } from '../types';

interface ContentFrameProps {
  imageData?: string;
}

export function ContentFrame({ imageData }: ContentFrameProps) {
  const [imageSize, setImageSize] = useState<ImageSize | null>(null);
  const [fitMode, setFitMode] = useState<'width' | 'height'>('width');
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  
  // Resmi yüklendiğinde boyutlarını al ve fit modunu ayarla
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.target as HTMLImageElement;
    setImageSize({
      width: img.naturalWidth,
      height: img.naturalHeight
    });
    
    // Resim yüklendiğinde hemen fit modunu hesapla
    if (containerRef.current) {
      const container = containerRef.current;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      
      // Oranları hesapla
      const containerRatio = containerWidth / containerHeight;
      const imageRatio = img.naturalWidth / img.naturalHeight;
      
      // Eğer resim göreceli olarak container'dan daha genişse width'e göre, değilse height'e göre yerleştir
      setFitMode(imageRatio > containerRatio ? 'width' : 'height');
    }
  };
  
  // Pencere yeniden boyutlandığında fit modunu güncelle
  useEffect(() => {
    const updateFitMode = () => {
      if (!imageSize || !containerRef.current) return;
      
      const container = containerRef.current;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      
      // Oranları hesapla
      const containerRatio = containerWidth / containerHeight;
      const imageRatio = imageSize.width / imageSize.height;
      
      // Fit modunu güncelle
      setFitMode(imageRatio > containerRatio ? 'width' : 'height');
    };
    
    // Pencere boyutu değiştiğinde güncelle
    window.addEventListener('resize', updateFitMode);
    return () => {
      window.removeEventListener('resize', updateFitMode);
    };
  }, [imageSize]);
  
  // İmgenin boyutlandırma sınıflarını hesapla - render sırasında doğrudan kullanılabilir
  const getImageClasses = () => {
    if (!imageSize) {
      return 'invisible'; // Boyut hesaplanmadan önce görünmez yap
    }
    
    return `max-w-[95%] max-h-[95%] ${fitMode === 'width' ? 'w-full h-auto' : 'h-full w-auto'}`;
  };
  
  if (imageData) {
    return (
      <div 
        ref={containerRef}
        className="w-full h-full flex items-center justify-center bg-black border-t border-r border-b relative"
      >
        {/* Image container with padding to ensure black borders */}
        <div className="p-6 md:p-8 flex items-center justify-center w-full h-full">
          {/* Image dimensions indicator */}
          {imageSize && (
            <div className="absolute top-3 right-3 bg-black/50 text-white px-2 py-1 text-xs rounded z-10">
              {imageSize.width} × {imageSize.height} px
            </div>
          )}
          
          {/* Image centered with max dimensions to ensure black borders */}
          <img 
            ref={imgRef}
            src={`data:image/jpeg;base64,${imageData}`} 
            alt="Device image"
            className={getImageClasses()}
            onLoad={handleImageLoad}
            style={{visibility: imageSize ? 'visible' : 'hidden'}} // CSS üzerinden kontrol
          />
        </div>
      </div>
    );
  }
  
  // Empty state - full black background
  return (
    <div 
      ref={containerRef}
      className="w-full h-full flex items-center justify-center bg-black border-t border-r border-b"
    >
      <div className="text-center text-white dark:text-gray-300">
        <ImageIcon className="w-10 h-10 opacity-30 mx-auto mb-3" />
        <p className="text-sm">Image will appear here</p>
      </div>
    </div>
  );
} 