import { useState } from "react";
import type { ToolDefinition } from "../tools";

interface ToolLogoProps {
  tool: ToolDefinition;
  size?: "small" | "medium" | "large";
}

function faviconUrl(pageUrl: string): string {
  const url = new URL(chrome.runtime.getURL("/_favicon/"));
  url.searchParams.set("pageUrl", pageUrl);
  url.searchParams.set("size", "64");
  return url.toString();
}

export function ToolLogo({ tool, size = "medium" }: ToolLogoProps) {
  const imageSource = tool.icon || (tool.iconSource === "favicon" ? faviconUrl(tool.url) : "");
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const showImage = Boolean(imageSource) && failedSource !== imageSource;
  const imageSize = size === "small" ? 22 : size === "large" ? 34 : 28;

  return (
    <span
      className={`tool-logo tool-logo-${size}`}
      data-tone={tool.iconTone ?? "adaptive"}
      data-frame={tool.iconFrame ?? "glyph"}
      aria-hidden="true"
    >
      {showImage ? (
        <img
          src={imageSource}
          alt=""
          width={imageSize}
          height={imageSize}
          decoding="async"
          data-tone={tool.iconTone ?? "adaptive"}
          onError={() => setFailedSource(imageSource)}
        />
      ) : (
        <span className="tool-logo-fallback">{tool.fallback}</span>
      )}
    </span>
  );
}
