import React, { forwardRef } from "react";
import { useDraggable } from "@/hooks/mouse/useDraggable";
import type {
  DraggableHandle,
  DraggableProps,
} from "@/hooks/mouse/useDraggable";
import "./draggable.scss";

export type {
  DraggableHandle,
  DraggableProps,
  InitialPosition,
} from "@/hooks/mouse/useDraggable";

const Draggable = forwardRef<DraggableHandle, DraggableProps>((props, ref) => {
  const { customClass = "", containerStyle, children } = props;
  const { containerRef, isDragging, handleMouseDown, handleTouchStart } =
    useDraggable(props, ref);

  const mergedStyle: React.CSSProperties = {
    ...containerStyle,
    transform: "translate(var(--translate-x, 0), var(--translate-y, 0))",
  };

  return (
    <>
      {isDragging && (
        <div
          className="drag-mask"
          onMouseMove={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
          onMouseUp={(event) => event.stopPropagation()}
          onTouchEnd={(event) => event.stopPropagation()}
          onTouchCancel={(event) => event.stopPropagation()}
          onMouseLeave={(event) => event.stopPropagation()}
        />
      )}
      <div
        ref={containerRef}
        className={`draggable-container ${customClass}`}
        style={mergedStyle}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {children}
      </div>
    </>
  );
});

Draggable.displayName = "Draggable";

export default Draggable;
