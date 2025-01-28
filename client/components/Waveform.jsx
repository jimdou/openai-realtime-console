import { useRef, useEffect } from 'react';

const Waveform = ({ color, darkColor, label, analyserNode }) => {
  const canvasRef = useRef(null);
  const animationFrameId = useRef(null);
  const dataArray = useRef(null);

  useEffect(() => {
    if (!analyserNode) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Initialiser le tableau de données
    dataArray.current = new Uint8Array(analyserNode.frequencyBinCount);

    const draw = () => {
      // Obtenir les dimensions du canvas
      const width = canvas.width;
      const height = canvas.height;

      // Effacer le canvas
      ctx.clearRect(0, 0, width, height);

      // Obtenir les données de fréquence
      analyserNode.getByteFrequencyData(dataArray.current);

      // Dessiner la forme d'onde
      ctx.beginPath();
      ctx.moveTo(0, height / 2);

      const sliceWidth = width / dataArray.current.length;
      let x = 0;

      for (let i = 0; i < dataArray.current.length; i++) {
        const v = dataArray.current[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

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
  }, [analyserNode, color]);

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        width={500}
        height={100}
      />
      <div className="absolute top-2 left-2 text-sm font-medium text-gray-500">
        {label}
      </div>
    </div>
  );
};

export default Waveform;
