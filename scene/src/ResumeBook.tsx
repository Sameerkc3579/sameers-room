import { Book, Cover } from './Book'
import { PdfViewer } from './PdfViewer'
import { profile, EMAIL, GITHUB, LINKEDIN } from '../../os/src/content/profile'

const PDF = './os/resume.pdf'

/** The notebooks open as a book: contact details inside the cover, the real resume (zoomable) on the right. */
export function ResumeBook() {
  return (
    <Book
      label="Resume"
      cover={<Cover title="Resume" line={profile.name} small={profile.role} />}
      inside={
        <div className="bk-center">
          <h3>{profile.name}</h3>
          <p className="cb-role">{profile.role}</p>
          <p className="cb-line">{profile.education.degree}</p>
          <p className="cb-line">IIIT Naya Raipur · CGPA {profile.education.cgpa}</p>
          <div className="cb-links">
            <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
            <a href={GITHUB} target="_blank" rel="noreferrer">
              GitHub ↗
            </a>
            <a href={LINKEDIN} target="_blank" rel="noreferrer">
              LinkedIn ↗
            </a>
          </div>
          <div className="cb-actions">
            <a className="cb-btn primary" href={PDF} download="Sameer_Choudhary_Resume.pdf">
              Download PDF
            </a>
            <a className="cb-btn" href={PDF} target="_blank" rel="noreferrer">
              Open in new tab ↗
            </a>
          </div>
          <p className="cb-tip">Zoom with the bar above the page, Ctrl + scroll, or pinch.</p>
        </div>
      }
      page={<PdfViewer src={PDF} />}
    />
  )
}
