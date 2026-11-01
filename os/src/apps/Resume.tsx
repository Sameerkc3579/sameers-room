const PDF = `${import.meta.env.BASE_URL}resume.pdf`

export function Resume() {
  return (
    <div className="window-body flush resume">
      <div className="toolbar">
        <a className="button" href={PDF} download="Sameer_Choudhary_Resume.pdf">
          Download
        </a>
        <a className="button" href={PDF} target="_blank" rel="noreferrer">
          Open in new tab ↗
        </a>
      </div>
      <object data={`${PDF}#view=FitH&toolbar=0`} type="application/pdf" className="pdf-frame">
        <div className="pdf-fallback">
          <p>This browser can't show PDFs inside a window.</p>
          <a className="button primary" href={PDF} target="_blank" rel="noreferrer">
            Open the resume
          </a>
        </div>
      </object>
    </div>
  )
}
