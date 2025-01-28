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

      // Fonction pour dessiner une onde
      const drawWave = (dataArray, color) => {
        if (!dataArray) return;

        ctx.beginPath();
        ctx.moveTo(0, height);

        const sliceWidth = width / dataArray.length;
        let x = 0;

        for (let i = 0; i < dataArray.length; i++) {
          const v = dataArray[i] / 128.0;
          const y = height - (v * height / 2);

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        ctx.lineTo(width, height);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      };

      // Obtenir et dessiner les données pour chaque analyseur
      if (analyserNode1) {
        analyserNode1.getByteFrequencyData(dataArray1.current);
        drawWave(dataArray1.current, color1);
      }
      if (analyserNode2) {
        analyserNode2.getByteFrequencyData(dataArray2.current);
        drawWave(dataArray2.current, color2);
      }

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
        height={100}
      />
      <div className="absolute top-2 left-2 text-sm font-medium text-gray-500">
        {label1}
      </div>
      <div className="absolute top-2 right-2 text-sm font-medium text-gray-500">
        {label2}
      </div>
    </div>
  );
};

export default Waveform;
