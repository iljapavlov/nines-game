import React, { useState, useRef, useEffect } from 'react';
import { loadModel, segmentAndRecognize } from '../utils/recognition';
import { checkExpression } from '../utils/evaluation';
import Feedback from './Feedback';

const GameBoard = () => {
  const [zoom, setZoom] = useState(1.0);
  const [target, setTarget] = useState(Math.floor(Math.random() * 100)); // Random target number
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 }); // Track panning offset
  const [expression, setExpression] = useState('');
  const [feedback, setFeedback] = useState({ message: '', valid: null });
  const [isLoading, setIsLoading] = useState(false);
  const canvasRef = useRef(null);
  const drawingPaths = useRef([]); // Stores drawing paths for persistence
  const isPanning = useRef(false); // Track if we're currently panning
  const lastPanPoint = useRef({ x: 0, y: 0 }); // Last point during panning
  const modelRef = useRef(null);

  // Load TensorFlow model on component mount
  useEffect(() => {
    const initModel = async () => {
      try {
        setIsLoading(true);
        const model = await loadModel();
        modelRef.current = model;
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load model:', error);
        setFeedback({ message: 'Failed to load recognition model', valid: false });
        setIsLoading(false);
      }
    };

    initModel();
  }, []);

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
    
    // Base line width that will be adjusted with zoom
    const baseLineWidth = 4;
    ctx.lineWidth = baseLineWidth / zoom; // Adjust line width based on zoom
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
      
      // Calculate new zoom with increased sensitivity
      const delta = e.deltaY > 0 ? -0.1 : 0.1; // Increased delta for faster zoom
      const newZoom = Math.min(Math.max(zoom + delta, 0.1), 5.0); // Wider zoom range
      
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
    
    // Base line width that will be adjusted with zoom
    const baseLineWidth = 4;
    ctx.lineWidth = baseLineWidth / zoom; // Adjust line width based on zoom
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

  // Track achieved numbers
  const [achievedNumbers, setAchievedNumbers] = useState([]);

  // Evaluate the drawn expression
  const evaluateExpression = async () => {
    if (!modelRef.current) {
      setFeedback({ message: 'Recognition model not loaded yet', valid: false });
      return;
    }

    try {
      setIsLoading(true);
      setFeedback({ message: 'Recognizing expression...', valid: null });

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      // Get the image data from the canvas
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Recognize symbols from the drawing
      const symbols = await segmentAndRecognize(imageData, modelRef.current);
      
      // Construct the expression string
      const expressionString = symbols.map(s => s.symbol).join('');
      setExpression(expressionString);
      
      try {
        // Evaluate the expression
        const result = checkExpression(expressionString);
        
        if (result.valid && result.value !== undefined) {
          // If valid and has a value between 0-99, add to achieved numbers
          if (result.value >= 0 && result.value <= 99 && !achievedNumbers.includes(result.value)) {
            setAchievedNumbers(prev => [...prev, result.value]);
          }
          setFeedback({ 
            message: `Expression evaluates to ${result.value}`, 
            valid: true 
          });
        } else {
          setFeedback(result);
        }
      } catch (error) {
        setFeedback({ 
          message: 'Invalid expression', 
          valid: false 
        });
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error evaluating expression:', error);
      setFeedback({ message: 'Error recognizing or evaluating expression', valid: false });
      setIsLoading(false);
    }
  };

  // Clear the canvas
  const clearCanvas = () => {
    drawingPaths.current = [];
    redrawCanvas();
    setFeedback({ message: '', valid: null });
    setExpression('');
  };

  return (
    <div style={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
    }}>
      {/* Top navbar */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '15px',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        padding: '10px 20px',
        borderRadius: '30px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
        backdropFilter: 'blur(5px)',
        zIndex: 10,
      }}>
        <button
          onClick={clearCanvas}
          style={{
            padding: '8px 20px',
            borderRadius: '20px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          Clear
        </button>
        
        <button
          onClick={evaluateExpression}
          disabled={isLoading}
          style={{
            padding: '8px 20px',
            borderRadius: '20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            cursor: isLoading ? 'wait' : 'pointer',
            fontWeight: 'bold',
            opacity: isLoading ? 0.7 : 1,
          }}
        >
          {isLoading ? 'Processing...' : 'Evaluate'}
        </button>
      </div>

      {/* Feedback and expression display */}
      {(expression || feedback.message) && (
        <div style={{
          position: 'absolute',
          top: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          padding: '10px 20px',
          borderRadius: '10px',
          boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
          backdropFilter: 'blur(5px)',
          zIndex: 10,
          maxWidth: '80%',
        }}>
          {expression && (
            <div style={{ 
              marginBottom: feedback.message ? '10px' : 0, 
              fontSize: '18px',
            }}>
              Expression: {expression}
            </div>
          )}
          
          {feedback.message && (
            <div style={{
              color: feedback.valid ? '#155724' : feedback.valid === false ? '#721c24' : '#383d41',
            }}>
              {feedback.message}
            </div>
          )}
        </div>
      )}

      {/* Number grid in two columns */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        padding: '10px',
        borderRadius: '10px',
        boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
        zIndex: 10,
        height: 'calc(100vh - 40px)',
        overflowY: 'auto',
      }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '5px',
          height: '100%',
        }}>
          {Array.from({ length: 100 }, (_, i) => (
            <div
              key={i}
              style={{
                width: '30px',
                height: '30px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                border: '1px solid #ccc',
                borderRadius: '3px',
                fontSize: '14px',
                backgroundColor: achievedNumbers.includes(i) ? '#ffffa0' : 'white',
                boxShadow: achievedNumbers.includes(i) ? '0 0 5px 2px rgba(255, 215, 0, 0.6)' : 'none',
                fontWeight: achievedNumbers.includes(i) ? 'bold' : 'normal',
              }}
            >
              {i}
            </div>
          ))}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'white',
          touchAction: 'none',
          cursor: isPanning.current ? 'grabbing' : 'default',
        }}
      />
    </div>
  );
};

export default GameBoard;