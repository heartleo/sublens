import { useState } from "react";
import type { ToolDefinition } from "../../tools";

interface ToolLogoProps {
  tool: ToolDefinition;
  size?: "small" | "medium";
}

export function ToolLogo({ tool, size = "medium" }: ToolLogoProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(tool.icon) && !failed;
  const imageSize = size === "small" ? 22 : 28;

  return (
    <span
      className={`tool-logo tool-logo-${size}`}
      data-tone={tool.iconTone ?? "adaptive"}
      data-frame={tool.iconFrame ?? "glyph"}
      aria-hidden="true"
    >
      {showImage ? (
        <img
          src={tool.icon}
          alt=""
          width={imageSize}
          height={imageSize}
          decoding="async"
          data-tone={tool.iconTone ?? "adaptive"}
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{tool.fallback}</span>
      )}
    </span>
  );
}
