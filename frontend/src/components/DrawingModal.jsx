import React, { useRef, useState, useEffect } from 'react';
import { X, Eraser, PenTool, Trash2, Send, Download } from 'lucide-react';

const DrawingModal = ({ isOpen, onClose, onSend, initialImage }) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#000000');
    const [brushSize, setBrushSize] = useState(5);
    const [isEraser, setIsEraser] = useState(false);
    const [context, setContext] = useState(null);

    const colors = ['#000000', '#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#FFFFFF'];

    useEffect(() => {
        if (isOpen && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            
            // Set canvas size to match container
            const updateSize = () => {
                const parent = canvas.parentElement;
                if (parent) {
                    canvas.width = parent.clientWidth;
                    canvas.height = parent.clientHeight;
                    // Reset white background
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
            };
            
            updateSize();
            
            // Draw initial image if provided
            if (initialImage) {
                const img = new Image();
                img.crossOrigin = 'Anonymous';
                img.onload = () => {
                    // Calculate dimensions to fit image within the canvas while preserving aspect ratio
                    const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
                    const drawWidth = img.width * scale;
                    const drawHeight = img.height * scale;
                    const offsetX = (canvas.width - drawWidth) / 2;
                    const offsetY = (canvas.height - drawHeight) / 2;
                    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
                };
                img.src = initialImage;
            }

            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            setContext(ctx);

            // Handle resize
            window.addEventListener('resize', updateSize);
            return () => window.removeEventListener('resize', updateSize);
        }
    }, [isOpen]);

    useEffect(() => {
        if (context) {
            context.strokeStyle = isEraser ? '#ffffff' : color;
            context.lineWidth = brushSize;
        }
    }, [color, brushSize, isEraser, context]);

    const startDrawing = (e) => {
        if (!context) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
        const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
        
        context.beginPath();
        context.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing || !context) return;
        e.preventDefault(); // Prevent scrolling on touch
        const rect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
        const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
        
        context.lineTo(x, y);
        context.stroke();
    };

    const stopDrawing = () => {
        if (!context) return;
        context.closePath();
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        if (!canvasRef.current || !context) return;
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        
        // Re-draw initial image on clear if provided
        if (initialImage) {
             const img = new Image();
             img.crossOrigin = 'Anonymous';
             img.onload = () => {
                  const scale = Math.min(canvasRef.current.width / img.width, canvasRef.current.height / img.height);
                  const drawWidth = img.width * scale;
                  const drawHeight = img.height * scale;
                  const offsetX = (canvasRef.current.width - drawWidth) / 2;
                  const offsetY = (canvasRef.current.height - drawHeight) / 2;
                  context.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
             };
             img.src = initialImage;
        }
    };

    const handleSend = () => {
        if (!canvasRef.current) return;
        canvasRef.current.toBlob((blob) => {
            if (blob) {
                const file = new File([blob], `drawing_${Date.now()}.png`, { type: 'image/png' });
                onSend(file);
                onClose();
            }
        }, 'image/png');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-100 flex flex-col bg-black/80 items-center justify-center p-4">
            <div className="w-full max-w-4xl bg-[#f0f2f5] dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[85vh]">
                
                {/* Header */}
                <div className="p-4 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between z-10">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <PenTool className="text-blue-500" />
                        Draw Message
                    </h2>
                    <button onClick={onClose} className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-full transition-colors text-gray-600 dark:text-gray-300">
                        <X size={20} />
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                    
                    {/* Toolbar (Left on desktop, bottom on mobile) */}
                    <div className="md:w-20 md:h-full w-full bg-white dark:bg-slate-800 border-r md:border-r md:border-b-0 border-b border-gray-200 dark:border-slate-700 p-2 flex md:flex-col flex-row items-center gap-4 overflow-x-auto md:overflow-y-auto shrink-0 z-10">
                        
                        {/* Tools */}
                        <div className="flex md:flex-col flex-row gap-2">
                            <button 
                                onClick={() => setIsEraser(false)} 
                                className={`p-3 rounded-xl transition-colors ${!isEraser ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700'}`}
                                title="Pen Tool"
                            >
                                <PenTool size={24} />
                            </button>
                            <button 
                                onClick={() => setIsEraser(true)} 
                                className={`p-3 rounded-xl transition-colors ${isEraser ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700'}`}
                                title="Eraser Tool"
                            >
                                <Eraser size={24} />
                            </button>
                        </div>

                        <div className="md:w-full w-px h-8 md:h-px bg-gray-200 dark:bg-slate-700 my-1 mx-2 md:mx-0"></div>

                        {/* Colors */}
                        <div className="flex md:flex-col flex-row gap-2">
                            {colors.map(c => (
                                <button
                                    key={c}
                                    onClick={() => { setColor(c); setIsEraser(false); }}
                                    className={`w-10 h-10 rounded-full border-2 transition-transform ${color === c && !isEraser ? 'scale-125 border-gray-400 dark:border-white shadow-md' : 'border-transparent hover:scale-110'}`}
                                    style={{ backgroundColor: c, boxShadow: c === '#FFFFFF' ? 'inset 0 0 0 1px #e5e7eb' : 'none' }}
                                    title={`Color ${c}`}
                                />
                            ))}
                        </div>

                        <div className="md:w-full w-px h-8 md:h-px bg-gray-200 dark:bg-slate-700 my-1 mx-2 md:mx-0"></div>

                        {/* Brush Size */}
                        <div className="flex md:flex-col flex-row gap-2 items-center flex-1 justify-center md:justify-start">
                           <div className="w-8 h-8 flex items-center justify-center"><div className="bg-gray-400 rounded-full" style={{ width: '4px', height: '4px' }}></div></div>
                           <input 
                               type="range" 
                               min="1" 
                               max="30" 
                               value={brushSize} 
                               onChange={(e) => setBrushSize(parseInt(e.target.value))}
                               className="md:w-28 w-24 md:-rotate-90 md:my-10 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700"
                            />
                           <div className="w-8 h-8 flex items-center justify-center"><div className="bg-gray-400 rounded-full" style={{ width: '20px', height: '20px' }}></div></div>
                        </div>

                    </div>

                    {/* Canvas Area */}
                    <div className="flex-1 bg-gray-200 dark:bg-slate-900 overflow-hidden relative touch-none p-2 md:p-6 flex items-center justify-center cursor-crosshair">
                        <div className="w-full h-full bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-200 dark:border-slate-700 relative">
                            <canvas
                                ref={canvasRef}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseOut={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                                className="absolute inset-0 w-full h-full"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="p-4 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 flex justify-between items-center z-10 shrink-0">
                    <button 
                        onClick={clearCanvas} 
                        className="flex items-center gap-2 px-4 py-2.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors font-bold text-sm"
                    >
                        <Trash2 size={18} />
                        Clear Canvas
                    </button>

                    <div className="flex items-center gap-3">
                        <button 
                            onClick={onClose}
                            className="px-6 py-2.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-bold text-sm"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSend}
                            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-lg hover:shadow-blue-500/25 font-bold text-sm"
                        >
                            <Send size={18} />
                            Attach Drawing
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default DrawingModal;
