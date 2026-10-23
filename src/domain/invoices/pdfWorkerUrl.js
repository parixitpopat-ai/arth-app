// Browser-only: the URL of the locally bundled pdf.js worker. Not imported by Node tests (the ?url suffix is a Vite feature).
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
export default workerUrl;
