import type { ToolDefinition } from "../../tools";
import { ToolLogo } from "../../components/ToolLogo";

interface ToolCardProps {
  tool: ToolDefinition;
  favorite: boolean;
  detail: string;
  openLabel: string;
  favoriteLabel: string;
  reorderLabel: string;
  dragging: boolean;
  dropPosition: "before" | "after" | null;
  onOpen(toolId: string): void;
  onFavorite(toolId: string, favorite: boolean): void;
  onDragStart(toolId: string, event: React.DragEvent<HTMLButtonElement>): void;
  onDragOver(toolId: string, event: React.DragEvent<HTMLElement>): void;
  onDrop(toolId: string, event: React.DragEvent<HTMLElement>): void;
  onDragEnd(): void;
  onMove(toolId: string, direction: "up" | "down"): void;
  onReorderHint(): void;
}

export function ToolCard({
  tool,
  favorite,
  detail,
  openLabel,
  favoriteLabel,
  reorderLabel,
  dragging,
  dropPosition,
  onOpen,
  onFavorite,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMove,
  onReorderHint,
}: ToolCardProps) {
  return (
    <article
      className="tool-card"
      data-dragging={dragging || undefined}
      data-drop-position={dropPosition ?? undefined}
      onDragOver={(event) => onDragOver(tool.id, event)}
      onDrop={(event) => onDrop(tool.id, event)}
    >
      <button
        type="button"
        className="drag-handle"
        draggable
        aria-label={`${reorderLabel} ${tool.name}`}
        aria-describedby="tool-reorder-instructions"
        title={`${reorderLabel} ${tool.name}`}
        onClick={onReorderHint}
        onDragStart={(event) => onDragStart(tool.id, event)}
        onDragEnd={onDragEnd}
        onKeyDown={(event) => {
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
          event.preventDefault();
          onMove(tool.id, event.key === "ArrowUp" ? "up" : "down");
        }}
      >
        <svg viewBox="0 0 18 24" aria-hidden="true">
          <circle cx="6" cy="7" r="1.4" />
          <circle cx="12" cy="7" r="1.4" />
          <circle cx="6" cy="12" r="1.4" />
          <circle cx="12" cy="12" r="1.4" />
          <circle cx="6" cy="17" r="1.4" />
          <circle cx="12" cy="17" r="1.4" />
        </svg>
      </button>
      <button
        type="button"
        className="tool-launch"
        aria-label={`${openLabel} ${tool.name}`}
        onClick={() => onOpen(tool.id)}
      >
        <ToolLogo tool={tool} />
        <span className="tool-copy">
          <span className="tool-name">{tool.name}</span>
          <span className="tool-detail">{detail}</span>
        </span>
      </button>
      <button
        type="button"
        className="favorite-button"
        aria-label={`${favoriteLabel} ${tool.name}`}
        aria-pressed={favorite}
        onClick={() => onFavorite(tool.id, !favorite)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 3 2.75 5.57 6.15.9-4.45 4.33 1.05 6.12L12 17.03l-5.5 2.89 1.05-6.12L3.1 9.47l6.15-.9L12 3Z" />
        </svg>
      </button>
    </article>
  );
}
