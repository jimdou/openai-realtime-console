import { useRef, useEffect } from 'react';

const Waveform = ({ color1, color2, label1, label2, analyserNode1, analyserNode2 }) => {
  const canvasRef = useRef(null);
  const animationFrameId = useRef(null);
  const dataArray1 = useRef(null);
  const dataArray2 = useRef(null);

  useEffect(() => {
    if (!analyserNode1 && !analyserNode2) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Initialiser les tableaux de données
    if (analyserNode1) {
      dataArray1.current = new Uint8Array(analyserNode1.frequencyBinCount);
    }
    if (analyserNode2) {
      dataArray2.current = new Uint8Array(analyserNode2.frequencyBinCount);
    }

    const draw = () => {
      // Obtenir les dimensions du canvas
      const width = canvas.width;
      const height = canvas.height;

      // Effacer le canvas
      ctx.clearRect(0, 0, width, height);

      // Fonction pour dessiner une onde (Neon + Symétrie)
      const drawWave = (dataArray, color) => {
        if (!dataArray) return;

        // Configuration du style Neon
        ctx.shadowBlur = 15;
        ctx.shadowColor = color;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        
        // On prend 50% des fréquences les plus basses (plus visuelles)
        const usefulData = dataArray.slice(0, Math.floor(dataArray.length * 0.4));
        const bufferLength = usefulData.length;
        const sliceWidth = width / bufferLength;
        const centerY = height / 2;

        let x = 0;

        // Dessiner la partie supérieure
        ctx.moveTo(0, centerY);
        
        // Lissage simple : moyenne mobile
        const smoothedData = new Float32Array(bufferLength);
        for(let i=0; i<bufferLength; i++) {
           const prev = usefulData[i-1] || usefulData[i];
           const curr = usefulData[i];
           const next = usefulData[i+1] || usefulData[i];
           smoothedData[i] = (prev + curr + next) / 3;
        }

        for (let i = 0; i < bufferLength; i++) {
          const v = smoothedData[i] / 255.0; // Normalisé 0-1
          const amplitude = v * (height * 0.45); // Max amplitude ~45% height
          const y = centerY - amplitude;

          // Courbe quadratique pour lissage visuel
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            const prevX = (i - 1) * sliceWidth;
            const prevY = centerY - (smoothedData[i-1] / 255.0) * (height * 0.45);
            const cpX = (prevX + x) / 2;
            const cpY = (prevY + y) / 2; 
            ctx.quadraticCurveTo(cpX, cpY, x, y);
             // ctx.lineTo(x, y); 
          }
          x += sliceWidth;
        }

        // Revenir en arrière pour la symétrie (partie inférieure)
        // On repart de la fin vers le début
        for (let i = bufferLength - 1; i >= 0; i--) {
            const v = smoothedData[i] / 255.0;
            const amplitude = v * (height * 0.45);
            const y = centerY + amplitude;
            const currentX = i * sliceWidth;
            
            // On connecte
            // Pour simplifier, on fait un lineTo vers le point symétrique
            ctx.lineTo(currentX, y);
        }
        
        // Fermer la forme au début
        ctx.lineTo(0, centerY);
        ctx.stroke();

        // Optionnel : remplissage léger
        ctx.fillStyle = color + "20"; // 20 hex = ~12% opacity
        ctx.fill();
        
        // Reset shadow for performance cleanup? (Optional, ctx is cleared anyway)
        ctx.shadowBlur = 0;
      };

      // Obtenir et dessiner les données pour chaque analyseur
      // Dessiner Agent d'abord (Arrière plan ?) ou superposition ?
      // Mode 'screen' pour mélange lumineux
      ctx.globalCompositeOperation = 'screen';

      if (analyserNode1) {
        analyserNode1.getByteFrequencyData(dataArray1.current);
        drawWave(dataArray1.current, color1);
      }
      if (analyserNode2) {
        analyserNode2.getByteFrequencyData(dataArray2.current);
        drawWave(dataArray2.current, color2);
      }
      
      ctx.globalCompositeOperation = 'source-over'; // Reset default

      // Continuer l'animation
      animationFrameId.current = requestAnimationFrame(draw);
    };

    // Démarrer l'animation
    draw();

    // Nettoyer
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [analyserNode1, analyserNode2, color1, color2]);

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        width={500}
        height={300}
      />
      {/* <div className="absolute top-2 left-2 text-sm font-medium text-gray-500">
        {label1}
      </div>
      <div className="absolute top-2 right-2 text-sm font-medium text-gray-500">
        {label2}
      </div> */}
    </div>
  );
};

export default Waveform;
