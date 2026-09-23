/** Galat dari server (atau dari mode demo) dengan pesan siap tampil. */
export class GalatApi extends Error {
  status: number;
  data: Record<string, unknown>;
  constructor(pesan: string, status: number, data: Record<string, unknown> = {}) {
    super(pesan);
    this.name = 'GalatApi';
    this.status = status;
    this.data = data;
  }
}
