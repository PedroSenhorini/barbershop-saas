import QRCode from "qrcode";

/** QR Code em SVG (texto), gerado no servidor: sem imagem externa e nítido na impressão. */
export function qrSvg(text: string) {
  return QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
}
