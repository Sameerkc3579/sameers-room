// pdf.js is big, so it only loads once someone heads for the resume (the notebooks start it while the camera glides).
let lib: Promise<typeof import('pdfjs-dist')> | null = null

export function loadPdfLib() {
  lib ??= Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]).then(
    ([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default
      return pdfjs
    },
  )
  return lib
}
