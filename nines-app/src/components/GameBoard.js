import React, { useState, useRef, useEffect } from 'react';

const GameBoard = () => {
  const [zoom, setZoom] = useState(1.0);
  const [target, setTarget] = useState(Math.floor(Math.random() * 100)); // Random target number
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 }); // Track panning offset
  const canvasRef = useRef(null);
  const drawingPaths = useRef([]); // Stores drawing paths for persistence
  const isPanning = useRef(false); // Track if we're currently panning
  const lastPanPoint = useRef({ x: 0, y: 0 }); // Last point during panning

  // Set up canvas and drawing logic
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Set canvas to full screen size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Initialize with white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 4; // Thicker line width
    ctx.strokeStyle = 'black';

    // Apply current zoom level and pan offset
    ctx.setTransform(zoom, 0, 0, zoom, panOffset.x, panOffset.y);

    // Redraw existing paths with current zoom
    redrawCanvas();

    let drawing = false;
    let currentPath = [];

    const startDrawing = (e) => {
      // Only start drawing with left mouse button (button 0)
      if (e.button !== 0 || isPanning.current) return;
      
      drawing = true;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - panOffset.x) / zoom;
      const y = (e.clientY - rect.top - panOffset.y) / zoom;
      currentPath = [{ x, y }];
      
      // Start a new path
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const draw = (e) => {
      if (!drawing) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - panOffset.x) / zoom;
      const y = (e.clientY - rect.top - panOffset.y) / zoom;
      currentPath.push({ x, y });
      
      // Draw the line segment
      ctx.beginPath();
      ctx.moveTo(currentPath[currentPath.length - 2].x, currentPath[currentPath.length - 2].y);
      ctx.lineTo(x, y);
      ctx.stroke();
    };

    const stopDrawing = () => {
      if (drawing) {
        drawingPaths.current.push(currentPath);
        currentPath = [];
      }
      drawing = false;
    };

    const startPanning = (e) => {
      // Only start panning with right mouse button (button 2)
      if (e.button !== 2) return;
      
      e.preventDefault();
      isPanning.current = true;
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
    };

    const pan = (e) => {
      if (!isPanning.current) return;
      
      const dx = e.clientX - lastPanPoint.current.x;
      const dy = e.clientY - lastPanPoint.current.y;
      
      setPanOffset(prev => ({
        x: prev.x + dx,
        y: prev.y + dy
      }));
      
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
    };

    const stopPanning = () => {
      isPanning.current = false;
    };

    const handleWheel = (e) => {
      e.preventDefault();
      
      // Get mouse position relative to canvas
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Calculate position in world space before zoom
      const worldX = (mouseX - panOffset.x) / zoom;
      const worldY = (mouseY - panOffset.y) / zoom;
      
      // Calculate new zoom
      const delta = e.deltaY > 0 ? -0.05 : 0.05; // Smaller delta for smoother zoom
      const newZoom = Math.min(Math.max(zoom + delta, 0.5), 2.0);
      
      // Calculate new pan offset to zoom at cursor position
      const newPanX = mouseX - worldX * newZoom;
      const newPanY = mouseY - worldY * newZoom;
      
      setZoom(newZoom);
      setPanOffset({ x: newPanX, y: newPanY });
    };

    // Prevent context menu on right-click
    const handleContextMenu = (e) => {
      e.preventDefault();
    };

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);
    canvas.addEventListener('wheel', handleWheel);
    canvas.addEventListener('contextmenu', handleContextMenu);
    
    // Right-click panning events
    canvas.addEventListener('mousedown', startPanning);
    canvas.addEventListener('mousemove', pan);
    canvas.addEventListener('mouseup', stopPanning);
    canvas.addEventListener('mouseleave', stopPanning);

    // Cleanup event listeners
    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseleave', stopDrawing);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      
      canvas.removeEventListener('mousedown', startPanning);
      canvas.removeEventListener('mousemove', pan);
      canvas.removeEventListener('mouseup', stopPanning);
      canvas.removeEventListener('mouseleave', stopPanning);
    };
  }, [zoom, panOffset]);

  // Redraw canvas at current zoom level
  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Apply zoom and pan
    ctx.setTransform(zoom, 0, 0, zoom, panOffset.x, panOffset.y);
    
    // Redraw all paths
    ctx.lineWidth = 4; // Thicker line width
    ctx.strokeStyle = 'black';
    
    drawingPaths.current.forEach((path) => {
      if (path.length < 2) return;
      
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
      }
      
      ctx.stroke();
    });
  };

  // Generate a new random target
  const generateNewTarget = () => {
    setTarget(Math.floor(Math.random() * 100));
  };

  // Clear the canvas
  const clearCanvas = () => {
    drawingPaths.current = [];
    redrawCanvas();
  };

  return (
    <div style={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
    }}>
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'white',
          touchAction: 'none', // Prevents default touch actions like scrolling
          cursor: isPanning.current ? 'grabbing' : 'default',
        }}
      />
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        padding: '10px',
        borderRadius: '10px',
        boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
        zIndex: 10, // Ensure controls are above canvas
      }}>
        <div style={{ marginBottom: '10px', fontSize: '18px', fontWeight: 'bold' }}>
          Target: {target}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={clearCanvas}
            style={{
              padding: '10px 20px',
              borderRadius: '5px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
          <button
            onClick={generateNewTarget}
            style={{
              padding: '10px 20px',
              borderRadius: '5px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            New Target
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameBoard;