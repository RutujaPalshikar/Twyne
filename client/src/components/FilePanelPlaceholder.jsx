// Reserved slot for the next stage (real ephemeral file transfer).
export default function FilePanelPlaceholder({ children }) {
  return (
    <section className="panel panel-dashed" aria-labelledby="files-heading">
      <h2 id="files-heading">File sharing</h2>
      <p className="muted">{children}</p>
    </section>
  );
}
