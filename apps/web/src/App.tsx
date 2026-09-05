import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, ArrowUpRight, CheckCircle2, ChevronDown, ChevronRight, CircleAlert, FileCode2, Folder, LoaderCircle, Search, UploadCloud } from "lucide-react";

type Entry = { normalizedPath: string; type: "file" | "directory"; uncompressedSize: number };
type Inspection = { format: "zip" | "tar" | "tar.gz"; files: number; directories: number; compressedSize: number; uncompressedSize: number; entries: Entry[] };
type Job = { id: string; state: "queued" | "running" | "completed" | "failed"; progress: number; error?: string };
type UploadResponse = { artifact: { id: string; filename: string; size: number; sha256: string }; job: Job };
type Preview = { path: string; content: string; truncated: boolean };

const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:4100";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(job: Job | null) {
  if (!job) return "Waiting for an archive";
  if (job.state === "completed") return "Inspection complete";
  if (job.state === "failed") return "Inspection failed";
  return job.state === "queued" ? "Queued for inspection" : "Inspecting archive";
}

export function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [artifact, setArtifact] = useState<UploadResponse["artifact"] | null>(null);
  const [artifactId, setArtifactId] = useState<string | null>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!job || (job.state !== "queued" && job.state !== "running")) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`${API_URL}/v1/jobs/${job.id}`);
      if (!response.ok) return;
      const data = await response.json() as { job: Job; result?: Inspection };
      setJob(data.job);
      if (data.result) setInspection(data.result);
    }, 400);
    return () => window.clearInterval(timer);
  }, [job]);

  const visibleEntries = useMemo(() => {
    if (!inspection) return [];
    const needle = query.trim().toLowerCase();
    return inspection.entries.filter((entry) => !needle || entry.normalizedPath.toLowerCase().includes(needle));
  }, [inspection, query]);

  async function upload(file: File) {
    setError(null);
    setInspection(null);
    setSelectedPath(null);
    setPreview(null);
    const body = new FormData();
    body.append("file", file);
    try {
      const response = await fetch(`${API_URL}/v1/artifacts`, { method: "POST", body });
      const data = await response.json() as UploadResponse & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Upload failed");
      setArtifact(data.artifact);
      setArtifactId(data.artifact.id);
      setJob(data.job);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed");
    }
  }

  function pick(fileList: FileList | null) {
    const file = fileList?.[0];
    if (file) void upload(file);
  }

  const selectedEntry = inspection?.entries.find((entry) => entry.normalizedPath === selectedPath);

  useEffect(() => {
    if (!selectedEntry || selectedEntry.type !== "file" || !artifactId) {
      setPreview(null);
      return;
    }
    setPreviewLoading(true);
    fetch(`${API_URL}/v1/artifacts/${artifactId}/file?path=${encodeURIComponent(selectedEntry.normalizedPath)}`)
      .then(async (response) => response.ok ? response.json() as Promise<{ preview: Preview }> : null)
      .then((data) => setPreview(data?.preview ?? null))
      .finally(() => setPreviewLoading(false));
  }, [artifactId, selectedEntry]);

  const previewPanel = selectedEntry ? (
    <>
      <div className="preview-label">ENTRY INSPECTOR</div>
      <h3>{selectedEntry.normalizedPath.split("/").pop()}</h3>
      <div className="preview-path">{selectedEntry.normalizedPath}</div>
      <div className="preview-stat"><span>Type</span><strong>{selectedEntry.type}</strong></div>
      <div className="preview-stat"><span>Logical size</span><strong>{formatBytes(selectedEntry.uncompressedSize)}</strong></div>
      {selectedEntry.type === "file" ? previewLoading ? (
        <div className="preview-placeholder">Loading bounded preview...</div>
      ) : preview ? (
        <pre className="code-preview">{preview.content}{preview.truncated ? "\n\n... preview truncated at 256 KB" : ""}</pre>
      ) : (
        <div className="preview-placeholder">Binary or unavailable preview.</div>
      ) : (
        <div className="preview-placeholder">Folder metadata only.</div>
      )}
    </>
  ) : (
    <div className="empty-preview"><FileCode2 size={30} /><strong>Select an entry</strong><span>Choose a file or folder to inspect its metadata.</span></div>
  );

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><Archive size={18} /></span><span>DEV<span className="brand-accent">FLOW</span></span></div>
        <div className="topbar-status"><span className="status-dot" /> Local workspace <ArrowUpRight size={14} /></div>
      </header>

      <section className="hero">
        <div className="eyebrow">ARCHIVE WORKSPACE / 01</div>
        <h1>See what is inside<br /><em>before it runs.</em></h1>
        <p>Drop a project archive into a quiet, bounded inspection space. DevFlow maps the structure without executing a single file.</p>
      </section>

      <section className="workspace-grid">
        <div className="upload-panel">
          <div className={`dropzone ${dragging ? "is-dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); pick(event.dataTransfer.files); }}>
            <div className="upload-icon"><UploadCloud size={25} /></div>
            <h2>Drop an archive here</h2>
            <p>ZIP, TAR, or TAR.GZ up to 25 MB</p>
            <button className="primary-button" onClick={() => inputRef.current?.click()}>Choose archive <ArrowUpRight size={16} /></button>
            <input ref={inputRef} type="file" accept=".zip,.tar,.gz,.tgz" hidden onChange={(event) => pick(event.target.files)} />
          </div>
          {error && <div className="error-banner"><CircleAlert size={17} /> {error}</div>}
          {artifact && <div className="artifact-row"><div className="artifact-icon"><Archive size={18} /></div><div><strong>{artifact.filename}</strong><span>{formatBytes(artifact.size)} · SHA-256 {artifact.sha256.slice(0, 12)}...</span></div><CheckCircle2 className="success-icon" size={18} /></div>}
        </div>

        <aside className="status-panel">
          <div className="panel-kicker">PROCESSING STATUS</div>
          <div className="status-heading">{job?.state === "failed" ? <CircleAlert className="failure-icon" size={22} /> : job?.state === "completed" ? <CheckCircle2 className="success-icon" size={22} /> : <LoaderCircle className="spin" size={22} />}<strong>{statusLabel(job)}</strong></div>
          <div className="progress-track"><span style={{ width: `${job?.progress ?? 0}%` }} /></div>
          <div className="progress-meta"><span>{job ? `${job.progress}% analyzed` : "Ready when you are"}</span><span>Static only</span></div>
          <div className="boundary-note"><span>SAFE BOUNDARY</span><p>Paths are normalized and constrained. Archive links and executable content stay disabled.</p></div>
        </aside>
      </section>

      {inspection && <section className="explorer-section">
        <div className="section-heading"><div><div className="eyebrow">PROJECT EXPLORER</div><h2>Archive map</h2></div><div className="format-pill">{inspection.format.toUpperCase()} <ChevronDown size={14} /></div></div>
        <div className="metrics"><div><span>FILES</span><strong>{inspection.files}</strong></div><div><span>FOLDERS</span><strong>{inspection.directories}</strong></div><div><span>COMPRESSED</span><strong>{formatBytes(inspection.compressedSize)}</strong></div><div><span>EXPANDED</span><strong>{formatBytes(inspection.uncompressedSize)}</strong></div></div>
        <div className="explorer-layout">
          <div className="tree-panel"><div className="tree-toolbar"><div className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter files" /></div><span>{visibleEntries.length} results</span></div><div className="entry-list">{visibleEntries.map((entry) => <button className={`entry ${selectedPath === entry.normalizedPath ? "selected" : ""}`} key={entry.normalizedPath} onClick={() => setSelectedPath(entry.normalizedPath)}>{entry.type === "directory" ? <Folder size={16} /> : <FileCode2 size={16} />}<span>{entry.normalizedPath}</span>{entry.type === "directory" ? <ChevronRight size={14} /> : <small>{formatBytes(entry.uncompressedSize)}</small>}</button>)}</div></div>
          <div className="preview-panel">{previewPanel}</div>
        </div>
      </section>}
      <footer><span>DEVFLOW / STATIC INSPECTION</span><span>Private by default · Local retention</span></footer>
    </main>
  );
}
