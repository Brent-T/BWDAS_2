/// <reference types="vite/client" />

// Allow importing the real Python deliverables as raw text for display.
declare module "*?raw" {
  const content: string;
  export default content;
}
