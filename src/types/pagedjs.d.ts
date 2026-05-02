declare module 'pagedjs' {
  export class Previewer {
    constructor();
    preview(content: string, stylesheets: string[], renderTo: HTMLElement): Promise<unknown>;
  }
}
