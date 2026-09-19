/** qrcode-svg ships no types; this is the slice of it we use. */
declare module "qrcode-svg" {
  interface Options {
    content: string;
    width?: number;
    height?: number;
    padding?: number;
    color?: string;
    background?: string;
    ecl?: "L" | "M" | "Q" | "H";
    join?: boolean;
    container?: string;
  }
  export default class QRCode {
    constructor(options: Options | string);
    svg(): string;
  }
}
