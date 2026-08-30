export type ToolCategory = "chat" | "create" | "code" | "explore";

export type ToolSubcategory = "image" | "video" | "platform" | "research";

export type ToolIconSource = "packaged" | "favicon" | "uploaded" | "letter";

export interface ToolDefinition {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly icon: string;
  readonly iconSource?: ToolIconSource;
  readonly iconTone?: "adaptive" | "color" | "native";
  readonly iconFrame?: "glyph" | "app";
  readonly fallback: string;
  readonly category: ToolCategory;
  readonly subcategory?: ToolSubcategory;
  readonly aliases: readonly string[];
  readonly tags: readonly string[];
}
