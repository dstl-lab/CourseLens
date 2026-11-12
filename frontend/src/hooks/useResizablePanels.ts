import { useState, useRef, useEffect, useCallback } from "react";

export function useResizablePanels() {
  const [viewerPanelWidth, setViewerPanelWidth] = useState<number | null>(null);
  const isViewerDragging = useRef(false);
  const viewerDragStartX = useRef(0);
  const viewerDragStartWidth = useRef(0);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const viewerPanelRef = useRef<HTMLDivElement>(null);

  const [changesSidebarWidth, setChangesSidebarWidth] = useState(256);
  const isChangesSidebarDragging = useRef(false);
  const changesSidebarDragStartX = useRef(0);
  const changesSidebarDragStartWidth = useRef(0);
  const [isDraggingAny, setIsDraggingAny] = useState(false);

  const handleViewerDragStart = useCallback((e: React.MouseEvent) => {
    isViewerDragging.current = true;
    viewerDragStartX.current = e.clientX;
    const containerWidth = splitContainerRef.current?.clientWidth ?? 800;
    viewerDragStartWidth.current = viewerPanelWidth ?? containerWidth / 2;
    setIsDraggingAny(true);
    e.preventDefault();
  }, [viewerPanelWidth]);

  const handleChangesSidebarDragStart = useCallback((e: React.MouseEvent) => {
    isChangesSidebarDragging.current = true;
    changesSidebarDragStartX.current = e.clientX;
    changesSidebarDragStartWidth.current = changesSidebarWidth;
    setIsDraggingAny(true);
    e.preventDefault();
  }, [changesSidebarWidth]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isViewerDragging.current) {
        const delta = viewerDragStartX.current - e.clientX;
        const containerWidth = splitContainerRef.current?.clientWidth ?? 800;
        const newWidth = Math.min(containerWidth * 0.85, Math.max(containerWidth * 0.15, viewerDragStartWidth.current + delta));
        setViewerPanelWidth(newWidth);
      }
      if (isChangesSidebarDragging.current) {
        const delta = changesSidebarDragStartX.current - e.clientX;
        const panelWidth = viewerPanelRef.current?.clientWidth ?? 600;
        const newWidth = Math.min(panelWidth * 0.6, Math.max(160, changesSidebarDragStartWidth.current + delta));
        setChangesSidebarWidth(newWidth);
      }
    };
    const onMouseUp = () => {
      isViewerDragging.current = false;
      isChangesSidebarDragging.current = false;
      setIsDraggingAny(false);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  return {
    viewerPanelWidth,
    setViewerPanelWidth,
    splitContainerRef,
    viewerPanelRef,
    handleViewerDragStart,
    changesSidebarWidth,
    setChangesSidebarWidth,
    handleChangesSidebarDragStart,
    isDraggingAny,
  };
}
