import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyTheme } from "../appearance";
import { ToolLogo } from "../components/ToolLogo";
import type { Locale } from "../i18n";
import { createPermissionManager } from "../permissions";
import { preferencesStore, type Preferences } from "../preferences";
import { providers } from "../providers";
import { extensionStorage, type ExtensionState } from "../storage";
import {
  createCustomTool,
  listBuiltInTools,
  normalizeToolUrl,
  suggestToolFromUrl,
  type ToolCategory,
  type ToolDefinition,
  type ToolIconSource,
} from "../tools";
import { getOptionsMessages, type OptionsMessages } from "./messages";

type SectionId = "general" | "tools" | "subscriptions" | "data";
type EditorMode = "automatic" | "upload" | "letter";

const sections: readonly SectionId[] = ["general", "tools", "subscriptions", "data"];
const categories: readonly ToolCategory[] = ["chat", "create", "code", "explore"];
const builtInTools = listBuiltInTools();
const permissionManager = createPermissionManager(
  providers.map((provider) => ({ providerId: provider.id, permissions: provider.permissions })),
  {
    contains: (permissions) => chrome.permissions.contains(permissions),
    request: (permissions) => chrome.permissions.request(permissions),
    remove: (permissions) => chrome.permissions.remove(permissions),
  }
);

interface AppProps {
  initialPreferences: Preferences;
}

interface EditorProps {
  tool: ToolDefinition | null;
  customTools: readonly ToolDefinition[];
  messages: OptionsMessages;
  onClose(): void;
  onSave(tool: ToolDefinition, faviconDenied: boolean): void;
}

function Icon({ name }: { name: SectionId | "plus" | "edit" | "trash" | "external" }) {
  const paths: Record<string, React.ReactNode> = {
    general: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.96 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3 14H3v-4h.08A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V3h4v.08A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9 1.7 1.7 0 0 0 21 10v4a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
    tools: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    subscriptions: (
      <>
        <path d="M20 7H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z" />
        <path d="M16 3H8M2 11h20" />
      </>
    ),
    data: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 16v-4m0-4h.01" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    edit: (
      <>
        <path d="m4 20 4.2-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" />
        <path d="m13.7 7.5 3 3" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7" />
        <path d="M10 11v6m4-6v6" />
      </>
    ),
    external: (
      <>
        <path d="M14 4h6v6m0-6-9 9" />
        <path d="M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function SettingRow({
  title,
  help,
  children,
}: {
  title: string;
  help: string;
  children: React.ReactNode;
}) {
  return (
    <div className="setting-row">
      <span>
        <strong>{title}</strong>
        <small>{help}</small>
      </span>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange(value: T): void;
}) {
  return (
    <div className="segmented">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? "selected" : ""}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function IconSourceGlyph({ mode }: { mode: EditorMode }) {
  if (mode === "automatic") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Z" />
        <path d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
      </svg>
    );
  }
  if (mode === "upload") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <circle cx="8.5" cy="9" r="1.5" />
        <path d="m5 17 4.2-4.2 3.1 3.1 2.2-2.2L19 18" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 19 11.2 5h1.6L18 19M8 14h8" />
    </svg>
  );
}

function IconSourceOption({
  mode,
  selected,
  label,
  description,
  onChange,
}: {
  mode: EditorMode;
  selected: boolean;
  label: string;
  description: string;
  onChange(mode: EditorMode): void;
}) {
  return (
    <label className={`icon-source-option ${selected ? "selected" : ""}`}>
      <input
        type="radio"
        name="icon-source"
        value={mode}
        checked={selected}
        onChange={() => onChange(mode)}
      />
      <span className="icon-source-glyph">
        <IconSourceGlyph mode={mode} />
      </span>
      <span className="icon-source-copy">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <svg className="icon-source-check" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="6" />
        <path d="m5.2 8 1.7 1.7 3.8-4" />
      </svg>
    </label>
  );
}

async function resizeImage(file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) throw new Error("size");
  if (!new Set(["image/png", "image/jpeg", "image/webp"]).has(file.type)) throw new Error("type");
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("type");
    const scale = Math.min(112 / image.naturalWidth, 112 / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    context.drawImage(image, (128 - width) / 2, (128 - height) / 2, width, height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(source);
  }
}

function ToolEditor({ tool, customTools, messages: t, onClose, onSave }: EditorProps) {
  const [url, setUrl] = useState(tool?.url ?? "");
  const [name, setName] = useState(tool?.name ?? "");
  const [category, setCategory] = useState<ToolCategory>(tool?.category ?? "explore");
  const [mode, setMode] = useState<EditorMode>(
    tool?.iconSource === "uploaded"
      ? "upload"
      : tool?.iconSource === "letter"
        ? "letter"
        : "automatic"
  );
  const [uploadedIcon, setUploadedIcon] = useState(
    tool?.iconSource === "uploaded" ? tool.icon : ""
  );
  const [nameTouched, setNameTouched] = useState(Boolean(tool));
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const suggestion = useMemo(() => suggestToolFromUrl(url), [url]);
  const normalized = suggestion?.url ?? null;
  const duplicate = normalized
    ? customTools.some(
        (candidate) => candidate.id !== tool?.id && normalizeToolUrl(candidate.url) === normalized
      )
    : false;
  const preview = useMemo(
    () =>
      createCustomTool("preview", {
        name: name || suggestion?.name || "AI",
        url: normalized ?? "https://example.com/",
        category,
        icon:
          mode === "upload" ? uploadedIcon : mode === "automatic" ? (suggestion?.icon ?? "") : "",
        iconSource:
          mode === "upload"
            ? "uploaded"
            : mode === "letter"
              ? "letter"
              : (suggestion?.iconSource ?? "letter"),
        iconTone: suggestion?.iconTone,
        iconFrame: suggestion?.iconFrame,
      }),
    [category, mode, name, normalized, suggestion, uploadedIcon]
  );
  const previewStatus =
    mode === "letter"
      ? t.letterIcon
      : mode === "upload"
        ? uploadedIcon
          ? t.imageReady
          : t.chooseImage
        : !normalized
          ? t.enterWebsite
          : suggestion?.iconSource === "packaged"
            ? t.officialArtwork
            : t.faviconOnSave;
  const previewDetail = normalized ? new URL(normalized).host : t.iconPreview;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [
        ...dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ),
      ];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.classList.add("dialog-open");
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("dialog-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const changeUrl = (value: string) => {
    setUrl(value);
    const next = suggestToolFromUrl(value);
    if (!nameTouched && next) {
      setName(next.name);
      setCategory(next.category);
    }
    setError("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!normalized) return setError(t.invalidWebsite);
    if (duplicate) return setError(t.duplicateWebsite);
    if (!name.trim()) return setError(t.invalidName);
    if (mode === "upload" && !uploadedIcon) return setError(t.invalidImage);
    let source: ToolIconSource =
      mode === "letter"
        ? "letter"
        : mode === "upload"
          ? "uploaded"
          : (suggestion?.iconSource ?? "letter");
    let icon =
      mode === "upload" ? uploadedIcon : mode === "automatic" ? (suggestion?.icon ?? "") : "";
    let faviconDenied = false;
    if (source === "favicon") {
      const hasPermission = await chrome.permissions.contains({ permissions: ["favicon"] });
      if (!hasPermission && !(await chrome.permissions.request({ permissions: ["favicon"] }))) {
        source = "letter";
        icon = "";
        faviconDenied = true;
      }
    }
    onSave(
      createCustomTool(tool?.id ?? `custom-${crypto.randomUUID()}`, {
        name,
        url: normalized,
        category,
        icon,
        iconSource: source,
        iconTone: source === "packaged" ? suggestion?.iconTone : "color",
        iconFrame: source === "packaged" ? suggestion?.iconFrame : "app",
      }),
      faviconDenied
    );
  };

  return (
    <div className="dialog-layer">
      <button className="dialog-scrim" type="button" aria-label={t.cancel} onClick={onClose} />
      <div
        ref={dialogRef}
        className="tool-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tool-dialog-title"
      >
        <form onSubmit={(event) => void submit(event)}>
          <header>
            <div>
              <h2 id="tool-dialog-title">{tool ? t.editToolTitle : t.addToolTitle}</h2>
              <p>{t.iconHelp}</p>
            </div>
            <button type="button" className="close-button" aria-label={t.cancel} onClick={onClose}>
              ×
            </button>
          </header>
          <div className="dialog-body">
            <label className="field">
              <span>{t.website}</span>
              <input
                autoFocus
                type="url"
                value={url}
                placeholder="https://example.com/app"
                onChange={(event) => changeUrl(event.target.value)}
              />
              <small>{t.websiteHelp}</small>
            </label>
            <div className="form-grid">
              <label className="field">
                <span>{t.name}</span>
                <input
                  value={name}
                  maxLength={42}
                  onChange={(event) => {
                    setName(event.target.value);
                    setNameTouched(true);
                    setError("");
                  }}
                />
              </label>
              <label className="field">
                <span>{t.category}</span>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as ToolCategory)}
                >
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {t[item]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <fieldset className="field icon-field">
              <legend>{t.icon}</legend>
              <p className="icon-field-help">{t.iconSectionHelp}</p>
              <div className="icon-preview" aria-live="polite">
                <ToolLogo tool={preview} size="large" />
                <span className="icon-preview-copy">
                  <small>{t.iconPreview}</small>
                  <strong>{preview.name}</strong>
                  <small>{previewDetail}</small>
                </span>
                <span className="icon-preview-status">{previewStatus}</span>
              </div>
              <div className="icon-source-grid">
                <IconSourceOption
                  mode="automatic"
                  selected={mode === "automatic"}
                  label={t.automatic}
                  description={t.automaticHelp}
                  onChange={setMode}
                />
                <IconSourceOption
                  mode="upload"
                  selected={mode === "upload"}
                  label={t.upload}
                  description={t.uploadHelp}
                  onChange={setMode}
                />
                <IconSourceOption
                  mode="letter"
                  selected={mode === "letter"}
                  label={t.letter}
                  description={t.letterHelp}
                  onChange={setMode}
                />
              </div>
              {mode === "upload" ? (
                <label className="image-upload">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      void resizeImage(file)
                        .then((result) => {
                          setUploadedIcon(result);
                          setError("");
                        })
                        .catch((reason: Error) =>
                          setError(reason.message === "size" ? t.imageTooLarge : t.invalidImage)
                        );
                    }}
                  />
                  <span className="image-upload-glyph">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 16V4m0 0L8 8m4-4 4 4" />
                      <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
                    </svg>
                  </span>
                  <span>
                    <strong>{uploadedIcon ? t.replaceImage : t.chooseImage}</strong>
                    <small>{t.imageRequirements}</small>
                  </span>
                  {uploadedIcon ? (
                    <span className="image-ready">
                      <svg viewBox="0 0 16 16" aria-hidden="true">
                        <circle cx="8" cy="8" r="6" />
                        <path d="m5.2 8 1.7 1.7 3.8-4" />
                      </svg>
                      {t.imageReady}
                    </span>
                  ) : null}
                </label>
              ) : null}
            </fieldset>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <footer>
            <button type="button" className="secondary-button" onClick={onClose}>
              {t.cancel}
            </button>
            <button type="submit" className="primary-button">
              {tool ? t.saveChanges : t.addTool}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

function SubscriptionStatusIcon({ connected }: { connected: boolean }) {
  return connected ? (
    <svg className="status-icon connected" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" />
      <path d="m5.4 8 1.65 1.65 3.55-3.7" />
    </svg>
  ) : (
    <svg className="status-icon" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="5.2" r="2.1" />
      <path d="M4.2 12.5c.4-2.15 1.67-3.25 3.8-3.25s3.4 1.1 3.8 3.25" />
    </svg>
  );
}

export default function App({ initialPreferences }: AppProps) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [state, setState] = useState<ExtensionState | null>(null);
  const [connections, setConnections] = useState<Record<string, boolean>>({});
  const [section, setSection] = useState<SectionId>(() =>
    sections.includes(location.hash.slice(1) as SectionId)
      ? (location.hash.slice(1) as SectionId)
      : "tools"
  );
  const [editor, setEditor] = useState<ToolDefinition | null | undefined>(undefined);
  const [notice, setNotice] = useState("");
  const [pendingProviderId, setPendingProviderId] = useState<string | null>(null);
  const builtInListRef = useRef<HTMLDivElement>(null);
  const t = getOptionsMessages(preferences.locale);

  const loadState = useCallback(async () => {
    const [nextState, entries] = await Promise.all([
      extensionStorage.load(),
      Promise.all(
        providers.map(
          async (provider) =>
            [provider.id, await permissionManager.isConnected(provider.id)] as const
        )
      ),
    ]);
    setState(nextState);
    setConnections(Object.fromEntries(entries));
  }, []);
  useEffect(() => {
    void loadState();
  }, [loadState]);
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(""), 3200);
    return () => clearTimeout(id);
  }, [notice]);

  const updatePreferences = async (patch: Partial<Omit<Preferences, "version">>) => {
    const next = await preferencesStore.update(patch);
    setPreferences(next);
    applyTheme(next.theme);
    document.documentElement.lang = next.locale;
    setNotice(getOptionsMessages(next.locale).saved);
  };
  const chooseSection = (next: SectionId) => {
    setSection(next);
    history.replaceState(null, "", `#${next}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const saveTool = async (tool: ToolDefinition, faviconDenied: boolean) => {
    const editing = editor !== null;
    setState(await extensionStorage.saveCustomTool(tool));
    setEditor(undefined);
    setNotice(faviconDenied ? t.faviconDenied : editing ? t.toolUpdated : t.toolAdded);
  };
  const deleteTool = async (tool: ToolDefinition) => {
    if (!confirm(t.confirmDelete)) return;
    setState(await extensionStorage.removeCustomTool(tool.id));
    setNotice(t.toolDeleted);
  };
  const toggleBuiltIn = async (toolId: string, visible: boolean) =>
    setState(await extensionStorage.setBuiltInVisible(toolId, visible));
  const connect = async (providerId: string) => {
    setPendingProviderId(providerId);
    try {
      const result = await permissionManager.connect(providerId);
      if (result.status === "connected") {
        const refreshed = await chrome.runtime.sendMessage({
          type: "refresh-provider",
          providerId,
        });
        setNotice(refreshed?.ok ? t.connectionGranted : (refreshed?.error ?? t.saveFailed));
      } else setNotice(t.connectionDenied);
      await loadState();
    } finally {
      setPendingProviderId(null);
    }
  };
  const disconnect = async (providerId: string) => {
    setPendingProviderId(providerId);
    try {
      const result = await permissionManager.disconnect(providerId);
      setNotice(result.status === "disconnected" ? t.disconnected : t.saveFailed);
      await chrome.runtime.sendMessage({ type: "update-badge" });
      await loadState();
    } finally {
      setPendingProviderId(null);
    }
  };
  const refreshProvider = async (providerId: string) => {
    setPendingProviderId(providerId);
    try {
      const result = await chrome.runtime.sendMessage({ type: "refresh-provider", providerId });
      setNotice(result?.ok ? t.connectionGranted : (result?.error ?? t.saveFailed));
      await loadState();
    } finally {
      setPendingProviderId(null);
    }
  };
  const runReset = async (
    action: () => Promise<ExtensionState>,
    message: string,
    confirmation?: string
  ) => {
    if (confirmation && !confirm(confirmation)) return;
    setState(await action());
    setNotice(message);
  };

  return (
    <>
      <header className="topbar">
        <a
          className="brand"
          href="#tools"
          onClick={(event) => {
            event.preventDefault();
            chooseSection("tools");
          }}
        >
          <span className="brand-mark">S</span>
          <span>
            <strong>SubLens</strong>
            <small>{t.settings}</small>
          </span>
        </a>
      </header>
      <div className="settings-layout">
        <nav className="settings-nav" aria-label={t.settings}>
          {sections.map((item) => (
            <button
              key={item}
              type="button"
              className={section === item ? "active" : ""}
              aria-current={section === item ? "page" : undefined}
              onClick={() => chooseSection(item)}
            >
              <Icon name={item} />
              <span>{item === "data" ? t.dataAbout : t[item]}</span>
            </button>
          ))}
        </nav>
        <main className="settings-main">
          {section === "general" ? (
            <>
              <div className="page-heading">
                <p>{t.settings}</p>
                <h1>{t.general}</h1>
              </div>
              <section className="settings-card">
                <h2>{t.appearance}</h2>
                <SettingRow title={t.theme} help={t.themeHelp}>
                  <Segmented
                    value={preferences.theme}
                    options={[
                      { value: "system", label: t.system },
                      { value: "light", label: t.light },
                      { value: "dark", label: t.dark },
                    ]}
                    onChange={(theme) => void updatePreferences({ theme })}
                  />
                </SettingRow>
                <SettingRow title={t.language} help={t.languageHelp}>
                  <Segmented
                    value={preferences.locale}
                    options={[
                      { value: "en" as Locale, label: t.english },
                      { value: "zh" as Locale, label: t.chinese },
                    ]}
                    onChange={(locale) => void updatePreferences({ locale })}
                  />
                </SettingRow>
              </section>
              <section className="settings-card">
                <h2>{t.launcher}</h2>
                <SettingRow title={t.defaultPage} help={t.defaultPageHelp}>
                  <Segmented
                    value={preferences.defaultView}
                    options={[
                      { value: "home", label: t.home },
                      { value: "tools", label: t.toolsPage },
                    ]}
                    onChange={(defaultView) => void updatePreferences({ defaultView })}
                  />
                </SettingRow>
              </section>
            </>
          ) : null}
          {section === "tools" && state ? (
            <>
              <div className="page-heading with-action">
                <div>
                  <p>{t.settings}</p>
                  <h1>{t.toolsTitle}</h1>
                  <span>{t.toolsDescription}</span>
                </div>
                <button type="button" className="primary-button" onClick={() => setEditor(null)}>
                  <Icon name="plus" />
                  {t.addTool}
                </button>
              </div>
              <section className="overview-grid">
                <div className="metric-card">
                  <span>{t.toolDirectory}</span>
                  <strong>{builtInTools.length + state.customTools.length}</strong>
                  <small>{t.toolDirectoryHelp}</small>
                </div>
                <div className="metric-card">
                  <span>{t.builtInVisibility}</span>
                  <strong>
                    {builtInTools.length - state.hiddenBuiltInTools.length}
                    <small> / {builtInTools.length}</small>
                  </strong>
                  <button
                    type="button"
                    onClick={() => builtInListRef.current?.scrollIntoView({ behavior: "smooth" })}
                  >
                    {t.manage}
                  </button>
                </div>
              </section>
              <section className="settings-card tool-section">
                <div className="card-heading">
                  <div>
                    <h2>{t.addedByYou}</h2>
                    <p>
                      {state.customTools.length} {t.toolCount}
                    </p>
                  </div>
                </div>
                {state.customTools.length ? (
                  <div className="tool-list">
                    {state.customTools.map((tool) => (
                      <div className="tool-row" key={tool.id}>
                        <ToolLogo tool={tool} size="medium" />
                        <span className="tool-copy">
                          <strong>{tool.name}</strong>
                          <small>
                            {new URL(tool.url).host} · {t[tool.category]}
                          </small>
                        </span>
                        <button
                          className="row-icon-button"
                          type="button"
                          aria-label={`${t.edit} ${tool.name}`}
                          onClick={() => setEditor(tool)}
                        >
                          <Icon name="edit" />
                        </button>
                        <button
                          className="row-icon-button danger"
                          type="button"
                          aria-label={`${t.delete} ${tool.name}`}
                          onClick={() => void deleteTool(tool)}
                        >
                          <Icon name="trash" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-panel">
                    <span className="empty-icon">
                      <Icon name="plus" />
                    </span>
                    <strong>{t.noCustomTools}</strong>
                    <p>{t.noCustomToolsHelp}</p>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setEditor(null)}
                    >
                      {t.addTool}
                    </button>
                  </div>
                )}
              </section>
              <section ref={builtInListRef} className="settings-card tool-section">
                <div className="card-heading">
                  <div>
                    <h2>{t.builtIn}</h2>
                    <p>{t.builtInVisibilityHelp}</p>
                  </div>
                </div>
                <div className="tool-list built-in-list">
                  {builtInTools.map((tool) => {
                    const visible = !state.hiddenBuiltInTools.includes(tool.id);
                    return (
                      <div className="tool-row" key={tool.id}>
                        <ToolLogo tool={tool} size="medium" />
                        <span className="tool-copy">
                          <strong>{tool.name}</strong>
                          <small>{t[tool.category]}</small>
                        </span>
                        <span className={`visibility-label ${visible ? "" : "hidden"}`}>
                          {visible ? t.visible : t.hidden}
                        </span>
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={visible}
                            aria-label={`${visible ? t.visible : t.hidden} ${tool.name}`}
                            onChange={(event) => void toggleBuiltIn(tool.id, event.target.checked)}
                          />
                          <span />
                        </label>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          ) : null}
          {section === "subscriptions" && state ? (
            <>
              <div className="page-heading">
                <p>{t.settings}</p>
                <h1>{t.subscriptionsTitle}</h1>
                <span>{t.subscriptionsDescription}</span>
              </div>
              <section className="settings-card provider-list">
                {providers.map((provider) => {
                  const connected = connections[provider.id] === true;
                  const snapshot = state.subscriptions[provider.id];
                  const tool = builtInTools.find((candidate) => candidate.id === provider.id);
                  const pending = pendingProviderId === provider.id;
                  return (
                    <div className="provider-row" key={provider.id}>
                      {tool ? <ToolLogo tool={tool} size="medium" /> : null}
                      <span className="tool-copy">
                        <strong>{provider.name}</strong>
                        <small className={snapshot?.error ? "error-copy" : ""}>
                          {connected
                            ? (snapshot?.error ?? (snapshot?.plan || t.connectionReady))
                            : t.connectionHelp}
                        </small>
                      </span>
                      <span className={`connection-pill ${connected ? "connected" : ""}`}>
                        <SubscriptionStatusIcon connected={connected} />
                        {connected ? t.connected : t.notConnected}
                      </span>
                      {connected && snapshot?.loginUrl ? (
                        <button
                          type="button"
                          className="text-button"
                          onClick={() =>
                            void chrome.runtime.sendMessage({
                              type: "open-provider-login",
                              providerId: provider.id,
                            })
                          }
                        >
                          {t.signIn}
                        </button>
                      ) : null}
                      {connected ? (
                        <button
                          type="button"
                          className="secondary-button small"
                          disabled={pending}
                          onClick={() => void refreshProvider(provider.id)}
                        >
                          {t.refresh}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={connected ? "text-button danger-text" : "primary-button small"}
                        disabled={pending}
                        onClick={() =>
                          void (connected ? disconnect(provider.id) : connect(provider.id))
                        }
                      >
                        {pending ? t.working : connected ? t.disconnect : t.connect}
                      </button>
                    </div>
                  );
                })}
              </section>
            </>
          ) : null}
          {section === "data" && state ? (
            <>
              <div className="page-heading">
                <p>{t.settings}</p>
                <h1>{t.dataTitle}</h1>
                <span>{t.dataDescription}</span>
              </div>
              <section className="settings-card">
                <h2>{t.launcherData}</h2>
                <SettingRow title={t.clearActivity} help={t.clearActivityHelp}>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() =>
                      void runReset(() => extensionStorage.clearActivity(), t.activityCleared)
                    }
                  >
                    {t.clear}
                  </button>
                </SettingRow>
                <SettingRow title={t.resetOrder} help={t.resetOrderHelp}>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() =>
                      void runReset(() => extensionStorage.resetToolOrder(), t.orderReset)
                    }
                  >
                    {t.reset}
                  </button>
                </SettingRow>
                <SettingRow title={t.resetFavorites} help={t.resetFavoritesHelp}>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() =>
                      void runReset(() => extensionStorage.resetFavorites(), t.favoritesReset)
                    }
                  >
                    {t.reset}
                  </button>
                </SettingRow>
                <SettingRow title={t.resetLauncher} help={t.resetLauncherHelp}>
                  <button
                    className="secondary-button danger-outline"
                    type="button"
                    onClick={() =>
                      void runReset(
                        () => extensionStorage.resetLauncher(),
                        t.launcherReset,
                        t.confirmResetLauncher
                      )
                    }
                  >
                    {t.reset}
                  </button>
                </SettingRow>
              </section>
              <section className="settings-card">
                <h2>{t.preferences}</h2>
                <SettingRow title={t.resetPreferences} help={t.resetPreferencesHelp}>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      if (!confirm(t.confirmResetPreferences)) return;
                      void preferencesStore.reset().then((next) => {
                        setPreferences(next);
                        applyTheme(next.theme);
                        document.documentElement.lang = next.locale;
                        setNotice(getOptionsMessages(next.locale).preferencesReset);
                      });
                    }}
                  >
                    {t.reset}
                  </button>
                </SettingRow>
              </section>
              <section className="settings-card">
                <h2>{t.about}</h2>
                <SettingRow
                  title="SubLens"
                  help={`${t.version} ${chrome.runtime.getManifest().version}`}
                >
                  <div className="link-actions">
                    <a
                      className="secondary-button"
                      href="https://github.com/heartleo/sublens"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t.github}
                      <Icon name="external" />
                    </a>
                    <a
                      className="secondary-button"
                      href="https://github.com/heartleo/sublens/blob/main/docs/privacy-policy.md"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t.privacy}
                      <Icon name="external" />
                    </a>
                  </div>
                </SettingRow>
              </section>
            </>
          ) : null}
        </main>
      </div>
      {state === null ? (
        <div className="loading" aria-label="Loading">
          <span />
        </div>
      ) : null}
      <div className={`toast ${notice ? "show" : ""}`} role="status" aria-live="polite">
        {notice}
      </div>
      {editor !== undefined && state ? (
        <ToolEditor
          tool={editor}
          customTools={[...builtInTools, ...state.customTools]}
          messages={t}
          onClose={() => setEditor(undefined)}
          onSave={(tool, faviconDenied) => void saveTool(tool, faviconDenied)}
        />
      ) : null}
    </>
  );
}
